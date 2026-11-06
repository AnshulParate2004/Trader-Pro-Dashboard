import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Import real production implementations directly from codebase
import { computePurePerformanceMetrics, TradeOrder } from "../src/lib/tradingEngine";
import {
  computeRoundTripFrictionPercent,
  computeTradeCost,
  TAKER_BASE_FEE_PERCENT,
  GST_RATE_PERCENT,
} from "../src/lib/feeModel";

function createMockTrade(partial: Partial<TradeOrder>): TradeOrder {
  return {
    id: "t_mock",
    symbol: "BTCUSDT",
    direction: "LONG",
    orderType: "TAKER",
    modelId: "15m-sniper-030",
    modelName: "15M Sniper (+0.30R)",
    entryPrice: 65000,
    positionSizeINR: 1000,
    coins: 0.015,
    feePercentage: 0.040,
    gstPercentage: 18.0,
    entryFeeINR: 0.472,
    exitFeeINR: 0.472,
    slippageINR: 0.2,
    totalFeeINR: 1.144,
    grossPnLINR: 0,
    netPnLINR: 0,
    stopLoss: 64500,
    breakevenTrigger: 65200,
    breakevenLocked: 65000,
    breakevenActivated: false,
    takeProfit1: 65500,
    takeProfit2: 66000,
    triggerReason: "ML Signal",
    status: "CLOSED",
    openedAt: 1000,
    closedAt: 2000,
    ...partial,
  };
}

describe("Live Production Metric & Fee Model Consistency Tests", () => {
  test("Exchange friction identity: standard Taker round-trip friction must equal 0.1144%", () => {
    // 0.040% base + 18% GST = 0.0472% per side
    // 0.010% slippage per side
    // One side total = 0.0572%
    // Round trip = 2 * 0.0572% = 0.1144%
    const friction = computeRoundTripFrictionPercent(TAKER_BASE_FEE_PERCENT, GST_RATE_PERCENT);
    assert.strictEqual(friction, 0.1144, "Taker round-trip friction must strictly equal 0.1144%");
  });

  test("computeTradeCost calculates exact fees, taxes, and slippage for trade entry and exit", () => {
    const pos = 1000;
    const gross = 20; // 2% gross profit
    const cost = computeTradeCost(pos, gross, 0.040, 18.0);

    // Entry: 1000 * 0.040% * 1.18 = 0.4720 INR fee, 1000 * 0.0001 = 0.1000 INR slip
    // Exit: 1020 * 0.040% * 1.18 = 0.4814 INR fee, 1020 * 0.0001 = 0.1020 INR slip
    // Total fees: 0.9534 INR, Total slip: 0.2020 INR -> Total cost: 1.16 INR
    assert.strictEqual(cost.entryFeeINR, 0.472);
    assert.strictEqual(cost.entrySlippageINR, 0.1);
    assert.strictEqual(cost.totalCostINR, 1.16);
    assert.strictEqual(cost.netPnLINR, 18.84);
  });

  test("Real computePurePerformanceMetrics: exit percentage split must strictly sum to 100.0%", () => {
    const mockTrades: TradeOrder[] = [
      createMockTrade({ id: "t1", grossPnLINR: 10, status: "CLOSED", exitReason: "Take Profit 1 Hit (+1.00R)" }),
      createMockTrade({ id: "t2", grossPnLINR: 10, status: "CLOSED", exitReason: "Take Profit 1 Hit (+1.00R)" }),
      createMockTrade({ id: "t3", grossPnLINR: 0, status: "CLOSED", exitReason: "Breakeven Ratchet Stop Hit (0.00R)" }),
      createMockTrade({ id: "t4", direction: "SHORT", grossPnLINR: -10, status: "CLOSED", exitReason: "Stop Loss Hit (-1.00R)" }),
    ];

    const metrics = computePurePerformanceMetrics(mockTrades, 0.040, 18.0);
    assert.strictEqual(metrics.closedTradesCount, 4);
    assert.strictEqual(metrics.tpCount, 2);
    assert.strictEqual(metrics.beCount, 1);
    assert.strictEqual(metrics.slCount, 1);

    const sumSplit = Number((metrics.tpPercent + metrics.bePercent + metrics.slPercent).toFixed(1));
    assert.strictEqual(sumSplit, 100.0, "TP% + BE% + SL% must strictly equal 100.0%");
  });

  test("Mathematical identity: account balance must strictly equal initial capital plus net PnL", () => {
    const mockTrades: TradeOrder[] = [
      createMockTrade({ id: "t1", grossPnLINR: 20, status: "CLOSED", exitReason: "Take Profit Hit" }),
      createMockTrade({ id: "t2", direction: "SHORT", grossPnLINR: -15, status: "CLOSED", exitReason: "Stop Loss Hit" }),
      createMockTrade({ id: "t3", grossPnLINR: 0, status: "CLOSED", exitReason: "Breakeven Hit" }),
    ];

    const metrics = computePurePerformanceMetrics(mockTrades, 0.040, 18.0);
    const expectedBalance = Number((1000 + metrics.netPnLINR).toFixed(2));
    assert.strictEqual(metrics.currentBalanceINR, expectedBalance, "currentBalanceINR must equal 1000 + netPnLINR");
  });

  test("True Win Rate vs Net Win Rate: Breakevens must be excluded from True Win Rate but included in Net Win Rate", () => {
    const mockTrades: TradeOrder[] = [
      createMockTrade({ id: "t1", grossPnLINR: 10, status: "CLOSED", exitReason: "Take Profit Hit" }),
      createMockTrade({ id: "t2", grossPnLINR: 0, status: "CLOSED", exitReason: "Breakeven Hit" }),
      createMockTrade({ id: "t3", direction: "SHORT", grossPnLINR: -10, status: "CLOSED", exitReason: "Stop Loss Hit" }),
    ];

    const metrics = computePurePerformanceMetrics(mockTrades, 0.040, 18.0);
    // True win rate: 1 TP / (1 TP + 1 SL) = 1/2 = 50.0%
    assert.strictEqual(metrics.trueWinRate, 50.0);
    // Net win rate: 1 positive net trade / 3 total closed trades = 1/3 = 33.3%
    assert.strictEqual(metrics.netWinRate, 33.3);
  });

  test("R Normalization: 0.23% stop trade and 1.00% stop trade must yield different R values proportional to true stop risk", () => {
    // Both trades have ₹1,000 position size and gross = 0 (breakeven gross, paying standard 0.1144% taker friction)
    // Trade A: Live 15M scalper stop size = 0.23% (risk = ₹2.30)
    // entry = 100,000, SL = 99,770 (slDist = 230 -> 0.23%)
    const tradeA = createMockTrade({
      id: "trade_tight_stop",
      positionSizeINR: 1000,
      entryPrice: 100000,
      stopLoss: 99770,
      takeProfit1: 100230,
      stopPct: 0.0023,
      riskAmountINR: 2.30,
      grossPnLINR: 0,
      status: "CLOSED",
      exitReason: "Breakeven Stop Hit",
    });

    // Trade B: Wide 1H model stop size = 1.00% (risk = ₹10.00)
    // entry = 100,000, SL = 99,000 (slDist = 1,000 -> 1.00%)
    const tradeB = createMockTrade({
      id: "trade_wide_stop",
      positionSizeINR: 1000,
      entryPrice: 100000,
      stopLoss: 99000,
      takeProfit1: 101000,
      stopPct: 0.01,
      riskAmountINR: 10.00,
      grossPnLINR: 0,
      status: "CLOSED",
      exitReason: "Breakeven Stop Hit",
    });

    const metricsA = computePurePerformanceMetrics([tradeA], 0.040, 18.0);
    const metricsB = computePurePerformanceMetrics([tradeB], 0.040, 18.0);

    // Expected R values:
    // Trade A: -1.144 / 2.30 = -0.497R
    // Trade B: -1.144 / 10.00 = -0.114R
    assert.ok(Math.abs(metricsA.avgNetR - (-0.497)) < 0.005, `Trade A avgNetR (${metricsA.avgNetR}) should be ~ -0.497R`);
    assert.ok(Math.abs(metricsB.avgNetR - (-0.114)) < 0.005, `Trade B avgNetR (${metricsB.avgNetR}) should be ~ -0.114R`);
    assert.notStrictEqual(metricsA.avgNetR, metricsB.avgNetR, "R values must differ based on actual stop risk");
    assert.ok(metricsA.avgNetR < metricsB.avgNetR, "Tighter stop must suffer higher friction in R units");
  });
});
