# Pre-Registration Document: Non-Directional Macro Quantitative Research (Round 2)

> **Document Type:** Institutional Research Pre-Registration  
> **Status:** PRE-REGISTERED & FROZEN (Committed prior to executing any code or inspecting test data)  
> **Repository:** Trader-Pro / Trader-Pro-Dashboard  
> **Branch:** `feat/cost-aware-engine`  
> **Date:** November 2026  
> **Primary Rule:** Zero parameter tuning, zero model searches, zero direction prediction. All rules, friction models, and statistical criteria are fixed in this document prior to execution.

---

## 1. Research Motivation & Core Principles

Prior quantitative audits in this repository demonstrated that high-frequency directional classifiers (15M, 1H, 4H LightGBM breakout models) failed due to lookahead label leaks, execution simulator bias, and catastrophic exchange fee drag ($0.28\text{R} - 0.50\text{R}$ friction on sub-0.5% stops). Furthermore, residual edge analysis proved that apparent gross gains in simple daily breakout rules were almost entirely systematic market beta ($\beta \approx 0.42 - 0.44$), yielding statistically insignificant alpha ($t_{\alpha} < 1.25$).

This research round deliberately abandons directional predictive modeling. Instead, it tests **three classical non-directional / macro systematic portfolio rules** designed to manage risk, dampen tail drawdowns, and harvest diversification return.

---

## 2. Pre-Registered Hypotheses (Exactly 3)

### Hypothesis 1 (H1): Volatility-Targeted BTC Exposure
- **Hypothesis Statement:** Scaling continuous daily exposure inversely to trailing realized volatility dampens catastrophic drawdowns without degrading risk-adjusted return (Sharpe ratio) compared to passive BTC buy-and-hold.
- **Exact Parameters (Fixed, No Search):**
  - **Target Volatility:** $\sigma_{\text{target}} = 40.0\%$ annualized ($0.40$).
  - **Realized Volatility Metric:** Trailing 30-day standard deviation of daily log returns, annualized using 365 days (crypto calendar):
    $$\sigma_{\text{realized}, t-1} = \text{std}(\ln(close_{t-30:t-1} / close_{t-31:t-2})) \times \sqrt{365}$$
  - **Position Weight:**
    $$w_t = \min\left(1.0, \frac{\sigma_{\text{target}}}{\sigma_{\text{realized}, t-1}}\right)$$
  - **Constraints:** Long-only ($w_t \ge 0.0$), maximum $1.0\times$ notional (no leverage), remainder $(1 - w_t)$ held in cash ($0.0\%$ return).
  - **Rebalance Frequency:** Daily at candle close of $t-1$, executed at open of day $t$.
- **Cost Model:**
  - Execution strictly at next-day open ($open[t]$).
  - Friction: $14\text{ bps}$ ($0.0014$) applied to the daily rebalancing turnover $|w_t - w_{t-1}|$.
  - Funding rates: Spot holding assumption (funding ignored).
- **Benchmark:** Plain BTC Buy-and-Hold over the identical time window.
- **Success Criteria:**
  1. Maximum Drawdown: $\text{MaxDD}_{\text{H1}} < \text{MaxDD}_{\text{B\&H}}$ (strictly lower drawdown).
  2. Sharpe Ratio: $\text{Sharpe}_{\text{H1}} \ge \text{Sharpe}_{\text{B\&H}}$ (Sharpe ratio not lower).
- **Statistical Pass Gate:**
  - Bootstrap difference in Sharpe: $\Delta\text{Sharpe} = \text{Sharpe}_{\text{H1}} - \text{Sharpe}_{\text{B\&H}}$.
  - The lower bound of the Bonferroni-adjusted $98.33\%$ bootstrap confidence interval must be $\ge 0.0$.

---

### Hypothesis 2 (H2): Daily 200-Day SMA Trend Overlay
- **Hypothesis Statement:** Conditioning spot BTC market exposure on whether price trades above its 200-day simple moving average eliminates extended bear market drawdowns while preserving or improving risk-adjusted return.
- **Exact Parameters (Fixed, No Search):**
  - **Trend Indicator:** 200-day Simple Moving Average on daily closing prices:
    $$\text{SMA}_{200}(t-1) = \frac{1}{200}\sum_{i=1}^{200} close_{t-i}$$
  - **Signal Rule:**
    - If $close_{t-1} > \text{SMA}_{200}(t-1) \implies w_t = 1.0$ (100% Long).
    - If $close_{t-1} \le \text{SMA}_{200}(t-1) \implies w_t = 0.0$ (100% Cash).
  - **No Search:** Standard 200-day period. Zero parameter sweeping or optimization.
- **Cost Model:**
  - Execution strictly at next-day open ($open[t]$).
  - Friction: $14\text{ bps}$ ($0.0014$) applied on full entry ($|w_t - w_{t-1}| = 1.0$) and exit.
  - Funding rates: Spot holding assumption (funding ignored).
- **Benchmark:** Plain BTC Buy-and-Hold over the identical time window.
- **Success Criteria:**
  1. Maximum Drawdown: $\text{MaxDD}_{\text{H2}} < \text{MaxDD}_{\text{B\&H}}$ (strictly lower drawdown).
  2. Sharpe Ratio: $\text{Sharpe}_{\text{H2}} \ge \text{Sharpe}_{\text{B\&H}}$ (Sharpe ratio not lower).
- **Statistical Pass Gate:**
  - The lower bound of the Bonferroni-adjusted $98.33\%$ bootstrap confidence interval of $\Delta\text{Sharpe} = \text{Sharpe}_{\text{H2}} - \text{Sharpe}_{\text{B\&H}}$ must be $\ge 0.0$.

---

### Hypothesis 3 (H3): BTC + ETH Equal-Weight Portfolio (Monthly Rebalanced)
- **Hypothesis Statement:** A 50/50 equal-weighted portfolio of BTC and ETH rebalanced monthly generates a diversification rebalancing bonus that achieves a higher net Sharpe ratio than the better single asset alone.
- **Exact Parameters (Fixed, No Search):**
  - **Assets:** BTCUSDT and ETHUSDT.
  - **Target Weights:** $w_{\text{BTC}} = 0.50$, $w_{\text{ETH}} = 0.50$.
  - **Rebalance Cadence:** Monthly on the first day of each calendar month.
  - **Intramonth Drift:** Weights drift naturally with daily asset returns between monthly rebalance points.
- **Cost Model:**
  - Rebalance trades executed at open of the first day of each month.
  - Friction: $14\text{ bps}$ ($0.0014$) applied to rebalance turnover:
    $$\text{Turnover}_t = \frac{1}{2}\left(|w_{\text{BTC}, t} - w_{\text{BTC}, t-}| + |w_{\text{ETH}, t} - w_{\text{ETH}, t-}|\right)$$
  - Funding rates: Spot holding assumption (funding ignored).
- **Benchmark:** The higher Sharpe ratio between single-asset BTC Buy-and-Hold and ETH Buy-and-Hold over the identical period:
  $$\text{Sharpe}_{\text{Benchmark}} = \max\left(\text{Sharpe}_{\text{BTC}}, \text{Sharpe}_{\text{ETH}}\right)$$
- **Success Criteria:**
  - Net Sharpe ratio after costs strictly exceeds the benchmark: $\text{Sharpe}_{\text{H3}} > \text{Sharpe}_{\text{Benchmark}}$.
- **Statistical Pass Gate:**
  - The lower bound of the Bonferroni-adjusted $98.33\%$ bootstrap confidence interval of $\Delta\text{Sharpe} = \text{Sharpe}_{\text{H3}} - \text{Sharpe}_{\text{Benchmark}}$ must be $> 0.0$.

---

## 3. Multiple Testing & Bonferroni Adjustment

Because exactly $M = 3$ hypotheses are evaluated in this research round, standard $95\%$ confidence intervals would suffer from family-wise error inflation:
$$P(\ge 1 \text{ false discovery at } \alpha = 0.05) = 1 - (1 - 0.05)^3 = 14.26\%$$

To control the Family-Wise Error Rate strictly at $\alpha_{\text{FWER}} = 0.05$, the Bonferroni-adjusted significance level per hypothesis is:
$$\alpha_{\text{adj}} = \frac{0.05}{M} = \frac{0.05}{3} \approx 0.01667 \quad (1.67\%)$$

### Operational Bootstrap Rule:
- Resamples: $B = 10,000$ paired bootstrap draws.
- Required Confidence Interval: **$98.33\%$ two-sided bootstrap confidence interval** ($1 - \alpha_{\text{adj}}$).
- Lower percentile cutoff: **`0.833%`**
- Upper percentile cutoff: **`99.167%`**
- **Decision Rule:** A hypothesis passes if and only if the **$0.833^{\text{rd}}$ percentile of $\Delta\text{Sharpe}$ is strictly above the hurdle** ($0.0$).

---

## 4. Execution Invariants & Evaluation Pipeline

1. **Annualization:** All metrics use 365 days ($\sqrt{365}$ for volatility, $365$ for return scaling). Equity 252-day annualization is prohibited.
2. **Strict Fills:** Position weight changes determined at day $t-1$ close are filled at day $t$ open.
3. **Friction Model:** $14\text{ bps}$ ($0.14\%$) round-trip taker friction applied to turnover.
4. **Data Partitions:**
   - **Development Window:** `2018-01-01` to `2023-12-31`.
   - **Test Window:** `2024-01-01` to current.
   - Any prior exposure or contamination in the test window must be audited and disclosed in Phase 2 before evaluation.
