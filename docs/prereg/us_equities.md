# Pre-Registration Document: Systematic US Equities Book (2010–2026)
**Document ID:** `PREREG-US-EQUITIES-V1`  
**Git Branch:** `feat/us-equities-book`  
**Registration Timestamp:** `2026-11-11T13:40:00+05:30`  
**Execution Environment:** Isolated `us_equities` book (`D:\Projects_Main\Trade-Pro\Trader-Pro-Dashboard`)  
**Methodological Standard:** SEC/CFA Quantitative Research Compliance, Zero Post-Hoc Tuning, Pre-Registered Hypotheses Only.

---

## 1. Executive Summary & Book Segregation Mandate

This research protocol establishes an isolated **US Equities Systematic Book** (`us_equities`), completely segregated from the existing continuous 24/7 perpetual derivatives book (`perp_24x7`).

### Strict Book Isolation Architecture
1. **Trading Session & Calendar:** Strictly DAILY bars governed by the **New York Stock Exchange (NYSE) / NASDAQ calendar** (09:30 – 16:00 ET). Zero intraday operations. No weekend or continuous crypto sessions.
2. **Capital Pool:** Starting baseline of **\$100,000 USD** (completely segregated from the ₹7,000 INR perp account).
3. **Friction Model:** Institutional US broker schedule: \$0.005/share commission (min \$1.00, cap 0.5%), 3.0 bps mega-cap slippage, SEC Section 31 fees, FINRA TAF, and FX markup (INR/USD).
4. **Tax Disclosure:** TCS under LRS (20%) and Indian Foreign Capital Gains taxes are tracked as **UNCONFIRMED** sensitivity parameters (default OFF) awaiting Chartered Accountant (CA) audit.
5. **No Machine Learning:** Zero black-box neural networks, LightGBM, or post-hoc parameter fitting. All strategies are closed-form rule-based systematic models pre-registered herein.
6. **No Fake Numbers:** All UI elements, logs, and tables display strictly computed metrics or `null` if uncomputed.

---

## 2. Universe Construction & Data Integrity

### 2.1 Primary Universe: Point-in-Time Top N=30 US Equities
- **Rebalance Frequency:** Monthly (first trading day of each month, evaluated on the close of the prior month).
- **Constituent Selection:** Top 30 US common stocks by market capitalization using only fundamental/pricing data known at the rebalance timestamp $t$.
- **Historical Constituency Mapping (2010–2026):**
  - **2010–2014 Era:** ExxonMobil (XOM), Microsoft (MSFT), Apple (AAPL), General Electric (GE), Johnson & Johnson (JNJ), Procter & Gamble (PG), Walmart (WMT), Chevron (CVX), IBM, JPMorgan Chase (JPM), Bank of America (BAC), Cisco (CSCO), Intel (INTC), Pfizer (PFE), Coca-Cola (KO), AT&T (T), Verizon (VZ), Oracle (ORCL), Philip Morris (PM), Hewlett-Packard (HPQ), PepsiCo (PEP), Qualcomm (QCOM), Amazon (AMZN), Alphabet (GOOGL), Walt Disney (DIS), Home Depot (HD), UnitedHealth (UNH), Berkshire Hathaway (BRK-B), Visa (V), Mastercard (MA).
  - **2015–2019 Additions:** Meta/Facebook (META), Nvidia (NVDA), Tesla (TSLA), Adobe (ADBE), Salesforce (CRM), Netflix (NFLX), Abbott (ABT), Comcast (CMCSA), Costco (COST), Nike (NKE).
  - **2020–2026 Era:** Eli Lilly (LLY), Broadcom (AVGO), AbbVie (ABBV), Merck (MRK), AMD, Thermo Fisher (TMO).
- **Data Source:** Split- and dividend-adjusted daily OHLCV from Yahoo Finance via `yfinance` (2010-01-01 to 2026-11-10).
- **Data Quality & Hygiene Audit:**
  - Forward-fill verification for missing sessions.
  - Zero weekend bars (strict NYSE holiday calendar).
  - Split adjustment factor verification to eliminate unadjusted dividend/split step-cliffs.
- **Known Limitations of Data Source:**
  - *Delisting / Survivorship Limitation:* Standard free historical daily datasets do not retain bankrupt micro-cap tickers. For the Top 30 mega-cap US universe, constituent stability is very high, but survivorship distortion must still be measured.

### 2.2 Secondary Watchlist: Hindsight Watchlist (Labelled BIASED)
- **Constituents:** `NVDA`, `GOOGL`, `MSFT`, `AMZN`, `AAPL`, `META`, `SONY` (verified NYSE ADR, ticker `SONY`).
- **Purpose:** Run identically against the primary universe to quantify the exact **Survivorship & Hindsight Bias Spread**:
  $$\text{Bias Spread} = \text{CAGR}_{\text{Biased}} - \text{CAGR}_{\text{Point-in-Time}}$$
- **Reporting Rule:** This watchlist must always carry the label `[BIASED / HINDSIGHT WATCHLIST]`.

### 2.3 Forward-Only Watchlist & Explicit Exclusions
- **SpaceX (`SPCX`, Listed 2026-06-12):**
  - Tracked strictly on the **Forward Paper Ledger**.
  - **Excluded from all 2010–2026 backtests** (only ~5 months of price history; backtesting an unseasoned post-IPO asset creates gross sample bias).
- **Samsung Electronics (`KRX 005930`):**
  - **EXCLUDED ENTIRELY** per explicit quantitative governance directive. Not US-listed; OTC instrument (`SSNLF`) lacks liquid institutional execution.

---

## 3. Execution & Friction Model Pre-Registration

| Friction Component | Rate / Schedule | Rationale / Standard |
| :--- | :--- | :--- |
| **Broker Commission** | \$0.005 / share (Min \$1.00, Max 0.5% notional) | Institutional Interactive Brokers / TradeStation tier |
| **Mega-Cap Slippage** | 3.0 bps (0.030% per side) | Standard mega-cap top-of-book half-spread |
| **Large-Cap Slippage** | 6.0 bps (0.060% per side) | Non-mega-cap constituent liquidity friction |
| **SEC Section 31 Fee** | \$0.0000278 &times; Sale Notional | Mandatory US regulatory fee on equity sales |
| **FINRA TAF Fee** | \$0.000166 / share sold (Max \$8.30) | Mandatory FINRA trading activity fee on sales |
| **FX Wire/Spread Markup** | 50 bps (0.50%) | INR to USD bank remittance / conversion spread |
| **TCS under LRS (Tax)** | 20% on remittances &gt; ₹7 Lakhs | **UNCONFIRMED - DEFAULT OFF** (Sensitivity line only) |
| **Foreign Capital Gains** | Slab rate (STCG) / 20% (LTCG &gt; 24m) | **UNCONFIRMED - DEFAULT OFF** (Sensitivity line only) |

---

## 4. Portfolio Sizing & Execution Mechanics

- **Starting Equity:** \$100,000 USD.
- **Risk Budget per Trade:** Strict **1.0% of current portfolio equity** (\$1,000 initial risk on \$100k equity):
  $$\text{Shares} = \frac{\text{Portfolio Equity} \times 0.010}{\text{Entry Price} - \text{Stop Loss}}$$
- **Position Sizing Cap:** Maximum **20.0% of portfolio equity** per single stock.
- **Maximum Concurrent Positions:** Maximum **8 positions** (max 160% gross leverage if margin allowed, but strictly capped by available cash; long-only cash-settled).
- **Fractional Shares:** Enabled with flag `isFractional: true` (sized to 4 decimal places).
- **Order Timing (Strict t+1 Execution):**
  - Signals generated strictly on the **daily close bar** at 16:00 ET ($t$).
  - Orders executed at the **next trading day Open** ($t+1$). Zero same-bar lookahead.
- **Gap-Aware Stop Execution:**
  - If the market opens below the stop price:
    $$\text{Fill Price} = \text{Open Price}_{t+1} \quad (\text{Slippage penalty accounted for})$$
  - Intraday stops evaluate against the low of the bar ($Low_{t+1} \le Stop$).

---

## 5. Pre-Registered Strategies (Max 4, Long-Only, Zero ML)

### Strategy 1 (S1): Systematic Trend Following
- **Hypothesis:** Long-term momentum and Donchian channel breakouts capture multi-month trend expansions in large-cap equities while cutting tail losses.
- **Entry Rules:**
  1. Regime Filter: $\text{Close}_t > \text{SMA}_{200}(\text{Close}, t)$
  2. Breakout Trigger: $\text{Close}_t > \max_{i=1}^{55} (\text{High}_{t-i})$
  3. Action: Enter LONG at $\text{Open}_{t+1}$.
- **Exit Rules (Whichever occurs first):**
  1. Channel Exit: $\text{Low}_{t+1} < \min_{i=1}^{20} (\text{Low}_{t-i})$
  2. Trailing Chandelier Stop: $\text{Highest Close since Entry} - 3.0 \times \text{ATR}_{20}$
  3. Maximum Time Stop: None (trend riders remain open until trail or channel breach).
- **Risk / Sizing:** 1% risk per trade; stop distance = $\max(3\times\text{ATR}_{20}, \text{Entry} - \text{Low}_{20})$. Max 8 positions.

### Strategy 2 (S2): Cross-Sectional 12-1 Month Momentum
- **Hypothesis:** Jegadeesh-Titman 12-1 month cross-sectional momentum generates persistent positive factor premia over the broader index, protected by macro cash shielding.
- **Universe:** Point-in-time Top 30 US equities rebalanced monthly.
- **Momentum Score:**
  $$\text{MomScore}_t = \frac{\text{Close}_{t - 21}}{\text{Close}_{t - 252}} - 1.0$$
  *(Excludes the most recent month $t-21$ to $t$ to avoid short-term reversal drag).*
- **Macro Filter:**
  $$\text{SPY Close}_t > \text{SMA}_{200}(\text{SPY}, t)$$
  - If $\text{SPY} < \text{SMA}_{200}$, hold **100% Cash** (Risk-Off Regime).
- **Portfolio Construction:**
  - If Macro Filter is Bullish: Hold the **Top 10 ranked stocks** in equal weights ($10\%$ per position).
  - Rebalance monthly on the first trading day.

### Strategy 3 (S3): Pullback in Secular Uptrend
- **Hypothesis:** High-quality mega-cap equities in established secular bull markets suffer temporary liquidity pullbacks that mean-revert to the primary trend.
- **Entry Rules:**
  1. Macro Regime: $\text{Close}_t > \text{SMA}_{200}(\text{Close}, t)$
  2. Intermediate Trend: $\text{SMA}_{50}(\text{Close}, t) > \text{SMA}_{200}(\text{Close}, t)$
  3. Pullback Trigger: 3-day consecutive decline where:
     $$\text{Close}_{t-3} - \text{Close}_t \ge 1.5 \times \text{ATR}_{14}(t)$$
  4. RSI Gate: $\text{RSI}_{14}(t) \le 40.0$
  5. Action: Enter LONG at $\text{Open}_{t+1}$.
- **Exit Rules:**
  1. Profit Target: $\text{High}_{t+k} \ge \text{Entry} + 2.0 \times \text{ATR}_{14}$ (or $\text{RSI}_{14} \ge 70$)
  2. Stop Loss: $\text{Entry} - 2.0 \times \text{ATR}_{14}$ (Gap-aware fill at open if opened below)
  3. Time Horizon Limit: 15 trading days.

### Mandatory Benchmarks
1. **Benchmark 1 (B1):** `SPY` Buy-and-Hold (Standard S&P 500 Index ETF).
2. **Benchmark 2 (B2):** Equal-Weight Point-in-Time Universe Buy-and-Hold (Rebalanced monthly).

---

## 6. Statistical Validation Protocol (Strict Anti-Overfitting Gates)

Under CFA Institute and institutional quantitative standards, no strategy may be claimed to possess an edge unless it passes all of the following gates:

1. **Lookahead Truncation Verification:** Truncated run at 200 random bar timestamps $t$; computed signals on data $[:t+1]$ must match full series evaluation at index $t$ with zero discrepancies.
2. **Noise-Null Benchmark (Geometric Brownian Motion):**
   - Synthesize 1,000 synthetic price histories using GBM with drift = 0 and volatility calibrated to empirical asset volatility:
     $$dS_t = \sigma S_t dW_t$$
   - Strategy performance on empirical data must exceed the 95th percentile of the noise distribution ($p < 0.05$).
3. **Random-Entry Baseline:**
   - 1,000 random-entry runs with identical exit rules, friction, and position sizing.
   - Empirical strategy must reject the random-entry null ($p < 0.05$).
4. **Month-Block Stationary Bootstrap:**
   - 2,000 block-bootstrap resamples of monthly returns (preserving autocorrelation).
   - Validated 95% Confidence Interval for Mean Net R and Alpha **must strictly exclude zero**.
5. **Newey-West HAC Robust Alpha:**
   - Time-series regression against SPY and Equal-Weight benchmark:
     $$R_{i,t} - R_{f,t} = \alpha_i + \beta_i (R_{m,t} - R_{f,t}) + \epsilon_t$$
   - Standard errors corrected for heteroskedasticity and autocorrelation (lag = 6 months).
   - Adoption requirement: $\alpha \text{ t-stat} \ge 2.00$ ($p < 0.05$).
6. **Multiple Testing Correction:**
   - Bonferroni penalty across the $M=3$ tested strategies: $\alpha_{\text{target}} = 0.05 / 3 = 0.0167$ ($t_{\text{crit}} \approx 2.40$).
7. **Minimum Detectable Effect (MDE):**
   - Pre-computed required annualized alpha given sample size ($N \approx 16$ years, ~4,000 trading days) at 80% statistical power.
8. **Ex-Top-3 Winners Sensitivity Test:**
   - Remove the 3 largest single-trade winners. If the strategy's total return flips negative, the edge is deemed a fragile outlier artifact.
9. **Sub-Period & Bear Market Audit:**
   - Explicit reporting across full 2010–2026, 2020–2026, and specifically the **2022 Fed tightening bear market**.
10. **Parameter Plateau Sensitivity Grid:**
    - Test adjacent parameters ($\pm 15\%$, $\pm 30\%$) and report the surface. Zero parameter cherry-picking.

---

## 7. Pre-Registered Adoption Verdict Rule

> **Strict Institutional Rule:**  
> A strategy is **ADOPTED** for forward paper trading if and only if:  
> 1. Validated point-in-time Newey-West Alpha t-stat $\ge 2.00$ ($p < 0.05$).  
> 2. Validated 95% Bootstrap Confidence Interval for Net Alpha excludes zero after all friction.  
> 3. Maximum Drawdown is lower than the SPY Buy-and-Hold benchmark.  
>  
> **If none of the strategies beat SPY Buy-and-Hold after costs, we will plainly state that Buy-and-Hold SPY wins.**

---

**Registered by:** Antigravity Quant Team  
**Status:** COMMITTED & SEALED PRIOR TO RUNNING BACKTESTS
