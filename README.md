# Trader-Pro Quant: Autonomous Strategy Execution & Research Platform

> [!WARNING]
> **Pivoting to 4H / Daily Swing Meta-Labeling Architecture**  
> **Intraday 5m/15m paper trading is deprecated due to fee-drag exceeding stop size ($\text{cost}_R > 0.45\text{R}$). The repository is focused on 4H/1D macro regime filtering and volatility-targeted swing engines.**

Trader-Pro is an institutional-grade quantitative trading platform, research laboratory, and execution environment designed for cryptocurrency perpetual futures (BTCUSDT, ETHUSDT, SOLUSDT). Built with Next.js 14 App Router, TypeScript, TailwindCSS, MongoDB Atlas, and Python/LightGBM econometrics evaluators.

---

## 1. Development Status & Active Branches

| Branch | Status | Primary Purpose / Scope |
| :--- | :---: | :--- |
| `feat/daily-4h-swing-engine` | **ACTIVE** | **Primary R&D Branch**: 4H / Daily swing meta-labeling pipeline, triple-barrier labeling, leak-free feature extraction, and EWMA volatility-targeted position sizing. |
| `feat/round2-residual-edge` | **SEALED** | Canonical Round 2 Macro Overlays (200-SMA trend filter, EWMA vol target), HAC-adjusted residual edge regression, Stage X historical exploration. |
| `feat/cost-aware-1h` | **MAINTENANCE** | Cost-aware 1H execution engine with $\text{cost}_R \le 0.08$ gating, runtime fill slippage, sub-hour 5m stream evaluation, and live-price cron guards. |
| `feat/timesfm-benchmark` | **ARCHIVED** | Rigorous evaluation of Google TimesFM and Amazon Chronos foundation models against classic EWMA volatility baselines on 2024–2026 data. |
| `main` | **STABLE** | Production dashboard, verified security infrastructure, historical paper trade audits, and performance visualization. |

---

## 2. Paper Trading Executors

The repository maintains strict separation between frozen historical runners and active experimental engines:

1. **Frozen Setup 1H-A (`/api/cron/paper-1h-a`)**:
   - Implemented in [`src/lib/paperExecutor1HA.ts`](src/lib/paperExecutor1HA.ts).
   - **PERMANENTLY FROZEN**: Evaluates hourly close snapshots against fixed momentum/breakout heuristics.
   - **Cryptographic Invariant**: File SHA-256 must permanently equal `C1DE3359D29A4B4C6BFB3662A65C2ABF5DD4001052BDF6CAA1A7AA50FB8B33A8`.
   - Recorded 1,099+ forward paper trades.
2. **Cost-Aware 1H Engine (`/api/cron/paper-1h-cost`)**:
   - Implemented in [`src/lib/paperExecutor1HCost.ts`](src/lib/paperExecutor1HCost.ts) and [`src/app/api/cron/paper-1h-cost/route.ts`](src/app/api/cron/paper-1h-cost/route.ts).
   - Enforces mathematical identity $\text{cost}_R = \frac{\text{Round-Trip Friction Pct}}{\text{Stop Distance Pct}} \le 0.08$.
   - Executes live price entry, sequential 5m candle stream evaluation, exit candle close-time tracking, and `NO_LIVE_PRICE` safety aborts.
3. **Legacy Scalp Engine (`/api/cron/scalp`)**:
   - Implemented in [`src/lib/tradingEngine.ts`](src/lib/tradingEngine.ts).
   - **FORMALLY RETIRED**: 5m and 15m scalpers are halted for new entries due to negative net expectancy at live stop size. Existing trade records are preserved for quantitative research.

---

## 3. Exchange Friction & Fee Architecture

All performance metrics and research verdicts are evaluated under **real-world exchange friction** rather than idealized zero-fee backtests. 

Friction parameters are unified in [`src/lib/feeModel.ts`](src/lib/feeModel.ts):
- **Taker Base Fee**: `0.040%` per side (Shark Exchange standard rate)
- **Maker Base Fee**: `0.016%` per side (optimistic execution scenario)
- **Statutory GST**: `18.0%` applied on all exchange fees ($0.040\% \times 1.18 = 0.0472\%$ per side)
- **Bid-Ask Slippage**: `0.010%` per side for taker orders ($0.005\%$ for maker orders)
- **Standard Round-Trip Taker Friction**: **`0.1144%` of notional**

$$\text{cost}_R = \frac{\text{Round-Trip Friction Pct}}{\text{Stop Distance Pct}}$$

On narrow 5m/15m stops (0.25% to 0.40%), friction consumes $0.28\text{R}$ to $0.45\text{R}$ of risk capital on every round trip. On 4H/Daily swing stops (2.0% to 5.0%), friction drops to a negligible **$0.02\text{R}$ to $0.05\text{R}$**.

---

## 4. Risk Engine & Execution Safeguards

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

## 5. Documentation Suite

- [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md): Exhaustive breakdown of historical notebook training bugs (leaks, label distortion, global lookahead, optimistic fills).
- [`docs/RESEARCH_FINDINGS.md`](docs/RESEARCH_FINDINGS.md): Empirical results from Foundation Models (TimesFM/Chronos), intraday scalping audits, and Stage X macro overlays.
- [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md): Research integrity protocols, frozen executor rules, pre-registration mandates, and clean window policies.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): System architecture of the 4H/Daily Swing Meta-Labeling engine and risk engine.
- [`docs/LESSONS.md`](docs/LESSONS.md): Canonical quantitative lessons learned from extensive simulation audits.

---

## 6. Security & Environment Configuration

- **Mandatory Secrets**: In production (`NODE_ENV=production`), the application throws a fatal configuration error if `AUTH_SECRET`, `AUTH_PASSWORD_HASH`, or `CRON_SECRET` is missing.
- **Edge Protection**: All API endpoints and quantitative execution terminals are gated behind signed HS256 JWT cookies with `HttpOnly: true` and `SameSite: lax`.
- **Scheduled Automation**: Background cron runners (`.github/workflows/cloud-cron.yml`) require `Authorization: Bearer <CRON_SECRET>`.
- **Clean Ingestion**: Python data loaders accept configurable `DATA_ROOT` environment variables with zero hardcoded absolute drive paths.
