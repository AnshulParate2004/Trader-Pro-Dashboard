# Canonical Research Report: Empirical Audit of External Repositories
**Document:** `docs/research/REPO_LESSONS_RESULTS.md`  
**Date:** 2026-11-10  
**Branch:** `feat/learn-from-repos`  
**Status:** CANONICAL RESULTS (Phase A through Phase E complete)

---

## 1. Executive Summary & Verdict Table

We evaluated open-source concepts from `smart-money-concepts`, `freqtrade-strategies`, `bitcoin_risk`, and `btc-risk-metric` on 6.8 years of 4H crypto data (2020–2026). Every variant was tested against the frozen baseline (`fixed_rule_4h_v1`) using causal event timestamps, next-bar-open execution, 0.1144% taker round-trip friction, funding costs, and non-overlapping holding periods.

### Final Synthesis Table
| Module / Variant | What It Does | Phase C Result vs Random (1000 MC) | Phase D Delta Mean R & 95% Bootstrap CI | Lookahead Truncation Test | Verdict | Core Rationale |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **BASELINE (`fixed_rule_4h_v1`)** | 20-bar Donchian + SMA200 + 4 filters + 3x ATR Chandelier exit | Reference benchmark | **+0.2773R** (PF 1.67, Max DD 8.3%) | **PASS (200/200)** | **BENCHMARK** | Frozen production baseline. |
| **V1 (`v1_breakeven_1r`)** | Stop moves to entry + fees at $+1.0\text{R}$ | N/A (Exit rule) | **-0.1538R** `[-0.3210, -0.0362]` | **PASS** | **REJECT** | 95% CI strictly below zero. Chokes runners during retests; 2022–2026 goes negative (-0.04R). |
| **V2 (`v2_breakeven_03r`)** | Playbook rule: stop to entry + fees at $+0.30\text{R}$ | N/A (Exit rule) | **-0.5023R** `[-0.7815, -0.2117]` | **PASS** | **REJECT** | Catastrophic failure (PF 0.24, -₹2,425 PnL). Normal 4H noise wipes out trades before trends expand. |
| **V3 (`v3_daily_sma200`)** | Daily close > Daily SMA200 required for longs | N/A (Filter) | **-0.2534R** `[-0.1675, +0.0000]` | **PASS** | **REJECT** | Halves trade count (144 to 74), drops PF to 1.05. Misses early cyclical uptrends. |
| **V4 (`v4_mayer_multiple`)** | Block longs above expanding 90th percentile Mayer Multiple | N/A (Gate) | **-0.0093R** `[+0.0000, +0.0000]` | **PASS** | **REJECT** | Blocks only 4 trades across 6.8 years; statistically indistinguishable from baseline. |
| **V5 (`v5_cowen_log_risk`)** | Block longs when expanding Cowen Macro Risk $> 0.75$ | N/A (Gate) | **+0.0214R** `[+0.0000, +0.0000]` | **PASS** | **REJECT** | Modest improvement (+0.2988R vs +0.2773R), but fails Bonferroni threshold ($P = 0.42 > 0.00625$). |
| **V6 (`v6_smc_bos_retest`)** | Replace Donchian trigger with confirmed BOS + retest | 46.3% WR, Mean -0.31% (14.2% pctile) | **+0.1107R** `[+0.0000, +0.0012]` | **PASS** | **SHADOW** | Promising (PF 2.21, Max DD 5.4%, 2022–2026 +0.3940R), but low $N=73$ fails Bonferroni bar. Run in shadow forward log. |
| **V7 (`v7_sfp_liquidity_sweep`)**| Standalone Swing Failure Pattern mean reversion | 52.8% WR, Mean +0.04% (50.6% pctile) | **-0.6269R** `[-1.0271, -0.2259]` | **PASS** | **REJECT** | Severe negative expectancy (PF 0.39, -₹1,541 PnL) with 3x ATR trend exit. SFP is not a trend engine. |
| **V8 (`v8_no_stretch_cap`)** | Remove `stretch <= 3.0` filter | N/A (Filter ablation) | **-0.1128R** `[-0.0005, +0.0827]` | **PASS** | **REJECT** | Dilutes trade quality: mean net R drops from +0.2773R to +0.1645R. Stretch cap is essential. |

> **Primary Conclusion:**  
> **ZERO variants met the pre-registered Bonferroni threshold for ADOPT.**  
> The frozen baseline `fixed_rule_4h_v1` remains undefeated as the active production strategy. Only **Variant V6 (SMC BOS-Retest)** demonstrated sufficient positive characteristics to earn a **SHADOW** designation for forward paper monitoring.

---

## 2. Key Quant Findings & Surprises

### 2.1 The Breakeven Ratchet Illusion (V1 & V2)
The trading community frequently recommends sliding stop loss to breakeven quickly (e.g., at $+0.30\text{R}$ or $+1.0\text{R}$).
- **The Empirical Reality:** Moving stop to $+0.30\text{R}$ destroyed the strategy (PF dropped from 1.67 to 0.24, losing ₹2,425). Moving stop to $+1.0\text{R}$ cut net profits by more than half (PF dropped to 1.30).
- **The Physical Reason:** Crypto assets exhibit heavy tail volatility. Breakouts on 4H experience an average **-0.52% retest pullback** within the first 24–48 hours before the larger multi-day trend develops. Tightening stops prematurely acts as an adverse selection filter—it stops out the highest-conviction trend runners while letting losing trades hit full initial stops.

### 2.2 The Standalone SFP / Liquidity Sweep Failure (V7)
While raw event studies of SFPs showed high short-term reversal win rates (52%–55%), wrapping SFP entries into a systematic trend-following portfolio engine with trailing stops produced a **-0.3496R mean return** and a **0.39 Profit Factor**.
- An SFP is a temporary liquidity capture, not a multi-day trend catalyst. Exiting with a 3x ATR Chandelier stop causes the position to give back its entire bounce during subsequent re-sweeps. SFP cannot function as a drop-in replacement for trend breakout triggers.

### 2.3 SMC BOS-Retest (V6) Promising but Under-Sampled
Variant V6, which replaces Donchian breakouts with causal swing break-and-retests, achieved:
- **Mean Net R:** **+0.3880R** (vs +0.2773R baseline).
- **Profit Factor:** **2.21** (vs 1.67 baseline).
- **Max Drawdown:** **₹412.2 (5.4%)** (vs ₹748.7 / 8.3% baseline).
- **2022–2026 Consistency:** Positive every single year (+₹155 in 2022, +₹193 in 2023, +₹220 in 2024, +₹505 in 2025, +₹691 in 2026).
- **Why Not Adopted?** The strictness of requiring a breakout AND a retest within 24 bars reduced total trades over 6.8 years to just **73 trades** (under 11 trades/year). With $N=73$, it does not cross the Bonferroni significance threshold ($\alpha = 0.00625$). It is designated for **SHADOW paper-trading** to accumulate forward out-of-sample data.

---

## 3. Governance Decision
1. **`config/fixed_rule_4h_v1.json` remains the sole ACTIVE production engine.**
2. **`v6_smc_bos_retest` is enabled as a SHADOW engine in paper execution logs.**
3. **All other variants (V1, V2, V3, V4, V5, V7, V8) are formally REJECTED.**
