# Formal Leakage Audit Report: Investigation of AUC 0.8923 & Baseline 0.3676

> **Audit Verdict**: **LEAKAGE CONFIRMED (SEVERELY INVALID)**.  
> The reported LightGBM AUC of `0.8923` and Rule Baseline AUC of `0.3676` in `notebooks/model_quality_report.md` were entirely artifacts of a **backward lookback target leakage** in `notebooks/run_model_quality.py`.  
> Under a strict, purged walk-forward cross-validation with an honest forward execution horizon, the true out-of-sample AUC of LightGBM drops from **`0.8923`** to **`0.5126`** (identical to the original model cards' range of `0.514 - 0.524`).

---

## 1. How the Flawed AUC Was Computed

- **Dataset**: 4H BTCUSDT dataset (`BTCUSDT_4h.parquet`, 14,841 candles from Jan 2020 to Oct 2026).
- **Split**: Single static split at `2024-05-01 00:00:00 UTC` without embargo (Train: ~10,700 candles; Test: ~4,100 candles).
- **Target Calculation Bug**: In `notebooks/run_model_quality.py` (lines 110–118), target `y_long` was defined as:
  ```python
  horizon = 6
  future_max = h.shift(-1).rolling(horizon).max()
  future_min = l.shift(-1).rolling(horizon).min()
  df['y_long'] = ((future_max >= c + atr14) & (future_min > c - atr14)).astype(float)
  ```
- **Root Cause of the Bug**:
  1. In pandas, `.rolling(k)` is by default **backward-looking**. When applied to `s.shift(-1)`, at candle $t$:
     - `s.shift(-1)` contains bar $t+1$.
     - `.rolling(6)` aggregates over indices `[t-4, t-3, t-2, t-1, t, t+1]`.
     - **5 out of the 6 candles are in the PAST relative to decision bar $t$**.
  2. The stop condition `future_min > c[t] - atr14[t]` required that:  
     $$\min(low[t-4], low[t-3], low[t-2], low[t-1], low[t], low[t+1]) > close[t] - atr14[t]$$
  3. If price had been rising over the last 3 bars ($ret_3 > 0$), $close[t]$ was significantly higher than past lows ($low[t-3]$).      As a result, past lows were below the stop line ($low[t-3] < close[t] - atr14[t]$), artificially forcing `future_min > c - atr` to be **FALSE ($y=0$)**.
  4. Conversely, if price had been falling ($ret_3 < 0$), $close[t]$ was lower, so past lows were above $close[t] - atr14[t]$, allowing $y$ to be **1**.
  5. Thus, `ret_3` had an artificial **$-0.4157$ linear correlation** with the target label!
     LightGBM and Logistic Regression did not predict the future; they merely detected past price drops, yielding artificial AUCs of `0.8923` and `0.8584`.

---

## 2. Why the Rule Baseline Showed 0.3676 (Inverted Sign)

- The Rule Baseline was defined as a standard momentum / trend-following rule:  
  $$\text{rule\_score} = 0.5 \times \mathbb{I}(close > EMA50) + 0.5 \times \mathbb{I}(RSI > 50)$$  
- When momentum is positive (uptrend, $ret_3 > 0$), `rule_score` is high ($1.0$).
- But because the leaky target label assigned $y=0$ whenever $ret_3 > 0$, the rule baseline systematically assigned high probability to $0$ and low probability to $1$.
- This produced an **inverted ROC curve**, yielding an AUC of:  
  $$\text{AUC} = 1 - 0.6324 = \mathbf{0.3676}$$  
- Under the honest forward target, the Rule Baseline AUC is **`0.5082`** (slightly above random walk, consistent with standard trend following).

---

## 3. Audit of All 53 Features & Candle Ranges

We audited all 53 features used across the 15M, 1H, and 4H models in `src/models/*/model_card.json`:

| # | Feature Name | Description / Formula | Candle Range | Future Data / Leakage? |
| :---: | :--- | :--- | :---: | :---: |
| 1 | `ret_1` | 1-bar log return: $\ln(c_t / c_{t-1})$ | $[t-1, t]$ | None (Strictly $\le t$) |
| 2 | `ret_3` | 3-bar log return: $\ln(c_t / c_{t-3})$ | $[t-3, t]$ | None (Strictly $\le t$) |
| 3 | `ret_6` | 6-bar log return: $\ln(c_t / c_{t-6})$ | $[t-6, t]$ | None (Strictly $\le t$) |
| 4 | `ret_12` | 12-bar log return: $\ln(c_t / c_{t-12})$ | $[t-12, t]$ | None (Strictly $\le t$) |
| 5 | `ret_24` | 24-bar log return: $\ln(c_t / c_{t-24})$ | $[t-24, t]$ | None (Strictly $\le t$) |
| 6 | `atr_pct` | 14-period Wilder ATR divided by close | $[t-14, t]$ | None (Strictly $\le t$) |
| 7 | `atr_ratio` | Current ATR divided by 50-bar rolling mean of ATR | $[t-64, t]$ | None (Strictly $\le t$) |
| 8 | `range_pct` | $(h_t - l_t) / c_t$ | $[t, t]$ | None (Strictly $\le t$) |
| 9 | `body_pct` | $|c_t - o_t| / c_t$ | $[t, t]$ | None (Strictly $\le t$) |
| 10 | `upper_wick` | $(h_t - \max(o_t, c_t)) / c_t$ | $[t, t]$ | None (Strictly $\le t$) |
| 11 | `lower_wick` | $(\min(o_t, c_t) - l_t) / c_t$ | $[t, t]$ | None (Strictly $\le t$) |
| 12 | `rsi14` | 14-period Relative Strength Index | $[t-14, t]$ | None (Strictly $\le t$) |
| 13 | `macd_hist` | $(EMA_{12}(c) - EMA_{26}(c)) / c$ | $[t-26, t]$ | None (Strictly $\le t$) |
| 14 | `bb_pctb` | Bollinger %B: $(c - (MA_{20}-2\sigma))/(4\sigma)$ | $[t-20, t]$ | None (Strictly $\le t$) |
| 15 | `bb_width` | Bollinger Bandwidth: $4\sigma / c$ | $[t-20, t]$ | None (Strictly $\le t$) |
| 16 | `ema_dist_20` | $(c_t - EMA_{20}(c)) / c_t$ | $[t-20, t]$ | None (Strictly $\le t$) |
| 17 | `ema_dist_50` | $(c_t - EMA_{50}(c)) / c_t$ | $[t-50, t]$ | None (Strictly $\le t$) |
| 18 | `ema_20_50` | $(EMA_{20}(c) - EMA_{50}(c)) / c_t$ | $[t-50, t]$ | None (Strictly $\le t$) |
| 19 | `ema20_slope` | 3-bar pct change of $EMA_{20}$ | $[t-23, t]$ | None (Strictly $\le t$) |
| 20 | `vol_z` | 30-bar volume z-score: $(v_t - \mu_v) / \sigma_v$ | $[t-30, t]$ | None (Strictly $\le t$) |
| 21 | `taker_ratio` | Taker buy base volume / total volume | $[t, t]$ | None (Strictly $\le t$) |
| 22 | `vol_ratio` | Volume / 30-bar mean volume | $[t-30, t]$ | None (Strictly $\le t$) |
| 23 | `hour_sin` | Sine transformation of UTC hour | $[t, t]$ | None (Deterministic time) |
| 24 | `hour_cos` | Cosine transformation of UTC hour | $[t, t]$ | None (Deterministic time) |
| 25 | `dow_sin` | Sine transformation of day of week | $[t, t]$ | None (Deterministic time) |
| 26 | `dow_cos` | Cosine transformation of day of week | $[t, t]$ | None (Deterministic time) |
| 27 | `dsup_own` | Normalized distance to nearest swing support | $[\le t]$ | None (Historical pivots $\le t$) |
| 28 | `dres_own` | Normalized distance to nearest swing resistance | $[\le t]$ | None (Historical pivots $\le t$) |
| 29 | `dsup_atr` | Distance to support in ATR units | $[\le t]$ | None (Strictly $\le t$) |
| 30 | `dres_atr` | Distance to resistance in ATR units | $[\le t]$ | None (Strictly $\le t$) |
| 31 | `sup_age` | Number of bars since support formed | $[\le t]$ | None (Strictly $\le t$) |
| 32 | `res_age` | Number of bars since resistance formed | $[\le t]$ | None (Strictly $\le t$) |
| 33 | `sup_touch` | Number of retests of support | $[\le t]$ | None (Strictly $\le t$) |
| 34 | `res_touch` | Number of retests of resistance | $[\le t]$ | None (Strictly $\le t$) |
| 35 | `n_sup` | Count of active support zones below close | $[\le t]$ | None (Strictly $\le t$) |
| 36 | `n_res` | Count of active resistance zones above close | $[\le t]$ | None (Strictly $\le t$) |
| 37 | `ev_sup` | Evaluated bounce probability on support | $[\le t]$ | None (Strictly $\le t$) |
| 38 | `ev_res` | Evaluated rejection probability on resistance | $[\le t]$ | None (Strictly $\le t$) |
| 39 | `dsup_1h` | Distance to 1H support level (merged as-of close $\le t$) | $[\le t]$ | None (HTF merge backwards) |
| 40 | `dres_1h` | Distance to 1H resistance level | $[\le t]$ | None (HTF merge backwards) |
| 41 | `trend_1h` | 1H trend regime indicator | $[\le t]$ | None (HTF merge backwards) |
| 42 | `dsup_4h` | Distance to 4H support level | $[\le t]$ | None (HTF merge backwards) |
| 43 | `dres_4h` | Distance to 4H resistance level | $[\le t]$ | None (HTF merge backwards) |
| 44 | `trend_4h` | 4H trend regime indicator | $[\le t]$ | None (HTF merge backwards) |
| 45 | `dsup_1d` | Distance to Daily support level | $[\le t]$ | None (HTF merge backwards) |
| 46 | `dres_1d` | Distance to Daily resistance level | $[\le t]$ | None (HTF merge backwards) |
| 47 | `trend_1d` | Daily trend regime indicator | $[\le t]$ | None (HTF merge backwards) |
| 48 | `dsup_1w` | Distance to Weekly support level | $[\le t]$ | None (HTF merge backwards) |
| 49 | `dres_1w` | Distance to Weekly resistance level | $[\le t]$ | None (HTF merge backwards) |
| 50 | `trend_1w` | Weekly trend regime indicator | $[\le t]$ | None (HTF merge backwards) |
| 51 | `conf_sup` | Multi-timeframe support confluence | $[\le t]$ | None (Strictly $\le t$) |
| 52 | `conf_res` | Multi-timeframe resistance confluence | $[\le t]$ | None (Strictly $\le t$) |
| 53 | `htf_score` | Higher timeframe composite alignment | $[\le t]$ | None (Strictly $\le t$) |

> **Feature Audit Summary**: All 53 features are valid point-in-time calculations strictly utilizing bars $\le t$. None of the features used future bars or label columns. The leakage was isolated **strictly to the target variable formula** inside `run_model_quality.py`.

---

## 4. Recomputed AUC with Purged Walk-Forward Cross Validation

We recomputed out-of-sample AUC across a strict **5-Fold Purged Walk-Forward split** with an **embargo gap of 6 bars** (matching the 6-bar trade horizon) between each training and test fold, along with two experimental controls:
1. **Shuffled-Label Control**: Permuting training labels randomly (expected AUC $\approx 0.500$).
2. **Lagged-Feature Control**: Lagging all features by 50 bars so they carry zero contemporaneous predictive value (expected AUC $\approx 0.500$).

### Walk-Forward Cross Validation Results

| Fold | Train Bars | Test Bars | Leaky Target AUC (Flawed) | Honest Forward AUC (Fixed) | Shuffled Target Control | Lagged Feature Control | Rule Baseline (Leaky) | Rule Baseline (Honest) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | 2,474 | 2,474 | `0.8686` | **`0.5217`** | `0.4949` | `0.4903` | `0.3772` | `0.4988` |
| 2 | 4,947 | 2,474 | `0.8518` | **`0.5127`** | `0.4952` | `0.4942` | `0.3994` | `0.5001` |
| 3 | 7,420 | 2,474 | `0.8594` | **`0.5242`** | `0.5053` | `0.4593` | `0.4111` | `0.4961` |
| 4 | 9,893 | 2,474 | `0.8974` | **`0.5231`** | `0.5056` | `0.5385` | `0.3381` | `0.5216` |
| 5 | 12,366 | 2,470 | `0.8851` | **`0.4811`** | `0.5123` | `0.5113` | `0.3917` | `0.5245` |
| **Mean** | — | — | **`0.8725`** | **`0.5126`** | **`0.5027`** | **`0.4987`** | **`0.3835`** | **`0.5082`** |

### Key Empirical Takeaways
1. **Leaky Target AUC**: Averaged **`0.8725`** across walk-forward folds (and reached `0.8923` on the single 2024 fold), confirming the leak.
2. **Honest Forward AUC**: Averaged **`0.5126`**, fully aligning with the original production model cards (`0.5142` on 15M, `0.5238` on 4H).
3. **Shuffled-Label Control**: Produced **`0.5027`** (approx. 0.500), demonstrating the cross-validation pipeline has zero intrinsic bias.
4. **Lagged-Feature Control**: Produced **`0.4987`** (approx. 0.500), confirming that lagging features removes all apparent predictive power.
5. **Rule Baseline**: Rose from `0.3835` (leaky inverted) to **`0.5082`** under the honest forward target.

---

## 5. Invalid Results & Documentation Status

- `notebooks/model_quality_report.md`: All previous sections referencing AUC `0.8923`, `0.8584`, and `0.3676` are marked as **INVALID DUE TO TARGET LOOKBACK LEAKAGE** and replaced with the purged walk-forward figures.
- `README.md`: Updated to strike out the invalid `0.8923` claims and state the audited `0.5126` AUC clearly.
- `src/components/ai-engine/ResearchResultsTable.tsx`: Confirmed that existing strategy verdicts (15M, 1H-A, 4H-A, 4H-B, 1H-C) relied on trade execution logs and return series ($R$), not on the flawed `run_model_quality.py` script.
