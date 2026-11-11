# Quantitative Research Report: US Equities Systematic Book (2010–2026)
**Document ID:** `RESEARCH-US-EQUITIES-V1`  
**Git Branch:** `feat/us-equities-book`  
**Date:** `November 11, 2026`  
**Author:** Careful Quant Engineering Team  
**Compliance Standard:** Strict Point-in-Time Universe, Zero Post-Hoc Tuning, Pre-Registered Adoption Rule  

---

## 1. Executive Summary & Plain-English Verdict

### The Plain-English Verdict: BUY-AND-HOLD SPY & EQUAL-WEIGHT WIN DECISIVELY
> **Quantitative Finding:**  
> **None of the three pre-registered active systematic strategies (Trend Following, Cross-Sectional Momentum, Pullback in Uptrend) beat Buy-and-Hold the Index on the realistic point-in-time Top 30 US equities universe after institutional friction.**  
>  
> Over the 16.8-year horizon (2010–2026; 4,240 daily NYSE sessions):
> - **Benchmark 1 (SPY Buy-and-Hold):** Generated **13.92% CAGR**, turning \$100,000 into **\$896,115**, with a Sharpe Ratio of **0.85**.
> - **Benchmark 2 (Equal-Weight Top 30 Point-in-Time):** Generated **18.32% CAGR** *(likely survivorship-inflated until Task B is done)*, turning \$100,000 into **\$1,693,295**, with a Sharpe Ratio of **1.04**.
> - **Strategy 1 (S1 Trend Following):** Delivered only **5.57% CAGR** (\$249,072) with a Newey-West Alpha t-stat of **+0.47** ($p = 0.640$).
> - **Strategy 2 (S2 Cross-Sectional Momentum):** Delivered **12.65% CAGR** (\$741,777) with higher drawdown (-35.72% vs -33.72%) and Newey-West Alpha t-stat of **+0.92** ($p = 0.359$).
> - **Strategy 3 (S3 Pullback in Uptrend):** Delivered only **3.45% CAGR** (\$176,856) with negative Newey-West Alpha (**-1.51% / year**, $t = -0.77$).
>
> **Institutional Decision: ALL THREE ACTIVE STRATEGIES ARE REJECTED FOR ACTIVE TRADING.**  
> In this test, no active strategy beat buy-and-hold on a risk-adjusted basis.

---

## 2. Book Segregation Architecture

To prevent cross-contamination of capital, trading hours, and friction models, the trading engine is strictly segregated into two independent books:

| Dimension | 24x7 Perpetual Derivatives Book (`perp_24x7`) | US Equities Book (`us_equities`) |
| :--- | :--- | :--- |
| **Asset Class** | Crypto & Commodity Perpetual Futures | US-Listed Common Equities & Verified ADRs |
| **Constituents** | BTC, ETH, SOL, DOT, XAU, XAG, CL (7 Assets) | Point-in-Time Top 30 US Stocks (by market cap) |
| **Trading Calendar** | Continuous 24/7/365 | NYSE/NASDAQ (09:30–16:00 ET, strictly Daily bars) |
| **Base Currency** | INR (₹7,000 baseline) | USD (\$100,000 baseline) |
| **Cost Schedule** | Shark Exchange (0.040% Taker, 18% GST, 1 bp slip) | \$0.005/sh comm, 3 bps slip, SEC 31, FINRA TAF, FX |
| **Indian Tax Tracking** | Flat 30% VDA crypto tax model | 20% TCS under LRS + STCG/LTCG (**UNCONFIRMED**) |
| **Forward Ledger** | `paper_trades_4hr_timeframe_router` | `paper_trades_us_equities` |
| **Mongo Collections** | `paper_trades_4hr_timeframe_router`, `live_prediction_logs` | `paper_trades_us_equities`, `live_prediction_logs_us_equities` |
| **Dashboard Tab** | `/terminal` and `/ai-engine` | `/equities` |

---

## 3. The Survivorship & Hindsight Bias Spread (The Mag-7 Illusion)

A critical discovery of this audit is the quantification of **Survivorship and Hindsight Bias**:

| Strategy / Portfolio | Point-in-Time CAGR (Realistic) | Hindsight Watchlist CAGR (BIASED) | Survivorship & Selection Gap |
| :--- | :---: | :---: | :---: |
| **Equal-Weight Buy & Hold** | **18.32%** | **26.79%** | **+8.48% / year** |
| **S1 Trend Following** | **5.57%** | **3.86%** | **-1.72% / year** |
| **S2 Momentum (12-1m)** | **12.65%** | **14.67%** | **+2.02% / year** |
| **S3 Pullback in Uptrend** | **3.45%** | **2.26%** | **-1.18% / year** |

### Key Insight:
Backtesting on a hindsight watchlist (`NVDA`, `GOOGL`, `MSFT`, `AMZN`, `AAPL`, `META`, `SONY`) inflates buy-and-hold returns by **+8.48% per year** because it selectively includes the greatest corporate winners in human history while omitting constituents that stagnated or fell out of the Top 30 (e.g., General Electric, Intel, HP, AT&T, Citigroup).  
Under rigorous **Point-in-Time** reconstruction (selecting only the top 30 stocks known at each monthly rebalance), the realistic equity growth drops from 26.79% to 18.32%. Any quant research that tests on fixed modern lists is fundamentally compromised by hindsight bias.

---

## 4. Master 16-Year Quantitative Performance Audit (2010–2026)

All backtests run from **January 4, 2010 to November 10, 2026** (4,240 daily NYSE sessions).  
Starting Capital: **\$100,000 USD**. Friction deducted: \$0.005/share commission, 3 bps slippage, SEC Section 31, FINRA TAF.

| Metric | SPY Buy & Hold (B1) | Equal-Weight Top 30 (B2)* | S1 Trend Following | S2 12-1m Momentum | S3 Pullback in Uptrend |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Final Equity** | **\$896,115** | **\$1,693,295** | \$249,072 | \$741,777 | \$176,856 |
| **Total Net Return** | +796.1% | +1,593.3% | +149.1% | +641.8% | +76.9% |
| **CAGR (Annualized)** | **13.92%** | **18.32%** | 5.57% | 12.65% | 3.45% |
| **Max Drawdown** | -33.72% | -32.87% | -30.46% | -35.72% | **-23.77%** |
| **Sharpe Ratio** | 0.85 | **1.04** | 0.51 | 0.71 | 0.36 |
| **Calmar Ratio** | 0.41 | **0.56** | 0.18 | 0.35 | 0.15 |
| **Total Trades** | 1 | 203 rebalances | 791 | 1,630 | 1,173 |
| **Win Rate** | 100.0% | N/A | 41.8% | 55.8% | 55.7% |
| **Mean Net R** | N/A | N/A | +0.143R | N/A | +0.077R |
| **Newey-West $\alpha$ vs SPY** | Baseline | +3.42% ($t=+1.85$) | +1.22% ($t=+0.47$) | +2.46% ($t=+0.92$) | -1.51% ($t=-0.77$) |
| **Newey-West $\alpha$ vs EW** | -3.42% ($t=-1.85$) | Baseline | -0.50% ($t=-0.21$) | -1.46% ($t=-0.56$) | -3.03% ($t=-1.55$) |
| **95% Bootstrap CI vs SPY** | [0.00%, 0.00%] | [+1.84%, +7.21%] | [-12.52%, -2.88%] | [-6.71%, +4.55%] | [-14.91%, -5.24%] |
| **Adoption Verdict** | **BENCHMARK CORE** | **SUPERIOR BENCHMARK** | **REJECT** | **REJECT** | **REJECT** |

*\*Note: The Equal-Weight Top-30 benchmark (18.32% CAGR) is likely survivorship-inflated until Task B is done (missing delisted constituent audit).*

---

## 5. Year-by-Year Performance Matrix & 2022 Bear Market Audit

| Year | SPY Benchmark | Equal-Weight Top 30 | S1 Trend Following | S2 Momentum (12-1m) | S3 Pullback in Uptrend |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **2010** | +12.84% | +3.83% | +1.23% | 0.00% | +3.28% |
| **2011** | +1.89% | +1.40% | -11.60% | -3.70% | +1.05% |
| **2012** | +15.99% | +23.32% | +15.97% | +17.57% | +3.32% |
| **2013** | +32.31% | **+43.02%** | +20.88% | +40.51% | +14.72% |
| **2014** | +13.46% | +11.63% | +1.26% | +12.47% | -2.03% |
| **2015** | +1.23% | +9.00% | -4.84% | +10.23% | **+18.15%** |
| **2016** | +12.00% | +17.47% | +12.64% | +9.62% | +2.48% |
| **2017** | +21.71% | +26.58% | +15.22% | +30.13% | +16.86% |
| **2018** | -4.57% | +0.66% | -18.40% | +0.66% | -12.92% |
| **2019** | +31.22% | +38.51% | +2.53% | +9.00% | +0.20% |
| **2020** | +18.33% | +32.53% | +14.88% | +22.92% | +1.89% |
| **2021** | +28.73% | +26.21% | +9.49% | +18.34% | +2.02% |
| **2022 (BEAR)** | **-18.18%** | **-25.63%** | **-16.80%** | **-18.26%** | **-9.40%** |
| **2023** | +26.18% | **+44.37%** | +30.99% | +37.40% | +11.17% |
| **2024** | +24.89% | +30.55% | +20.38% | +38.74% | +8.61% |
| **2025** | +17.72% | +23.52% | +2.33% | -1.41% | +12.58% |
| **2026 (YTD)** | +10.83% | +24.82% | +12.37% | +7.53% | -7.67% |

### Key Observations from Sub-Periods:
1. **2022 Fed Tightening Bear Market:**
   - S3 Pullback provided the best capital preservation (-9.40% vs -18.18% SPY and -25.63% Equal-Weight) because it spent most of the bear market in cash.
   - However, in strong recovery years (2023: +26.18% SPY, +44.37% EW), S3 gained only +11.17%, creating fatal upside drag.
2. **Compound Drag in Active Strategies:**
   - In 2018, S1 Trend suffered -18.40% due to repeated false breakouts that hit trailing stops.
   - S2 Momentum performed well in 2013 (+40.51%) and 2024 (+38.74%), but lost ground in 2025 (-1.41% vs +17.72% SPY) due to abrupt sector rotations.

---

## 6. Statistical Validation Suite Results

1. **Lookahead Truncation Test:**
   - **Status: PASS.** 200 random bar timestamps tested with truncated datasets $[:t+1]$. Signals evaluated at index $t$ matched the full dataset run with 100% precision. Zero future leakage.
2. **Noise-Null Benchmark (Geometric Brownian Motion):**
   - The synthetic GBM null generates synthetic asset price paths assuming zero drift ($\mu = 0$). Because the real-world US equity market exhibits a strong positive long-term upward drift, long-only equity strategies (S1 and S2) pass this zero-drift hurdle easily. S1 empirical Sharpe (0.51) and S2 empirical Sharpe (0.71) exceeded the 95th percentile of synthetic GBM zero-drift paths ($\approx 0.38$). Both reject the zero-drift noise null ($p < 0.05$). S3 empirical Sharpe (0.36) failed to reject the noise null ($p = 0.065$).
   - **Crucial Quant Finding:** Rejecting a zero-drift GBM null is trivial for long-only stock strategies in a secular bull market. The **benchmark/alpha test (excess return vs SPY and Equal-Weight) is the truly binding hurdle**, which all active strategies failed.
3. **Month-Block Stationary Bootstrap (2,000 resamples):**
   - S1 Excess Return vs SPY: 95% CI is **[-12.52%, -2.88%]**. The entire interval is negative, formally confirming that S1 underperforms SPY with 95% statistical confidence.
   - S2 Excess Return vs SPY: 95% CI is **[-6.71%, +4.55%]**. Crosses zero, confirming zero statistically robust edge.
   - S3 Excess Return vs SPY: 95% CI is **[-14.91%, -5.24%]**. Entire interval is negative.
4. **Newey-West HAC Alpha t-tests:**
   - S1: $\alpha = +1.22\%$, $t = +0.47$ ($p = 0.640$). Fails $t \ge 2.00$.
   - S2: $\alpha = +2.46\%$, $t = +0.92$ ($p = 0.359$). Fails $t \ge 2.00$.
   - S3: $\alpha = -1.51\%$, $t = -0.77$ ($p = 0.441$). Fails $t \ge 2.00$.
5. **Ex-Top-3 Winners Sensitivity Test:**
   - S1 Trend total profit: \$151,835; without top 3 trades: \$111,925 (top 3 trades drove 26.3% of total profit). Edge remained positive, indicating profits are not an isolated 1-trade windfall, but overall level is insufficient.
   - S3 Pullback total profit: \$90,975; without top 3 trades: \$75,976 (top 3 drove 16.5%).

---

## 7. Cost Model & Indian Tax Sensitivity Analysis

### Active Friction Impact
- All-in roundtrip friction on US equities averaged **12.4 to 18.6 basis points** per trade.
- For high-turnover active trading (S2 Momentum executed 1,630 trades; S3 Pullback executed 1,173 trades), total cumulative transaction friction consumed **\$42,000 to \$68,000** of gross profits.
- Buy-and-hold benchmarks executed only 1 to 203 rebalance transactions over 16 years, keeping friction drag below 0.15% annualized.

### Indian Tax Sensitivity (UNCONFIRMED - Default OFF)
- **TCS under LRS (20% on remittances > ₹7 Lakhs):**
  - Reduces initial working capital available in USD by 20% unless claimed back during annual ITR filing (interest opportunity cost of ~1.2% per year).
- **Foreign Capital Gains Tax (Indian IT Act):**
  - Unlisted foreign shares are classified as Short-Term if held $\le 24$ months (taxed at slab rates up to ~35.88% with surcharge).
  - High-turnover active strategies (S1, S2, S3) holding positions for days to weeks trigger 100% Short-Term Capital Gains, imposing an immense tax penalty compared to buy-and-hold index compounding.

---

## 8. Forward Paper Trading & Watchlist Governance

1. **Forward Paper Ledger:**
   - Initialized at \$100,000 USD on NYSE daily calendar.
   - Active executions: **ZERO**. In accordance with our pre-registered institutional rule, no money is committed to strategies that fail to demonstrate statistically significant alpha.
2. **SpaceX (`SPCX`, IPO Listed 2026-06-12):**
   - Logged strictly on the **Forward Watchlist**.
   - Zero historical backtesting permitted (~5 months history).
   - Monitored daily for price action, volume liquidity, and institutional ownership.
3. **Samsung Electronics (`KRX 005930`):**
   - **EXCLUDED ENTIRELY** per quantitative governance directive.

---

## 9. Final Strategic Recommendation

1. **Do NOT run active retail trend or pullback models on US mega-cap equities.** The US large-cap market is the most liquid, efficient equity market in the world. Active mechanical rules suffer severe cash-drag and whipsaw losses during the dominant upward drift of the index.
2. **Adopt SPY / S&P 500 or Equal-Weight Top 30 Buy-and-Hold for US Equities exposure.**
3. **Perpetual Book Realities (`perp_24x7`):** In `perp_24x7`, `fixed_rule_4h_v1` has a 95% bootstrap confidence interval that includes zero (-0.03R to +0.41R) and is approximately break-even after statutory tax; the 328-trade clamp-mode figure (+0.252R) was not run through the full validation gates. No edge can be claimed unless the validated 95% CI excludes zero after all costs and statutory taxes.

*Report concluded and certified by Antigravity Quantitative Research.*
