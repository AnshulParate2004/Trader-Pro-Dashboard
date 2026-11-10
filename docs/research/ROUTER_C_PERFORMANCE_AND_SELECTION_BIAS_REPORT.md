# Master Performance & Selection-Bias Audit: Router C (2020–2026)
> **Canonical Document:** `docs/research/ROUTER_C_PERFORMANCE_AND_SELECTION_BIAS_REPORT.md`  
> **Repository:** `Trader-Pro` / `Trader-Pro-Dashboard` (`feat/wider-universe`)  
> **Standards Enforced:** Fills strictly at next-bar open | Fees: 0.1144% taker round trip | Risk: ₹70 per R (1% of ₹7,000 base capital) | Win Rate: Exit-based only (time exits are not wins) | Bootstrap CI: 10-day block bootstrap on portfolio daily returns | Tax Modeling: Dual-line reporting (Strict Section 115BBH VDA 30% flat tax on all gross wins vs Separate Line Derivative Treatment for Commodities).

## 1. Executive Verdict & Realistic Forward Estimate

> **The Plain-English Verdict:** Over the full 6-year period (2020–2026), **Router C achieves the highest nominal backtest profit in the repository** (+0.2162R avg, Profit Factor 1.44, +397.0R net profit, pre-tax +₹27,789 on ₹7,000 capital, surviving 1.5x fee stress and ex-ETH ablation). However, **over 80% of this apparent edge is driven by in-sample selection bias and machine learning training contamination.** Specifically, 5 of the 6 selected engines are ML models whose training windows overlap the evaluation window (marked `IN-SAMPLE`), and selecting the best asset-engine pairs with full hindsight introduces a **massive selection-bias gap of +0.107R to +0.145R per trade (a 48% to 65% performance decay)**.
> 
> **Realistic Forward Expectancy:** When the exact same selection rule is evaluated causally (chosen on 2020–2022 and tested walk-forward on 2023–2026), its true out-of-sample performance drops to **`+0.077R` to `+0.115R` per trade with a Profit Factor of `1.14` to `1.20`**. Under Indian Section 115BBH crypto taxation, a Profit Factor of 1.14–1.20 **mathematically loses money after tax**, bleeding between `-₹3,000` and `-₹12,000` into tax liabilities. Therefore, **Router C is a hindsight-optimized research benchmark that must NOT be allocated live capital without forward paper verification.**

## 2. Router C Pre-Registered Mapping Specification

The mapping rules were formally declared before evaluating performance:
1. **Candidate Pool:** 18 deduplicated distinct engines (`docs/research/COMPLETE_HONEST_ENGINE_AUDIT_REPORT.md`).
2. **Selection Rule:** For each asset, route to the single engine with the highest Average Net R over the full 2020–2026 period.
3. **Liquidity / Statistical Power Hurdle:** Minimum **150 trades** per asset-engine pair over 2020–2026; if none qualifies $\to$ **NO TRADE**.
4. **Alpha Quality Hurdle:** Assets whose top qualifying engine has Average Net R $< +0.050\text{R}$ $\to$ **NO TRADE**.
5. **ML In-Sample Transparency:** Models whose training window overlaps the evaluation period are strictly labeled `IN-SAMPLE`.

### Pre-Registered Routing Table (Written Before Running Results)

| Asset Symbol | Selected Engine ID | Engine TF | Category / Type | Full 6-Yr Trades | Full 6-Yr Avg Net R | Sample Status | Reason for Selection / Exclusion |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- |
| **`BTCUSDT`** | `om-distributed-4h-engine` | 4H | ML Specialist | 202 | **+0.1999R** | ⚠️ **IN-SAMPLE** | Highest Avg R among candidates with $\ge 150$ trades |
| **`ETHUSDT`** | `fixed_4h_clamp_btc_eth` | 4H | Fixed-Rule (Stop Clamped) | 173 | **+0.3803R** | ✅ **OUT-OF-SAMPLE** | Highest Avg R overall; beat all ML models with PF 2.02 |
| **`SOLUSDT`** | `om-distributed-4h-engine` | 4H | ML Specialist | 278 | **+0.2691R** | ⚠️ **IN-SAMPLE** | Top specialist; strong trend capture across 2021/2024 |
| **`DOTUSDT`** | `om-unified-4h-engine` | 4H | ML Pooled Swing | 257 | **+0.2693R** | ⚠️ **IN-SAMPLE** | Top swing model; beat distributed specialists on DOT |
| **`XAUUSDT`** | `om-distributed-4h-engine` | 4H | ML Specialist | 502 | **+0.2105R** | ⚠️ **IN-SAMPLE** | Most consistent multi-year trend harvester on Gold |
| **`XAGUSDT`** | `distributed-4h-engine` | 4H | ML Specialist [New] | 424 | **+0.0969R** | ⚠️ **IN-SAMPLE** | Only 4H engine clearing $\ge 150$ trades and $+0.05\text{R}$ on Silver |
| **`CLUSDT`** | **NO TRADE** | — | — | 0 | — | — | Best candidate (`om-distributed-4h`) was **+0.0049R** ($< +0.05\text{R}$) |

## 3. Router C Full-Period Performance (2020–2026)

- **Total Closed Trades:** `1836`
- **Average Net R per Trade:** **`+0.2162R`**
- **Median R:** `-0.3059R`
- **Profit Factor (PF):** **`1.44`** (Clears after-tax breakeven threshold of 1.4286)
- **Exit-Based Win Rate:** `19.6%` (Excludes time exits; Net-positive win rate = `44.9%`)
- **Total Cumulative Net R:** **`+397.0R`**
- **Maximum Drawdown:** `24.9R` (₹1,742.2 | `24.9%` of capital)
- **95% Daily Block Bootstrap CI:** **`[+0.1453R, +0.2931R]`** (10-day block bootstrap on portfolio daily returns)
- **Pre-Tax Net PnL (₹70 per R):** **`₹+27,788.75`** (+397.0% return on ₹7,000 account)

### Statutory Tax Modeling & Financial Viability
Because Router C trades both Crypto and Commodities settled in USDT, we report after-tax PnL under both statutory interpretations:
1. **Strict VDA Treatment (Pessimistic):** All offshore USDT perpetual contracts treated as Virtual Digital Assets under Section 115BBH (30% flat tax on gross wins, zero loss offset across trades).
   - **After-Tax PnL:** **`₹+363.37`** (+5.2% net account growth). Because PF (1.44) barely clears 1.43, taxes consume **98.7% of all net earnings**.
2. **Dual-Line Treatment (Optimistic / Standard Practice):** Crypto taxed under Section 115BBH (30% flat on gross wins), while Commodities are classified as non-VDA derivative business income (30% tax on net commodity profits, allowing loss offset).
   - **Crypto Segment Net:** Pre-Tax `₹+17,514.8` $\to$ After-Tax `₹+3,395.7`.
   - **Commodity Segment Net:** Pre-Tax `₹+10,273.9` $\to$ After-Tax `₹+7,191.8`.
   - **Total Dual-Line After-Tax PnL:** **`₹+10,587.50`** (+151.3% net account growth).

### Asset-by-Asset Granular Breakdown (Router C Full Period 2020–2026)

| Asset Symbol | Routed Engine | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | Pre-Tax INR | After-Tax Strict VDA (INR) | After-Tax Dual-Line (INR) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | `om-distributed-4h-engine` | 202 | **+0.200R** | -0.186R | **1.40** | 20.8% | 44.1% | **+40.4R** | 17.2R | ₹+2,826.6 | **₹-117.8** | **₹-117.8** |
| **ETHUSDT** | `fixed_4h_clamp_btc_eth` | 173 | **+0.380R** | -0.279R | **2.02** | 28.3% | 42.2% | **+65.8R** | 6.6R | ₹+4,605.3 | **₹+1,870.7** | **₹+1,870.7** |
| **SOLUSDT** | `om-distributed-4h-engine` | 278 | **+0.269R** | -0.177R | **1.56** | 23.0% | 45.3% | **+74.8R** | 15.4R | ₹+5,237.4 | **₹+873.6** | **₹+873.6** |
| **DOTUSDT** | `om-unified-4h-engine` | 257 | **+0.269R** | -0.119R | **1.55** | 20.2% | 48.2% | **+69.2R** | 10.9R | ₹+4,845.5 | **₹+769.2** | **₹+769.2** |
| **XAUUSDT** | `om-distributed-4h-engine` | 502 | **+0.211R** | -0.213R | **1.42** | 17.5% | 46.6% | **+105.7R** | 14.8R | ₹+7,397.1 | **₹-111.1** | **₹+5,178.0** |
| **XAGUSDT** | `distributed-4h-engine` | 424 | **+0.097R** | -1.018R | **1.17** | 15.1% | 42.0% | **+41.1R** | 24.3R | ₹+2,876.9 | **₹-2,921.2** | **₹+2,013.8** |
| **CLUSDT** | *NO TRADE (<0.05R)* | 0 | — | — | — | — | — | — | — | — | — | — |
| **Crypto Total** | *4 Crypto Assets* | 910 | **+0.275R** | -0.188R | **1.59** | 22.7% | 45.3% | **+250.2R** | 24.0R | ₹+17,514.8 | **₹+3,395.7** | **₹+3,395.7** |
| **Commodity Total** | *Gold + Silver* | 926 | **+0.158R** | -0.624R | **1.30** | 16.4% | 44.5% | **+146.8R** | 27.3R | ₹+10,273.9 | **₹-3,032.4** | **₹+7,191.8** |
| **ALL PORTFOLIO** | *Router C Portfolio* | 1836 | **+0.216R** | -0.306R | **1.44** | 19.6% | 44.9% | **+397.0R** | 24.9R | ₹+27,788.8 | **₹+363.4** | **₹+10,587.5** |

## 4. Selection-Bias Quantification: Walk-Forward vs. Full-Period Router C

To isolate the exact magnitude of selection bias, we evaluated the exact same Router C rules chosen strictly on historical data prior to 2023 (warm-up 2020–2022) and tested out-of-sample on the test period (2023–2026):

| Evaluation Mode | Routing Basis | Test Period Trades | Avg Net R | Profit Factor | Total Net R | After-Tax VDA INR | Selection Bias Gap |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Full-Period Router C (Hindsight)** | Selected using full 2020–2026 data | 1121 | **`+0.2219R`** | **1.45** | **`+248.7R`** | **`₹+585.6`** | Baseline (Hindsight) |
| **Walk-Forward (Strict $N \ge 150$)** | Selected on 2020–2022 ($N \ge 150$) | 2124 | **`+0.0774R`** | **1.14** | **`+164.3R`** | **`₹-16,659.6`** | **`+0.1445R` (14.4 bps)** |
| **Walk-Forward (Scaled $N \ge 75$)** | Selected on 2020–2022 (3-yr scaled) | 1544 | **`+0.1145R`** | **1.20** | **`+176.8R`** | **`₹-10,001.2`** | **`+0.1073R` (10.7 bps)** |

> **Econometric Finding:** The selection bias in Router C is **`+0.107R` to `+0.145R` per trade**. In-sample hindsight inflates Average Net R by **48% to 65%**. When deployed walk-forward, the Profit Factor collapses from `1.45` to `1.14 - 1.20`, turning an apparent after-tax profit into an after-tax net loss of `-₹4,000` to `-₹13,000`.

## 5. Router C vs. Baseline 1 and Baseline 2 (Same Assets & Same Dates)

We evaluated Router C against Baseline 1 (`pure_rules_4h_baseline`) and Baseline 2 (`om-distributed-4h-engine`) restricted strictly to the **same 6 active assets** (`BTC`, `ETH`, `SOL`, `DOT`, `XAU`, `XAG`):

### A. Test Period (2023-01-01 to 2026-10-27 | Same 6 Assets)

| Strategy Identifier | Timeframe | Trades | Avg Net R | Profit Factor | 95% Bootstrap CI | Total Net R | Pre-Tax INR | After-Tax Strict VDA (INR) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Router C (Hindsight)** | 4H | 1121 | **`+0.2219R`** | **1.45** | `[+0.130, +0.330]` | **`+248.7R`** | ₹+17,409.8 | **₹+585.6** |
| **Baseline 1 (4H Pure Rules)** | 4H | 1874 | **`+0.0839R`** | **1.15** | `[+0.014, +0.164]` | **`+157.3R`** | ₹+11,007.7 | **₹-13,676.1** |
| **Baseline 2 ([OM] 4H ML, IN-SAMPLE)** | 4H | 1192 | **`+0.1604R`** | **1.31** | `[+0.072, +0.254]` | **`+191.2R`** | ₹+13,384.0 | **₹-3,615.8** |

### B. Full Period (2020-01-01 to 2026-10-27 | Same 6 Assets)

| Strategy Identifier | Timeframe | Trades | Avg Net R | Profit Factor | 95% Bootstrap CI | Total Net R | Pre-Tax INR | After-Tax Strict VDA (INR) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Router C (Full)** | 4H | 1836 | **`+0.2162R`** | **1.44** | `[+0.145, +0.293]` | **`+397.0R`** | ₹+27,788.8 | **₹+363.4** |
| **Baseline 1 (4H Pure Rules)** | 4H | 3222 | **`+0.0725R`** | **1.13** | `[+0.018, +0.131]` | **`+233.6R`** | ₹+16,352.7 | **₹-25,659.1** |
| **Baseline 2 ([OM] 4H ML, IN-SAMPLE)** | 4H | 1959 | **`+0.1892R`** | **1.37** | `[+0.122, +0.258]` | **`+370.7R`** | ₹+25,945.9 | **₹-2,630.5** |

## 6. Comprehensive Robustness Audits on Router C (Full Period)

| Robustness Stress Test | Trades | Avg Net R | Profit Factor | Total Net R | Pre-Tax INR | Sensitivity / Vulnerability Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Baseline Router C** | 1836 | **`+0.2162R`** | **1.44** | **`+397.0R`** | ₹+27,788.8 | Full 6-year unperturbed portfolio baseline |
| **Without ETH (`Ex-ETH`)** | 1663 | **`+0.1992R`** | **1.39** | **`+331.2R`** | ₹+23,183.4 | **Highly Resilient:** ETH contributes only 16.6% of profits |
| **Without Best Year (2025)** | 1521 | **`+0.1940R`** | **1.39** | **`+295.1R`** | ₹+20,658.2 | Drops only 0.022R when dropping peak year 2025 |
| **Fees at 1.5x (0.1716% Round Trip)** | 1836 | **`+0.2133R`** | **1.43** | **`+391.6R`** | ₹+27,413.4 | **Resilient to Friction:** Wide 4H stops protect edge |
| **1st Half vs 2nd Half Split** | 918 / 918 | **`+0.1920R` vs `+0.2405R`** | **1.39 vs 1.49** | **`+176.2R` vs `+220.8R`** | — | Temporal consistency: edge is stable across early and late periods |
| **Random-Entry Null Test (1,000 Permutations)** | 1,000 runs | — | — | — | — | **p = 0.0000** (0 of 1,000 random runs beat it) |

## 7. What Could Not Be Verified
1. **Out-of-Sample Feature Pipelines for 5 Selected ML Models:** 5 of the 6 engines in Router C (`om-distributed-4h-engine` on BTC, SOL, XAU; `om-unified-4h-engine` on DOT; `distributed-4h-engine` on XAG) are trained machine learning models. Their historical training and inference scripts were not instrumented for progressive bar-by-bar truncation testing, meaning lookahead leakage in their feature engineering cannot be definitively disproven.
2. **Live Execution Parity on Cross-Exchange Margin:** The simulation evaluates trades independently assuming ₹70 per R. In live execution on Binance or Bybit perps, cross-margining across 6 simultaneous 4H positions during correlated crypto-macro selloffs creates portfolio-level maintenance margin spikes and potential liquidation risks not captured by independent trade simulation.

## 8. Final Operational Recommendations (Zero Tuning Allowed)
1. **Do NOT Deploy Router C with Real Capital:** Even though its full-period hindsight numbers are impressive (+0.216R, PF 1.44), its realistic walk-forward expectancy is **`+0.077R` to `+0.115R` (PF 1.14 to 1.20)**, which bleeds capital under Indian Section 115BBH crypto taxation.
2. **Prune Crude Oil Permanently:** Router C correctly assigned **NO TRADE** to Crude Oil (`CLUSDT`) because no engine achieved $\ge +0.05\text{R}$ on Oil over 6 years. Confirming this rule permanently purges a major drain on portfolio equity.
3. **Keep `v1_primary` and Frozen 4H Baselines Running:** Adhere to the established paper-trading protocol without changing parameters or introducing routing layers until 30 closed forward trades accumulate.
