# Research Notes: Lessons from External Algorithmic Repositories
**Repository Audit & Rigorous Lookahead Analysis**  
**Date:** 2026-11-10  
**Branch:** `feat/learn-from-repos`  
**Location:** `docs/research/REPO_LESSONS.md`

---

## 1. smart-money-concepts (`joshyattridge/smart-money-concepts`)

### 1.1 How Values are Placed & The Lookahead Architecture
The `smartmoneyconcepts` library provides vectorized and loop-based indicators for market structure. However, auditing the raw source code (`smartmoneyconcepts/smc.py`) reveals critical future-indexing conventions:

1. **`swing_highs_lows(ohlc, swing_length=5)`:**
   - **Mechanism:** Lines 153–162 evaluate:
     ```python
     ohlc["high"] == ohlc["high"].shift(-(swing_length // 2)).rolling(swing_length).max()
     ```
   - **Lookahead Trap:** To determine if candle $i$ is a swing high, it shifts future candles backwards by `swing_length // 2` bars. Candle $i$ cannot be confirmed as a swing high until candle $i + \text{swing\_length}$ closes. If a backtest assumes candle $i$ is known at candle $i$, it leaks future price action.
   
2. **`bos_choch(ohlc, swing_highs_lows, close_break=True)`:**
   - **Mechanism:** Lines 258–288 write the signal into a historical index:
     ```python
     bos[last_positions[-2]] = 1  # Sets BOS at the earlier swing candle!
     ```
   - **`BrokenIndex`:** Lines 335–353 find the future candle where price actually breaks the level:
     ```python
     broken[i] = j  # The index of the candle that actually broke the level
     ```
   - **Lookahead Trap:** A naive query like `df['BOS'] == 1` flags candle `i` (the swing point from 10 to 40 bars ago) as having broken structure. But the break didn't occur until candle `BrokenIndex`! Reading `df['BOS']` at index $i$ is catastrophic future lookahead.

3. **`liquidity(ohlc, swing_highs_lows, range_percent=0.01)`:**
   - **Mechanism:** Lines 606–630 mark liquidity at row $i$ and record future columns:
     - `End`: The index of the last liquidity level in the pool.
     - `Swept`: The index of the candle that later breaches the liquidity level (`ohlc_high[c_start:] >= range_high`).
   - **Lookahead Trap:** At bar $i$, `Swept` already holds the index of a future liquidation event. Evaluating `df['Liquidity'] != 0` at row $i$ uses knowledge of future liquidity sweeps.

### 1.2 Deriving a Tradable, Zero-Lookahead Event Time
To use SMC concepts systematically without lookahead bias:
- **Tradable BOS Event Bar:** The event occurs at bar $t = \text{BrokenIndex}$ (when a bar closes across the confirmed swing level).
  - Pre-requisite: The broken swing point $s$ must have satisfied $s + \text{swing\_length} \le t$.
  - Entry: Market order filled at `Open(t + 1)`.
- **Tradable Liquidity Sweep (SFP) Event Bar:** The event occurs at bar $t = \text{Swept}$ (the bar whose wick sweeps beyond the liquidity pool level but closes back inside the structure).
  - Entry: Mean-reversion order filled at `Open(t + 1)`.

---

## 2. freqtrade-strategies (`freqtrade/freqtrade-strategies`)

### 2.1 `FixedRiskRewardLoss.py`
- **Dynamic ATR Sizing & Stop:** Calculates stop loss dynamically as `close - (2.0 * ATR14)`. This guarantees stop distances adapt to prevailing market volatility rather than an arbitrary percentage.
- **R:R Multiple Target:** Uses `take_profit_price_abs = open_rate + (risk_distance * 3.5)`.
- **Fee-Shield Breakeven Trigger:**
  - Evaluates `current_profit >= break_even_profit_pct` where `break_even_profit_distance = risk_distance * 1.0` (+1R).
  - When $+1\text{R}$ is reached, stop loss slides to `open_rate * (1 + fees)` (true breakeven).
  - **Lesson vs +0.30R:** A breakeven ratchet at $+1\text{R}$ gives trades breathing room to survive natural retests (-0.52% average pullback observed after 4H breakouts). In contrast, setting breakeven at $+0.30\text{R}$ prematurely stopped out 41% of winning swing runners.

### 2.2 `InformativeSample.py` & `merge_informative_pair`
- **Higher-Timeframe Alignment:** Demonstrates how to merge higher timeframe (HTF) context (e.g., 1D trend into 4H, or 15m into 5m) without lookahead bias.
- **The Causality Rule:** An HTF bar is only accessible after its final close. `merge_informative_pair` uses `ffill=True` anchored strictly to the timestamp of the closed HTF candle. No incomplete candle data is ever exposed to lower timeframe evaluation.

### 2.3 `TrendFollowingStrategy.py` (What it Does Wrong)
Auditing `user_data/strategies/futures/TrendFollowingStrategy.py` highlights fatal design mistakes:
1. **5-Minute Timeframe Churn:** Generates hundreds of micro-trades. With exchange taker friction at 0.1144% round-trip, fee drag eats 25% to 45% of gross expectancy on tight stops.
2. **Fixed -26.5% Stop Loss (`stoploss = -0.265`):** Arbitrary, static stop disconnected from volatility. In high volatility, it takes massive catastrophic losses; in low volatility, it never cuts losing positions.
3. **Rigid ROI Table (`minimal_roi = {"0": 0.15, "30": 0.1, "60": 0.05}`):** Chokes winning trends early by exiting on fixed calendar elapsed time rather than letting trailing stops follow the market expansion.

---

## 3. Macro Cycles & Logarithmic Regression (`bitcoin_risk` & `btc-risk-metric`)

### 3.1 What They Compute
Both repositories implement Benjamin Cowen's Bitcoin secular power-law model:
$$\ln(\text{Price}) = a + b \cdot \ln(t)$$
where $t$ is days elapsed since Bitcoin Genesis (2009-01-03).
Residuals $\epsilon_t = \ln(\text{Price}_t) - \ln(\text{Fit}_t)$ are mapped to a 0.0 to 1.0 Risk Metric:
$$\text{Risk}_t = \frac{\epsilon_t - \min(\epsilon)}{\max(\epsilon) - \min(\epsilon)}$$

### 3.2 Assumptions
1. **Diminishing Returns:** Price growth decelerates logarithmically with calendar age.
2. **Mean-Reverting Secular Channel:** Price cycles swing symmetrically around a deterministic secular anchor.
3. **Stationary Residual Bounds:** Assumes cycle peak bubbles and cycle capitulation bottoms maintain consistent residual bounds across cycles.

### 3.3 Lookahead Bias & Required Fixes
- **Whole-Sample OLS Fitting:** Fitting `polyfit` across 2020–2026 leaks future prices into past trend estimates. For example, fitting at $t=1000$ (late 2022) with the full dataset yields slope $4.3383$, while fitting strictly on data up to $t=1000$ yields slope $7.6045$ (a massive lookahead discrepancy of $3.2662$).
- **Whole-Sample Min/Max Normalization:** Dividing by $\max(\epsilon) - \min(\epsilon)$ of the entire 6-year history leaks the 2021 bull market peak and 2022 FTX crash depths into early 2020 calculations.
- **Mandatory Quant Fix:**
  1. Use **expanding-window OLS** fitting: At day $t$, parameters $a_t, b_t$ are fit ONLY on days $0 \dots t$.
  2. Use **expanding-window percentile rank**: At day $t$, risk is $\text{PercentileRank}(\epsilon_t \mid \epsilon_0 \dots \epsilon_t) \in [0.0, 1.0]$.
