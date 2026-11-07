# Phase 1: Data Inventory, Statistical Power & Burned Data Audit (Amended — Version 2)

> **Document Type:** Institutional Quantitative Research Report (Phase 1 — Amendment 2)  
> **Repository:** Trader-Pro / Trader-Pro-Dashboard  
> **Branch:** `feat/cost-aware-engine`  
> **Initial Commit:** `4c6077d` (*docs(research): Phase 1 data inventory, power analysis, and burned data audit*)  
> **Amendment 1 Commit:** `65a00f8` (*phase1 amendment 1, before any results*)  
> **Amendment 2 Commit:** `phase1 amendment 2, before any results`  
> **Date:** November 2026  
> **Scope:** Pre-requisite quantitative audit, statistical power modeling, and governance framework prior to Phase 2 pre-registration. Docs only — zero strategy code executed.

---

## Amendment 2 Change Log (Methodological Audit & Governance Calibration)

Prior to codifying Round 3 hypotheses, Phase 1 is updated with six essential econometric and governance standards:

1. **Explicit Separation of Empirical Measurements vs Assumed Placeholders:**
   - All daily return standard deviations ($\sigma_{\text{daily}}$) used in hypothetical power modeling are formally labeled **`[ASSUMED PLACEHOLDER]`**. They represent illustrative sensitivity inputs, **not empirical backtest results**.
   - **Units Definition:** Clarified exact mathematical definitions of a "trade" (discrete round-trip position entered at $open[t]$ and exited at $open[t+D]$) and "$1\text{R}$" (normalized risk unit equal to the entry stop-loss distance $S = 5.0\%$ notional; daily return in R is $r_{\text{daily}, R} = \frac{r_{\text{daily}}}{S}$).
2. **Empirical Measurement of Pairwise and Residual Correlation:**
   - Explicitly disclosed that the empirical average pairwise return correlation $\bar{\rho} = 0.599 \approx 0.60$ was measured strictly on the **5 available daily parquet coins** (`BTC`, `ETH`, `BNB`, `SOL`, `XRP`) over `2020-09-14` to `2026-10-26` ($N = 2,229$ daily bars). Extending $\bar{\rho} \approx 0.60$ to an unmined 22-coin universe is an **`[EXPLICIT ASSUMPTION]`**.
   - Derived the effective number of independent bets ($N_{\text{eff}}$) for Family C using **residual returns after regressing out the BTC market factor**: empirical pairwise residual correlation across the 4 altcoins (`ETH`, `BNB`, `SOL`, `XRP`) is **$\bar{\rho}_{\text{residual}} = 0.2756$** ($\approx 0.28$).
3. **Unified Authority Cost Model Across All Project Research:**
   - Unified both `prereg_round2.md` and Round 3 around **ONE standardized cost model**:
     - **Base Tier (Standard Institutional / VIP Taker):** **`7.0 bps` per side** ($0.070\%$) $\implies$ **`14.0 bps` round-trip** ($0.140\%$).
     - **Punishing Tier (Retail Taker + Spread + Adverse Slippage Stress Test):** **`25.0 bps` per side** ($0.250\%$) $\implies$ **`50.0 bps` round-trip** ($0.500\%$).
4. **Removal of Family D (Basis / Funding Carry) from Round 3:**
   - Formally eliminated Family D from Round 3 consideration for three structural reasons:
     1. Already evaluated on BTC in `evaluate_final.py` (Strategy A3, trailing 30-day funding mean on 2025–2026 data).
     2. Thin real yields: Net annualized funding yields in mature competitive markets have compressed to single digits ($5\% - 8\%$).
     3. Fee friction and potential regulatory/tax considerations (to confirm with a tax professional: e.g. 1% TDS on spot transfers, non-deductible trading losses under Section 115BBH): Cash-and-carry requires rebalancing between spot and perpetuals, compounding exchange fees and regulatory friction, rendering retail delta-neutral carry structurally unviable.
   - Round 3 is strictly confined to the remaining **3 non-directional / macro rule families**: (a) Funding-rate extremes as a contrarian signal, (b) Open-interest change plus price direction, and (c) Cross-sectional momentum over 7–30 days.
5. **Bifurcated Multiple-Testing Rules (Historical Screening vs Forward Test):**
   - **Historical Screening:** Evaluated against the **project-wide cumulative test count** ($M = 21$ across macro/derivatives tests, requiring a **$99.76\%$ block-bootstrap CI** $[0.119\%, 99.881\%]$).
   - **Forward Real-Time Test:** Evaluated strictly against the number of rules carried forward (**at most $K \le 2$ rules**), requiring a Bonferroni-adjusted **$97.50\%$ CI** for $K = 2$ ($[1.25\%, 98.75\%]$) or **$95.00\%$ CI** for $K = 1$.
6. **Mandatory Phase 2 Screening Bar (Dual-Regime Survival):**
   - A candidate rule advances to forward deployment if and only if:
     1. Its stationary block-bootstrap CI lower bound of net return (or $\Delta\text{Sharpe}$ vs buy-and-hold) is **strictly $> 0.0$ under the Punishing Cost Tier ($25\text{ bps}$ per side / $50\text{ bps}$ round-trip)**; AND
     2. Its mean net return is **strictly positive ($> 0.0$) in BOTH distinct historical market regimes**: the **2020–2021 Bull Market** AND the **2022 Bear Market**.

---

## 1. Free Data Inventory for 20+ Liquid USDT Perpetual Futures

To test whether any genuine edge exists without mining previously touched datasets, we evaluate public, free-tier data sources across a candidate universe of **22 liquid USDT perpetual futures**:
`BTC`, `ETH`, `BNB`, `SOL`, `XRP`, `ADA`, `DOGE`, `AVAX`, `LINK`, `DOT`, `NEAR`, `LTC`, `BCH`, `UNI`, `ATOM`, `ETC`, `FIL`, `TRX`, `AAVE`, `XLM`, `VET`, `ICP`.

| Data Category | Free Source / Protocol | Granularity | Historical Span for Top 20 Perps | Gaps & Structural Limitations | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Daily Price Candles (`klines`)** | Binance Futures REST (`/fapi/v1/klines`) & Data Vision monthly archives (`/klines/{symbol}/1d/`) | 1D OHLCV | **Sep 2019 – Present** for BTC/ETH; **Jan–Sep 2020 – Present** for 18 other coins (~2,200 to 2,500 daily bars each). | Zero structural gaps. Maintenance windows (sub-hour) do not create missing daily bars. | **100% Free** (No API key required; 2400 weight/min limit). |
| **Funding Rate History (`fundingRate`)** | Binance Futures REST (`/fapi/v1/fundingRate`) & Data Vision monthly archives (`/fundingRate/{symbol}/`) | 8-hour settlements (00:00, 08:00, 16:00 UTC) | **Full contract lifetime** since inception (~7,800 settlements for BTC, ~6,000–6,800 settlements per altcoin; ~2,000–2,250 days). | Zero gaps. Complete record of every settlement timestamp, rate, and mark price. | **100% Free** (Paginated backward via REST or bulk monthly zip). |
| **Open Interest History (`sum_open_interest`)** | Binance Data Vision daily metrics archive (`/data/futures/um/daily/metrics/{symbol}/`) | 5-minute snapshots (288 rows/day) & aggregated daily | **Sep 1, 2020 – Present** for BTC; **Late 2020 / Early 2021 – Present** for liquid altcoins (~1,800 to 2,250 days). | **REST API Limitation:** Standard REST (`/futures/data/openInterestHist`) is restricted to the **rolling last 30 days only** (queries older than 30d return `HTTP 400: parameter 'startTime' is invalid`). Full history requires bulk download from Data Vision daily archives. Occasional missing single days require forward-fill (max 24h limit). | **100% Free** via public AWS S3 Data Vision bucket. |
| **Long/Short Accounts & Volume Ratios** | Binance Data Vision daily metrics archive (`count_long_short_ratio`, `count_toptrader_long_short_ratio`, `sum_taker_long_short_vol_ratio`) | 5-minute snapshots & aggregated daily | **Sep 1, 2020 – Present** for BTC; **2021 – Present** for liquid altcoins (~1,800 to 2,250 days). | Same as OI: REST API is strictly rolling 30 days. Full history is obtained from Data Vision daily metrics archives. | **100% Free** via public AWS S3 Data Vision bucket. |
| **Basis (Perp Price vs Spot Index)** | Computed directly: $\frac{P_{\text{perp}} - P_{\text{spot}}}{P_{\text{spot}}}$, or Binance Data Vision `premiumIndexKlines/` monthly archives | 1D & 8H | **Full contract lifetime** since inception (2019/2020 to present). | Continuous with zero gaps when derived from spot and perpetual daily candles. | **100% Free**. |

---

## 2. Statistical Power Analysis & Cross-Sectional Modeling

### 2.1 Units & Definitions for Daily-Hold Macro Rules
To eliminate dimensional ambiguity between intraday scalping models and multi-day macro rules, we define:
1. **Trade Definition:** A discrete macro trade consists of an entry filled on the open of day $t$ ($open[t]$) conditioned on closing information at day $t-1$, held for a fixed horizon of $D$ calendar days, and exited at the open of day $t + D$ ($open[t+D]$).
2. **Stop-Loss Distance ($S$):** The protective stop distance measured in notional percent. For daily macro rules, baseline stop distance is set to $S = 5.0\%$ ($0.050$).
3. **The Risk Unit ($1\text{R}$):** $1\text{R} = S \times \text{Position Notional} = 0.050 \times \text{Notional}$.
4. **Trade Return in R ($R_{\text{trade}}$):**
   $$R_{\text{trade}} = \frac{r_{\text{trade, notional}}}{S} = \frac{r_{\text{trade, notional}}}{0.050}$$
   *(For example, a gross trade return of $+0.50\%$ notional represents $+0.10\text{R}$; a loss of $-5.0\%$ notional represents $-1.00\text{R}$)*.
5. **Daily Return in R ($r_{\text{daily}, R}$):** The daily return normalized by risk:
   $$r_{\text{daily}, R} = \frac{r_{\text{daily, notional}}}{S} = \frac{r_{\text{daily, notional}}}{0.050}$$
   If a trade with holding period $D$ earns target expectancy $\mu_{\text{trade}}$, the average daily expected drift is $\mu_{\text{daily}} = \frac{\mu_{\text{trade}}}{D}$.

---

### 2.2 Empirical Correlation vs Assumed Universe Extension

#### Empirical 5-Coin Measurement (Measured Derivation)
Using our 5 locally available daily parquet files (`BTC`, `ETH`, `BNB`, `SOL`, `XRP`) over their full common history (`2020-09-14` to `2026-10-26`, $N = 2,229$ daily bars):
- **Daily Raw Return Correlation Matrix:**
  $$\begin{pmatrix}
  & \text{BNB} & \text{BTC} & \text{ETH} & \text{SOL} & \text{XRP} \\
  \text{BNB} & 1.000 & 0.636 & 0.646 & 0.559 & 0.481 \\
  \text{BTC} & 0.636 & 1.000 & 0.808 & 0.585 & 0.560 \\
  \text{ETH} & 0.646 & 0.808 & 1.000 & 0.646 & 0.580 \\
  \text{SOL} & 0.559 & 0.585 & 0.646 & 1.000 & 0.492 \\
  \text{XRP} & 0.481 & 0.560 & 0.580 & 0.492 & 1.000
  \end{pmatrix}$$
- **Average Pairwise Return Correlation:**
  $$\bar{\rho}_{\text{measured}} = \frac{1}{10}\sum_{i < j} \rho_{ij} = \mathbf{0.5993 \approx 0.60}$$

#### Explicit Assumption for 22 Coins
- **`[EXPLICIT ASSUMPTION]`**: Extending $\bar{\rho} \approx 0.60$ across the full 22-coin candidate universe is an assumed modeling parameter based on broad crypto market co-movement literature. If the unmined altcoins exhibit higher pairwise correlation (e.g. $\bar{\rho} \approx 0.70$), effective independent bets will be even lower.

#### Effective Independent Bets ($N_{\text{eff}}$) for Directional Baskets (Families A & B)
Under equicorrelation across $N = 22$ assets with assumed $\bar{\rho} = 0.60$:
$$N_{\text{eff}} = \frac{N}{1 + (N - 1)\bar{\rho}} = \frac{22}{1 + 21 \times 0.60} = \frac{22}{13.60} \approx \mathbf{1.618 \text{ independent bets per day}}$$

---

### 2.3 Residual Return Derivation for Family C (Cross-Sectional Momentum)

Because Family C is structured as a **dollar-neutral long/short portfolio** (Long Top $K$ coins, Short Bottom $K$ coins), systematic market beta cancels out.

To compute the effective sample size ($N_{\text{eff}}$) for Family C, we isolate the **idiosyncratic residual returns** ($\epsilon_{i, t}$) after regressing each asset's daily return against the BTC market factor:
$$R_{i, t} = \alpha_i + \beta_i R_{\text{BTC}, t} + \epsilon_{i, t}$$

#### Empirical Residual Correlation Matrix (Measured on Local Data):
Regressing daily returns of `ETH`, `BNB`, `SOL`, and `XRP` against `BTC` over `2020-09-14` to `2026-10-26` yields:
$$\begin{pmatrix}
& \text{BNB} & \text{ETH} & \text{SOL} & \text{XRP} \\
\text{BNB} & 1.000 & 0.290 & 0.299 & 0.196 \\
\text{ETH} & 0.290 & 1.000 & 0.363 & 0.262 \\
\text{SOL} & 0.299 & 0.363 & 1.000 & 0.244 \\
\text{XRP} & 0.196 & 0.262 & 0.244 & 1.000
\end{pmatrix}$$

- **Average Pairwise Residual Correlation:**
  $$\bar{\rho}_{\text{residual, measured}} = \mathbf{0.2756} \approx \mathbf{0.28}$$

#### Effective Independent Bets for Family C ($M = 8$ Positions):
Assuming an 8-coin spread portfolio (Long Top 4, Short Bottom 4) with empirical residual correlation $\bar{\rho}_{\text{residual}} = 0.2756$:
$$N_{\text{eff, Family C}} = \frac{M}{1 + (M - 1)\bar{\rho}_{\text{residual}}} = \frac{8}{1 + 7 \times 0.2756} = \frac{8}{1 + 1.929} = \frac{8}{2.929} \approx \mathbf{2.731 \text{ independent bets}}$$

---

### 2.4 Power Analysis Under Assumed Placeholder Volatilities

> **Methodology Disclosure:**  
> The values for daily return volatility ($\sigma_{\text{daily}}$) in the table below are **`[ASSUMED PLACEHOLDER]` inputs** chosen to reflect realistic market dispersion. They are **not** empirical backtest results.
> - **Family A Placeholder:** $\sigma_{\text{daily, notional}} = 3.50\%$ ($0.700\text{R}$/day at $S = 5.0\%$). Portfolio daily volatility:
>   $$\sigma_{\text{port}} = \frac{0.700\text{R}}{\sqrt{1.618}} = \mathbf{0.550\text{R / day}} \quad \text{`[ASSUMED PLACEHOLDER]`}$$
> - **Family B Placeholder:** $\sigma_{\text{daily, notional}} = 3.75\%$ ($0.750\text{R}$/day at $S = 5.0\%$). Portfolio daily volatility:
>   $$\sigma_{\text{port}} = \frac{0.750\text{R}}{\sqrt{1.618}} = \mathbf{0.590\text{R / day}} \quad \text{`[ASSUMED PLACEHOLDER]`}$$
> - **Family C Placeholder:** Spread volatility $\sigma_{\text{daily, notional}} = 2.00\%$ ($0.400\text{R}$/day at $S = 5.0\%$). Portfolio daily volatility:
>   $$\sigma_{\text{port}} = \frac{0.400\text{R}}{\sqrt{2.731}} = \mathbf{0.242\text{R / day}} \quad \text{`[ASSUMED PLACEHOLDER]`}$$

#### Required Calendar Days and Months for 95% Confidence Interval Excluding Zero:
$$T_{95\%} = \left(\frac{1.95996 \cdot \sigma_{\text{port}} \cdot D}{\mu_{\text{trade}}}\right)^2 \text{ days} \qquad \text{Months} = \frac{T}{30.4375}$$
*(Standard $80\%$ pre-study power at $\alpha = 0.05$ where $z = 1.96 + 0.84 = 2.80$: $T_{80\%} = \left(\frac{2.80158 \cdot \sigma_{\text{port}} \cdot D}{\mu_{\text{trade}}}\right)^2$)*:

| Candidate Rule Family & Horizon ($D$) | Expected Trade Edge ($\mu_{\text{trade}}$) | Daily Expected Drift ($\mu_{\text{daily}}$) | Daily Portfolio Vol ($\sigma_{\text{port}}$) | Days Needed ($95\%$ CI $> 0$) | Calendar Months ($95\%$ CI) | Months for 80% Power ($z = 2.80$) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Family A: Contrarian Funding Extremes**<br>($D = 3\text{d}$, $N_{\text{eff}} = 1.62$) | **$+0.10\text{R}$** | $+0.0333\text{R}$ | $0.550\text{R}$ `[PLACEHOLDER]` | **1,047 days** | **34.4 months** *(2.9 yrs)* | 70.3 months *(5.9 yrs)* |
| | **$+0.05\text{R}$** | $+0.0167\text{R}$ | $0.550\text{R}$ `[PLACEHOLDER]` | **4,189 days** | **137.6 months** *(11.5 yrs)* | 281.2 months *(23.4 yrs)* |
| **Family B: OI Change + Price Direction**<br>($D = 5\text{d}$, $N_{\text{eff}} = 1.62$) | **$+0.10\text{R}$** | $+0.0200\text{R}$ | $0.590\text{R}$ `[PLACEHOLDER]` | **3,339 days** | **109.7 months** *(9.1 yrs)* | 224.2 months *(18.7 yrs)* |
| | **$+0.05\text{R}$** | $+0.0100\text{R}$ | $0.590\text{R}$ `[PLACEHOLDER]` | **13,358 days** | **438.9 months** *(36.6 yrs)* | 896.7 months *(74.7 yrs)* |
| **Family C: Cross-Sectional Momentum L/S**<br>($D = 14\text{d}$, $N_{\text{eff}} = 2.73$) | **$+0.10\text{R}$** | $+0.0071\text{R}$ | $0.242\text{R}$ `[PLACEHOLDER]` | **4,411 days** | **144.9 months** *(12.1 yrs)* | 296.2 months *(24.7 yrs)* |
| | **$+0.05\text{R}$** | $+0.0036\text{R}$ | $0.242\text{R}$ `[PLACEHOLDER]` | **17,644 days** | **579.7 months** *(48.3 yrs)* | 1,184.8 months *(98.7 yrs)* |

---

## 3. Unified Cost Model

To eliminate any discrepancy across research phases, all backtests, screenings, and pre-registrations adhere to **ONE authoritative cost model**:

| Cost Tier | Fee Component | Per-Side Cost | Round-Trip Cost | Economic Rationale |
| :--- | :--- | :---: | :---: | :--- |
| **Tier 1: Base Cost** | Exchange VIP Taker Fee + GST + Baseline Slippage | **`7.0 bps`** ($0.0007$) | **`14.0 bps`** ($0.0014$) | Reflects standard institutional VIP taker rates on Binance Futures ($0.040\%$ fee $+ 18\%$ GST $+ 0.010\%$ slippage $+ 0.0128\%$ buffer). |
| **Tier 2: Punishing Cost** | Retail Taker Fee + Half-Spread + Volatile Execution Slippage | **`25.0 bps`** ($0.0025$) | **`50.0 bps`** ($0.0050$) | Stress test matching `backtest-expert` methodology ($1.5\times - 2.0\times$ friction, retail taker fee $0.100\%$, $0.050\%$ half-spread, $0.100\%$ adverse slippage). |

---

## 4. Survivorship Bias & Universe Definition

### 4.1 Survivorship Bias Disclosure
Selecting today's top 22 liquid USDT perpetuals represents a **survivor-biased universe**. Coins that suffered economic collapse or regulatory delisting between 2020 and 2026 (e.g., LUNA/UST, FTT, SRM, RAY, ANC, MIR, TOMO, WAVES, OMG, and ~40 delisted Binance contracts) are omitted from the sample. Historical backtests on these 22 assets reflect survivor selection.

### 4.2 Epistemological Status of the Altcoin Universe
While specific altcoin files were not previously fitted by LightGBM in this repo, altcoin macro regimes are economically and statistically coupled to BTC and ETH ($\bar{\rho} \approx 0.60$). Researchers already know the 2020–2026 bull/bear/FTX/ETF macro timeline. Altcoins provide cross-sectional breadth, not independent temporal regimes.

---

## 5. Multiple Testing Rules (Bifurcated Framework)

To guarantee statistical integrity without penalizing live forward monitoring unfairly:

### 5.1 Historical Screening Multiple-Testing Rule
Any candidate rule evaluated on historical development data (2020–Nov 2026) is penalized by the **project-wide cumulative hypothesis count**:
- Prior Donchian daily tests: **2** (BTC, ETH)
- Round 2 Pre-Registered hypotheses: **3** (H1, H2, H3)
- BTC Derivatives Studies (`run_derivatives_study.py` G0–G3 across 1H/4H): **8**
- BTC Final Structural Studies (`evaluate_final.py` A3, B1 variants): **4**
- Round 3 Candidate Rules: **4**
- **Historical Hypothesis Family Count:** $M = \mathbf{21 \text{ tests}}$
- **Historical Significance Level:**
  $$\alpha_{\text{historical}} = \frac{0.05}{21} \approx \mathbf{0.00238} \implies \mathbf{99.76\% \text{ CI }} [0.119\%, 99.881\%]$$

### 5.2 Forward Sealed Test Multiple-Testing Rule
The sealed test is defined strictly as **live forward data collected in real time starting from today (November 7, 2026 onward)**:
- At most **$K \le 2$ candidate rules** may be selected from historical screening for forward deployment.
- The forward test is penalized strictly by the number of rules carried forward ($K$):
  - If $K = 2$ rules: $\alpha_{\text{forward}} = \frac{0.05}{2} = \mathbf{0.025} \implies \mathbf{97.50\% \text{ CI }} [1.25\%, 98.75\%]$.
  - If $K = 1$ rule: $\alpha_{\text{forward}} = \mathbf{0.050} \implies \mathbf{95.00\% \text{ CI }} [2.50\%, 97.50\%]$.

---

## 6. Mandatory Phase 2 Pre-Registration Screening Bar

Before any candidate rule can be carried forward into the real-time sealed test, it must satisfy **all three non-negotiable screening hurdles** on historical data:

1. **Punishing Cost Survival:**
   - Under the **Punishing Cost Tier ($25\text{ bps}$ per side / $50\text{ bps}$ round-trip)**, the stationary block-bootstrap confidence interval (10,000 resamples, 20-day block length, at the historical $99.76\%$ confidence level) of mean net return (or net $\Delta\text{Sharpe}$ vs buy-and-hold) must have a **lower bound strictly $> 0.0$**.
2. **Dual-Regime Consistency (Bull & Bear):**
   - The mean net return (or $\Delta\text{Sharpe}$) must be **strictly positive ($> 0.0$) in BOTH distinct historical market regimes**:
     - **Regime 1: 2020–2021 Crypto Bull Market** (`2020-01-01` to `2021-12-31`).
     - **Regime 2: 2022 Crypto Bear Market** (`2022-01-01` to `2022-12-31`).
   - If a rule generates profits during the bull run but suffers net losses in the bear market (or vice versa), it is classified as regime-fragile and **REJECTED**.
3. **Residual Edge Attribution ($t_{\alpha} \ge 2.0$):**
   - The strategy must pass returns-based OLS with Newey-West HAC inference ($t_{\alpha} \ge 2.0$) against passive buy-and-hold to confirm that net returns do not represent unhedged systematic market beta.
