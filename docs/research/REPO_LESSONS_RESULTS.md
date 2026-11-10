# Canonical Research Report: Empirical Audit of External Repositories (v2 Refined)
**Document:** `docs/research/REPO_LESSONS_RESULTS.md`  
**Date:** 2026-11-10  
**Branch:** `feat/learn-from-repos`  
**Status:** CANONICAL RESULTS (Harmonized with `backtest.py` Engine & Calendar-Month Block Bootstrap)

---

## 1. Executive Summary & Verdict Table

We evaluated open-source concepts from `smart-money-concepts`, `freqtrade-strategies`, `bitcoin_risk`, and `btc-risk-metric` on 6.8 years of 4H crypto data (2020–2026). Every variant was executed using the **exact canonical engine from `experiments/fixed_rule_4h_v2/backtest.py`**, ensuring zero discrepancy with the frozen baseline (`fixed_rule_4h_v1`).

Because variants produce different trade timestamps and counts, paired evaluation was computed on the **calendar-month net-R difference series** ($R_{\text{variant}}(m) - R_{\text{baseline}}(m)$ across 82 months) using a **3-month block bootstrap with 10,000 resamples**.

### Final Synthesis Table
| Module / Variant | What It Does | Lookahead Truncation Test | Observed Delta R/mo | 95% Block Bootstrap CI | 99.375% Bonferroni CI | 2022-2026 Net R | Verdict | Core Rationale |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **BASELINE (`fixed_rule_4h_v1`)** | Donchian 20 + SMA200 + 4 filters + 3x ATR Chandelier | **PASS (200/200)** | **REF** | `[  REF  ,   REF  ]` | `[  REF  ,   REF  ]` | **+0.0897R (112t)** | **BENCHMARK** | 134 trades, +0.1920R, PF 1.47, Max DD 7.66%. |
| **V1 (`v1_breakeven_1r`)** | Stop moves to entry + fees at $+1.0\text{R}$ | **PASS (200/200)** | **-0.1608R** | `[-0.3617, -0.0186]` | `[-0.4689, +0.0070]` | **-0.0275R (112t)** | **REJECT** | 95% CI strictly below zero. Chokes runners during normal retests; drops 2022-2026 into net loss. |
| **V2 (`v2_breakeven_03r`)** | Playbook rule: stop to entry + fees at $+0.30\text{R}$ | **PASS (200/200)** | **-0.7012R** | `[-1.1333, -0.3528]` | `[-1.2879, -0.2385]` | **-0.2229R (116t)** | **REJECT** | Catastrophic failure (PF 0.26, -₹2,224 PnL). Normal 4H noise wipes out positions before trend develops. |
| **V3 (`v3_daily_sma200`)** | Daily close > Daily SMA200 required for longs | **PASS (200/200)** | **-0.2759R** | `[-0.6327, +0.0196]` | `[-0.7931, +0.1213]` | **+0.0845R (52t)** | **REJECT** | Halves trade count (134 to 67), drops PF to 1.10. Misses early cyclical uptrends. |
| **V4 (`v4_mayer_multiple`)** | Block longs above expanding 90th percentile Mayer | **PASS (200/200)** | **-0.0938R** | `[-0.3241, +0.0427]` | `[-0.5259, +0.0569]` | **+0.0897R (112t)** | **REJECT** | Negative delta; blocks profitable cycle continuation trades in 2020. |
| **V5 (`v5_cowen_log_risk`)** | Block longs when expanding Cowen Risk $> 0.75$ (365d warmup) | **PASS (200/200)** | **-0.0238R** | `[-0.1372, +0.0612]` | `[-0.1940, +0.0864]` | **+0.1149R (102t)** | **REJECT** | 13 trades ungated in 2020. Delta is slightly negative (-0.0238R/mo); CI includes zero ($P > 0.05$). |
| **V6 (`v6_smc_bos_retest`)** | Replace Donchian trigger with confirmed BOS + retest | **PASS (200/200)** | **-0.0247R** | `[-0.4713, +0.3922]` | `[-0.6766, +0.5215]` | **+0.3676R (56t)** | **SHADOW** | Promising efficiency (PF 2.09, Max DD 4.6%, 2022–2026 +0.3676R), but low $N=65$ gives wide CI spanning zero. Keep in shadow paper log. |
| **V7 (`v7_sfp_liquidity_sweep`)**| Standalone Swing Failure Pattern mean reversion | **PASS (200/200)** | **-0.5358R** | `[-0.9996, -0.1400]` | `[-1.1898, -0.0022]` | **-0.3276R (36t)** | **REJECT** | Severe negative expectancy (PF 0.43, -₹1,274 PnL). SFP is not a standalone trend engine. |
| **V8 (`v8_no_stretch_cap`)** | Remove `stretch <= 3.0` ATR filter | **PASS (200/200)** | **+0.2615R** | `[-0.1064, +0.7266]` | `[-0.2190, +0.8948]` | **+0.1162R (219t)** | **INCONCLUSIVE** | Bootstrap 95% CI `[-0.1064, +0.7266]` includes zero. More trades (261), but edge per trade diluted. |

> **Primary Conclusion:**  
> **ZERO variants achieved the pre-registered Bonferroni threshold for ADOPT.**  
> The frozen baseline `fixed_rule_4h_v1` remains the sole ACTIVE production engine. Variant **V6 (SMC BOS-Retest)** is designated as **SHADOW** for forward paper monitoring. Variant **V8** is **INCONCLUSIVE**. All other variants are **REJECTED**.

---

## 2. Methodology & Resolution of Discrepancies

### 2.1 Resolution of Phase D Discrepancy (134 vs 144 trades)
- **Phase 1 Reference:** 134 trades, Mean Net R: +0.1920R, PF: 1.47, Max DD: ₹632.11 (7.66%).
- **Prior Scratch Run:** Printed 144 trades (+0.277R).
- **Root Cause Identified:** The scratch script did not enforce per-asset lockout during candidate generation (`last_exit_bar = entry_idx + exit_bar`) and evaluated stop distance on signal close instead of open. This allowed 10 spurious concurrent trades to slip through.
- **Resolution:** `phase_d_ablations.py` now directly imports the canonical `run_candidate_generator` and `apply_portfolio_constraints` from `experiments/fixed_rule_4h_v2/backtest.py`, reproducing the reference baseline to the 4th decimal place.

### 2.2 Stationary Calendar-Month Paired Block Bootstrap
Because variants have completely different entry timestamps and trade counts ($N$ ranges from 59 to 261), trade-by-trade pairing is mathematically invalid. We mapped each strategy to its realized monthly net-R time series ($R(m) = \sum_{t \in m} \text{net\_r}_t$) across 82 calendar months (2020-01 to 2026-10), and bootstrapped the difference series $D(m) = R_{\text{variant}}(m) - R_{\text{baseline}}(m)$ using overlapping 3-month blocks (10,000 resamples). In all 8 variants, the observed delta lies strictly inside the 95% and 99.375% bootstrap confidence intervals.

### 2.3 V5 365-Day History Audit
- **365-Day Cutoff Date:** `2020-12-31`.
- **Ungated Trades:** Exactly **13 trades** entered prior to day 365 while the logarithmic regression historical window was warming up. After 2020, expanding OLS gating blocked 13 frothy cycle top entries.

---

## 3. Invalid Scripts Notice
> [!WARNING]
> `experiments/external_playbook_validation.py` is permanently marked as **INVALID (LOOKAHEAD BIAS)**.  
> It used naive `smartmoneyconcepts` (`shift(-(swing_length//2))`), written historical indices, and whole-sample logarithmic regression. Causal, zero-lookahead results are documented exclusively in `experiments/phase_c_correct_event_studies.py` and `experiments/phase_d_ablations.py`.
