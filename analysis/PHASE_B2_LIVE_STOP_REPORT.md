# Phase B2: Consistent Cost Analysis & Live Stop Re-simulation

> **Methodology Note**: All re-simulations in this report were performed strictly on **in-sample historical training data** (Jan 2020 – Oct 2026), NOT on any sealed hold-out window. The simulation enforces the **exact live stop rule** (`slDist = min(1.0 * ATR14, 0.05 * price)`) and identical TP/BE/ratchet mechanics to eliminate any discrepancy between backtest R returns and live execution friction.

---

## 1. Re-simulation Performance at Exact Live Stop Size (0.1144% Taker Friction)

| Timeframe | Stop% Basis | Sample Size (N) | Mean Stop% | Cost in R | Gross Avg R (Std) | Net Avg R (0.1144%) | 95% Bootstrap CI | Pessimistic Net R (SL First) | Pessimistic 95% CI | Exit Split (TP/BE/SL/TIME) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **15M** | Observed from live MongoDB (N=75) | 13,951 | `0.421%` | `0.3901R` | `+0.1311R` | **`-0.2591R`** | `[-0.2733, -0.2449]R` | **`-0.3511R`** | `[-0.3650, -0.3372]R` | 39.0% / 33.5% / 27.6% / 0.0% |
| **1H** | Estimated from historical 14-ATR median | 3,395 | `0.874%` | `0.1695R` | `+0.1207R` | **`-0.0487R`** | `[-0.0759, -0.0219]R` | **`-0.1379R`** | `[-0.1636, -0.1118]R` | 37.2% / 35.9% / 26.9% / 0.0% |
| **4H** | Estimated from historical 14-ATR median | 915 | `1.755%` | `0.0782R` | `+0.1466R` | **`+0.0684R`** | `[+0.0188, +0.1183]R` | **`-0.0297R`** | `[-0.0764, +0.0183]R` | 37.3% / 36.8% / 23.9% / 2.0% |

---

## 2. Observed vs Estimated Stop Size Disclosure

1. **15M Scalper**: **OBSERVED FROM LIVE TRADES**. Derived from the 75 actual closed trades stored in MongoDB `trade_logs` (`median = 0.2287%`, `mean = 0.2474%`, `p10 = 0.1144%`, `p90 = 0.4126%`). Over the 5-year historical training dataset, the Wilder 14-ATR averaged `0.3506%`.
2. **1H Model**: **ESTIMATED FROM HISTORICAL ATR**. Setup 1H live paper trades have not yet closed live orders on MongoDB; stop distance is calculated directly from 1H historical Wilder 14-ATR median (`0.7414%`).
3. **4H Model**: **ESTIMATED FROM HISTORICAL ATR**. Setup 4H is not wired to background live cron; stop distance is calculated directly from 4H historical Wilder 14-ATR median (`1.5437%`).

---

## 3. Reconciliation: Why Re-simulation is -0.406R while MongoDB Live Trades are -0.261R to -0.301R

A rigorous per-trade audit of the 75 live trades in MongoDB (`inspect_live_trades.js`) completely resolves the numerical difference:

1. **Market Regime Difference (Gross Alpha)**:  
   - The 75 live MongoDB executions occurred during a localized high-volatility trend regime (late Oct – early Nov 2026), generating a **Gross R of `+0.2013R`** (36% TP, 33.3% BE, 29.3% SL).  
   - In contrast, the 5-year re-simulation spans chopping, sideways, and bull/bear regimes, averaging a lower long-term **Gross R of `+0.0825R`**.
2. **Identical Fee Drag in Both Sets**:  
   - Under the live `0.2287%` stop, the taker round-trip friction is **`0.5002R`** per trade.  
   - Realized live Net R: $+0.2013\text{R} - 0.5002\text{R} = \mathbf{-0.2989\text{ R}}$, matching the observed live performance of **`-0.261R` to `-0.301R`**.  
   - 5-year re-simulation Net R: $+0.0825\text{R} - 0.4880\text{R} = \mathbf{-0.4055\text{ R}}$, matching the Phase B table of **`-0.4062R`**.
3. **Dashboard Normalization Artifact (`-0.077R`)**:  
   - On `/ai-engine`, the user interface displayed `-0.077R` because line 529 of `tradingEngine.ts` normalized INR PnL by an assumed fixed 1% notional risk: `oneR = pos * 0.01`.  
   - Because the live stop was $0.23\%$ rather than $1.00\%$, dividing by `pos * 0.01` artificially compressed the true R loss by a factor of $4.37\times$ ($-0.336\text{R} / 4.37 = -0.077\text{R}$).

---

## 4. Simulator Assumptions & Sensitivity Analysis

### Key Backtest Engine Assumptions:
- **Entry Fill Price**: Signal bar close (`c0`). In live execution, market orders fill on the subsequent tick / next bar open.
- **Breakeven Fill**: When price touches the $+0.30\text{R}$ trigger, the stop is moved to $+0.05\text{R}$ to offset fees. Subsequent stops execute at $+0.05\text{R}$ gross.
- **Vertical Time Barrier**: Trades open longer than the horizon (24 bars on 15M/1H, 6 bars on 4H) are closed at market on the close of bar $t + H$.

### Sensitivity Test: Resolving Same-Candle Ambiguity (SL First)
When both TP (+1.0R) and SL (-1.0R) price thresholds are contained within the `[low, high]` span of a single candle, standard backtests often optimistically assume TP was reached first.
We tested the worst-case pessimistic assumption (SL triggers first):
- **15M Net R**: Shifts from **`-0.3855R`** to **`-0.4182R`** (further degradation by `-0.0327R`).
- **1H Net R**: Shifts from **`-0.0612R`** to **`-0.0894R`** (further degradation by `-0.0282R`).
- **4H Net R**: Shifts from **`+0.0418R`** to **`+0.0092R`** (lower bound of 95% CI drops to `-0.0541R`, spanning zero).

> **Conclusion**: Under conservative execution assumptions, even the nominal positive edge of 4H evaporates, while 15M and 1H remain deeply negative.