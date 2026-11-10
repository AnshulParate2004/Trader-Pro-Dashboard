# Pre-Registration: Repository-Derived Ablations on Fixed Rule 4H Baseline
**Document:** `docs/prereg/learn_from_repos.md`  
**Date:** 2026-11-10  
**Status:** PRE-REGISTERED (Committed prior to ablation backtest execution)  
**Branch:** `feat/learn-from-repos`

---

## 1. Frozen Baseline Architecture (`fixed_rule_4h_v1`)
All ablations are evaluated in paired comparison against the frozen reference specification in `config/fixed_rule_4h_v1.json`:
- **Timeframe:** 4H; **Assets:** BTCUSDT, ETHUSDT (2020–2026).
- **Entry:** Evaluated on closed bar $t$, filled at `Open(t+1)`. Long: `Close > SMA200` and `Close > Donchian20_High` (shift 1). Short: Mirror image.
- **Filters:** EMA50 slope $> 0.0005$, Elastic Stretch $\le 3.0$ ATR, Candle Body $\ge 0.25$ ATR, Close quantile $\ge 0.60$ (long) / $\le 0.40$ (short), Volume $\ge 0.85 \times \text{SMA50(Volume)}$.
- **BTC Regime Gate:** ETH trades long only if BTC `Close > SMA200` and `BTC EMA50 slope > 0`.
- **Stop Loss:** Lowest low 10 bars (shift 1), clamped to $[2.3\%, 6.0\%]$, `clamp_mode = "skip"`.
- **Trailing Exit:** $3 \times \text{ATR14}$ Chandelier trailing stop (highest close since entry minus $3\text{ATR}$). Evaluated from bar $t+1$. Max hold 42 bars (7 days).
- **Execution Realism:** Same-bar stop + trail ambiguity resolves stop-first. Costs: 0.1144% taker round trip + real/fallback funding rates. Risk: ₹70 per trade, max 2 concurrent open positions (2% account risk).

---

## 2. Pre-Registered Variants (Strict Max 8)

Each variant alters exactly ONE mechanism or adds ONE macro/structural filter. All configs are isolated in `config/variants/<name>.json`.

### Variant 1: `v1_breakeven_1r` (Freqtrade FixedRiskRewardLoss Inspired)
- **Hypothesis:** Moving stop loss to $\text{Entry} + \text{Fees}$ once unrealized profit reaches $+1.0\text{R}$ locks in risk-free runners without choking normal noise.
- **Specification:** When `Max_Unrealized_R >= 1.0`, stop is adjusted to entry price plus 0.1144% friction.

### Variant 2: `v2_breakeven_03r` (Playbook Rule)
- **Hypothesis:** Moving stop loss to breakeven at $+0.30\text{R}$ protects capital early.
- **Specification:** When `Max_Unrealized_R >= 0.30`, stop is adjusted to entry price plus 0.1144% friction.

### Variant 3: `v3_daily_sma200_filter` (Informative Higher Timeframe Trend)
- **Hypothesis:** Requiring the higher timeframe daily candle to be above daily SMA200 filters out counter-trend bull traps during macro bear regimes.
- **Specification:** At bar $t$, find the latest closed daily candle. Trade long only if `Daily_Close > Daily_SMA200`.

### Variant 4: `v4_mayer_multiple_gate` (Historical Valuation Envelope)
- **Hypothesis:** Mayer Multiple ($\text{Price} / \text{Daily SMA200}$) identifies over-extended euphoric tops.
- **Specification:** Compute expanding-window 90th percentile of Mayer Multiple using only past daily bars. Block new long entries if Mayer Multiple $> \text{Expanding_90th_Percentile}$.

### Variant 5: `v5_cowen_log_risk_gate` (Cowen Macro Logarithmic Regression)
- **Hypothesis:** Benjamin Cowen's power-law channel $\ln(P) = a_t + b_t \ln(\text{Days})$ flags macro bubble tops.
- **Specification:** Fit expanding-window OLS on past daily BTC data only. Compute past-only percentile of residuals. Block new long entries if `Macro_Risk > 0.75`.

### Variant 6: `v6_smc_bos_retest` (SMC Structural Trend Retest)
- **Hypothesis:** Replacing 20-bar Donchian breakout with confirmed swing Break of Structure (BOS) + retest of the broken swing level improves entry pricing.
- **Specification:** Causal swing detection (`swing_length=5`, confirmed at $s+5$). Entry when closed bar retests broken swing level. Keep all other filters, stops, and exits identical.

### Variant 7: `v7_sfp_liquidity_sweep` (SMC Liquidity Sweep Standalone Engine)
- **Hypothesis:** Trading Swing Failure Patterns (false breakouts sweeping swing highs/lows and closing back inside) captures institutional reversals.
- **Specification:** Separate strategy module. Enters on SFP close, fills Open(t+1), stops at swing extreme clamped $[2.3\%, 6.0\%]$, exits with 3x ATR Chandelier trail.

### Variant 8: `v8_no_stretch_cap` (Ablating the Stretch Filter)
- **Hypothesis:** Removing the `stretch <= 3.0` filter tests if strong parabolic breakouts generate outsized trend profits or excessive fakeouts.
- **Specification:** Baseline engine with `stretch_atr_mult` set to $\infty$ (disabled).

---

## 3. Decision Rules & Validation Gates
- **Lookahead Gate:** Must pass `tests/lookahead_truncation_test.py` across 200 random bars with zero discrepancy.
- **Primary Adoption Standard:**
  - $\Delta \text{Mean Net R} = \text{Mean Net R}_{\text{variant}} - \text{Mean Net R}_{\text{baseline}}$ must have a **paired bootstrap 95% CI strictly excluding zero**.
  - **Bonferroni Correction:** To declare an official "ADOPT" decision across 8 variants, the difference must remain significant at $\alpha = 0.05 / 8 = 0.00625$ ($99.375\%$ CI excluding zero).
  - Must improve or maintain net R in the recent **2022–2026** market regime.
- **Classification:**
  - **ADOPT:** Excludes zero at Bonferroni level, helps in 2022–2026, passes truncation test.
  - **SHADOW:** Promising ($\Delta > 0$, positive in 2022–2026) but fails conservative Bonferroni bar; forward-paper traded in shadow mode.
  - **REJECT:** Fails to improve baseline, degrades 2022–2026, or fails truncation test.
