# Exhaustive Audit: Known Issues & Methodological Bugs in Legacy Training Notebooks

> **Canonical Document**: `docs/KNOWN_ISSUES.md`  
> **Target Scope**: Notebooks `00_data_download.ipynb` through `05_model_evaluation.ipynb`, early simulation scripts, and legacy intraday models (5m/15m).  
> **Purpose**: Formalize why historical backtests generated illusory outperformance and catalog the critical bugs discovered during institutional code audits.

---

## Executive Summary

Between 2024 and late 2026, early versions of the Trader-Pro training pipelines showed nominal backtest Sharpe ratios of `2.8 - 4.1` and apparent directional predictive AUCs up to `0.89`. A comprehensive line-by-line audit revealed that these metrics were entirely spurious, driven by five catastrophic methodological errors in data preprocessing, target labeling, threshold selection, order book simulation, and statutory tax modeling.

This document serves as a post-mortem to ensure that none of these flaws ever re-enter the codebase.

---

## 1. Bug A: Higher-Timeframe Lookahead Leak (Merge on `open_time`)

### Description
In notebooks `02_features.ipynb` and feature pipelines, multi-timeframe indicators (1H, 4H, 1D, 1W) were merged into 15m and 5m base dataframes using the candle `open_time` timestamp:

```python
# FLAWED CODE PATTERN:
df_15m = df_15m.merge(df_daily[["open_time", "daily_rsi", "daily_close"]], on="open_time", how="left").ffill()
```

### Mechanism of Leakage
A daily candle with `open_time = 2026-03-01 00:00:00 UTC` completes and establishes its `close` and `daily_rsi` only at `2026-03-01 23:59:59 UTC`. By merging on `open_time`, the 15m bar at `2026-03-01 00:15:00 UTC` received features calculated from the daily candle that had not yet finished forming. The model was effectively granted a 23-hour, 45-minute lookahead window into the future daily closing price.

### Remedy & Invariant
- **Rule**: All higher-timeframe features must be strictly lagged by at least one complete bar before being merged into higher-cadence data.
- **Implementation**: Merge on `close_time` or shift HTF metrics by 1 period (`.shift(1)`) so that only completed, closed bars are visible at execution time $t$:
  $$\text{Feature}_t^{\text{HTF}} = \text{Indicator}(\text{Bar}_{T-1}^{\text{HTF}}), \quad \text{where } T-1 \text{ closed before } t$$

---

## 2. Bug B: Target Labeling Distortion (Breakevens & Timeouts Labeled $y=1$)

### Description
The original Triple-Barrier labeling script in `03_labeling.ipynb` assigned binary classification targets ($y \in \{0, 1\}$) using gross price returns without deducting exchange fees, slippage, or breakeven fee offsets:

```python
# FLAWED CODE PATTERN:
if touch_tp:
    y = 1
elif touch_be:
    y = 1  # Breakeven classified as a positive win!
elif time_expired and ret > 0:
    y = 1  # Any gross return > 0, even 0.01%, labeled as successful trade!
else:
    y = 0
```

### Mechanism of Distortion
1. **Breakeven as Win**: A trade hitting a $+0.30\text{R}$ breakeven trigger and subsequently stopped out at entry price pays full exchange taker fees on entry and exit ($0.1144\%$). In net terms, this trade lost $-0.08\text{R}$ to $-0.25\text{R}$ in cash. Marking it as $y=1$ trained the classifier to seek high-turnover churn that enriched the broker while depleting the fund.
2. **Micro-Gains Labeled as Success**: Time-barrier expirations with gross profit below transaction fees ($0 < \text{Gross} < 0.1144\%$) were labeled $y=1$.

### Remedy & Invariant
- **Rule**: Binary target labeling must strictly be evaluated on **net realized return after full friction deduction**.
- **Implementation**:
  $$y = \begin{cases} 1 & \text{if } R_{\text{net}} \ge +2.0\text{R} \\ 0 & \text{if } R_{\text{net}} < +2.0\text{R} \text{ (including all Breakevens, partial gains, and timeouts)} \end{cases}$$

---

## 3. Bug C: Global Lookahead in Threshold Quantiles (`np.quantile` on Full Dataset)

### Description
In notebook `04_training.ipynb`, model prediction probability thresholds for trade execution were chosen by taking quantiles across the entire historical series:

```python
# FLAWED CODE PATTERN:
# Computed across the entire 2020-2026 concatenated dataframe:
threshold = np.quantile(all_predictions, 0.90)
trades = all_predictions >= threshold
```

### Mechanism of Leakage
1. **Unconscious Information Transfer**: High-volatility regimes (e.g., bull runs of 2021 or late 2024) produce structurally higher model probabilities than low-volatility bear markets (2022). Calculating a global quantile allows future distribution properties to set past entry thresholds.
2. **False Selectivity**: The model selected trades in 2021 using a threshold determined in part by market behavior in 2025.

### Remedy & Invariant
- **Rule**: All probability thresholds, feature scaling parameters, and normalization statistics must be determined strictly **inside the training fold** (or using an expanding rolling window).
- **Implementation**: In walk-forward cross-validation, $\tau_k = \text{Quantile}(P_{\text{train}_k}, q)$, applied out-of-sample to fold $k+1$ without recalculation.

---

## 4. Bug D: Optimistic Order Book Execution & Same-Bar Collision Bias

### Description
The simulation engine in `05_model_evaluation.ipynb` made three invalid execution assumptions:
1. **Favorable Intra-Bar Sequence**: When a single 15m candle's high touched TP and its low touched SL, the simulator assumed TP was hit first ($+1.0\text{R}$).
2. **Instantaneous Limit Fills**: Limit orders placed at the close were assumed filled at the limit price even if price only touched the level for a fraction of a second.
3. **Zero Fill Slippage**: Stop-loss market orders were booked exactly at the trigger stop price with zero slippage during high-volatility liquidity shocks.

### Mechanism of Distortion
Testing the simulator against synthetic Geometric Brownian Motion (pure random walk noise with zero alpha) generated a phantom net return of **$+0.11\text{R}$ to $+0.13\text{R}$ per trade**. The backtest was "profitable" because it was exploiting mathematical loopholes in the evaluation code, not an edge in the market.

### Remedy & Invariant
- **Simultaneous Touch Precedence**: If a candle touches both SL and TP (or SL and BE trigger), it must strictly be recorded as **Stop Loss Hit ($-1.0\text{R}$)** because intra-bar tick sequence is unknown.
- **Conservative Fills**: Stop orders are penalized with measured slippage (minimum 1.0 to 2.5 bps per leg for liquid cryptos; up to 10 bps during flash moves).

---

## 5. Bug E: Inconsistent Fee Modeling & Omission of Indian GST/TDS

### Description
Backtests assumed an idealized flat fee of $0.05\%$ or $0.10\%$ without modeling statutory statutory tax levies, while live Indian exchange accounts incurred:
1. Base Taker Fee: $0.040\%$ per side.
2. **Statutory GST (18%)**: Levied on exchange fees ($0.040\% \times 1.18 = 0.0472\%$ per side).
3. **Statutory TDS (1%)**: Under Indian Income Tax Section 194S, a mandatory $1.0\%$ Tax Deducted at Source applies to the gross transfer value of all Virtual Digital Asset (VDA) sales.
4. Bid-Ask Spread / Slippage: $0.010\%$ per side.

### Impact on High-Frequency Intraday Trading
For a 15m scalp trading 10 times per day with a $0.35\%$ stop-loss:
- Round-trip exchange fee + GST + slippage: **`0.1144%` of notional**.
- Friction per trade in units of risk:
  $$\text{cost}_R = \frac{0.1144\%}{0.35\%} = 0.3269\text{R}$$
Over 100 trades, the trader loses **$32.7\text{R}$ in fees alone**. Adding a $1\%$ TDS on every sell leg mathematically guarantees capital insolvency within weeks for any intraday strategy.

### Remedy & Invariant
- Intraday strategies with $\text{cost}_R > 0.08\text{R}$ are permanently prohibited.
- Capital is reallocated exclusively to 4H and Daily swing timeframes where stops are $2.5\% - 6.0\%$, reducing friction to $\text{cost}_R < 0.04\text{R}$ and trade turnover to sustainable levels.
