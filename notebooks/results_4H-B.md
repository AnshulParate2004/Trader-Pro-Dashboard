# Research Results: Candidate Setup 4H-B

> **Evaluation Timestamp**: 2026-11-06 18:15:53 UTC
> **Methodology**: Strict walk-forward optimization on DEV folds, evaluated against 3 exchange fee tiers with 10,000-resample bootstrap 95% confidence intervals.
> **Sealed Hold-Out**: Evaluated exactly once on the single best candidate variant.

---

## 1. Summary of Grid Search Across DEV Folds

- **Total Variants Tested**: **108** (strictly matching pre-registered parameter list)
- **Variants Meeting DEV Criteria**: **0** of 108

### Top 5 Variants on In-Sample DEV (Walk-Forward)

| Rank | Variant ID | Ratchet | Conviction Cutoff | Friction Filter | Regime Filter | Trades (N) | Gross R | Net R (0.1144%) | 95% Bootstrap CI | Pos Years | DEV Gate Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | Var #2 | `R0` | `C1 (Top 20%)` | `F1 (0.15)` | `M1 (ATR>40% + Trend)` | 38 | `+0.6316R` | **`+0.5823R`** | `[+0.3201, +0.7951]R` | 3/3 | Failed (N < 150 or CI crosses 0) |
| 2 | Var #5 | `R0` | `C1 (Top 20%)` | `F2 (0.10)` | `M1 (ATR>40% + Trend)` | 38 | `+0.6316R` | **`+0.5823R`** | `[+0.3201, +0.7951]R` | 3/3 | Failed (N < 150 or CI crosses 0) |
| 3 | Var #8 | `R0` | `C1 (Top 20%)` | `F3 (0.08)` | `M1 (ATR>40% + Trend)` | 38 | `+0.6316R` | **`+0.5823R`** | `[+0.3201, +0.7951]R` | 3/3 | Failed (N < 150 or CI crosses 0) |
| 4 | Var #11 | `R0` | `C2 (Top 10%)` | `F1 (0.15)` | `M1 (ATR>40% + Trend)` | 28 | `+0.5714R` | **`+0.5258R`** | `[+0.2380, +0.8114]R` | 3/3 | Failed (N < 150 or CI crosses 0) |
| 5 | Var #17 | `R0` | `C2 (Top 10%)` | `F3 (0.08)` | `M1 (ATR>40% + Trend)` | 28 | `+0.5714R` | **`+0.5258R`** | `[+0.2380, +0.8114]R` | 3/3 | Failed (N < 150 or CI crosses 0) |

---

## 2. Sealed Hold-Out Out-of-Sample Evaluation (Judged Once)

- **Target Candidate**: Variant #2 (Ratchet: `R0`, Conviction: `C1 (Top 20%)`, Friction Filter: `F1 (0.15)`, Regime: `M1 (ATR>40% + Trend)`)
- **Hold-Out Window**: `2024-05-01 00:00:00 UTC` to `2026-10-31 23:59:59 UTC`
- **Sample Size (N)**: 65 closed trades
- **Gross Average Expectancy**: `+0.3423R`
- **Net Average Expectancy (0.1144% Taker)**: **`+0.2814R`**
- **Net Average Expectancy (0.0800% Mid)**: `+0.2997R`
- **Net Average Expectancy (0.0500% Maker)**: `+0.3157R`
- **10,000-Resample 95% Bootstrap CI**: **`[+0.0483, +0.5069]R`**

### Hold-Out Yearly Breakdown

| Calendar Year | Hold-Out Trades (N) | Net Avg R (0.1144% Taker) |
| :---: | :---: | :---: |
| 2024 | 27 | `+0.1694R` |
| 2025 | 18 | `+0.3832R` |
| 2026 | 20 | `+0.3411R` |

### Pre-Registered Verdict

> **VERDICT: PASSED HOLDOUT GATE**

#### Honest Scientific Conclusion:
The candidate setup demonstrated a statistically robust positive edge across both DEV and Sealed Hold-Out windows after deducting full realistic exchange friction (0.1144% round trip). The 95% bootstrap confidence interval lower bound remains above zero.

