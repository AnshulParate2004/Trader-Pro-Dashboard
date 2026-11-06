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

### Comprehensive Edge Report (`analysis/EDGE_REPORT.md` & `analysis/SIMULATOR_BIAS_REPORT.md`)
> [!IMPORTANT]
> **SIMULATOR BIAS AUDIT NOTICE**: All historical backtest metrics below were generated with the earlier simulator, which credited an artificial $+0.05\text{R}$ on breakeven and armed ratchets in the same candle (yielding $+0.11\text{R}$ to $+0.13\text{R}$ on pure synthetic noise). Furthermore, model metadata inspection revealed that the production models were trained on data extending through **October 26, 2026** (`trained_until: 2026-10-26`), meaning all purported "hold-out" evaluations through October 2026 were **in-sample / not out-of-sample**. Under unbiased execution (Middle / Strict modes), **no setup keeps a positive net lower bound**.

| Model / Cadence | Trades (N) | Gross Avg R | True Win Rate | Net Avg R (Old Biased) | Net Avg R (Strict Unbiased) | Status & Audit Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **15m BTC Scalper** | 11,548 | `+0.0940R` | 55.6% | **`-0.0275R`** | **`-0.5670R`** | In-sample · SIMULATOR-BIASED, superseded |
| **5m BTC Scalper** | 11,420 | `+0.1007R` | 56.6% | **`-0.1426R`** | **`-0.6500R`** | In-sample · Fee Churn (Retired) |
| **1h Trend Setup** | 2,624 | `+0.1021R` | 56.2% | **`-0.0123R`** | **`-0.2928R`** | In-sample · SIMULATOR-BIASED, superseded |
| **4h Baseline** | 598 | `+0.1525R` | 59.0% | **`+0.0381R`** | **`-0.1078R`** | In-sample · SIMULATOR-BIASED, superseded |
| **Multi-Model Scalp** | 6,538 | `+0.1622R` | 62.0% | **`+0.0352R`** | **`-0.4850R`** | In-sample · SIMULATOR-BIASED, superseded |

### Setup 4H-B Research Protocol & Verdict (`notebooks/`)
1. **Pre-Registration**: Documented in [`notebooks/prereg_4H-B.md`](notebooks/prereg_4H-B.md).
2. **In-Sample DEV Walk-Forward**: Evaluated on bars before `2024-05-01 UTC`. Produced only 38 DEV trades, failing the pre-registered minimum sample size requirement of 150 trades ($0 / 108$ passed).
3. **Purported Hold-Out Window (`2024-05-01` to `2026-10-31`)**:
   - Trades: 65, Gross: `+0.3423R`, Net (Old Biased): `+0.2814R`
   - **Audit Verdict**: **In-sample / not out-of-sample**. The final model was trained until `2026-10-26`, contaminating the window. Under strict unbiased execution, net return drops to **`-0.1013R`** (95% CI `[-0.1963, -0.0033]R`). Window permanently burned.

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
