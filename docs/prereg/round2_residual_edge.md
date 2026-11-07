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
