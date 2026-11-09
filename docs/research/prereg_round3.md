# Pre-Registration Document: Cross-Sectional & Macro Systematic Quantitative Research (Round 3)

> **Document Type:** Institutional Research Pre-Registration (Amended — Version 3)  
> **Status:** PRE-REGISTERED & FROZEN (Committed prior to executing any strategy returns or PnL code)  
> **Repository:** Trader-Pro / Trader-Pro-Dashboard  
> **Branch:** `feat/cost-aware-engine`  
> **Initial Commit:** `5322da3` (*prereg round3, before any results*)  
> **Amendment 1 Commit:** `4478227` (*prereg round3 amendment 1, before any results*)  
> **Amendment 2 Commit:** `prereg round3 amendment 2, before any results`  
> **Date:** November 2026  
> **Primary Rule:** Zero parameter tuning, zero model searches, zero direction prediction via black-box machine learning. All signals, dynamic universe rules, friction tiers, screening gates, and runtime anti-tampering verification are codified and frozen in this document prior to data access.

---

## Amendment 2 Change Log (Methodological Hardening, Cross-Exchange Disclosure & Portfolio Aggregation)

Prior to executing any backtest return calculations or strategy PnL evaluations, Round 3 pre-registration is amended with six critical methodological clarifications:

1. **Exact Data Provenance & Cross-Exchange Mixing Disclosure:**
   - **Daily Klines:** Binance USD-M Futures public REST API (`https://fapi.binance.com/fapi/v1/klines?symbol={symbol}&interval=1d&limit=1500`).
   - **8-Hour Funding Rates:** Binance USD-M Futures public REST API (`https://fapi.binance.com/fapi/v1/fundingRate?symbol={symbol}&limit=500`).
   - **Daily Open Interest:** Bybit Linear Perpetuals public REST API (`https://api.bybit.com/v5/market/open-interest?category=linear&symbol={symbol}&intervalTime=1d&limit=200`).
   - > [!WARNING]
     > **FLAG: CROSS-EXCHANGE MIXING DISCLOSURE:**
     > Klines and funding rates are sourced from Binance USD-M Futures, while Open Interest is sourced from Bybit Linear Perpetuals. This cross-exchange mixing introduces venue-divergence basis risk: Bybit OI reflects Bybit institutional and retail positioning growth, while execution fills and funding drag are evaluated against Binance. While aggregate leverage trends correlate across venues, venue-specific liquidations and delta-neutral basis trades on Bybit may not perfectly map to Binance order flow.
2. **Point-in-Time Daily Open Interest Snapshot Definition:**
   - In Bybit v5 API (`intervalTime=1d`), each daily observation is timestamped at `00:00:00 UTC` of date $t$.
   - **Snapshot Identification:** This record corresponds to the point-in-time open interest snapshot captured at `00:00:00 UTC` at the start of date $t$.
   - **Lookahead Verification:** The trading decision for bar $t$ occurs at bar $t$ close (`23:59:59 UTC`), and position entry executes at next-bar open (`00:00:01 UTC` on date $t+1$). Because the date $t$ OI value was snapshot at `00:00:00 UTC` on date $t$, it is **known 24 hours prior to entry** at $t+1$ open. The conservative 5-day delta $\Delta\text{OI}_{5d} = \text{OI}_t / \text{OI}_{t-5} - 1$ is strictly free of lookahead bias ($T_{\text{publish}} < T_{\text{signal}} < T_{\text{entry}}$).
3. **Dynamic Universe Ranking & Prominent "SURVIVOR-BIASED" Disclosure:**
   - Universe selection follows the dynamic ranking rule: on each rebalance date $t$, eligible assets are the **Top 20 by trailing 90-day aggregate quote volume** among available coins:
     $$\text{Volume}_{i, t-1} = \sum_{k=1}^{90} \text{quote volume}_{i, t-k}$$
   - **SURVIVORSHIP BIAS DISCLOSURE:** Because the candidate pool was downloaded from the top 20 liquid perpetual contracts as of November 2026, historically delisted or defunct contracts (e.g., LUNA, FTT) are not present in the historical pool. Consequently, **every backtest result is explicitly labeled "SURVIVOR-BIASED" in all report headers and summaries**.
4. **Independent Observation Counting via Daily Portfolio Return Aggregation:**
   - To account for strong cross-sectional correlation across crypto assets and prevent artificial sample-size inflation, independent observations are **NOT counted as individual coin trade signals**.
   - Instead, on each day $t$, active position returns are aggregated into an **equal-weighted daily portfolio return**:
     $$R_{p, t} = \begin{cases} \frac{1}{|S_t|} \sum_{i \in S_t} R_{i, t}, & \text{if } |S_t| > 0 \\ 0.0, & \text{if } |S_t| = 0 \text{ (cash)} \end{cases}$$
     where $S_t$ is the active position set.
   - The stationary block bootstrap ($L = 20\text{ days}$, $B = 10,000$ resamples) is conducted strictly on the **daily portfolio return series $R_{p, t}$**.
   - The mandatory minimum power requirement of $N_{\text{indep}} \ge 100$ independent observations counts **distinct calendar days where $|S_t| > 0$** at the portfolio level, not total individual trade tickets.
5. **Pre-Registered BTC Exclusion from H1 and H2 Headline Screening:**
   - Because historical BTC derivatives data directly informed the numerical thresholds for H1 ($-0.150\% / +0.300\%$) and H2 ($+10\%$ OI, $\pm 5\%$ price), **BTC is strictly EXCLUDED from the primary headline screening portfolio for H1 and H2**.
   - Headline statistical significance tests and screening gates are computed solely across the remaining 19 altcoins. BTC results are reported separately for **informational and descriptive purposes only**.
6. **Empirical Distribution of H1 Short Signals by Calendar Year (Regime Distortion Audit):**
   - An audit of the H1 short condition ($> +0.300\%$ 3-day cumulative funding) reveals severe regime concentration:

| Year | Total Coin-Days (All 20) | Short Signals | Long Signals | Short Signal Share (%) | Long Signal Share (%) | Altcoin Short Share (Excl. BTC) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **2019** | 151 | 3 | 2 | 1.99% | 1.32% | 0.00% |
| **2020** | 5,024 | 1,048 | 370 | **20.86%** | 7.36% | **21.36%** |
| **2021** | 7,300 | 2,393 | 265 | **32.78%** | 3.63% | **32.95%** |
| **2022** | 7,300 | 0 | 761 | **0.00%** | 10.42% | **0.00%** |
| **2023** | 7,300 | 93 | 320 | 1.27% | 4.38% | 1.30% |
| **2024** | 7,320 | 550 | 171 | 7.51% | 2.34% | 7.61% |
| **2025** | 7,300 | 0 | 210 | **0.00%** | 2.88% | **0.00%** |
| **2026** | 6,200 | 0 | 181 | **0.00%** | 2.92% | **0.00%** |

   - **Key Finding:** Exactly **3,441 out of 4,087 short signals (84.2%) fired exclusively during the 2020–2021 bull run**. In 2022, 2025, and 2026, the short rule fired **0 times (0.00%)**.
   - **Conclusion:** The H1 short leg is essentially a **bull-market euphoria filter**. It cannot be relied upon as an all-weather hedge during bear markets or institutional chop regimes.

---

## Amendment 1 Change Log (Pre-Execution Methodological Audit)

Prior to downloading data or executing any evaluation code, Round 3 pre-registration is amended to incorporate seven rigorous institutional standards:

1. **Threshold Provenance & Prior Knowledge Disclosure:**
   - Full disclosure of the historical origin of every threshold across H1, H2, and H3:
     - *H1 ($-0.150\%$ and $+0.300\%$ 3-day funding):* **Directly derived from prior inspection of BTC funding data** in `run_derivatives_study.py` and `evaluate_final.py` (reflecting liquidation tails on BTC).
     - *H2 ($+5\%$ price, $+10\%$ OI change):* **Directly influenced by prior inspection of BTC open interest distributions** in `metrics_BTCUSDT_1h.parquet` (where 5-day $10\%$ surges represent $>2\sigma$ positioning expansions).
     - *H3 (14-day momentum, Top/Bottom 4):* Sourced from academic crypto factor literature (Liu, Tsyvinski & Wu, 2022) with quintile sorting ($4 / 20 = 20\%$).
2. **Explicit Funding Cashflow Accounting:**
   - Realized net return for all three hypotheses explicitly includes **all 8-hour funding cashflows paid or received during the holding period**:
     $$\text{Net Return} = \text{Price Return} + \text{Funding Cashflow} - \text{Friction}$$
     - *H1 (Contrarian Funding):* Longs on extreme negative funding and Shorts on extreme positive funding **receive positive funding yield**.
     - *H2 (OI + Trend):* Breakout longs in high-funding regimes **pay funding drag**, reducing net return.
     - *H3 (Cross-Sectional Momentum L/S):* Captures the net carrying cost between long winners and short losers.
3. **Altcoin OI History Truncation & Adjusted H2 Gate:**
   - Altcoin daily open interest on Binance Data Vision starts around **mid-to-late 2021** (unlike BTC which begins Sep 2020).
   - Therefore, the 2020–2021 Bull Market check for H2 covers only the available historical period (e.g. `2021-06-01` to `2021-12-31`). H2's screening gate requires full-period net significance, 2022 Bear Market positive alpha, and positive alpha in the available 2021 bull window.
4. **Harmonized Significance Standard ($99.75\% \iff |t| \ge 3.0$):**
   - The screening confidence interval and regression $t$-statistic threshold are locked to the same statistical standard:
     $$\mathbf{99.75\% \text{ Bootstrap CI Lower Bound } > 0} \iff \mathbf{|t_{\text{HAC}}| \ge 3.0}$$
     The unadjusted $|t| \ge 2.0$ legacy hurdle is formally retired.
5. **Confirmed Project-Wide Test Count ($M = 20$):**
   - After formally removing Family D (carry), the project-wide cumulative macro/derivatives hypothesis count is confirmed at **$M = 20$ tests**:
     $$M = 2 \text{ (Donchian)} + 3 \text{ (Round 2)} + 8 \text{ (BTC Deriv G0-G3)} + 4 \text{ (BTC Final A3/B1)} + 3 \text{ (Round 3)} = \mathbf{20}$$
     $$\alpha_{\text{screening}} = \frac{0.05}{20} = 0.0025 \implies \mathbf{99.75\% \text{ CI }} [0.125\%, 99.875\%]$$
6. **Forward Anti-Tampering Runtime Architecture:**
   - Any rule carried forward into paper testing must have its code hashed via dynamic runtime file reading (`hashlib.sha256(open(__file__, "rb").read()).hexdigest()`). Hardcoded hash string constants (the 1H-A flaw) are **strictly forbidden**.
   - Every forward paper signal must log `signal_time` and `data_publish_time` to prove $T_{\text{publish}} \le T_{\text{signal}}$.
7. **Exchange Tradability Gate & Research-Only Classification:**
   - The 20-coin universe is based on Binance perpetuals. Unless the user provides the verified list of tradable perpetuals on their specific exchange, the universe is formally classified as **`RESEARCH-ONLY`**. No forward rule may be wired to execution without exchange whitelist confirmation.

---

## 1. Research Motivation & Core Principles

Prior audits in this repository demonstrated that high-frequency directional classifiers (15M, 1H, 4H LightGBM breakout models) failed due to lookahead label leaks, execution simulator bias, and catastrophic fee drag ($0.28\text{R} - 0.50\text{R}$ friction on sub-0.5% stops). Furthermore, historical re-simulations proved that apparent gross gains in simple daily breakout rules were almost entirely systematic market beta ($\beta \approx 0.42 - 0.44$), yielding statistically insignificant alpha ($t_{\alpha} < 1.25$).

Round 3 strictly abandons intraday pattern mining. It investigates whether genuine, non-random edge exists across liquid cryptocurrency perpetual futures using **three classical, non-directional / macro systematic portfolio rules** operating on multi-day holding periods ($D \ge 1\text{ day}$).

---

## 2. Pre-Registered Candidate Hypotheses (Exactly 3)

### Dynamic Universe Selection Rule (Uniform Across All 3 Hypotheses)
To prevent survivorship and selection bias, the universe is **not fixed to today's survivors**. Instead, at each daily rebalance date $t$:
- **Eligible Pool:** The top 20 liquid USDT perpetual contracts ranked by trailing 90-day aggregate quote volume:
  $$\text{Volume}_{i, t-1} = \sum_{k=1}^{90} \text{quote volume}_{i, t-k}$$
- **Data Integrity:** Sourced strictly from data published prior to $open[t]$. If a contract was listed less than 90 days prior, it is excluded until 90 days of continuous history accumulate.
- **Survivorship Mitigation:** Any coin delisted or suspended in historical periods drops out dynamically as its volume evaporates.
- **Tradability Status:** Unless confirmed against the user's live exchange tradable instrument manifest, this 20-coin universe is formally marked **`RESEARCH-ONLY`**.

---

### Hypothesis 1 (H1 — Family A): Contrarian Funding-Rate Extremes
- **Economic Mechanism:** Perpetual funding rates reflect aggregate speculative leverage. When funding reaches extreme positive rates, long positioning is overcrowded and vulnerable to cascading liquidation flushes. Conversely, extreme negative funding reflects excessive short crowding vulnerable to short squeezes.
- **Threshold Provenance (Disclosure):**
  - The thresholds ($-0.150\%$ and $+0.300\%$ 3-day cumulative funding) **were directly derived from prior historical observation of BTC funding distributions** in `run_derivatives_study.py` and `evaluate_final.py`. They correspond to $>3\times$ baseline funding rates observed during historical BTC liquidation cascades (Nov 2021, May 2021, Nov 2022). They are not independent theoretical constants.
- **Exact Fixed Signal (Zero Search):**
  - **Rebalance Cadence:** Evaluated daily at 00:00 UTC.
  - **Metric:** Trailing 3-day (9 settlement intervals) cumulative funding rate:
    $$F_{i, t-1} = \sum_{k=1}^9 \text{funding rate}_{i, t-k}$$
  - **Point-in-Time Check:** Only funding settlements with published timestamps $T_{\text{publish}} \le open[t]$ are included.
  - **Long Entry Rule:** If $F_{i, t-1} < -0.150\%$ (annualized $\approx -18.25\%$, extreme short crowding) $\implies$ Enter Long at $open[t]$.
  - **Short Entry Rule:** If $F_{i, t-1} > +0.300\%$ (annualized $\approx +36.50\%$, extreme long crowding) $\implies$ Enter Short at $open[t]$.
- **Execution & Holding Period:**
  - Filled at $open[t]$ (next-bar open).
  - Fixed holding period: **Exactly $D = 3\text{ calendar days}$ (72 hours)**. Exit executed at $open[t+3]$.
  - Zero intrabar stops or ratchets (eliminates execution simulator bias).
- **Portfolio Sizing & Funding Cashflows:**
  - Equal-weighted across all triggered coins on day $t$, capped at $1.0\times$ portfolio notional. Unallocated capital is held in cash ($0.0\%$ return).
  - **Funding Accounting:** Strategy receives all positive funding cashflows collected when entering Long on negative funding or Short on positive funding.

---

### Hypothesis 2 (H2 — Family B): Open-Interest Change + Price Direction
- **Economic Mechanism:** Breakouts accompanied by substantial open interest expansion represent fresh institutional capital committing to a new macro directional trend, distinguishing sustained momentum from low-volume liquidity traps or short-covering bounces.
- **Threshold Provenance (Disclosure):**
  - The $+5\%$ price and $+10\%$ open interest surge thresholds **were directly influenced by prior observation of BTC derivatives metrics** in `metrics_BTCUSDT_1h.parquet`. A $10\%$ multi-day OI expansion represents a $>2\sigma$ positioning shock on BTC.
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
- **Portfolio Sizing & Funding Drag:**
  - Equal-weighted across all triggered coins on day $t$, capped at $1.0\times$ portfolio notional.
  - **Funding Accounting:** Any funding rate payments incurred during the 5-day holding period (e.g. longs paying positive funding) are strictly deducted from net return.

---

### Hypothesis 3 (H3 — Family C): Cross-Sectional Momentum (Dollar-Neutral Spread)
- **Economic Mechanism:** Cross-sectional momentum (relative winners outperforming relative losers over multi-week horizons) is an established structural asset pricing phenomenon driven by gradual institutional capital reallocation. Constructing the strategy as a dollar-neutral long/short spread neutralizes directional market beta ($\beta \approx 0$).
- **Threshold Provenance (Disclosure):**
  - The 14-day lookback is sourced from academic cryptocurrency cross-sectional momentum literature (Liu, Tsyvinski & Wu, 2022). Top 4 and Bottom 4 represent the top and bottom quintiles ($20\%$) of the 20-coin universe.
- **Exact Fixed Signal (Zero Search):**
  - **Rebalance Cadence:** Bi-weekly (every 14 calendar days on alternating Mondays at 00:00 UTC).
  - **Metric:** Trailing 14-day cumulative return across the eligible Top 20 dynamic universe:
    $$\text{Mom}_{i, t-1} = \frac{close_{i, t-1}}{close_{i, t-15}} - 1$$
  - **Long Portfolio:** Top 4 ranked coins by 14-day momentum, weighted equally at $+12.5\%$ notional each (total $+50.0\%$ Long).
  - **Short Portfolio:** Bottom 4 ranked coins by 14-day momentum, weighted equally at $-12.5\%$ notional each (total $-50.0\%$ Short).
- **Execution & Holding Period:**
  - Net market exposure = $0.0\%$ (dollar-neutral), gross exposure = $1.0\times$.
  - Fixed holding period: **Exactly $D = 14\text{ calendar days}$**, rebalanced at open of every 14th day.
  - **Funding Accounting:** The net spread funding cashflow ($\sum \text{Funding}_{\text{Shorts}} - \sum \text{Funding}_{\text{Longs}}$) is continuously credited/debited to portfolio return.
- **Effective Sample Size ($N_{\text{eff}}$) Disclosure:**
  - **`[EXPLICIT ASSUMPTION]`**: The preliminary $N_{\text{eff}} \approx 2.73$ figure is an **assumed placeholder** derived from residual correlation on 4 local altcoins relative to BTC. The true effective sample size will be empirically calculated from the full cross-sectional covariance matrix once all historical coin series are downloaded.

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

Historical data (January 1, 2020 through November 6, 2026) is classified strictly as the **exploratory / development window**.

> [!IMPORTANT]
> **SURVIVORSHIP BIAS & BTC EXCLUSION MANDATE:**
> 1. **Survivor-Biased Data Warning:** All historical results are explicitly classified as **"SURVIVOR-BIASED"** due to evaluating the top 20 contracts surviving in 2026 without incorporating defunct/delisted historical tokens.
> 2. **BTC Excluded from Headline Screening:** Because BTC derivatives distributions directly informed H1 and H2 parameters, the primary headline screening portfolio for H1 and H2 **strictly excludes BTC**. BTC performance is evaluated separately and presented solely as a descriptive/informational benchmark.
> 3. **Portfolio-Level Aggregation:** All statistical tests (block bootstrap, Sharpe, HAC regression, turnover) are evaluated strictly on the **daily portfolio return series $R_{p, t}$** (equal-weighted across active coin positions). Distinct signal days ($|S_t| > 0$) must exceed $N_{\text{indep}} \ge 100$. Individual coin trade tickets are not counted as independent bets.

A candidate rule is eligible for consideration in forward paper testing if and only if it satisfies all three screening hurdles:

### Hurdle 1: Stationary Block-Bootstrap Net Significance at Punishing Tier
- **Bootstrap Parameters:** Stationary block bootstrap (Politis & Romano, 1994), fixed block length $L = 20\text{ days}$, exactly $B = 10,000$ resamples executed on daily portfolio return series $R_{p, t}$.
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

### Hurdle 2: Harmonized Beta-Adjusted Residual Alpha Standard ($|t| \ge 3.0$)
Apparent historical returns must not represent unhedged systematic market beta. Daily strategy net returns are regressed against market buy-and-hold returns using returns-based OLS with Newey-West HAC standard errors (20-day lag bandwidth):
$$r_{\text{strat}, t} = \alpha + \beta r_{\text{mkt}, t} + \epsilon_t$$

- **Harmonized Significance Gate:** The $t$-statistic threshold is locked to the $99.75\%$ confidence level:
  $$\mathbf{|t_{\text{HAC}}| \ge 3.0}$$
  The strategy must produce statistically significant annualized residual alpha $\alpha_{\text{ann}} = \alpha \times 365$ with $|t_{\text{HAC}}| \ge 3.0$.

---

### Hurdle 3: Regime Invariance Gate (Bull & Bear Consistency)
In addition to full-period significance, annualized residual alpha $\alpha_{\text{ann}}$ must be **strictly positive ($> 0.0$) in BOTH distinct historical market regimes**:
1. **Regime 1 (2020–2021 Crypto Bull Market):** `2020-01-01` to `2021-12-31`.
   - *Special Rule for H2 (OI + Trend):* Because altcoin open interest history begins around mid-2021 on Binance Data Vision, H2's Regime 1 check covers strictly the **available 2021 Bull Window** (`2021-06-01` to `2021-12-31`, or earliest date where $\ge 10$ coins have valid history).
2. **Regime 2 (2022 Crypto Bear Market):** `2022-01-01` to `2022-12-31` (full 12 months for all hypotheses).

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
   - **Q1:** March 31 | **Q2:** June 30 | **Q3:** September 30 | **Q4:** December 31
4. **Minimum Independent Observations Gate:** No pass/fail decision may be rendered until a minimum of **$N_{\text{indep}} \ge 100$ independent observations** (or at least 12 continuous calendar months of forward data) have accumulated.
5. **Strict Prohibition of Early Stopping:** No early termination on good short-term results. Positive runs over 2–3 months are statistically noisy and cannot truncate the forward observation period.
6. **One-Year Live Money Bar:**  
   > [!IMPORTANT]  
   > **Mandatory Capital Rule:** No forward result in the first 12 months can justify live capital deployment. All execution remains 100% paper trading for a minimum of one full calendar year.
7. **Runtime Anti-Tampering & Publish-Time Architecture:**
   - Signal code for forward-deployed rules must reside in committed script files.
   - **Dynamic Runtime Hashing:** At execution time, the script must calculate its own SHA-256 hash directly from the physical source file on disk (`hashlib.sha256(open(__file__, "rb").read()).hexdigest()`) and assert a match against the pre-registered manifest. Hardcoded hash string constants are prohibited.
   - **Data Publish-Time Logging:** Every forward signal recorded in the database must log `signal_time` alongside `data_publish_time` (the exchange's published settlement timestamp or candle close), asserting $T_{\text{publish}} \le T_{\text{signal}}$.

---

## 6. Formal Null Controls & Noise Verification

Every candidate rule must be evaluated alongside three pre-registered null benchmarks:

1. **Shuffled-Signal Null (Cross-Sectional Permutation):**
   - On each day $t$, permute the cross-sectional signals/rankings randomly across the dynamic universe while keeping the return distribution identical.
   - Preserves asset volatility and market beta while destroying any predictive signal-to-return coupling. The candidate strategy must statistically outperform the shuffled null ($p < 0.0025$).
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
| **Universe Selection** | Dynamic Top 20 by trailing 90-day quote volume | Strictly point-in-time past data; eliminates survivorship bias. |
| **Tradability Status** | `RESEARCH-ONLY` until user provides exchange tradable list | Prevents wiring untradable altcoins to execution. |
| **Holding Horizons ($D$)** | H1: $3\text{ days}$; H2: $5\text{ days}$; H3: $14\text{ days}$ | Multi-day macro holding; zero intraday scalping. |
| **Execution Price** | $open[t]$ (Next-bar open) | Same-bar close fills strictly forbidden. |
| **Funding Accounting** | Included in all net returns (paid/received) | Captures true perpetual carrying cost/yield. |
| **Reporting Units** | Net return in bps per trade, daily Sharpe, turnover | **R units explicitly prohibited for daily rules.** |
| **Base Cost Tier** | $7.0\text{ bps}$ per side / $14.0\text{ bps}$ round-trip | VIP institutional taker rate on Binance Futures. |
| **Punishing Cost Tier** | $25.0\text{ bps}$ per side / $50.0\text{ bps}$ round-trip | Realistic retail taker + spread + slippage stress test. |
| **Bootstrap Method** | Stationary Block Bootstrap ($L = 20\text{ days}$, $B = 10,000$) | Preserves return autocorrelation and volatility regimes. |
| **Historical Screening Gate** | $99.75\%$ CI lower bound $> 0.0$ at punishing tier ($M = 20$) | Strict family-wise multiple testing control. |
| **Significance Standard** | Harmonized $99.75\% \iff |t_{\text{HAC}}| \ge 3.0$ | Consistent significance standard across all gates. |
| **Regime Invariance Gate** | $\alpha_{\text{ann}} > 0.0$ in both 2020–2021 Bull and 2022 Bear | Rejects regime-fragile rules before paper trading. |
| **Forward Test Rules** | Max 2 rules, $N_{\text{indep}} \ge 100$, no early stopping | True out-of-sample forward paper test. |
| **Runtime Integrity** | Dynamic source file SHA-256 hash + publish-time logging | Prevents code tampering and lookahead in live execution. |
| **Live Money Constraint** | 100% paper trading for minimum 12 months | Prevents premature capital allocation on short runs. |
