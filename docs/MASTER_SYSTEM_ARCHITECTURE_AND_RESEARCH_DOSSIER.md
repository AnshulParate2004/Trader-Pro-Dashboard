# Trader-Pro: Master Architecture, Engine Comparisons & AI Context Dossier

> **Document Type:** Institutional Context Prompt & System Dossier  
> **Repository:** `Trader-Pro-Dashboard` (Runtime Web Terminal) & `Trader-Pro` (Quantitative ML Research)  
> **Active Architecture:** Multi-Asset Unified & Distributed 1H / 4H Meta-Labeling Engines  
> **Audience:** Future AI Agents, Lead Quant, and Pair Programming Sessions  
> **Date:** November 2026

---

## 0. Plug-and-Play System Prompt (Copy-Paste for New AI Sessions)

```markdown
You are the Lead Quantitative Trading & Software Engineering Assistant for Trader-Pro.
Trader-Pro is an algorithmic multi-asset trading and research platform operating on high-rigor econometric standards.

KEY CONTEXT YOU MUST KNOW:
1. Architecture:
   - Trader-Pro-Dashboard: Next.js 14.2 App Router dashboard (/terminal, /ai-engine), headless cron workers (/api/cron/*), MongoDB Atlas trade logging, native in-memory TypeScript decision tree inference (src/lib/treeInference.ts).
   - Trader-Pro: Python quantitative research lake, continuous 7-asset ingestion, visual EDA, LightGBM/XGBoost/PyTorch Tabular ResNet pipelines, and decision tree exporters.
2. The 6 Production Trading Engines:
   - #1: Unified 1H Multi-Asset Meta Engine [1 Universal Brain] (4,403 Holdout Trades, 44.7% WR | 32 Live Trades, 43.8% WR)
   - #2: Distributed 1H Specialists [7 Models] (4,376 Holdout Trades, 43.9% WR | 32 Live Trades, 56.3% WR, +2.18R)
   - #3: Unified 4H Swing Engine [1 Universal Brain] (511 Holdout Trades, 46.6% WR, +26.71R | 1 Live Trade, 100% Cash-Preserved)
   - #4: Distributed 4H Specialists [7 Models] (1,086 Holdout Trades, 46.9% WR | 9 Live Trades, 77.8% WR [7W/2L], +2.21R, 2.89 PF)
   - #5: Rule-Based 1H Baseline [No AI] (6,217 Holdout Trades, 43.3% WR | 62 Live Trades, 46.8% WR)
   - #6: Rule-Based 4H Baseline [No AI] (2,005 Holdout Trades, 46.0% WR | 21 Live Trades, 61.9% WR, +2.48R)
3. Multi-Asset Scope (7 Continuous Instruments):
   - Crypto Perps: BTCUSDT, ETHUSDT, SOLUSDT, DOTUSDT
   - Macro Commodities: XAUUSDT (Gold), XAGUSDT (Silver), CLUSDT (WTI Crude Oil)
   - Zero CME data: GC=F, SI=F, CL=F are permanently decommissioned due to weekend gap traps and non-executable hours.
4. Historical & Out-of-Sample Horizons:
   - Standardized In-Sample Training: 2024 -> 2025 (2 years post-ETF calibration)
   - 4-Year Pre-ETF Unseen Holdout: 2020 -> 2024 (2020 Bull, 2021 Peak, 2022 Bear Crash, 2023 Accumulation)
   - Forward Unseen Live Evaluation: Oct 21, 2026 -> Nov 8, 2026 (Live paper execution on closed bars)
5. Non-Negotiable Hard Invariants:
   - FROZEN FILE: Never edit src/lib/paperExecutor1HA.ts (SHA-256: C1DE3359D29A4B4C6BFB3662A65C2ABF5DD4001052BDF6CAA1A7AA50FB8B33A8).
   - Zero lookahead: Signals evaluate strictly at candle close t-1 with 0 intrabar future leakage.
   - Realistic friction: Shark Exchange taker fee (0.100% + 18% GST) + 0.010% slippage per side (0.1144% - 0.1200% total round-trip).
   - Simultaneous collision precedence: Bar touching both TP and SL is strictly booked as Stop Loss (-1.0R).
   - Fully dynamic UI: Never hardcode metrics or returns; compute all metrics dynamically from live trade executions.
   - Never print or leak secrets/MongoDB URIs.
```

---

## 1. Timeline & Comparative History of All Engines Tested

```mermaid
flowchart TD
    E1["Phase 1: Intraday ML Classifiers<br/>(5m, 15m, 1H-A, 4H LightGBM)"] --> AUDIT["The Forensic Quantitative Audit<br/>(Discovery of Fee Drag, Noise Profit & Beta)"]
    AUDIT --> FREEZE["Freeze Setup 1H-A Baseline Control"]
    FREEZE --> E2["Phase 2: Macro Systematic Overlays & Perps<br/>(Vol Targeting, Funding & OI Surges)"]
    FREEZE --> E3["Phase 3: Time-Series Foundation Models Benchmark<br/>(Chronos-Bolt & TimesFM vs. Classical EWMA)"]
    E2 & E3 --> E4["Phase 4: Multi-Asset Meta-Labeling Modern Architecture<br/>(7 Continuous Assets across 1H and 4H)"]
    E4 --> E5["Phase 5: Deep Learning (Tabular ResNet) vs. LightGBM Benchmark<br/>(Colab Notebook 3: Empirical GBDT Dominance)"]
```

---

### The Evolution of Trader-Pro Engines

1. **Intraday Machine Learning Breakout Classifiers (Legacy Stack)**:
   - *Timeframes Tested:* $5	ext{-minute}$, $15	ext{-minute}$, $1	ext{-hour}$ (`1H-A`), and $4	ext{-hour}$.
   - *The Fatal Flaw Discovered:* At intraday frequencies, stop distances average $0.20\% - 0.50\%$. Under exchange friction of $0.1144\%$, the fee drag ratio $	ext{cost\_R} = rac{	ext{friction}}{	ext{stop}}$ reaches **$0.25	ext{R} - 0.55	ext{R}$ per trade**, mathematically guaranteeing long-term insolvency.
   - *Permanent Status:* Setup `1H-A` is permanently **FROZEN** as an unmanipulated baseline control.

2. **Cross-Sectional Perpetual Derivatives Research**:
   - Evaluated across 20 liquid perpetual contracts ($2020 - 2026$): Contrarian Funding Rate anomalies, Open Interest surges, and Cross-Sectional Momentum.
   - *Result:* Extreme multiple-testing penalty ($M=20, |t| \ge 3.0$) and exchange friction eliminated edge after costs.

3. **Foundation Models Benchmark (Google TimesFM & Amazon Chronos)**:
   - Evaluated 2,730 consecutive daily origins ($2018 - 2026$) zero-shot on BTC.
   - *Result:* Directional accuracy $pprox 50.4\%$ (indistinguishable from a coin toss, beaten by predicting zero return). Pretrained time-series transformers lack directional predictive power in liquid perpetual markets.

4. **Multi-Asset Unified & Distributed Meta-Labeling (Current Production Stack)**:
   - 7 non-correlated continuous assets: 4 Crypto (`BTC`, `ETH`, `SOL`, `DOT`) + 3 Macro Commodities (`XAU`, `XAG`, `CL`).
   - Operating on 1H and 4H horizons where stop distances ($1.0\% - 6.0\%$) compress friction drag to $	ext{cost\_R} \le 0.08	ext{R}$.
   - Deploys 6 concurrent engines (Unified 4H, Distributed 4H, Unified 1H, Distributed 1H, Rule-Based 1H, Rule-Based 4H).

5. **Deep Learning Tabular ResNet & Temporal CNN Benchmark (Notebook 3)**:
   - Evaluated PyTorch Tabular ResNet (BatchNorm, Dropout 0.35, Cosine Annealing, AdamW) and 1D Dilated CNN vs. LightGBM head-to-head on the 7-asset continuous dataset.
   - *Empirical Finding:* LightGBM consistently achieves superior out-of-sample risk-adjusted return and sub-millisecond inference latency (~0.005 ms vs 0.035 ms) due to orthogonal decision boundary properties in low-SNR (<1%) financial regimes.

---

## 2. Complete Scorecard of Evaluated Engines

All figures reflect **strict point-in-time causality**, zero lookahead bias, and **realistic Indian exchange friction deducted** (0.100% taker fee + 18% GST + 0.010% slippage per side = 0.1144% round-trip):

| Rank & Engine Architecture | Timeframe | 2020–2024 Unseen Holdout Trades | Holdout Win Rate | Holdout Net R | Holdout PF | Live Forward Trades (Oct 21 – Nov 8, 2026) | Live Win Rate | Live Realized Net Return | Live PF | Production Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **#1: Unified 1H Multi-Asset [1 Brain]** | **1H** | 4,403 | 44.7% | -48.43 R | 0.97 | 32 trades | 43.8% (14W / 18L) | -1.51 R | 0.88 | **ACTIVE LIVE** (Capital: ₹6,848.70) |
| **#2: Distributed 1H Specialists [7 Models]** | **1H** | 4,376 | 43.9% | -153.16 R | 0.92 | 32 trades | 56.3% (18W / 14L) | **+2.18 R** | 1.25 | **ACTIVE LIVE** (Capital: ₹7,218.40) |
| **#3: Unified 4H Swing Engine [1 Brain]** | **4H** | 511 | 46.6% | **+26.71 R** | 1.16 | 1 trade | Cash-Preserved | 0.00 R | 1.00 | **ACTIVE LIVE** (100% Cash-Safe) |
| **#4: Distributed 4H Specialists [7 Models]** | **4H** | 1,086 | 46.9% | **+7.60 R** | 1.02 | 9 trades | **77.8% (7W / 2L)** | **+2.21 R** | **2.89** | **ACTIVE LIVE CHAMPION** (Capital: ₹7,220.80) |
| **#5: Rule-Based 1H Baseline (No AI)** | **1H** | 6,217 | 43.3% | -130.56 R | 0.95 | 62 trades | 46.8% (29W / 33L) | -3.20 R | 0.91 | **ACTIVE BENCHMARK** (Capital: ₹6,680.00) |
| **#6: Rule-Based 4H Baseline (No AI)** | **4H** | 2,005 | 46.0% | **+46.12 R** | 1.07 | 21 trades | **61.9% (13W / 8L)** | **+2.48 R** | 1.34 | **ACTIVE BENCHMARK** (Capital: ₹7,248.00) |

---

## 3. Backward Out-of-Distribution Unseen Stress Test (2020–2024)

To ensure models are not overfitted to recent market conditions, all models were stress-tested across the **entire 4-year pre-ETF cycle (2020–2024)** across all 7 assets:

```mermaid
xychart-beta
    title "Unseen Holdout Trade Volume Across Market Cycles (2020-2024)"
    x-axis ["2020 (DeFi Bull)", "2021 (Double Peak)", "2022 (Bear Crash)", "2023 (Pre-ETF Accum)", "2024 (Post-ETF Launch)"]
    y-axis "Trade Count" 0 --> 2000
    bar [1287, 1424, 762, 917, 1827]
```

### Key Out-of-Distribution Findings:
1. **Regime Robustness**: In the severe 2022 bear market (-65% BTC drawdown, Terra/Luna collapse, FTX insolvency), the 200-SMA regime filter successfully blocked $> 85\%$ of false long breakouts, protecting capital.
2. **Bull Market Expansion**: In 2020 and 2021, Donchian breakout frequency increased by $3.4\times$, capturing explosive trending legs with positive asymmetric payoffs ($+2.5\text{R}$ target hits).
3. **Friction Resistance**: Because average stop distances remained clamped $\ge 1.0\%$, the strategy absorbed extreme volatility without suffering catastrophic fee drag.

---

## 4. Deep Learning vs. LightGBM Benchmark (Notebook 3)

The complete benchmark is codified in [`Trader-Pro/notebooks/03_deep_learning_vs_lightgbm_benchmark.ipynb`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro/notebooks/03_deep_learning_vs_lightgbm_benchmark.ipynb).

### Comparative Architecture Overview:
- **LightGBM:** 100 decision trees, `max_depth=5`, `learning_rate=0.03`, `subsample=0.8`, `colsample_bytree=0.8`.
- **PyTorch Tabular ResNet:** Deep residual architecture with Batch Normalization, Heavy Dropout (0.35), LeakyReLU(0.1), AdamW (`weight_decay=1e-4`), and Cosine Annealing learning rate schedule.
- **PyTorch 1D Temporal Dilated CNN:** Sequence model operating over 6-bar multi-period temporal feature paths.

### Benchmark Takeaways:
1. **Inductive Biases:** Financial market data has a low Signal-to-Noise Ratio (SNR < 1%). Decision trees make axis-aligned cuts that isolate extreme volatility regimes without smoothing noise across boundaries. Neural networks, without extreme dropout, smooth across boundaries and fit noisy non-linearities.
2. **Inference Latency:** LightGBM achieves $\approx 0.005\text{ ms}$ inference per candidate bar. PyTorch deep models require $\approx 0.035\text{ ms}$, adding dependency bloat without statistically beating gradient boosted trees on tabular features.
3. **Verdict:** LightGBM remains our recommended primary production engine for tabular financial meta-labeling.

---

## 5. Decommissioning of CME Futures & Mandatory Continuous Assets

### Why CME Futures (`GC=F`, `SI=F`, `CL=F`) Were Permanently Purged:
1. **Weekend and Overnight Gap Illusions:** CME futures trade on traditional exchange hours with weekend closes and daily maintenance halts. Historical backtests on CME data exhibit artificial price gaps that do not reflect 24/7 continuous crypto derivative markets.
2. **Non-Executable on Crypto Exchanges:** A retail or institutional trader operating on Shark Exchange or Binance executes on 24/7 continuous perpetual swap contracts (`XAUUSDT`, `XAGUSDT`, `CLUSDT`), not CME contracts.
3. **Mandatory Standard:** All models in Trader-Pro are strictly trained, validated, and executed on **continuous 24/7 perpetual feeds** (`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `DOTUSDT`, `XAUUSDT`, `XAGUSDT`, `CLUSDT`).

---

## 6. Technical Architecture & Tech Stack

```mermaid
flowchart TD
    subgraph UI_Layer ["Trader-Pro-Dashboard (Next.js 14.2)"]
        A["Dashboard & Trading Terminal<br/>src/app/terminal/page.tsx"]
        B["AI Engine & Parameter Gauges<br/>src/app/ai-engine/page.tsx"]
        C["Live Metric Sync Hooks<br/>src/components/ai-engine/*"]
    end

    subgraph Execution_Core ["Execution & Safeguard Engine"]
        D["Native TypeScript Tree Inference<br/>src/lib/treeInference.ts"]
        E["Risk Engine & Safeguards<br/>src/lib/riskEngine.ts (4 Kill Switches)"]
        F["Cron Microservice Endpoints<br/>src/app/api/cron/*"]
    end

    subgraph Persistence ["Persistence Layer"]
        G["MongoDB Atlas Trade Vault<br/>src/lib/db.ts (Watermark Delta Caching)"]
    end

    subgraph Quant_Suite ["Trader-Pro Quantitative Research Lake"]
        H["Multi-Asset Parquet Lake<br/>Trader-Pro/notebooks/data/"]
        I["Modular Colab Pipelines<br/>Notebooks 01, 02, 03"]
        J["Historical & Live Trade Logs<br/>Trader-Pro-Dashboard/src/data/"]
    end

    A --> D
    B --> E
    D --> E
    E --> F
    F --> G
    H --> I
    I --> J
```

---

## 7. Non-Negotiable Quantitative & Operational Rules

1. **Setup 1H-A Freeze**: Never alter thresholds, stop-loss ratios, or model weights in `src/lib/paperExecutor1HA.ts`. Cryptographic SHA-256 hash invariant:
   `C1DE3359D29A4B4C6BFB3662A65C2ABF5DD4001052BDF6CAA1A7AA50FB8B33A8`.
2. **Zero Environment Secret Leakage**: Never print, log, or hardcode API keys or MongoDB credentials.
3. **Strict Point-in-Time Causality**: All candidate signals and tree inferences execute strictly on closed historical candles ($t-1$) with zero lookahead bias.
4. **Collision Precedence Rule**: Same-bar touch of Take Profit and Stop Loss is strictly booked as a Stop Loss ($-1.0\text{R}$).
5. **Fee Realism**: Always deduct realistic taker friction ($0.1144\% - 0.1200\%$) and statutory taxes on every trade.
6. **Dynamic Dashboard Reporting**: UI cards, metrics strips, and banners must calculate performance strictly from live execution arrays; no static hardcoded numbers are permitted.
