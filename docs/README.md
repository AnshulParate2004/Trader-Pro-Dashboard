# Trader-Pro: Architecture, Research & Governance Documentation

> **Master Documentation Directory**  
> **Repository**: `Trader-Pro-Dashboard` (Web Terminal & Execution Engine) & `Trader-Pro` (Quantitative Research & ML Engine)  
> **Target Audience**: Institutional Quants, Systems Engineers, and Autonomous AI Agents  
> **Version**: 2.0 (Multi-Asset Unified & Distributed Architecture)  
> **Date**: November 2026

---

## 1. Executive Summary

**Trader-Pro** is an institutional quantitative trading, backtesting, and automated paper-execution ecosystem engineered to eliminate retail execution pitfalls (fee drag, lookahead bias, unhedged beta, and intrabar simulator illusions).

The system operates across a **7-asset multi-market universe** spanning major cryptocurrencies and macro commodities, powered by **6 production engines** operating on 1-Hour (1H) and 4-Hour (4H) timeframes with strict point-in-time causality.

```mermaid
flowchart LR
    subgraph Repo1 ["Trader-Pro (Python ML & Research)"]
        DataIngest["Data Ingestion<br/>(Binance + Dukascopy/MT5)"]
        VisualEDA["Visual Exploratory Data Analysis<br/>(Correlation, Skew, Volatility)"]
        FeaturePipe["10-Feature Pipeline<br/>(Donchian, ATR%, Vol Z-Score)"]
        MLTrain["LightGBM & XGBoost<br/>(Hyperparameter Sweeps)"]
        ExportTrees["Tree Serialization<br/>(JSON Decision Trees)"]
        DataIngest --> VisualEDA --> FeaturePipe --> MLTrain --> ExportTrees
    end

    subgraph Repo2 ["Trader-Pro-Dashboard (Next.js 14 Web Terminal)"]
        TreeEngine["TypeScript Tree Runner<br/>(In-Memory Zero-Latency Inference)"]
        CronRoutes["Headless Cron Executors<br/>(/api/cron/*)"]
        RiskGov["Risk & Governance Guardrails<br/>(Kill-Switch, Friction Filter)"]
        MongoAtlas["MongoDB Atlas Delta Watermark<br/>(Audit Trails & PnL History)"]
        DashboardUI["Interactive Web Terminal<br/>(/terminal, /ai-engine)"]
        TreeEngine --> CronRoutes --> RiskGov --> MongoAtlas --> DashboardUI
    end

    ExportTrees -.->|"JSON Models"| TreeEngine
```

---

## 2. Documentation Map & Navigation Index

All documentation in `docs/` is organized into logical pillars:

| Category | File | Description |
| :--- | :--- | :--- |
| **System Architecture** | [`ARCHITECTURE.md`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/docs/ARCHITECTURE.md) | High-level system architecture, multi-asset universe, 6 operational engines, and TypeScript in-memory tree inference. |
| **Master Research Dossier** | [`MASTER_SYSTEM_ARCHITECTURE_AND_RESEARCH_DOSSIER.md`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/docs/MASTER_SYSTEM_ARCHITECTURE_AND_RESEARCH_DOSSIER.md) | Exhaustive empirical research dossier, chronological engine comparisons, backtest vs forward live metrics, and out-of-distribution stress test results. |
| **Empirical Findings** | [`RESEARCH_FINDINGS.md`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/docs/RESEARCH_FINDINGS.md) | Quantitative post-mortems on foundation models (Google TimesFM & Amazon Chronos), funding rate anomalies, and high-frequency scalper failures. |
| **Methodological Bugs** | [`KNOWN_ISSUES.md`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/docs/KNOWN_ISSUES.md) | Forensic analysis of legacy lookahead leaks, multi-timeframe merge flaws, intrabar simulator bias, and statutory TDS drag. |
| **Operational Lessons** | [`LESSONS.md`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/docs/LESSONS.md) | Hard-won engineering and quantitative lessons from live paper-trading deployments and econometric testing. |
| **Governance & Safety** | [`GOVERNANCE.md`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/docs/GOVERNANCE.md) | Non-negotiable safety guardrails, frozen baseline protocols, exchange fee structures, and point-in-time causality invariants. |
| **Security Checklist** | [`SECURITY_TODO.md`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/docs/SECURITY_TODO.md) | Secret management, environment audits, zero-leakage hash protocols, and production deployment checklists. |
| **Trading Playbooks** | [`playbook/`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/docs/playbook) | Tactical playbooks covering market structure, Fibonacci confluence, macro cycle regimes, systematic risk management, and the Master Trading Manual PDF. |
| **Deep Learning Benchmark** | [`Trader-Pro/notebooks/03_deep_learning_vs_lightgbm_benchmark.ipynb`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro/notebooks/03_deep_learning_vs_lightgbm_benchmark.ipynb) | PyTorch Tabular ResNet & Temporal CNN vs. LightGBM on 7 continuous assets under strict causal features. |
| **Preregistration Logs** | [`prereg/`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/docs/prereg) | Hypothesis pre-registrations for walk-forward studies, statistical power calculations, and cost-aware filters. |

---

## 3. The 6 Production Trading Engines

Trader-Pro features 6 concurrent production engines accessible via the `/ai-engine` selector and live REST APIs:

| Engine # | Engine Identifier | Timeframe | Asset Scope | Model Architecture | 2020–2024 Holdout Performance | Live Window (Oct 21 – Nov 8, 2026) | Live Verdict & Status |
| :---: | :--- | :---: | :---: | :--- | :---: | :---: | :--- |
| **#1** | `unified-1h-engine` | **1H** | 7 Assets | 1 Universal LightGBM Brain | 4,403 trades (44.7% WR, 0.97 PF) | 32 trades (43.8% WR, -1.51 R) | **ACTIVE LIVE** (Capital: ₹6,848.70) |
| **#2** | `distributed-1h-engine` | **1H** | 7 Assets | 7 Dedicated LightGBM Models | 4,376 trades (43.9% WR, 0.92 PF) | 32 trades (56.3% WR, +2.18 R) | **ACTIVE LIVE** (Capital: ₹7,218.40) |
| **#3** | `unified-4h-engine` | **4H** | 7 Assets | 1 Universal LightGBM Brain | 511 trades (46.6% WR, +26.71 R, 1.16 PF) | 1 trade (100% Cash Safe) | **ACTIVE LIVE** (100% Cash-Safe) |
| **#4** | `distributed-4h-engine` | **4H** | 7 Assets | 7 Dedicated LightGBM Models | 1,086 trades (46.9% WR, +7.60 R, 1.02 PF) | 9 trades (**77.8% WR**, +2.21 R, **2.89 PF**) | **ACTIVE LIVE CHAMPION** (Capital: ₹7,220.80) |
| **#5** | `pure-rules-1h-baseline` | **1H** | 7 Assets | Mechanical (No AI Gating) | 6,217 trades (43.3% WR, 0.95 PF) | 62 trades (46.8% WR, -3.20 R) | **ACTIVE BENCHMARK** (Capital: ₹6,680.00) |
| **#6** | `pure-rules-4h-baseline` | **4H** | 7 Assets | Mechanical (No AI Gating) | 2,005 trades (46.0% WR, +46.12 R, 1.07 PF) | 21 trades (**61.9% WR**, +2.48 R, 1.34 PF) | **ACTIVE BENCHMARK** (Capital: ₹7,248.00) |

---

## 4. Multi-Asset Portfolio Universe

The quantitative universe spans 7 non-correlated liquid perpetual and commodity instruments:

1. **Crypto Assets (4 Instruments)**:
   - `BTCUSDT` (Bitcoin / Tether)
   - `ETHUSDT` (Ethereum / Tether)
   - `SOLUSDT` (Solana / Tether)
   - `DOTUSDT` (Polkadot / Tether)
2. **Macro Commodities (3 Instruments)**:
   - `XAUUSDT` (Gold / Tether Perpetual)
   - `XAGUSDT` (Silver / Tether Perpetual)
   - `CLUSDT` (WTI Light Sweet Crude Oil / Tether Perpetual)

---

## 5. Non-Negotiable Quantitative & Engineering Invariants

1. **Strict Point-in-Time Causality**:
   - Zero lookahead or intrabar execution. Signals execute strictly on the **close price of the completed candle** $t-1$.
2. **Realistic Exchange Friction**:
   - Every trade evaluation factors in the **Shark Exchange** futures fee schedule:
     - Taker fee: $0.100\%$ + statutory $18\%$ GST ($0.118\%$ net per side).
     - Standard slippage: $0.010\%$ per side.
     - Total realistic round-trip friction: **$0.1144\% - 0.1200\%$**.
3. **Simultaneous Collision Precedence**:
   - If a candle's high touches the Take Profit (TP) and its low touches the Stop Loss (SL) in the same bar, governance invariant strictly mandates recording the outcome as a **Stop Loss ($-1.0\text{R}$)**.
4. **Frozen Control Baseline Invariant**:
   - The original paper executor [`src/lib/paperExecutor1HA.ts`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/src/lib/paperExecutor1HA.ts) is permanently frozen. Its cryptographic SHA-256 hash must never change:
     ```text
     C1DE3359D29A4B4C6BFB3662A65C2ABF5DD4001052BDF6CAA1A7AA50FB8B33A8
     ```
5. **Structural Risk Filters**:
   - Maximum cost drag: $\text{cost\_R} = \frac{\text{friction\_pct}}{\text{stop\_pct}} \le 0.08\text{R}$. Stops tighter than $1.43\%$ are systematically vetoed.
   - Rolling 100-trade kill switch: triggers if average net $R < -0.05\text{R}$.
   - Daily loss circuit breaker: $-3.0\text{R}$ maximum drawdown per calendar day.

---

## 6. Development & Verification Commands

All core operations in `Trader-Pro-Dashboard`:

```bash
# Install dependencies
npm install

# Execute the 74 unit tests (In-memory tree inference, fee models, risk engines)
npm test

# Verify frozen file cryptographic invariant
powershell -Command "Get-FileHash src/lib/paperExecutor1HA.ts -Algorithm SHA256"

# Run Next.js production build (12 static pages, 0 errors)
npm run build

# Start local Next.js production server
npm start
```
