# Pre-Registration Document: Non-Directional Macro Quantitative Research (Round 2)

> **Document Type:** Institutional Research Pre-Registration (Amended)  
> **Status:** PRE-REGISTERED & FROZEN (Committed prior to executing any code or inspecting test results)  
> **Repository:** Trader-Pro / Trader-Pro-Dashboard  
> **Branch:** `feat/cost-aware-engine`  
> **Initial Commit:** `6a5db05` (*docs: pre-register Round 2 macro research hypotheses with Bonferroni correction*)  
> **Amendment 1 Commit:** `prereg amendment 1, before any results`  
> **Date:** November 2026  
> **Primary Rule:** Zero parameter tuning, zero model searches, zero direction prediction. All rules, friction models, and statistical criteria are fixed in this document prior to execution.

---

## Amendment 1 Change Log (Pre-Execution Audit)

Prior to running any simulation code or loading evaluation data, this protocol is amended to incorporate six rigorous econometric and statistical controls:

1. **Stationary Block Bootstrap:** Replaced i.i.d. bootstrap with a stationary block bootstrap (fixed block length $L = 20$ days, $B = 10,000$ resamples) for all confidence intervals to account for return autocorrelation, volatility clustering, and serial dependence in daily financial time series.
2. **Exposure-Matched Cash Control (H1 & H2):** Added an exposure-matched benchmark blending buy-and-hold with cash at the strategy's average exposure $\bar{w}$. Direct comparison to 100% buy-and-hold confounds reduced beta with alpha. Added the beta-adjusted residual alpha $t$-statistic ($\alpha_{\text{ann}}$ with Newey-West HAC standard errors, annualization 365).
3. **Unified Pass Rule:** MaxDD is strictly descriptive. "Lower drawdown without a statistically significant Sharpe gain" is formally classified as **"risk reduction, not alpha"** and is **NOT a pass**. A hypothesis passes if and only if the Bonferroni block-bootstrap CI lower bound of $\Delta\text{Sharpe} > 0$.
4. **Data Contamination Disclosure & Test Count Recomputation:** The `2024-01-01` to `2026-10-31` period is formally declared **NOT clean out-of-sample** because the previous Donchian 20/10 daily trend studies on BTC and ETH inspected the full history through October 2026. Counting the 2 earlier Donchian tests brings the cumulative macro family count to $M = 3 + 2 = 5$ tests, updating the Bonferroni significance hurdle to $\alpha_{\text{adj}} = 0.05 / 5 = 0.010$ ($99.00\%$ CI, bounds $[0.50\%, 99.50\%]$), evaluated alongside the baseline 3-test $98.33\%$ CI ($[0.833\%, 99.167\%]$).
5. **Unified Cost Model & Cash Baseline:** All performance metrics must be reported under both **Tier 1 Base (7.0 bps per side / 14.0 bps round-trip, 0.0014)** and **Tier 2 Punishing (25.0 bps per side / 50.0 bps round-trip, 0.0050)** applied to rebalancing turnover. The risk-free rate is set to $r_f = 0.0\%$ and cash return to $r_{\text{cash}} = 0.0\%$.
6. **H3 Benchmark Selection Bias & Overlapping Dates:** Documented the post-hoc selection bias inherent in comparing against $\max(\text{Sharpe}_{\text{BTC}}, \text{Sharpe}_{\text{ETH}})$ (winner's curse). Truncated multi-coin evaluation strictly to the BTC/ETH overlapping date window: `2020-01-01` to `2026-10-26` (2,491 daily bars).

---

## 1. Research Motivation & Core Principles

Prior quantitative audits in this repository demonstrated that high-frequency directional classifiers (15M, 1H, 4H LightGBM breakout models) failed due to lookahead label leaks, execution simulator bias, and catastrophic exchange fee drag ($0.28\text{R} - 0.50\text{R}$ friction on sub-0.5% stops). Furthermore, residual edge analysis proved that apparent gross gains in simple daily breakout rules were almost entirely systematic market beta ($\beta \approx 0.42 - 0.44$), yielding statistically insignificant alpha ($t_{\alpha} < 1.25$).

This research round deliberately abandons directional predictive modeling. Instead, it tests **three classical non-directional / macro systematic portfolio rules** designed to manage risk, dampen tail drawdowns, and harvest diversification return.

---

## 2. Pre-Registered Hypotheses (Exactly 3)

### Hypothesis 1 (H1): Volatility-Targeted BTC Exposure
- **Hypothesis Statement:** Scaling continuous daily exposure inversely to trailing realized volatility dampens catastrophic drawdowns without degrading risk-adjusted return (Sharpe ratio) compared to passive BTC buy-and-hold and an exposure-matched cash blend.
- **Exact Parameters (Fixed, No Search):**
  - **Target Volatility:** $\sigma_{\text{target}} = 40.0\%$ annualized ($0.40$).
  - **Realized Volatility Metric:** Trailing 30-day standard deviation of daily log returns, annualized using 365 days (crypto calendar):
    $$\sigma_{\text{realized}, t-1} = \text{std}(\ln(close_{t-30:t-1} / close_{t-31:t-2})) \times \sqrt{365}$$
  - **Position Weight:**
    $$w_t = \min\left(1.0, \frac{\sigma_{\text{target}}}{\sigma_{\text{realized}, t-1}}\right)$$
  - **Constraints:** Long-only ($w_t \ge 0.0$), maximum $1.0\times$ notional (no leverage), remainder $(1 - w_t)$ held in cash ($r_{\text{cash}} = 0.0\%$).
  - **Rebalance Frequency:** Daily at candle close of $t-1$, executed at open of day $t$.
- **Cost Model:**
  - Execution strictly at next-day open ($open[t]$).
  - Evaluated at both **$14\text{ bps}$** ($0.0014$) and **$50\text{ bps}$** ($0.0050$) applied to the daily rebalancing turnover $|w_t - w_{t-1}|$.
  - Funding rates: Spot holding assumption (funding ignored).
  - Risk-free rate: $r_f = 0.0\%$; Cash return: $r_{\text{cash}} = 0.0\%$.
- **Benchmarks & Controls:**
  1. **Passive BTC Buy-and-Hold (100% Long):** $R_{\text{B\&H}, t} = \frac{close_t}{open_t} - 1$ (or close-to-close with next-open entry).
  2. **Exposure-Matched Control:** Blended buy-and-hold with cash at the strategy's exact mean historical exposure $\bar{w} = \frac{1}{T}\sum_{t=1}^T w_t$:
     $$R_{\text{control}, t} = \bar{w} \cdot R_{\text{B\&H}, t} + (1 - \bar{w}) \cdot 0.0$$
  3. **Beta-Adjusted Residual Alpha:** Regress daily strategy net returns against BTC buy-and-hold returns:
     $$R_{\text{H1}, t} = \alpha + \beta R_{\text{B\&H}, t} + \epsilon_t$$
     Annualized alpha $\alpha_{\text{ann}} = \alpha \times 365$. Report $\alpha_{\text{ann}}$, beta $\beta$, $R^2$, and Newey-West HAC $t$-statistic ($t_{\alpha}$, 20-day lag bandwidth).
- **Descriptive Metrics:** Maximum Drawdown ($\text{MaxDD}_{\text{H1}}$ vs $\text{MaxDD}_{\text{B\&H}}$ vs $\text{MaxDD}_{\text{control}}$), Total Return, Annualized Volatility, Calmar Ratio.
- **Unified Statistical Pass Gate:**
  - The lower bound of the Bonferroni-adjusted block-bootstrap CI (10,000 resamples, 20-day block length) of $\Delta\text{Sharpe} = \text{Sharpe}_{\text{H1}} - \text{Sharpe}_{\text{B\&H}}$ must be strictly $> 0.0$.
  - Lower drawdown without a significant Sharpe gain is classified as **"risk reduction, not alpha"** and is **NOT a pass**.

---

### Hypothesis 2 (H2): Daily 200-Day SMA Trend Overlay
- **Hypothesis Statement:** Conditioning spot BTC market exposure on whether price trades above its 200-day simple moving average eliminates extended bear market drawdowns while preserving or improving risk-adjusted return.
- **Exact Parameters (Fixed, No Search):**
  - **Trend Indicator:** 200-day Simple Moving Average on daily closing prices:
    $$\text{SMA}_{200}(t-1) = \frac{1}{200}\sum_{i=1}^{200} close_{t-i}$$
  - **Signal Rule:**
    - If $close_{t-1} > \text{SMA}_{200}(t-1) \implies w_t = 1.0$ (100% Long).
    - If $close_{t-1} \le \text{SMA}_{200}(t-1) \implies w_t = 0.0$ (100% Cash, $r_{\text{cash}} = 0.0\%$).
  - **No Search:** Classical 200-day period. Zero parameter sweeping or optimization.
- **Cost Model:**
  - Execution strictly at next-day open ($open[t]$).
  - Evaluated at both **$14\text{ bps}$** ($0.0014$) and **$50\text{ bps}$** ($0.0050$) applied on full entry ($|w_t - w_{t-1}| = 1.0$) and exit.
  - Funding rates: Spot holding assumption (funding ignored).
  - Risk-free rate: $r_f = 0.0\%$; Cash return: $r_{\text{cash}} = 0.0\%$.
- **Benchmarks & Controls:**
  1. **Passive BTC Buy-and-Hold (100% Long):** $R_{\text{B\&H}, t}$.
  2. **Exposure-Matched Control:** Blended buy-and-hold with cash at the strategy's exact mean historical exposure $\bar{w} = \frac{1}{T}\sum_{t=1}^T w_t$:
     $$R_{\text{control}, t} = \bar{w} \cdot R_{\text{B\&H}, t} + (1 - \bar{w}) \cdot 0.0$$
  3. **Beta-Adjusted Residual Alpha:** Regress daily strategy net returns against BTC buy-and-hold returns:
     $$R_{\text{H2}, t} = \alpha + \beta R_{\text{B\&H}, t} + \epsilon_t$$
     Annualized alpha $\alpha_{\text{ann}} = \alpha \times 365$. Report $\alpha_{\text{ann}}$, beta $\beta$, $R^2$, and Newey-West HAC $t$-statistic ($t_{\alpha}$, 20-day lag bandwidth).
- **Descriptive Metrics:** Maximum Drawdown ($\text{MaxDD}_{\text{H2}}$ vs $\text{MaxDD}_{\text{B\&H}}$ vs $\text{MaxDD}_{\text{control}}$), Total Return, Annualized Volatility, Calmar Ratio.
- **Unified Statistical Pass Gate:**
  - The lower bound of the Bonferroni-adjusted block-bootstrap CI (10,000 resamples, 20-day block length) of $\Delta\text{Sharpe} = \text{Sharpe}_{\text{H2}} - \text{Sharpe}_{\text{B\&H}}$ must be strictly $> 0.0$.
  - Lower drawdown without a significant Sharpe gain is classified as **"risk reduction, not alpha"** and is **NOT a pass**.

---

### Hypothesis 3 (H3): BTC + ETH Equal-Weight Portfolio (Monthly Rebalanced)
- **Hypothesis Statement:** A 50/50 equal-weighted portfolio of BTC and ETH rebalanced monthly generates a diversification rebalancing bonus that achieves a higher net Sharpe ratio than the better single asset alone.
- **Exact Parameters (Fixed, No Search):**
  - **Assets:** BTCUSDT and ETHUSDT.
  - **Target Weights:** $w_{\text{BTC}} = 0.50$, $w_{\text{ETH}} = 0.50$.
  - **Rebalance Cadence:** Monthly on the first day of each calendar month.
  - **Intramonth Drift:** Weights drift naturally with daily asset returns between monthly rebalance points:
    $$w_{i, t} = \frac{w_{i, t-1}(1 + R_{i, t})}{\sum_j w_{j, t-1}(1 + R_{j, t})}$$
- **Data Alignment & Overlapping Dates:**
  - Analysis is strictly restricted to the **overlapping date range** of the BTC and ETH daily parquet files:
    $$\text{Date Window: } \mathbf{2020-01-01} \text{ to } \mathbf{2026-10-26} \quad (N = 2,491 \text{ days})$$
  - The 5 trailing days in BTC parquet (Oct 27–31, 2026) where ETH data is absent are strictly excluded from H3.
- **Cost Model:**
  - Rebalance trades executed at open of the first day of each calendar month.
  - Evaluated at both **$14\text{ bps}$** ($0.0014$) and **$50\text{ bps}$** ($0.0050$) applied to two-way rebalance turnover:
    $$\text{Turnover}_t = \frac{1}{2}\left(|w_{\text{BTC}, \text{target}} - w_{\text{BTC}, t-}| + |w_{\text{ETH}, \text{target}} - w_{\text{ETH}, t-}|\right)$$
  - Funding rates: Spot holding assumption (funding ignored).
  - Risk-free rate: $r_f = 0.0\%$; Cash return: $r_{\text{cash}} = 0.0\%$.
- **Benchmark Selection Bias Disclosure:**
  - Evaluating against $\max(\text{Sharpe}_{\text{BTC}}, \text{Sharpe}_{\text{ETH}})$ post-hoc introduces selection bias (winner's curse), as the benchmark asset is chosen with full hindsight of the entire sample.
  - To provide complete transparency, H3 is reported against:
    1. BTC Buy-and-Hold over the identical overlapping window.
    2. ETH Buy-and-Hold over the identical overlapping window.
    3. The ex-post maximum $\max(\text{Sharpe}_{\text{BTC}}, \text{Sharpe}_{\text{ETH}})$.
- **Descriptive Metrics:** Maximum Drawdown ($\text{MaxDD}_{\text{H3}}$ vs BTC vs ETH), Total Return, Annualized Volatility, Calmar Ratio.
- **Unified Statistical Pass Gate:**
  - The lower bound of the Bonferroni-adjusted block-bootstrap CI (10,000 resamples, 20-day block length) of $\Delta\text{Sharpe} = \text{Sharpe}_{\text{H3}} - \max(\text{Sharpe}_{\text{BTC}}, \text{Sharpe}_{\text{ETH}})$ must be strictly $> 0.0$.
  - Lower drawdown without a significant Sharpe gain is classified as **"risk reduction, not alpha"** and is **NOT a pass**.

---

## 3. Statistical Inference & Stationary Block Bootstrap

### Why i.i.d. Bootstrap is Invalid for Returns
Daily cryptocurrency returns exhibit significant serial correlation, volatility clustering (ARCH/GARCH dynamics), and regime persistence. Resampling individual return days independently (i.i.d. bootstrap) destroys this temporal dependence, artificially compressing standard errors and inflating statistical significance.

### Stationary Block Bootstrap Specification
All confidence intervals in Round 2 are constructed using a **stationary block bootstrap** (Politis & Romano, 1994) with a fixed block length parameter:
- **Block Length ($L$):** Fixed at **20 days** (approximately one trading month, matching autocorrelation decay).
- **Number of Resamples ($B$):** Exactly **10,000 resamples**.
- **Paired Resampling:** Resampling indices are drawn jointly across the strategy and benchmark return series to preserve contemporaneous correlation.
- **Annualization:** All resampled annualizations strictly use 365 days ($\sqrt{365}$ for volatility, $365$ for return scaling).

### Unified Pass Rule Across All Hypotheses
A hypothesis is considered statistically validated if and only if:
$$\text{CI}_{\text{lower}}(\Delta\text{Sharpe}) > 0.0$$
where $\Delta\text{Sharpe} = \text{Sharpe}_{\text{Strategy}} - \text{Sharpe}_{\text{Benchmark}}$, computed at the Bonferroni-adjusted confidence level.

> **Crucial Classification Rule:**  
> Maximum Drawdown ($\text{MaxDD}$) is strictly a descriptive risk metric. If a hypothesis achieves lower drawdown than the benchmark but fails the Sharpe gain gate ($\text{CI}_{\text{lower}} \le 0.0$), the result is formally classified as **"risk reduction, not alpha"** and is **NOT a pass**.

---

## 4. Multiple Testing Correction & Data Contamination Disclosure

### Data Contamination Audit
The time series window from `2024-01-01` to `2026-10-31` is **NOT a clean out-of-sample dataset**.
- **Audit Fact:** In previous phases of this repository, the Donchian 20/10 daily breakout rule was evaluated on BTC and ETH daily parquet files across the full period from `2020-01-01` through `2026-10-31` (BTC) and `2026-10-26` (ETH).
- **Consequence:** Researchers have already observed price paths, volatility regimes, and drawdown cycles across 2024–2026. This period cannot be treated as an unblemished hold-out. It must be reported as an in-sample / contaminated observation window.

### Family-Wise Error Rate (FWER) & Recomputed Bonferroni Threshold
To maintain strict statistical integrity, the hypothesis family count must include all macro daily rules evaluated on this dataset:
- Earlier Donchian daily tests: **2** (BTC Donchian 20/10, ETH Donchian 20/10).
- Round 2 new hypotheses: **3** (H1, H2, H3).
- **Cumulative Macro Hypothesis Family Count:** $M = 3 + 2 = \mathbf{5}$ tests.

To hold the Family-Wise Error Rate at $\alpha_{\text{FWER}} = 0.05$:
$$\alpha_{\text{adj}} = \frac{0.05}{M} = \frac{0.05}{5} = \mathbf{0.010} \quad (1.00\%)$$

### Operational Confidence Interval Percentile Cutoffs:
- **Primary Unified Gate ($M = 5$ tests):** **$99.00\%$ two-sided block-bootstrap CI** ($1 - 0.010$).
  - Lower percentile cutoff: **`0.50%`**
  - Upper percentile cutoff: **`99.50%`**
  - **Pass Threshold:** The **$0.50^{\text{th}}$ percentile of $\Delta\text{Sharpe} > 0.0$**.
- **Secondary Baseline ($M = 3$ tests):** **$98.33\%$ two-sided block-bootstrap CI** ($1 - 0.01667$).
  - Lower percentile cutoff: **`0.833%`**
  - Upper percentile cutoff: **`99.167%`**
  - Evaluated alongside the primary gate for direct traceability to initial pre-registration.

---

## 5. Execution Invariants & Summary Table

| Parameter / Invariant | Value | Rationale |
| :--- | :--- | :--- |
| **Calendar Year** | 365 days ($\sqrt{365}$) | Continuous crypto market operation; equity 252 forbidden. |
| **Risk-Free Rate ($r_f$)** | $0.0\%$ | Standard crypto spot benchmark. |
| **Cash Return ($r_{\text{cash}}$)** | $0.0\%$ | Unallocated balance earns zero yield. |
| **Execution Price** | $open[t]$ (Next-day open) | Eliminates same-bar close execution bias. |
| **Friction Tier 1 (Base)** | 7.0 bps per side / 14.0 bps round-trip (0.0014) | Institutional VIP taker benchmark. |
| **Friction Tier 2 (Punishing)** | 25.0 bps per side / 50.0 bps round-trip (0.0050) | Retail taker + spread + rebalance slippage stress test. |
| **Bootstrap Method** | Stationary Block Bootstrap | Preserves serial correlation and volatility clustering. |
| **Bootstrap Block Length** | $20\text{ days}$ | Captures trailing monthly return dependency. |
| **Bootstrap Resamples** | $10,000$ draws | High-precision tail percentile estimation. |
| **H3 Date Range** | `2020-01-01` to `2026-10-26` | Strict BTC/ETH overlapping dates ($N = 2,491$ days). |
| **Control Benchmark (H1, H2)** | Cash-blended B&H at $\bar{w}$ | Isolates true market timing/sizing alpha from lower beta. |
| **Residual Alpha** | OLS with Newey-West HAC | Beta-adjusted $\alpha_{\text{ann}}$ ($t_{\alpha}$ with 20-day lag bandwidth). |
| **Drawdown Role** | Descriptive only | "Lower MaxDD without Sharpe gain" = Risk reduction, not alpha. |
