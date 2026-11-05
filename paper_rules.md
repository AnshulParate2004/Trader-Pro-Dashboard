# Paper Trading Protocol & Execution Rules: Setup 1H-A (BTCUSDT Only)

**Date Created:** 2026-10-31  
**Status:** FROZEN — DO NOT EDIT DURING THE TEST  
**Scope:** `BTCUSDT` Only  

---

## 1. Frozen Setup Configuration
- **Strategy:** 1H-A BTC Scalper / Swing
- **Timeframe:** 1H (closed candles only)
- **Asset:** `BTCUSDT` (USDT-M Futures)
- **Model Files & Checksums:**
  - Python Model: `notebooks/model/1h/final_model_BTCUSDT_1h.joblib`  
    `SHA256: A3D8A2E5C20B9D7D359E02EC454373BAFCC825604FF61A32F1EDE0D5B3FF46E2`
  - Inference JSON: `src/models/lgbm_1h.json`  
    `SHA256: D1F05B72A98A02EE374041FCCC1379F424CF1FEDE28F25A866A96F0B25020339`
- **Bar Trigger:** Executed strictly once per hour on completed, closed 1H candles.
- **Target / Stop:** 1:1 TP / SL ($\text{TP} = +1.0 \times \text{ATR}$, $\text{SL} = -1.0 \times \text{ATR}$).
- **Breakeven Trigger:** Trigger at $+0.30\text{R}$, locking the round-trip fee friction ($\text{cost\_R}$).
- **Conviction Cutoff:** Top 20% ML prediction conviction (expanding-window threshold, no lookahead).
- **Volatility Filter:** Skip trade if round-trip fee $\text{cost\_R} > 0.15$ ($\text{stop\_distance} < 0.763\%$).
- **Honest Fee Model:** Taker 0.040% per side + 18% GST ($0.0472\% \times 2$) + 0.010% slippage per side ($0.01\% \times 2$) = **0.1144% round-trip notional**.
- **Data Isolation:** Strictly recorded in MongoDB collection `paper_1h_a`. All live production collections (`trade_logs`) remain untouched.

---

## 2. Objective & Scope of Paper Trading
- **Primary Function:** The paper run is strictly an **execution and consistency check** (validating whether live signals match what the backtest produces candle-by-candle without slippage leakage, timing desync, or runtime errors).
- **No 300-Trade Pass/Fail Gate:** On BTCUSDT alone, setup 1H-A generated approximately 104 trades over 2.5 years (~40 trades/year). Reaching 300 trades would take roughly 7 years. Therefore, no 300-trade pass/fail rule is imposed for edge determination; the edge question is evaluated via sealed historical windows.

---

## 3. Reporting Protocol
- **Cadence:** Weekly check-in.
- **Metrics Tracked:**
  1. Live paper trade count written to `paper_1h_a`.
  2. Average Net R per trade (taker after fees and slippage).
  3. 10,000-resample Bootstrap 95% Confidence Interval.
  4. Signal-by-signal live match rate: verification that live generated signals match backtest signals on the exact same closed candles.
  5. Skipped signals log: count and reason for any filtered trades ($\text{cost\_R} > 0.15$).

---

## 4. Frozen Rules Invariant
- Zero strategy parameters, thresholds, or indicators may be modified during the forward paper test.
