# Paper Trading Rules & Protocol: Setup 1H-A

**Date Created:** 2026-10-31  
**Status:** FROZEN — DO NOT EDIT DURING THE TEST  

---

## 1. Frozen Setup Configuration
- **Strategy:** 1H-A Multi-Coin Scalper
- **Timeframe:** 1H
- **Pairs:** `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `BNBUSDT`, `XRPUSDT` (Identical parameters for all pairs)
- **Bar Trigger:** Closed candles only (`open_time` aligned to completed 1H bar)
- **Target / Stop:** 1:1 TP / SL ($\text{TP} = +1.0 \times \text{ATR}$, $\text{SL} = -1.0 \times \text{ATR}$, capped at 5% of price)
- **Breakeven Ratchet:** Trigger at $+0.30\text{R}$, moving Stop Loss to lock exact round-trip friction in R ($\text{cost\_R}$)
- **Conviction Cutoff:** Top 20% ML prediction probability ($P \ge 80\text{th percentile}$ of expanding past predictions, no lookahead)
- **Volatility Filter:** Skip trade if round-trip fee $\text{cost\_R} > 0.15$ ($\text{stop\_dist} < 0.763\%$)
- **Fee Model:** Taker 0.04% per side + 18% GST ($0.0472\% \times 2$) + 0.01% slippage per side ($0.01\% \times 2$) = **0.1144% round-trip notional**
- **Data Isolation:** Strictly recorded in a dedicated MongoDB collection (`paper_1h_a`). Existing live session collections (`trade_logs`) remain untouched.

---

## 2. Evaluation Checkpoints & Stopping Criteria
1. **Checkpoint 1 (300 Pooled Trades):**
   - Evaluate exactly once upon reaching 300 pooled paper trades across the 5 coins.
   - Do NOT stop early even if interim results appear positive.
   - **Success Condition:** Average Net R $> 0$ **AND** Bootstrap 95% Confidence Interval lower bound $\ge 0$.
   - **Early Termination (Failure):** If the 95% Confidence Interval upper bound is below 0 ($< 0$), immediately terminate the test and declare failure.
2. **Checkpoint 2 (600 Pooled Trades):**
   - If results at 300 trades are inconclusive (point estimate positive but CI spans zero), continue without changing any parameter to 600 pooled trades.
   - Evaluate once more at 600 trades using the same criteria.

---

## 3. Reporting Protocol
- **Weekly Check-In:**
  - Total pooled trade count.
  - Average Net R.
  - 10,000-resample Bootstrap 95% Confidence Interval (trade-level and monthly block).
  - Per-coin performance breakdown table (trades, win rate, avg net R).
  - Maximum drawdown.
- **Strict Constraint:** No parameter changes, no filter adjustments, and no feature tweaks during the entire test duration.
