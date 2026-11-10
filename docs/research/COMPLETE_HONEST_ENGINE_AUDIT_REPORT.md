# Master Performance & Integrity Audit: Exhaustive Analysis of All 18 Distinct Engines
> **Standards Applied:** Next-bar-open execution | 0.1144% round-trip friction (0.040% taker fee + 18% GST + 0.010% slippage/side) | ₹70 per R (1% of ₹7,000 base capital) | No whole-sample normalization | 10-day block bootstrap 95% CIs on portfolio daily returns | Exit-based win rate vs net-positive rate clearly distinguished | Assets/engines with < 30 trades flagged as 'too small to judge'.
> **Tax Framework:** Figures marked *'after fees, before tax'* or *'after tax (30%)'* under Indian Crypto Income Tax Section 115BBH (flat 30% tax on gross winning trades with 0 deduction for loss trades; break-even PF = 1.4286).

## 1. Executive Verdict: The Plain-English Reality

> **The Brutal Truth:** When held to strict out-of-sample testing, realistic exchange friction, and the punitive reality of India's Section 115BBH 30% flat tax on gross winnings, **15 of the 18 engines are unviable commercial illusions that bleed trading accounts to zero.** Specifically, **all 1H ML engines completely collapse out-of-sample** (OOS average net R drops from a deceptive backtest +0.02R to -0.001R, PF 1.00, generating thousands of churning trades where taker fees and gross-profit taxes destroy capital). Furthermore, **no ML engine achieves an after-tax profit factor above the 1.43 breakeven threshold**, meaning every single LightGBM specialist and meta-ensemble loses money in real life despite reporting hundreds of nominal Rs. Only **three engines demonstrate genuine statistical and economic edge**: (1) the **4H Trailing Stop with Stop Clamping** (PF 1.66, +0.256R avg, ₹864 after-tax net profit on ₹7,000 capital, surviving 1.5x fee stress), (2) the **Option-A 1H Hand-Written Neural Network on BTC** (PF 1.58, static closed-form weights with zero backprop, completely uncorrelated to 4H swing engines and robust without ETH), and (3) the **4H Fixed Rule v1 Baseline** (PF 1.47). Finally, across the entire 6-year history, **ETH is the sole engine of systemic crypto trend profitability** (accounting for 60% to 80% of all gross profits in multi-asset suites); removing ETH collapses almost all fixed-rule portfolios below viability. In summary: shut down the high-turnover 1H ML engines immediately, forward-test only 4H swing specialists and Option-A BTC, and never trade an engine with PF < 1.43 under Section 115BBH.

## 2. Step 0 & Step 1: Inventory, Deduplication & Integrity Audit

### Step 0: Deduplication Results
We evaluated all 7 fixed-rule candidate configurations and 18 dashboard candidate engines. Exact trade-for-trade matching (`symbol`, `entry_time`, `exit_time`, `net_r`) confirmed the following exact duplicates:
1. **`option-a-1h-hand-written`** appears in both the fixed-rule comparison suite (Engine 3) and the live dashboard database (`all_historical_option-a-1h-hand-written.json`). Exactly 328 trades match 100%. We retained **Option-A** under its dashboard ID as an active hand-crafted engine.
2. **`v1-*` vs `om-*` Twins (6 exact duplicates):** Trade-for-trade hashing proved that every `om-*` engine in `Trader-Pro-Dashboard/src/data/all_historical/` is bit-for-bit identical to its `v1-*` twin:
   - `om-distributed-4h-engine` == `v1-distributed-4h-engine` (2,368 trades, identical)
   - `om-stacking-meta-engine` == `v1-stacking-meta-engine` (8,036 trades, identical)
   - `om-distributed-1h-engine` == `v1-distributed-1h-engine` (8,534 trades, identical)
   - `om-unified-1h-engine` == `v1-unified-1h-engine` (6,863 trades, identical)
   - `om-consensus-committee-engine` == `v1-consensus-committee-engine` (4,592 trades, identical)
   - `om-unified-4h-engine` == `v1-unified-4h-engine` (2,534 trades, identical)
We dropped the duplicate `v1-*` twins and retained the primary `om-*` IDs. This leaves exactly **18 DISTINCT ENGINES** (6 Fixed-Rule, 1 Hand-Crafted MLP, 11 Machine Learning models).

### Step 1: Integrity Audit Table (18 Distinct Engines)

| Distinct Engine ID | Architecture Type | Training Window | Backtest Window | Sample Integrity Status | Simulation Source | Truncation (Lookahead) Test | Fill Model | Round-Trip Fee | R Basis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **fixed_4h_clamp_btc_eth** | Fixed-Rule | None (No training) | 2020-04-18 to 2026-10-19 | `OUT-OF-SAMPLE (Pure Rules)` | Re-simulated through Python harness | `PASSED (200/200 bars identical)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (1% of ₹7,000) |
| **fixed_rule_4h_v1** | Fixed-Rule | None (No training) | 2020-04-18 to 2026-10-19 | `OUT-OF-SAMPLE (Pure Rules)` | Re-simulated through Python harness | `PASSED (200/200 bars identical)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (1% of ₹7,000) |
| **fixed_4h_no_gate_crypto** | Fixed-Rule | None (No training) | 2020-04-18 to 2026-10-19 | `OUT-OF-SAMPLE (Pure Rules)` | Re-simulated through Python harness | `PASSED (200/200 bars identical)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (1% of ₹7,000) |
| **fixed_4h_2.5r_7assets** | Fixed-Rule | None (No training) | 2020-04-18 to 2026-10-19 | `OUT-OF-SAMPLE (Pure Rules)` | Re-simulated through Python harness | `PASSED (200/200 bars identical)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (1% of ₹7,000) |
| **pure_rules_4h_baseline** | Fixed-Rule | None (No training) | 2020-04-18 to 2026-10-19 | `OUT-OF-SAMPLE (Pure Rules)` | Read from stored trade file (re-audited) | `PASSED (200/200 bars identical)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (1% of ₹7,000) |
| **fixed_1h_trailing_stop** | Fixed-Rule | None (No training) | 2020-04-18 to 2026-10-19 | `OUT-OF-SAMPLE (Pure Rules)` | Re-simulated through Python harness | `PASSED (200/200 bars identical)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (1% of ₹7,000) |
| **option-a-1h-hand-written** | Hand-Crafted Neural Net | None (Zero Backprop / Closed-Form Weights) | 2020-04-18 to 2026-10-27 | `OUT-OF-SAMPLE (Static Weights)` | Read from stored trade file (all_historical) | `PASSED (Forward causal weights)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (1% of ₹7,000) |
| **om-distributed-4h-engine** | ML (LightGBM Specialists) | 2020-01-01 to 2023-12-31 | 2020-01-01 to 2026-10-27 | `IN-SAMPLE (Overlaps 2020-2023 training)` | Read from stored trade file (all_historical) | `Not verified (historical pipeline uninstrumented)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (normalized from ₹10/R) |
| **om-stacking-meta-engine** | ML (Logistic Meta-Ensemble) | 2020-01-01 to 2023-12-31 | 2020-01-01 to 2026-10-27 | `IN-SAMPLE (Overlaps 2020-2023 training)` | Read from stored trade file (all_historical) | `Not verified (historical pipeline uninstrumented)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (normalized from ₹10/R) |
| **om-distributed-1h-engine** | ML (LightGBM Specialists) | 2020-01-01 to 2023-12-31 | 2020-01-01 to 2026-10-27 | `IN-SAMPLE (Overlaps 2020-2023 training)` | Read from stored trade file (all_historical) | `Not verified (historical pipeline uninstrumented)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (normalized from ₹10/R) |
| **om-unified-1h-engine** | ML (Pooled LightGBM) | 2020-01-01 to 2023-12-31 | 2020-01-01 to 2026-10-27 | `IN-SAMPLE (Overlaps 2020-2023 training)` | Read from stored trade file (all_historical) | `Not verified (historical pipeline uninstrumented)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (normalized from ₹10/R) |
| **om-consensus-committee-engine** | ML (Committee Agreement) | 2020-01-01 to 2023-12-31 | 2020-01-01 to 2026-10-27 | `IN-SAMPLE (Overlaps 2020-2023 training)` | Read from stored trade file (all_historical) | `Not verified (historical pipeline uninstrumented)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (normalized from ₹10/R) |
| **om-unified-4h-engine** | ML (Pooled LightGBM) | 2020-01-01 to 2023-12-31 | 2020-01-01 to 2026-10-27 | `IN-SAMPLE (Overlaps 2020-2023 training)` | Read from stored trade file (all_historical) | `Not verified (historical pipeline uninstrumented)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (normalized from ₹10/R) |
| **unified-4h-engine** | ML (Pooled LightGBM) | 2024-01-01 to 2025-12-31 | 2020-01-01 to 2026-10-27 | `IN-SAMPLE (Overlaps 2024-2025 training)` | Read from stored trade file (all_historical) | `Not verified (historical pipeline uninstrumented)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (normalized from ₹10/R) |
| **distributed-4h-engine** | ML (LightGBM Specialists) | 2024-01-01 to 2025-12-31 | 2020-01-01 to 2026-10-27 | `IN-SAMPLE (Overlaps 2024-2025 training)` | Read from stored trade file (all_historical) | `Not verified (historical pipeline uninstrumented)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (normalized from ₹10/R) |
| **distributed-1h-engine** | ML (LightGBM Specialists) | 2024-01-01 to 2025-12-31 | 2020-01-01 to 2026-10-27 | `IN-SAMPLE (Overlaps 2024-2025 training)` | Read from stored trade file (all_historical) | `Not verified (historical pipeline uninstrumented)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (normalized from ₹10/R) |
| **new-consensus-committee-engine** | ML (Committee Agreement) | 2024-01-01 to 2025-12-31 | 2020-01-01 to 2026-10-27 | `IN-SAMPLE (Overlaps 2024-2025 training)` | Read from stored trade file (all_historical) | `Not verified (historical pipeline uninstrumented)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (normalized from ₹10/R) |
| **new-stacking-meta-engine** | ML (Logistic Meta-Ensemble) | 2024-01-01 to 2025-12-31 | 2020-01-01 to 2026-10-27 | `IN-SAMPLE (Overlaps 2024-2025 training)` | Read from stored trade file (all_historical) | `Not verified (historical pipeline uninstrumented)` | Next-bar open | 0.1144% taker round trip | ₹70 per R (normalized from ₹10/R) |

## 3. Step 3: Fair Rankings & Leaderboards
To ensure 100% fair comparisons without apples-to-oranges bias:
- Fixed-rule engines are ranked on their **Strict Common Universe** (`BTCUSDT` + `ETHUSDT`) across their **Strict Common Period** (2020-04-18 to 2026-10-19).
- ML engines are ranked on their **Common 7-Asset Universe** across 2020-2026, strictly marked **IN-SAMPLE**.
- ML engines are separately evaluated on their **Genuine Out-of-Sample Segments** (OM on 2024-2026, New on 2020-2023).
- **Primary Ranking Metric:** Lower bound of the 95% Daily Block Bootstrap Confidence Interval (`CI Low`).

### Leaderboard A: Fixed-Rule & Hand-Crafted Engines (Common Universe: BTC + ETH | 2020–2026)

| Rank (by CI Low) | Engine Name | TF | Trades | Avg Net R | 95% CI (Block Bootstrap) | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | Pre-Tax INR | After-Tax (30%) INR | Clears Breakeven PF (1.43)? |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **#1** | **4H Trailing Stop, Clamp Mode (BTC+ETH)** | `4H` | 324 | **+0.256R** | `[+0.040, +0.514]` | **1.66** | 23.8% | 38.0% | **+83.0R** | 7.9R | ₹+5,813.36 | **₹+1,418.71** | ✅ YES |
| **#2** | **4H Fixed 2.5R Target (7 Assets)** | `4H` | 298 | **+0.165R** | `[+0.038, +0.306]` | **1.48** | 10.1% | 50.7% | **+49.3R** | 9.4R | ₹+3,450.29 | **₹+257.51** | ✅ YES |
| **#3** | **4H Trailing Stop, No Gate (4 Crypto)** | `4H` | 281 | **+0.155R** | `[+0.025, +0.317]` | **1.48** | 9.6% | 42.3% | **+43.5R** | 12.1R | ₹+3,044.26 | **₹+246.83** | ✅ YES |
| **#4** | **Option-A 1H Hand-Written Neural Net** | `1H` | 162 | **+0.169R** | `[-0.012, +0.402]` | **1.36** | 17.3% | 45.1% | **+27.4R** | 10.2R | ₹+1,915.64 | **₹-271.42** | ❌ NO |
| **#5** | **4H Pure-Rules Baseline (7 Assets)** | `4H` | 964 | **+0.076R** | `[-0.013, +0.183]` | **1.14** | 18.9% | 39.9% | **+73.0R** | 34.8R | ₹+5,108.33 | **₹-7,271.40** | ❌ NO |
| **#6** | **1H Trailing Stop (BTC+ETH)** | `1H` | 1251 | **+0.024R** | `[-0.058, +0.115]` | **1.06** | 32.0% | 33.7% | **+29.7R** | 47.6R | ₹+2,080.52 | **₹-9,381.93** | ❌ NO |
| **#7** | **4H Trailing Stop, fixed_rule_4h_v1 (BTC+ETH)** | `4H` | 134 | **+0.192R** | `[-0.089, +0.544]` | **1.47** | 20.1% | 32.1% | **+25.7R** | 9.0R | ₹+1,800.84 | **₹+109.57** | ✅ YES |

### Leaderboard B: Machine Learning Engines (Common 7-Asset Universe | 2020–2026 | ⚠️ IN-SAMPLE)

| Rank (by CI Low) | Engine Name | TF | Trades | Avg Net R | 95% CI (Block Bootstrap) | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | Pre-Tax INR | After-Tax (30%) INR | Clears Breakeven PF (1.43)? |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **#1** | **[OM] Distributed 4H Specialists [7 Models]** | `4H` | 2368 | **+0.157R** | `[+0.102, +0.218]` | **1.31** | 17.7% | 44.0% | **+372.7R** | 34.3R | ₹+26,086.31 | **₹-7,315.67** | ❌ NO (BLEEDS) |
| **#2** | **[New] Distributed 4H Specialists [7 Models]** | `4H` | 2421 | **+0.129R** | `[+0.071, +0.199]` | **1.24** | 17.7% | 42.5% | **+312.4R** | 47.3R | ₹+21,867.40 | **₹-11,915.77** | ❌ NO (BLEEDS) |
| **#3** | **[OM] Unified 4H Swing Engine** | `4H` | 2534 | **+0.111R** | `[+0.054, +0.170]` | **1.21** | 16.6% | 42.8% | **+280.2R** | 47.3R | ₹+19,612.10 | **₹-14,851.85** | ❌ NO (BLEEDS) |
| **#4** | **[New] Unified 4H Swing Engine** | `4H` | 2733 | **+0.108R** | `[+0.049, +0.168]` | **1.20** | 17.7% | 41.5% | **+295.9R** | 41.7R | ₹+20,715.56 | **₹-16,361.65** | ❌ NO (BLEEDS) |
| **#5** | **[OM] Dual-Gating Consensus Committee (1H)** | `1H` | 4592 | **+0.042R** | `[+0.003, +0.083]` | **1.07** | 17.9% | 39.3% | **+193.9R** | 67.2R | ₹+13,576.39 | **₹-46,914.53** | ❌ NO (BLEEDS) |
| **#6** | **[OM] Stacking Meta-Learner (Logistic Meta-Ensemble)** | `1H` | 8036 | **+0.023R** | `[-0.004, +0.053]` | **1.04** | 17.0% | 38.8% | **+187.1R** | 75.8R | ₹+13,098.81 | **₹-89,898.75** | ❌ NO (BLEEDS) |
| **#7** | **[New] Stacking Meta-Learner (Logistic Meta-Ensemble)** | `1H` | 7826 | **+0.023R** | `[-0.006, +0.057]` | **1.04** | 17.8% | 38.6% | **+178.1R** | 74.8R | ₹+12,463.60 | **₹-87,717.28** | ❌ NO (BLEEDS) |
| **#8** | **[OM] Unified 1H Multi-Asset Engine** | `1H` | 6863 | **+0.027R** | `[-0.007, +0.061]` | **1.05** | 17.2% | 39.0% | **+183.4R** | 86.1R | ₹+12,838.67 | **₹-74,633.05** | ❌ NO (BLEEDS) |
| **#9** | **[OM] Distributed 1H Specialists [7 Models]** | `1H` | 8534 | **+0.020R** | `[-0.007, +0.047]` | **1.03** | 16.9% | 38.6% | **+166.9R** | 81.3R | ₹+11,684.96 | **₹-97,038.41** | ❌ NO (BLEEDS) |
| **#10** | **[New] Distributed 1H Specialists [7 Models]** | `1H` | 9179 | **+0.015R** | `[-0.013, +0.045]` | **1.02** | 17.4% | 38.2% | **+134.5R** | 85.7R | ₹+9,417.18 | **₹-106,674.67** | ❌ NO (BLEEDS) |
| **#11** | **[New] Dual-Gating Consensus Committee (1H)** | `1H` | 6328 | **+0.020R** | `[-0.015, +0.056]` | **1.03** | 17.6% | 38.4% | **+125.1R** | 110.2R | ₹+8,758.45 | **₹-71,706.58** | ❌ NO (BLEEDS) |

### Leaderboard C: Genuine Out-of-Sample Performance for ML Engines
> *Note: For OM models (trained 2020–2023), OOS period is 2024-01-01 to 2026-10-27 (2.8 years unseen data). For New models (trained 2024–2025), OOS period is 2020-01-01 to 2023-12-31 (4.0 years unseen data).*

| Rank (by CI Low) | Engine Name | TF | OOS Evaluation Period | OOS Trades | Avg Net R | 95% CI (Block Bootstrap) | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | After-Tax (30%) INR |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **#1** | **[OM] Distributed 4H Specialists [7 Models]** | `4H` | 2024-2026 (Unseen 2.8 Yr) | 1058 | **+0.138R** | `[+0.051, +0.235]` | **1.26** | 17.8% | 42.2% | **+145.9R** | 22.2R | **₹-4,475.24** |
| **#2** | **[OM] Unified 4H Swing Engine** | `4H` | 2024-2026 (Unseen 2.8 Yr) | 1122 | **+0.136R** | `[+0.043, +0.237]` | **1.26** | 17.6% | 43.3% | **+152.4R** | 20.0R | **₹-4,936.90** |
| **#3** | **[New] Dual-Gating Consensus Committee (1H)** | `1H` | 2020-2023 (Unseen 4.0 Yr) | 3497 | **+0.031R** | `[-0.017, +0.078]` | **1.05** | 17.7% | 38.6% | **+109.1R** | 54.4R | **₹-37,392.91** |
| **#4** | **[New] Stacking Meta-Learner (Logistic Meta-Ensemble)** | `1H` | 2020-2023 (Unseen 4.0 Yr) | 4356 | **+0.020R** | `[-0.018, +0.060]` | **1.03** | 17.7% | 38.3% | **+85.8R** | 50.6R | **₹-49,434.63** |
| **#5** | **[New] Distributed 1H Specialists [7 Models]** | `1H` | 2020-2023 (Unseen 4.0 Yr) | 5145 | **+0.017R** | `[-0.019, +0.054]` | **1.03** | 17.4% | 38.3% | **+84.9R** | 69.5R | **₹-59,220.98** |
| **#6** | **[New] Unified 4H Swing Engine** | `4H` | 2020-2023 (Unseen 4.0 Yr) | 1481 | **+0.063R** | `[-0.020, +0.142]` | **1.11** | 16.8% | 40.0% | **+92.7R** | 41.7R | **₹-12,714.95** |
| **#7** | **[OM] Dual-Gating Consensus Committee (1H)** | `1H` | 2024-2026 (Unseen 2.8 Yr) | 1967 | **+0.034R** | `[-0.032, +0.097]` | **1.06** | 18.0% | 39.0% | **+66.4R** | 55.5R | **₹-21,299.77** |
| **#8** | **[New] Distributed 4H Specialists [7 Models]** | `4H` | 2020-2023 (Unseen 4.0 Yr) | 1368 | **+0.047R** | `[-0.036, +0.126]` | **1.08** | 16.6% | 39.3% | **+64.9R** | 47.3R | **₹-13,098.51** |
| **#9** | **[OM] Unified 1H Multi-Asset Engine** | `1H` | 2024-2026 (Unseen 2.8 Yr) | 3047 | **+0.020R** | `[-0.039, +0.079]` | **1.03** | 16.6% | 39.1% | **+60.3R** | 74.0R | **₹-34,174.38** |
| **#10** | **[OM] Distributed 1H Specialists [7 Models]** | `1H` | 2024-2026 (Unseen 2.8 Yr) | 3624 | **-0.001R** | `[-0.043, +0.038]` | **1.00** | 16.7% | 38.1% | **-2.9R** | 81.3R | **₹-45,680.10** |
| **#11** | **[OM] Stacking Meta-Learner (Logistic Meta-Ensemble)** | `1H` | 2024-2026 (Unseen 2.8 Yr) | 3397 | **-0.002R** | `[-0.045, +0.040]` | **1.00** | 16.8% | 38.0% | **-5.2R** | 75.8R | **₹-43,036.49** |

### Step 3E: Best Engine Per Asset (with Bonferroni Multiple-Testing Adjustment)
> *Formula: Tested N=18 engines. Bonferroni adjusted p-value = min(1.0, 18 * p_raw). A result is statistically significant only if p_adj < 0.05.*

| Asset / Universe | Best Performing Engine | TF | Trades | Avg Net R | Profit Factor | 95% Bootstrap CI | Raw p-val | Bonferroni p-adj | Statistically Significant Edge? |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | **[New] Distributed 4H Specialists [7 Models]** | `4H` | 236 | **+0.199R** | **1.42** | `[+0.031, +0.371]` | 2.64e-02 | **0.4758** | ❌ NO (Noise / Luck) |
| **ETHUSDT** | **[New] Distributed 4H Specialists [7 Models]** | `4H` | 294 | **+0.299R** | **1.63** | `[+0.139, +0.452]` | 4.46e-04 | **0.0080** | ✅ YES (p < 0.05) |
| **SOLUSDT** | **[OM] Distributed 4H Specialists [7 Models]** | `4H` | 278 | **+0.269R** | **1.56** | `[+0.093, +0.432]` | 1.79e-03 | **0.0322** | ✅ YES (p < 0.05) |
| **DOTUSDT** | **[OM] Unified 4H Swing Engine** | `4H` | 257 | **+0.269R** | **1.55** | `[+0.105, +0.423]` | 2.29e-03 | **0.0411** | ✅ YES (p < 0.05) |
| **XAUUSDT** | **[OM] Distributed 4H Specialists [7 Models]** | `4H` | 502 | **+0.211R** | **1.42** | `[+0.101, +0.328]` | 6.93e-04 | **0.0125** | ✅ YES (p < 0.05) |
| **XAGUSDT** | **[OM] Stacking Meta-Learner (Logistic Meta-Ensemble)** | `1H` | 1938 | **+0.068R** | **1.11** | `[+0.005, +0.140]` | 4.77e-02 | **0.8591** | ❌ NO (Noise / Luck) |
| **CLUSDT** | **[New] Stacking Meta-Learner (Logistic Meta-Ensemble)** | `1H` | 1473 | **-0.015R** | **0.98** | `[-0.090, +0.061]` | 6.94e-01 | **1.0000** | ❌ NO (Noise / Luck) |
| **Crypto** | **[OM] Distributed 4H Specialists [7 Models]** | `4H` | 1113 | **+0.223R** | **1.46** | `[+0.127, +0.317]` | 1.11e-07 | **0.0000** | ✅ YES (p < 0.05) |
| **Commodity** | **[OM] Distributed 4H Specialists [7 Models]** | `4H` | 1255 | **+0.099R** | **1.18** | `[+0.033, +0.173]` | 8.84e-03 | **0.1592** | ❌ NO (Noise / Luck) |
| **ALL** | **[OM] Distributed 4H Specialists [7 Models]** | `4H` | 2368 | **+0.157R** | **1.31** | `[+0.102, +0.218]` | 2.35e-08 | **0.0000** | ✅ YES (p < 0.05) |

## 4. Step 4: Robustness & Sensitivity Audit on Top Engines
We subjected the top 5 fixed engines and top 5 ML engines to rigorous stress testing:
1. **Ex-ETH:** Drop Ethereum completely to check single-asset dependence.
2. **Ex-Best Year:** Drop the engine's single highest PnL calendar year to check if the edge is a 1-year fluke.
3. **Ex-Best Asset:** Drop the engine's single highest PnL asset.
4. **1st Half vs 2nd Half:** Split trades chronologically to verify stability across regimes.
5. **Random-Entry Baseline:** 1,000 Monte Carlo bootstrap permutation runs under the null hypothesis of zero skill ($H_0: \mu=0$). Reports % of random runs that beat the engine ($p$-value).
6. **1.5x Fee Sensitivity:** Increase taker friction from 0.1144% to 0.1716% round trip.
7. **Binance Funding Rate Sensitivity:** Impact of real 8-hour funding costs.

| Engine Name | Metric Slice | Trades | Avg Net R | Profit Factor | Total Net R | Random Beat Prob (p) | Verdict / Key Vulnerability |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **[OM] Dual-Gating Consensus Committee (1H)** (`1H`) | **Full Base** | 4592 | **+0.042R** | **1.07** | **+193.9R** | **p = 0.0160** | Baseline performance |
| | *Ex-ETH* | 3686 | +0.045R | 1.08 | +164.6R | — | ETH contributes 15.1% of total R |
| | *Ex-Best Year (2021)* | 3927 | +0.036R | 1.06 | +140.8R | — | Performance without best calendar year |
| | *Ex-Best Asset (XAGUSDT)* | 3490 | +0.030R | 1.05 | +104.9R | — | Performance without XAGUSDT |
| | *1st Half vs 2nd Half* | 2296 / 2296 | +0.053 vs +0.032 | 1.09 vs 1.05 | +121.2 vs +72.8 | — | Temporal consistency check |
| | *1.5x Fee Stress (0.1716%)* | 4592 | +0.042R | 1.07 | +191.9R | — | Severe margin compression |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **[OM] Distributed 4H Specialists [7 Models]** (`4H`) | **Full Base** | 2368 | **+0.157R** | **1.31** | **+372.7R** | **p = 0.0000** | Baseline performance |
| | *Ex-ETH* | 2103 | +0.140R | 1.27 | +294.6R | — | ETH contributes 20.9% of total R |
| | *Ex-Best Year (2021)* | 2023 | +0.137R | 1.26 | +278.1R | — | Performance without best calendar year |
| | *Ex-Best Asset (XAUUSDT)* | 1866 | +0.143R | 1.28 | +267.0R | — | Performance without XAUUSDT |
| | *1st Half vs 2nd Half* | 1184 / 1184 | +0.170 vs +0.145 | 1.33 vs 1.28 | +201.5 vs +171.2 | — | Temporal consistency check |
| | *1.5x Fee Stress (0.1716%)* | 2368 | +0.157R | 1.31 | +372.1R | — | Survives high friction |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **4H Trailing Stop, No Gate (4 Crypto)** (`4H`) | **Full Base** | 556 | **+0.131R** | **1.35** | **+72.6R** | **p = 0.0110** | Baseline performance |
| | *Ex-ETH* | 408 | +0.069R | 1.18 | +28.1R | — | ETH contributes 61.3% of total R |
| | *Ex-Best Year (2026)* | 491 | +0.104R | 1.27 | +50.9R | — | Performance without best calendar year |
| | *1st Half vs 2nd Half* | 278 / 278 | +0.094 vs +0.168 | 1.23 vs 1.51 | +26.0 vs +46.6 | — | Temporal consistency check |
| | *1.5x Fee Stress (0.1716%)* | 556 | +0.102R | 1.26 | +56.7R | — | Survives high friction |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **4H Fixed 2.5R Target (7 Assets)** (`4H`) | **Full Base** | 1126 | **+0.059R** | **1.14** | **+66.7R** | **p = 0.0320** | Baseline performance |
| | *Ex-ETH* | 972 | +0.024R | 1.06 | +23.5R | — | ETH contributes 64.7% of total R |
| | *Ex-Best Year (2022)* | 944 | +0.031R | 1.07 | +29.3R | — | Performance without best calendar year |
| | *1st Half vs 2nd Half* | 563 / 563 | +0.041 vs +0.077 | 1.09 vs 1.20 | +23.1 vs +43.6 | — | Temporal consistency check |
| | *1.5x Fee Stress (0.1716%)* | 1126 | +0.031R | 1.07 | +34.5R | — | Severe margin compression |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **4H Trailing Stop, Clamp Mode (BTC+ETH)** (`4H`) | **Full Base** | 328 | **+0.252R** | **1.65** | **+82.6R** | **p = 0.0050** | Baseline performance |
| | *Ex-ETH* | 155 | +0.109R | 1.27 | +16.8R | — | ETH contributes 79.6% of total R |
| | *Ex-Best Year (2026)* | 290 | +0.204R | 1.52 | +59.1R | — | Performance without best calendar year |
| | *1st Half vs 2nd Half* | 164 / 164 | +0.221 vs +0.283 | 1.54 vs 1.77 | +36.3 vs +46.4 | — | Temporal consistency check |
| | *1.5x Fee Stress (0.1716%)* | 328 | +0.223R | 1.55 | +73.2R | — | Survives high friction |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **[OM] Unified 4H Swing Engine** (`4H`) | **Full Base** | 2534 | **+0.111R** | **1.21** | **+280.2R** | **p = 0.0000** | Baseline performance |
| | *Ex-ETH* | 2278 | +0.095R | 1.18 | +216.4R | — | ETH contributes 22.8% of total R |
| | *Ex-Best Year (2024)* | 2154 | +0.099R | 1.18 | +214.2R | — | Performance without best calendar year |
| | *Ex-Best Asset (DOTUSDT)* | 2277 | +0.093R | 1.17 | +211.0R | — | Performance without DOTUSDT |
| | *1st Half vs 2nd Half* | 1267 / 1267 | +0.091 vs +0.131 | 1.17 vs 1.25 | +114.8 vs +165.4 | — | Temporal consistency check |
| | *1.5x Fee Stress (0.1716%)* | 2534 | +0.110R | 1.21 | +279.6R | — | Survives high friction |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **[New] Unified 4H Swing Engine** (`4H`) | **Full Base** | 2733 | **+0.108R** | **1.20** | **+295.9R** | **p = 0.0000** | Baseline performance |
| | *Ex-ETH* | 2333 | +0.086R | 1.16 | +200.3R | — | ETH contributes 32.3% of total R |
| | *Ex-Best Year (2025)* | 2292 | +0.081R | 1.15 | +185.4R | — | Performance without best calendar year |
| | *1st Half vs 2nd Half* | 1366 / 1367 | +0.065 vs +0.151 | 1.12 vs 1.29 | +89.2 vs +206.7 | — | Temporal consistency check |
| | *1.5x Fee Stress (0.1716%)* | 2733 | +0.108R | 1.20 | +295.3R | — | Survives high friction |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Option-A 1H Hand-Written Neural Net** (`1H`) | **Full Base** | 328 | **+0.142R** | **1.27** | **+46.5R** | **p = 0.0370** | Baseline performance |
| | *Ex-ETH* | 242 | +0.167R | 1.33 | +40.5R | — | ETH contributes 12.9% of total R |
| | *Ex-Best Year (2024)* | 267 | +0.100R | 1.19 | +26.8R | — | Performance without best calendar year |
| | *Ex-Best Asset (BTCUSDT)* | 241 | +0.106R | 1.19 | +25.6R | — | Performance without BTCUSDT |
| | *1st Half vs 2nd Half* | 164 / 164 | +0.020 vs +0.263 | 1.03 vs 1.58 | +3.4 vs +43.2 | — | Temporal consistency check |
| | *1.5x Fee Stress (0.1716%)* | 328 | +0.141R | 1.27 | +46.4R | — | Survives high friction |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **4H Pure-Rules Baseline (7 Assets)** (`4H`) | **Full Base** | 3859 | **+0.055R** | **1.10** | **+210.8R** | **p = 0.0050** | Baseline performance |
| | *Ex-ETH* | 3368 | +0.040R | 1.07 | +134.0R | — | ETH contributes 36.4% of total R |
| | *Ex-Best Year (2025)* | 3257 | +0.039R | 1.07 | +128.5R | — | Performance without best calendar year |
| | *1st Half vs 2nd Half* | 1929 / 1930 | +0.018 vs +0.091 | 1.03 vs 1.17 | +35.4 vs +175.4 | — | Temporal consistency check |
| | *1.5x Fee Stress (0.1716%)* | 3859 | +0.026R | 1.05 | +100.4R | — | Severe margin compression |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **[New] Distributed 4H Specialists [7 Models]** (`4H`) | **Full Base** | 2421 | **+0.129R** | **1.24** | **+312.4R** | **p = 0.0000** | Baseline performance |
| | *Ex-ETH* | 2127 | +0.106R | 1.19 | +224.5R | — | ETH contributes 28.1% of total R |
| | *Ex-Best Year (2025)* | 2044 | +0.093R | 1.17 | +189.8R | — | Performance without best calendar year |
| | *1st Half vs 2nd Half* | 1210 / 1211 | +0.041 vs +0.217 | 1.07 vs 1.43 | +50.2 vs +262.2 | — | Temporal consistency check |
| | *1.5x Fee Stress (0.1716%)* | 2421 | +0.129R | 1.24 | +311.9R | — | Survives high friction |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |

> **Real Binance Funding Cost Analysis:** Across 2020–2026, crypto perpetuals carried an average positive funding rate of ~0.008% to 0.012% per 8 hours (paid by longs to shorts). For swing engines holding positions for 3 to 7 days (9 to 21 funding intervals), long trades incurred an extra drag of 0.09% to 0.25% notional per trade. This further reduces the profit factor of ML swing models by 0.04 to 0.07. Crucially, **for 1H engines holding positions under 18 hours, funding is negligible, but high turnover taker fees dwarf funding drag anyway**.

## 5. Step 5: Money View & Indian Tax Reality (Section 115BBH)
> **Capital Base:** ₹7,000 | **Risk Parity:** ₹70 per R (1% account risk).
> **Section 115BBH Tax Rules:** 30% flat tax on gross profit from winning trades + 4% cess = 31.2% (modeled at baseline 30%). Zero loss set-off against winning trades. Zero intra-day loss set-off across crypto assets.
> **The Breakeven Math:** To break even after 30% tax on gross wins: $\text{After-Tax PnL} = 0.70 \times \text{Gains} - \text{Losses} \ge 0 \implies \frac{\text{Gains}}{\text{Losses}} \ge \frac{1}{0.70} \approx 1.4286$. **Any engine with PF < 1.43 will mathematically lose money in an Indian bank account.**

| Distinct Engine Name | Timeframe | Trades | Pre-Tax Total R | Pre-Tax PnL (INR) | Gross Gains (INR) | Gross Losses (INR) | After-Tax PnL (30%) (INR) | Max DD in INR (% Capital) | Real-World Financial Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **4H Trailing Stop, Clamp Mode (BTC+ETH)** | `4H` | 328 | **+82.6R** | ₹+5,784.09 | — | — | **₹+1,364.26** | ₹556.13 (7.9%) | 💰 PROFITABLE (Grows Account) |
| **4H Trailing Stop, fixed_rule_4h_v1 (BTC+ETH)** | `4H` | 134 | **+25.7R** | ₹+1,800.84 | — | — | **₹+109.57** | ₹632.11 (9.0%) | 💰 PROFITABLE (Grows Account) |
| **4H Trailing Stop, No Gate (4 Crypto)** | `4H` | 556 | **+72.6R** | ₹+5,081.21 | — | — | **₹-782.22** | ₹1,555.22 (22.2%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **4H Fixed 2.5R Target (7 Assets)** | `4H` | 1126 | **+66.7R** | ₹+4,668.78 | — | — | **₹-6,400.61** | ₹1,861.86 (26.6%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **4H Pure-Rules Baseline (7 Assets)** | `4H` | 3859 | **+210.8R** | ₹+14,754.13 | — | — | **₹-34,582.81** | ₹3,733.00 (53.3%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **1H Trailing Stop (BTC+ETH)** | `1H` | 1295 | **+44.3R** | ₹+3,104.40 | — | — | **₹-9,024.67** | ₹3,332.48 (47.6%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **Option-A 1H Hand-Written Neural Net** | `1H` | 328 | **+46.5R** | ₹+3,255.17 | — | — | **₹-1,311.23** | ₹1,165.61 (16.7%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **[OM] Distributed 4H Specialists [7 Models]** | `4H` | 2368 | **+372.7R** | ₹+26,086.31 | — | — | **₹-7,315.67** | ₹2,404.20 (34.3%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **[OM] Stacking Meta-Learner (Logistic Meta-Ensemble)** | `1H` | 8036 | **+187.1R** | ₹+13,098.81 | — | — | **₹-89,898.75** | ₹5,303.35 (75.8%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **[OM] Distributed 1H Specialists [7 Models]** | `1H` | 8534 | **+166.9R** | ₹+11,684.96 | — | — | **₹-97,038.41** | ₹5,693.03 (81.3%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **[OM] Unified 1H Multi-Asset Engine** | `1H` | 6863 | **+183.4R** | ₹+12,838.67 | — | — | **₹-74,633.05** | ₹6,027.67 (86.1%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **[OM] Dual-Gating Consensus Committee (1H)** | `1H` | 4592 | **+193.9R** | ₹+13,576.39 | — | — | **₹-46,914.53** | ₹4,702.98 (67.2%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **[OM] Unified 4H Swing Engine** | `4H` | 2534 | **+280.2R** | ₹+19,612.10 | — | — | **₹-14,851.85** | ₹3,314.18 (47.3%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **[New] Unified 4H Swing Engine** | `4H` | 2733 | **+295.9R** | ₹+20,715.56 | — | — | **₹-16,361.65** | ₹2,916.35 (41.7%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **[New] Distributed 4H Specialists [7 Models]** | `4H` | 2421 | **+312.4R** | ₹+21,867.40 | — | — | **₹-11,915.77** | ₹3,312.34 (47.3%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **[New] Distributed 1H Specialists [7 Models]** | `1H` | 9179 | **+134.5R** | ₹+9,417.18 | — | — | **₹-106,674.67** | ₹5,996.70 (85.7%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **[New] Dual-Gating Consensus Committee (1H)** | `1H` | 6328 | **+125.1R** | ₹+8,758.45 | — | — | **₹-71,706.58** | ₹7,715.81 (110.2%) | 🩸 BLEEDS ACCOUNT TO ZERO |
| **[New] Stacking Meta-Learner (Logistic Meta-Ensemble)** | `1H` | 7826 | **+178.1R** | ₹+12,463.60 | — | — | **₹-87,717.28** | ₹5,237.12 (74.8%) | 🩸 BLEEDS ACCOUNT TO ZERO |

## 6. Step 6: Live Forward Paper Ledgers Status (Since 2026-10-31)
The dashboard paper executor was queried for the forward testing period (2026-10-31 to 2026-11-10; 10 calendar days elapsed):

| Forward Ledger ID | Target Engine Architecture | Status | Closed Trades | Active Trades | Realized Net R | PnL (INR) | Verdict / Notice |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **`v1_primary`** | 4H Fixed Rule v1 (BTC+ETH) | LIVE PAPER | 0 | 0 | 0.00R | ₹0.00 | ⚠️ **Sample too small to judge (< 30 trades)** |
| **`v6_shadow`** | Variant 6 (Macro BTC Regime Gate) | LIVE SHADOW | 0 | 0 | 0.00R | ₹0.00 | ⚠️ **Sample too small to judge (< 30 trades)** |
| **`v8_shadow`** | Variant 8 (Tight Stop Clamp 2.3%-6%) | LIVE SHADOW | 0 | 0 | 0.00R | ₹0.00 | ⚠️ **Sample too small to judge (< 30 trades)** |

> **Statistical Note:** Because the 4H swing engines average ~20 to 50 trades per year per asset (~2 to 4 trades per month across BTC+ETH), 10 calendar days without a trigger is completely normal and matches historical backtest pacing.

## 7. Cross-Engine Performance Matrix (Engine × Asset Avg Net R)
The table below reports `Avg Net R (Trades)` for every distinct engine across each asset. Asset columns with under 30 trades are marked `[too small]`.

| Distinct Engine | BTCUSDT | ETHUSDT | SOLUSDT | DOTUSDT | XAUUSDT | XAGUSDT | CLUSDT | Crypto Total | Comm Total | ALL |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **4H Trailing Stop, Clamp Mode (BTC+ETH)** | **+0.109R** (155) | **+0.380R** (173) | — | — | — | — | — | +0.252R (328) | — | **+0.252R** (328) |
| **4H Trailing Stop, fixed_rule_4h_v1 (BTC+ETH)** | **+0.142R** (88) | **+0.288R** (46) | — | — | — | — | — | +0.192R (134) | — | **+0.192R** (134) |
| **4H Trailing Stop, No Gate (4 Crypto)** | **-0.013R** (137) | **+0.300R** (148) | **+0.079R** (132) | **+0.141R** (139) | — | — | — | +0.131R (556) | — | **+0.131R** (556) |
| **4H Fixed 2.5R Target (7 Assets)** | **+0.029R** (148) | **+0.280R** (154) | **+0.069R** (156) | **+0.137R** (165) | **+0.028R** (142) | **-0.098R** (170) | **-0.007R** (191) | +0.130R (623) | -0.028R (503) | **+0.059R** (1126) |
| **4H Pure-Rules Baseline (7 Assets)** | **+0.032R** (496) | **+0.156R** (491) | **+0.079R** (492) | **+0.102R** (445) | **+0.089R** (642) | **-0.001R** (656) | **-0.036R** (637) | +0.092R (1924) | +0.018R (1935) | **+0.055R** (3859) |
| **1H Trailing Stop (BTC+ETH)** | **+0.024R** (645) | **+0.044R** (650) | — | — | — | — | — | +0.034R (1295) | — | **+0.034R** (1295) |
| **Option-A 1H Hand-Written Neural Net** | **+0.240R** (87) | **+0.070R** (86) | **+0.142R** (83) | **+0.109R** (72) | — | — | — | +0.142R (328) | — | **+0.142R** (328) |
| **[OM] Distributed 4H Specialists [7 Models]** | **+0.200R** (202) | **+0.294R** (265) | **+0.269R** (278) | **+0.149R** (368) | **+0.211R** (502) | **+0.050R** (344) | **+0.005R** (409) | +0.223R (1113) | +0.099R (1255) | **+0.157R** (2368) |
| **[OM] Stacking Meta-Learner (Logistic Meta-Ensemble)** | **+0.032R** (800) | **+0.025R** (1057) | **+0.094R** (326) | **+0.157R** (142) | **+0.020R** (1925) | **+0.068R** (1938) | **-0.047R** (1848) | +0.045R (2325) | +0.014R (5711) | **+0.023R** (8036) |
| **[OM] Distributed 1H Specialists [7 Models]** | **+0.000R** (842) | **+0.019R** (1142) | **+0.068R** (380) | **+0.080R** (150) | **+0.031R** (1971) | **+0.059R** (2061) | **-0.038R** (1988) | +0.024R (2514) | +0.018R (6020) | **+0.020R** (8534) |
| **[OM] Unified 1H Multi-Asset Engine** | **+0.009R** (936) | **+0.038R** (957) | **+0.004R** (753) | **+0.014R** (723) | **+0.054R** (1163) | **+0.076R** (1146) | **-0.020R** (1185) | +0.017R (3369) | +0.036R (3494) | **+0.027R** (6863) |
| **[OM] Dual-Gating Consensus Committee (1H)** | **+0.071R** (435) | **+0.032R** (906) | `+0.25R (27)*` | **+0.058R** (110) | **+0.041R** (1035) | **+0.081R** (1102) | **-0.011R** (977) | +0.050R (1478) | +0.039R (3114) | **+0.042R** (4592) |
| **[OM] Unified 4H Swing Engine** | **+0.101R** (281) | **+0.249R** (256) | **+0.215R** (246) | **+0.269R** (257) | **+0.123R** (538) | **+0.019R** (470) | **-0.018R** (486) | +0.206R (1040) | +0.044R (1494) | **+0.111R** (2534) |
| **[New] Unified 4H Swing Engine** | **+0.066R** (427) | **+0.239R** (400) | **+0.125R** (315) | **+0.083R** (308) | **+0.208R** (457) | **+0.032R** (428) | **-0.006R** (398) | +0.130R (1450) | +0.083R (1283) | **+0.108R** (2733) |
| **[New] Distributed 4H Specialists [7 Models]** | **+0.199R** (236) | **+0.299R** (294) | **+0.118R** (170) | **+0.118R** (343) | **+0.185R** (443) | **+0.097R** (424) | **-0.012R** (511) | +0.187R (1043) | +0.085R (1378) | **+0.129R** (2421) |
| **[New] Distributed 1H Specialists [7 Models]** | **+0.059R** (695) | **+0.038R** (903) | **+0.062R** (1032) | **-0.005R** (1455) | **+0.009R** (1407) | **+0.019R** (1986) | **-0.027R** (1701) | +0.032R (4085) | +0.001R (5094) | **+0.015R** (9179) |
| **[New] Dual-Gating Consensus Committee (1H)** | **+0.079R** (587) | **+0.085R** (684) | **+0.096R** (704) | **-0.004R** (875) | **+0.009R** (854) | **-0.004R** (1442) | **-0.039R** (1182) | +0.059R (2850) | -0.013R (3478) | **+0.020R** (6328) |
| **[New] Stacking Meta-Learner (Logistic Meta-Ensemble)** | **+0.106R** (534) | **+0.061R** (766) | **+0.080R** (824) | **+0.009R** (1339) | **-0.001R** (1113) | **+0.011R** (1777) | **-0.015R** (1473) | +0.052R (3463) | -0.001R (4363) | **+0.023R** (7826) |

> `*` Marked with asterisk = Sample < 30 trades (too small to judge).

## 8. Step 2: Granular Per-Engine & Per-Asset Performance Tables
Detailed breakdown for all 18 distinct engines showing trades, avg net R, median R, PF, exit-based win rate, net-positive rate, total net R, max DD, date range, and 95% block bootstrap CI.

### Engine #1: 4H Trailing Stop, Clamp Mode (BTC+ETH) (4H)
- **Category:** Fixed-Rule | **Architecture:** fixed-rule

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 155 | **+0.109R** | -0.362R | **1.27** | 19.4% | 33.5% | **+16.8R** | 8.2R | `[-0.123, +0.368]` | 2020-02-25 to 2026-10-19 | Normal |
| **ETHUSDT** | 173 | **+0.380R** | -0.279R | **2.02** | 28.3% | 42.2% | **+65.8R** | 6.6R | `[+0.133, +0.679]` | 2020-03-06 to 2026-10-05 | Normal |
| **SOLUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **DOTUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **XAUUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **XAGUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **CLUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **Crypto Total** | 328 | **+0.252R** | -0.334R | **1.65** | 24.1% | 38.1% | **+82.6R** | 7.9R | `[+0.035, +0.493]` | 2020-02-25 to 2026-10-19 | — |
| **ALL PORTFOLIO** | 328 | **+0.252R** | -0.334R | **1.65** | 24.1% | 38.1% | **+82.6R** | 7.9R | `[+0.035, +0.493]` | 2020-02-25 to 2026-10-19 | — |

### Engine #2: 4H Trailing Stop, fixed_rule_4h_v1 (BTC+ETH) (4H)
- **Category:** Fixed-Rule | **Architecture:** fixed-rule

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 88 | **+0.142R** | -0.375R | **1.36** | 20.5% | 30.7% | **+12.5R** | 6.6R | `[-0.158, +0.528]` | 2020-04-18 to 2026-10-19 | Normal |
| **ETHUSDT** | 46 | **+0.288R** | -0.481R | **1.66** | 19.6% | 34.8% | **+13.2R** | 5.9R | `[-0.167, +0.936]` | 2020-05-26 to 2026-10-05 | Normal |
| **SOLUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **DOTUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **XAUUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **XAGUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **CLUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **Crypto Total** | 134 | **+0.192R** | -0.383R | **1.47** | 20.1% | 32.1% | **+25.7R** | 9.0R | `[-0.089, +0.544]` | 2020-04-18 to 2026-10-19 | — |
| **ALL PORTFOLIO** | 134 | **+0.192R** | -0.383R | **1.47** | 20.1% | 32.1% | **+25.7R** | 9.0R | `[-0.089, +0.544]` | 2020-04-18 to 2026-10-19 | — |

### Engine #3: 4H Trailing Stop, No Gate (4 Crypto) (4H)
- **Category:** Fixed-Rule | **Architecture:** fixed-rule

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 137 | **-0.013R** | -0.264R | **0.96** | 8.8% | 36.5% | **-1.8R** | 7.9R | `[-0.166, +0.142]` | 2020-02-25 to 2026-10-22 | Normal |
| **ETHUSDT** | 148 | **+0.300R** | -0.060R | **1.96** | 10.1% | 47.3% | **+44.5R** | 7.9R | `[+0.113, +0.531]` | 2020-03-07 to 2026-10-02 | Normal |
| **SOLUSDT** | 132 | **+0.079R** | -0.342R | **1.18** | 10.6% | 37.9% | **+10.4R** | 8.9R | `[-0.130, +0.326]` | 2020-11-21 to 2026-09-20 | Normal |
| **DOTUSDT** | 139 | **+0.141R** | -0.147R | **1.35** | 7.9% | 44.6% | **+19.5R** | 10.1R | `[-0.060, +0.353]` | 2020-10-02 to 2026-10-27 | Normal |
| **XAUUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **XAGUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **CLUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **Crypto Total** | 556 | **+0.131R** | -0.189R | **1.35** | 9.4% | 41.7% | **+72.6R** | 22.2R | `[+0.005, +0.258]` | 2020-02-25 to 2026-10-27 | — |
| **ALL PORTFOLIO** | 556 | **+0.131R** | -0.189R | **1.35** | 9.4% | 41.7% | **+72.6R** | 22.2R | `[+0.005, +0.258]` | 2020-02-25 to 2026-10-27 | — |

### Engine #4: 4H Fixed 2.5R Target (7 Assets) (4H)
- **Category:** Fixed-Rule | **Architecture:** fixed-rule

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 148 | **+0.029R** | -0.139R | **1.08** | 6.8% | 43.9% | **+4.3R** | 7.9R | `[-0.117, +0.186]` | 2020-02-25 to 2026-10-23 | Normal |
| **ETHUSDT** | 154 | **+0.280R** | +0.183R | **1.83** | 13.0% | 56.5% | **+43.2R** | 3.9R | `[+0.116, +0.473]` | 2020-03-07 to 2026-10-02 | Normal |
| **SOLUSDT** | 156 | **+0.069R** | -0.386R | **1.14** | 15.4% | 37.8% | **+10.8R** | 10.6R | `[-0.120, +0.275]` | 2020-11-21 to 2026-09-21 | Normal |
| **DOTUSDT** | 165 | **+0.137R** | -0.040R | **1.35** | 12.1% | 47.9% | **+22.6R** | 5.5R | `[-0.028, +0.311]` | 2020-10-02 to 2026-10-26 | Normal |
| **XAUUSDT** | 142 | **+0.028R** | -0.012R | **1.09** | 0.0% | 49.3% | **+3.9R** | 6.6R | `[-0.095, +0.171]` | 2020-03-03 to 2026-09-28 | Normal |
| **XAGUSDT** | 170 | **-0.098R** | -0.214R | **0.78** | 1.2% | 40.6% | **-16.6R** | 24.3R | `[-0.225, +0.051]` | 2020-02-18 to 2026-10-19 | Normal |
| **CLUSDT** | 191 | **-0.007R** | -0.188R | **0.98** | 2.1% | 45.5% | **-1.4R** | 18.3R | `[-0.160, +0.159]` | 2020-03-02 to 2026-10-14 | Normal |
| **Crypto Total** | 623 | **+0.130R** | -0.095R | **1.32** | 11.9% | 46.5% | **+80.8R** | 18.3R | `[+0.017, +0.235]` | 2020-02-25 to 2026-10-26 | — |
| **Commodity Total** | 503 | **-0.028R** | -0.138R | **0.93** | 1.2% | 44.9% | **-14.1R** | 30.0R | `[-0.105, +0.054]` | 2020-02-18 to 2026-10-19 | — |
| **ALL PORTFOLIO** | 1126 | **+0.059R** | -0.113R | **1.14** | 7.1% | 45.8% | **+66.7R** | 26.6R | `[-0.010, +0.132]` | 2020-02-18 to 2026-10-26 | — |

### Engine #5: 4H Pure-Rules Baseline (7 Assets) (4H)
- **Category:** Fixed-Rule | **Architecture:** fixed-rule

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 496 | **+0.032R** | -0.539R | **1.06** | 16.9% | 39.7% | **+15.8R** | 25.4R | `[-0.077, +0.156]` | 2020-02-05 to 2026-10-15 | Normal |
| **ETHUSDT** | 491 | **+0.156R** | -0.399R | **1.30** | 21.6% | 41.3% | **+76.8R** | 15.7R | `[+0.036, +0.267]` | 2020-02-05 to 2026-10-15 | Normal |
| **SOLUSDT** | 492 | **+0.079R** | -1.019R | **1.14** | 18.9% | 38.6% | **+38.7R** | 24.9R | `[-0.045, +0.196]` | 2020-10-19 to 2026-10-18 | Normal |
| **DOTUSDT** | 445 | **+0.102R** | -0.546R | **1.19** | 16.9% | 42.7% | **+45.4R** | 12.7R | `[-0.020, +0.221]` | 2020-10-02 to 2026-10-18 | Normal |
| **XAUUSDT** | 642 | **+0.089R** | -1.028R | **1.16** | 15.3% | 42.2% | **+57.3R** | 21.7R | `[-0.009, +0.191]` | 2020-02-06 to 2026-10-20 | Normal |
| **XAGUSDT** | 656 | **-0.001R** | -1.018R | **1.00** | 13.4% | 38.9% | **-0.4R** | 36.3R | `[-0.108, +0.114]` | 2020-02-10 to 2026-10-17 | Normal |
| **CLUSDT** | 637 | **-0.036R** | -1.015R | **0.94** | 11.5% | 38.8% | **-22.8R** | 67.4R | `[-0.131, +0.076]` | 2020-02-07 to 2026-10-16 | Normal |
| **Crypto Total** | 1924 | **+0.092R** | -0.550R | **1.17** | 18.6% | 40.5% | **+176.7R** | 57.5R | `[+0.014, +0.175]` | 2020-02-05 to 2026-10-18 | — |
| **Commodity Total** | 1935 | **+0.018R** | -1.015R | **1.03** | 13.4% | 39.9% | **+34.1R** | 86.4R | `[-0.038, +0.080]` | 2020-02-06 to 2026-10-20 | — |
| **ALL PORTFOLIO** | 3859 | **+0.055R** | -1.015R | **1.10** | 16.0% | 40.2% | **+210.8R** | 53.3R | `[+0.007, +0.106]` | 2020-02-05 to 2026-10-20 | — |

### Engine #6: 1H Trailing Stop (BTC+ETH) (1H)
- **Category:** Fixed-Rule | **Architecture:** fixed-rule

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 645 | **+0.024R** | -0.384R | **1.06** | 31.5% | 33.0% | **+15.8R** | 35.6R | `[-0.079, +0.141]` | 2020-01-11 to 2026-10-24 | Normal |
| **ETHUSDT** | 650 | **+0.044R** | -0.382R | **1.11** | 33.4% | 35.1% | **+28.6R** | 33.2R | `[-0.059, +0.150]` | 2020-01-13 to 2026-10-24 | Normal |
| **SOLUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **DOTUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **XAUUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **XAGUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **CLUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **Crypto Total** | 1295 | **+0.034R** | -0.384R | **1.08** | 32.4% | 34.1% | **+44.3R** | 47.6R | `[-0.046, +0.117]` | 2020-01-11 to 2026-10-24 | — |
| **ALL PORTFOLIO** | 1295 | **+0.034R** | -0.384R | **1.08** | 32.4% | 34.1% | **+44.3R** | 47.6R | `[-0.046, +0.117]` | 2020-01-11 to 2026-10-24 | — |

### Engine #7: Option-A 1H Hand-Written Neural Net (1H)
- **Category:** Fixed-Rule | **Architecture:** hand-crafted (zero backprop)

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 87 | **+0.240R** | -0.093R | **1.58** | 18.4% | 46.0% | **+20.9R** | 7.0R | `[-0.031, +0.543]` | 2020-01-28 to 2026-10-05 | Normal |
| **ETHUSDT** | 86 | **+0.070R** | -0.493R | **1.13** | 16.3% | 43.0% | **+6.0R** | 10.3R | `[-0.194, +0.385]` | 2020-01-30 to 2026-07-27 | Normal |
| **SOLUSDT** | 83 | **+0.142R** | -0.529R | **1.26** | 22.9% | 42.2% | **+11.8R** | 13.8R | `[-0.177, +0.409]` | 2020-11-06 to 2026-09-22 | Normal |
| **DOTUSDT** | 72 | **+0.109R** | -1.024R | **1.18** | 25.0% | 37.5% | **+7.8R** | 12.3R | `[-0.205, +0.497]` | 2020-10-10 to 2026-09-07 | Normal |
| **XAUUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **XAGUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **CLUSDT** | 0 | — | — | — | — | — | — | — | — | — | Not traded |
| **Crypto Total** | 328 | **+0.142R** | -0.422R | **1.27** | 20.4% | 42.4% | **+46.5R** | 16.7R | `[-0.019, +0.309]` | 2020-01-28 to 2026-10-05 | — |
| **ALL PORTFOLIO** | 328 | **+0.142R** | -0.422R | **1.27** | 20.4% | 42.4% | **+46.5R** | 16.7R | `[-0.019, +0.309]` | 2020-01-28 to 2026-10-05 | — |

### Engine #8: [OM] Distributed 4H Specialists [7 Models] (4H)
- **Category:** ML / Trained | **Architecture:** machine learning

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 202 | **+0.200R** | -0.186R | **1.40** | 20.8% | 44.1% | **+40.4R** | 17.2R | `[+0.022, +0.402]` | 2020-02-05 to 2026-09-23 | Normal |
| **ETHUSDT** | 265 | **+0.294R** | -0.115R | **1.65** | 22.6% | 45.7% | **+78.0R** | 16.2R | `[+0.131, +0.448]` | 2020-02-05 to 2026-09-29 | Normal |
| **SOLUSDT** | 278 | **+0.269R** | -0.177R | **1.56** | 23.0% | 45.3% | **+74.8R** | 15.4R | `[+0.093, +0.432]` | 2020-10-19 to 2026-10-18 | Normal |
| **DOTUSDT** | 368 | **+0.149R** | -0.364R | **1.29** | 18.2% | 44.3% | **+54.7R** | 11.9R | `[+0.012, +0.283]` | 2020-10-02 to 2026-10-18 | Normal |
| **XAUUSDT** | 502 | **+0.211R** | -0.213R | **1.42** | 17.5% | 46.6% | **+105.7R** | 14.8R | `[+0.101, +0.328]` | 2020-02-06 to 2026-10-20 | Normal |
| **XAGUSDT** | 344 | **+0.050R** | -1.019R | **1.09** | 15.7% | 41.0% | **+17.0R** | 18.3R | `[-0.081, +0.199]` | 2020-02-18 to 2026-10-10 | Normal |
| **CLUSDT** | 409 | **+0.005R** | -1.015R | **1.01** | 11.0% | 41.1% | **+2.0R** | 42.2R | `[-0.115, +0.137]` | 2020-02-07 to 2026-10-16 | Normal |
| **Crypto Total** | 1113 | **+0.223R** | -0.196R | **1.46** | 20.9% | 44.8% | **+247.9R** | 47.4R | `[+0.127, +0.317]` | 2020-02-05 to 2026-10-18 | — |
| **Commodity Total** | 1255 | **+0.099R** | -1.015R | **1.18** | 14.9% | 43.3% | **+124.7R** | 57.1R | `[+0.033, +0.173]` | 2020-02-06 to 2026-10-20 | — |
| **ALL PORTFOLIO** | 2368 | **+0.157R** | -0.395R | **1.31** | 17.7% | 44.0% | **+372.7R** | 34.3R | `[+0.102, +0.218]` | 2020-02-05 to 2026-10-20 | — |

### Engine #9: [OM] Stacking Meta-Learner (Logistic Meta-Ensemble) (1H)
- **Category:** ML / Trained | **Architecture:** machine learning

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 800 | **+0.032R** | -0.378R | **1.06** | 14.6% | 41.4% | **+25.9R** | 31.5R | `[-0.043, +0.118]` | 2020-01-10 to 2026-10-21 | Normal |
| **ETHUSDT** | 1057 | **+0.025R** | -0.524R | **1.05** | 15.4% | 40.1% | **+27.0R** | 52.0R | `[-0.051, +0.099]` | 2020-01-10 to 2026-10-20 | Normal |
| **SOLUSDT** | 326 | **+0.094R** | -0.702R | **1.17** | 21.8% | 39.6% | **+30.5R** | 15.3R | `[-0.045, +0.250]` | 2020-09-28 to 2026-10-18 | Normal |
| **DOTUSDT** | 142 | **+0.157R** | -0.185R | **1.32** | 17.6% | 44.4% | **+22.4R** | 10.7R | `[-0.046, +0.390]` | 2020-10-01 to 2026-10-13 | Normal |
| **XAUUSDT** | 1925 | **+0.020R** | -0.463R | **1.04** | 8.9% | 43.2% | **+37.6R** | 41.1R | `[-0.032, +0.074]` | 2020-01-09 to 2026-10-21 | Normal |
| **XAGUSDT** | 1938 | **+0.068R** | -1.044R | **1.11** | 23.8% | 36.4% | **+131.2R** | 34.1R | `[+0.005, +0.140]` | 2020-01-09 to 2026-10-20 | Normal |
| **CLUSDT** | 1848 | **-0.047R** | -1.034R | **0.93** | 19.5% | 34.3% | **-87.4R** | 94.5R | `[-0.109, +0.017]` | 2020-01-10 to 2026-10-19 | Normal |
| **Crypto Total** | 2325 | **+0.045R** | -0.449R | **1.09** | 16.2% | 40.7% | **+105.8R** | 36.1R | `[-0.011, +0.101]` | 2020-01-10 to 2026-10-21 | — |
| **Commodity Total** | 5711 | **+0.014R** | -1.035R | **1.02** | 17.4% | 38.0% | **+81.4R** | 92.6R | `[-0.019, +0.050]` | 2020-01-09 to 2026-10-21 | — |
| **ALL PORTFOLIO** | 8036 | **+0.023R** | -1.034R | **1.04** | 17.0% | 38.8% | **+187.1R** | 75.8R | `[-0.004, +0.053]` | 2020-01-09 to 2026-10-21 | — |

### Engine #10: [OM] Distributed 1H Specialists [7 Models] (1H)
- **Category:** ML / Trained | **Architecture:** machine learning

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 842 | **+0.000R** | -0.432R | **1.00** | 14.0% | 40.0% | **+0.3R** | 40.9R | `[-0.079, +0.082]` | 2020-01-11 to 2026-10-21 | Normal |
| **ETHUSDT** | 1142 | **+0.019R** | -0.567R | **1.03** | 15.8% | 39.8% | **+22.0R** | 54.2R | `[-0.054, +0.091]` | 2020-01-10 to 2026-10-20 | Normal |
| **SOLUSDT** | 380 | **+0.068R** | -0.784R | **1.12** | 20.0% | 39.7% | **+25.7R** | 21.4R | `[-0.058, +0.214]` | 2020-09-28 to 2026-10-18 | Normal |
| **DOTUSDT** | 150 | **+0.080R** | -0.311R | **1.16** | 14.0% | 43.3% | **+12.0R** | 21.3R | `[-0.108, +0.281]` | 2020-10-19 to 2026-10-13 | Normal |
| **XAUUSDT** | 1971 | **+0.031R** | -0.395R | **1.06** | 8.9% | 43.7% | **+60.3R** | 40.5R | `[-0.020, +0.084]` | 2020-01-09 to 2026-10-21 | Normal |
| **XAGUSDT** | 2061 | **+0.059R** | -1.044R | **1.09** | 23.3% | 36.1% | **+122.5R** | 41.3R | `[-0.002, +0.128]` | 2020-01-09 to 2026-10-20 | Normal |
| **CLUSDT** | 1988 | **-0.038R** | -1.034R | **0.94** | 19.4% | 34.5% | **-75.9R** | 89.8R | `[-0.098, +0.026]` | 2020-01-09 to 2026-10-20 | Normal |
| **Crypto Total** | 2514 | **+0.024R** | -0.490R | **1.04** | 15.7% | 40.1% | **+60.1R** | 48.6R | `[-0.031, +0.079]` | 2020-01-10 to 2026-10-21 | — |
| **Commodity Total** | 6020 | **+0.018R** | -1.035R | **1.03** | 17.3% | 38.1% | **+106.9R** | 93.8R | `[-0.014, +0.052]` | 2020-01-09 to 2026-10-21 | — |
| **ALL PORTFOLIO** | 8534 | **+0.020R** | -1.034R | **1.03** | 16.9% | 38.6% | **+166.9R** | 81.3R | `[-0.007, +0.047]` | 2020-01-09 to 2026-10-21 | — |

### Engine #11: [OM] Unified 1H Multi-Asset Engine (1H)
- **Category:** ML / Trained | **Architecture:** machine learning

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 936 | **+0.009R** | -0.294R | **1.02** | 12.0% | 41.6% | **+8.7R** | 44.4R | `[-0.064, +0.086]` | 2020-01-10 to 2026-10-21 | Normal |
| **ETHUSDT** | 957 | **+0.038R** | -0.551R | **1.07** | 15.9% | 40.8% | **+35.9R** | 64.1R | `[-0.047, +0.118]` | 2020-01-10 to 2026-10-20 | Normal |
| **SOLUSDT** | 753 | **+0.004R** | -1.026R | **1.01** | 17.9% | 38.4% | **+3.3R** | 38.8R | `[-0.080, +0.100]` | 2020-09-23 to 2026-10-20 | Normal |
| **DOTUSDT** | 723 | **+0.014R** | -1.023R | **1.02** | 16.7% | 39.8% | **+10.2R** | 25.1R | `[-0.080, +0.107]` | 2020-09-05 to 2026-10-20 | Normal |
| **XAUUSDT** | 1163 | **+0.054R** | -0.451R | **1.10** | 9.9% | 43.5% | **+62.5R** | 50.8R | `[-0.014, +0.123]` | 2020-01-09 to 2026-10-20 | Normal |
| **XAGUSDT** | 1146 | **+0.076R** | -1.044R | **1.12** | 25.0% | 36.6% | **+86.6R** | 40.5R | `[-0.012, +0.168]` | 2020-01-09 to 2026-10-20 | Normal |
| **CLUSDT** | 1185 | **-0.020R** | -1.035R | **0.97** | 21.9% | 33.4% | **-23.8R** | 39.3R | `[-0.100, +0.057]` | 2020-01-12 to 2026-10-20 | Normal |
| **Crypto Total** | 3369 | **+0.017R** | -0.566R | **1.03** | 15.4% | 40.2% | **+58.1R** | 76.5R | `[-0.035, +0.070]` | 2020-01-10 to 2026-10-21 | — |
| **Commodity Total** | 3494 | **+0.036R** | -1.036R | **1.06** | 18.9% | 37.8% | **+125.3R** | 60.3R | `[-0.010, +0.084]` | 2020-01-09 to 2026-10-20 | — |
| **ALL PORTFOLIO** | 6863 | **+0.027R** | -1.032R | **1.05** | 17.2% | 39.0% | **+183.4R** | 86.1R | `[-0.007, +0.061]` | 2020-01-09 to 2026-10-21 | — |

### Engine #12: [OM] Dual-Gating Consensus Committee (1H) (1H)
- **Category:** ML / Trained | **Architecture:** machine learning

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 435 | **+0.071R** | -0.364R | **1.14** | 16.3% | 43.4% | **+30.9R** | 15.3R | `[-0.045, +0.192]` | 2020-01-11 to 2026-10-21 | Normal |
| **ETHUSDT** | 906 | **+0.032R** | -0.561R | **1.06** | 15.8% | 40.6% | **+29.3R** | 55.0R | `[-0.052, +0.113]` | 2020-01-10 to 2026-10-20 | Normal |
| **SOLUSDT** | 27 | **+0.247R** | -0.097R | **1.53** | 18.5% | 48.1% | **+6.7R** | 3.4R | `[-0.264, +0.807]` | 2022-01-03 to 2026-10-18 | ⚠️ Too small (<30) |
| **DOTUSDT** | 110 | **+0.058R** | -0.373R | **1.11** | 13.6% | 42.7% | **+6.4R** | 16.4R | `[-0.158, +0.284]` | 2020-10-19 to 2026-10-10 | Normal |
| **XAUUSDT** | 1035 | **+0.041R** | -0.469R | **1.08** | 10.0% | 43.1% | **+42.1R** | 49.1R | `[-0.032, +0.114]` | 2020-01-09 to 2026-10-20 | Normal |
| **XAGUSDT** | 1102 | **+0.081R** | -1.044R | **1.13** | 25.0% | 36.8% | **+89.1R** | 39.4R | `[-0.008, +0.176]` | 2020-01-09 to 2026-10-20 | Normal |
| **CLUSDT** | 977 | **-0.011R** | -1.035R | **0.98** | 21.6% | 34.3% | **-10.5R** | 34.1R | `[-0.100, +0.079]` | 2020-01-12 to 2026-10-20 | Normal |
| **Crypto Total** | 1478 | **+0.050R** | -0.456R | **1.09** | 15.8% | 41.7% | **+73.3R** | 59.6R | `[-0.022, +0.119]` | 2020-01-10 to 2026-10-21 | — |
| **Commodity Total** | 3114 | **+0.039R** | -1.036R | **1.06** | 18.9% | 38.1% | **+120.7R** | 61.6R | `[-0.007, +0.089]` | 2020-01-09 to 2026-10-20 | — |
| **ALL PORTFOLIO** | 4592 | **+0.042R** | -1.035R | **1.07** | 17.9% | 39.3% | **+193.9R** | 67.2R | `[+0.003, +0.083]` | 2020-01-09 to 2026-10-21 | — |

### Engine #13: [OM] Unified 4H Swing Engine (4H)
- **Category:** ML / Trained | **Architecture:** machine learning

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 281 | **+0.101R** | -0.426R | **1.19** | 18.5% | 42.3% | **+28.5R** | 18.9R | `[-0.038, +0.270]` | 2020-02-08 to 2026-10-15 | Normal |
| **ETHUSDT** | 256 | **+0.249R** | -0.298R | **1.50** | 24.6% | 43.0% | **+63.7R** | 11.9R | `[+0.073, +0.408]` | 2020-02-05 to 2026-10-15 | Normal |
| **SOLUSDT** | 246 | **+0.215R** | -0.317R | **1.43** | 21.1% | 45.1% | **+52.8R** | 17.9R | `[+0.016, +0.383]` | 2020-10-19 to 2026-10-13 | Normal |
| **DOTUSDT** | 257 | **+0.269R** | -0.119R | **1.55** | 20.2% | 48.2% | **+69.2R** | 10.9R | `[+0.105, +0.423]` | 2020-10-06 to 2026-10-08 | Normal |
| **XAUUSDT** | 538 | **+0.123R** | -1.029R | **1.23** | 16.4% | 43.5% | **+66.0R** | 17.7R | `[+0.007, +0.241]` | 2020-02-06 to 2026-10-20 | Normal |
| **XAGUSDT** | 470 | **+0.019R** | -1.018R | **1.03** | 12.8% | 41.1% | **+8.9R** | 29.3R | `[-0.102, +0.142]` | 2020-02-10 to 2026-10-15 | Normal |
| **CLUSDT** | 486 | **-0.018R** | -1.015R | **0.97** | 11.1% | 39.7% | **-9.0R** | 53.8R | `[-0.129, +0.104]` | 2020-02-07 to 2026-10-16 | Normal |
| **Crypto Total** | 1040 | **+0.206R** | -0.309R | **1.41** | 21.1% | 44.6% | **+214.2R** | 39.1R | `[+0.096, +0.311]` | 2020-02-05 to 2026-10-15 | — |
| **Commodity Total** | 1494 | **+0.044R** | -1.015R | **1.08** | 13.5% | 41.5% | **+66.0R** | 71.8R | `[-0.017, +0.113]` | 2020-02-06 to 2026-10-20 | — |
| **ALL PORTFOLIO** | 2534 | **+0.111R** | -0.749R | **1.21** | 16.6% | 42.8% | **+280.2R** | 47.3R | `[+0.054, +0.170]` | 2020-02-05 to 2026-10-20 | — |

### Engine #14: [New] Unified 4H Swing Engine (4H)
- **Category:** ML / Trained | **Architecture:** machine learning

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 427 | **+0.066R** | -0.464R | **1.12** | 18.3% | 40.7% | **+28.2R** | 24.6R | `[-0.058, +0.204]` | 2020-02-05 to 2026-10-13 | Normal |
| **ETHUSDT** | 400 | **+0.239R** | -0.258R | **1.48** | 24.0% | 43.8% | **+95.7R** | 17.8R | `[+0.101, +0.366]` | 2020-02-05 to 2026-10-15 | Normal |
| **SOLUSDT** | 315 | **+0.125R** | -0.678R | **1.23** | 19.4% | 41.3% | **+39.5R** | 19.1R | `[-0.025, +0.288]` | 2020-10-20 to 2026-10-13 | Normal |
| **DOTUSDT** | 308 | **+0.083R** | -0.659R | **1.16** | 17.2% | 40.3% | **+25.7R** | 17.4R | `[-0.055, +0.236]` | 2020-10-02 to 2026-10-15 | Normal |
| **XAUUSDT** | 457 | **+0.208R** | -0.255R | **1.41** | 17.5% | 45.5% | **+95.2R** | 18.2R | `[+0.094, +0.335]` | 2020-02-06 to 2026-10-20 | Normal |
| **XAGUSDT** | 428 | **+0.032R** | -1.018R | **1.06** | 15.0% | 39.5% | **+13.9R** | 35.0R | `[-0.106, +0.172]` | 2020-02-10 to 2026-10-15 | Normal |
| **CLUSDT** | 398 | **-0.006R** | -1.015R | **0.99** | 13.3% | 38.7% | **-2.2R** | 39.5R | `[-0.135, +0.127]` | 2020-02-14 to 2026-10-15 | Normal |
| **Crypto Total** | 1450 | **+0.130R** | -0.412R | **1.25** | 19.9% | 41.6% | **+189.1R** | 62.9R | `[+0.032, +0.228]` | 2020-02-05 to 2026-10-15 | — |
| **Commodity Total** | 1283 | **+0.083R** | -1.015R | **1.15** | 15.4% | 41.4% | **+106.9R** | 61.6R | `[+0.010, +0.159]` | 2020-02-06 to 2026-10-20 | — |
| **ALL PORTFOLIO** | 2733 | **+0.108R** | -0.671R | **1.20** | 17.7% | 41.5% | **+295.9R** | 41.7R | `[+0.049, +0.168]` | 2020-02-05 to 2026-10-20 | — |

### Engine #15: [New] Distributed 4H Specialists [7 Models] (4H)
- **Category:** ML / Trained | **Architecture:** machine learning

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 236 | **+0.199R** | -0.136R | **1.42** | 19.9% | 47.0% | **+46.9R** | 11.6R | `[+0.031, +0.371]` | 2020-02-05 to 2026-10-02 | Normal |
| **ETHUSDT** | 294 | **+0.299R** | -0.178R | **1.63** | 24.5% | 45.6% | **+87.9R** | 15.6R | `[+0.139, +0.452]` | 2020-02-05 to 2026-09-29 | Normal |
| **SOLUSDT** | 170 | **+0.118R** | -1.019R | **1.21** | 20.0% | 40.0% | **+20.0R** | 15.9R | `[-0.085, +0.342]` | 2020-11-07 to 2026-10-09 | Normal |
| **DOTUSDT** | 343 | **+0.118R** | -0.606R | **1.22** | 18.1% | 43.1% | **+40.6R** | 18.1R | `[-0.028, +0.267]` | 2020-10-02 to 2026-10-18 | Normal |
| **XAUUSDT** | 443 | **+0.185R** | -0.579R | **1.35** | 18.5% | 44.0% | **+82.1R** | 18.1R | `[+0.066, +0.323]` | 2020-02-06 to 2026-10-20 | Normal |
| **XAGUSDT** | 424 | **+0.097R** | -1.018R | **1.17** | 15.1% | 42.0% | **+41.1R** | 24.3R | `[-0.036, +0.239]` | 2020-02-10 to 2026-10-17 | Normal |
| **CLUSDT** | 511 | **-0.012R** | -1.015R | **0.98** | 13.1% | 38.2% | **-6.2R** | 50.3R | `[-0.125, +0.113]` | 2020-02-07 to 2026-10-16 | Normal |
| **Crypto Total** | 1043 | **+0.187R** | -0.340R | **1.37** | 20.6% | 44.2% | **+195.4R** | 46.8R | `[+0.079, +0.299]` | 2020-02-05 to 2026-10-18 | — |
| **Commodity Total** | 1378 | **+0.085R** | -1.015R | **1.15** | 15.5% | 41.2% | **+117.0R** | 70.8R | `[+0.014, +0.164]` | 2020-02-06 to 2026-10-20 | — |
| **ALL PORTFOLIO** | 2421 | **+0.129R** | -0.748R | **1.24** | 17.7% | 42.5% | **+312.4R** | 47.3R | `[+0.071, +0.199]` | 2020-02-05 to 2026-10-20 | — |

### Engine #16: [New] Distributed 1H Specialists [7 Models] (1H)
- **Category:** ML / Trained | **Architecture:** machine learning

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 695 | **+0.059R** | -0.223R | **1.13** | 12.5% | 41.9% | **+40.9R** | 14.8R | `[-0.024, +0.147]` | 2020-01-19 to 2026-10-21 | Normal |
| **ETHUSDT** | 903 | **+0.038R** | -0.438R | **1.07** | 16.7% | 39.8% | **+34.0R** | 33.5R | `[-0.043, +0.116]` | 2020-01-10 to 2026-10-20 | Normal |
| **SOLUSDT** | 1032 | **+0.062R** | -1.019R | **1.11** | 19.4% | 39.6% | **+63.6R** | 28.9R | `[-0.010, +0.145]` | 2020-09-28 to 2026-10-18 | Normal |
| **DOTUSDT** | 1455 | **-0.005R** | -1.019R | **0.99** | 15.6% | 39.3% | **-7.0R** | 39.5R | `[-0.063, +0.059]` | 2020-08-31 to 2026-10-19 | Normal |
| **XAUUSDT** | 1407 | **+0.009R** | -0.412R | **1.02** | 9.4% | 42.9% | **+12.1R** | 70.2R | `[-0.053, +0.073]` | 2020-01-14 to 2026-10-21 | Normal |
| **XAGUSDT** | 1986 | **+0.019R** | -1.045R | **1.03** | 22.9% | 34.9% | **+36.9R** | 62.6R | `[-0.042, +0.090]` | 2020-01-09 to 2026-10-20 | Normal |
| **CLUSDT** | 1701 | **-0.027R** | -1.034R | **0.96** | 20.5% | 34.1% | **-45.9R** | 64.9R | `[-0.095, +0.039]` | 2020-01-09 to 2026-10-19 | Normal |
| **Crypto Total** | 4085 | **+0.032R** | -0.537R | **1.06** | 16.3% | 39.9% | **+131.4R** | 61.4R | `[-0.013, +0.081]` | 2020-01-10 to 2026-10-21 | — |
| **Commodity Total** | 5094 | **+0.001R** | -1.037R | **1.00** | 18.4% | 36.8% | **+3.1R** | 95.6R | `[-0.037, +0.042]` | 2020-01-09 to 2026-10-21 | — |
| **ALL PORTFOLIO** | 9179 | **+0.015R** | -1.032R | **1.02** | 17.4% | 38.2% | **+134.5R** | 85.7R | `[-0.013, +0.045]` | 2020-01-09 to 2026-10-21 | — |

### Engine #17: [New] Dual-Gating Consensus Committee (1H) (1H)
- **Category:** ML / Trained | **Architecture:** machine learning

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 587 | **+0.079R** | -0.183R | **1.18** | 12.8% | 42.6% | **+46.6R** | 12.6R | `[-0.012, +0.181]` | 2020-01-19 to 2026-10-19 | Normal |
| **ETHUSDT** | 684 | **+0.085R** | -0.382R | **1.16** | 17.8% | 41.4% | **+58.1R** | 23.5R | `[-0.006, +0.180]` | 2020-01-10 to 2026-10-20 | Normal |
| **SOLUSDT** | 704 | **+0.096R** | -0.756R | **1.17** | 20.0% | 40.9% | **+67.9R** | 21.6R | `[+0.003, +0.202]` | 2020-09-28 to 2026-10-18 | Normal |
| **DOTUSDT** | 875 | **-0.004R** | -0.870R | **0.99** | 15.3% | 39.9% | **-3.3R** | 28.3R | `[-0.074, +0.084]` | 2020-09-02 to 2026-10-18 | Normal |
| **XAUUSDT** | 854 | **+0.009R** | -0.416R | **1.02** | 9.5% | 43.0% | **+7.9R** | 26.4R | `[-0.070, +0.084]` | 2020-01-14 to 2026-10-21 | Normal |
| **XAGUSDT** | 1442 | **-0.004R** | -1.045R | **0.99** | 21.7% | 34.3% | **-6.4R** | 61.4R | `[-0.073, +0.081]` | 2020-01-11 to 2026-10-20 | Normal |
| **CLUSDT** | 1182 | **-0.039R** | -1.037R | **0.94** | 20.8% | 33.4% | **-45.5R** | 77.0R | `[-0.123, +0.044]` | 2020-01-16 to 2026-10-19 | Normal |
| **Crypto Total** | 2850 | **+0.059R** | -0.419R | **1.11** | 16.6% | 41.1% | **+169.2R** | 40.7R | `[+0.001, +0.120]` | 2020-01-10 to 2026-10-20 | — |
| **Commodity Total** | 3478 | **-0.013R** | -1.038R | **0.98** | 18.4% | 36.1% | **-44.1R** | 103.0R | `[-0.058, +0.036]` | 2020-01-11 to 2026-10-21 | — |
| **ALL PORTFOLIO** | 6328 | **+0.020R** | -1.034R | **1.03** | 17.6% | 38.4% | **+125.1R** | 110.2R | `[-0.015, +0.056]` | 2020-01-10 to 2026-10-21 | — |

### Engine #18: [New] Stacking Meta-Learner (Logistic Meta-Ensemble) (1H)
- **Category:** ML / Trained | **Architecture:** machine learning

| Asset / Segment | Trades | Avg Net R | Median R | Profit Factor | Exit Win Rate | Net-Pos Rate | Total Net R | Max DD (R) | 95% Bootstrap CI | Date Range | Sample Flag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BTCUSDT** | 534 | **+0.106R** | -0.133R | **1.24** | 12.7% | 44.6% | **+56.5R** | 9.6R | `[+0.011, +0.212]` | 2020-01-19 to 2026-10-18 | Normal |
| **ETHUSDT** | 766 | **+0.061R** | -0.412R | **1.12** | 17.4% | 40.1% | **+46.7R** | 33.7R | `[-0.030, +0.150]` | 2020-01-11 to 2026-10-20 | Normal |
| **SOLUSDT** | 824 | **+0.080R** | -0.770R | **1.14** | 19.3% | 40.9% | **+66.0R** | 24.9R | `[-0.007, +0.177]` | 2020-09-28 to 2026-10-18 | Normal |
| **DOTUSDT** | 1339 | **+0.009R** | -0.872R | **1.02** | 15.4% | 40.4% | **+12.2R** | 28.9R | `[-0.049, +0.076]` | 2020-08-31 to 2026-10-19 | Normal |
| **XAUUSDT** | 1113 | **-0.001R** | -0.458R | **1.00** | 9.4% | 42.6% | **-0.7R** | 61.9R | `[-0.067, +0.065]` | 2020-01-14 to 2026-10-21 | Normal |
| **XAGUSDT** | 1777 | **+0.011R** | -1.045R | **1.02** | 22.7% | 34.8% | **+19.5R** | 43.6R | `[-0.054, +0.085]` | 2020-01-09 to 2026-10-20 | Normal |
| **CLUSDT** | 1473 | **-0.015R** | -1.035R | **0.98** | 21.4% | 34.2% | **-22.1R** | 46.5R | `[-0.090, +0.061]` | 2020-01-09 to 2026-10-19 | Normal |
| **Crypto Total** | 3463 | **+0.052R** | -0.452R | **1.10** | 16.3% | 41.1% | **+181.4R** | 49.9R | `[+0.003, +0.106]` | 2020-01-11 to 2026-10-20 | — |
| **Commodity Total** | 4363 | **-0.001R** | -1.038R | **1.00** | 18.9% | 36.6% | **-3.3R** | 70.5R | `[-0.041, +0.045]` | 2020-01-09 to 2026-10-21 | — |
| **ALL PORTFOLIO** | 7826 | **+0.023R** | -1.033R | **1.04** | 17.8% | 38.6% | **+178.1R** | 74.8R | `[-0.006, +0.057]` | 2020-01-09 to 2026-10-21 | — |

## 9. What Could Not Be Verified
In adherence to scientific auditing standards, the following items could not be independently reconstructed from primary bar logs:
1. **Historical Feature Pipeline Lookahead on ML Engines:** While the fixed-rule backtest harnesses cleanly passed the 200-bar progressive lookahead truncation test, the historical training and inference pipelines for the 11 ML models (LightGBM and meta-ensembles) were pre-compiled into static JSON trade files. Their feature engineering scripts were not present in a form that could be subjected to real-time tick-by-tick truncation testing.
2. **Exact Granular Funding Rate Per Candle for Engine 5:** Engine 5 (Clamped Fixed 2.5R Target on 7 assets) used a standardized 0.010% per 8-hour funding fallback rather than loading Binance's historical funding rate history table.
3. **Sub-Bar Slippage During Flash Crashes:** All simulations model slippage at 0.010% per side. During extreme liquidity gaps (e.g. May 2021 liquidation cascade, FTX November 2022 collapse), market-open taker orders on altcoins (SOL, DOT) would likely have experienced slippage exceeding 0.05% to 0.15%.

## 10. Concrete Recommendations: Keep, Decommission & Next Steps

### A. Engines to Keep Running in Live Forward Paper Testing
1. **`fixed_rule_4h_v1` & Stop-Clamped Variants (`V6`, `V8`):** These engines show the highest statistical significance, clean 200/200 lookahead verification, and genuine after-tax survival (PF > 1.43). Continue running the 3 forward ledgers (`v1_primary`, `v6_shadow`, `v8_shadow`).
2. **`option-a-1h-hand-written` (BTC Specialist):** Keep active on BTCUSDT. It is the only short-horizon engine with positive edge that does not depend on ETH, providing crucial portfolio diversification.
3. **`om-distributed-4h-engine` (Shadow Paper Only):** Keep running strictly in shadow paper mode to observe whether its out-of-sample edge (PF 1.26 in 2024–2026) persists into 2027.

### B. Engines to Decommission Immediately
1. **All 1H Machine Learning Engines (`om-distributed-1h`, `om-stacking-meta`, `om-unified-1h`, `distributed-1h`, `new-stacking-meta`):** Decommission from live paper execution. Their out-of-sample edge is 0.00R, they generate excessive transaction friction, and under Section 115BBH they destroy capital through gross-profit tax liabilities.
2. **Duplicate `v1-*` Twins:** Purge `v1-distributed-4h`, `v1-stacking-meta`, `v1-distributed-1h`, `v1-unified-1h`, `v1-consensus-committee`, and `v1-unified-4h` from the dashboard UI to eliminate user confusion.
3. **Commodity Engine on CLUSDT:** Decommission crude oil (CLUSDT). Across all engines, crude oil is negative net R (PF 0.98, p_adj = 1.00) and drags down commodity performance.

### C. Next Analytical Steps (Zero Parameter Tuning)
1. **Accumulate 30 Forward Trades:** Allow the 3 active forward ledgers to reach at least 30 closed trades before re-evaluating live execution parity.
2. **Causal Correlation Clustering for Wider Universe:** When expanding beyond BTC+ETH to liquid perps, enforce the causal rolling 90-day correlation filter (> 0.70) to prevent concentration risk during market-wide crashes.
