# Pre-Registration: Testing Frozen Fixed-Rule 4H Engine Across a Wider Universe

**Date:** 2026-11-10  
**Branch:** `feat/wider-universe`  
**Status:** PRE-REGISTERED (Committed BEFORE running any backtests on the wider universe)  
**Primary Engine:** `fixed_rule_4h_v1` (FROZEN in `config/fixed_rule_4h_v1.json`)

---

## 1. Objective & Hypothesis

The goal of this experiment is to test whether the frozen, no-ML fixed-rule 4H trend engine (`fixed_rule_4h_v1`) generalizes to unseen, untouched crypto perpetual markets and a multi-asset portfolio, or whether its performance on the design assets (BTC, ETH) was a selection artifact.

### Core Hypothesis
- If the fixed-rule breakout and chandelier trailing logic captures genuine structural momentum in crypto perpetuals, it should produce a positive, cost-resilient expectancy ($\text{PF} \ge 1.20$ and $95\% \text{ CI } > 0$) on completely **UNTOUCHED** assets that were never inspected or tuned during engine development.
- If the UNTOUCHED universe fails ($\text{PF} < 1.20$ or CI includes zero), we will state **FAIL** plainly.

---

## 2. Universe Definition & Data Availability Audit

All assets must have $\ge 3$ years of continuous 4H history.

| Universe Category | Asset | Source Timeframe | Bar Count | Start Date | End Date | Years of History | Real Binance Funding Available |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DESIGN** | BTCUSDT | 4H native | 14,947 | 2020-01-01 00:00 | 2026-10-27 00:00 | 6.82 yrs | YES (`funding_BTCUSDT.parquet`) |
| **DESIGN** | ETHUSDT | 4H native | 14,947 | 2020-01-01 00:00 | 2026-10-27 00:00 | 6.82 yrs | YES (`funding_ETHUSDT.parquet`) |
| **SEEN** | SOLUSDT | 4H native | 13,374 | 2020-09-14 04:00 | 2026-10-27 00:00 | 6.12 yrs | YES (`funding_SOLUSDT.parquet`) |
| **SEEN** | DOTUSDT | 4H native | 13,612 | 2020-08-22 04:00 | 2026-11-07 16:00 | 6.21 yrs | YES (`funding_DOTUSDT.parquet`) |
| **SEEN** | XAUUSDT | 4H native | 14,990 | 2020-01-01 00:00 | 2026-11-06 20:00 | 6.85 yrs | N/A (Macro commodity, 0 funding) |
| **SEEN** | XAGUSDT | 4H native | 14,990 | 2020-01-01 00:00 | 2026-11-06 20:00 | 6.85 yrs | N/A (Macro commodity, 0 funding) |
| **SEEN** | CLUSDT | 4H native | 14,990 | 2020-01-01 00:00 | 2026-11-06 20:00 | 6.85 yrs | N/A (Macro commodity, 0 funding) |
| **UNTOUCHED** | BNBUSDT | 4H native | 14,705 | 2020-02-10 08:00 | 2026-10-27 00:00 | 6.71 yrs | YES (`funding_BNBUSDT.parquet`) |
| **UNTOUCHED** | XRPUSDT | 4H native | 14,885 | 2020-01-06 08:00 | 2026-10-27 00:00 | 6.81 yrs | YES (`funding_XRPUSDT.parquet`) |
| **UNTOUCHED** | ADAUSDT | 1H $\to$ 4H | 10,629 | 2022-01-01 00:00 | 2026-11-07 12:00 | 4.85 yrs | YES (`funding_ADAUSDT.parquet`) |
| **UNTOUCHED** | AVAXUSDT | 1H $\to$ 4H | 10,629 | 2022-01-01 00:00 | 2026-11-07 12:00 | 4.85 yrs | YES (`funding_AVAXUSDT.parquet`) |
| **UNTOUCHED** | LINKUSDT | 1H $\to$ 4H | 10,629 | 2022-01-01 00:00 | 2026-11-07 12:00 | 4.85 yrs | YES (`funding_LINKUSDT.parquet`) |
| **UNTOUCHED** | DOGEUSDT | 1H $\to$ 4H | 10,629 | 2022-01-01 00:00 | 2026-11-07 12:00 | 4.85 yrs | YES (`funding_DOGEUSDT.parquet`) |
| **UNTOUCHED** | NEARUSDT | 1H $\to$ 4H | 10,629 | 2022-01-01 00:00 | 2026-11-07 12:00 | 4.85 yrs | YES (`funding_NEARUSDT.parquet`) |

### Data Availability & Exclusion Notes
1. **LTCUSDT & ATOMUSDT:** Excluded from evaluation. The local repository only possesses 1D daily candles (`round3/klines_LTCUSDT.parquet` and `round3/klines_ATOMUSDT.parquet` with 2,494 daily rows). Because no 4H or 1H candle series exists, they fail the strict $\ge 3$ years of 4H data requirement.
2. **RENDERUSDT:** Excluded. Only has 2.28 years of history (2024-07-26 to 2026-11-07), failing the $\ge 3$ years threshold.
3. **1H $\to$ 4H Resampling Protocol:** For ADA, AVAX, LINK, DOGE, and NEAR, 1H candles are resampled to 4H candles strictly using Binance standard 4-hour UTC boundaries (`00:00, 04:00, 08:00, 12:00, 16:00, 20:00`). A 4H candle is constructed only if all 4 constituent 1H candles exist (`open` = first open, `high` = max high, `low` = min low, `close` = last close, `volume` = sum volume). Incomplete candles are dropped.

---

## 3. Fixed Strategy Rules (`fixed_rule_4h_v1`)

The rules are frozen in `config/fixed_rule_4h_v1.json` and evaluated identically with **ZERO per-asset parameter modifications**:

- **Timeframe:** 4-hour closed candles ($t$). Entry fills at the open of bar $t+1$.
- **Long Entry:** `close[t] > SMA200[t]` AND `close[t] > max(high[t-20..t-1])`.
- **Short Entry:** `close[t] < SMA200[t]` AND `close[t] < min(low[t-20..t-1])`.
- **Filters:**
  - `EMA50_slope_10 > +0.0005` (long) / `< -0.0005` (short).
  - Stretch: $|close - EMA50| / ATR14 \le 3.0$.
  - Candle body: $|close - open| / ATR14 \ge 0.25$.
  - Candle close location: Top 40% of bar range (long) / Bottom 40% (short).
  - Volume filter: $volume \ge 0.85 \times SMA50(volume)$.
- **BTC Regime Gate:**
  - For crypto alts (ETH, SOL, DOT, BNB, XRP, ADA, AVAX, LINK, DOGE, NEAR): Long entry allowed only if BTC `close > SMA200` AND BTC `EMA50_slope_10 > 0.0`. Short allowed only for mirror.
  - Macro commodities (XAU, XAG, CL) do not share Bitcoin's monetary cycle and are evaluated independently of the BTC gate.
- **Stop Loss:**
  - 10-bar Donchian extreme: `lowest_low(10)` for Long, `highest_high(10)` for Short.
  - Clamped to $[2.3\%, 6.0\%]$.
  - `clamp_mode = "skip"`: If raw stop is $< 2.3\%$ or $> 6.0\%$, the trade is skipped.
- **Exit Logic:**
  - $3.0 \times ATR14$ Chandelier trailing stop anchored to highest close since entry (Long) / lowest close (Short).
  - Trailing stop updates only at candle close, taking effect on the next bar.
  - Max hold time: 42 bars (7 days).
- **Friction & Realism:**
  - Round-trip taker friction: $0.1144\%$ ($11.44\text{ bps}$).
  - Exact historical Binance 8-hour funding rates integrated for all crypto positions.

---

## 4. Portfolio & Risk Architecture

- **Account Starting Capital:** ₹7,000 INR.
- **Risk Per Trade:** 1.0% of capital ($\approx ₹70$ INR per trade).
- **Total Open Risk Cap:** 3.0% maximum concurrent open risk across the entire portfolio (strictly $\le 3$ active open positions at any point in time).
- **Correlation Clustering:**
  - At every candidate entry timestamp $T$, a causal rolling 90-day window (540 bars of 4H closed data) is extracted.
  - Pairwise Pearson return correlation is computed across all candidate assets.
  - Assets with rolling correlation $r > 0.70$ belong to the same cluster (single-linkage graph components).
  - **Cluster Cap:** Maximum 2 concurrent open positions per correlation cluster. If a cluster already has 2 open positions, any new candidate from that cluster is skipped.
- **Deterministic Simultaneous Signal Tie-Breaker:**
  - If multiple candidate signals occur on the exact same bar $t$, they are prioritized causally by relative volume burst: $\frac{volume[t]}{SMA50(volume)[t]}$ descending, with alphabetical symbol ordering as tie-breaker.

---

## 5. Metrics & Minimum Detectable Effect (MDE)

### Primary Comparison Window: 2022-01-01 to 2026-10-31 (58 calendar months)
Because the untouched assets (ADA, AVAX, LINK, DOGE, NEAR) start on 2022-01-01, the primary statistical comparison across universes is conducted on the uniform **2022–2026** window. Full history is also presented for reference.

### Baseline MDE Pre-Calculation
Calculated from the frozen baseline monthly net-R series before executing wider universe runs:

- **Full Period (2020–2026, 82 months):**
  - Baseline Mean Monthly Total R: $+0.3137\text{ R}$
  - Baseline Monthly SD: $2.2224\text{ R}$
  - $\text{MDE} (\alpha=0.05, 80\% \text{ power}) = (1.960 + 0.842) \times \frac{2.2224}{\sqrt{82}} = \mathbf{0.6876\text{ R/month}}$
- **Evaluation Window (2022–2026, 58 months):**
  - Baseline Mean Monthly Total R: $+0.1733\text{ R}$
  - Baseline Monthly SD: $2.2351\text{ R}$
  - $\text{MDE} (\alpha=0.05, 80\% \text{ power}) = (1.960 + 0.842) \times \frac{2.2351}{\sqrt{58}} = \mathbf{0.8222\text{ R/month}}$

### Required Metrics
1. Number of Trades ($n$).
2. Total Net R per month ($\bar{R}_{\text{month}}$).
3. Profit Factor ($\text{PF} = \frac{\sum \text{Gains}}{\sum |\text{Losses}|}$).
4. Max Equity Drawdown (INR and %).
5. Trades per Year.
6. After-Tax Net PnL (INR): Account for Indian Section 115BBH flat 30% tax on gross winning trades without offsetting losses.

---

## 6. Pre-Registered Pass / Fail Criteria

1. **UNTOUCHED Universe Evaluation:**
   - **PASS**: UNTOUCHED universe achieves $\text{PF} \ge 1.20$ AND the 95% bootstrap confidence interval of mean monthly net-R strictly excludes zero ($CI_{\text{lower}} > 0$).
   - **FAIL**: If UNTOUCHED $\text{PF} < 1.20$ OR the 95% bootstrap CI spans zero, UNTOUCHED is declared an explicit **FAIL**.
2. **SEEN Universe Evaluation:**
   - Monitored to confirm consistency with earlier experiments.
3. **ALL Universe Evaluation:**
   - Measures multi-asset portfolio performance under the 3% risk cap and 2-asset cluster cap.

No parameters will be tuned after running these backtests.
