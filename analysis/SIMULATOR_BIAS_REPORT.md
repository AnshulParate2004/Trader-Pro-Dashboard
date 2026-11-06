# Simulator Bias Audit & Strict Execution Report

**Date:** 2026-11-07  
**Scope:** 15M, 1H, 4H BTCUSDT  
**Script:** `analysis/simulator_bias_test.py`

---

## 1. Direction Selection in Random Control

In earlier iterations of the matched random control, each randomly sampled bar **inherited the trade direction (Long/Short) from the real Donchian breakout signal** rather than drawing direction independently 50/50. 
In a secular bull market where BTC grew from \$7,000 in 2020 to \$70,000+ in 2024-2026, inheriting the breakout direction transmitted the secular trend and momentum to the "random" baseline. When independent 50/50 direction selection is enforced, random entries have zero directional bias.

---

## 2. Synthetic Random-Walk Benchmark (Pure Noise Test)

We evaluated the original simulator on synthetic pure-noise price series with zero drift ($\mu = 0$):
1. **Geometric Brownian Motion (GBM):** Drift $\mu = 0$, volatility calibrated to empirical BTC log-return standard deviation across 100 seeds.
2. **Block-Bootstrapped Real Returns:** Detrended real returns resampled in 24-bar blocks with 50% sign inversion to preserve volatility clustering while eliminating trend.

### Results on Pure Noise:
- **15M GBM Pure Noise:** Gross R = **`+0.1130R`** (5th–95th: `[+0.0806, +0.1383]R`)
- **15M Block-Bootstrapped Detrended:** Gross R = **`+0.1291R`** (5th–95th: `[+0.1017, +0.1561]R`)
- **1H GBM Pure Noise:** Gross R = **`+0.1134R`** (5th–95th: `[+0.0833, +0.1378]R`)

### Root Causes of Simulator Upward Bias:
On pure random noise with zero drift, expected gross return should be $0.00\text{R}$. The original simulator earned $+0.11\text{R}$ to $+0.13\text{R}$ gross due to four structural modeling assumptions:
1. **The $+0.05\text{R}$ Breakeven Fill**: When a trade touches $+0.30\text{R}$, the simulator ratchets stop to $+0.05\text{R}$ and credits an artificial $+0.05\text{R}$ on pullback rather than true breakeven ($0.0\text{R}$) or worse under slippage.
2. **Same-Candle Ratchet Arming & Activation**: In the original code, if candle $t$ touched $+0.30\text{R}$, the ratchet armed immediately on that candle. If candle $t$ also plunged to SL, the simulator treated the trade as a $+0.05\text{R}$ breakeven rather than a $-1.0\text{R}$ stop.
3. **Optimistic Intra-Candle Ambiguity**: When high touches TP and low touches SL in the same candle, the original simulator assumed TP was hit first (+1.0R).
4. **Signal Close Fill**: Entering at `close[i]` assumes zero execution latency, bypassing spread and next-candle opening gaps.

---

## 3. Strict Execution Mode Specification

We implemented `strict` execution semantics in `analysis/simulator_bias_test.py`:
- **Next-Bar Open Fill:** Trades enter at `open[i+1]` instead of `close[i]`.
- **Inter-Candle Ratchet Arming:** Ratchet armed on candle $t$ only protects stops from candle $t+1$ onward.
- **Pessimistic Ambiguity Resolution:** Same-candle TP/SL/BE collisions resolve to Stop Loss first ($-1.0\text{R}$).
- **Gap-Aware Fill:** If a bar opens past a stop loss or locked breakeven price, the fill occurs at the worse open price.
- **True Breakeven:** Locked stop fills at $\le 0.00\text{R}$, eliminating the $+0.05\text{R}$ artificial bonus.

---

## 4. Timeframe Audit: Original vs. Strict Mode

| Timeframe | Mode | Trades ($N$) | Gross R | Net R (0.1144% Taker) | 95% Bootstrap CI (Net R) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **15M** | Original | 13,732 | $+0.1310\text{R}$ | $-0.2600\text{R}$ | $[-0.273, -0.245]\text{R}$ |
| **15M** | **Strict** | 14,666 | **$-0.1303\text{R}$** | **$-0.5207\text{R}$** | **$[-0.5364, -0.5040]\text{R}$** |
| **1H** | Original | 3,339 | $+0.1203\text{R}$ | $-0.0495\text{R}$ | $[-0.076, -0.021]\text{R}$ |
| **1H** | **Strict** | 3,577 | **$-0.1125\text{R}$** | **$-0.2817\text{R}$** | **$[-0.3126, -0.2509]\text{R}$** |
| **4H** | Original | 890 | $+0.1560\text{R}$ | $+0.0776\text{R}$ | $[+0.020, +0.120]\text{R}$ |
| **4H** | **Strict** | 959 | **$-0.0574\text{R}$** | **$-0.1353\text{R}$** | **$[-0.1923, -0.0789]\text{R}$** |

---

## 5. Paired Bootstrap Comparison: Real Model vs. Independent Random (Strict Mode)

Matched by hour-of-day and ATR quintile with independent 50/50 direction (100 seeds):

| Timeframe | Paired $\Delta$ Gross R (Real - Random) [95% CI] | Paired $\Delta$ Net R (Real - Random) [95% CI] |
| :--- | :---: | :---: |
| **15M** | **$+0.2667\text{R}$** `[+0.2078, +0.3245]` | **$+0.6766\text{R}$** `[+0.6111, +0.7434]` |
| **1H** | **$-0.1454\text{R}$** `[-0.2059, -0.0877]` | **$+0.0559\text{R}$** `[-0.0040, +0.1163]` |
| **4H** | **$+0.1284\text{R}$** `[+0.0645, +0.1907]` | **$+0.1699\text{R}$** `[+0.1062, +0.2337]` |

---

## 6. LightGBM Usage & Training Data Overlap

1. **LightGBM Role:**
   - In the backtest scripts (`simulate_live_stops.py`, `run_random_control.py`), trade entries were **pure Donchian-20 breakouts** without LightGBM probability filtering.
   - In production inference (`src/lib/lgbmEvaluator.ts`), LightGBM acts as a binary probability filter (`P_Long > thr_long`), rejecting breakouts below high confidence thresholds (`0.6315` on 15M, `0.8539` on 4H).
2. **Training Data Overlap:**
   - Model metadata inspection reveals: `trained_until = 2026-10-26`.
   - The models were trained on data spanning `2020-01-01` to `2026-10-26`.
   - The parquet simulation dataset spans `2020-01-01` to `2026-10-27`.
   - **The simulation period overlaps the model training window by 99.9%.** All reported historical backtest numbers are in-sample to the model training span.

---

## 7. Institutional Verdict

> [!CAUTION]
> **No setup maintains a positive net lower bound.** Under strict execution semantics (next-bar open fills, next-bar ratchet activation, pessimistic intra-candle ordering, and gap fills), **every timeframe has negative net expectancy**. 
> Even 4H drops to **$-0.1353\text{R}$** with a 95% bootstrap CI upper bound of **$-0.0789\text{R}$**. The previously reported positive net R on 4H was entirely an artifact of optimistic simulator assumptions.
