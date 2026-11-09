# Paper Trading Protocol & Exact Execution Mechanics: Setup 1H-A (BTCUSDT)

**Last Updated:** November 2026  
**Status:** FROZEN — Execution Infrastructure Reference  
**Scope:** `BTCUSDT` Only (`paper_1h_a` Collection)  

---

## 1. Exact Execution Implementation Today (`src/lib/paperExecutor1HA.ts`)

Following an exhaustive code audit of [`src/lib/paperExecutor1HA.ts`](src/lib/paperExecutor1HA.ts), the actual forward paper execution operates with the following exact mechanics:

### A. Signal Generation (Handcrafted TypeScript Heuristics)
- **Model Loading**: Neither `lgbm_1h.json` nor `final_model_BTCUSDT_1h.joblib` is loaded anywhere in the 1H-A runtime execution path.
- **Signal Logic (`paperExecutor1HA.ts:205-219`)**:
  - Base probability: `probLong = 0.50`, `probShort = 0.50`.
  - 14-bar momentum modifier: If $(close_{t-1} - close_{t-15}) / \text{ATR}_{14} > 1.0$, add $+0.08$ to `probLong` (subtract $0.08$ from `probShort`). If $< -1.0$, subtract $0.08$ from `probLong`.
  - 20-bar Donchian channel modifier: If $close_{t-1} > \max(high_{t-21:t-2})$, add $+0.07$ to `probLong`. If $close_{t-1} < \min(low_{t-21:t-2})$, add $+0.07$ to `probShort`.
  - Signal threshold: Long triggered if `probLong >= 0.582` ($0.50 + 0.08 + 0.07 = 0.65 \ge 0.582$).
- **Model Checksum Status**: `FROZEN_1H_A_MODEL_HASH` is a static constant string literal (`A3D8A2...`) stamped onto MongoDB documents as descriptive metadata; **it is not cryptographically verified at runtime against any disk weights or artifact hash**.

### B. Entry & Barrier Sizing
- **Entry Price (`line 245`)**: Assigned as `lastClosed.close` (signal-close fill optimism; enters without next-bar open spread or execution delay).
- **Stop Loss (`lines 196, 246`)**: $1.0 \times \text{ATR}_{14}$ on closed 1H candles.
- **Take Profit (`line 248`)**: $1.0 \times \text{ATR}_{14}$ from entry.
- **Breakeven Trigger (`line 249`)**: $+0.30 \times \text{ATR}_{14}$.
- **Breakeven Lock (`line 106`)**: Stop moves to $entry + (\text{slDistPct} \times price \times \text{cost}_{R,\text{taker}})$.
- **Pre-Trade Cost Filter (`line 226`)**: Skips trade if $\text{cost}_R > 0.15$ (logged to `paper_1h_a_skipped`).

### C. Exit Evaluation Frequency & Intrahour Misses
- **Cadence**: Triggered via cron (`/api/cron/paper-1h-a`) **once per hour** (`"1 * * * *"`).
- **Price Evaluation (`line 79`)**: Evaluates `currentPrice = liveCandle.close` (a single hourly price snapshot).
- **Intrahour Touches Missed**: The executor does **not** evaluate candle highs or lows. Intrahour wick touches that crossed TP or SL and retraced prior to the hourly close are completely missed until an hourly close breaches the barrier.

### D. Fee & Friction Accounting
- **Taker Round-Trip Friction**: $0.1144\%$ ($0.040\% \text{ base} \times 1.18 \text{ GST} + 0.010\% \text{ slippage}$ per side).
- **Perpetual Funding**: **Not modelled.** 8-hour funding rate payments and margin borrow costs are completely omitted.
- **Dual Accounting in Dashboard**:
  - *Optimistic Paper Accounting:* $+0.0412\text{R}$ (assumes exact stop fills at entry + fee offset).
  - *Strict-Fill Shadow Metric:* $-0.0074\text{R}$ (true $0.00\text{R}$ breakeven fill, full fees charged).

---

## 2. Objective & Scope of Paper Trading
- **Primary Function:** Strictly an execution infrastructure test and data-logging harness.
- **No Edge Claim:** Because the signal is a handcrafted momentum/breakout heuristic evaluated on hourly snapshots with signal-close entry, it does not represent machine learning inference or a validated predictive edge.
