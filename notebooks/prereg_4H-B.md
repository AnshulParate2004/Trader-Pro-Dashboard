# Pre-Registration Protocol: Setup 4H-B

**Candidate Setup:** `4H-B` (4-Hour BTC Trend Breakout & Volatility Filter)  
**Pre-Registration Timestamp:** 2026-11-06 23:45:00 UTC  
**Status:** SEALED PRIOR TO INITIATING EXPERIMENTS

---

## 1. Research Hypothesis & Objective
Setup 1H-A demonstrated marginal gross alpha (+0.0412R) that degraded under realistic exchange friction (0.1144% round trip) due to low volatility churn and sub-optimal breakeven ratchet triggering.

**Hypothesis**: On the 4-Hour timeframe, filtering trades by regime (active volatility expanding above the 40th/60th percentile combined with 4H trend alignment), raising conviction cutoffs to the top 5%–10% of ML probabilities, tightening the maximum allowed friction cost_R to $\le 0.08$, and testing alternative breakeven ratchet thresholds (off, +0.5R, +0.7R, or locking $\ge +0.2\text{R}$) will produce positive net expectancy after all taker exchange fees, 18% GST, and bid-ask slippage.

---

## 2. Parameter Grid & Variants to Test

Only the following pre-registered parameters will be tested on the training/validation walk-forward folds. Zero additional combinations are permitted.

### a) Breakeven Ratchet (4 variants)
- `R0`: Ratchet OFF (hard 1:1 TP / SL target exit, zero premature breakeven exits)
- `R1`: Trigger at $+0.50\text{R}$, lock exact round-trip cost in R
- `R2`: Trigger at $+0.70\text{R}$, lock exact round-trip cost in R
- `R3`: Trigger at $+0.50\text{R}$, lock at least $+0.20\text{R}$ net profit

### b) Conviction Cutoff (3 variants)
- `C1`: Top 20% (expanding-window 80th percentile of prediction probability, no lookahead)
- `C2`: Top 10% (expanding-window 90th percentile)
- `C3`: Top 5% (expanding-window 95th percentile)

### c) Friction Filter cost_R (3 variants)
- `F1`: $\text{cost\_R} \le 0.15$
- `F2`: $\text{cost\_R} \le 0.10$
- `F3`: $\text{cost\_R} \le 0.08$

### d) Regime Filter (3 variants)
- `M0`: None (baseline technical signals)
- `M1`: Active Volatility ($\text{ATR percentile} > 40\text{th percentile}$) **AND** 4H Trend Agreement ($\text{Close} > \text{EMA}_{50}$ for LONG, $\text{Close} < \text{EMA}_{50}$ for SHORT)
- `M2`: High Volatility ($\text{ATR percentile} > 60\text{th percentile}$) **AND** 4H Trend Agreement

**Total Grid Variants Tested:** $4 \times 3 \times 3 \times 3 = \mathbf{108}$ variants.

---

## 3. Data Split & Sealed Hold-Out Protocol
- **DEV / Walk-Forward Tuning Window:** All 4H bars with $\text{open\_time} < \text{2024-05-01 00:00:00 UTC}$ (covers 2020 through April 2024).
- **SEALED HOLD-OUT Window:** All 4H bars with $\text{open\_time} \ge \text{2024-05-01 00:00:00 UTC}$ through $\text{2026-10-31 23:59:59 UTC}$.
- **Protocol:** Parameter selection is conducted strictly on DEV folds. The sealed hold-out will be evaluated **EXACTLY ONCE** on the single winning candidate chosen from DEV. The outcome will be recorded honestly in `notebooks/results_4H-B.md` regardless of pass or fail.

---

## 4. Fee & Friction Models
All performance is evaluated in net R units:
$$\text{cost\_R} = \frac{\text{Friction Pct}}{\text{Stop Distance Pct}}$$
- **Scenario 1 (Primary Taker Benchmark):** $0.040\% \text{ base} \times 1.18 \text{ GST} + 0.010\% \text{ slippage per side} = \mathbf{0.1144\%} \text{ round trip}$.
- **Scenario 2 (Mid Taker Benchmark):** $0.030\% \text{ base} + 18\% \text{ GST} + 0.010\% \text{ slippage} = \mathbf{0.0800\%} \text{ round trip}$.
- **Scenario 3 (Maker Benchmark):** $0.016\% \text{ base} + 18\% \text{ GST} + 0.005\% \text{ slippage} = \mathbf{0.0500\%} \text{ round trip}$.

---

## 5. Strict Pass/Fail Criteria
A candidate variant is eligible for promotion to live paper trading **ONLY IF ALL** of the following conditions are met simultaneously on DEV:
1. **Bootstrap Lower Bound $> 0$**: The lower bound of the 10,000-resample 95% bootstrap confidence interval for Average Net R at $0.1144\%$ friction is strictly $> 0$.
2. **Calendar Consistency**: Net R is positive in at least 4 of the 5 calendar years ($2020, 2021, 2022, 2023, 2024$).
3. **Statistical Sample Size**: Total closed trades on DEV $\ge 150$ trades.

If the best candidate fails any of these gates, or if the sealed hold-out evaluation yields a lower CI bound $< 0$, Setup 4H-B will be classified as **"No demonstrated edge"** and rejected from live execution.
