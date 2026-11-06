# Phase 1: Data Inventory, Power Analysis & Burned Data Audit

> **Document Type:** Institutional Quantitative Research Report (Phase 1)  
> **Repository:** Trader-Pro / Trader-Pro-Dashboard  
> **Branch:** `feat/cost-aware-engine`  
> **Date:** November 2026  
> **Scope:** Pre-requisite quantitative audit before formulating Round 3 hypotheses. Docs only — zero strategy code runs.

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

### 2.1 Empirical Standard Deviation of R ($\sigma_R$) from Project Trade Logs
From historical backtest CSVs (`src/models/*/trades_main.csv`), bracket re-simulations (`analysis/EDGE_REPORT.md`), and live MongoDB logs:
- **15M LightGBM ($N = 11,548$):** $\sigma_R = 0.8434\text{R}$
- **1H LightGBM ($N = 2,624$):** $\sigma_R = 0.8281\text{R}$
- **4H LightGBM ($N = 598$):** $\sigma_R = 0.8007\text{R}$
- **1D Breakout ($N = 88$):** $\sigma_R = 0.8514\text{R}$
- **Live Scalp MongoDB ($N = 75$):** Discrete outcome model ($36.0\%$ TP at $+1\text{R}$, $33.3\%$ BE at $0\text{R}$, $29.3\%$ SL at $-1\text{R}$) yields $\sigma_R = \sqrt{E[R^2] - (E[R])^2} \approx 0.805\text{R}$.
- **Consensus Project Range:** $\sigma_R \in [0.80\text{R}, 0.85\text{R}]$ (Mean benchmark: $\mathbf{0.825\text{R}}$).

---

### 2.2 Trades Needed for 95% Confidence Interval Excluding Zero
For an observed sample mean $\hat{\mu} = \mu$:
$$\text{SE} = \frac{\sigma_R}{\sqrt{N}} \implies \text{CI}_{\text{lower}} = \mu - 1.95996 \cdot \frac{\sigma_R}{\sqrt{N}} > 0 \implies N \ge \left(\frac{1.95996 \cdot \sigma_R}{\mu}\right)^2$$

In addition, standard pre-study statistical power ($80\%$ power at $\alpha = 0.05$, where $z_{1-\alpha/2} + z_{0.80} = 1.96 + 0.84 = 2.80$) requires:
$$N_{80\%\text{ power}} \ge \left(\frac{2.80158 \cdot \sigma_R}{\mu}\right)^2$$

| Target Gross Expectancy ($\mu$) | Trade R Volatility ($\sigma_R$) | Trades Needed for 95% CI Lower Bound $> 0$ ($z = 1.96$) | Trades Needed for 80% Power at $\alpha = 0.05$ ($z = 2.80$) |
| :--- | :--- | :---: | :---: |
| **$\mu = +0.10\text{R}$ per trade** | $\sigma_R = 0.800\text{R}$ | **246 trades** | 503 trades |
| | $\sigma_R = 0.825\text{R}$ *(Project Baseline)* | **262 trades** | 535 trades |
| | $\sigma_R = 0.850\text{R}$ | **278 trades** | 568 trades |
| **$\mu = +0.05\text{R}$ per trade** | $\sigma_R = 0.800\text{R}$ | **984 trades** | 2,010 trades |
| | $\sigma_R = 0.825\text{R}$ *(Project Baseline)* | **1,046 trades** | 2,137 trades |
| | $\sigma_R = 0.850\text{R}$ | **1,111 trades** | 2,269 trades |

---

### 2.3 Calendar Months of Signals Needed Across 20 Coins
Because candidate rules must have holding periods of **at least 1 day**, signal generation is governed by macro market rotation. Across a 20-coin universe, total monthly signal volume depends on trading frequency ($k$ trades per coin per month):

$$\text{Monthly Trades} = 20 \times k \implies \text{Months Needed} = \frac{N}{\text{Monthly Trades}}$$

| Strategy Regime / Candidate Rule Family | Expected Signal Rate ($k$) | Total Universe Signals / Month | Months Needed for $\mathbf{+0.10\text{R}}$ ($N = 262$) | Months Needed for $\mathbf{+0.05\text{R}}$ ($N = 1,046$) | Months for 80% Power at $+0.05\text{R}$ ($N = 2,137$) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **High-Turnover Macro**<br>*(e.g., 7-day Cross-Sectional Momentum, weekly rebalance, top/bottom 3 coins)* | 4 trades / coin / month | **80 trades / month** | **3.3 months** | **13.1 months** *(1.1 years)* | 26.7 months *(2.2 years)* |
| **Medium-Turnover Macro**<br>*(e.g., 14–30 day Cross-Sectional Momentum, Multi-Day OI + Price Breakout)* | 2 trades / coin / month | **40 trades / month** | **6.6 months** | **26.2 months** *(2.2 years)* | 53.4 months *(4.5 years)* |
| **Low-Turnover / Tail Events**<br>*(e.g., Funding-Rate Extremes at $\ge 95^{\text{th}}$ percentile, 30-day Carry Filter)* | 1 trade / coin / month | **20 trades / month** | **13.1 months** *(1.1 years)* | **52.3 months** *(4.4 years)* | 106.8 months *(8.9 years)* |

> **Key Takeaway from Power Analysis:**  
> A small gross edge of $+0.05\text{R}$ **cannot be statistically verified with only 6 months of data**, even across 20 coins. Detecting a $+0.05\text{R}$ edge requires at least **13 to 52 calendar months** of out-of-sample data depending on turnover. Conversely, if an edge is $+0.10\text{R}$, a 20-coin universe generating 40–80 trades per month can reach statistical significance ($95\%\text{ CI} > 0$) within **3.5 to 7 months**.

---

## 3. Exhaustive Inventory of Burned Windows & Assets

To preserve complete scientific integrity, any asset, timeframe, or date window that has been inspected, trained upon, or backtested in this repository is cataloged below:

### 3.1 Fully Burned Assets & Windows
1. **BTCUSDT (Completely Burned across All Granularities):**
   - **Price OHLCV (5M, 15M, 1H, 4H, 1D, 1W):**
     - Full history from `2020-01-01` to `2026-10-31` was burned by LightGBM training (`trained_until: 2026-10-26`), 108 parameter grid searches on 4H DEV folds, bracket simulation audits, Donchian 20/10 daily trend runs, and Round 2 pre-registration.
   - **Derivatives & Metrics (Funding Rates, Open Interest, Long/Short Ratio, Basis):**
     - Funding rate history (`funding_rates_BTCUSDT.parquet`, `2019-09-10` to `2026-10-31`, 7,826 rows) and hourly metrics (`metrics_BTCUSDT_1h.parquet`, `2020-09-01` to `2026-10-30`, 54,024 rows) were burned in `run_derivatives_study.py` (Feature Groups G0–G3 across DEV `2020-09` to `2023-12` and VAL `2024-01` to `2024-12`).
     - Strategy A3 (Funding Carry) and Strategy B1 (100-day SMA Trend) were evaluated directly on the `FINAL` window (`2025-01-01` to `2026-10-31`) in `evaluate_final.py`.
   - **Live Production MongoDB Trades:**
     - 75 closed scalp trades (`median stop = 0.2287%`, late Oct – early Nov 2026).

2. **ETHUSDT (Burned on Price History):**
   - **1D Candles:** `2020-01-01` to `2026-10-26` (2,491 bars) burned in Donchian 20/10 study (`docs/research/ETH_RESULTS.md`) and Round 2 preregistration.
   - **15M, 1H, 4H, 1W Candles:** Downloaded and stored in `notebooks/data/`.

3. **BNBUSDT, SOLUSDT, XRPUSDT (Price Downloaded, Derivatives Untouched):**
   - Price parquet files exist in `notebooks/data/` (15M, 1H, 4H, 1D, 1W) from `2020-02` (BNB), `2020-09` (SOL), and `2020-01` (XRP) to `2026-10-26`.
   - **Derivatives Status:** Derivatives metrics (funding rate history, open interest, long/short ratio, basis) have **never been downloaded, never cached, and never tested**.

---

### 3.2 Pristine, Unmined Assets & Data Sources (Zero Project Exposure)
The following liquid perpetual assets and features have **never been accessed, never downloaded, and never mined** anywhere in this project:
- **Altcoins (17+ Major Assets):**
  `ADAUSDT`, `DOGEUSDT`, `AVAXUSDT`, `LINKUSDT`, `DOTUSDT`, `NEARUSDT`, `LTCUSDT`, `BCHUSDT`, `UNIUSDT`, `ATOMUSDT`, `ETCUSDT`, `FILUSDT`, `TRXUSDT`, `AAVEUSDT`, `XLMUSDT`, `VETUSDT`, `ICPUSDT`.
- **Derivatives Data on Altcoins:**
  Full funding rate histories, 5-minute/daily open interest series, long/short ratios, and basis curves for all 17+ altcoins (plus BNB, SOL, and XRP) are completely untouched.
- **Untouched Time Window:**
  Any temporal window on the unmined altcoin universe is 100% free of lookahead, feature selection bias, or overfitting.
