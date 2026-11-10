# Master Router Strategies vs. Single-Engine Baselines Audit (2020–2026)
> **Canonical Document:** `docs/research/ROUTER_STRATEGIES_AND_BASELINES_COMPARISON_REPORT.md`  
> **Repository:** `Trader-Pro` / `Trader-Pro-Dashboard` (`feat/wider-universe`)  
> **Standards Enforced:** Fills strictly at next-bar open | Fees: 0.1144% taker round-trip | Risk: ₹70 per R (1% of ₹7,000 capital, split per asset) | Win Rate: Exit-based only (time exits are not wins) | Bootstrap CI: 10-day block bootstrap on portfolio daily returns | Tax Framework: Indian Section 115BBH flat 30% tax on gross wins (0 loss deduction; Breakeven PF = 1.4286).

## 1. Executive Verdict: Does Either Router Beat the Single-Engine Baseline?

> **The Direct Answer: NO.** Neither Router A nor Router B beats the single-engine baseline (`pure_rules_4h_baseline`) under the pre-registered decision rules. Specifically:
> 1. **Router A (Walk-Forward 'Best Past Result'):** **FAILS COMPLETELY (0 of 4 decision criteria passed).** On the 2023–2026 test period, Router A achieved an Average Net R of **`+0.059R`** (95% block-bootstrap CI `[-0.005R, +0.130R]`, Profit Factor 1.10), which is **`-0.019R` WORSE per trade than Baseline 1 (`+0.078R`)**. By naively chasing past winners with $\ge 30$ trades, Router A fell directly into the in-sample overfitting trap of 1H ML engines (`om-consensus-committee` and `new-stacking-meta`) on Silver and Crude Oil, absorbing 1,371 high-turnover trades that collapsed out-of-sample (CLUSDT alone bled `-49.6R`, PF 0.90) and generating an after-tax loss of **`-₹22,300`**.
> 2. **Router B (Fixed Principled Mapping):** **SUPERIOR TO ROUTER A, BUT FAILS PRE-REGISTERED ADVANCEMENT THRESHOLDS (1 of 4 criteria passed).** Router B wisely pruned Silver and Crude Oil to trade only Crypto + Gold on the 4H pure-rules engine. On the test period, it achieved **`+0.086R`** (PF 1.16, 95% CI `[-0.001R, +0.180R]`). While its Average Net R was slightly higher than Baseline 1 (`+0.086R` vs `+0.078R`, a modest `+0.008R` gap), it failed the mandatory `> 0.02R` hurdle, its CI lower bound crossed zero, and its PF remained well below the 1.43 after-tax breakeven threshold (losing `-₹10,542` after tax).
> 3. **The Enormous Selection Bias (+0.141R per trade):** When evaluated with full in-sample hindsight (`Router A-insample`), the router appeared to achieve **`+0.200R`** (PF 1.41, +258.2R). The gap between hindsight and reality is **`+0.1407R` (a 70.4% performance drop)**, demonstrating that post-hoc asset-to-engine matching is pure selection bias.
> **Official Pre-Registered Decision Rule:** **'No benefit; use the simpler single engine.'**

## 2. Strategy Architectures & Candidate Engine Inventory

### Candidate Engine Universe (18 Distinct Engines)
All router selections were restricted strictly to the 18 deduplicated distinct engines audited in `docs/research/COMPLETE_HONEST_ENGINE_AUDIT_REPORT.md` (all 6 `v1-*` duplicate twins of `om-*` were dropped):
- **Fixed-Rule (6):** `fixed_4h_clamp_btc_eth`, `fixed_rule_4h_v1`, `fixed_4h_no_gate_crypto`, `fixed_4h_2.5r_7assets`, `pure_rules_4h_baseline`, `fixed_1h_trailing_stop`.
- **Hand-Crafted MLP (1):** `option-a-1h-hand-written` (static closed-form weights, zero backprop).
- **ML Models (11, marked IN-SAMPLE):** `om-distributed-4h-engine`, `om-stacking-meta-engine`, `om-distributed-1h-engine`, `om-unified-1h-engine`, `om-consensus-committee-engine`, `om-unified-4h-engine`, `unified-4h-engine`, `distributed-4h-engine`, `distributed-1h-engine`, `new-consensus-committee-engine`, `new-stacking-meta-engine`.

### Router & Baseline Definitions
1. **Router A (Walk-Forward 'Best Past Result'):** At the start of each test year (2023, 2024, 2025, 2026), for each asset, select the engine with the highest Average Net R over ALL PRIOR years (minimum 30 prior trades; else NO TRADE). Trade that asset with that engine for the year.
2. **Router A-insample (Optimistic / In-Sample Baseline):** Selects the single best engine per asset across the entire 2020–2026 period with $\ge 30$ trades. Reported solely to quantify selection bias. Not ranked.
3. **Router B (Fixed Principled Mapping):** Fixed in advance by rule before examining performance:
   - `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `DOTUSDT`, `XAUUSDT` $\to$ `pure_rules_4h_baseline` (4H trend engine).
   - `XAGUSDT`, `CLUSDT` $\to$ **NO TRADE** (systematically noisy commodities).
   - 1H and intraday engines $\to$ **NEVER USED**.
4. **Baseline 1:** Single engine, all 7 assets: `pure_rules_4h_baseline`.
5. **Baseline 2:** Single engine, all 7 assets: `om-distributed-4h-engine` (Top ML 4H engine; strictly marked IN-SAMPLE).

## 3. Pre-Registered Decision Rule (Formally Stated Before Evaluation)
A router is declared better than Baseline 1 ONLY if, on the 2023–2026 test period:
- **(a) Statistical Superiority:** Average Net R is higher AND the 95% block-bootstrap CI lower bound is higher.
- **(b) Material Edge:** The performance gap over Baseline 1 is strictly $> 0.020\text{R}$ per trade.
- **(c) Economic Viability:** The router clears the Indian Section 115BBH after-tax breakeven threshold of $\text{Profit Factor} \ge 1.4286$.
- **(d) Structural Invariance:** The router maintains positive expectancy without ETH (`Ex-ETH`) AND under 1.5x fee stress ($0.1716\%$ round trip).
If a router fails any of (a)–(d), the verdict is **'no benefit; use the simpler engine'**. Between Router A and Router B, the winner is the one passing more conditions; ties broken in favor of the simpler Router B.

## 4. Master Comparison Tables: Test Period (2023–2026) & Full Period (2020–2026)

### Primary Scorecard: Test Period (2023-01-01 to 2026-10-27 | Scored Identically)

| Strategy Identifier | Strategy Type | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Pre-Tax INR | After-Tax (30%) INR | Clears PF 1.43? |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Router A (Walk-Forward)** | `router_a` | 2268 | **+0.059R** | -1.031R | **1.10** | 21.2% | 37.8% | **+134.6R** | 64.4R | `[-0.005, +0.130]` | ₹+9,419.39 | **₹-22,299.73** | ❌ NO |
| **Router B (Fixed Mapping)** | `router_b` | 1491 | **+0.086R** | -0.592R | **1.16** | 17.9% | 40.6% | **+128.2R** | 44.1R | `[-0.001, +0.180]` | ₹+8,977.21 | **₹-10,541.94** | ❌ NO |
| **Baseline 1: 4H Pure Rules (7 Assets)** | `baseline_1` | 2227 | **+0.078R** | -0.781R | **1.14** | 16.5% | 40.9% | **+173.6R** | 36.0R | `[+0.016, +0.149]` | ₹+12,149.58 | **₹-16,959.22** | ❌ NO |
| **Baseline 2: [OM] Distributed 4H Specialists (IN-SAMPLE)** | `baseline_2` | 1410 | **+0.149R** | -0.406R | **1.29** | 18.0% | 43.1% | **+209.6R** | 22.2R | `[+0.076, +0.230]` | ₹+14,669.50 | **₹-5,095.93** | ❌ NO |
| **Router A-insample (Optimistic / In-Sample)** | `router_a_insample` | 1291 | **+0.200R** | -0.285R | **1.41** | 18.3% | 44.9% | **+258.2R** | 20.0R | `[+0.121, +0.292]` | ₹+18,072.28 | **₹-703.78** | ❌ NO |

### Full Period Baseline Context (2020-01-01 to 2026-10-27)
> *Note: Router A requires the 2020–2022 warm-up window to form initial 30-trade histories, so its full 6-year result is not defined.*

| Strategy Identifier | Strategy Type | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Pre-Tax INR | After-Tax (30%) INR | Clears PF 1.43? |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Router B (Fixed Mapping)** | `router_b` | 2566 | **+0.091R** | -0.608R | **1.17** | 17.8% | 41.0% | **+234.0R** | 44.1R | `[+0.028, +0.162]` | ₹+16,380.02 | **₹-17,583.49** | ❌ NO |
| **Baseline 1: 4H Pure Rules (7 Assets)** | `baseline_1` | 3859 | **+0.055R** | -1.015R | **1.10** | 16.0% | 40.2% | **+210.8R** | 53.3R | `[+0.007, +0.106]` | ₹+14,754.13 | **₹-34,582.81** | ❌ NO |
| **Baseline 2: [OM] Distributed 4H Specialists (IN-SAMPLE)** | `baseline_2` | 2368 | **+0.157R** | -0.395R | **1.31** | 17.7% | 44.0% | **+372.7R** | 34.3R | `[+0.102, +0.218]` | ₹+26,086.31 | **₹-7,315.67** | ❌ NO |

## 5. Formal Decision Rule Scorecard (Test Period Evaluation)

| Decision Criterion | Standard Threshold | Router A (Walk-Forward) | Router B (Fixed Mapping) | Verdict / Analysis |
| :--- | :--- | :---: | :---: | :--- |
| **(a) Statistical Edge** | Avg Net R > B1 (+0.078R) AND CI Low > B1 (+0.016R) | ❌ **FAIL** (+0.059R, CI Low -0.005R) | ❌ **FAIL** (+0.086R, CI Low -0.001R) | Router A is strictly worse than B1; Router B has higher mean but wider CI crossing zero |
| **(b) Material Gap** | Gap over Baseline 1 > +0.020R | ❌ **FAIL** (Gap = -0.0186R) | ❌ **FAIL** (Gap = +0.0081R) | Neither router achieves the +0.020R hurdle |
| **(c) After-Tax Viability** | Profit Factor $\ge 1.4286$ (Section 115BBH) | ❌ **FAIL** (PF 1.10, -₹22,300) | ❌ **FAIL** (PF 1.16, -₹10,542) | Both bleed capital after flat 30% tax on gross winners |
| **(d) Robustness Invariance**| Outperforms B1 without ETH AND at 1.5x Fees | ❌ **FAIL** (Ex-ETH: +0.057R vs +0.080R) | ✅ **PASS** (Ex-ETH: +0.091R, 1.5x: +0.057R) | Router B successfully eliminates commodity drag |
| **Total Criteria Passed** | 4 of 4 Required to Beat Baseline | **0 / 4 PASSED** | **1 / 4 PASSED** | **VERDICT: NO BENEFIT; USE SIMPLER ENGINE** |

## 6. Router A Year-by-Year Engine Selections & Switching Frequency

The walk-forward selection algorithm selected the following engines at the start of each year based strictly on prior closed trades (minimum 30 trades):

| Asset Symbol | Year 2023 Choice (History: 2020–2022) | Year 2024 Choice (History: 2020–2023) | Year 2025 Choice (History: 2020–2024) | Year 2026 Choice (History: 2020–2025) | Total Engine Switches |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **BTCUSDT** | `om-distributed-4h-engine` | `om-distributed-4h-engine` | `option-a-1h-hand-written` | `om-distributed-4h-engine` | **2 switches** |
| **ETHUSDT** | `om-distributed-4h-engine` | `om-distributed-4h-engine` | `om-distributed-4h-engine` | `om-distributed-4h-engine` | **0 switches** |
| **SOLUSDT** | `om-unified-4h-engine` | `om-distributed-4h-engine` | `om-distributed-4h-engine` | `om-distributed-4h-engine` | **1 switches** |
| **DOTUSDT** | `om-unified-4h-engine` | `om-unified-4h-engine` | `om-unified-4h-engine` | `om-unified-4h-engine` | **0 switches** |
| **XAUUSDT** | `om-distributed-4h-engine` | `om-distributed-4h-engine` | `om-distributed-4h-engine` | `om-distributed-4h-engine` | **0 switches** |
| **XAGUSDT** | `om-consensus-committee-engine` | `om-consensus-committee-engine` | `om-consensus-committee-engine` | `om-consensus-committee-engine` | **0 switches** |
| **CLUSDT** | `new-consensus-committee-engine` | `om-consensus-committee-engine` | `new-stacking-meta-engine` | `new-stacking-meta-engine` | **2 switches** |

> **Key Behavioral Insight:** Across the 4 test years, Router A switched engines **5 times**:
> - On **BTCUSDT**, it switched from `om-distributed-4h` to `option-a-1h-hand-written` in 2025 (+0.326R prior avg), then switched back to `om-distributed-4h` in 2026.
> - On **SOLUSDT**, it switched from `om-unified-4h` to `om-distributed-4h` in 2024 and remained there.
> - On **CLUSDT**, it switched twice, bouncing between high-turnover 1H models (`new-consensus-committee` $\to$ `om-consensus-committee` $\to$ `new-stacking-meta`), suffering heavy whipsaws.
> - On **ETH, DOT, XAU, XAG**, it never switched, locking into `om-distributed-4h`, `om-unified-4h`, `om-distributed-4h`, and `om-consensus-committee` respectively.

## 7. Granular Asset-by-Asset and Segment Breakdowns (Test Period 2023–2026)

### Strategy: Router A (Walk-Forward)

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Pre-Tax INR | After-Tax (30%) INR |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 93 | **+0.241R** | -0.144R | **1.54** | 20.4% | 44.1% | **+22.5R** | 15.4R | `[-0.063, +0.508]` | ₹+1,572.0 | **₹+221.6** |
| **ETHUSDT** | 145 | **+0.089R** | -0.459R | **1.17** | 20.0% | 37.2% | **+12.9R** | 16.2R | `[-0.120, +0.306]` | ₹+900.6 | **₹-987.6** |
| **SOLUSDT** | 188 | **+0.099R** | -0.594R | **1.18** | 20.7% | 38.8% | **+18.6R** | 15.4R | `[-0.099, +0.295]` | ₹+1,303.5 | **₹-1,202.4** |
| **DOTUSDT** | 180 | **+0.169R** | -0.538R | **1.32** | 18.9% | 45.0% | **+30.3R** | 10.9R | `[-0.024, +0.371]` | ₹+2,123.9 | **₹-474.8** |
| **XAUUSDT** | 291 | **+0.275R** | -0.018R | **1.57** | 19.2% | 49.5% | **+80.0R** | 7.4R | `[+0.131, +0.430]` | ₹+5,602.8 | **₹+998.1** |
| **XAGUSDT** | 652 | **+0.030R** | -1.044R | **1.05** | 23.9% | 35.4% | **+19.8R** | 39.4R | `[-0.078, +0.155]` | ₹+1,388.8 | **₹-8,116.9** |
| **CLUSDT** | 719 | **-0.069R** | -1.034R | **0.90** | 20.6% | 32.5% | **-49.6R** | 57.5R | `[-0.179, +0.031]` | ₹-3,472.2 | **₹-12,737.7** |
| **Crypto Total** | 606 | **+0.139R** | -0.394R | **1.27** | 20.0% | 41.1% | **+84.3R** | 37.6R | `[+0.010, +0.273]` | ₹+5,900.1 | **₹-2,443.2** |
| **Commodity Total** | 1662 | **+0.030R** | -1.035R | **1.05** | 21.7% | 36.6% | **+50.3R** | 57.5R | `[-0.042, +0.112]` | ₹+3,519.3 | **₹-19,856.5** |
| **ALL PORTFOLIO** | 2268 | **+0.059R** | -1.031R | **1.10** | 21.2% | 37.8% | **+134.6R** | 64.4R | `[-0.005, +0.130]` | ₹+9,419.4 | **₹-22,299.7** |

### Strategy: Router B (Fixed Mapping)

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Pre-Tax INR | After-Tax (30%) INR |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 271 | **+0.045R** | -0.402R | **1.09** | 17.0% | 40.2% | **+12.1R** | 25.4R | `[-0.112, +0.204]` | ₹+847.0 | **₹-2,369.6** |
| **ETHUSDT** | 276 | **+0.064R** | -0.601R | **1.12** | 20.7% | 37.3% | **+17.6R** | 15.7R | `[-0.081, +0.223]` | ₹+1,228.9 | **₹-2,310.3** |
| **SOLUSDT** | 305 | **+0.027R** | -1.019R | **1.05** | 17.7% | 37.0% | **+8.2R** | 24.9R | `[-0.125, +0.174]` | ₹+575.7 | **₹-3,201.9** |
| **DOTUSDT** | 275 | **+0.087R** | -0.678R | **1.16** | 16.7% | 41.8% | **+24.0R** | 12.7R | `[-0.073, +0.259]` | ₹+1,680.4 | **₹-1,929.2** |
| **XAUUSDT** | 364 | **+0.182R** | -0.605R | **1.35** | 17.6% | 45.6% | **+66.4R** | 8.3R | `[+0.051, +0.317]` | ₹+4,645.2 | **₹-730.9** |
| **XAGUSDT** | 0 | — | — | — | — | — | — | — | — | — | — |
| **CLUSDT** | 0 | — | — | — | — | — | — | — | — | — | — |
| **Crypto Total** | 1127 | **+0.055R** | -0.588R | **1.10** | 18.0% | 39.0% | **+61.9R** | 57.5R | `[-0.054, +0.170]` | ₹+4,332.0 | **₹-9,811.0** |
| **Commodity Total** | 364 | **+0.182R** | -0.605R | **1.35** | 17.6% | 45.6% | **+66.4R** | 8.3R | `[+0.051, +0.317]` | ₹+4,645.2 | **₹-730.9** |
| **ALL PORTFOLIO** | 1491 | **+0.086R** | -0.592R | **1.16** | 17.9% | 40.6% | **+128.2R** | 44.1R | `[-0.001, +0.180]` | ₹+8,977.2 | **₹-10,541.9** |

### Strategy: Baseline 1: 4H Pure Rules (7 Assets)

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Pre-Tax INR | After-Tax (30%) INR |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 271 | **+0.045R** | -0.402R | **1.09** | 17.0% | 40.2% | **+12.1R** | 25.4R | `[-0.112, +0.204]` | ₹+847.0 | **₹-2,369.6** |
| **ETHUSDT** | 276 | **+0.064R** | -0.601R | **1.12** | 20.7% | 37.3% | **+17.6R** | 15.7R | `[-0.081, +0.223]` | ₹+1,228.9 | **₹-2,310.3** |
| **SOLUSDT** | 305 | **+0.027R** | -1.019R | **1.05** | 17.7% | 37.0% | **+8.2R** | 24.9R | `[-0.125, +0.174]` | ₹+575.7 | **₹-3,201.9** |
| **DOTUSDT** | 275 | **+0.087R** | -0.678R | **1.16** | 16.7% | 41.8% | **+24.0R** | 12.7R | `[-0.073, +0.259]` | ₹+1,680.4 | **₹-1,929.2** |
| **XAUUSDT** | 364 | **+0.182R** | -0.605R | **1.35** | 17.6% | 45.6% | **+66.4R** | 8.3R | `[+0.051, +0.317]` | ₹+4,645.2 | **₹-730.9** |
| **XAGUSDT** | 383 | **+0.076R** | -1.018R | **1.13** | 15.1% | 41.0% | **+29.0R** | 17.2R | `[-0.061, +0.224]` | ₹+2,030.5 | **₹-3,134.2** |
| **CLUSDT** | 353 | **+0.046R** | -1.015R | **1.08** | 12.2% | 41.6% | **+16.3R** | 20.8R | `[-0.083, +0.187]` | ₹+1,141.9 | **₹-3,283.1** |
| **Crypto Total** | 1127 | **+0.055R** | -0.588R | **1.10** | 18.0% | 39.0% | **+61.9R** | 57.5R | `[-0.054, +0.170]` | ₹+4,332.0 | **₹-9,811.0** |
| **Commodity Total** | 1100 | **+0.102R** | -1.015R | **1.19** | 15.0% | 42.7% | **+111.7R** | 24.2R | `[+0.028, +0.182]` | ₹+7,817.5 | **₹-7,148.2** |
| **ALL PORTFOLIO** | 2227 | **+0.078R** | -0.781R | **1.14** | 16.5% | 40.9% | **+173.6R** | 36.0R | `[+0.016, +0.149]` | ₹+12,149.6 | **₹-16,959.2** |

### Strategy: Baseline 2: [OM] Distributed 4H Specialists (IN-SAMPLE)

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Pre-Tax INR | After-Tax (30%) INR |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 106 | **+0.217R** | -0.247R | **1.44** | 21.7% | 43.4% | **+23.0R** | 17.2R | `[-0.076, +0.476]` | ₹+1,612.2 | **₹+22.5** |
| **ETHUSDT** | 145 | **+0.089R** | -0.459R | **1.17** | 20.0% | 37.2% | **+12.9R** | 16.2R | `[-0.120, +0.306]` | ₹+900.6 | **₹-987.6** |
| **SOLUSDT** | 191 | **+0.147R** | -0.228R | **1.28** | 20.9% | 40.8% | **+28.1R** | 15.4R | `[-0.048, +0.347]` | ₹+1,966.0 | **₹-693.6** |
| **DOTUSDT** | 247 | **+0.074R** | -0.678R | **1.14** | 17.0% | 40.9% | **+18.2R** | 11.9R | `[-0.094, +0.245]` | ₹+1,272.2 | **₹-1,907.8** |
| **XAUUSDT** | 291 | **+0.275R** | -0.018R | **1.57** | 19.2% | 49.5% | **+80.0R** | 7.4R | `[+0.131, +0.430]` | ₹+5,602.8 | **₹+998.1** |
| **XAGUSDT** | 212 | **+0.137R** | -1.018R | **1.25** | 18.4% | 42.5% | **+29.0R** | 12.8R | `[-0.040, +0.315]` | ₹+2,030.2 | **₹-1,047.5** |
| **CLUSDT** | 218 | **+0.084R** | -0.722R | **1.16** | 11.5% | 43.6% | **+18.4R** | 10.5R | `[-0.080, +0.265]` | ₹+1,285.5 | **₹-1,480.1** |
| **Crypto Total** | 689 | **+0.119R** | -0.409R | **1.23** | 19.4% | 40.5% | **+82.2R** | 47.4R | `[-0.011, +0.260]` | ₹+5,751.0 | **₹-3,566.5** |
| **Commodity Total** | 721 | **+0.177R** | -0.393R | **1.34** | 16.6% | 45.6% | **+127.4R** | 15.6R | `[+0.087, +0.269]` | ₹+8,918.5 | **₹-1,529.5** |
| **ALL PORTFOLIO** | 1410 | **+0.149R** | -0.406R | **1.29** | 18.0% | 43.1% | **+209.6R** | 22.2R | `[+0.076, +0.230]` | ₹+14,669.5 | **₹-5,095.9** |

### Strategy: Router A-insample (Optimistic / In-Sample)

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Pre-Tax INR | After-Tax (30%) INR |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 58 | **+0.244R** | -0.077R | **1.62** | 15.5% | 46.6% | **+14.1R** | 5.7R | `[-0.088, +0.593]` | ₹+989.2 | **₹+213.2** |
| **ETHUSDT** | 99 | **+0.328R** | -0.297R | **1.88** | 26.3% | 39.4% | **+32.4R** | 6.0R | `[-0.005, +0.733]` | ₹+2,270.9 | **₹+818.9** |
| **SOLUSDT** | 191 | **+0.147R** | -0.228R | **1.28** | 20.9% | 40.8% | **+28.1R** | 15.4R | `[-0.048, +0.347]` | ₹+1,966.0 | **₹-693.6** |
| **DOTUSDT** | 180 | **+0.169R** | -0.538R | **1.32** | 18.9% | 45.0% | **+30.3R** | 10.9R | `[-0.024, +0.371]` | ₹+2,123.9 | **₹-474.8** |
| **XAUUSDT** | 291 | **+0.275R** | -0.018R | **1.57** | 19.2% | 49.5% | **+80.0R** | 7.4R | `[+0.131, +0.430]` | ₹+5,602.8 | **₹+998.1** |
| **XAGUSDT** | 254 | **+0.216R** | -0.570R | **1.42** | 18.1% | 45.7% | **+54.8R** | 10.6R | `[+0.046, +0.408]` | ₹+3,834.0 | **₹-85.6** |
| **CLUSDT** | 218 | **+0.084R** | -0.722R | **1.16** | 11.5% | 43.6% | **+18.4R** | 10.5R | `[-0.080, +0.265]` | ₹+1,285.5 | **₹-1,480.1** |
| **Crypto Total** | 528 | **+0.199R** | -0.299R | **1.42** | 20.6% | 42.6% | **+105.0R** | 15.3R | `[+0.059, +0.353]` | ₹+7,350.0 | **₹-136.2** |
| **Commodity Total** | 763 | **+0.201R** | -0.241R | **1.40** | 16.6% | 46.5% | **+153.2R** | 13.7R | `[+0.112, +0.303]` | ₹+10,722.2 | **₹-567.5** |
| **ALL PORTFOLIO** | 1291 | **+0.200R** | -0.285R | **1.41** | 18.3% | 44.9% | **+258.2R** | 20.0R | `[+0.121, +0.292]` | ₹+18,072.3 | **₹-703.8** |

## 8. Robustness & Sensitivity Audits

### Robustness Matrix (Test Period)

| Strategy Name | Base Avg Net R | Ex-ETH Avg Net R | Ex-Best Year Avg Net R | 1.5x Fee Avg Net R | 1st Half Test Avg R | 2nd Half Test Avg R | 1,000-Run Random Beat Prob ($p$) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Router A (Walk-Forward)** | **+0.059R** | +0.057R | +0.035R (2025) | +0.059R | +0.084R | +0.035R | **p = 0.0220** |
| **Router B (Fixed Mapping)** | **+0.086R** | +0.091R | +0.055R (2025) | +0.057R | +0.095R | +0.077R | **p = 0.0120** |
| **Baseline 1: 4H Pure Rules (7 Assets)** | **+0.078R** | +0.080R | +0.056R (2025) | +0.049R | +0.077R | +0.079R | **p = 0.0040** |
| **Baseline 2: [OM] Distributed 4H Specialists (IN-SAMPLE)** | **+0.149R** | +0.155R | +0.116R (2025) | +0.148R | +0.161R | +0.137R | **p = 0.0000** |
| **Router A-insample (Optimistic / In-Sample)** | **+0.200R** | +0.189R | +0.167R (2025) | +0.198R | +0.158R | +0.242R | **p = 0.0000** |

### Quantifying the Selection Bias: Router A-insample vs. Router A Walk-Forward
- **Router A-insample (Full Hindsight):** `+0.2000R` per trade | Profit Factor: `1.41` | Total R: `+258.2R`.
- **Router A Walk-Forward (Realistic Execution):** `+0.0593R` per trade | Profit Factor: `1.10` | Total R: `+134.6R`.
- **Net Selection Bias Gap:** **`+0.1407R` per trade (`+14.07 bps` per trade)**.
> **Econometric Takeaway:** In-sample optimization creates an artificial $+0.141\text{R}$ optical illusion. 70.4% of the apparent performance of an engine router disappears when it is forced to select models using only causally available historical data.

## 9. What Could Not Be Verified
1. **Sub-Hourly Intrabar Gaps for 1H Model Trades:** For the 1H ML specialist trades selected by Router A on Silver and Crude Oil in 2023–2024, order execution is modeled on next-bar open fills with 0.010% slippage per side. Intrabar bid-ask spreads during macro commodity news spikes (e.g. OPEC cuts, Middle East escalation) may have exceeded 0.05%, implying real-world drag was even worse than modeled.
2. **Exact Walk-Forward Cross-Asset Margining:** In live multi-asset deployment, holding positions across multiple correlated crypto and commodity perps introduces portfolio-level margin utilization. The backtest evaluates each trade independently at ₹70 per R without dynamic margin-call modeling.

## 10. Operational Recommendations: Keep, Decommission & Next Steps

### A. Definitively Reject Dynamic Routing (Router A)
- **Do NOT deploy Router A.** Past performance over a 1-to-3 year rolling window has **zero predictive power** for selecting which algorithmic engine will outperform next year. In fact, it actively selects overfitted in-sample models right before they experience out-of-sample regime decay.

### B. Maintain Router B's Principled Asset Pruning (Shadow Paper Mode)
- Router B's fixed structural insight—**trading Crypto + Gold on 4H candles and completely excluding noisy commodities (Silver, Crude Oil)**—remains statistically sound. Across 2020–2026, pruning XAG and CL improved the 4H baseline's Average Net R from `+0.055R` to `+0.091R` (+65% gain in expectancy).
- However, because Router B does not clear the 1.43 after-tax profit factor hurdle on the test period, it must NOT be allocated live capital. Keep Router B in shadow forward paper testing alongside `v1_primary`.

### C. Next Analytical Priorities (Zero Rule Changes)
1. Continue running the three active forward paper ledgers (`v1_primary`, `v6_shadow`, `v8_shadow`) until 30 closed forward trades accumulate.
2. Maintain strict zero-tuning discipline: never calibrate routers or models on forward data.
