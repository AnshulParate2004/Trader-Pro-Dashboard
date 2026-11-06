# Phase 1: Data Inventory, Statistical Power & Burned Data Audit (Amended)

> **Document Type:** Institutional Quantitative Research Report (Phase 1 — Amendment 1)  
> **Repository:** Trader-Pro / Trader-Pro-Dashboard  
> **Branch:** `feat/cost-aware-engine`  
> **Initial Commit:** `4c6077d` (*docs(research): Phase 1 data inventory, power analysis, and burned data audit*)  
> **Amendment 1 Commit:** `phase1 amendment 1, before any results`  
> **Date:** November 2026  
> **Scope:** Rigorous econometric foundations, cross-sectional correlation discounting, survivorship bias disclosure, and skill-driven checklist audit prior to Phase 2 pre-registration. Zero strategy code executed.

---

## Amendment 1 Change Log (Pre-Execution Methodological Audit)

Prior to drafting Phase 2 pre-registration hypotheses or downloading data, Phase 1 is amended to incorporate six essential econometric, statistical, and workflow corrections:

1. **Cross-Sectional Correlation & Effective Degrees of Freedom ($N_{\text{eff}}$):**
   - Empirical analysis of daily returns across candidate crypto assets reveals an average pairwise correlation of **$\bar{\rho} \approx 0.60$** (range $0.48$ to $0.81$).
   - Cross-sectional pooling across $N = 22$ assets does **not** yield 22 independent bets per day. Under equicorrelation, the effective number of independent daily bets collapses to:
     $$N_{\text{eff}} = \frac{N}{1 + (N - 1)\bar{\rho}} = \frac{22}{1 + 21 \times 0.60} \approx \mathbf{1.62 \text{ independent bets per day}}$$
2. **Rule-Specific Daily Return Volatility ($\sigma_{\text{daily}}$) vs Trade Bracket $\sigma$:**
   - Replaced the static bracket-trade standard deviation ($\sigma_R = 0.825$) with the true daily-return standard deviation $\sigma_{\text{daily}}$ of each candidate rule family.
   - When daily standard deviation is normalized by entry stop distance ($\sigma_{\text{daily}, R} \approx 0.40\text{R} - 0.75\text{R}$ per day) and held over $D$-day horizons, daily expected edge shrinks to $\mu_{\text{daily}} = \mu_{\text{trade}} / D$, requiring **years of signals** (not months) to separate small $+0.05\text{R}$ to $+0.10\text{R}$ edges from noise.
3. **Survivorship Bias Disclosure & Mitigation:**
   - Acknowledged that selecting today's top 22 liquid USDT perpetuals introduces severe survivorship bias (survivors of the 2021–2022 bear market; delisted assets like LUNA, FTT, SRM, and dozens of bankrupt tokens are excluded).
   - Historical backtests are explicitly labeled survivor-biased. To eliminate survivorship bias entirely from final validation, the sealed test is defined strictly as forward out-of-sample data collected in real time.
4. **Correction of Altcoin Status (Regime Coupling):**
   - Removed the claim that altcoins are "100% UNMINED & PRISTINE". While specific altcoin price series were not directly mined in earlier scripts, crypto altcoins are economically and statistically coupled to BTC and ETH ($\bar{\rho} \approx 0.60 - 0.80$). Market-wide regimes (FTX collapse, bull/bear cycles, ETF liquidity) are already fully known to researchers. Altcoins provide cross-sectional breadth, not independent temporal regimes.
5. **Project-Wide Multiple Testing Count (Bonferroni Update):**
   - Incorporated previous BTC derivatives studies (`run_derivatives_study.py` groups G0–G3 across 1H/4H = 8 tests; `evaluate_final.py` strategies A3 carry and B1 trend = 4 tests) into the formal project hypothesis family count, bringing cumulative macro/derivatives tests to $M = 21$ (or $M = 147$ across all historical model variants).
6. **Integration of Institutional Research Skill Checklists:**
   - Applied the mandatory validation checklists from `research-skills/backtest-expert/SKILL.md` and `research-skills/edge-strategy-reviewer/SKILL.md` (including `bias_checklist.yaml`), establishing non-negotiable rules for Phase 2 pre-registration.

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

## 2. Rigorous Statistical Power Analysis

### 2.1 Cross-Sectional Correlation & Effective Independent Bets ($N_{\text{eff}}$)

In quantitative finance, evaluating $N$ assets simultaneously does **not** provide $N$ independent statistical observations if returns share common systematic factor exposures.

Empirical measurement of daily log returns across the major candidate universe (2020–2026) confirms strong cross-asset return coupling:
$$\bar{\rho} \approx 0.599 \approx \mathbf{0.60}$$
- `BTC-ETH`: $0.808$
- `BTC-BNB`: $0.636$
- `ETH-BNB`: $0.646$
- `ETH-SOL`: $0.646$
- `BTC-SOL`: $0.585$
- `BTC-XRP`: $0.560$

Under equicorrelation theory, the effective number of independent cross-sectional bets per day ($N_{\text{eff}}$) in an equal-weighted basket is:
$$N_{\text{eff}} = \frac{N}{1 + (N - 1)\bar{\rho}}$$

For our candidate universe of $N = 22$ assets:
$$N_{\text{eff}} = \frac{22}{1 + 21 \times 0.60} = \frac{22}{13.60} \approx \mathbf{1.618 \text{ independent bets per day}}$$

> **Critical Methodological Finding:**  
> Expanding from 1 coin to 22 coins does **not** increase statistical sample size by $22\times$. Due to $60\%$ market-wide co-movement, 22 correlated coins provide only **$1.62\times$ the statistical power** of a single coin.

---

### 2.2 Rule-Specific Daily Return Volatility ($\sigma_{\text{daily}}$)

Rather than assuming an artificial static bracket-trade standard deviation ($\sigma_R = 0.825$), power must be evaluated from the actual daily portfolio return distribution of each candidate strategy family:

1. **Family A: Contrarian Funding-Rate Extremes (Directional Reversal)**
   - Holding Period: $D = 3\text{ days}$
   - Asset Daily Volatility: $\sigma_{\text{daily}} \approx 3.5\%$ notional.
   - Stop-Loss Risk Unit ($1\text{R}$): $5.0\%$ notional $\implies \sigma_{\text{daily}, R} = \frac{3.5\%}{5.0\%} = 0.70\text{R}$.
   - Portfolio Daily Standard Deviation: $\sigma_{\text{port}} = \frac{\sigma_{\text{daily}, R}}{\sqrt{N_{\text{eff}}}} = \frac{0.70\text{R}}{\sqrt{1.618}} \approx \mathbf{0.550\text{R / day}}$.

2. **Family B: Open-Interest Change + Price Direction (Multi-Day Breakout)**
   - Holding Period: $D = 5\text{ days}$
   - Asset Daily Volatility: $\sigma_{\text{daily}} \approx 3.8\%$ notional ($1\text{R} = 5.0\% \implies \sigma_{\text{daily}, R} = 0.76\text{R}$).
   - Portfolio Daily Standard Deviation: $\sigma_{\text{port}} = \frac{0.76\text{R}}{\sqrt{1.618}} \approx \mathbf{0.597\text{R / day}}$.

3. **Family C: Cross-Sectional Momentum Long/Short (Dollar-Neutral Spread)**
   - Holding Period: $D = 14\text{ days}$
   - Structure: Long Top 4 coins, Short Bottom 4 coins ($M = 8$ positions).
   - Market Beta Cancellation: Because the portfolio is dollar-neutral, systematic market beta cancels out, lowering pairwise spread correlation to $\bar{\rho}_{\text{L/S}} \approx 0.20$.
   - Effective Bets: $N_{\text{eff}} = \frac{8}{1 + 7 \times 0.20} = \frac{8}{2.40} \approx 3.33$.
   - Spread Daily Volatility: $\sigma_{\text{daily}} \approx 2.0\%$ notional ($1\text{R} = 5.0\% \implies \sigma_{\text{daily}, R} = 0.40\text{R}$).
   - Portfolio Daily Standard Deviation: $\sigma_{\text{port}} = \frac{0.40\text{R}}{\sqrt{3.33}} \approx \mathbf{0.219\text{R / day}}$.

4. **Family D: Delta-Neutral Basis / Funding Carry (Spot Long + Perp Short)**
   - Holding Period: $D = 30\text{ days}$
   - Volatility Profile: Market price delta is zeroed out. Volatility arises solely from daily funding fluctuations ($\sigma_{\text{daily}} \approx 0.057\%$) and basis noise ($\sigma_{\text{daily}} \approx 0.25\%$).
   - Normalized Daily Volatility ($1\text{R} = 5.0\%$): $\sigma_{\text{daily}, R} \approx \frac{0.25\%}{5.0\%} = 0.05\text{R}$.
   - Funding Correlation: Funding rates across crypto are tightly coupled ($\bar{\rho}_{\text{funding}} \approx 0.75 \implies N_{\text{eff}} = \frac{22}{1 + 21 \times 0.75} \approx 1.31$).
   - Portfolio Daily Standard Deviation: $\sigma_{\text{port}} = \frac{0.05\text{R}}{\sqrt{1.31}} \approx \mathbf{0.044\text{R / day}}$.

---

### 2.3 Required Calendar Months of Data for Statistical Significance

When a strategy with holding period $D$ days targets a gross trade expectancy of $\mu_{\text{trade}} \in \{+0.05\text{R}, +0.10\text{R}\}$, the daily expected drift is:
$$\mu_{\text{daily}} = \frac{\mu_{\text{trade}}}{D}$$

The number of continuous calendar trading days ($T$) required for the 95% two-sided confidence interval of mean portfolio return to strictly exclude zero ($z = 1.95996$) is:
$$T_{95\%} = \left(\frac{1.95996 \cdot \sigma_{\text{port}}}{\mu_{\text{daily}}}\right)^2 = \left(\frac{1.95996 \cdot \sigma_{\text{port}} \cdot D}{\mu_{\text{trade}}}\right)^2$$
*(And for standard 80% statistical power at $\alpha = 0.05$, where $z = 1.96 + 0.84 = 2.80$: $T_{80\%} = \left(\frac{2.80158 \cdot \sigma_{\text{port}} \cdot D}{\mu_{\text{trade}}}\right)^2$)*:

| Candidate Rule Family & Holding Horizon | Expected Trade Edge ($\mu_{\text{trade}}$) | Daily Expected Drift ($\mu_{\text{daily}}$) | Daily Portfolio Volatility ($\sigma_{\text{port}}$) | Days Needed for 95% CI $> 0$ ($z = 1.96$) | Calendar Months Needed ($95\%$ CI) | Calendar Months for 80% Power ($z = 2.80$) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Family A: Contrarian Funding Extremes**<br>($D = 3\text{ days}$, $N_{\text{eff}} = 1.62$) | **$+0.10\text{R}$** | $+0.0333\text{R}$ | $0.550\text{R}$ | **1,047 days** | **34.4 months** *(2.9 yrs)* | 70.3 months *(5.9 yrs)* |
| | **$+0.05\text{R}$** | $+0.0167\text{R}$ | $0.550\text{R}$ | **4,189 days** | **137.6 months** *(11.5 yrs)* | 281.2 months *(23.4 yrs)* |
| **Family B: OI Change + Price Direction**<br>($D = 5\text{ days}$, $N_{\text{eff}} = 1.62$) | **$+0.10\text{R}$** | $+0.0200\text{R}$ | $0.590\text{R}$ | **3,339 days** | **109.7 months** *(9.1 yrs)* | 224.2 months *(18.7 yrs)* |
| | **$+0.05\text{R}$** | $+0.0100\text{R}$ | $0.590\text{R}$ | **13,358 days** | **438.9 months** *(36.6 yrs)* | 896.7 months *(74.7 yrs)* |
| **Family C: Cross-Sectional Momentum L/S**<br>($D = 14\text{ days}$, $N_{\text{eff}} = 3.33$) | **$+0.10\text{R}$** | $+0.0071\text{R}$ | $0.219\text{R}$ | **3,614 days** | **118.7 months** *(9.9 yrs)* | 242.6 months *(20.2 yrs)* |
| | **$+0.05\text{R}$** | $+0.0036\text{R}$ | $0.219\text{R}$ | **14,456 days** | **474.9 months** *(39.6 yrs)* | 970.4 months *(80.9 yrs)* |
| **Family D: Delta-Neutral Basis/Funding Carry**<br>($D = 30\text{ days}$, $N_{\text{eff}} = 1.31$) | **$+0.10\text{R}$** | $+0.0033\text{R}$ | $0.044\text{R}$ | **658 days** | **21.6 months** *(1.8 yrs)* | 44.2 months *(3.7 yrs)* |
| | **$+0.05\text{R}$** | $+0.0017\text{R}$ | $0.044\text{R}$ | **2,632 days** | **86.5 months** *(7.2 yrs)* | 176.7 months *(14.7 yrs)* |

---

### 2.4 Crucial Methodological Conclusion from Power Analysis

1. **Small directional edges ($+0.05\text{R}$) are unprovable over realistic crypto histories**: When cross-sectional correlation is properly accounted for, proving that a directional macro rule (Family A or B) has a true $+0.05\text{R}$ edge requires **over 11 to 36 years of data**. Claims that an uncalibrated multi-day directional signal has an edge based on 6 to 12 months of backtest data are mathematically invalid.
2. **Delta-neutral carry (Family D) has the highest statistical tractability**: Because market beta is hedged out, daily return volatility drops by $>10\times$. Proving an edge of $+0.10\text{R}$ in funding carry requires only **21.6 months (~1.8 years)** of data, making it the most statistically verifiable edge candidate.
3. **Cross-Sectional Momentum (Family C)** benefits from beta cancellation ($\bar{\rho}_{\text{L/S}} \approx 0.20$), but its 14-day holding horizon compresses daily drift, requiring at least ~10 years for a $+0.10\text{R}$ hurdle.

---

## 3. Survivorship Bias Disclosure & Universe Definition

### 3.1 The Survivorship Trap in Altcoin Selection
The proposed 22-coin universe (`BTC`, `ETH`, `SOL`, `BNB`, `XRP`, `DOGE`, `ADA`, `AVAX`, `LINK`, `DOT`, `NEAR`, `LTC`, `BCH`, `UNI`, `ATOM`, `ETC`, `FIL`, `TRX`, `AAVE`, `XLM`, `VET`, `ICP`) consists exclusively of **today's surviving high-capitalization tokens**.

- **Historical Reality:** Between 2020 and 2026, hundreds of cryptocurrency perpetual contracts suffered total collapse, zero liquidity, or exchange delisting:
  - *Catastrophic collapses:* LUNA / UST, FTT, SRM, RAY, ANC, MIR, TOMO, WAVES, OMG.
  - *Binance Delistings:* Over 40 perpetual symbols were suspended or delisted during network hardforks, liquidity evaporation, or regulatory enforcement.
- **The Bias:** Backtesting on historical 2020–2024 data using only today's surviving tokens guarantees lookahead survivorship bias. Any strategy going long relative momentum or carry on survivors systematically benefits from the fact that these tokens did not collapse to zero.

### 3.2 Phase 2 Resolution: Forward-Only Sealed Testing
To maintain unimpeachable scientific standards:
1. **No Historical Sealed Window:** We formally forbid designating any historical window (e.g. 2024–2026) as an "untainted sealed holdout" for these coins.
2. **Forward Sealed Out-of-Sample Protocol:** The true sealed validation test is defined strictly as **live forward data recorded in real time starting from today (November 7, 2026 onward)**. Real-time forward execution has zero survivorship bias because future delistings, suspensions, and regulatory actions cannot be filtered in hindsight.
3. **Historical Data Role:** Historical multi-coin data (2020–Nov 2026) is strictly classified as an **exploratory / development window** with explicit survivor-bias labeling.

---

## 4. Epistemological Status of the Altcoin Universe (Regime Coupling)

Previous research documents incorrectly described the 17+ altcoins as "100% UNMINED & PRISTINE". We formally retract that characterization:

- **Untouched Execution Trace:** It is true that price CSVs and derivatives metrics for ADA, DOGE, AVAX, LINK, DOT, etc., have never been loaded into memory or fitted by LightGBM models in this repository.
- **Regime Coupling & Collective Conditioning:** However, altcoins do **not** inhabit an independent economic universe. Their price trajectories, liquidity droughts, volatility spikes, and funding rates are intimately coupled to BTC and ETH ($\bar{\rho} \approx 0.60 - 0.80$).
- **Lookahead Awareness:** The researchers already know that the 2021 market had a massive bull run, 2022 suffered 3AC/Celsius/FTX contagion, 2023 was a low-volatility accumulation regime, and 2024 experienced an ETF breakout followed by rotation. Testing altcoins over 2020–2026 is **not** an independent out-of-sample experiment; it is an in-sample cross-sectional replication within an already-observed macro timeline.

---

## 5. Comprehensive Project-Wide Multiple Testing Count (Bonferroni Update)

To avoid p-hacking and multiple testing inflation, all previously evaluated model families and quantitative studies in this project must be accounted for in the Family-Wise Error Rate (FWER) penalty:

### 5.1 Enumeration of Prior Quantitative Studies
1. **Historical Breakout & High-Frequency LightGBM Audits:**
   - 15M, 1H, 4H models across DEV folds, hyperparameter grids, and multi-coin scalper proposals: **at least 126 formal variants** tracked (as documented in `docs/LESSONS.md`).
2. **Prior Macro Trend Studies:**
   - BTC Donchian 20/10 Daily Study (`research-skills/RESULTS.md`): **1 test**
   - ETH Donchian 20/10 Daily Study (`docs/research/ETH_RESULTS.md`): **1 test**
3. **Round 2 Pre-Registered Macro Hypotheses:**
   - H1 (Volatility-Targeted BTC), H2 (200-day SMA BTC), H3 (BTC+ETH Equal Weight): **3 tests**
4. **BTC Derivatives Studies (`run_derivatives_study.py`):**
   - Feature Groups G0 (Price-only), G1 (Funding additions), G2 (OI additions), G3 (Combined) evaluated across 1H and 4H timeframes on DEV and VAL:
     $$4 \text{ groups} \times 2 \text{ timeframes} = \mathbf{8 \text{ tests}}$$
5. **BTC Final Structural Studies (`evaluate_final.py`):**
   - Strategy A3: Delta-Neutral Funding Carry (30-day trailing mean): **1 test**
   - Strategy B1: Daily Trend Following (100-day SMA, 80-day SMA, 120-day SMA robustness checks): **3 variants / tests**
   - Subtotal BTC Final: **4 tests**
6. **Planned Round 3 Hypotheses:**
   - At most **4 candidate hypotheses** (H1, H2, H3, H4).

### 5.2 Updated Multiple Testing Count & Adjusted Significance Hurdle

| Scope of Hypothesis Family | Tests Counted ($M$) | Bonferroni Significance Level ($\alpha_{\text{adj}} = 0.05 / M$) | Required Two-Sided Confidence Interval | Percentile Cutoffs |
| :--- | :---: | :---: | :---: | :---: |
| **Round 3 Isolated Family** | 4 | $0.01250$ | **$98.75\%$ CI** | $[0.625\%, 99.375\%]$ |
| **Cumulative Macro & Derivatives Family** *(Recommended)*<br>*(Donchian 2 + Round 2 (3) + BTC Deriv (8) + Final (4) + Round 3 (4))* | **21** | **$0.00238$** | **$99.76\%$ CI** | $\mathbf{[0.119\%, 99.881\%]}$ |
| **All-Inclusive Project History**<br>*(126 Audit Variants + 21 Macro/Derivatives)* | **147** | **$0.00034$** | **$99.97\%$ CI** | $[0.017\%, 99.983\%]$ |

> **Operational Decision Rule:**  
> Phase 2 will enforce the **$99.76\%$ block-bootstrap confidence interval** ($M = 21$ tests across all macro and derivatives hypotheses). For a candidate rule to pass, the **$0.119^{\text{th}}$ percentile of net $\Delta\text{Sharpe}$ or net R must be strictly $> 0.0$**.

---

## 6. Integration of Institutional Research Skill Checklists

Before codifying Phase 2 hypotheses in `docs/research/prereg_round3.md`, we audited our design against the professional standards codified in:
1. `research-skills/claude-trading-skills/skills/backtest-expert/SKILL.md`
2. `research-skills/claude-trading-skills/skills/edge-strategy-reviewer/SKILL.md` (and `assets/bias_checklist.yaml`)

### What the `backtest-expert` Checklist Changed for Phase 2:
- **Punishing Execution Friction:** Standard taker fee ($14\text{ bps}$ per side) is insufficient for stress-testing. Phase 2 must evaluate a stressed tier of **$50\text{ bps}$ per side ($1.00\%$ round-turn)** to account for retail taker rates, adverse spread crossing, and slippage during volatile rebalances.
- **Plateaus Over Peaks:** Forbids narrow point optimization (e.g. optimizing a 21.3-day lookback). Parameters must be chosen from broad, literature-standard plateaus (e.g. 7-day, 14-day, 30-day) with zero local tuning.
- **Pre-Declared Blocking Reasons:** The test runner must implement machine-readable blocking gates: `small_sample` ($N < 100$), `negative_expectancy`, `excessive_drawdown` ($> 30\%$), and `too_good` ($> 85\%$ win rate triggering immediate lookahead audit).
- **Execution Invariants:** Next-bar open fill ($open[t+1]$) is mandatory; same-bar close execution is forbidden.

### What the `edge-strategy-reviewer` & `bias_checklist` Changed for Phase 2:
- **Look-Ahead Bias Gate:** Mandatory verification that 8-hour funding rates and 5-minute metrics are strictly point-in-time ($T_{\text{publish}} \le open[t]$) and merged with backward direction only (`direction="backward"`).
- **Survivorship & Delisting Gate:** Mandatory explicit disclosure that the 22-coin historical dataset is survivor-biased; final validation deferred to forward real-time collection.
- **Short Borrow & Perp Availability:** Acknowledging that shorting altcoins in perp markets incurs dynamic borrow costs (funding rate paid to longs when funding is negative).
- **Benchmark Attribution (Beta Control):** Any candidate rule claiming an edge must be regressed against passive buy-and-hold using returns-based OLS with Newey-West HAC inference. If $t_{\alpha} < 2.0$, the rule is classified as `RESIDUAL_FRAGILE` (pure beta loading) and rejected.
- **Regime Robustness:** Strategy performance must be broken down across at least 3 distinct macro regimes: Bull (2020–2021), Bear (2022), and Range/Chop (2023–2024).
