import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  checkCostRFilter,
  evaluateRollingKillSwitch,
  checkDailyLossLimit,
  checkMaxDrawdownLimit,
  DEFAULT_MAX_COST_R,
  FROZEN_1HA_MAX_COST_R,
} from "../src/lib/riskEngine";
import { TradeOrder } from "../src/lib/engineTypes";

function createSyntheticTrade(
  id: string,
  netR: number,
  closedAt: number = Date.now(),
  status: TradeOrder["status"] = "CLOSED"
): TradeOrder {
  const pos = 1000;
  const oneR = pos * 0.01; // ₹10 per 1R
  const netPnL = netR * oneR;

  return {
    id,
    symbol: "BTCUSDT",
    direction: "LONG",
    orderType: "TAKER",
    modelId: "test-model",
    modelName: "Test Model",
    entryPrice: 65000,
    positionSizeINR: pos,
    coins: 0.015,
    feePercentage: 0.04,
    gstPercentage: 18.0,
    entryFeeINR: 0.472,
    exitFeeINR: 0.472,
    slippageINR: 0.2,
    totalFeeINR: 1.144,
    grossPnLINR: netPnL + 1.144,
    netPnLINR: netPnL,
    stopLoss: 64350,
    breakevenTrigger: 65200,
    breakevenLocked: 65000,
    breakevenActivated: false,
    takeProfit1: 65650,
    takeProfit2: 66000,
    stopPct: 0.01,
    riskAmountINR: oneR,
    triggerReason: "Synthetic test",
    status,
    openedAt: closedAt - 60000,
    closedAt,
  };
}

describe("Risk Engine & Execution Safeguards Tests", () => {
  describe("1. Max cost_R Friction Filter", () => {
    test("rejects tight stops that exceed max cost_R = 0.08", () => {
      // 0.1144% round-trip friction with 0.50% stop -> cost_R = 0.1144 / 0.50 = 0.2288 > 0.08
      const res = checkCostRFilter(0.5, DEFAULT_MAX_COST_R, 0.1144);
      assert.strictEqual(res.passed, false);
      assert.ok(res.costR > DEFAULT_MAX_COST_R);
    });

    test("passes wider stops where cost_R <= 0.08", () => {
      // 0.1144% round-trip friction with 2.0% stop -> cost_R = 0.1144 / 2.0 = 0.0572 <= 0.08
      const res = checkCostRFilter(2.0, DEFAULT_MAX_COST_R, 0.1144);
      assert.strictEqual(res.passed, true);
      assert.strictEqual(res.costR, 0.0572);
    });

    test("preserves frozen 1H-A threshold of 0.15", () => {
      // 0.1144% friction with 1.0% stop -> cost_R = 0.1144
      // Fails 0.08 filter but passes frozen 1H-A 0.15 filter
      const resNew = checkCostRFilter(1.0, DEFAULT_MAX_COST_R, 0.1144);
      assert.strictEqual(resNew.passed, false);

      const res1HA = checkCostRFilter(1.0, FROZEN_1HA_MAX_COST_R, 0.1144);
      assert.strictEqual(res1HA.passed, true);
    });
  });

  describe("2. Rolling 100-Trade Kill Switch", () => {
    test("does not trigger when fewer than 100 closed trades exist", () => {
      const trades: TradeOrder[] = [];
      for (let i = 0; i < 50; i++) {
        trades.push(createSyntheticTrade(`t_${i}`, -0.1));
      }
      const res = evaluateRollingKillSwitch(trades);
      assert.strictEqual(res.shouldKill, false);
      assert.strictEqual(res.tradeCount, 50);
    });

    test("triggers when rolling 100-trade average net R is below -0.05R", () => {
      const trades: TradeOrder[] = [];
      // 100 trades with net R averaging -0.08R
      for (let i = 0; i < 100; i++) {
        trades.push(createSyntheticTrade(`t_${i}`, -0.08));
      }
      const res = evaluateRollingKillSwitch(trades);
      assert.strictEqual(res.shouldKill, true);
      assert.strictEqual(res.avgNetR, -0.08);
      assert.ok(res.reason && res.reason.includes("Rolling Kill Switch Activated"));
    });

    test("does not trigger when rolling 100-trade average net R is positive or above -0.05R", () => {
      const trades: TradeOrder[] = [];
      for (let i = 0; i < 100; i++) {
        trades.push(createSyntheticTrade(`t_${i}`, +0.02));
      }
      const res = evaluateRollingKillSwitch(trades);
      assert.strictEqual(res.shouldKill, false);
      assert.strictEqual(res.avgNetR, 0.02);
    });
  });

  describe("3. Daily Loss Limit (-3R default)", () => {
    test("triggers when closed trades today exceed -3.0R daily loss", () => {
      const now = Date.now();
      const trades: TradeOrder[] = [
        createSyntheticTrade("t_1", -1.0, now - 3600000),
        createSyntheticTrade("t_2", -1.0, now - 1800000),
        createSyntheticTrade("t_3", -1.5, now - 900000),
      ]; // Total today = -3.5R

      const res = checkDailyLossLimit(trades, now, -3.0);
      assert.strictEqual(res.limitExceeded, true);
      assert.strictEqual(res.todayNetR, -3.5);
      assert.ok(res.reason && res.reason.includes("Daily Loss Limit Exceeded"));
    });

    test("does not trigger when today's loss is within -3.0R", () => {
      const now = Date.now();
      const trades: TradeOrder[] = [
        createSyntheticTrade("t_1", -1.0, now - 3600000),
        createSyntheticTrade("t_2", +0.5, now - 1800000),
        createSyntheticTrade("t_3", -1.0, now - 900000),
      ]; // Total today = -1.5R

      const res = checkDailyLossLimit(trades, now, -3.0);
      assert.strictEqual(res.limitExceeded, false);
      assert.strictEqual(res.todayNetR, -1.5);
    });

    test("ignores trades closed on previous UTC days", () => {
      const now = Date.now();
      const yesterday = now - 86400000 * 2;
      const trades: TradeOrder[] = [
        createSyntheticTrade("t_old", -5.0, yesterday),
        createSyntheticTrade("t_today", -0.5, now - 1000),
      ];

      const res = checkDailyLossLimit(trades, now, -3.0);
      assert.strictEqual(res.limitExceeded, false);
      assert.strictEqual(res.todayNetR, -0.5);
      assert.strictEqual(res.tradesTodayCount, 1);
    });
  });

  describe("4. Max Drawdown Stop (-10R default from peak)", () => {
    test("triggers when cumulative equity draws down by more than 10R from peak", () => {
      const now = Date.now();
      // Starts at 0, climbs to +5R peak, then declines to -6R (total drawdown = 5 - (-6) = -11R)
      const trades: TradeOrder[] = [
        createSyntheticTrade("t_1", +2.5, now - 5000),
        createSyntheticTrade("t_2", +2.5, now - 4000), // Peak = +5.0R
        createSyntheticTrade("t_3", -3.0, now - 3000), // Cum = +2.0R (DD = -3.0R)
        createSyntheticTrade("t_4", -4.0, now - 2000), // Cum = -2.0R (DD = -7.0R)
        createSyntheticTrade("t_5", -4.5, now - 1000), // Cum = -6.5R (DD = -11.5R <= -10R)
      ];

      const res = checkMaxDrawdownLimit(trades, -10.0);
      assert.strictEqual(res.limitExceeded, true);
      assert.strictEqual(res.peakCumulativeR, 5.0);
      assert.strictEqual(res.currentCumulativeR, -6.5);
      assert.strictEqual(res.currentDrawdownR, -11.5);
      assert.ok(res.reason && res.reason.includes("Max Drawdown Limit Reached"));
    });

    test("does not trigger when equity drawdown is within -10R limit", () => {
      const now = Date.now();
      const trades: TradeOrder[] = [
        createSyntheticTrade("t_1", +4.0, now - 3000),
        createSyntheticTrade("t_2", -2.0, now - 2000),
        createSyntheticTrade("t_3", -2.0, now - 1000),
      ]; // Peak = +4.0R, Current = 0.0R, DD = -4.0R

      const res = checkMaxDrawdownLimit(trades, -10.0);
      assert.strictEqual(res.limitExceeded, false);
      assert.strictEqual(res.currentDrawdownR, -4.0);
    });
  });
});
