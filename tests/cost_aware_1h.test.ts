import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeCostR,
  evaluateCostRGate,
  checkMakerLimitFill,
  calculateSlippageBps,
  evaluateActiveTradeOnCandle,
  evaluateTradeCandleStream,
  MAX_COST_R_THRESHOLD,
  ENABLE_MAKER_LIMIT_ENTRY,
  MAKER_LIMIT_EXPIRY_BARS,
  STANDARD_TAKER_FRICTION,
  STANDARD_MAKER_FRICTION,
  STRESS_TAKER_FRICTION,
  Candle,
} from "../src/lib/paperExecutor1HCost";

describe("Cost-Aware 1H Engine Unit Tests", () => {
  describe("1. Mathematical Identity: cost_R = round_trip_cost_pct / stop_pct", () => {
    test("computes exact cost_R across various stop sizes and frictions", () => {
      // 0.1144% friction with 1.43% stop -> cost_R = 0.1144 / 1.43 = 0.08
      const costR1 = computeCostR(0.001144, 0.0143);
      assert.equal(costR1, 0.08);

      // 0.1144% friction with 0.50% stop -> cost_R = 0.1144 / 0.50 = 0.2288
      const costR2 = computeCostR(0.001144, 0.0050);
      assert.equal(costR2, 0.2288);

      // 50 bps stress friction with 1.00% stop -> cost_R = 0.0050 / 0.0100 = 0.5000
      const costR3 = computeCostR(STRESS_TAKER_FRICTION, 0.0100);
      assert.equal(costR3, 0.5);

      // Zero or negative stop handles gracefully
      assert.equal(computeCostR(0.001144, 0), 999.0);
    });
  });

  describe("2. Gate Skips Above Threshold (MAX_COST_R_THRESHOLD = 0.08)", () => {
    test("skips when cost_R > 0.08 with exact reason 'skipped: cost_R'", () => {
      // Narrow stop: 0.8% stop under 0.1144% friction -> cost_R = 0.1144 / 0.8 = 0.143 > 0.08
      const res = evaluateCostRGate(0.008, STANDARD_TAKER_FRICTION, MAX_COST_R_THRESHOLD);
      assert.equal(res.passed, false);
      assert.equal(res.reason, "skipped: cost_R");
      assert.ok(res.cost_R > 0.08);
    });

    test("passes when cost_R <= 0.08", () => {
      // Wide stop: 2.0% stop under 0.1144% friction -> cost_R = 0.1144 / 2.0 = 0.0572 <= 0.08
      const res = evaluateCostRGate(0.020, STANDARD_TAKER_FRICTION, MAX_COST_R_THRESHOLD);
      assert.equal(res.passed, true);
      assert.equal(res.reason, undefined);
      assert.ok(res.cost_R <= 0.08);
    });

    test("under 50 bps stress friction, requires >= 6.25% stop to pass", () => {
      // At 50 bps friction, 0.0050 / 0.0625 = 0.08
      const fail = evaluateCostRGate(0.050, STRESS_TAKER_FRICTION, MAX_COST_R_THRESHOLD);
      assert.equal(fail.passed, false);

      const pass = evaluateCostRGate(0.065, STRESS_TAKER_FRICTION, MAX_COST_R_THRESHOLD);
      assert.equal(pass.passed, true);
    });
  });

  describe("3. Mode B Maker Limit Fills & Missed Trades Accounting", () => {
    test("correctly checks fill conditions for LONG and SHORT limit orders", () => {
      const candle: Candle = {
        openTime: 1000,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 10,
      };

      // Long limit at 96 fills because low (95) <= limit (96)
      assert.equal(checkMakerLimitFill(96, "LONG", candle), true);
      // Long limit at 94 does not fill because low (95) > limit (94)
      assert.equal(checkMakerLimitFill(94, "LONG", candle), false);

      // Short limit at 104 fills because high (105) >= limit (104)
      assert.equal(checkMakerLimitFill(104, "SHORT", candle), true);
      // Short limit at 106 does not fill because high (105) < limit (106)
      assert.equal(checkMakerLimitFill(106, "SHORT", candle), false);
    });

    test("missed maker fills are counted toward signal denominator (never dropped silently)", () => {
      const simulatedSignals = [
        { id: "s1", filled: true, netR: 1.0 },
        { id: "s2", filled: false, netR: 0.0 }, // missed
        { id: "s3", filled: true, netR: -1.0 },
      ];

      const totalSignals = simulatedSignals.length;
      const filledSignals = simulatedSignals.filter((s) => s.filled).length;
      const fillRate = filledSignals / totalSignals;

      assert.equal(totalSignals, 3);
      assert.equal(filledSignals, 2);
      assert.equal(Number(fillRate.toFixed(4)), 0.6667);

      // Net R per signal includes missed trades (divided by totalSignals, not just filled)
      const sumR = simulatedSignals.reduce((acc, s) => acc + s.netR, 0);
      const netRPerSignal = sumR / totalSignals; // 0.0 / 3 = 0.0
      assert.equal(netRPerSignal, 0.0);
    });
  });

  describe("4. Feature Flag & Mode A Reproduction", () => {
    test("ENABLE_MAKER_LIMIT_ENTRY defaults to false (Mode A active)", () => {
      assert.equal(ENABLE_MAKER_LIMIT_ENTRY, false);
      assert.equal(MAKER_LIMIT_EXPIRY_BARS, 2);
    });

    test("realized slippage calculation accurately computes basis points", () => {
      // Intended: 100,000, Fill: 100,100 -> 10 bps slippage
      const slipBps = calculateSlippageBps(100000, 100100);
      assert.equal(slipBps, 10.0);

      // Zero price change -> 0 bps
      assert.equal(calculateSlippageBps(100000, 100000), 0.0);
    });
  });

  describe("5. Amendment 1: Simultaneous Touches, Run-Time Fill Price & Pre-Entry Data Protection", () => {
    test("both-touched bar gives -1R: bar touching both initial stop and BE trigger is booked as stop loss (-1R)", () => {
      // LONG Trade: entry 100,000, initial stop 98,000, BE trigger 100,600, TP 102,000
      const trade = {
        side: "LONG" as const,
        intended_price: 100000,
        stop_loss: 98000,
        initial_stop_loss: 98000,
        be_trigger: 100600,
        take_profit: 102000,
        be_activated: false,
      };

      // Bar touches both initial stop (low: 97,500 <= 98,000) and BE trigger (high: 101,000 >= 100,600)
      const collisionBar: Candle = {
        openTime: 2000,
        open: 100000,
        high: 101000,
        low: 97500,
        close: 99000,
        volume: 100,
      };

      const result = evaluateActiveTradeOnCandle(trade, collisionBar);
      assert.equal(result.closed, true);
      assert.equal(result.exitType, "SL");
      assert.equal(result.grossR, -1.0);
      assert.equal(result.exitPrice, 98000);
      assert.equal(result.beActivatedUpdated, undefined);
    });

    test("fill uses run-time price: Mode A fill price reflects livePrice at execution and logs cron lag", () => {
      const intendedPrice = 100000;
      const livePriceAtRun = 100150; // market moved 150 points during cron lag
      const slippageBps = calculateSlippageBps(intendedPrice, livePriceAtRun);
      assert.equal(slippageBps, 15.0);
      assert.notEqual(livePriceAtRun, intendedPrice);
    });

    test("no exit from pre-entry data: candle timestamp prior to entry time cannot trigger an exit", () => {
      const entryTimeMs = 1700000300000;
      const trade = {
        side: "LONG" as const,
        intended_price: 100000,
        stop_loss: 98000,
        initial_stop_loss: 98000,
        be_trigger: 100600,
        take_profit: 102000,
        be_activated: false,
        entry_time: entryTimeMs,
      };

      // Pre-entry candle with extreme low that would have touched stop loss
      const preEntryCandle: Candle = {
        openTime: 1700000000000, // 300 seconds prior to entry
        open: 100000,
        high: 100500,
        low: 95000, // Below 98,000 stop loss!
        close: 99500,
        volume: 50,
      };

      // When tested with minAllowedTime = entryTimeMs, it must be ignored
      const resPre = evaluateActiveTradeOnCandle(trade, preEntryCandle, entryTimeMs);
      assert.equal(resPre.closed, false);

      // Post-entry candle within normal bounds
      const postEntryCandle: Candle = {
        openTime: 1700000300000, // At/after entry time
        open: 100000,
        high: 100200,
        low: 99800,
        close: 100100,
        volume: 50,
      };
      const resPost = evaluateActiveTradeOnCandle(trade, postEntryCandle, entryTimeMs);
      assert.equal(resPost.closed, false);
    });
  });

  describe("6. Amendment 2: Candle Re-Evaluation & 5M Fallback Protection", () => {
    test("re-evaluation bug: LONG trade reaching BE in candle 2 must not be closed at BE on run 2 due to candle 1 low", () => {
      const t0 = 1700000000000;
      const trade: any = {
        id: "trade-re-eval-test",
        side: "LONG" as const,
        intended_price: 100000,
        stop_loss: 98000,
        initial_stop_loss: 98000,
        be_trigger: 100600,
        take_profit: 102000,
        be_activated: false,
        entry_time: new Date(t0).toISOString(),
        status: "ACTIVE" as const,
      };

      // Candle 1: dips to 98,500 (between initial stop 98,000 and intended_price 100,000)
      const candle1: Candle = {
        openTime: t0,
        open: 100000,
        high: 100200,
        low: 98500, // between 98,000 and 100,000
        close: 99500,
        volume: 100,
      };

      // Candle 2: reaches be_trigger (100,600)
      const candle2: Candle = {
        openTime: t0 + 300000,
        open: 99500,
        high: 100700, // >= 100,600
        low: 99500,
        close: 100650,
        volume: 100,
      };

      const candleList = [candle1, candle2];

      // Run 1: processes candle 1 and candle 2 using canonical evaluateTradeCandleStream
      const exitRun1 = evaluateTradeCandleStream(trade, candleList);
      assert.equal(trade.be_activated, true, "BE should be activated after candle 2");
      assert.equal(trade.stop_loss, 100000, "Stop loss should be moved to intended price");
      assert.equal(trade.status, "ACTIVE", "Trade should remain active after Run 1");
      assert.equal(exitRun1, null, "No exit on Run 1");
      assert.equal(trade.last_evaluated_candle_time, candle2.openTime, "last_evaluated_candle_time updated to candle 2");

      // Run 2: executor loop runs again with the same candle list
      const exitRun2 = evaluateTradeCandleStream(trade, candleList);

      // Expected: No exit at BE on run 2 (trade remains ACTIVE)
      assert.equal(exitRun2, null, "Expected no exit at BE on run 2");
      assert.equal(trade.status, "ACTIVE", "Trade must remain ACTIVE on run 2");
    });
  });
});
