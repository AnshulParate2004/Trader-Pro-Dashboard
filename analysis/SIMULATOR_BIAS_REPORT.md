# Comprehensive Simulator Bias, Paired Arithmetic & Three-Mode Execution Audit

**Date:** 2026-11-07  
**Scope:** 15M, 1H, 4H BTCUSDT  
**Scripts:** `analysis/run_step2b_audit.py`, `analysis/simulator_bias_test.py`

---

## 1. Paired Arithmetic Correction & Exact Proof

In earlier drafts, random entries were resampled with independent stops and variable trade counts, leading to statistical discrepancies where $\overline{\Delta \text{Gross}} \neq \overline{\text{Gross}_{\text{real}}} - \overline{\text{Gross}_{\text{random}}}$ due to differing trade durations and cost weights.

In this corrected audit, **every paired comparison is recomputed strictly per-trade**:
- Each real trade $k \in [0 \dots N-1]$ has entry bar $i_k$, entry price $P_k$, stop distance $d_k$, and cost-in-R $C_k = \frac{\text{TakerFee}}{\text{stop\_pct}_k}$.
- In each random seed, trade $k$ is paired with an independent random control entry having the **EXACT SAME entry bar, stop distance $d_k$, and cost-in-R $C_k$**, but independent 50/50 direction $S^{\text{rand}}_k \in \{+1, -1\}$.
- Because real and random share the identical stop distance and fee drag, fee friction cancels out identically:
  $$\Delta \text{Net}_k = (\text{Gross}_{k}^{\text{real}} - C_k) - (\text{Gross}_{k}^{\text{random}} - C_k) \equiv \text{Gross}_{k}^{\text{real}} - \text{Gross}_{k}^{\text{random}} = \Delta \text{Gross}_k$$
- Therefore, the mean paired delta is mathematically identical to the difference of the means:
  $$\overline{\Delta \text{Gross}} \equiv \overline{\text{Gross}_{\text{real}}} - \overline{\text{Gross}_{\text{random}}}$$
  $$\overline{\Delta \text{Net}} \equiv \overline{\text{Net}_{\text{real}}} - \overline{\text{Net}_{\text{random}}}$$

### Numerical Verification Across Modes:
- **15M OLD:** Real Gross $= +0.1272\text{R}$, Rand Gross $= +0.1114\text{R} \implies \text{Diff} = +0.0158\text{R}$. Paired $\Delta = \mathbf{+0.0158R}$ (Residual error: `0.000000`).
- **15M MIDDLE:** Real Gross $= -0.0209\text{R}$, Rand Gross $= +0.0340\text{R} \implies \text{Diff} = -0.0548\text{R}$. Paired $\Delta = \mathbf{-0.0548R}$ (Residual error: `0.000000`).
- **15M STRICT:** Real Gross $= -0.1244\text{R}$, Rand Gross $= -0.0859\text{R} \implies \text{Diff} = -0.0385\text{R}$. Paired $\Delta = \mathbf{-0.0385R}$ (Residual error: `0.000000`).
- **1H OLD:** Real Gross $= +0.1128\text{R}$, Rand Gross $= +0.0963\text{R} \implies \text{Diff} = +0.0165\text{R}$. Paired $\Delta = \mathbf{+0.0165R}$ (Residual error: `0.000000`).
- **1H MIDDLE:** Real Gross $= -0.0224\text{R}$, Rand Gross $= +0.0265\text{R} \implies \text{Diff} = -0.0489\text{R}$. Paired $\Delta = \mathbf{-0.0489R}$ (Residual error: `0.000000`).
- **1H STRICT:** Real Gross $= -0.1199\text{R}$, Rand Gross $= -0.0986\text{R} \implies \text{Diff} = -0.0213\text{R}$. Paired $\Delta = \mathbf{-0.0213R}$ (Residual error: `0.000000`).
- **4H OLD:** Real Gross $= +0.2096\text{R}$, Rand Gross $= +0.1078\text{R} \implies \text{Diff} = +0.1017\text{R}$. Paired $\Delta = \mathbf{+0.1017R}$ (Residual error: `0.000000`).
- **4H MIDDLE:** Real Gross $= +0.0676\text{R}$, Rand Gross $= +0.0238\text{R} \implies \text{Diff} = +0.0438\text{R}$. Paired $\Delta = \mathbf{+0.0438R}$ (Residual error: `0.000000`).
- **4H STRICT:** Real Gross $= -0.0196\text{R}$, Rand Gross $= -0.0905\text{R} \implies \text{Diff} = +0.0709\text{R}$. Paired $\Delta = \mathbf{+0.0709R}$ (Residual error: `0.000000`).

---

## 2. Noise Benchmark Across Three Simulation Modes

Expected gross return in pure noise is **$0.0000\text{R}$**. We benchmarked three execution modes across 100 seeds:
1. **OLD Mode**: Optimistic same-candle (TP first: $+1.0\text{R}$), same-candle intra-bar ratchet activation, exact $+0.05\text{R}$ breakeven fill, signal close entry.
2. **MIDDLE Mode**: Unbiased 50/50 same-candle resolution, ratchet arms for next bar ($t+1$), true $0.00\text{R}$ breakeven fill, next-bar open entry.
3. **STRICT Mode**: Pessimistic same-candle resolution (SL first: $-1.0\text{R}$), ratchet arms for next bar ($t+1$), true $0.00\text{R}$ breakeven fill, gap fills at open, next-bar open entry.

### Results on Pure Noise:
| Dataset | OLD Mode Gross R (Phantom Edge) | MIDDLE Mode Gross R (Unbiased) | STRICT Mode Gross R (Conservative) |
| :--- | :---: | :---: | :---: |
| **15M Synthetic GBM ($\mu=0$)** | **$+0.1132\text{R}$** $[+0.063, +0.169]$ | **$+0.0149\text{R}$** $[-0.041, +0.077]$ | **$-0.0764\text{R}$** $[-0.138, -0.019]$ |
| **15M Bootstrapped Detrended** | **$+0.1260\text{R}$** $[+0.087, +0.166]$ | **$-0.0085\text{R}$** $[-0.048, +0.037]$ | **$-0.1335\text{R}$** $[-0.168, -0.090]$ |
| **1H Synthetic GBM ($\mu=0$)** | **$+0.1154\text{R}$** $[+0.068, +0.154]$ | **$+0.0165\text{R}$** $[-0.033, +0.058]$ | **$-0.0730\text{R}$** $[-0.125, -0.037]$ |

> **Key Discovery**: **MIDDLE mode is completely unbiased on pure noise.** It yields $\approx 0.00\text{R}$ ($-0.0085\text{R}$ to $+0.0165\text{R}$ with 95% CIs bracketing zero). The $+0.11\text{R}$ to $+0.13\text{R}$ gross return reported in all earlier studies was entirely an artifact of OLD simulator mechanics.

---

## 3. Real Market Performance: Donchian Baseline vs. LightGBM Model

Evaluated on historical BTC candles under 0.1144% taker friction with 10,000-resample bootstrap 95% confidence intervals:

### (A) Donchian-Only Baseline (Pure Breakout, No ML)
| Timeframe | Trades ($N$) | Mode | Gross Avg R | Net Avg R (0.1144% Taker) | 95% Bootstrap CI (Net R) |
| :--- | :---: | :--- | :---: | :---: | :---: |
| **15M** | 8,733 | **OLD** (Biased) | $+0.1272\text{R}$ | $-0.2762\text{R}$ | $[-0.2944, -0.2582]\text{R}$ |
| **15M** | 8,733 | **MIDDLE** (Unbiased) | $-0.0209\text{R}$ | **$-0.4243\text{R}$** | **$[-0.4436, -0.4052]\text{R}$** |
| **15M** | 8,733 | **STRICT** | $-0.1244\text{R}$ | **$-0.5278\text{R}$** | **$[-0.5487, -0.5070]\text{R}$** |
| **1H** | 1,527 | **OLD** (Biased) | $+0.1128\text{R}$ | $-0.0641\text{R}$ | $[-0.1053, -0.0248]\text{R}$ |
| **1H** | 1,527 | **MIDDLE** (Unbiased) | $-0.0224\text{R}$ | **$-0.1994\text{R}$** | **$[-0.2436, -0.1551]\text{R}$** |
| **1H** | 1,527 | **STRICT** | $-0.1199\text{R}$ | **$-0.2969\text{R}$** | **$[-0.3443, -0.2486]\text{R}$** |
| **4H** | 340 | **OLD** (Biased) | $+0.2096\text{R}$ | $+0.1278\text{R}$ | $[+0.0471, +0.2108]\text{R}$ |
| **4H** | 340 | **MIDDLE** (Unbiased) | $+0.0676\text{R}$ | **$-0.0141\text{R}$** | **$[-0.1037, +0.0774]\text{R}$** |
| **4H** | 340 | **STRICT** | $-0.0196\text{R}$ | **$-0.1013\text{R}$** | **$[-0.1963, -0.0033]\text{R}$** |

### (B) Real LightGBM-Filtered Model (`trades_main.csv`)
| Timeframe | Trades ($N$) | Mode | Gross Avg R | Net Avg R (0.1144% Taker) | 95% Bootstrap CI (Net R) |
| :--- | :---: | :--- | :---: | :---: | :---: |
| **15M** | 11,548 | **OLD** (Biased) | $+0.1370\text{R}$ | $-0.3011\text{R}$ | $[-0.3171, -0.2847]\text{R}$ |
| **15M** | 11,548 | **MIDDLE** (Unbiased) | $-0.0165\text{R}$ | **$-0.4546\text{R}$** | **$[-0.4720, -0.4371]\text{R}$** |
| **15M** | 11,548 | **STRICT** | $-0.1289\text{R}$ | **$-0.5670\text{R}$** | **$[-0.5857, -0.5477]\text{R}$** |
| **1H** | 2,624 | **OLD** (Biased) | $+0.1363\text{R}$ | $-0.0508\text{R}$ | $[-0.0814, -0.0205]\text{R}$ |
| **1H** | 2,624 | **MIDDLE** (Unbiased) | $-0.0050\text{R}$ | **$-0.1921\text{R}$** | **$[-0.2251, -0.1592]\text{R}$** |
| **1H** | 2,624 | **STRICT** | $-0.1057\text{R}$ | **$-0.2928\text{R}$** | **$[-0.3297, -0.2557]\text{R}$** |
| **4H** | 598 | **OLD** (Biased) | $+0.2117\text{R}$ | $+0.1232\text{R}$ | $[+0.0602, +0.1868]\text{R}$ |
| **4H** | 598 | **MIDDLE** (Unbiased) | $+0.0819\text{R}$ | **$-0.0065\text{R}$** | **$[-0.0749, +0.0595]\text{R}$** |
| **4H** | 598 | **STRICT** | $-0.0193\text{R}$ | **$-0.1078\text{R}$** | **$[-0.1822, -0.0350]\text{R}$** |

---

## 4. Read-Only Audit of Live Production Code

We audited [`src/lib/tradingEngine.ts`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/src/lib/tradingEngine.ts) and [`src/lib/paperExecutor1HA.ts`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/src/lib/paperExecutor1HA.ts) without altering 1H-A. Both executors inherit the identical optimistic biases:

1. **Breakeven Credit Above Zero**:
   - `tradingEngine.ts` lines 342–344: `beLocked = entryPrice + 0.05 * atr`. Stopped out trades lock $+0.05\text{R}$ artificial gross profit.
   - `paperExecutor1HA.ts` line 120: `grossR = t.be_activated ? t.cost_R_taker : -1.0`. Breakeven exits award a positive credit equal to the taker fee.
2. **TP Checked Before SL**:
   - `paperExecutor1HA.ts` lines 111–116: `if (currentPrice >= t.take_profit) { ... } else if (currentPrice <= t.stop_loss) { ... }`.
   If a price spike crossed both TP and SL during the polling interval, TP is evaluated and credited first.
3. **Signal Close Fill**:
   - `tradingEngine.ts` lines 364 & 382: `entryPrice: params.entryPrice`. Filled at the signal bar's closing price rather than the subsequent bar's open.

### Explanation of Why 75 Live 15M Trades Showed Gross +0.20R:
In MongoDB, the 75 live trades achieved 44.0% TP exits, 29.3% Breakeven exits (credited with positive PnL), and only 26.7% SL losses:
$$\text{Gross R} \approx (0.44 \times +1.0\text{R}) + (0.293 \times +0.05\text{R}) - (0.267 \times 1.0\text{R}) = 0.44 + 0.015 - 0.267 = \mathbf{+0.188R} \approx \mathbf{+0.20R}$$
Because median stop was tight ($0.23\%$), taker fees cost $0.50\text{R}$ per trade, converting the $+0.20\text{R}$ gross into a net loss of **$-0.30\text{R}$**.

---

## 5. Training Overlap & Hold-Out Invalidation

Inspection of the final model files (`src/models/*/final_model_BTCUSDT_*.joblib`) reveals:
```json
{
  "trained_until": "2026-10-26 21:45:00+00:00"
}
```
The parquet price dataset ends on `2026-10-27`. Therefore:
- The models were trained on data extending through **October 26, 2026**.
- The purported "sealed hold-out" period (`2024-05-01` to `2026-10-27`) was **seen by the models during fitting**.
- **Invalidated Claims**:
  1. Setup 4H-B Hold-Out (+0.2814R) was **in-sample**, not an out-of-sample hold-out.
  2. Setup 1H-A Multi-Coin (+0.0412R) was **in-sample**, not out-of-sample.

---

## 6. Institutional Conclusion

1. **NO setup keeps a positive net lower bound.**
2. Under unbiased **MIDDLE mode**, 4H net return is **$-0.0065\text{R}$ to $-0.0141\text{R}$** (CI crosses zero). Under **STRICT mode**, 4H net return drops to **$-0.1013\text{R}$ to $-0.1078\text{R}$** (CI strictly below zero).
3. 15M and 1H are deeply negative across all unbiased execution modes ($-0.19\text{R}$ to $-0.57\text{R}$).
4. Every earlier positive net-R claim is **SIMULATOR-BIASED and superseded**.
