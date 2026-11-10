# Wider Universe Portfolio Backtest & Forward Paper Trading Report

**Date:** 2026-11-10  
**Branch:** `feat/wider-universe`  
**Baseline Engine:** `fixed_rule_4h_v1` (Frozen, 0 ML, deterministic rule-based)  
**Evaluation Window:** 2022-01-01 to 2026-10-31 (58 calendar months)  
**Pre-Registration File:** `docs/prereg/wider_universe.md` (Committed at SHA `a317b6e` prior to running backtests)

---

## 1. Master Summary Table

| Universe | N Trades | Total R/month (95% Bootstrap CI) | PF | Max DD (INR / %) | After-Tax PnL (INR) | Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **DESIGN** (BTC, ETH) | 124 | +0.578 R `[-0.063, +1.414]` | 1.72 | ₹534 (7.1%) | ₹+660.38 | **FAIL** (CI includes zero) |
| **SEEN** (SOL, DOT, XAU, XAG, CL) | 208 | +0.028 R `[-0.620, +0.693]` | 1.02 | ₹1,355 (19.2%) | ₹-1,998.52 | **FAIL** |
| **UNTOUCHED** (BNB, XRP, ADA, AVAX, LINK, DOGE, NEAR) | 163 | +0.742 R `[-0.400, +2.231]` | 1.61 | ₹1,232 (11.3%) | ₹+637.20 | **FAIL** (CI includes zero) |
| **ALL** (14 Assets Combined) | 424 | +0.962 R `[-0.582, +2.777]` | 1.29 | ₹1,550 (14.3%) | ₹-1,254.03 | **FAIL** |

*Full History Reference (2020–2026, 82 months, where available):*
- **DESIGN (BTC, ETH):** 148 trades, Total R/mo +0.591 `[+0.088, +1.227]`, PF 1.84, Max DD ₹534 (6.2%), After-Tax PnL ₹+1,163.38. (Passes only when including the 2020-2021 bull run).
- **SEEN (5 assets):** 285 trades, Total R/mo -0.082 `[-0.554, +0.429]`, PF 0.95, Max DD ₹2,057 (28.6%), After-Tax PnL ₹-3,126.29.
- **UNTOUCHED (7 assets):** 178 trades, Total R/mo +0.500 `[-0.289, +1.575]`, PF 1.54, Max DD ₹1,232 (11.4%), After-Tax PnL ₹+418.57.
- **ALL (14 assets):** 538 trades, Total R/mo +0.749 `[-0.344, +2.136]`, PF 1.26, Max DD ₹1,550 (13.8%), After-Tax PnL ₹-2,025.39.

---

## 2. Plain-English Verdict

### **VERDICT: FAIL**

The frozen fixed-rule 4H trend engine **FAILS the pre-registered generalization criteria on the UNTOUCHED universe**.

### Why UNTOUCHED Failed:
1. **Bootstrap Confidence Interval Spans Zero:**
   The pre-registered gating criterion required the 95% bootstrap confidence interval of mean monthly net-R to strictly exclude zero ($CI_{\text{lower}} > 0$).
   The observed 95% CI is `[-0.400, +2.231]`. Because the lower bound is deeply negative, we **cannot reject the null hypothesis of zero edge**.
2. **Extreme Single-Asset Concentration (The DOGE Illusion):**
   Inspection of the 7 individual untouched assets reveals that the positive pre-tax PnL was almost entirely driven by a single asset: **DOGEUSDT** (+₹2,661.72 pre-tax, PF 4.86).
   The remaining 6 untouched assets completely failed to perform:
   - **XRPUSDT:** Catastrophic failure (PF 0.47, -0.160 R/mo, After-tax PnL -₹824.01).
   - **BNBUSDT:** Zero edge (PF 1.00, -0.002 R/mo, After-tax PnL -₹477.61).
   - **ADAUSDT:** Pre-tax +₹246.80, but Indian Section 115BBH flat 30% tax on gross wins converts it to an after-tax **loss** of -₹90.35.
   - **AVAXUSDT, LINKUSDT, NEARUSDT:** PF between 1.03 and 1.07; after 30% tax drag, all three suffered net losses (-₹126.40, -₹168.31, -₹70.53).
3. **Severe Indian Tax Drag (Section 115BBH):**
   Across the **ALL (14 Assets Combined)** portfolio, the strategy generated gross winning gains of ₹5,177.30 and pre-tax net PnL of +₹3,923.27. However, under Indian tax rules where losses cannot offset gains, the 30% flat tax amounted to **₹1,553.19**, dragging net after-tax PnL into the red at **₹-1,254.03**.

---

## 3. Detailed UNTOUCHED Asset Breakdown (2022–2026)

| Asset | N Trades | Win Rate | Profit Factor | Net R/month | Pre-Tax PnL | Section 115BBH 30% Tax | After-Tax Net PnL |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BNBUSDT** | 53 | 35.8% | 1.00 | -0.002 R | ₹-6.09 | ₹471.52 | **₹-477.61** |
| **XRPUSDT** | 36 | 30.6% | 0.47 | -0.160 R | ₹-650.49 | ₹173.52 | **₹-824.01** |
| **ADAUSDT** | 26 | 34.6% | 1.28 | +0.061 R | ₹+246.80 | ₹337.15 | **₹-90.35** |
| **AVAXUSDT** | 18 | 50.0% | 1.03 | +0.004 R | ₹+15.90 | ₹142.30 | **₹-126.40** |
| **LINKUSDT** | 22 | 40.9% | 1.07 | +0.011 R | ₹+45.62 | ₹213.93 | **₹-168.31** |
| **DOGEUSDT** | 20 | 45.0% | 4.86 | +0.656 R | ₹+2,661.72 | ₹1,005.41 | **₹+1,656.31** |
| **NEARUSDT** | 8 | 37.5% | 1.07 | +0.005 R | ₹+21.25 | ₹91.78 | **₹-70.53** |

*Key Takeaway:* In 6 out of 7 untouched crypto assets, the strategy was unviable after accounting for real Binance funding, taker friction, and tax drag. The strategy does not possess universal trend capture across altcoins.

---

## 4. Verification Harness & Parity Proofs

1. **Lookahead Truncation Test:**
   - Executed across all 14 assets for 200 randomly sampled cutoff points each (`tests/test_universe_loader_truncation.py`).
   - Causal 1H $\to$ 4H resampling verified: 0 candle leaks, 0 future lookahead.
   - Status: **100% PASS** (2,800/2,800 bar evaluations verified identical to truncated expanding windows).
2. **Real Binance Funding Rates:**
   - 11 crypto perpetuals loaded real historical 8-hour Binance funding rates (`fundingTime`, `fundingRate`).
   - Commodities (XAU, XAG, CL) verified with 0.0 funding drag.
   - Status: **100% PASS**.
3. **Causal 90-Day Rolling Correlation Clustering:**
   - Dynamically evaluated pairwise Pearson correlations over past 540 4H bars at each trade entry time.
   - Enforced max 2 positions per cluster ($r > 0.70$) and max 3 positions total open risk (3% risk cap).

---

## 5. Forward Paper Trading Ledgers Setup

As instructed, three separate, forward-looking paper ledgers have been wired into `Trader-Pro-Dashboard` starting from **2026-10-31 00:00:00 UTC**:

1. **`v1_primary` (Primary Baseline):**
   - File log: `data/trades_4h_fixed_v1.json` (mirrored in `trades_4h_fixed.json`)
   - MongoDB: `paper_trades_4h_fixed_v1`
   - Config: `config/fixed_rule_4h_v1.json`
2. **`v6_shadow` (BOS Retest Entry):**
   - File log: `data/trades_4h_shadow_v6.json`
   - MongoDB: `paper_trades_4h_shadow_v6`
   - Config: `config/variants/v6_smc_bos_retest.json`
3. **`v8_shadow` (No Stretch Cap):**
   - File log: `data/trades_4h_shadow_v8.json`
   - MongoDB: `paper_trades_4h_shadow_v8`
   - Config: `config/variants/v8_no_stretch_cap.json`

**API & Cron Endpoints:**
- `/api/cron/paper-4h-fixed`: Executes all three ledgers synchronously on each scheduled 4H cron run.
- `/api/fixed-rule-4h/ledgers`: Exposes real-time multi-ledger status, active trades, closed trades, win rates, and PnL to the dashboard frontend.
- Unit & integration tests: 85 passing tests in `tests/*.test.ts`.
