# Pre-Registration Document: Cross-Sectional & Macro Systematic Quantitative Research (Round 3)

> **Document Type:** Institutional Research Pre-Registration  
> **Status:** PRE-REGISTERED & FROZEN (Committed prior to downloading multi-coin data or executing any strategy code)  
> **Repository:** Trader-Pro / Trader-Pro-Dashboard  
> **Branch:** `feat/cost-aware-engine`  
> **Date:** November 2026  
> **Primary Rule:** Zero parameter tuning, zero model searches, zero direction prediction via black-box machine learning. All signals, dynamic universe rules, friction tiers, and statistical screening gates are codified and frozen in this document prior to data access.

---

## 1. Research Motivation & Core Principles

Prior audits in this repository demonstrated that high-frequency directional classifiers (15M, 1H, 4H LightGBM breakout models) failed due to lookahead label leaks, execution simulator bias, and catastrophic fee drag ($0.28\text{R} - 0.50\text{R}$ friction on sub-0.5% stops). Furthermore, historical re-simulations proved that apparent gross gains in simple daily breakout rules were almost entirely systematic market beta ($\beta \approx 0.42 - 0.44$), yielding statistically insignificant alpha ($t_{\alpha} < 1.25$).

Round 3 strictly abandons intraday pattern mining. It investigates whether genuine, non-random edge exists across liquid cryptocurrency perpetual futures using **three classical, non-directional / macro systematic portfolio rules** operating on multi-day holding periods ($D \ge 1\text{ day}$).

---

## 2. Pre-Registered Candidate Hypotheses (Exactly 3)

### Dynamic Universe Selection Rule (Uniform Across All 3 Hypotheses)
To prevent survivorship and selection bias, the universe is **not fixed to today's survivors**. Instead, at each daily rebalance date $t$:
- **Eligible Pool:** The top 20 liquid USDT perpetual contracts ranked by trailing 90-day aggregate quote volume:
  $$\text{Volume}_{i, t-1} = \sum_{k=1}^{90} \text{quote\_volume}_{i, t-k}$$
- **Data Integrity:** Sourced strictly from data published prior to $open[t]$. If a contract was listed less than 90 days prior, it is excluded until 90 days of continuous history accumulate.
- **Survivorship Mitigation:** Any coin delisted or suspended in historical periods drops out dynamically as its volume evaporates.

---

### Hypothesis 1 (H1 — Family A): Contrarian Funding-Rate Extremes
- **Economic Mechanism:** Perpetual funding rates reflect aggregate speculative leverage. When funding reaches extreme positive rates, long positioning is overcrowded and vulnerable to cascading liquidation flushes. Conversely, extreme negative funding reflects excessive short crowding vulnerable to short squeezes.
- **Exact Fixed Signal (Zero Search):**
  - **Rebalance Cadence:** Evaluated daily at 00:00 UTC.
  - **Metric:** Trailing 3-day (9 settlement intervals) cumulative funding rate:
    $$F_{i, t-1} = \sum_{k=1}^9 \text{funding\_rate}_{i, t-k}$$
  - **Point-in-Time Check:** Only funding settlements with published timestamps $T_{\text{publish}} \le open[t]$ are included.
  - **Long Entry Rule:** If $F_{i, t-1} < -0.150\%$ (annualized $\approx -18.25\%$, extreme short crowding) $\implies$ Enter Long at $open[t]$.
  - **Short Entry Rule:** If $F_{i, t-1} > +0.300\%$ (annualized $\approx +36.50\%$, extreme long crowding) $\implies$ Enter Short at $open[t]$.
- **Execution & Holding Period:**
  - Filled at $open[t]$ (next-bar open).
  - Fixed holding period: **Exactly $D = 3\text{ calendar days}$ (72 hours)**. Exit executed at $open[t+3]$.
  - Zero intrabar stops or ratchets (eliminates execution simulator bias).
- **Portfolio Sizing:** Equal-weighted across all triggered coins on day $t$, capped at $1.0\times$ portfolio notional. Unallocated capital is held in cash ($0.0\%$ return).

---

### Hypothesis 2 (H2 — Family B): Open-Interest Change + Price Direction
- **Economic Mechanism:** Breakouts accompanied by substantial open interest expansion represent fresh institutional capital committing to a new macro directional trend, distinguishing sustained momentum from low-volume liquidity traps or short-covering bounces.
- **Exact Fixed Signal (Zero Search):**
  - **Rebalance Cadence:** Evaluated daily at 00:00 UTC.
  - **Price Metric:** 5-day cumulative price return:
    $$R_{i, 5d}(t-1) = \frac{close_{i, t-1}}{close_{i, t-6}} - 1$$
  - **Open Interest Metric:** 5-day percentage change in contract open interest:
    $$\Delta\text{OI}_{i, 5d}(t-1) = \frac{\text{OI}_{i, t-1}}{\text{OI}_{i, t-6}} - 1$$
  - **Point-in-Time Check:** Metrics bar $t-1$ must have open time strictly prior to $open[t]$.
  - **Long Entry Rule:** If $R_{i, 5d}(t-1) > +5.0\%$ AND $\Delta\text{OI}_{i, 5d}(t-1) > +10.0\%$ $\implies$ Enter Long at $open[t]$.
  - **Short Entry Rule:** If $R_{i, 5d}(t-1) < -5.0\%$ AND $\Delta\text{OI}_{i, 5d}(t-1) > +10.0\%$ $\implies$ Enter Short at $open[t]$.
- **Execution & Holding Period:**
  - Filled at $open[t]$ (next-bar open).
  - Fixed holding period: **Exactly $D = 5\text{ calendar days}$ (120 hours)**. Exit executed at $open[t+5]$.
  - Zero intrabar stops or ratchets.
- **Portfolio Sizing:** Equal-weighted across all triggered coins on day $t$, capped at $1.0\times$ portfolio notional. Unallocated capital held in cash ($0.0\%$).

---

### Hypothesis 3 (H3 — Family C): Cross-Sectional Momentum (Dollar-Neutral Spread)
- **Economic Mechanism:** Cross-sectional momentum (relative winners outperforming relative losers over multi-week horizons) is an established structural asset pricing phenomenon driven by gradual institutional capital reallocation. Constructing the strategy as a dollar-neutral long/short spread neutralizes directional market beta ($\beta \approx 0$).
- **Exact Fixed Signal (Zero Search):**
  - **Rebalance Cadence:** Bi-weekly (every 14 calendar days on alternating Mondays at 00:00 UTC).
  - **Metric:** Trailing 14-day cumulative return across the eligible Top 20 dynamic universe:
    $$\text{Mom}_{i, t-1} = \frac{close_{i, t-1}}{close_{i, t-15}} - 1$$
  - **Long Portfolio:** Top 4 ranked coins by 14-day momentum, weighted equally at $+12.5\%$ notional each (total $+50.0\%$ Long).
  - **Short Portfolio:** Bottom 4 ranked coins by 14-day momentum, weighted equally at $-12.5\%$ notional each (total $-50.0\%$ Short).
- **Execution & Holding Period:**
  - Net market exposure = $0.0\%$ (dollar-neutral), gross exposure = $1.0\times$.
  - Fixed holding period: **Exactly $D = 14\text{ calendar days}$**, rebalanced at open of every 14th day.
- **Effective Sample Size ($N_{\text{eff}}$) Disclosure:**
  - In preliminary Phase 1 modeling, the residual correlation across 4 altcoins was measured at $\bar{\rho}_{\text{residual}} = 0.2756$, suggesting $N_{\text{eff}} \approx 2.73$ for an 8-coin basket.
  - **`[EXPLICIT ASSUMPTION]`**: This $N_{\text{eff}} \approx 2.73$ figure is an **assumption** based on the 4 locally available coins (`ETH`, `BNB`, `SOL`, `XRP`) relative to BTC. The true effective sample size will be empirically calculated from the full cross-sectional covariance matrix once all historical coin series are downloaded.

---

## 3. Reporting Units, Cost Model & Friction Realism

### 3.1 Strict Prohibition of "R" Units for Daily-Hold Rules
Historical audits demonstrated that normalizing multi-day trades by an arbitrary fixed stop distance distorted performance reporting. Therefore:
- **"R units" are strictly PROHIBITED for all daily-hold rules in Round 3.**
- All performance metrics must be reported strictly in:
  1. **Net Return per Trade in Basis Points (bps):** $1\text{ bp} = 0.01\% = 0.0001$.
  2. **Daily Sharpe Ratio:** $\text{Sharpe}_{\text{daily}} = \frac{\text{mean}(r_{\text{daily}})}{\text{std}(r_{\text{daily}})} \times \sqrt{365}$ ($r_f = 0.0\%$, 365-day continuous crypto calendar).
  3. **Annualized Two-Way Portfolio Turnover:** $\sum_{t} |w_t - w_{t-1}|$.
  4. **Maximum Drawdown (MaxDD):** Descriptive peak-to-trough percentage decline.

---

### 3.2 Unified Cost Model
All candidate rules must report performance across two standardized fee tiers:

| Cost Tier | Per-Side Cost | Round-Trip Cost | Practical Application |
| :--- | :---: | :---: | :--- |
| **Tier 1: Base Cost** | **`7.0 bps`** ($0.0007$) | **`14.0 bps`** ($0.0014$) | VIP institutional taker rate on Binance Futures ($0.040\%$ fee $+ 18\%$ GST $+ 0.010\%$ slippage $+ 0.0128\%$ buffer). |
| **Tier 2: Punishing Cost** | **`25.0 bps`** ($0.0025$) | **`50.0 bps`** ($0.0050$) | Stress test matching `backtest-expert` methodology ($0.100\%$ retail taker fee $+ 0.050\%$ half-spread $+ 0.100\%$ adverse execution slippage). |

> **Critical Friction Hurdle:**  
> At the punishing cost tier ($50\text{ bps}$ round-trip), any macro rule requires **more than about $0.50\%$ ($50\text{ bps}$) gross return per trade just to break even**. A strategy generating $+0.30\%$ ($30\text{ bps}$) gross expectancy is a guaranteed net loser of $-20\text{ bps}$ per trade.

---

## 4. Historical Screening Bar (Exploratory / Dev Window)

Historical data (January 1, 2020 through November 6, 2026) is classified strictly as the **exploratory / development window**. A candidate rule is eligible for consideration in forward paper testing if and only if it satisfies all three screening hurdles:

### Hurdle 1: Stationary Block-Bootstrap Net Significance at Punishing Tier
- **Bootstrap Parameters:** Stationary block bootstrap (Politis & Romano, 1994), fixed block length $L = 20\text{ days}$, exactly $B = 10,000$ resamples.
- **Multiple Testing Family:** Penalized by the **project-wide cumulative macro/derivatives test count**:
  - Donchian 20/10 tests on BTC & ETH: **2**
  - Round 2 Pre-Registered hypotheses: **3**
  - BTC Derivatives Studies (`run_derivatives_study.py` G0–G3 across 1H/4H): **8**
  - BTC Final Structural Studies (`evaluate_final.py` A3, B1 variants): **4**
  - Round 3 Candidate Rules: **3**
  - **Total Project Macro Hypothesis Count:** $M = \mathbf{20 \text{ tests}}$
- **Significance Level:**
  $$\alpha_{\text{screening}} = \frac{0.05}{M} = \frac{0.05}{20} = \mathbf{0.0025} \quad (0.25\%)$$
- **Screening Rule:** The **$0.125^{\text{th}}$ percentile of net return** (and net $\Delta\text{Sharpe}$ vs passive buy-and-hold) under the **Punishing Cost Tier ($50\text{ bps}$ round-trip)** must be strictly $> 0.0$ ($99.75\%$ CI excludes zero).

---

### Hurdle 2: Beta-Adjusted Residual Alpha Gate (Dual-Regime Consistency)
Apparent historical returns must not represent unhedged systematic market beta. Daily strategy net returns are regressed against market buy-and-hold returns using returns-based OLS with Newey-West HAC standard errors (20-day lag bandwidth):
$$r_{\text{strat}, t} = \alpha + \beta r_{\text{mkt}, t} + \epsilon_t$$

- **Full Period:** Annualized residual alpha $\alpha_{\text{ann}} = \alpha \times 365$ must achieve $t_{\text{HAC}} \ge 2.0$.
- **Dual-Regime Invariance:** In addition, residual alpha $\alpha_{\text{ann}}$ must be **strictly positive ($> 0.0$) in BOTH distinct historical market regimes**:
  1. **Regime 1 (2020–2021 Crypto Bull Market):** `2020-01-01` to `2021-12-31`.
  2. **Regime 2 (2022 Crypto Bear Market):** `2022-01-01` to `2022-12-31`.

> **Explicit Methodological Caution:**  
> Surviving two historical regimes is an inherently **weak check** (a regime represents only 1–2 cycles; past survival does not imply invariance to future regime shifts). Historical screening decides **only** which candidate rules qualify to advance to real-time paper trading. It **never** constitutes proof of live profitability.

---

## 5. Forward Real-Time Sealed Test Rules

To ensure complete scientific integrity and eliminate all survivorship and lookahead biases, the true sealed validation test is defined strictly as **live forward data recorded in real time starting from today (November 7, 2026 onward)**:

1. **Maximum Rules Carried Forward:** At most **$K \le 2$ candidate rules** that pass the historical screening bar may be carried forward into real-time paper monitoring.
2. **Forward Multiple-Testing Penalty:** The forward test is penalized strictly by the number of rules deployed forward ($K$):
   - If $K = 2$ rules: $\alpha_{\text{forward}} = \frac{0.05}{2} = \mathbf{0.025} \implies \mathbf{97.50\% \text{ CI }} [1.25\%, 98.75\%]$.
   - If $K = 1$ rule: $\alpha_{\text{forward}} = \mathbf{0.050} \implies \mathbf{95.00\% \text{ CI }} [2.50\%, 97.50\%]$.
3. **Fixed Quarterly Review Cadence:** Strategy health and performance metrics are reviewed strictly on pre-declared calendar quarter-ends:
   - **Q1:** March 31
   - **Q2:** June 30
   - **Q3:** September 30
   - **Q4:** December 31
4. **Minimum Independent Observations Gate:** No pass/fail decision may be rendered until a minimum of **$N_{\text{indep}} \ge 100$ independent observations** (or at least 12 continuous calendar months of forward data) have accumulated.
5. **Strict Prohibition of Early Stopping:** No early termination on good short-term results. Positive runs over 2–3 months are statistically noisy and cannot truncate the forward observation period.
6. **One-Year Live Money Bar:**  
   > [!IMPORTANT]  
   > **Mandatory Capital Rule:** No forward result in the first 12 months can justify live capital deployment. All execution remains 100% paper trading for a minimum of one full calendar year.

---

## 6. Formal Null Controls & Noise Verification

Every candidate rule must be evaluated alongside three pre-registered null benchmarks:

1. **Shuffled-Signal Null (Cross-Sectional Permutation):**
   - On each day $t$, permute the cross-sectional signals/rankings randomly across the dynamic universe while keeping the return distribution identical.
   - Preserves asset volatility and market beta while destroying any predictive signal-to-return coupling. The candidate strategy must statistically outperform the shuffled null ($p < 0.01$).
2. **Random-Entry Null (Monte Carlo Benchmark):**
   - Execute random trade entries across eligible assets matching the candidate rule's exact trade frequency and holding duration ($D$), evaluated across 1,000 independent random seeds.
3. **Noise-Null Simulator Invariant:**
   - Run the simulation engine on synthetic Geometric Brownian Motion (GBM) and block-bootstrapped return series with zero drift.
   - The execution engine must produce a mean net return of exactly $0.00\text{ bps}$ minus round-trip friction, proving zero simulator bias.

---

## 7. Execution Invariants & Summary Specification

| Parameter / Invariant | Pre-Registered Specification | Rationale |
| :--- | :--- | :--- |
| **Candidate Hypotheses** | Exactly 3 (H1: Contrarian Funding, H2: OI + Trend, H3: Cross-Sectional Mom) | Strictly non-directional / macro systematic. |
| **Universe Selection** | Dynamic Top 20 by trailing 90-day quote volume | Strictly point-in-time; eliminates survivorship bias. |
| **Holding Horizons ($D$)** | H1: $3\text{ days}$; H2: $5\text{ days}$; H3: $14\text{ days}$ | Multi-day macro holding; zero intraday scalping. |
| **Execution Price** | $open[t]$ (Next-bar open) | Same-bar close fills strictly forbidden. |
| **Point-in-Time Data Gate** | $T_{\text{publish}} \le open[t]$ for funding settlements and OI | Eliminates lookahead in derivatives data. |
| **Reporting Units** | Net return in bps per trade, daily Sharpe, turnover | **R units explicitly prohibited for daily rules.** |
| **Base Cost Tier** | $7.0\text{ bps}$ per side / $14.0\text{ bps}$ round-trip | VIP institutional taker rate on Binance Futures. |
| **Punishing Cost Tier** | $25.0\text{ bps}$ per side / $50.0\text{ bps}$ round-trip | Realistic retail taker + spread + slippage stress test. |
| **Bootstrap Method** | Stationary Block Bootstrap ($L = 20\text{ days}$, $B = 10,000$) | Preserves return autocorrelation and volatility regimes. |
| **Historical Screening Gate** | $99.75\%$ CI lower bound $> 0.0$ at punishing cost tier ($M = 20$) | Strict family-wise multiple testing control. |
| **Regime Invariance Gate** | $\alpha_{\text{ann}} > 0.0$ in both 2020–2021 Bull and 2022 Bear | Rejects regime-fragile rules before paper trading. |
| **Forward Test Rules** | Max 2 rules, $N_{\text{indep}} \ge 100$, no early stopping | True out-of-sample forward paper test. |
| **Live Money Constraint** | 100% paper trading for minimum 12 months | Prevents premature capital allocation on short runs. |
