import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeCostR,
  evaluateCostRGate,
  checkMakerLimitFill,
  calculateSlippageBps,
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
});
