# Pre-Registration Protocol: US Equities Factor Interaction Exploration (2010–2026)
**Document ID:** `PREREG-US-FACTOR-INTERACTIONS-V1`  
**Git Branch:** `feat/us-factor-heatmaps` (forked from `fix/value-vs-trend-audit`)  
**Timestamp:** `2026-11-12T18:50:00+05:30`  
**Execution Environment:** `D:\Projects_Main\Trade-Pro\Trader-Pro-Dashboard`  
**Methodological Standard:** Point-in-Time Causality, Strict Discovery/Validation Sample Splitting, Pre-Registered Factor Pairs Only, Masking Small Samples ($n < 30$), Zero Machine Learning, Zero Tuning.

---

## 1. Executive Mandate & Pre-Commitment

This document locks the hypothesis space and interaction pairs prior to the generation of any interaction heat map, bivariate surface, or consistency matrix in `notebooks/us_factor_interactions.ipynb`.

### Methodological Invariants
1. **Strict Sample Split:**
   - **Discovery Sample:** `2010-01-01` to `2019-12-31` (10 calendar years, 120 monthly rebalances).
   - **Validation Sample:** `2020-01-01` to `2026-10-31` (6.83 calendar years, 82 monthly rebalances).
   - **Isolation Rule:** Discovery and Validation distributions and interactions must never be pooled or cross-contaminated during exploration.
2. **Point-in-Time Causality:**
   - Fundamentals (TTM Diluted EPS, P/E, Earnings Growth) use strictly the official SEC filing date ($t_{\text{filed}} \le t_{\text{rebalance}}$), never accounting period-end dates.
   - Forward returns and forward drawdowns assume fills strictly executed at the market Open of the next trading day ($t+1$).
   - Truncation proof: 200 random dates recomputed using only historical data prior to that date must match the feature store bit-for-bit.
3. **No Network Calls inside Notebook:**
   - The analysis notebook reads exclusively from cached local Parquet/JSON data.
4. **Small-Sample Masking:**
   - Any interaction cell with fewer than 30 observations ($n < 30$) is strictly masked and excluded from inference.
5. **Pre-Registered Pairs Only:**
   - No data-snooping or combinatorial search across unlisted factor pairs. Exactly the 8 pairs specified below are evaluated.

---

## 2. Feature Panel Definitions (Monthly Rebalance Horizon)

| Feature Name | Type | Mathematical Definition & Economic Rationale |
| :--- | :---: | :--- |
| `value_z_own_pe` | Continuous | Rolling 5-year z-score of point-in-time P/E using past data only: $-(\text{PE}_t - \mu_{5y}) / \sigma_{5y}$. Higher score = cheaper relative to own history. |
| `pe_vs_sector` | Continuous | Relative valuation vs. sector: $-(\text{PE}_{i, t} - \text{Median}_{\text{sector}, t}) / \text{Median}_{\text{sector}, t}$. (Fallback to universe median if sector count $< 8$). |
| `eps_growth_yoy` | Continuous | Earnings acceleration composite: $(\Delta \text{TTM EPS}_{\text{YoY}} / \vert \text{TTM EPS}_{t-1y} \vert) + (\Delta \text{Q EPS}_{\text{YoY}} / \vert \text{Q EPS}_{t-1y} \vert)$. |
| `momentum_12_1` | Continuous | 12-1 month price momentum: $(P_{t-21} - P_{t-252}) / P_{t-252}$. |
| `rsi14` | Continuous | 14-day Wilder Relative Strength Index on daily closing prices. |
| `ema20_50_state` | Binary Flag | Trend alignment indicator: $1$ if $\text{Close}_t > \text{EMA}_{50, t}$ and $\text{EMA}_{20, t} > \text{EMA}_{50, t}$; $0$ otherwise. |
| `dist_above_support_atr` | Continuous | Distance to latest confirmed swing low (pivot length $k=5$): $(Close_t - \text{SwingLow}_t) / \text{ATR}_{14, t}$. |
| `dist_to_resistance_atr` | Continuous | Distance to latest confirmed swing high (pivot length $k=5$): $(\text{SwingHigh}_t - Close_t) / \text{ATR}_{14, t}$. |
| `trendline_dist_atr` | Continuous | Distance to ascending structural trendline connecting last two confirmed swing lows: $(Close_t - \text{Trendline}_t) / \text{ATR}_{14, t}$ ($NaN$ if trendline slope $\le 0$ or $<2$ lows). |
| `volume_ratio_50d` | Continuous | 5-day average volume divided by 50-day average volume: $\text{SMA}_5(\text{Vol}) / \text{SMA}_{50}(\text{Vol})$. |
| `atr_pct` | Continuous | Normalized daily volatility: $\text{ATR}_{14, t} / Close_t$. |
| `sector` | Categorical | SEC SIC 2-digit industry mapping. |

---

## 3. Forward Target Definitions (Entry at Next-Day Open)

For each stock $i$ at monthly rebalance date $t$, entry occurs at $O_{i, t+1}$:

1. **Forward Excess Return ($R^{\text{excess}}_{i, H}$):**
   $$R_{i, H} = \frac{C_{i, t+1+H} - O_{i, t+1}}{O_{i, t+1}}$$
   $$R^{\text{excess}}_{i, H} = R_{i, H} - \bar{R}_{H, t}$$
   where $\bar{R}_{H, t}$ is the cross-sectional mean return of all available universe constituents over the same horizon $H \in \{21, 63, 252\}$ trading days.
2. **Worst Forward Fall / Maximum Drawdown ($\text{WF}_{i, H}$):**
   $$\text{WF}_{i, H} = \min_{\tau \in [1, H]} \left(\frac{\text{Low}_{i, t+1+\tau} - O_{i, t+1}}{O_{i, t+1}}\right)$$
   Evaluated over $H \in \{63, 252\}$ trading days.
3. **Explosive Upside Probability ($P_{30\%}$):**
   $$\mathbb{I}\left(\max_{\tau \in [1, 252]} \left(\frac{\text{High}_{i, t+1+\tau} - O_{i, t+1}}{O_{i, t+1}}\right) \ge +0.30\right)$$

---

## 4. Pre-Registered Interaction Pair List (Exactly 8 Pairs)

The interaction analysis will test **strictly and exclusively** the following 8 bivariate combinations (Quintile $\times$ Quintile, or Binary State $\times$ Quintile):

| Pair ID | Factor X | Factor Y | Economic / Structural Hypothesis |
| :---: | :--- | :--- | :--- |
| **(a)** | `value_z_own_pe` | `momentum_12_1` | **Value-Momentum Sweet Spot:** Does combining historically cheap multiples with positive price momentum eliminate value traps while retaining valuation tailwinds? |
| **(b)** | `pe_vs_sector` | `eps_growth_yoy` | **GARP (Growth At a Reasonable Price):** Do stocks cheap relative to sector peers with accelerating EPS growth outperform high-multiple growth or stagnant value? |
| **(c)** | `value_z_own_pe` | `ema20_50_state` | **Trend-Gated Value:** Does filtering cheap stocks by moving-average alignment prevent buying falling knives into cyclical downgrades? |
| **(d)** | `value_z_own_pe` | `dist_above_support_atr` | **Structural Support Value:** Does entering cheap stocks when price is tightly anchored near confirmed structural swing lows compress downside risk? |
| **(e)** | `rsi14` | `ema20_50_state` | **Momentum Pullback in Uptrend:** Does oversold RSI (RSI < 40) within a confirmed bullish moving average regime produce high-expectancy trend continuations? |
| **(f)** | `dist_above_support_atr` | `volume_ratio_50d` | **Volume-Confirmed Support Rebound:** Does accumulation volume near swing support signal institutional buying vs. low-volume drift? |
| **(g)** | `trendline_dist_atr` | `value_z_own_pe` | **Trendline-Anchored Value:** Does valuation cheapness intersecting an ascending multi-pivot trendline create asymmetric payoff skew? |
| **(h)** | `momentum_12_1` | `rsi14` | **Momentum Fatigue vs. Continuation:** Does high intermediate momentum (12-1) accompanied by un-exhausted RSI produce sustainable alpha vs. overbought exhaustion? |

For each pair, two bivariate heat maps will be produced:
1. **Excess Forward Return Map (63-day and 252-day horizon):** Displaying mean excess return, observation count $n$, and Student's $t$-statistic.
2. **Worst-Fall Drawdown Map (252-day horizon):** Displaying mean and median worst drawdown from entry.

---

## 5. Consistency Mapping & False Discovery Standard

### Consistency Metric Definition
A cell $(q_x, q_y)$ is classified as **"Empirically Consistent"** if and only if:
1. **Sign Agreement:** $\text{sign}(\mu_{\text{Discovery}}) = \text{sign}(\mu_{\text{Validation}})$
2. **Statistical Hurdle in Discovery:** $|t_{\text{Discovery}}| \ge 2.00$
3. **Sample Sufficiency:** $n_{\text{Discovery}} \ge 30$ and $n_{\text{Validation}} \ge 30$.

### False Discovery Baseline (Random Noise Expectation)
For a $5 \times 5 = 25$ cell grid, under the null hypothesis of pure Gaussian noise with two-tailed $\alpha = 0.05$:
$$\mathbb{E}[\text{False Positives}] = 25 \times 0.05 \times 0.50 = 0.625 \text{ cells} \quad (\approx 2.5\% \text{ of grid})$$
If a consistency map produces $\le 1$ cell meeting the criteria, the interaction is formally declared **STATISTICALLY INDISTINGUISHABLE FROM RANDOM NOISE**.

---

## 6. Regime Conditioning & Candidate Rule Guidelines

1. **Macro Regime Split:** All interaction heat maps will be conditionally evaluated under:
   - Risk-On: SPY Close > 200-day SMA
   - Risk-Off: SPY Close $\le$ 200-day SMA
   - Stress Sub-Period: The 2022 Bear Market (`2022-01-01` to `2022-12-31`).
2. **Candidate Rules Protocol:**
   - At most 3 candidate quantitative rules may be formulated based strictly on regions that demonstrated robust consistency across both Discovery and Validation.
   - **Zero backtesting of candidate rules inside the exploration notebook.** All formulated rules are deferred to subsequent pre-registered validation harnesses.

---

## 7. Pre-Registration Verification Signature
- **Author:** Careful Quantitative Research Engineer
- **Status:** LOCKED & COMMITTED TO GIT PRIOR TO HEAT MAP COMPUTATION
- **Branch:** `feat/us-factor-heatmaps`
