# Pre-Registration: Round 2 Macro Overlays & Residual Edge Analysis

**Pre-registration Date:** 2026-11-07  
**Status:** SEALED PRIOR TO EXECUTION  
**Branch:** `feat/round2-residual-edge`  
**Execution Target:** `analysis/evaluate_round2_residual_edge.py`  
**Protocol Version:** 1.0 (Strict One-Run Protocol, No Post-Hoc Parameter Tuning)  

---

## 1. Overview & Research Objective

Prior intraday and sub-daily audits established that directional machine learning classifiers suffered severe fee drag and overfitting. This study investigates classical non-directional macro overlays on daily crypto series to determine whether they provide genuine independent statistical edge (residual alpha) beyond market beta or simply dampen volatility through lower systematic exposure.

We evaluate two classical overlays alongside baseline buy-and-hold across two liquid assets: **BTCUSDT** and **ETHUSDT**.

---

## 2. Strategies & Pre-Registered Specifications

All strategies execute daily at next-day open ($open_{t}$) using signals computed from daily close prices up to day $t-1$.

### 2.1 Strategy Universe (6 Pairs)
For each asset $\in \{\text{BTCUSDT}, \text{ETHUSDT}\}$:

1. **Strategy (a): Passive Buy-and-Hold (Baseline Benchmark)**
   - Target weight: $w_t = 1.0$ (100% fully invested long).
   - Rebalance turnover: zero (except initial entry).
   - Daily gross return: $R_t = \frac{close_t}{open_t} - 1$ (or close-to-close with next-open fill).

2. **Strategy (b): EWMA(0.94) Volatility Targeting**
   - Classical RiskMetrics continuous exponential volatility weighting with decay factor $\lambda = 0.94$.
   - Recursive variance calculation over daily log returns $r_k = \ln(close_k / close_{k-1})$:
     $$\sigma_t^2 = 0.94 \cdot \sigma_{t-1}^2 + 0.06 \cdot r_{t-1}^2$$
   - Annualized realized volatility (365-day crypto calendar):
     $$\sigma_{\text{ann}, t} = \sqrt{\sigma_t^2 \times 365}$$
   - Target annualized volatility: $\sigma_{\text{target}} = 40.0\%$ ($0.40$).
   - Raw weight:
     $$w_{\text{raw}, t} = \frac{\sigma_{\text{target}}}{\sigma_{\text{ann}, t}}$$
   - Constrained weight:
     $$w_t = \max\left(0.0, \min(1.0, w_{\text{raw}, t})\right)$$
   - Constraints: Long-only ($w_t \ge 0$), no leverage ($w_t \le 1.0$), cash earns $0.0\%$.

3. **Strategy (c): 200-Day Simple Moving Average Trend Filter**
   - Simple moving average of daily close:
     $$\text{SMA}_{200, t-1} = \frac{1}{200}\sum_{i=1}^{200} close_{t-i}$$
   - Binary exposure rule:
     $$w_t = \begin{cases} 1.0 & \text{if } close_{t-1} > \text{SMA}_{200, t-1} \\ 0.0 & \text{if } close_{t-1} \le \text{SMA}_{200, t-1} \end{cases}$$
   - When $w_t = 0.0$, capital is held 100% in cash ($0.0\%$ return).

---

## 3. Friction Schedules & Cost Tiers

Daily rebalancing incurs transaction friction applied to absolute weight turnover $\Delta w_t = |w_t - w_{t-1}|$:
$$\text{Cost}_t = \Delta w_t \times \text{friction}$$

We test under two pre-registered cost schedules:
1. **Primary Evaluation Tier (50 bps Round-Trip):**
   - $0.005000$ ($50\text{ bps}$) total round-trip friction applied to rebalancing turnover ($25\text{ bps}$ per leg).
2. **Sensitivity Benchmark Tier (25 bps Round-Trip):**
   - $0.002500$ ($25\text{ bps}$) round-trip friction ($12.5\text{ bps}$ per leg).

---

## 4. Dataset Partitioning & Strict OOS Boundary

- **Exploratory Historical Sample:** Inception (`2020-01-01`) through `2026-10-31`.
  - All data up to `2026-10-31` is formally classified as **exploratory** due to prior model inspection and exploratory trend studies on BTC/ETH.
- **Clean Out-of-Sample (OOS) Testing Window:** Strictly dates **after 2026-10-31** (`> 2026-10-31`).
  - Only performance after October 31, 2026 serves as valid out-of-sample confirmation.

---

## 5. Quantitative Evaluation Metrics

For each strategy and asset:
1. **Net Annualized Return:** Compound annual growth rate (CAGR) after transaction friction.
2. **Maximum Drawdown (MaxDD):** Maximum peak-to-trough decline in cumulative equity ($0\%$ to $-100\%$).
3. **Sharpe Ratio (Annualized):** Assuming zero risk-free rate ($r_f = 0.0\%$):
   $$\text{Sharpe} = \frac{\bar{R}_{\text{net}}}{\text{std}(R_{\text{net}})} \times \sqrt{365}$$
4. **Residual-Edge Regression (vs. Buy-and-Hold):**
   Ordinary Least Squares (OLS) regression of daily strategy net returns against daily buy-and-hold returns:
   $$R_{\text{strategy}, t} = \alpha + \beta \cdot R_{\text{B\&H}, t} + \epsilon_t$$
   - **Annualized Alpha ($\alpha_{\text{ann}}$):** $\alpha \times 365$.
   - **HAC Standard Errors:** Heteroskedasticity and Autocorrelation Consistent (Newey-West) covariance estimation with lag truncation $L = 20$ days.
   - **Beta ($\beta$):** Systematic market exposure.
   - **$R^2$:** Variance explained by passive market beta.

---

## 6. Statistical Hypothesis Testing & Multiple Comparisons

- **Stationary Block Bootstrap:**
  - Block length: $L = 20$ days.
  - Number of bootstrap resamples: $B = 1,000$.
- **Multiple Testing Family & Bonferroni Correction:**
  - Total hypothesis tests: 2 active overlay strategies $\times$ 2 assets (BTC, ETH) = **4 primary test pairs** (or 6 across all asset/strategy combinations).
  - Bonferroni family size: $M = 6$.
  - Adjusted significance level:
    $$\alpha_{\text{Bonf}} = \frac{0.05}{6} \approx \mathbf{0.00833}$$
  - Evaluated via $99.167\%$ confidence intervals (two-sided, bounds $[0.417\%, 99.583\%]$).

---

## 7. Pre-Registered Decision Rule (Success vs. Failure)

A strategy counts as having a statistically valid, useful quantitative edge if and only if:
1. **Drawdown Condition:** $\text{MaxDD}_{\text{strategy}} < \text{MaxDD}_{\text{B\&H}}$ (lower peak-to-trough drawdown than buy-and-hold).
2. **Residual Edge Condition:** The Bonferroni block-bootstrap confidence interval of residual alpha ($\alpha_{\text{ann}}$) strictly excludes zero ($\text{CI}_{\text{lower}} > 0$).

### Mandatory Reporting Classifications:
- If a strategy achieves lower drawdown than buy-and-hold BUT its residual alpha CI includes zero or is negative:
  - **Verdict:** Formally reported as **"Risk Reduction / Beta Scaling"** (NOT "Edge" or "Alpha").
- If residual alpha CI includes zero and drawdown is worse or equal:
  - **Verdict:** **"No Edge"**.
- If both conditions pass:
  - **Verdict:** **"Independent Residual Edge Confirmed"**.

---

## 8. Execution Constraint

- **Strict One-Run Protocol:** This document is committed prior to running any execution scripts on branch `feat/round2-residual-edge`. No parameters, formulas, or decision rules may be altered after execution.


---

## 9. Amendment 1 (2026-11-07)

1. **Family Size & Bonferroni Correction ($M = 4$ Tests):**
   - The primary statistical testing family consists of exactly **4 active overlay tests**:
     1. EWMA(0.94) Volatility Targeting on BTCUSDT
     2. 200-Day SMA Trend Filter on BTCUSDT
     3. EWMA(0.94) Volatility Targeting on ETHUSDT
     4. 200-Day SMA Trend Filter on ETHUSDT
   - Passive Buy-and-Hold is the benchmark / baseline control, NOT a hypothesis test.
   - Pre-registered Bonferroni significance threshold:
     $$\alpha_{\text{Bonf}} = \frac{0.05}{4} = \mathbf{0.0125}$$
     Evaluated via $98.75\%$ confidence intervals (two-sided, bounds $[0.625\%, 99.375\%]$).

2. **Data Partitioning & ETH Data Alignment:**
   - All daily bars up to and including **2026-10-31** are formally declared **exploratory**, including ETH daily bars spanning `2026-10-27` through `2026-10-31`.
   - Data strictly **after 2026-10-31** (`> 2026-10-31`) constitutes the sealed clean confirmatory dataset.

3. **Stage X (Exploratory Run Protocol):**
   - Exactly one evaluation run on data up to and including `2026-10-31`.
   - Results from Stage X are strictly descriptive (reporting historical net CAGR, MaxDD, Sharpe, turnover, and beta-adjusted residual alpha).
   - No confirmatory edge verdict can be declared from Stage X results.

4. **Stage Y (Confirmatory Run Protocol):**
   - Exactly one confirmatory evaluation run.
   - Stage Y execution may take place **earliest on 2027-11-01**, and **only** when at least 365 daily bars have accumulated after `2026-10-31` ($n \ge 365$).
   - Until that date and sample size hurdle are reached, post-2026-10-31 daily data is strictly stored and archived, but never analyzed or inspected.

5. **Execution Physics & Risk Safeguards:**
   - Signals computed at the daily close of day $t$; position applied from next day $t+1$ (open fill).
   - Friction charged strictly on rebalancing turnover: $\text{Cost}_t = |w_{t+1} - w_t| \times \text{friction}$.
   - Leverage cap: strictly $w_t \le 1.0\times$ (no leverage under any condition).
   - Long-only constraint: strictly $w_t \ge 0.0$ (no shorting; non-invested balance held in $0.0\%$ cash).

6. **Additional Friction Sensitivity Tier (India 1% TDS / 100 bps):**
   - Added a **100 bps round-trip ($0.0100$)** friction sensitivity tier representing Indian statutory $1\%$ Tax Deducted at Source (TDS) under Section 194S on gross crypto transfers.
   - This 100 bps row is **reported-only for friction stress-testing** and is not part of the primary pass/fail decision rule.


---

## 10. Amendment 2 (2026-11-07)

1. **Family Size & Prereg Round 2 Replacement ($M = 4$ Active Overlays):**
   - This specification formally replaces Section 6: the family size is strictly $M = 4$ active overlay tests (EWMA(0.94) on BTC, SMA(200) on BTC, EWMA(0.94) on ETH, SMA(200) on ETH).
   - Hypotheses H1 and H2 from `docs/prereg/prereg_round2.md` are formally superseded and replaced by the specifications in this document.
   - Hypothesis H3 (50/50 BTC/ETH monthly rebalance) is permanently dropped and will not be run.
   - Zero code, zero results files, and zero backtest runs ever existed for H1, H2, or H3.

2. **One-Way Turnover Cost Accounting:**
   - Transaction friction is defined per unit of one-way turnover $|\Delta w_t| = |w_t - w_{t-1}|$:
     $$\text{Cost}_t = |\Delta w_t| \times \frac{\text{friction}}{2}$$
   - Pre-registered fee schedules:
     - **Primary Tier:** 25 bps round-trip ($12.5\text{ bps}$ per unit turnover, $\frac{\text{friction}}{2} = 0.00125$).
     - **Sensitivity Benchmark:** 12.5 bps round-trip ($6.25\text{ bps}$ per unit turnover, $\frac{\text{friction}}{2} = 0.000625$).
     - **Reported TDS Stress Tier:** 50 bps round-trip ($25\text{ bps}$ per unit turnover, or $1\%$ statutory TDS on sales/turnover, $\frac{\text{friction}}{2} = 0.0025$).

3. **Return Accounting Convention (Close-to-Close):**
   - Portfolio exposure $w_t$ determined at the daily close of day $t$ earns the close-to-close return of day $t+1$:
     $$R_{\text{gross}, t+1} = w_t \cdot \left(\frac{close_{t+1}}{close_t} - 1\right)$$
   - Exactly the same close-to-close convention applies to the buy-and-hold baseline ($w_t \equiv 1.0$).

4. **Warm-Up Period & Variance Seeding:**
   - The first 200 daily bars ($t = 0 \dots 199$) serve as a mandatory warm-up window to initialize the 200-day SMA and stabilize EWMA recursions.
   - The first 200 bars are **strictly excluded from all performance and statistical evaluation metrics** across ALL strategies, including the buy-and-hold benchmark.
   - The EWMA recursion is seeded at bar $t = 30$ using the sample variance of the first 30 daily log returns:
     $$\sigma_{29}^2 = \frac{1}{29} \sum_{k=1}^{29} (r_k - \bar{r}_{0:29})^2$$

5. **Decision vs. Reporting Inference:**
   - The primary pass/fail decision rule is evaluated strictly against the **stationary block bootstrap confidence interval** ($L = 20$, $B = 1,000$) of annualized residual alpha $\alpha_{\text{ann}}$ at the Bonferroni significance level $\alpha_{\text{Bonf}} = \frac{0.05}{4} = 0.0125$ ($98.75\%$ CI).
   - Parametric HAC (Newey-West, lag 20) standard errors are computed and reported alongside for transparency, but do not dictate the formal decision verdict.

6. **Role of External `residual-edge-analyzer`:**
   - The external skill script `analyze_residual_edge.py` is utilized solely as a cross-check on synthetic test datasets with known synthetic alpha and beta before any real evaluation run.
   - The in-repo script `analysis/evaluate_round2_residual_edge.py` is the sole canonical implementation.

7. **Stage Y Power & Drawdown Caveats:**
   - With an evaluation window of approximately 365 daily bars, a non-significant null finding ($\text{CI}$ covering zero) must be formally categorized as **"Inconclusive (Underpowered)"**, not as definitive evidence of "No Edge".
   - If the baseline buy-and-hold maximum peak-to-trough drawdown over the Stage Y window is less than $20\%$ ($\text{MaxDD}_{\text{B\&H}} > -0.20$), the drawdown reduction condition is formally classified as **"Not Testable (Insufficient Drawdown Regime)"**.
