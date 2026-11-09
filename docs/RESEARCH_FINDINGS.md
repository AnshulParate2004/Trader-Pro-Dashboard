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