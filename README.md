# Trader-Pro Quant: Autonomous Strategy Execution & Research Platform

Trader-Pro is a full-stack quantitative trading platform and paper-execution engine designed for cryptocurrency perpetual futures (BTCUSDT). Built with Next.js 14 App Router, TypeScript, TailwindCSS, MongoDB Atlas, and LightGBM machine learning evaluators.

---

## 1. Exchange Friction & Fee Architecture

All performance metrics and research verdicts are evaluated under **real-world exchange friction** rather than idealized zero-fee backtests. 

Friction parameters are unified in [`src/lib/feeModel.ts`](src/lib/feeModel.ts):
- **Taker Base Fee**: `0.040%` per side (Shark Exchange standard rate)
- **Maker Base Fee**: `0.016%` per side (optimistic execution scenario)
- **Statutory GST**: `18.0%` applied on all exchange fees ($0.040\% \times 1.18 = 0.0472\%$ per side)
- **Bid-Ask Slippage**: `0.010%` per side for taker orders ($0.005\%$ for maker orders)
- **Standard Round-Trip Taker Friction**: **`0.1144%` of notional**

$$\text{cost\_R} = \frac{\text{Round-Trip Friction Pct}}{\text{Stop Distance Pct}}$$

---

## 2. Risk Engine & Execution Safeguards

Automated execution safeguards are codified in [`src/lib/riskEngine.ts`](src/lib/riskEngine.ts):

1. **Configurable `cost_R` Filter**:
   - Skips trades where exchange friction consumes more than `0.08R` (default for new setups; Setup 1H-A is frozen at `0.15R`).
2. **Rolling 100-Trade Kill Switch**:
   - If the average net R across the last 100 closed trades falls below `-0.05R`, autonomous execution is automatically paused, the reason is logged to MongoDB, and a critical alert banner is displayed on `/ai-engine`.
3. **Daily Loss Limit**:
   - Halts new entries for the remainder of the UTC day if cumulative net R reaches `-3.0R`.
4. **Max Drawdown Stop**:
   - Permanently halts execution if equity draws down by more than `-10.0R` from the all-time peak.

---

## 3. Empirical Research Findings & Honest Verdicts

### Comprehensive Edge Report (`analysis/EDGE_REPORT.md`)
Generated across 7 production models using 10,000-resample bootstrap 95% confidence intervals:

| Model / Cadence | Trades (N) | Gross Avg R | True Win Rate | Break-Even Fee % | Net Avg R (0.1144% Taker) | 95% Bootstrap CI | Empirical Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **15m BTC Scalper** | 11,548 | `+0.0940R` | 55.6% | `0.0885%` | **`-0.0275R`** | `[-0.0425, -0.0121]R` | Negative Expectancy (Decaying Alpha) |
| **5m BTC Scalper** | 11,420 | `+0.1007R` | 56.6% | `0.0473%` | **`-0.1426R`** | `[-0.1572, -0.1283]R` | Negative Expectancy (Fee Churn) |
| **1h Trend Setup** | 2,624 | `+0.1021R` | 56.2% | `0.1021%` | **`-0.0123R`** | `[-0.0444, +0.0184]R` | Inconclusive (CI spans zero) |
| **4h Baseline** | 598 | `+0.1525R` | 59.0% | `0.1525%` | **`+0.0381R`** | `[-0.0257, +0.1021]R` | Inconclusive (CI spans zero) |
| **Multi-Model Scalp** | 6,538 | `+0.1622R` | 62.0% | `0.1461%` | **`+0.0352R`** | `[+0.0168, +0.0534]R` | Fragile edge (eaten by live slippage) |

### Setup 4H-B Research Protocol & Verdict (`notebooks/`)
1. **Pre-Registration**: Documented in [`notebooks/prereg_4H-B.md`](notebooks/prereg_4H-B.md) and committed to git prior to testing. Tested exactly 108 variants:
   - 4 Ratchet Modes: R0 (off), R1 (+0.5R trigger), R2 (+0.7R trigger), R3 (+0.2R lock)
   - 3 Conviction Cutoffs: Top 20%, Top 10%, Top 5%
   - 3 Friction Filters: $\le 0.15, \le 0.10, \le 0.08$
   - 3 Regime Filters: M0 (none), M1 (ATR>40% + Trend), M2 (ATR>60% + Trend)
2. **In-Sample DEV Walk-Forward**: Evaluated on bars before `2024-05-01 UTC`. Top candidate: **Variant #2** (R0, Top 20%, 0.15 Filter, ATR>40% + Trend) with Net R `+0.5823R`. However, because 4H is a slow timeframe, it produced only 38 DEV trades, failing the pre-registered minimum sample size requirement of 150 trades ($0 / 108$ met DEV sample size gates).
3. **Sealed Hold-Out Window (`2024-05-01` to `2026-10-31`)**:
   - Trades: 65
   - Gross Avg R: `+0.3423R`
   - Net Avg R (0.1144% Taker): **`+0.2814R`**
   - 95% Bootstrap CI: `[+0.0483, +0.5069]R`
   - Positive across 2024 (`+0.1694R`), 2025 (`+0.3832R`), and 2026 (`+0.3411R`).
4. **Honest Decision Rule**: Because sample size was 65 trades ($< 150$), 4H-B is formally classified in the Research Results table as **"No demonstrated edge (N < 150 trades)"** and is **NOT** wired into live background cron.

### Model Quality & Noise Analysis (`notebooks/model_quality_report.md` & `notebooks/leakage_audit.md`)
- **Leakage Audit**: A previous report showing `0.8923` AUC was audited in [`notebooks/leakage_audit.md`](notebooks/leakage_audit.md) and identified as **INVALID** due to backward lookback leakage in the target formula (`rolling(6)` on `shift(-1)`).
- **Audited Model AUC**: Under a strict 5-fold purged walk-forward cross-validation with an embargo equal to the trade horizon, the honest out-of-sample LightGBM AUC is **`0.5126`** (matching the production model card benchmarks of `0.514 - 0.524`), with a shuffled-label noise control of `0.5027` and lagged-feature control of `0.4987`.
- **Rule Baseline**: The rule-based trend baseline achieved **`0.5082`** AUC under the honest target (the previous `0.3676` was an artifact of the inverted leaky target).
- **Derivatives Features**: Adding funding rates and open interest does not improve out-of-sample AUC on 4H candles (`0.5118` vs `0.5126`), and were excluded from live models.

---

## 4. Security & Environment Configuration

- **Mandatory Secrets**: In production (`NODE_ENV=production`), the application throws a fatal configuration error if `AUTH_SECRET`, `AUTH_PASSWORD_HASH`, or `CRON_SECRET` is missing.
- **Edge Protection**: All API endpoints and quantitative execution terminals are gated behind signed HS256 JWT cookies with `HttpOnly: true` and `SameSite: lax`.
- **Scheduled Automation**: Background cron runners (`.github/workflows/cloud-cron.yml`) require `Authorization: Bearer <CRON_SECRET>`.

> [!CAUTION]
> **Credential Rotation Notice**: A historical password (`20102004`) was committed in git history prior to the JWT security overhaul. It must be treated as permanently compromised and purged via `git filter-repo`.
