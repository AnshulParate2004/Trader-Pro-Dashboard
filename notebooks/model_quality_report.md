# Model Quality, Permutation Importance, and Baseline Comparison Report

> **Empirical Diagnostic**: Evaluated on 4H BTCUSDT dataset to verify feature signal-to-noise ratio, test incremental alpha from derivatives features (funding rates & open interest), and compare LightGBM against baselines.

---

## 1. Feature Permutation Importance & Noise Floor

- **Gaussian Noise Feature Drop Threshold**: `0.00003` AUC
- **Surviving High-Signal Features (12)**: `ret_1, ret_3, ret_6, ret_24, atr_ratio, body_pct, macd_hist, bb_pctb, bb_width, ema20_slope, vol_z, vol_ratio`
- **Dropped Features (Below Noise Floor) (8)**: `ret_12, atr_pct, range_pct, rsi14, ema_dist_20, ema_dist_50, ema_20_50, taker_ratio`

### Permutation Importance Ranking

| Rank | Feature | Out-of-Sample AUC Drop | Signal Status |
| :---: | :--- | :---: | :---: |
| 1 | `ret_3` | `+0.20093` | Kept (Above Noise) |
| 2 | `ret_6` | `+0.02938` | Kept (Above Noise) |
| 3 | `ret_1` | `+0.02537` | Kept (Above Noise) |
| 4 | `bb_pctb` | `+0.01153` | Kept (Above Noise) |
| 5 | `vol_ratio` | `+0.00494` | Kept (Above Noise) |
| 6 | `atr_ratio` | `+0.00204` | Kept (Above Noise) |
| 7 | `macd_hist` | `+0.00197` | Kept (Above Noise) |
| 8 | `ret_24` | `+0.00058` | Kept (Above Noise) |
| 9 | `vol_z` | `+0.00056` | Kept (Above Noise) |
| 10 | `ema20_slope` | `+0.00021` | Kept (Above Noise) |
| 11 | `bb_width` | `+0.00014` | Kept (Above Noise) |
| 12 | `body_pct` | `+0.00009` | Kept (Above Noise) |
| 13 | `noise_benchmark` | `+0.00003` | Noise Benchmark |
| 14 | `atr_pct` | `+0.00002` | Dropped (Below Noise) |
| 15 | `rsi14` | `+0.00001` | Dropped (Below Noise) |
| 16 | `ema_dist_50` | `+0.00000` | Dropped (Below Noise) |
| 17 | `ret_12` | `-0.00000` | Dropped (Below Noise) |
| 18 | `range_pct` | `-0.00001` | Dropped (Below Noise) |
| 19 | `ema_20_50` | `-0.00002` | Dropped (Below Noise) |
| 20 | `ema_dist_20` | `-0.00002` | Dropped (Below Noise) |
| 21 | `taker_ratio` | `-0.00008` | Dropped (Below Noise) |

---

## 2. Incremental Value of Funding Rates & Open Interest

- **Baseline LightGBM (All Core Features) AUC**: **`0.8922`**
- **Trimmed Features LightGBM AUC**: **`0.8923`**
- **Trimmed + Derivatives (Funding & Open Interest) AUC**: **`0.8922`**

> [!WARNING] Adding funding rates and open interest features did NOT improve OOS AUC on 4H candles. In accordance with pre-registration rules, these features are NOT retained in the production model.

---

## 3. Algorithm Benchmark: LightGBM vs Logistic Regression vs Rule Baseline

| Model Architecture | OOS AUC | Strategy Complexity | Verdict |
| :--- | :---: | :--- | :--- |
| **LightGBM (Trimmed Signal Features)** | **`0.8923`** | Gradient Boosted Decision Trees | Highest discriminating power |
| **Logistic Regression (L2 Regularized)** | `0.8584` | Linear Classifier (Standardized) | Competitive linear baseline |
| **Rule-Based Trend Baseline** | `0.3676` | Dual EMA50 + RSI Momentum Rule | Minimalist benchmark |

---

