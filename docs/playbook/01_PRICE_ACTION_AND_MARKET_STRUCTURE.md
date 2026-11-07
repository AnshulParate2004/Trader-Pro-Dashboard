# Quantitative Price Action, Market Structure & Order Flow Microstructure

> **Document Path:** `docs/playbook/01_PRICE_ACTION_AND_MARKET_STRUCTURE.md`  
> **Source Synthesis:** CryptoCred Technical Analysis Series, The Trading Channel, Rayner Teo, A&A Trading Blog  
> **Target Assets:** Bitcoin (`BTCUSDT`), Ethereum (`ETHUSDT`), Solana (`SOLUSDT`), Gold (`GC=F` / `XAUUSD`), Silver (`SI=F` / `XAGUSD`)  
> **Status:** RATIFIED INSTITUTIONAL PLAYBOOK  

---

## 1. Structural Market Phasing & Trend Logic

Directional edge begins with objective, non-predictive multi-timeframe structural mapping. Indicators and candlestick patterns produce high rates of false positives when evaluated outside of structural market phases.

```
Uptrend (Bullish Structure):        Downtrend (Bearish Structure):
          [HH2]                               [LH1]
          /   \                               /   \
      [HL1]   [HL2]                       [LL1]   [LH2]
      /   \                                       /   \
  [HH1]                                       [LL2]
```

### 1.1 Structural Definitions
- **Higher High (HH):** Price closes above the preceding swing high on the reference timeframe.
- **Higher Low (HL):** A corrective trough that terminates above the prior swing low before price advances to print a new HH.
- **Lower Low (LL):** Price closes below the preceding swing low.
- **Lower High (LH):** A corrective rally that terminates below the prior swing high before price descends to print a new LL.

### 1.2 Break of Structure (BOS) vs. Market Structure Shift (MSS / CHoCH)
- **Break of Structure (BOS) — Trend Continuation:**
  - Occurs when price breaks and closes beyond an active swing point in the direction of the established higher-timeframe trend.
  - Bullish BOS: Candle close above current $HH$.
  - Bearish BOS: Candle close below current $LL$.
- **Market Structure Shift (MSS) / Change of Character (CHoCH) — Trend Reversal:**
  - Occurs when price fails to sustain the prevailing sequence and breaches the swing point that generated the latest extreme.
  - Bullish-to-Bearish MSS: Price fails to print a higher high (prints an equal or lower high) and decisively closes below the prior higher low ($HL$) with displacement (elevated volume and wide-range candle body).
  - Bearish-to-Bullish MSS: Price fails to print a lower low (prints a higher low) and closes above the prior lower high ($LH$) with displacement.

### 1.3 The Structural Invalidation Invariant
> [!IMPORTANT]
> A structural level is **never** invalidated by an intraday wick or shadow. Structural invalidation strictly requires a **candle body close** beyond the boundary on the execution timeframe. Wicks that pierce levels without candle body closure represent liquidity sweeps (see Section 4).

---

## 2. Support & Resistance Mechanics: The Sledgehammer Principle

Traditional retail technical analysis treats Support and Resistance (S/R) as rigid floors and ceilings that become "stronger the more times they are tested." Institutional order flow proves the exact opposite.

### 2.1 The Degradation of Levels (Order Absorption)
- Institutional participants execute large volume via resting limit orders (passive liquidity) clustered at historical inflection zones.
- **The Sledgehammer Principle:** Every test of a support level absorbs a portion of the resting buy limit orders. Repeated tests exhaust the available liquidity pool. Like a wooden door struck repeatedly by a sledgehammer, the barrier weakens with each impact until an aggressive market order cascades through it.

```
Level Weakening Sequence:
Touch 1: Strong absorption -> sharp, high-volume reaction bounce.
Touch 2: Moderate absorption -> weaker reaction bounce.
Touch 3: Passive orders depleted -> shallow bounce, lower highs compressing into the floor.
Touch 4+: Order book vacuum -> violent breakdown.
```

### 2.2 Buildup into Levels
- **Ascending Compression into Resistance:** When price prints higher lows into a horizontal resistance ceiling, supply is drying up. Breakout upward is imminent.
- **Descending Compression into Support:** When price prints lower highs into a horizontal support floor, demand is drying up. Breakdown downward is imminent.
- **Rule:** Never initiate mean-reversion counter-trend trades against a level displaying aggressive compression buildup.

### 2.3 The Support-to-Resistance (S/R) Role Reversal
When a critical level breaks decisively, market microstructure flips:
1. **Trapped Traders:** Market participants who bought the support test are caught offside. On any corrective retracement back toward the broken level, trapped buyers exit at break-even ($0.00\text{R}$), transforming former buying interest into overhead supply.
2. **Breakout Re-testers:** Systematic and institutional sellers wait for the corrective pullback into the broken level to establish fresh short positions with tight invalidation.
3. **Execution Protocol:**
   - Wait for a decisive candle close breaking support.
   - Await a low-momentum, corrective retracement back into the broken level (now dynamic resistance).
   - Require an exhaustion confirmation candle (pin bar / shooting star / bearish engulfing).
   - Place stop loss $1.0 \times \text{ATR}$ beyond the rejection wick high.

---

## 3. Range Mechanics & Equilibrium Trading

When market structure ceases to print directional sequences (BOS), it transitions into an equilibrium regime (horizontal consolidation).

```
Range High (RH)   ═════════════════════════════════  [Premium / Institutional Supply]
                         ▲               │
                         │ Retest Reclaim│
Midpoint (EQ / 0.50)  - -│ - - - - - - - ▼ - - - -  [Fair Value / Equilibrium]
                         │               │
Range Low (RL)    ═════════════════════════════════  [Discount / Institutional Demand]
```

### 3.1 Mapping Range Boundaries
- **Range Low (RL):** Established after an initial sell-off meets aggressive buying that produces a sharp, high-volume reaction bounce.
- **Range High (RH):** The swing high established by that relief bounce before price turns back down.
- **Equilibrium (EQ / 0.50):** The mathematical midpoint:
  $$\text{EQ} = \frac{\text{Range High} + \text{Range Low}}{2}$$

### 3.2 The Operational Invariants of Range Trading
1. **Never Trade the Midpoint (EQ):** The midpoint represents fair value where order flow is balanced. Entering trades at EQ yields the lowest risk-to-reward ratio ($\text{R:R} \approx 1:1$) and exposes capital to random chop.
2. **Fade the Periphery:**
   - Look for long entries strictly in the **Discount Zone** (between RL and RL $+ 0.25 \times \text{Range Width}$).
   - Look for short entries strictly in the **Premium Zone** (between RH and RH $- 0.25 \times \text{Range Width}$).
3. **Acceptance vs. Rejection:**
   - **Acceptance:** Price breaks outside the boundary, consolidates with multiple candle closes, and holds the retest. This confirms trend expansion.
   - **Rejection (Deviation):** Price pierces the boundary, fails to print follow-through candle closes, and snaps back inside the range.

---

## 4. Liquidity Sweeps, Deviations & Swing Failure Patterns (SFP)

Institutional participants cannot enter large positions with market orders without causing unacceptable slippage. They must engineer liquidity by forcing retail stops to trigger.

```
                    [Liquidity Sweep / Deviation]
                                 ▲
                     ┌───────────│───────────┐
                     │ Buy Stops Triggered    │
                     │ Breakout Buyers Trapped│
═════════════════════╪═══════════════════════╪═══════ Range High (RH)
                     │ Reclaim on Close      │
                     │ Aggressive Sell Entry  │
                     └───────────┬───────────┘
                                 ▼
```

### 4.1 Anatomy of a Liquidity Sweep
1. **The Trap:** Price spikes above a multi-day swing high or Range High.
   - Retail breakout traders execute aggressive market buy orders.
   - Retail short sellers have their buy stop-loss orders triggered.
   - Both order types flood the exchange order book with **market buy liquidity**.
2. **The Institutional Absorption:** Large institutional algorithms match their massive sell limit orders against this retail buy surge, absorbing all liquidity.
3. **The Deviation Reclaim:** As retail buying power exhausts, price aggressively reverses and prints a candle close **back inside the range** (below RH).
4. **Swing Failure Pattern (SFP) Trigger:**
   - Entry: At the market close of the candle that reclaims the broken level.
   - Invalidation (Stop Loss): Placed $0.2 \times \text{ATR}$ above the absolute high of the sweep wick.
   - Target 1: Range Midpoint ($\text{EQ}$).
   - Target 2: Range Low ($\text{RL}$) — full rotation.

---

## 5. Algorithmic Implementation Architecture

For autonomous trading engines, these price action principles translate into strict deterministic rules:

```typescript
export interface MarketStructureState {
  currentRegime: "TRENDING_BULL" | "TRENDING_BEAR" | "RANGING_EQUILIBRIUM";
  lastSwingHigh: number;
  lastSwingLow: number;
  rangeHigh?: number;
  rangeLow?: number;
  equilibrium?: number;
  isSweepDetected: boolean;
  sweepSide?: "SWEEP_HIGH" | "SWEEP_LOW";
}

export function detectSwingFailurePattern(
  candles: { high: number; low: number; close: number }[],
  referenceLevel: number,
  side: "SWEEP_HIGH" | "SWEEP_LOW"
): boolean {
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];

  if (side === "SWEEP_HIGH") {
    // Current candle pierced above level but closed strictly below it
    const piercedAbove = current.high > referenceLevel;
    const closedBelow = current.close < referenceLevel;
    const volumeExhaustion = current.close < previous.close;
    return piercedAbove && closedBelow && volumeExhaustion;
  } else {
    // Current candle pierced below level but closed strictly above it
    const piercedBelow = current.low < referenceLevel;
    const closedAbove = current.close > referenceLevel;
    const volumeExhaustion = current.close > previous.close;
    return piercedBelow && closedAbove && volumeExhaustion;
  }
}
```
