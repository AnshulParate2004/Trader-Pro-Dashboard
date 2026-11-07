# Pre-Registration: 4-Hour (4H) Swing Meta-Labeling Engine

> **Document Path:** `docs/prereg/swing_meta_labeling_4h.md`  
> **Registration Date:** 2026-11-07  
> **Status:** PRE-REGISTERED (Sealed prior to model training & backtest evaluation)  
> **Authors:** Quantitative Engineering Team  
> **Repository:** Trader-Pro-Dashboard (`feat/daily-4h-swing-engine`)

---

## 1. Executive Summary & Purpose

Following the formal decommissioning of high-frequency intraday engines (5m/15m) due to fatal fee-drag ($\text{cost\_R} > 0.45\text{R}$), this pre-registration specifies the experimental design, econometric hypotheses, validation partitions, and falsification criteria for the **4-Hour (4H) Swing Meta-Labeling Engine**.

In accordance with institutional governance ([`docs/GOVERNANCE.md`](../GOVERNANCE.md)), all rules, barrier definitions, feature specifications, split horizons, and success thresholds are committed to version control prior to executing model training or backtest evaluation.

---

## 2. Experimental Universe & Timeframe

- **Asset Universe:** `BTCUSDT`, `ETHUSDT`, `SOLUSDT` (Perpetual Futures).
- **Execution Cadence:** 4-Hour (4H) completed candle closes ($00:00, 04:00, 08:00, 12:00, 16:00, 20:00\text{ UTC}$).
- **Benchmark Asset:** `BTCUSDT` (used for relative strength normalization).
- **Data Source:** Local parquet store (`DATA_ROOT`) with Binance Vision / Futures public API validation.

---

## 3. Base Candidate Strategy (Primary Model)

The primary candidate generator produces rule-based directional breakout signals designed to capture momentum regimes while filtering chop.

### Entry Conditions (evaluated at close of bar $t$):
1. **Macro Regime Filter:**
   $$\text{Close}_t > \text{SMA}_{200}(\text{Close})_t$$
2. **Breakout Trigger (Strictly Lagged to prevent lookahead):**
   $$\text{Close}_t > \max_{i=1}^{20} \text{High}_{t-i}$$
   *(The trigger requires the current closing price to break above the 20-period highest high of preceding completed bars $t-1$ through $t-20$).*
3. **Initial Structural Stop Loss:**
   $$\text{Stop Price} = \min_{i=1}^{10} \text{Low}_{t-i}$$
   $$\text{Stop Distance Pct} = \frac{\text{Close}_t - \text{Stop Price}}{\text{Close}_t}$$
   *Bounded strictly within swing risk limits:*
   $$\delta_{\text{stop}} = \text{clamp}(\text{Stop Distance Pct}, 0.015, 0.060)$$
   *(Minimum stop: $1.5\%$; Maximum stop: $6.0\%$).*

---

## 4. Triple-Barrier Labeling & Friction

Labels are generated strictly according to the triple-barrier method (Marcos López de Prado):

1. **Upper Barrier (Target):**
   $$P_{\text{target}} = \text{Close}_t \times (1.0 + 2.5 \times \delta_{\text{stop}}) \quad (+2.5\text{R})$$
2. **Lower Barrier (Stop Loss):**
   $$P_{\text{stop}} = \text{Close}_t \times (1.0 - 1.0 \times \delta_{\text{stop}}) \quad (-1.0\text{R})$$
3. **Vertical Time Barrier:**
   $$\text{Horizon} = 12 \text{ bars} \quad (48\text{ hours})$$
4. **Collision Precedence Invariant:**
   - If a single bar touches both $P_{\text{stop}}$ and $P_{\text{target}}$, the trade is booked strictly as **Stop Loss Hit ($-1.0\text{R}$)** because intra-bar execution order is unknown.
5. **Round-Trip Transaction Friction:**
   - Standard exchange friction: $0.10\%$ ($10\text{ bps}$) round-trip deducted from every trade.
   - Cost in units of risk:
     $$\text{cost\_R} = \frac{0.0010}{\delta_{\text{stop}}}$$
6. **Binary Classification Target ($y \in \{0, 1\}$):**
   - $y = 1$: Trade reaches upper barrier with realized net return $\ge +2.0\text{R}$.
   - $y = 0$: Trade hits stop loss, times out with net return $< +2.0\text{R}$, or is closed at breakeven.
   - *Breakeven exits must strictly be labeled $y = 0$.*

---

## 5. Secondary AI Meta-Classifier Specification

The machine learning model acts strictly as a trade quality meta-filter, predicting $P(y=1 \mid \mathbf{x}_t)$.

- **Model Family:** LightGBM Classifier (Shallow / Regularized).
- **Hyperparameters:**
  - `max_depth`: 3
  - `num_leaves`: 7
  - `learning_rate`: 0.03
  - `n_estimators`: 150
  - `min_child_samples`: 30
  - `subsample`: 0.80
  - `colsample_bytree`: 0.80
- **Feature Set ($\mathbf{x}_t$, strictly lagged to bar $t-1$):**
  1. `rs_vs_btc_3d`: 3-day Relative Strength return ratio vs BTC.
  2. `rs_vs_btc_7d`: 7-day Relative Strength return ratio vs BTC.
  3. `rs_vs_btc_30d`: 30-day Relative Strength return ratio vs BTC.
  4. `funding_rate_zscore`: 60-period rolling Z-score of perpetual funding rates.
  5. `oi_delta_1d`: 24-hour Open Interest delta.
  6. `oi_delta_3d`: 72-hour Open Interest delta.
  7. `vol_ratio_30d`: EWMA(0.94) volatility relative to 30-day baseline.
  8. `volume_zscore_20`: 20-period volume Z-score.
  9. `dist_ema_50`: Normalized distance of close to 50-period EMA.
  10. `dist_sma_200`: Normalized distance of close to 200-period SMA.
  11. `donchian_pos_20`: Normalized position within 20-period Donchian range.
  12. `atr_pct`: 14-period ATR normalized by price.
- **Execution Decision Rule:**
  - Execute candidate trade if and only if:
    $$\hat{P}(y = 1) \ge 0.65$$

---

## 6. Purged Walk-Forward Cross-Validation Design

To guarantee zero lookahead leakage and prevent hold-out contamination:

1. **Expanding-Window Splits:**
   - **Split 1:** Train `2021-01-01` to `2023-12-31` | Test `2024-01-01` to `2024-12-31`
   - **Split 2:** Train `2021-01-01` to `2024-12-31` | Test `2025-01-01` to `2025-12-31`
   - **Split 3:** Train `2021-01-01` to `2025-12-31` | Test `2026-01-01` to `2026-10-31`
2. **Purging & Embargo:**
   - For every training fold, the final 12 bars ($48\text{ hours}$) are purged to prevent training labels from overlapping test set barrier outcomes.
3. **Data Boundary:**
   - Data past `2026-10-31` is strictly held out.

---

## 7. Falsifiable Primary Hypotheses & Success Criteria

### Primary Hypothesis $H_1$ (Expectancy Expansion):
Filtering raw candidate signals with the LightGBM meta-classifier at probability threshold $\tau = 0.65$ will increase the pooled out-of-sample Net Expectancy per trade by at least **$+0.20\text{R}$**:
$$\Delta \bar{R}_{\text{net}} = \bar{R}_{\text{net}}(\text{AI-Filtered}) - \bar{R}_{\text{net}}(\text{Rule-Only}) \ge +0.20\text{R}$$

### Secondary Hypotheses & Invariants:
1. **Predictive Discrimination:** Out-of-Sample ROC-AUC across all pooled test periods must exceed $\text{AUC} \ge 0.530$.
2. **Profit Factor Improvement:** AI-Filtered Profit Factor must exceed Rule-Only Profit Factor.
3. **Sample Adequacy:** Total evaluated out-of-sample candidate trades across all 3 assets must satisfy $N \ge 100$.
4. **Drawdown Protection:** Maximum drawdown in units of R must not degrade under AI filtering.

If any criterion fails, the meta-labeling hypothesis is formally rejected and logged as unviable without parameter tweaking.
