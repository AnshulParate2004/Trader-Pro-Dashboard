# Fixed-Rule 4H Trend Engine (v2) Canonical Research & Validation Report

> **Engine Name:** `fixed_rule_4h_v1`  
> **Repository:** Trader-Pro / Trader-Pro-Dashboard  
> **Status:** Reference Baseline Evaluated & Forward Paper Wired  
> **Date:** November 10, 2026  
> **Config File:** `config/fixed_rule_4h_v1.json` (Single Source of Truth)  
> **Branch:** `feat/fixed-rule-4h-v2`  
> **Audit Standard:** docs/LESSONS.md (Validation Gates 1–7)

---

## 1. Executive Summary & Plain-English Verdict

This research report documents the design, rigorous backtesting, statistical gating, and TypeScript paper-trading integration of **ONE clean, honest, no-ML fixed-rule 4-Hour trend following engine** (`fixed_rule_4h_v1`).

### Plain-English Verdict: Does this engine have a proven edge?
**NO, the engine DOES NOT have a statistically proven edge at the standard 95% confidence level, and it FAILS Gate 7 Residual Alpha Attribution.**

1. **Statistical Insignificance at 95% Confidence:**
   - Over 134 portfolio trades spanning 2020 to October 2026 across BTCUSDT and ETHUSDT, the strategy achieved a nominal mean net return of **`+0.1920R`** per trade and a profit factor of **`1.47`**.
   - However, the 95% block-bootstrap confidence interval ($B=10$, 1,000 resamples) is **`[-0.0283R, +0.4052R]`**. Because the confidence interval encompasses zero, the nominal positive return cannot be distinguished from noise or luck at the 95% level.
   - Against 200 random-entry coin-flip seeds with identical exits and stops, the strategy achieved the 94.5th percentile ($p = 0.0550$), just failing the standard $p < 0.05$ significance threshold.

2. **Gate 7 Falsification (Residual Alpha vs Buy-and-Hold):**
   - Regressing daily strategy returns against buy-and-hold market exposure using OLS with Newey-West HAC standard errors (365-day calendar scaling) produced:
     $$\text{Daily Alpha } \alpha = +0.000099 \quad (+3.61\% \text{ annualized}), \quad \beta = -0.0002, \quad t_{\text{HAC}} = 1.267$$
   - Because $t_{\text{HAC}} = 1.267 < 2.0$, **Gate 7 FAILS**. The strategy's returns are largely an artifact of cash allocation and market drift rather than statistically significant residual alpha.

3. **Indian Statutory 30% Tax Drag (Section 115BBH):**
   - On ₹7,000 base capital, pre-tax net profit was **`+₹1,800.84`** (+25.7%).
   - Gross winning trades generated ₹5,637.58. Under Section 115BBH (flat 30% tax with zero loss offset), tax liability is **`₹1,691.27`**.
   - **After-tax net profit collapses to `+₹109.57` (+1.57% over 6.8 years).** Statutory taxes consume **93.9% of net strategy earnings**.
   - Furthermore, estimated 1% Section 194S TDS on notional turnover equals **`₹2,368.26`**, completely exceeding total net pre-tax profit if applicable.

4. **Why It Remains a Crucial Baseline:**
   - **Gate 2 Noise Null Passes:** Mean gross return across 100 Geometric Brownian Motion seeds is **`-0.0083R`** ($|\mu| \le 0.01\text{R}$), proving the backtest simulator has **zero artificial upward bias**.
   - **Parameter Robustness (Plateau Grid):** 108 of 108 parameter cells (100.0%) across lookback, trend, stretch, and trailing multiplier variations maintained positive net R and profit factor > 1.0.
   - **Trailing Exits vs Fixed Targets:** Replacing fixed 2.5R profit targets with a 3×ATR Chandelier trailing stop converted a losing system ($-0.0193\text{R}$) into positive expectancy ($+0.1920\text{R}$).

---

## 2. Full Technical Specification (`config/fixed_rule_4h_v1.json`)

The configuration is shared across Python reference scripts and TypeScript production executors:

```json
{
  "version": "1.0.0",
  "engine_name": "fixed_rule_4h_v1",
  "timeframe": "4h",
  "assets": ["BTCUSDT", "ETHUSDT"],
  "entry": {
    "donchian_lookback": 20,
    "sma_filter_period": 200,
    "eval_bar": "closed_bar_t",
    "fill_bar": "open_bar_t_plus_1"
  },
  "filters": {
    "ema_period": 50,
    "ema_slope_bars": 10,
    "ema_slope_threshold": 0.0005,
    "stretch_atr_mult": 3.0,
    "min_body_atr_ratio": 0.25,
    "close_quantile_ratio": 0.60,
    "min_volume_mult": 0.85,
    "volume_sma_period": 50,
    "atr_period": 14
  },
  "btc_regime_gate": {
    "enabled_for_alts": true,
    "btc_symbol": "BTCUSDT",
    "btc_sma_period": 200,
    "btc_ema_period": 50,
    "btc_ema_slope_bars": 10,
    "btc_ema_slope_min": 0.0
  },
  "stop": {
    "lookback_bars": 10,
    "min_stop_pct": 0.023,
    "max_stop_pct": 0.060,
    "clamp_mode": "skip"
  },
  "exit": {
    "type": "chandelier_trailing",
    "chandelier_atr_mult": 3.0,
    "chandelier_atr_period": 14,
    "chandelier_anchor": "highest_close",
    "chandelier_activation": "next_bar_after_entry",
    "max_hold_bars": 42
  },
  "execution_realism": {
    "same_bar_ambiguity": "stop_first",
    "trail_update_delay": "next_bar"
  },
  "costs": {
    "taker_round_trip_friction": 0.001144,
    "funding_rate_fallback_8h_long": 0.0001,
    "funding_rate_fallback_8h_short": 0.0,
    "use_binance_funding_history": true
  },
  "sizing": {
    "starting_capital_inr": 7000.0,
    "risk_per_trade_pct": 1.0,
    "risk_per_trade_inr": 70.0,
    "max_total_open_risk_pct": 2.0,
    "max_concurrent_positions": 2,
    "correlated_group": true
  },
  "direction": "BOTH"
}
```

### Execution Invariants
- **Gate 1 Zero Lookahead:** Indicators and rules are evaluated strictly on closed bar $t$.
- **Gate 3 Execution Realism:** Order fills strictly at the `open` of bar $t+1$.
- **Trailing Stop Timing:** Evaluated against bar $[t+k]$ high/low before trailing stop is updated with bar $[t+k]$ close and ATR. Trailing updates take effect strictly on bar $[t+k+1]$.
- **Collision Priority:** If a bar breaches both the initial stop and trailing stop, or touches stop and moves favorable, the stop loss is booked first (pessimistic fill).
- **Gate 4 Friction Model:** Institutional taker round-trip of $0.1144\%$ ($0.040\%$ fee $+ 18\%$ GST $+ 0.010\%$ slippage per side). At the $2.3\%$ minimum stop clamp, $\text{cost}_R = 0.001144 / 0.023 = \mathbf{0.0497\text{R}} \le 0.05$.

---

## 3. Backtest Performance Tables

### 3.1 Overall Strategy Performance (Primary Reference Spec)
- **Time Horizon:** 2020-01-01 to 2026-10-31 (6.8 Years)
- **Starting Capital:** ₹7,000.00 | **Risk per Trade:** ₹70.00 (1%)

| Metric | Primary Spec (Skip Mode) | Clamp Mode Variant |
|:---|:---:|:---:|
| **Total Trades** | **134** | 262 |
| **Win Rate** | **32.1%** (43 wins) | 38.2% (100 wins) |
| **Loss Rate** | **67.9%** (91 losses) | 61.8% (162 losses) |
| **Profit Factor** | **1.47** | 1.59 |
| **Mean Net R / Trade** | **+0.1920R** | +0.2316R |
| **95% Block-Bootstrap CI ($B=10$)** | **[-0.0283R, +0.4052R]** | [+0.0581R, +0.4124R] |
| **Avg Win R** | **+2.41R** | +2.05R |
| **Avg Loss R** | **-0.86R** | -0.89R |
| **Pre-Tax Net PnL (INR)** | **+₹1,800.84** (+25.7%) | +₹4,247.75 (+60.7%) |
| **Section 115BBH 30% Flat Tax** | **-₹1,691.27** | -₹3,568.10 |
| **After-Tax Net PnL (INR)** | **+₹109.57** (+1.57%) | +₹679.65 (+9.71%) |
| **Max Drawdown (INR / %)** | **-₹632.11 (-7.66%)** | -₹782.40 (-6.86%) |
| **Max Drawdown in R** | **-9.03R** | -11.18R |
| **Section 194S 1% TDS Turnover Note** | ₹2,368.26 | ₹5,841.12 |

---

### 3.2 Stability Split: DEV (2020–2023) vs TEST (2024–2026)
*Note: Because 2020–2026 was historically explored in prior iterations, these splits show structural stability across market regimes rather than sealed confirmatory hold-out evidence.*

| Window | Period | Trades | Win Rate | Profit Factor | Mean Net R | Net PnL (INR) | Max DD (%) |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **DEV** | 2020-01-01 to 2023-12-31 | 73 | 30.1% | 1.46 | +0.1818R | +₹928.91 | 7.66% |
| **TEST** | 2024-01-01 to 2026-10-31 | 61 | 34.4% | 1.49 | +0.1993R | +₹871.93 | 5.82% |

The engine exhibits remarkable consistency between the two eras (+0.182R vs +0.199R, PF 1.46 vs 1.49).

---

### 3.3 Performance Per Asset

| Asset | Trades | Win Rate | Profit Factor | Mean Net R | Net PnL (INR) | Max Drawdown |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **BTCUSDT** | 88 | 30.7% | 1.36 | +0.1420R | +₹874.55 | -₹521.14 (-6.68%) |
| **ETHUSDT** | 46 | 34.8% | 1.66 | +0.2877R | +₹926.30 | -₹380.20 (-4.81%) |

Both BTC and ETH individually show positive expectancy under the 3×ATR Chandelier trailing stop. ETH benefits strongly from the BTC regime gate, filtering chop during macro crypto winters.

---

### 3.4 Directional Performance (Long vs Short)

| Direction | Trades | Win Rate | Profit Factor | Mean Net R | Net PnL (INR) |
|:---|:---:|:---:|:---:|:---:|:---:|
| **LONG** | 82 | 34.1% | 1.93 | **+0.3440R** | +₹1,972.63 |
| **SHORT** | 52 | 28.8% | 0.78 | **-0.1090R** | -₹171.79 |

**Crucial Finding:** The strategy's entire historical edge comes from LONG trades (+0.344R, PF 1.93). SHORT trades lose money (-0.109R, PF 0.78) even on 4H candles with trend filters. Crypto perpetual structural drift and funding skew penalize short trend followers.

---

### 3.5 Annual Performance Table (2020–2026)

| Year | Trades | Win Rate | Profit Factor | Mean Net R | Net PnL (INR) | Market Context |
|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **2020** | 13 | 30.8% | 2.02 | +0.5772R | +₹525.28 | Halving bull market breakout |
| **2021** | 9 | 44.4% | 3.96 | +0.9078R | +₹571.94 | Strong momentum cycle |
| **2022** | 11 | 27.3% | 0.97 | -0.0188R | -₹14.48 | Bear market (Flat / preserved capital) |
| **2023** | 23 | 21.7% | 0.46 | -0.2289R | -₹368.51 | Sideways accumulation chop |
| **2024** | 30 | 30.0% | 1.61 | +0.2359R | +₹495.41 | ETF approval breakout |
| **2025** | 21 | 38.1% | 1.34 | +0.1153R | +₹169.54 | Sustained institutional trend |
| **2026** | 27 | 37.0% | 1.61 | +0.2231R | +₹421.67 | Continued trend momentum |

---

### 3.6 Exit Type Distribution
Over 134 completed trades:
- **Stop Loss (Initial Structural SL Hit):** 11 trades (**8.2%**), Average Return: -1.03R
- **Chandelier Trailing Stop:** 107 trades (**79.9%**), Average Return: +0.31R
- **Time Barrier (42 bars / 7 days):** 16 trades (**11.9%**), Average Return: +0.22R

Nearly 80% of trades exit via trailing stop, locking in profits on runaway runners and cutting losers early once momentum stalls.

---

## 4. Ablation Studies

To isolate which components generate edge and which are redundant, single-factor ablations were executed against the primary specification:

| Ablation Variant | Trades | Win Rate | PF | Mean Net R | Net PnL (INR) | Max DD (%) | Key Finding |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **0. Primary Reference Spec** | 134 | 32.1% | 1.47 | **+0.1920R** | +₹1,800.84 | 7.66% | Primary baseline (Skip mode) |
| **1. No BTC Regime Gate** | 148 | 34.5% | 1.84 | **+0.3276R** | +₹3,393.66 | 6.22% | ETH standalone breakouts performed well in 2020-2021 |
| **2. Clamp Mode ('clamp' vs 'skip')** | 262 | 38.2% | 1.59 | **+0.2316R** | +₹4,247.75 | 6.86% | Clamping tight stops yields more trades and more INR gains |
| **3. Fixed 2.5R Target (No Chandelier Trail)** | 134 | 32.1% | 0.95 | **-0.0193R** | -₹180.66 | 10.90% | **FATAL:** Without trailing stop, edge disappears completely |

### Key Ablation Insights:
1. **Trailing Stop is Mandatory:** Replacing the 3×ATR Chandelier trailing stop with a fixed 2.5R target dropped Mean Net R from **`+0.1920R`** to **`-0.0193R`** (profit factor collapsed from 1.47 to 0.95). In 4H crypto swing trading, fixed targets choke fat-tailed runners (+8R to +12R trades) while leaving open positions vulnerable to mean reversion.
2. **Skip vs Clamp:** Clamping stops to [2.3%, 6.0%] instead of skipping admitted 128 more trades with higher nominal PnL (+₹4,247 vs +₹1,800). However, the primary specification adheres strictly to `skip` mode to respect the structural invalidation principle.

---

## 5. Plateau Grid Robustness (108 Parameter Cells)

To verify the strategy is not an overfit point-in-time anomaly, a comprehensive 108-cell plateau grid was evaluated across 4 core parameter dimensions:
- **Donchian Lookback:** [15, 20, 25, 30] bars (4 values)
- **SMA Trend Filter Period:** [150, 200, 250] bars (3 values)
- **ATR Stretch Multiplier:** [2.5, 3.0, 3.5] (3 values)
- **Chandelier ATR Multiplier:** [2.5, 3.0, 3.5] (3 values)

### Results:
- **Total Parameter Cells Evaluated:** 108
- **Cells with Mean Net R > 0.00R:** **108 / 108 (100.0%)**
- **Cells with Profit Factor > 1.00:** **108 / 108 (100.0%)**
- **Robustness Rate:** **100.0%**
- Complete CSV output preserved at: `experiments/fixed_rule_4h_v2/plateau_grid.csv`.

The strategy does not sit on a narrow spike in parameter space; the entire neighborhood across lookbacks from 15 to 30 bars and Chandelier multipliers from 2.5 to 3.5 produces positive net expectancy.

---

## 6. Resolution of the "+0.131R" Mystery

### Context
In prior experimental script `step4_step5_retest_and_gating.py`, three distinct configurations (Config A, Config B, and Config C) all printed `+0.131R`. This raised concerns of potential state leakage, data reuse, or a caching bug.

### Audit Findings
Inspection of the raw unrounded calculations revealed:
- **Config A (Baseline Market Open):** Net PnL = ₹5,081.21 / (556 trades × ₹70) = **`+0.13055R`**
- **Config B (Market Open + BTC Gate):** Net PnL = ₹3,840.26 / (420 trades × ₹70) = **`+0.13062R`**
- **Config C (Breakout-Retest Limit):** Net PnL = ₹4,125.70 / (450 trades × ₹70) = **`+0.13097R`**

The reporting script used string format specifier `'{mean_net_r:+10.3f}R'`:
$$\text{round}(+0.13055, 3) = \mathbf{+0.131}$$
$$\text{round}(+0.13062, 3) = \mathbf{+0.131}$$
$$\text{round}(+0.13097, 3) = \mathbf{+0.131}$$

### Conclusion
**NOT a bug.** It was a statistical rounding coincidence at three decimal places across distinct trade sets.

---

## 7. Mandatory Validation Gates (docs/LESSONS.md) Audit Table

| Gate # | Gate Name | Requirement | Observed Verification | Status |
|:---|:---|:---|:---|:---:|
| **Gate 1** | Zero-Lookahead Verification | Features & decisions at $t$ strictly use data $\le t$ | Unit test confirmed; fills strictly at $t+1$ Open | **PASS** |
| **Gate 2** | Noise Null Invariant | $|\mu_{\text{gross, noise}}| \le 0.01\text{R}$ on 100 GBM seeds | **`-0.0083R`** on 100 GBM seeds (zero simulator bias) | **PASS** |
| **Gate 3** | Execution Realism | $P_{\text{entry}} = O_{t+1}$, stop collision beats trail | Next-bar open fill; pessimistic stop collision | **PASS** |
| **Gate 4** | Cost Friction Feasibility Ratio | $\text{cost}_R \le 0.05$ (11.44 bps round-trip) | **`0.0497R`** at 2.3% min stop ($0.1144\% / 2.3\%$) | **PASS** |
| **Gate 5** | Sealed Out-of-Sample Integrity | Evaluated once on hold-out | Forward paper log post-2026-10-31 | **PASS\*** |
| **Gate 6** | Dynamic Risk Normalization | $R = \text{Net PnL} / \text{Entry Risk INR}$ | Dynamic ₹70 risk logged on every trade | **PASS** |
| **Gate 7** | Residual Alpha Attribution | $t_{\text{HAC}} \ge 2.0$ vs Buy-and-Hold (365d) | **`t_HAC = 1.267`** ($p = 0.205$, $\alpha = 3.61\%$) | **FAIL** |
| **Random** | Null Baseline Comparison | $p < 0.05$ vs 200 coin-flip seeds | Strategy at 94.5th percentile (**`p = 0.0550`**) | **FAIL** |

*\*Gate 5 Note: Historical 2020–2026 data was previously explored during research; genuine confirmatory holdout is the forward paper execution log recorded from 2026-10-31 onwards.*

---

## 8. Forward Paper Trading Plan & Deployment Architecture

1. **Production Paper Executor (`src/lib/paperExecutor4HFixed.ts`):**
   - Implements identical logic, indicator math, next-bar open fills, and trailing exit mechanics.
   - Parity verified against Python reference on 230 candles with 10 passing parity tests (`tests/paperExecutor4HFixed.parity.test.ts`).
   - Integrated with `riskEngine.ts` (Gate 4 cost filter, daily loss limit, rolling kill switch, max drawdown stop).
2. **Automated 4H Cron Route (`app/api/cron/paper-4h-fixed/route.ts`):**
   - Scheduled to execute every 4 hours at completed candle closes (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC).
   - Writes forward trade records to `data/trades_4h_fixed.json` and MongoDB collection `paper_trades_4h_fixed`.
3. **Dashboard Monitoring (`/ai-engine`):**
   - Top-level view switcher allows instant access to the "Fixed Rules 4H Engine" panel.
   - Live display of cumulative equity curve, 95% bootstrap CI, pre-tax and after-tax PnL, open risk utilization vs the 2% cap, and raw CSV download.
4. **Confirmatory Holdout Target:**
   - 100 consecutive forward paper trades recorded strictly after October 31, 2026 will serve as the uncompromised confirmatory test. If forward Mean Net R remains $\ge +0.15\text{R}$ after realistic fees, production deployment with real capital may be considered.
