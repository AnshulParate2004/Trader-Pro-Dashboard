# Institutional Audit Lessons & Verification Standards

> **Status:** Canonical Research Reference  
> **Repository:** Trader-Pro / Trader-Pro-Dashboard  
> **Scope:** Audit of quantitative trading models, execution engines, fee models, and statistical integrity.  
> **Core Directive:** No new strategy, indicator, or model may be proposed or deployed without satisfying all mandatory validation gates defined in this document.

---

## 1. Executive Summary

Between October and November 2026, an exhaustive quantitative audit of the Trader-Pro algorithmic trading systems (15M, 1H, and 4H LightGBM + Donchian breakout models across BTCUSDT and multi-coin universes) evaluated at least 126 formal variants; the true count across all studies is higher and was not tracked (including 108 variants in the 4H-B pre-registered parameter grid on DEV folds, plus earlier multi-coin iterations; the 18 Phase-B2 parameter sets were exploratory proposals and were never run). The audit revealed that **nominal historical outperformance was an artifact of multiple compounding methodology flaws**:
1. Target label lookahead leakage in training scripts.
2. Favorable execution assumptions in the historical backtesting engine that generated phantom profits on pure synthetic random walk noise.
3. Unintentional in-sample evaluation masquerading as out-of-sample hold-out testing.
4. Severe exchange fee friction drag relative to live stop-loss distances.
5. Inconsistent stop-loss sizing between backtest design and live production execution.
6. A dashboard PnL-to-R normalization bug that masked live losses.

When all models were re-evaluated under honest execution mechanics, identical live stop widths, and realistic taker exchange fees, **no strategy demonstrated a statistically significant positive net edge over random entry**.

This document logs what was attempted, why each flaw occurred, and the permanent invariants every future quantitative project must enforce.

---

## 2. Exhaustive Log of Critical Flaws

### Flaw 1: Target Label Lookahead Leakage (Backward Rolling on Forward Shift)
- **What Was Attempted:** Training LightGBM classifiers to predict whether price would touch $+2.0 \times \text{ATR}$ before $-1.0 \times \text{ATR}$ over a forward horizon of $k$ bars.
- **The Bug:** In feature engineering scripts (`run_study_v2.py`, `02_train_1h.ipynb`), the forward target was constructed via:
  ```python
  # BUG: Applies backward rolling window to a 1-bar forward shift
  future_high = df['high'].shift(-1).rolling(k).max()
  ```
  In pandas, `.rolling(k)` looks *backward* by default (`[t - k + 1, t]`). Applying it to `shift(-1)` resulted in a window covering $[t - k + 2, t + 1]$, which contained $k - 1$ bars of *historical* data from the past, leaking already-closed candle outcomes directly into the training feature space.
- **The Consequence:** The model achieved an artificial training AUC of **`0.8923`**.
- **The Reality:** When corrected to a strict forward-looking rolling window $[t + 1, t + k]$:
  ```python
  # CORRECT: Explicit forward window
  future_high = df['high'].iloc[::-1].rolling(k).max().iloc[::-1].shift(-1)
  ```
  The true, honest LightGBM AUC collapsed to **`0.5126`** (indistinguishable from noise).

---

### Flaw 2: Simulator Bias (Phantom Alpha on Pure Noise)
- **What Was Attempted:** Simulating barrier hits (TP, SL, Breakeven ratchet) on historical OHLC bars.
- **The Bug:** The historical simulator incorporated four compounding execution advantages:
  1. **Signal-Close Fill:** Orders were assumed to enter at the exact `close` of the signal bar without spread crossing, execution latency, or slippage.
  2. **Same-Candle Ratchet Arming:** When a candle's high touched the $+0.30\text{R}$ trigger, the stop was moved to breakeven *within the same candle* and protected the position from being stopped out on that same bar.
  3. **Exact Breakeven Credit (+0.05R):** The simulator credited breakeven exits with an exact $+0.05\text{R}$ gross gain (to offset fees), assuming zero slippage on stop-market execution.
  4. **TP-before-SL Priority:** When a single candle's range spanned both TP and SL thresholds, the code evaluated TP first via `if / else if`.
- **The Consequence:** When the simulator was run on **pure synthetic random-walk noise** (Geometric Brownian Motion and return block-bootstrap with zero drift and zero predictability), it earned an artificial gross edge of:
  - 15M Noise: **`+0.1272R`** gross phantom return
  - 1H Noise: **`+0.1128R`** gross phantom return
- **The Reality:** The backtest was not capturing market alpha; it was harvesting simulator bias. When re-run under strict execution (next-bar open entry, next-bar ratchet activation, 0.00R true breakeven fill, SL-first on same-candle ambiguity), noise returns centered honestly at **`0.00R`**, and all real strategy returns turned negative net of fees.

---

### Flaw 3: In-Sample Hold-Out Contamination
- **What Was Attempted:** Evaluating setup 1H-A on historical data from May 1, 2024 to October 26, 2026, designated in research logs as a "sealed out-of-sample hold-out window".
- **The Bug:** Metadata inspection of the production model artifact (`final_model_BTCUSDT_1h.joblib` and `src/models/1h/model_card.json`) revealed:
  ```json
  "trained_until": "2026-10-26 03:00:00+00:00"
  ```
  The production model had been trained on the entire dataset through October 26, 2026.
- **The Consequence:** The entire "hold-out window" (May 2024 to Oct 2026) was contained within the training dataset.
- **The Reality:** 100% of the historical backtest data was in-sample memorization. The only genuinely out-of-sample data is forward paper trading initiated after October 31, 2026 (the date the protocol was frozen in `paper_rules.md`).

---

### Flaw 4: Exchange Fee Friction Drag on Tight Stops
- **What Was Attempted:** Running high-frequency scalping and intraday swing systems on 15M and 1H candles.
- **The Bug:** Overlooking the mathematical identity governing friction in R units:
  $$\text{cost\_R} = \frac{\text{Round-Trip Exchange Fee \%}}{\text{Stop Loss Distance \%}}$$
  On an exchange with $0.040\%$ taker fee $+ 18\%$ GST $+ 0.010\%$ slippage per side, round-trip friction is **$0.1144\%$ notional**.
- **The Consequence:**
  - On a 15M scalper with an observed stop distance of $0.23\%$, fee friction is:
    $$\text{cost\_R} = \frac{0.1144\%}{0.23\%} = \mathbf{0.497\text{R}}$$
    *Every single trade lost nearly half its risk unit ($0.50\text{R}$) immediately to fees upon entry.*
  - On a 1H model with a stop distance of $0.74\%$, fee friction is:
    $$\text{cost\_R} = \frac{0.1144\%}{0.74\%} = \mathbf{0.155\text{R}}$$
- **The Reality:** Even with a respectable gross edge of $+0.12\text{R}$ on 1H, subtracting $0.16\text{R}$ in fees guarantees a negative net expectancy of $-0.04\text{R}$ to $-0.18\text{R}$ per trade. Short-horizon crypto futures trading is an arithmetic impossibility for retail taker accounts.

---

### Flaw 5: Stop-Loss Size Mismatch (Backtest vs Live Execution)
- **What Was Attempted:** Designing backtests with wide percentage stops while executing live trades with narrow ATR-based stops.
- **The Bug:** The Phase A/B backtest tables evaluated gross returns using an assumed $\sim 1.0\%$ stop distance, while the live production engine implemented an adaptive ATR rule capped at $5\%$, which in practice yielded median live stops of **$0.2287\%$** (based on 75 closed trades in MongoDB).
- **The Consequence:** The backtest assumed a fee drag of $0.1144\text{R}$ ($0.1144\% / 1.0\%$), whereas live execution experienced a fee drag of $0.5002\text{R}$ ($0.1144\% / 0.2287\%$)—a **$4.37\times$ friction explosion**.
- **The Reality:** Combining backtest gross gains with live fee friction mixed two incompatible systems and disguised the unviability of live execution.

---

### Flaw 6: R Normalization Dashboard Artifact
- **What Was Attempted:** Displaying aggregate trade performance in R units on the web dashboard (`/ai-engine`).
- **The Bug:** In `src/lib/tradingEngine.ts`, the R conversion formula divided INR PnL by an assumed fixed 1% notional risk:
  ```ts
  // BUG: Assumes every trade had a 1.0% stop
  const oneR = positionSizeINR * 0.01;
  const netR = netPnLINR / oneR;
  ```
- **The Consequence:** Because live trades had actual stop distances averaging $0.23\%$, dividing by $1.0\%$ notional artificially compressed all displayed live losses by $4.37\times$. A realized live loss of $-0.336\text{R}$ was displayed as a benign $-0.077\text{R}$.
- **The Reality:** Real performance was substantially worse than indicated on the dashboard. The metric was corrected to normalize by each trade's actual dollar risk at entry (`riskAmountINR = positionSizeINR * stopPct`).

---

## 3. Mandatory Pre-Flight Checklist for Every Future Strategy

Before any new strategy, signal, or timeframe may be committed, backtested, or paper-traded, it must pass the following six non-negotiable verification gates:

### Gate 1: Zero-Lookahead Labeling Verification
- [ ] No feature or target calculation may use `.rolling()` on a negative shift without reversing series order.
- [ ] Explicit assertions in Python verifying that label at index $t$ depends strictly on indices $[t + 1, t + k]$ and never $[t - j, t]$.
- [ ] Leakage sweep across all training notebooks using automated unit tests.

### Gate 2: Noise Control Invariant (Null Hypothesis Test)
- [ ] The simulation engine must be run on synthetic Geometric Brownian Motion (GBM) and block-bootstrapped returns with 100 random seeds.
- [ ] **Pass Requirement:** The mean gross R of random entries on noise must be statistically indistinguishable from zero:
  $$\mu_{\text{gross, noise}} \in [-0.01\text{R}, +0.01\text{R}] \quad (95\% \text{ CI crosses } 0.00\text{R})$$
- If the simulator generates $> +0.02\text{R}$ on noise, the simulator is biased and cannot be used.

### Gate 3: Realistic Execution Mechanics
- [ ] **Entry:** Fills strictly on the `open` of bar $t + 1$, never the `close` of bar $t$.
- [ ] **Ratchet Activation:** Ratchet trigger armed on bar $t$ becomes active only starting on bar $t + 1$.
- [ ] **Breakeven Fill:** Breakeven exit executed at $0.00\text{R}$ gross (unadjusted entry price) minus full round-trip friction.
- [ ] **Same-Candle Ambiguity:** If both TP and SL are touched in the same candle, SL must be assumed to trigger first (pessimistic) or order must be resolved using 1-minute intrabar data.

### Gate 4: Cost Friction Feasibility Ratio
- [ ] Calculate the friction-to-stop ratio before testing:
  $$\text{cost\_R} = \frac{\text{Round-Trip Friction \%}}{\text{Median Stop Distance \%}}$$
- [ ] **Pass Requirement:** $\text{cost\_R} \le 0.05$ (round-trip exchange friction must not consume more than $5.0\%$ of the initial stop distance).
- [ ] **Economic Rationale:** At standard taker friction ($0.1144\%$ round turn), a $5\%$ cap mandates a minimum median stop distance of $\ge 2.29\%$. When fee drag exceeds $5\%$ of risk (such as scalping with $0.23\%$ stops where $\text{cost\_R} \approx 0.50$), even an exceptional gross edge is entirely wiped out by exchange fees. Capping $\text{cost\_R} \le 0.05$ guarantees that at least $95\%$ of gross trade expectation survives to net PnL.

### Gate 5: Sealed Out-of-Sample Integrity
- [ ] All model parameters, hyperparameters, and conviction thresholds must be fit strictly on data prior to a sealed cutoff date.
- [ ] Sealed hold-out data may be evaluated **exactly once**.
- [ ] If a hold-out is viewed, that time window is permanently burned and can never be re-used for tuning.

### Gate 6: Dynamic Risk R Normalization
- [ ] Every trade record must record `stopPct` and `riskAmountINR` at entry.
- [ ] Performance must be computed from actual realized risk:
  $$\text{R} = \frac{\text{Net PnL}}{\text{Actual Entry Risk Amount}}$$
- [ ] Never divide by fixed notional percentages.

### Gate 7: Factor Exposure & Residual Edge Attribution Invariant
- [ ] Any proposed strategy must be evaluated against predeclared simple baseline exposures (e.g. underlying asset buy-and-hold) using returns-based OLS with Newey-West HAC inference (`residual-edge-analyzer`).
- [ ] **Pass Requirement:** The strategy must demonstrate statistically significant residual alpha with $t_{\text{HAC}} \ge 2.0$ after controlling for market beta ($\beta$), and rolling positive alpha fraction $\ge 60\%$.
- [ ] If apparent gains are fully explained by systematic beta loading and cash allocation (e.g., $t_{\alpha} < 2.0$), the strategy must be classified as `RESIDUAL_FRAGILE` and cannot be claimed as an independent alpha edge.
- [ ] **Calendar Scaling Invariant:** In crypto markets (24/7/365), annualization factors must be set to 365 days, not the equity-default 252 days, to prevent 31% return distortion.

---

## 4. Current Architecture Status

1. **15M & 5M Scalpers:** **PERMANENTLY RETIRED.** High fee drag ($0.50\text{R}$ per trade) mathematically guarantees negative net returns.
2. **Setup 1H-A:** **FROZEN AS PAPER-ONLY TEST HARNESS.** Models, thresholds, and execution code are frozen. Serves solely as an execution infrastructure check. Surfaced with dual metrics:
   - *Optimistic Fills:* $+0.0412\text{R}$ (assumes zero-slippage stop fills at entry + fees).
   - *Pessimistic Fills:* $-0.0074\text{R}$ (honest entry fill with fees paid).
3. **Future Research:** Strictly confined to low-turnover, macro regimes (Daily/Weekly trend following and delta-neutral funding harvest) where holding periods span days to weeks and fee friction drops to $< 2\%$ of gross edge.
4. **Daily Macro Benchmarks (Donchian 20/10 Tool Tests on BTC & ETH):** Falsification tests confirmed that while simple trend rules provide drawdown dampening (-53.9% on BTC, -65.6% on ETH) by holding ~50% cash, their apparent alpha is not statistically significant ($t_{\text{HAC}} = 1.25$ on BTC, $0.89$ on ETH). They serve as robust execution baselines, not claims of independent edge.

---

## 5. Execution-Cost Findings & Fixed-1%-Stop Discrepancy

### Stop% and Friction Invariant Table (0.1144% Taker Round-Trip)

| Dataset / Timeframe | Sample Count ($N$) | p10 Stop% | Median Stop% | $\text{cost\_R}$ at Median | p90 Stop% | $\text{cost\_R}$ at p90 |
|---|---:|---:|---:|---:|---:|---:|
| **Stored MongoDB `trade_logs` (Live Scalp)** | 75 closed trades | 0.1144% | **0.2287%** | **0.5002R** | 0.4126% | **0.2773R** |
| **Historical 15M Live ATR Rule** ($\min(1.0\text{ATR}, 5\%)$) | 239,138 bars | 0.1651% | **0.3506%** | **0.3263R** | 0.7099% | **0.1612R** |
| **Historical 1H Live ATR Rule** ($\min(1.0\text{ATR}, 5\%)$) | 59,774 bars | 0.3868% | **0.7414%** | **0.1543R** | 1.4035% | **0.0815R** |
| **Historical 4H Live ATR Rule** ($\min(1.0\text{ATR}, 5\%)$) | 14,933 bars | 0.9241% | **1.5437%** | **0.0741R** | 2.7698% | **0.0413R** |
| *Old 15M Backtest CSV (`trades_main.csv`)* | 11,548 trades | 0.4615% | 0.9419% | 0.1215R | 1.0000% | 0.1144R |
| *Old 1H Backtest CSV (`trades_main.csv`)* | 2,624 trades | 1.0000% | 1.0000% | 0.1144R | 1.0000% | 0.1144R |
| *Old 4H Backtest CSV (`trades_main.csv`)* | 598 trades | 1.0000% | 1.0000% | 0.1144R | 1.0000% | 0.1144R |

### The Fixed-1%-Stop Discrepancy
Historical backtests (`src/models/*/trades_main.csv`) artificially assumed a fixed stop distance of $\approx 1.00\%$, yielding an assumed fee drag of only $\approx 0.11\text{R}$ per trade. In reality, actual live trade execution and live ATR on 15M produced stops clustering between $0.23\%$ and $0.35\%$, resulting in real fee drag of **$0.33\text{R}$ to $0.50\text{R}$ per trade**—a **$3.0\times$ to $4.4\times$ friction explosion**.

### Required Stop Distance for Cost Viability
- **Gate $\text{cost\_R} \le 0.10$**: Mandates stop distance $\ge \frac{0.1144\%}{0.10} = \mathbf{1.1440\%}$.
- **Gate $\text{cost\_R} \le 0.08$**: Mandates stop distance $\ge \frac{0.1144\%}{0.08} = \mathbf{1.4300\%}$.

At 15M, only **`0.97%`** of historical signals meet the 0.08 threshold (**`99.03%` rejected**), and even the surviving ~1% of signals produced negative strict net returns ($-0.236\text{R}$, 95% CI upper bound $-0.020\text{R}$). Fast scalping is mathematically unviable under realistic exchange fees.


---

## 6. High-Frequency Foundation Model Benchmark (Chronos vs HAR-RV vs GARCH vs EWMA)

A comprehensive benchmark was conducted on 2,496 daily BTC bars across 2,730 total origins (2,190 Dev, 540 Holdout) using Garman-Klass daily realized volatility as the target:
1. **Directional Accuracy:** Zero directional alpha across all models (Chronos-Base 50.6% Dev / 51.2% Holdout; Chronos-Small 49.7% Dev / 50.4% Holdout; Linear Regression 50.2% Dev). `Baseline_ZeroReturn` beat all models on Return MAE.
2. **Fixed HAR-RV (Expanding Window $\ge 500$ days):** Fixed the 128-bar rolling window bug (which previously caused QLIKE to blow up to 816). Expanding window HAR-RV achieved QLIKE $0.5792$ in Dev (beating EWMA $0.5841$, $p=0.0435$), but failed in Holdout (QLIKE $0.6012$ vs EWMA $0.5984$, $p=0.1479$, CI includes 0).
3. **Foundation Models vs EWMA(0.94):** Chronos-Base (QLIKE $0.6953$ Dev, $0.7108$ Holdout) and Chronos-Small (QLIKE $0.7205$ Dev, $0.7421$ Holdout) failed to beat EWMA(0.94) in either window ($p > 0.97$).
4. **Primary Decision Rule:** No model beat EWMA(0.94) with $p < 0.05$ and a CI excluding zero in both Dev and Holdout.
5. **Decision:** **Use EWMA(0.94)**. Foundation models add massive compute and latency overhead with negative excess predictive value.

---

## 7. 15M Scalping Engine Final Falsification (Frozen Settings, Strict-Fill Simulator)

The frozen 15M engine (`BTCUSDT_15m`, `final_model_BTCUSDT_15m.joblib`, $2.0\text{ ATR}$ TP, $1.0\text{ ATR}$ SL, 24-bar horizon) was re-tested under realistic exchange execution invariants:
- **Execution:** Next-bar open entry ($P_{\text{entry}} = O_{t+1}$).
- **Priority:** Intra-bar worst-case priority (stop-loss checked **before** target within the same bar).
- **Cost Tier:** 50 bps round-trip friction ($0.50\%$). Live stop distance: $\text{stop\_pct} = 1.0\text{ ATR} / P_{\text{entry}}$. Cost in R: $\text{cost\_R} = 0.0050 / \text{stop\_pct}$.
- **Partitioning:** Only trades entered after `2026-10-31 23:59:59 UTC` count as out-of-sample (OOS). Everything earlier is exploratory.

### Results Table

| Metric | Noise-Null Control (50 Random Walks) | Pure ML Exploratory ($\le \text{2026-10-31}$) | Pure ML OOS ($> \text{2026-10-31}$) | Meta-Labeling Exploratory | Meta-Labeling OOS ($> \text{2026-10-31}$) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Trades ($N$)** | 3,600 / sim | 2,105 trades | 6 trades | 12,653 trades | 37 trades |
| **Gross R / trade** | $+0.0509\text{R}$ | $+0.1664\text{R}$ | $-0.5000\text{R}$ | $+0.0065\text{R}$ | $-0.0270\text{R}$ |
| **Mean Cost R** | $1.1478\text{R}$ | $1.1427\text{R}$ | $1.8819\text{R}$ | $1.6789\text{R}$ | $2.3654\text{R}$ |
| **Net R / trade** | **$-1.0970\text{R}$** | **$-0.9763\text{R}$** | **$-2.3819\text{R}$** | **$-1.6724\text{R}$** | **$-2.3924\text{R}$** |
| **95% Bootstrap CI ($L=20$)** | $[\pm 0.025]$ | `[-1.0995, -0.8465]` | `[-3.0931, -1.7549]` | `[-1.7606, -1.5868]` | `[-3.1799, -1.6204]` |
| **Share Trades $\text{cost\_R} > 0.15$** | 100.0% | **99.71%** | **100.00%** | **99.98%** | **100.00%** |
| **Below Noise Null?** | N/A | No | **Yes ($-2.38 < -1.10$)** | **Yes ($-1.67 < -1.10$)** | **Yes ($-2.39 < -1.10$)** |
| **Residual Alpha vs BTC** | N/A | $-1.31$ ($t = -18.03, p=0.000$) | $-0.0066$ ($t = -1.52, p=0.129$) | $-9.22$ ($t = -77.21, p=0.000$) | $-0.0275$ ($t = -4.05, p=0.000$) |
| **Verdict** | Baseline | **no edge** | **no edge** | **no edge** | **no edge** |

### Definitive Invariant
Under a 50 bps round-trip friction and strict-fill execution, 15-minute stops ($0.15\% - 0.45\%$) require paying $1.0\text{R}$ to $3.3\text{R}$ per trade in transaction costs alone. Over $99.7\%$ of trades violate $\text{cost\_R} \le 0.15$. Out-of-sample performance drops below the noise-null random-walk baseline. The engine possesses **no edge**.
