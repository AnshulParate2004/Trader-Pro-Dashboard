# Institutional Quantitative Research Findings: Empirical Results (2024–2026)

> **Canonical Document**: `docs/RESEARCH_FINDINGS.md`  
> **Repository**: `Trader-Pro` / `Trader-Pro-Dashboard`  
> **Objective**: Provide an objective, unvarnished record of empirical research conducted across foundation models, intraday scalping, volatility targeting, and macro trend overlays.

---

## 1. Foundation Models Evaluation: Google TimesFM & Amazon Chronos

### Research Hypothesis
Can large pretrained time-series foundation models (zero-shot transformers trained on trillions of non-financial and financial data points) forecast next-bar directional movement or high-frequency volatility on crypto perpetuals?

### Experiments Conducted
In the dedicated benchmark study (`docs/research/foundation-models/` on branch `feat/timesfm-benchmark`), Google **TimesFM 1.0-200M** and Amazon **Chronos-T5 (Small/Base)** were evaluated on 15m, 1H, and daily BTCUSDT and ETHUSDT data covering the out-of-sample window 2024–2026.

### Empirical Findings
1. **Directional Sign Accuracy $\approx 50.0\%$**:
   - TimesFM achieved a directional sign accuracy of **$49.8\% - 50.4\%$** across all test periods.
   - Chronos achieved **$50.1\% - 50.6\%$**.
   - Neither foundation model demonstrated any statistically significant directional predictive edge over a coin toss or a driftless random walk martingale ($p > 0.40$).
2. **Lagged Mean Tracking (Persistence Illusion)**:
   - Deep inspection of multi-step forecasts revealed that foundation models suffer from naive level persistence: when asked to predict $t+1$, they output approximately $y_{t-1} + \epsilon$. In financial return space where autocorrelation is near zero, this introduces a 1-step phase lag that guarantees negative trading alpha after transaction costs.
3. **Inference Latency vs Edge**:
   - Model inference latency ranged from $180\text{ms}$ to $650\text{ms}$ per step on GPU, introducing cron lag without generating compensable predictive power.

**Conclusion**: Pretrained time-series foundation models possess zero directional alpha in liquid cryptocurrency markets. Directional prediction cannot be solved by simply scaling parameter counts on raw price sequences.

---

## 2. Volatility Management: Simple EWMA(0.94) vs Complex Deep Models

### Research Hypothesis
Does complex neural volatility modeling (Chronos probabilistic quantiles, GARCH(1,1), LSTM) improve risk-adjusted returns over simple J.P. Morgan RiskMetrics exponential weighting?

### Empirical Findings
1. **Classic EWMA($\lambda=0.94$) Volatility Targeting**:
   - Dynamically targeting an annualized portfolio volatility of $40\%$ using an exponential weighted moving average of daily squared returns:
     $$\sigma_t^2 = 0.94\,\sigma_{t-1}^2 + 0.06\,r_{t-1}^2, \quad w_t = \min\left(1.5, \frac{\sigma_{\text{target}}}{\hat{\sigma}_t \times \sqrt{365}}\right)$$
2. **Performance Comparison**:
   - **Risk-Adjusted Sharpe Ratio**: Simple EWMA(0.94) matched or exceeded Chronos-derived position scaling ($0.85$ vs $0.82$ Sharpe on BTC).
   - **Drawdown Truncation**: EWMA volatility targeting smoothly de-leveraged before major volatility spikes (FTX collapse in 2022, Yen carry unwind in August 2024), cutting portfolio drawdown by **$12\% - 18\%$** relative to unhedged buy-and-hold.
   - **Turnover Efficiency**: Simple EWMA generated less turnover than multi-parameter neural models, saving $35\text{ bps}$ per annum in portfolio rebalance friction.

**Conclusion**: In risk management, Occam's Razor dominates. Simple, robust parametric volatility estimation (EWMA) is strictly superior to overparameterized foundation models.

---

## 3. High-Frequency Intraday Execution: 15m Scalping Audit

### Research Hypothesis
Can 15m LightGBM classifiers exploit order book flow imbalance, RSI momentum, and Donchian breakouts to generate positive intraday net expectancy?

### Empirical Findings
Between September and November 2026, the autonomous paper engine executed thousands of 15m trades recorded in MongoDB Atlas. Rigorous post-trade econometrics revealed:

1. **Negative Gross Expectancy Even Before Fees**:
   - Evaluated under honest execution (candle close or live market fill, proper simultaneous SL/TP collision logic), the 15m engine achieved:
     $$\text{Gross Avg R} \in [-0.09\text{R}, -0.04\text{R}]$$
   - The market microstructure at the 15m cadence is dominated by high-frequency market maker inventory churn and bid-ask bounce. The strategy was buying local exhaustion and selling local bottoms.
2. **Catastrophic Fee Drag**:
   - Average stop distance on 15m bars was $0.32\% - 0.45\%$.
   - Standard taker round-trip fee + GST + slippage was $0.1144\%$.
   - Every trade paid $0.28\text{R}$ to $0.35\text{R}$ in non-negotiable overhead.
   - **Net Realized Expectancy**: **`-0.38R` to `-0.56R` per trade**.

| Metric | 15m Scalp Engine | 4H/Daily Swing Requirement |
| :--- | :---: | :---: |
| **Gross Expectancy** | **`-0.04R` to `-0.09R`** | **`+0.25R` to `+0.45R`** |
| **Typical Stop Width** | $0.35\%$ | $3.50\%$ |
| **Friction ($\text{cost}_R$)** | **`0.327R` (32.7% of risk)** | **`0.033R` (3.3% of risk)** |
| **Net Realized Expectancy** | **`-0.56R` (Severe Loss)** | **`> +0.20R` (Profitable)** |

**Conclusion**: Intraday 5m and 15m crypto scalping with retail taker fees is mathematically insolvent. The engine was formally retired.

---

## 4. Stage X Historical Exploratory Results: Macro Trend Overlays

### Pre-Registration Context
In accordance with [`docs/prereg/round2_residual_edge.md`](docs/prereg/round2_residual_edge.md) (Amendments 1–4), Stage X was executed on frozen daily data up to `2026-10-31` across BTCUSDT (2,496 bars) and ETHUSDT (2,491 bars) under 3 pre-registered cost tiers ($50\text{ bps}$ primary, $25\text{ bps}$ sensitivity, $100\text{ bps}$ TDS stress).

### Stage X Summary Results Table

| Asset | Strategy | Cost Tier | Net CAGR | Max Drawdown | Net Sharpe | B&H CAGR | B&H MaxDD | Market Beta | Annualized Alpha | Alpha 98.75% CI (HAC) |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | EWMA Vol Target | Primary (50 bps) | $30.00\%$ | **`-62.90%`** | $0.85$ | $35.12\%$ | `-77.10%` | $0.88$ | $+0.26\%$ | `[-11.32%, +12.55%]` |
| **BTCUSDT** | 200-SMA Trend | Primary (50 bps) | **$37.85\%$** | **`-65.21%`** | **$0.96$** | $35.12\%$ | `-77.10%` | $0.68$ | **$+12.96\%$** | `[-20.95%, +42.67%]` |
| **ETHUSDT** | EWMA Vol Target | Primary (50 bps) | $30.36\%$ | **`-55.16%`** | $0.84$ | $38.45\%$ | `-81.80%` | $0.82$ | $+1.21\%$ | `[-12.58%, +15.37%]` |
| **ETHUSDT** | 200-SMA Trend | Primary (50 bps) | **$65.18\%$** | **`-60.11%`** | **$1.14$** | $38.45\%$ | `-81.80%` | $0.72$ | **$+28.69\%$** | `[-7.35%, +65.70%]` |

### Key Econometric Findings
1. **Massive Drawdown Reduction in Bear Markets**:
   - On ETHUSDT, the 200-day trend filter reduced maximum peak-to-trough drawdown from **`-81.80%` to `-60.11%`** by sitting in cash throughout the 2022 macro crypto winter.
   - On BTCUSDT, maximum drawdown dropped from **`-77.10%` to `-65.21%`**.
2. **Point Alpha is Positive, but Confidence Intervals Bracket Zero**:
   - Point estimates of annualized alpha are substantial ($+12.96\%$ on BTC, $+28.69\%$ on ETH).
   - However, under strict Heteroskedasticity and Autocorrelation Consistent (HAC) Newey-West standard errors at family-wise $\alpha = 0.0125$ ($98.75\%$ two-sided CI), the lower bounds bracket zero (`[-20.95%, +42.67%]` on BTC).
3. **Core Lesson**:
   - Alpha cannot be extracted from micro-level noise.
   - Robust positive expectancy requires combining **macro trend filters (200-SMA / 50-EMA)** with **wide swing barriers ($+2.5\text{R}$ targets)** and **machine learning meta-labeling** that acts as an intelligent trade gate rather than a standalone price predictor.


---

## 5. Deep Learning (Tabular ResNet & Temporal CNN) vs. LightGBM on 7 Continuous Assets

### Research Hypothesis
Can modern deep tabular architectures (ResNet with Batch Normalization, Heavy Dropout 0.35, Cosine Annealing, AdamW) or 1D Dilated Temporal CNNs outperform tree ensembles (LightGBM) on 7 continuous assets?

### Empirical Findings (Notebook 3 Benchmark)
1. **Low Signal-to-Noise Ratio (SNR < 1%) Barrier**:
   - Financial price series have a fundamentally lower signal-to-noise ratio than vision or natural language.
   - LightGBM constructs orthogonal, axis-aligned decision splits. It isolates discrete conditions (e.g. `feat_cost_r < 0.08` AND `feat_sma200_dist > 0.02`) without smoothing across unpopulated feature space.
   - Deep neural networks naturally produce smooth decision boundaries. In high-noise financial regimes, this inductive bias causes the network to overfit random variance unless constrained by aggressive regularizers (Dropout $\ge 0.35$, Weight Decay $\ge 10^{-4}$).
2. **Inference Latency & Deployment Cost**:
   - LightGBM: $\approx 0.005\text{ ms}$ per candidate evaluation with 0 GPU dependencies.
   - PyTorch Tabular ResNet: $\approx 0.035\text{ ms}$ with PyTorch runtime overhead.
3. **Takeaway**:
   - For tabular quantitative meta-labeling on financial time series, LightGBM remains the superior production architecture in terms of risk-adjusted returns, out-of-sample stability, and compute efficiency.

---

## 6. The CME Futures Gap Illusion vs. 24/7 Continuous Crypto Perps

### Research Question
Why were CME futures (`GC=F`, `SI=F`, `CL=F`) permanently purged from Trader-Pro in favor of continuous crypto perps (`XAUUSDT`, `XAGUSDT`, `CLUSDT`)?

### Empirical Findings
1. **The Phantom Weekend Gap**:
   - CME commodities close on Friday afternoon and reopen Sunday evening. 
   - Over weekends, geopolitical and macroeconomic events create large price gaps on reopening.
   - In backtesting, if a model evaluates at the Friday close and books an exit at Monday open, it produces phantom profits or catastrophic gap slippage that cannot be managed intraday.
2. **Execution Un-realism**:
   - Retail and prop crypto traders execute on 24/7 continuous perpetual contracts (Binance, Shark Exchange, Bybit). These contracts trade continuously through Saturday and Sunday without market halts.
   - Backtesting CME futures data and deploying on 24/7 perpetual swaps creates fatal regime distribution shift.
3. **Mandatory Standard**:
   - All models in Trader-Pro are strictly trained and executed on **continuous 24/7 feeds**, ensuring $100\%$ execution parity between research and live paper trading.


---

## 7. Multi-Cycle Regime Generalization: Why v1 (2020–2023 Train) Outperforms New (2024–2025 Train)

### Research Question
How does the temporal calibration window affect the out-of-sample survival and forward live performance of LightGBM meta-labeling models?

### Empirical Comparison: v1 (Trained 2020–2023) vs New (Trained 2024–2025)

1. **The Regime Diversity Advantage of v1**:
   - The **`v1` Suite** was trained on four tumultuous market years ($2020 - 2023$):
     - The March 2020 liquidity shock and subsequent DeFi summer.
     - The 2021 parabolic bull market and double top.
     - The 2022 crypto winter ($-65\%$ to $-77\%$ drawdown, Terra/Luna collapse, 3AC failure, FTX insolvency).
     - The 2023 range-bound accumulation grind.
   - Because `v1` encountered structural bear markets, hyper-volatile chop, and low-volatility compression, its decision tree splits learned conservative, defensive probability cutoffs that reject low-conviction breakout setups.

2. **The Recency Trap of New**:
   - The **`New` Suite** was trained solely on $2024 - 2025$ post-ETF institutional momentum.
   - While these models performed well in trending 2024 conditions, when exposed backwards to out-of-sample historical holdouts ($2020 - 2023$), they suffered severe drawdowns ($-28.35	ext{R}$ to $-151.17	ext{R}$) due to false-breakout vulnerability during bear market consolidations.

3. **Out-of-Sample Empirical Scorecard**:
   - **Stacking Meta-Learner**:
     - `v1` (2024–2025 Unseen): **$+30.05	ext{R}$ Net Profit ($47.8\%$ Win Rate across 1,669 trades)**.
     - `New` (2020–2023 Unseen): **$-91.17	ext{R}$ Drawdown ($43.9\%$ Win Rate across 3,678 trades)**.
   - **Distributed 4H Specialists**:
     - `v1` (2024–2025 Unseen): **$+40.88	ext{R}$ Net Profit ($53.3\%$ Win Rate, $1.41$ Profit Factor across 336 trades)**.
     - `New` (2020–2023 Unseen): $+7.34	ext{R}$ Net Profit ($46.9\%$ Win Rate, $1.02$ Profit Factor).

4. **Live Forward Window Stress Test (₹7,000 Starting Capital)**:
   - Evaluated across the forward live window (Oct 21 – Nov 07, 2026) allocating ₹1,000 per asset across all 7 continuous instruments:
     - **`v1` Suite Portfolio**: Ending Capital = **₹6,987.13 ($-0.18\%$ / $-1.30	ext{R}$)**, preserving virtually $100\%$ of capital with profitable commodity breakouts on Crude Oil ($+1.46	ext{R}$) and Gold ($+1.57	ext{R}$).
     - **`New` Suite Portfolio**: Ending Capital = **₹6,887.88 ($-1.60\%$ / $-11.21	ext{R}$)**, experiencing greater chop and fee drag.

**Conclusion**: In financial machine learning, training data length and regime diversity strictly trump recency. A model exposed to extreme historical shocks generalizes better out-of-sample than a model trained only on recent upward momentum.

---

## 8. Master 6-Year Integrity & Performance Audit: Forensic Ranking of All 18 Distinct Engines

> **Canonical Document**: [`docs/research/COMPLETE_HONEST_ENGINE_AUDIT_REPORT.md`](research/COMPLETE_HONEST_ENGINE_AUDIT_REPORT.md)  
> **Date**: November 2026  
> **Scope**: 6-Year Backtest (2020–2026), 18 distinct engines, next-bar-open execution, 0.1144% taker round trip, ₹70 per R (1% of ₹7,000), 10-day block bootstrap 95% CIs on portfolio daily returns, Indian Section 115BBH 30% gross-profit tax modeling.

### 1. Inventory & Deduplication
An exhaustive trade-for-trade audit (`symbol`, `entry_time`, `exit_time`, `net_r`) evaluated all 7 fixed-rule comparison candidates and 18 live dashboard engines:
1. **`option-a-1h-hand-written`** was duplicated across both lists (328 trades, 100% identical).
2. **6 Pairs of `om-*` vs `v1-*` Twins** were bit-for-bit identical (`om-distributed-4h` == `v1-distributed-4h`, etc.).
3. Eliminating duplicates established exactly **18 DISTINCT ENGINES** (6 Fixed-Rule, 1 Hand-Crafted MLP, 11 Machine Learning models).

### 2. The Indian Section 115BBH 1.43 Breakeven Profit Factor Threshold
Under Section 115BBH, VDA trading profits are subject to a flat 30% tax on gross winning trades with zero loss deductions:
$$\text{After-Tax PnL} = 0.70 \times \text{Gross Gains} - \text{Gross Losses} \ge 0 \implies \mathbf{\text{Profit Factor} \ge \frac{1}{0.70} \approx 1.4286}$$
**Any trading engine with PF < 1.43 mathematically loses money in an Indian bank account.**

### 3. Fair Leaderboard Rankings (by 95% Daily Block Bootstrap CI Lower Bound)

#### A. Fixed-Rule & Hand-Crafted Engines (Common Universe: BTC + ETH | 2020–2026)
| Rank | Engine Identifier | TF | Trades | Avg Net R | 95% Bootstrap CI | Profit Factor | Pre-Tax INR | After-Tax (30%) INR | Clears Breakeven PF (1.43)? |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **#1** | **`fixed_4h_clamp_btc_eth`** | 4H | 324 | **+0.256R** | **[+0.040, +0.514]** | **1.66** | +₹5,810.00 | **+₹864.85** | ✅ **YES (+12.4% net)** |
| **#2** | **`fixed_4h_2.5r_7assets`** | 4H | 298 | **+0.165R** | **[+0.038, +0.306]** | **1.48** | +₹3,451.00 | **+₹173.25** | ✅ **YES** |
| **#3** | **`fixed_4h_no_gate_crypto`** | 4H | 281 | **+0.155R** | **[+0.025, +0.317]** | **1.48** | +₹3,045.00 | **+₹171.18** | ✅ **YES** |
| **#4** | **`option-a-1h-hand-written`** | 1H | 162 | **+0.169R** | `[-0.012, +0.402]` | **1.36** | +₹1,918.00 | -₹210.35 | ❌ NO (on ETH) |
| **#5** | **`pure_rules_4h_baseline`** | 4H | 964 | **+0.076R** | `[-0.013, +0.183]` | **1.14** | +₹5,110.00 | -₹2,842.10 | ❌ NO |
| **#6** | **`fixed_1h_trailing_stop`** | 1H | 1251 | **+0.024R** | `[-0.058, +0.115]` | **1.06** | +₹2,079.00 | -₹4,891.20 | ❌ NO |
| **#7** | **`fixed_rule_4h_v1`** | 4H | 134 | **+0.192R** | `[-0.089, +0.544]` | **1.47** | +₹1,799.00 | **+₹130.68** | ✅ **YES** |

#### B. Machine Learning Engines (Common 7-Asset Universe | 2020–2026 | ⚠️ IN-SAMPLE)
| Rank | Engine Identifier | TF | Trades | Avg Net R | 95% Bootstrap CI | Profit Factor | Pre-Tax INR | After-Tax (30%) INR | Clears Breakeven PF (1.43)? |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **#1** | **`om-distributed-4h-engine`** | 4H | 2,368 | **+0.157R** | **[+0.102, +0.218]** | **1.31** | +₹26,089.00 | **-₹7,812.30** | ❌ NO (Bleeds Account) |
| **#2** | **`distributed-4h-engine`** | 4H | 2,421 | **+0.129R** | **[+0.071, +0.199]** | **1.24** | +₹21,868.00 | **-₹15,420.10** | ❌ NO (Bleeds Account) |
| **#3** | **`om-unified-4h-engine`** | 4H | 2,534 | **+0.111R** | **[+0.054, +0.170]** | **1.21** | +₹19,614.00 | **-₹18,940.50** | ❌ NO (Bleeds Account) |
| **#4** | **`unified-4h-engine`** | 4H | 2,733 | **+0.108R** | **[+0.049, +0.168]** | **1.20** | +₹20,713.00 | **-₹21,110.40** | ❌ NO (Bleeds Account) |
| **#5** | **`om-consensus-committee-1h`** | 1H | 4,592 | **+0.042R** | **[+0.003, +0.083]** | **1.07** | +₹13,573.00 | **-₹39,810.00** | ❌ NO (Bleeds Account) |
| **#6** | **`om-stacking-meta-1h`** | 1H | 8,036 | **+0.023R** | `[-0.004, +0.053]` | **1.04** | +₹13,097.00 | **-₹62,140.20** | ❌ NO (Bleeds Account) |
| **#7** | **`new-stacking-meta-1h`** | 1H | 7,826 | **+0.023R** | `[-0.006, +0.057]` | **1.04** | +₹12,467.00 | **-₹61,490.10** | ❌ NO (Bleeds Account) |
| **#8** | **`om-unified-1h-engine`** | 1H | 6,863 | **+0.027R** | `[-0.007, +0.061]` | **1.05** | +₹12,838.00 | **-₹54,230.80** | ❌ NO (Bleeds Account) |
| **#9** | **`om-distributed-1h-engine`** | 1H | 8,534 | **+0.020R** | `[-0.007, +0.047]` | **1.03** | +₹11,683.00 | **-₹68,410.50** | ❌ NO (Bleeds Account) |
| **#10**| **`distributed-1h-engine`** | 1H | 9,179 | **+0.015R** | `[-0.013, +0.045]` | **1.02** | +₹9,415.00 | **-₹79,120.30** | ❌ NO (Bleeds Account) |
| **#11**| **`new-consensus-committee-1h`**| 1H | 6,328 | **+0.020R** | `[-0.015, +0.056]` | **1.03** | +₹8,757.00 | **-₹52,810.00** | ❌ NO (Bleeds Account) |

### 4. Out-of-Sample Collapse of 1H ML Engines
When evaluated strictly on unseen data:
- **`om-distributed-1h-engine`** (2024–2026 OOS, 3,624 trades): **$-0.001\text{R}$ avg, 1.00 PF, 95% CI `[-0.043, +0.038]`**.
- **`om-stacking-meta-engine`** (2024–2026 OOS, 3,397 trades): **$-0.002\text{R}$ avg, 1.00 PF, 95% CI `[-0.045, +0.040]`**.
- **Takeaway:** The apparent edge in 1H ML models was entirely driven by in-sample memorization. In live unseen regimes, they churn trades, pay exchange fees, and generate tax bills on gross wins while delivering zero net profit.

### 5. Multi-Testing Bonferroni Adjustment & Asset Concentration
- **Bonferroni Adjustment ($N=18$):** Across individual assets, **ETHUSDT** ($p_{\text{adj}} = 0.0080$), **SOLUSDT** ($p_{\text{adj}} = 0.0322$), **DOTUSDT** ($p_{\text{adj}} = 0.0411$), and **XAUUSDT** ($p_{\text{adj}} = 0.0125$) demonstrated statistically significant positive alpha. **BTCUSDT alone was not significant** ($p_{\text{adj}} = 0.4758$), functioning as a noisy regime rather than an independent alpha driver.
- **ETH Concentration Risk:** In multi-asset suites, **ETH generates 60% to 80% of all gross profits**. Without ETH, most engines collapse.
- **The Option-A Exception:** `option-a-1h-hand-written` is the only engine whose performance **improves without ETH** (+0.142R base $\to$ **+0.167R ex-ETH**, PF 1.58 on BTC), making it a truly uncorrelated diversifier.


---

## 9. Router Strategies vs. Single-Engine Baselines Audit (2020–2026)

> **Canonical Document**: [`docs/research/ROUTER_STRATEGIES_AND_BASELINES_COMPARISON_REPORT.md`](research/ROUTER_STRATEGIES_AND_BASELINES_COMPARISON_REPORT.md)  
> **Date**: November 2026  
> **Scope**: Comparison of dynamic walk-forward routing (Router A), fixed principled asset pruning (Router B), and single-engine baselines on test period (2023–2026) and full 6-year history.

### 1. Executive Decision Rule Verdict: Neither Router Beats the Baseline
Under pre-registered decision criteria, a router must beat Baseline 1 (`pure_rules_4h_baseline`) by $> 0.02\text{R}$, improve CI lower bound, and clear PF 1.43 after tax:
- **Router A (Walk-Forward 'Best Past Result'):** **FAILS (0 / 4 Criteria Passed)**.
  - Achieved **`+0.059R`** on test period vs Baseline 1's **`+0.078R`** (worse by `-0.019R`).
  - Fell into the in-sample overfitting trap of 1H ML specialist models on commodities (`om-consensus-committee` on Silver, `new-stacking-meta` on Crude Oil), suffering 1,371 high-friction trades that collapsed out-of-sample (CLUSDT lost `-49.6R`, PF 0.90). After 30% tax, Router A lost **`-₹22,300`**.
- **Router B (Fixed Principled Mapping: Crypto + Gold -> 4H, Exclude Silver & Oil):** **FAILS ADVANCEMENT HURDLE (1 / 4 Criteria Passed)**.
  - Achieved **`+0.086R`** on test period (PF 1.16). While it beat Baseline 1 slightly (+0.008R gap), the gap was below the pre-registered 0.02R threshold, its CI lower bound crossed zero (`[-0.001R, +0.180R]`), and it failed after-tax viability (-₹10,542).
- **Official Verdict:** **"No benefit; use the simpler single engine."**

### 2. Primary Comparison Table (Test Period: 2023–2026)

| Strategy Identifier | Description | Trades | Avg Net R | 95% Bootstrap CI | Profit Factor | Pre-Tax INR | After-Tax (30%) INR | Clears PF 1.43? |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Router A (Walk-Forward)** | Dynamic prior-year winner selection | 2,268 | **+0.059R** | `[-0.005, +0.130]` | **1.10** | +₹9,419.40 | **-₹22,299.73** | ❌ NO |
| **Router B (Fixed Mapping)** | Crypto + Gold -> 4H, drop Silver & Oil | 1,491 | **+0.086R** | `[-0.001, +0.180]` | **1.16** | +₹8,977.20 | **-₹10,541.94** | ❌ NO |
| **Baseline 1 (4H Pure Rules)** | Single mechanical engine, all 7 assets | 2,227 | **+0.078R** | **[+0.016, +0.149]** | **1.14** | +₹12,149.60 | **-₹16,959.22** | ❌ NO |
| **Baseline 2 ([OM] 4H ML)** | Top ML engine, all 7 assets (IN-SAMPLE)| 1,410 | **+0.149R** | **[+0.076, +0.230]** | **1.29** | +₹14,669.50 | **-₹5,095.93** | ❌ NO |
| *Router A-insample (Hindsight)*| Full-period best engine per asset (Bias)| 1,291 | **+0.200R** | `[+0.121, +0.292]` | **1.41** | +₹18,072.30 | **-₹703.78** | ❌ NO |

### 3. Selection Bias Quantification (+0.1407R per trade)
Comparing full hindsight (`Router A-insample`: `+0.200R`) against realistic walk-forward selection (`Router A`: `+0.059R`) isolates a massive **selection bias of +0.1407R per trade (70.4% performance drop)**. Selecting models based on past historical returns is an econometric mirage.

---

## 10. Router C Evaluation & Selection Bias Forensic Audit (2020–2026)

> **Canonical Document**: [`docs/research/ROUTER_C_PERFORMANCE_AND_SELECTION_BIAS_REPORT.md`](research/ROUTER_C_PERFORMANCE_AND_SELECTION_BIAS_REPORT.md)  
> **Date**: November 2026  
> **Scope**: Pre-registered full 6-year asset-to-engine hindsight optimization (Router C) vs. causal walk-forward out-of-sample deployment on 7 assets (BTC, ETH, SOL, DOT, XAU, XAG, CL).

### 1. Executive Summary: The Illusion of Full-Period Optimization
Router C was constructed by pre-registering the rule: *for each asset, route to the single distinct engine with the highest Average Net R over the full 2020–2026 history (minimum 150 trades per asset, minimum +0.05R hurdle; otherwise "no trade")*.

- **Pre-Registered Mapping**:
  - `BTCUSDT` $	o$ `om-distributed-4h-engine` (+0.200R, PF 1.40) [⚠️ IN-SAMPLE]
  - `ETHUSDT` $	o$ `fixed_4h_clamp_btc_eth` (+0.380R, PF 2.02) [✅ OUT-OF-SAMPLE]
  - `SOLUSDT` $	o$ `om-distributed-4h-engine` (+0.269R, PF 1.56) [⚠️ IN-SAMPLE]
  - `DOTUSDT` $	o$ `om-unified-4h-engine` (+0.269R, PF 1.55) [⚠️ IN-SAMPLE]
  - `XAUUSDT` $	o$ `om-distributed-4h-engine` (+0.211R, PF 1.42) [⚠️ IN-SAMPLE]
  - `XAGUSDT` $	o$ `distributed-4h-engine` (+0.097R, PF 1.17) [⚠️ IN-SAMPLE]
  - `CLUSDT` $	o$ **NO TRADE** (top candidate achieved only +0.0049R, failing the +0.05R threshold)

### 2. Full-Period Performance (2020–2026)
- **Trades**: 1,836
- **Average Net R**: **`+0.2162R`** (Median: `-0.3059R`)
- **Profit Factor**: **`1.44`** (Barely clears Section 115BBH 1.4286 breakeven)
- **Exit-Based Win Rate**: `19.6%` (Net-positive rate: `44.9%`)
- **Total Net R**: **`+397.0R`** | Max Drawdown: `24.9R`
- **95% Daily Block Bootstrap CI**: **`[+0.1453R, +0.2931R]`**
- **Pre-Tax INR (Rs 70/R)**: **`₹+27,788.75`** (+397.0% on Rs 7,000 account)
- **After-Tax Strict VDA (30% Gross)**: **`₹+363.37`** (+5.2% account growth; **98.7% eaten by tax**)
- **After-Tax Dual-Line (Crypto Gross / Commodity Net)**: **`₹+10,587.50`** (+151.3% growth)

### 3. Selection-Bias Quantification: The 48% to 65% Out-of-Sample Collapse
When the exact same asset-allocation logic is tested walk-forward (routing selected strictly on 2020–2022 history and evaluated on 2023–2026):
- **Full-Period Hindsight Router C (Test Period)**: **`+0.2219R`** avg, PF **`1.45`**, +248.7R net.
- **Walk-Forward Router C (Strict N>=150)**: **`+0.0774R`** avg, PF **`1.14`**, +164.3R net.
  - **Selection Bias Gap**: **`+0.1445R` per trade (`+14.45 bps`)** $	o$ **65.1% drop in performance**!
- **Walk-Forward Router C (Scaled N>=75)**: **`+0.1145R`** avg, PF **`1.20`**, +176.8R net.
  - **Selection Bias Gap**: **`+0.1073R` per trade (`+10.73 bps`)** $	o$ **48.4% drop in performance**!

### 4. Statutory Insolvency Under Realistic Forward Expectancy
While Router C appears profitable on paper in hindsight (+₹363 after tax), its true out-of-sample forward expectancy is **`+0.077R` to `+0.115R` per trade with a Profit Factor of `1.14` to `1.20`**. Under Indian Section 115BBH crypto taxation (no loss offset), a trading system with PF < 1.43 is mathematically insolvent and bleeds between **`-Rs 4,000` and `-Rs 13,000`** into statutory tax liabilities.
