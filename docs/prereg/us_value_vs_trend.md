# Pre-Registration Protocol: US Equities Value vs. Trend Factor Analysis (2010–2026)
**Document ID:** `PREREG-US-VALUE-VS-TREND-V1`  
**Git Branch:** `feat/us-value-vs-trend` (forked from `fix/us-equities-followup`)  
**Commit Phase:** Phase 1 (Pre-Registration Locked Prior to Empirical Backtesting)  
**Timestamp:** `2026-11-12T10:30:00+05:30`  
**Execution Environment:** `D:\Projects_Main\Trade-Pro\Trader-Pro-Dashboard`  
**Methodological Standard:** SEC/CFA Quantitative Research Compliance, Zero Post-Hoc Tuning, Pre-Registered Factor Definitions, Bonferroni Multiple Testing Adjustment.

---

## 1. Executive Mandate & Pre-Commitment

This protocol pre-registers the empirical evaluation of systematic **Value**, **Trend (Momentum)**, and hybrid **Value + Trend** factor strategies within the US mega-cap equity universe across the 16-year period from January 2010 through October 2026.

### Governance Directives (Locked Prior to Backtest Execution)
1. **Pre-Registration Locking:** This document is authored and committed to Git prior to running backtests on the fundamental factor engine. No parameter tuning, threshold modification, or ranking formula alteration is permitted after viewing results.
2. **Zero Machine Learning / Black-Box Models:** All ranking and selection rules are explicit, closed-form quantitative factor definitions.
3. **Point-in-Time Data Integrity:** All fundamental variables (EPS, P/E, shares) are sourced exclusively from SEC XBRL filings using the official SEC filing date ($t_{\text{filed}} \le t_{\text{rebalance}}$), never the accounting period-end date.
4. **Friction & Capital Realism:** All simulations incorporate the institutional `equityFeeModel`: \$0.005/share brokerage commission (min \$1.00, cap 0.5% notional), 3.0 bps execution slippage, SEC Section 31 transaction fee, and FINRA Trading Activity Fee (TAF).
5. **No Fake Numbers:** All reported returns, drawdowns, alphas, and t-statistics must be directly calculated from data without imputation or synthetic smoothing.

---

## 2. Tested Hypotheses & Market Belief Audits

The quantitative study specifically subjects two pervasive retail/value-investor axioms to formal econometric scrutiny:

- **Belief 1 ("The Margin of Safety Fallacy"):** *"Undervalued stocks rarely fall more than 2–3%."*
  - *Empirical Test:* For every monthly cohort selected into Value (V) and Value-Trend (VT), compute the realized maximum drawdown from entry across three forward holding windows: 21 trading days (1 month), 63 trading days (1 quarter), and 252 trading days (1 year). Measure the empirical frequency of drawdowns breaching 3%, 10%, 20%, and 30%, benchmarked against equal-weight market and pure momentum cohorts.
- **Belief 2 ("The Asymmetric Upside Fallacy"):** *"They rocket if they go up."*
  - *Empirical Test:* Compute the proportion of selected names achieving $\ge 30\%$ total return within 12 months post-rebalance, together with the payoff ratio:
    $$\text{Payoff Ratio} = \frac{\mathbb{E}[\text{12-Month Gain} \mid \text{Gain} > 0]}{\mathbb{E}[|\text{Max Forward Drawdown}|]}$$
    Benchmarked directly against the broader universe and pure momentum cohorts.

---

## 3. Factor Architecture & Variant Specifications (Max 5 Variants)

The experiment evaluates exactly 4 active variants against benchmark series (B):

### Variant V: Pure Point-in-Time Value Composite
- **Universe:** Point-in-Time Top 30 US common equities by market capitalization at each monthly rebalance date $t$.
- **Ranking Engine:** Composite rank derived from three equally-weighted normalized sub-factors:
  1. **Historical Relative Valuation ($z_{\text{hist}}$):**
     $$\text{PE}_{\text{own\_z}} = \frac{\text{PE}_t - \mu_{\text{PE}, 5\text{y}}}{\sigma_{\text{PE}, 5\text{y}}}$$
     Calculated strictly over the trailing 5-year rolling history of point-in-time P/E using only prior reported data ($k \le t$). Lower P/E yields a higher value score:
     $$S_{\text{hist}} = - \text{PE}_{\text{own\_z}}$$
  2. **Cross-Sectional Sector Relative Valuation ($S_{\text{sector}}$):**
     $$\text{Rel\_PE}_{\text{sector}} = \frac{\text{PE}_{i, t} - \text{Median}(\text{PE}_{\text{sector}, t})}{\text{Median}(\text{PE}_{\text{sector}, t})}$$
     Sector assignment determined strictly by SEC SIC 2-digit industry code. If fewer than 8 constituent names exist in a given sector at date $t$, the cross-sectional universe median is utilized. Lower P/E yields a higher value score:
     $$S_{\text{sector}} = - \text{Rel\_PE}_{\text{sector}}$$
  3. **Earnings Growth Quality ($S_{\text{growth}}$):**
     Earnings acceleration composite combining Year-over-Year (YoY) change in Trailing Twelve Months (TTM) Diluted EPS and latest quarter YoY Diluted EPS growth:
     $$S_{\text{growth}} = \left(\frac{\text{EPS}_{\text{TTM}, t} - \text{EPS}_{\text{TTM}, t-1\text{y}}}{|\text{EPS}_{\text{TTM}, t-1\text{y}}|}\right) + \left(\frac{\text{EPS}_{Q, t} - \text{EPS}_{Q, t-1\text{y}}}{|\text{EPS}_{Q, t-1\text{y}}|}\right)$$
  - **Negative EPS Filter:** Companies with negative TTM EPS ($E/P < 0$) are excluded from the candidate value ranking, as the P/E multiple is uninformative. The number of dropped constituent-months is audited and reported.
  - **Earnings Yield Winsorization:** To eliminate denominator-near-zero explosion, earnings yield $E/P$ is winsorized at the 1st and 99th percentiles before ranking.
  - **Composite Score:**
    $$S_V = \text{Rank}(S_{\text{hist}}) + \text{Rank}(S_{\text{sector}}) + \text{Rank}(S_{\text{growth}})$$
- **Portfolio Construction:** Top quintile of eligible names (top 6 names from 30) held equal-weight ($16.67\%$ each, strictly satisfying the max $20\%$ per name cap). Monthly rebalance on the first trading session of each month, executed at the next day's market open price.

### Variant T: Pure Trend / Momentum (Baseline S2 Specification)
- **Signal:** 12-1 Month Relative Momentum:
  $$M_{i, t} = \frac{P_{i, t-21}}{P_{i, t-252}} - 1$$
- **Regime Shield:** Macro risk filter based on SPY vs. its 200-day simple moving average (SMA).
  - If $\text{Close}_{\text{SPY}, t} > \text{SMA}_{200}(\text{SPY})_t$: Hold top quintile momentum names equal-weight.
  - If $\text{Close}_{\text{SPY}, t} \le \text{SMA}_{200}(\text{SPY})_t$: 100% Cash shield (0 positions).
- **Execution:** Next-open fill, monthly rebalance.

### Variant VT: Value + Trend Filter ("Anti-Falling-Knife")
- **Signal:** Identical ranking to Variant V, with a structural momentum safety gate:
  $$\text{Eligible Candidates} = \{ i \in \text{Universe} \mid \text{Close}_{i, t} > \text{SMA}_{200}(P_i)_t \}$$
- **Portfolio Construction:** Top quintile of trend-filtered value candidates, equal-weight, fills at next open.

### Variant VM: Value-Momentum 50/50 Rank Composite
- **Signal:** Blended multi-style ranking:
  $$S_{\text{VM}} = 0.50 \cdot \text{Rank}(S_V) + 0.50 \cdot \text{Rank}(M_{12-1})$$
- **Portfolio Construction:** Top quintile equal-weight, monthly rebalance, next-open fill.

### Benchmark B: Reference Benchmarks
1. **Equal-Weight Universe ($B_{\text{EW}}$):** All point-in-time Top 30 constituents held in equal weight ($1/30 = 3.33\%$), rebalanced monthly at open.
2. **Market Benchmark ($B_{\text{SPY}}$):** SPY ETF Buy-and-Hold.

---

## 4. Multiple Testing Framework & Minimum Detectable Effect (MDE)

### 4.1 Bonferroni Multiple Testing Correction
We evaluate 4 active variants ($k = 4$: V, T, VT, VM) against the reference benchmarks.
- **Nominal Family-Wise Error Rate (FWER):** $\alpha = 0.05$
- **Bonferroni-Adjusted Significance Threshold:**
  $$\alpha_{\text{Bonf}} = \frac{\alpha}{k} = \frac{0.05}{4} = 0.0125 \quad (1.25\%)$$
- **Two-Tailed Critical Values:**
  - Standard Normal: $z_{\alpha_{\text{Bonf}}/2} = z_{0.00625} = 2.4977 \approx 2.50$
  - Student's $t$ with $N-1 = 201$ degrees of freedom: $t_{\text{crit}} = 2.523$

### 4.2 Minimum Detectable Effect (MDE) Formulation
Let $N = 202$ monthly rebalance periods ($T \approx 16.83$ years from 2010 to 2026).
For statistical power $1 - \beta = 0.80$ ($\beta = 0.20$, $z_\beta = 0.8416$):

$$t_{\text{MDE}} = z_{\alpha_{\text{Bonf}}/2} + z_{\beta} = 2.4977 + 0.8416 = 3.3393$$

The Minimum Detectable Annualized Information Ratio ($\text{IR}_{\text{MDE}}$) is:
$$\text{IR}_{\text{monthly, MDE}} = \frac{t_{\text{MDE}}}{\sqrt{N}} = \frac{3.3393}{\sqrt{202}} = 0.2349$$
$$\text{IR}_{\text{annual, MDE}} = \text{IR}_{\text{monthly, MDE}} \times \sqrt{12} = 0.2349 \times 3.4641 = 0.8139$$

### 4.3 MDE by Tracking Error Regime
Depending on the realized annualized tracking error volatility $\sigma_{\text{TE}} = \text{Std}(\Delta r_{\text{strategy}} - \Delta r_{\text{benchmark}}) \times \sqrt{12}$, the minimum detectable annualized excess return (Alpha) required to reject the null hypothesis of zero edge is:

| Tracking Error ($\sigma_{\text{TE}}$) | MDE Monthly IR | MDE Annualized IR | Minimum Detectable Annual Alpha ($\alpha_{\text{MDE}}$) |
| :---: | :---: | :---: | :---: |
| **6.0%** | 0.2349 | 0.8139 | **+4.88% / year** |
| **8.0%** | 0.2349 | 0.8139 | **+6.51% / year** |
| **10.0%** | 0.2349 | 0.8139 | **+8.14% / year** |
| **12.0%** | 0.2349 | 0.8139 | **+9.77% / year** |

> **Methodological Takeaway:** With 202 monthly observations and a 4-variant Bonferroni penalty, any active value or trend strategy with an 8% tracking error must produce at least **+6.51% annualized alpha** over buy-and-hold to achieve statistical significance. Modest claims of 1–2% alpha are mathematically indistinguishable from sample noise under rigorous testing.

---

## 5. Formal Institutional Adoption Decision Gate

A strategy variant is granted an **"ADOPT"** verdict **IF AND ONLY IF** all three strict criteria are simultaneously satisfied:

1. **Statistical Significance after Multiple Testing:**
   $$\text{Newey-West } t_{\alpha} \ge 2.52 \quad (\alpha \le 0.0125 \text{ Bonferroni})$$
   against both the SPY market benchmark and the point-in-time Equal-Weight Top-30 benchmark.
2. **Drawdown Risk Preservation:**
   $$\text{Max Drawdown}_{\text{variant}} \le \text{Max Drawdown}_{\text{Benchmark}}$$
   The active strategy must not incur deeper peak-to-trough capital impairment than buy-and-hold.
3. **Robust Positive Excess-Return Distribution:**
   The stationary month-block bootstrap (2,000 resamples) 95% Confidence Interval of annualized excess return must strictly exclude zero:
   $$\text{CI}_{95\%}(\mu_{\text{excess}}) > 0.00\%$$

If any variant fails any of these criteria, the verdict is explicitly classified as **"INDEX WINS"** (if the benchmark dominates) or **"INCONCLUSIVE"** (if statistical confidence is insufficient).

---

## 6. Pre-Registration Verification Signature
- **Author:** Automated Quantitative Research Agent (Antigravity Quant Engine)
- **Status:** LOCKED & SEALED
- **Git State:** Committed to `feat/us-value-vs-trend` prior to execution of Phase 2 data gathering and Phase 3 empirical backtests.
