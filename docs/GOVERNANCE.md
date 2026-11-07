# Quantitative Research Governance & Code Safety Protocols

> **Canonical Document**: `docs/GOVERNANCE.md`  
> **Status**: Mandatory Permanent Invariant  
> **Audience**: All quant researchers, engineering contributors, and autonomous agent instances working on `Trader-Pro-Dashboard`.

---

## 1. The Frozen 1H-A Executor Protocol

The file `src/lib/paperExecutor1HA.ts` and its associated static metadata under `src/models/1h/` are permanently **FROZEN** by decree of the quantitative audit committee.

### Governance Invariants
1. **Zero Modification Allowed**:
   - No engineer, script, formatter, or LLM agent is ever permitted to edit, reformat, rename, or delete `src/lib/paperExecutor1HA.ts`.
   - Even comments, whitespaces, or import reorganizations are strictly prohibited.
2. **Cryptographic Hash Verification**:
   - The SHA-256 hash of `src/lib/paperExecutor1HA.ts` must permanently match:
     ```text
     C1DE3359D29A4B4C6BFB3662A65C2ABF5DD4001052BDF6CAA1A7AA50FB8B33A8
     ```
   - Before starting and immediately after finishing any development task, the following command must be executed and verified:
     ```powershell
     Get-FileHash D:\Projects_Main\Trade-Pro\Trader-Pro-Dashboard\src\lib\paperExecutor1HA.ts -Algorithm SHA256
     ```
   - If the hash differs by even one bit, the repository is in an invalid state and all work must halt immediately until reverted.

---

## 2. Mandatory Pre-Registration Protocol (`docs/prereg/`)

To prevent post-hoc hypothesis generation, p-hacking, and backtest overfitting, **no historical evaluation or model training may be executed on uncommitted rules**.

### Rules for Proposing New Strategies
1. **Pre-Registration File Creation**:
   - Before running a single backtest or training script, create a formal markdown document in `docs/prereg/` (e.g., `docs/prereg/swing_4h_metalabel.md`).
2. **Required Specifications**:
   - **Candidate Universe**: Specific ticker list (e.g., `["BTCUSDT", "ETHUSDT", "SOLUSDT"]`).
   - **Data Frequency & Interval**: Primary execution candle cadence (e.g., 4H, Daily).
   - **Exact Feature List**: Full definitions of mathematical transformations without discretionary parameters.
   - **Barrier Rules**: Upper barrier ($+R_{\text{target}}$), lower barrier ($-R_{\text{stop}}$), and vertical time barrier (number of bars).
   - **Fee Tier Assumptions**: Round-trip transaction cost schedule (standard, stress, TDS).
   - **Statistical Edge Criteria**: Exact minimum sample size ($N \ge 100$), minimum net Sharpe, and family-wise error control ($\alpha$).
3. **Commit Invariant**:
   - The pre-registration document must be committed to git **alone** before any evaluation script or training run begins.

---

## 3. Clean Window & Hold-Out Data Policy

An audit finding revealed that legacy models had been trained through **October 26, 2026**, permanently contaminating historical datasets through late 2026.

### The Two-Window Doctrine

```text
+------------------------------------------+------------------------------------------+
|            HISTORICAL WINDOW             |           CLEAN FORWARD WINDOW           |
|         (Data <= 2026-10-31)             |           (Data >= 2026-11-01)           |
+------------------------------------------+------------------------------------------+
| - Status: EXPLORATORY ONLY               | - Status: CONFIRMATORY HOLD-OUT          |
| - Used for feature engineering, model    | - Strictly embargoed from model training |
|   training, and Stage X sanity checks.   |   and hyperparameter tuning.             |
| - CANNOT BE USED FOR PRODUCTION DECISION | - Live paper trading only.               |
+------------------------------------------+------------------------------------------+
```

### Production Deployment Gate
To promote any strategy to real capital execution:
1. **Minimum Sample Size**: At least **$N \ge 50$ completed out-of-sample forward paper trades** recorded strictly in the clean window ($\ge \text{2026-11-01}$).
2. **Positive Net Expectancy**:
   $$\hat{E}[R_{\text{net}}] > 0.00\text{R}$$
3. **Statistical Confidence**:
   - The lower bound of the block-bootstrapped 95% confidence interval of net R must strictly exceed zero:
     $$\text{CI}_{95\%}^{\text{lower}}(\text{Net R}) > 0.00\text{R}$$
4. **Friction Ceiling**:
   - Every executed trade must satisfy $\text{cost\_R} \le 0.08\text{R}$.

---

## 4. Secret & Credential Safety

1. **Zero Secret Leakage**:
   - Never print, log, or commit MongoDB URIs, JWT secrets, exchange API keys, or Telegram bot tokens.
2. **Environment Isolation**:
   - All credentials must be ingested exclusively via `process.env` in TypeScript and `os.environ` in Python.
3. **Mock Fallbacks in Test Suites**:
   - Unit tests must never connect to live MongoDB or execute unauthenticated external network requests without proper test sandboxing.
