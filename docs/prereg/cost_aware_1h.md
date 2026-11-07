# Pre-Registration: Cost-Aware 1H Strategy Variant ("Slow, Small")

**Pre-registration Date:** 2026-11-07  
**Status:** SEALED PRIOR TO EXECUTION  
**Branch:** `feat/cost-aware-1h`  
**Target Implementation:** `src/lib/paperExecutor1HCost.ts`  
**MongoDB Collections:** `paper_1h_cost` (live forward), `backtest_1h_cost` (simulation logs)  
**Frozen Baseline:** `1H-A` (`src/lib/paperExecutor1HA.ts`, collection `paper_1h_a`) remains 100% FROZEN and untouched.

---

## 1. Motivation & Architectural Overview

The Phase B and Phase C econometric audits revealed that even strategies with positive gross edge ($\text{Gross R} > 0$) collapse into negative expectancy when the stop distance is narrow relative to exchange fees and slippage. 
On the 1H timeframe, the median ATR stop distance is $\sim 0.74\% - 0.87\%$. At standard taker friction ($0.1144\%$ to $0.14\%$), friction consumes $13\% - 19\%$ of 1R. In high friction environments ($0.50\%$), it consumes $>50\%$ of 1R.

This variant introduces a **"slow, small" cost-aware filter**:
1. **Cost-Aware Gate (`cost_R <= 0.08`):** Restricts execution to trade setups where the stop distance is wide enough that total round-trip friction does not exceed $8\%$ of the initial 1R risk budget.
2. **Dual Entry Modes:**
   - **Mode A (Default):** Taker market entry at next-bar open.
   - **Mode B (Feature Flagged, default OFF):** Maker post-only limit entry placed exactly at the signal bar close price.
3. **Strict Fill Physics:** No same-candle TP optimistic fills (SL evaluated first), no artificial $+0.05\text{R}$ phantom breakeven profit, next-bar open fills for Mode A, limit order fill checking for Mode B.

---

## 2. Pre-Registered Specifications & Constants (FROZEN)

### 2.1 The cost_R Gate
```typescript
/**
 * Maximum allowable cost-to-risk ratio.
 * When cost_R = round_trip_cost_pct / stop_pct > 0.08, exchange fees and friction 
 * consume more than 8% of the trade's initial 1R risk budget. 
 * Trades exceeding this threshold are filtered out to prevent negative fee drag.
 */
export const MAX_COST_R_THRESHOLD = 0.08;
```
* **Gate Logic:** If $\text{cost\_R} > 0.08$, the signal is skipped.
* **Logging Requirement:** Skipped trades must be logged to the database and console with:
  `status: "SKIPPED_COST_R"`, `reason: "skipped: cost_R"`, recording the exact `cost_R`, `stop_pct`, and `round_trip_cost_pct`.

### 2.2 Entry Modes & Feature Flags
* **Mode A (Taker Market):** Market order executed at `next_bar_open` ($t+1$). Taker fee schedule applies.
* **Mode B (Maker Limit, Feature Flagged):**
  ```typescript
  export const ENABLE_MAKER_LIMIT_ENTRY = false; // Default OFF
  export const MAKER_LIMIT_EXPIRY_BARS = 2;       // Cancel after N=2 bars (2 hours)
  ```
  * Limit order placed at `signal_close` ($P_t$).
  * Execution Rule: On subsequent bars $t+1 \dots t+N$, order fills if market trades through limit price:
    - Long: `low <= P_t`
    - Short: `high >= P_t`
  * If price does not touch $P_t$ within $N=2$ bars, the order is cancelled and recorded as:
    `status: "MISSED_MAKER_UNFILLED"`, `reason: "missed: maker_unfilled"`.
  * **Critical:** Missed maker trades are tracked in total signal denominator (never silently discarded).

### 2.3 Fee Schedules & Cost Tiers
1. **Tier 1 (14 bps / Standard Taker):**
   - Base fee: $0.040\%$ per side
   - GST: $18\%$ on exchange fees ($0.040\% \times 1.18 = 0.0472\%$ per side)
   - Slippage: $0.010\%$ per side ($0.020\%$ round-trip)
   - Total round-trip: $0.0944\% + 0.0200\% = \mathbf{0.1144\%} \approx 14\text{ bps}$.
2. **Tier 2 (50 bps / Stress Taker):**
   - Total round-trip friction fixed at $\mathbf{0.5000\%}$ ($50\text{ bps}$).
3. **Measured Paper Slippage:**
   - On forward paper execution, record `intended_price` vs `executed_price` per trade and store `realized_slippage_bps`.

---

## 3. Statistical Testing Protocol & Success Rules

### 3.1 Dataset Partitioning
* **Exploratory Sample (Jan 2020 – Oct 31, 2026):**
  - All historical data prior to 2026-10-31 is strictly exploratory because feature engineering and LightGBM models utilized training data through 2026-10-26.
* **Clean Out-of-Sample (OOS) Test Window (Nov 1, 2026 onward):**
  - Sealed test data. Only trades closed after 2026-10-31 count toward final strategy validation.

### 3.2 Evaluation Metrics
For every combination:
1. Total Trade Count ($N$) & Clean OOS Count ($n$)
2. Skipped Share ($\%$) by `cost_R` gate
3. Fill Rate ($\%$) for Mode B
4. Net R per trade with stationary block-bootstrap $95\%$ CI ($L=20$ bars, $B=1,000$ resamples)
5. Distribution of `cost_R` (mean, median, p10, p90)
6. Maximum Drawdown (in R and $\%$ terms)
7. Residual Alpha vs Buy-and-Hold BTC with $95\%$ CI

### 3.3 Noise-Null Benchmark (Synthetic Control)
* Generate 50 independent zero-drift random walks (synthetic Geometric Brownian Motion with $\mu=0$ matching BTC 1H volatility).
* Run the exact identical pipeline (signals, cost gate, fill simulator, and costs) across all 50 synthetic series.
* Record the distribution of noise-null Net R.

### 3.4 Multiple Testing Correction
* Testing 2 Entry Modes (Mode A, Mode B) $\times$ 2 Cost Tiers (14 bps, 50 bps) = 4 primary hypothesis tests.
* Pre-registered Bonferroni significance threshold:
  $$\alpha = \frac{0.05}{4} = \mathbf{0.0125}$$
  Nominal $98.75\%$ CI (or $95\%$ CI strictly excluding zero with $p < 0.0125$).

### 3.5 Formal Success / Failure Gate (Pre-Registered Rule)
To declare statistical edge, the strategy must satisfy **ALL** of the following:
1. **Clean OOS Sample Size:** $n \ge 100$ trades occurring strictly **after 2026-10-31**.
2. **Positive Net Expectancy at 50 bps:** Block-bootstrap $95\%$ CI lower bound of Net R must be **strictly $> 0$** under $50\text{ bps}$ stress friction.
3. **Superiority over Noise:** Real strategy Net R must exceed the **95th percentile of the 50-series noise-null distribution**.

**Default Verdict:** If any of the above conditions is not met, the official outcome is **"NO EDGE"**. Every negative number will be reported as-is without promotional language.


---

## 4. Errata (Post-Implementation Protocol Notes)

1. **Evaluation Script Signal Source (Donchian Breakout vs. 1H-A Model):**
   The empirical simulation script (`analysis/evaluate_cost_aware_1h.py`) generates signals using raw 20-period Donchian channel breakouts (`close > rolling_high_20` / `close < rolling_low_20`), rather than loading the binary 1H-A LightGBM model artifact (`src/models/1h/final_model_BTCUSDT_1h.joblib`) or applying the frozen expanding-window conviction threshold (`FROZEN_CONVICTION_THRESHOLD = 0.582`).

2. **Infeasibility of 50 bps Friction Tier by Construction:**
   Under the pre-registered cost gate rule ($\text{cost\_R} = \frac{\text{round\_trip\_cost\_pct}}{\text{stop\_pct}} \le 0.08$), a 50 bps ($0.5000\%$) friction tier requires an initial stop distance of at least $\frac{0.0050}{0.08} = 6.25\%$. Because the execution engine caps stop distances at $5.0\%$ of entry price (`min(1.0 * ATR14, 0.05 * Price)`), any trade evaluated at 50 bps will have $\text{cost\_R} \ge \frac{0.0050}{0.0500} = 0.10 > 0.08$. Consequently, $100\%$ of trades are skipped at 50 bps ($n = 0$), making this tier infeasible by construction.

3. **Mode B vs. Mode A Friction Schedule Divergence:**
   Mode B fee friction ($0.0525\%$) differs from Mode A friction ($0.1144\%$ and $0.5000\%$). Mode B assumes a maker fee schedule ($0.018\%$ base fee $+ 18\%$ GST $+ 0.005\%$ maker slippage per side $= 0.05248\% \approx 0.0525\%$ round-trip), whereas Mode A assumes taker market execution ($0.040\%$ base fee $+ 18\%$ GST $+ 0.010\%$ taker slippage per side $= 0.1144\%$ round-trip).

4. **Optimism in Mode B Fill Assumptions:**
   The Mode B simulation assumption is optimistic in two ways:
   - Fills are assumed to execute immediately whenever the price touches the limit price (`low <= limit_price` for longs, `high >= limit_price` for shorts) without simulating limit queue priority or partial fills.
   - It assumes maker fees ($0.018\%$) apply to both entry and exit, whereas stop-loss exits in live market conditions trigger as market/taker orders subject to standard taker fees and slippage.

5. **Executors Do Not Load ML Model Artifacts & Script Signal Superset:**
   Neither `paperExecutor1HA.ts` nor `paperExecutor1HCost.ts` loads the binary LightGBM/CatBoost model (`src/models/1h/final_model_BTCUSDT_1h.joblib`) or ONNX runtime. Signals in both executors are computed using a hand-coded heuristic score: `probLong = 0.50 + (momentum > 1.0 ? 0.08 : -0.08) + (breakout ? 0.07 : 0)`. The simulation script (`analysis/evaluate_cost_aware_1h.py`) tests raw Donchian breakouts regardless of momentum, making the script's signal universe a superset of the executor's signal universe: across the 59,788 historical 1H bars, there are 4,630 raw Donchian breakout signals evaluated, of which 4,470 (96.54%) pass the executor's 0.582 conviction threshold (which requires both the Donchian breakout and momentum $> 1.0$).


---

## 5. Amendment 1 (2026-11-07)

1. **Simultaneous Stop and BE Trigger Collision Rule:**
   If a single bar touches both the original initial stop loss (`stop_loss`) and the breakeven ratchet trigger (`be_trigger`), the trade must be booked strictly as a full stop-loss exit ($-1.0\text{R}$ gross, before friction) rather than activating the breakeven ratchet. Because intra-bar tick sequence is unknown on aggregated OHLC bars, conservative accounting dictates that the adverse boundary (initial stop) takes precedence over the favorable ratchet trigger.

2. **Mode A Entry Price & Execution Timing Logging:**
   For Mode A (taker market entry), the fill price is the live price at executor run time (`liveCandle.close` / current market ticker), rather than the candle open (`liveCandle.open`). The executor must log `entry_run_time` (UTC ISO string) and `cron_lag_ms` (difference between `entry_run_time` and the scheduled bar boundary) to accurately measure forward paper execution latency.

3. **Sub-Hour Exit Testing Window (5m Candle Resolution):**
   Active trades must be tested for exits strictly against price data occurring after `entry_run_time`. In live paper trading, the executor evaluates sub-hour 5-minute candles (`5m` klines) whose timestamps satisfy `candle.openTime >= trade.entry_time` (or intraday tick extremes after entry), preventing past intraday price extremes from falsely triggering exits on trades entered mid-hour.
