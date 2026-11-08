import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  computeClampedStop,
  checkCandidateBreakoutSignal,
  evaluateActiveTradeOnBar,
  runPaper4HSwingExecutor,
  clearInMemorySwingTrades,
  getInMemorySwingTrades,
  Swing4HCandle,
  PaperTrade4HSwingRecord,
  ROUND_TRIP_FRICTION_PCT,
  TARGET_R,
  STOP_R,
  TIME_BARRIER_BARS,
} from "../src/lib/paperExecutor4HSwing";
import {
  predictSwingMetaProb,
  loadSwing4HModel,
} from "../src/lib/swingModelInference";

function generateSyntheticCandles(
  count: number = 250,
  startPrice: number = 100.0,
  trendSlope: number = 0.2
): Swing4HCandle[] {
  const candles: Swing4HCandle[] = [];
  let price = startPrice;
  const baseTime = Date.parse("2026-01-01T00:00:00.000Z");

  for (let i = 0; i < count; i++) {
    const open = price;
    price += trendSlope;
    const close = price;
    const high = Math.max(open, close) + 0.5;
    const low = Math.min(open, close) - 0.5;
    const volume = 1000 + i * 2;
    const openTime = baseTime + i * 4 * 3600 * 1000;

    candles.push({
      openTime,
      open,
      high,
      low,
      close,
      volume,
      closeTime: openTime + 4 * 3600 * 1000 - 1,
    });
  }

  return candles;
}

describe("4H Swing Meta-Labeling Engine Unit Tests", () => {
  beforeEach(() => {
    clearInMemorySwingTrades();
  });

  describe("1. LightGBM TypeScript In-Memory Tree Inference", () => {
    test("loads model and reproduces Python verification samples within 1e-5", () => {
      const { metadata } = loadSwing4HModel();
      assert.ok(metadata.num_trees >= 100, "Should load at least 100 trees");
      assert.equal(metadata.p_cutoff, 0.10, "Default P_cutoff should be 0.10");

      const samples = metadata.verification_samples || [];
      assert.ok(samples.length > 0, "Verification samples should be populated");

      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        const res = predictSwingMetaProb(s.feature_array);
        const diff = Math.abs(res.probability - s.expected_prob);
        assert.ok(
          diff < 1e-5,
          `Sample ${i} mismatch: predicted ${res.probability} vs expected ${s.expected_prob} (diff ${diff})`
        );
      }
    });

    test("handles NaN and missing features gracefully with default path traversal", () => {
      const emptyFeatures: Record<string, number> = {};
      const res = predictSwingMetaProb(emptyFeatures);
      assert.ok(!isNaN(res.probability), "Probability should not be NaN");
      assert.ok(res.probability > 0 && res.probability < 1, "Probability should be valid bounded float");
    });
  });

  describe("2. Setup Detection: 20-bar Donchian Breakout + 200 SMA", () => {
    test("rejects when close is below 200 SMA", () => {
      const candles = generateSyntheticCandles(250, 100, -0.1); // downward trend
      const setup = checkCandidateBreakoutSignal(candles);
      assert.equal(setup.isBreakout, false);
      assert.ok(setup.reason?.includes("200 SMA"));
    });

    test("rejects when close is above 200 SMA but does not exceed 20-bar high", () => {
      const candles = generateSyntheticCandles(250, 100, 0.2); // upward trend
      // Make the last candle dip below the prior 20-bar high
      candles[candles.length - 1].close = candles[candles.length - 5].high - 1.0;
      const setup = checkCandidateBreakoutSignal(candles);
      assert.equal(setup.isBreakout, false);
      assert.ok(setup.reason?.includes("20-bar high"));
    });

    test("identifies valid breakout when close > 200 SMA and close > max(High t-20..t-1)", () => {
      const candles = generateSyntheticCandles(250, 100, 0.2);
      // Ensure the last bar cleanly breaks above all preceding 20 bars
      const prior20High = Math.max(...candles.slice(-21, -1).map((c) => c.high));
      candles[candles.length - 1].close = prior20High + 2.0;

      const setup = checkCandidateBreakoutSignal(candles);
      assert.equal(setup.isBreakout, true);
      assert.ok(setup.entryPrice > setup.sma200);
      assert.ok(setup.entryPrice > setup.donchianHigh20);
    });

    test("clamps structural stop strictly between 1.5% and 6.0%", () => {
      const entryPrice = 100.0;

      // Case A: Very tight stop (0.5% distance) -> clamped to 1.5%
      const resTight = computeClampedStop(entryPrice, 99.5);
      assert.equal(resTight.stopDistPct, 0.015);
      assert.equal(resTight.stopLoss, 98.5);
      assert.equal(resTight.costR, Number((ROUND_TRIP_FRICTION_PCT / 0.015).toFixed(6)));

      // Case B: Very wide stop (10.0% distance) -> clamped to 6.0%
      const resWide = computeClampedStop(entryPrice, 90.0);
      assert.equal(resWide.stopDistPct, 0.060);
      assert.equal(resWide.stopLoss, 94.0);
      assert.equal(resWide.costR, Number((ROUND_TRIP_FRICTION_PCT / 0.060).toFixed(6)));

      // Case C: Normal stop (3.0% distance) -> remains 3.0%
      const resNormal = computeClampedStop(entryPrice, 97.0);
      assert.equal(resNormal.stopDistPct, 0.030);
      assert.equal(resNormal.stopLoss, 97.0);
    });
  });

  describe("3. Active Trade Barrier Evaluation & Collision Precedence", () => {
    const mockTrade: PaperTrade4HSwingRecord = {
      id: "mock-trade-1",
      coin: "BTCUSDT",
      side: "LONG",
      signal_time: "2026-01-01T00:00:00.000Z",
      entry_time: "2026-01-01T04:00:00.000Z",
      entry_time_ms: 1000000,
      entry_price: 100.0,
      stop_loss: 97.0, // 3% stop ($3.00 distance)
      take_profit: 107.5, // +2.5R ($7.50 distance)
      stop_distance_pct: 0.03,
      stop_distance: 3.0,
      status: "ACTIVE",
      cost_r: 0.001 / 0.03, // 0.033333R
      probability: 0.15,
      p_cutoff: 0.10,
    };

    test("Target Hit (+2.5R): bar high touches take_profit without touching stop", () => {
      const bar: Swing4HCandle = {
        openTime: 2000000,
        open: 102.0,
        high: 108.0, // reaches 107.5 target
        low: 99.0, // does not touch 97.0 stop
        close: 107.0,
        volume: 500,
      };

      const res = evaluateActiveTradeOnBar(mockTrade, bar, 3);
      assert.equal(res.closed, true);
      assert.equal(res.exitType, "TARGET");
      assert.equal(res.grossR, 2.5);
      assert.equal(res.exitPrice, 107.5);
    });

    test("Stop Hit (-1.0R): bar low touches stop_loss without touching target", () => {
      const bar: Swing4HCandle = {
        openTime: 2000000,
        open: 98.5,
        high: 101.0,
        low: 96.5, // touches 97.0 stop
        close: 98.0,
        volume: 500,
      };

      const res = evaluateActiveTradeOnBar(mockTrade, bar, 2);
      assert.equal(res.closed, true);
      assert.equal(res.exitType, "STOP");
      assert.equal(res.grossR, -1.0);
      assert.equal(res.exitPrice, 97.0);
    });

    test("Simultaneous Touch Collision: bar touches BOTH SL and TP -> booked as STOP (-1.0R)", () => {
      const bar: Swing4HCandle = {
        openTime: 2000000,
        open: 100.0,
        high: 108.5, // touches 107.5 target
        low: 96.0, // touches 97.0 stop
        close: 104.0,
        volume: 1500,
      };

      const res = evaluateActiveTradeOnBar(mockTrade, bar, 4);
      assert.equal(res.closed, true);
      assert.equal(res.exitType, "STOP");
      assert.equal(res.grossR, -1.0);
      assert.equal(res.exitPrice, 97.0);
    });

    test("Time Barrier: exits on bar 12 at close price", () => {
      const bar: Swing4HCandle = {
        openTime: 2000000,
        open: 101.0,
        high: 103.0,
        low: 99.0,
        close: 102.5,
        volume: 600,
      };

      // Bar 11 -> does not time out
      const res11 = evaluateActiveTradeOnBar(mockTrade, bar, 11);
      assert.equal(res11.closed, false);

      // Bar 12 -> times out
      const res12 = evaluateActiveTradeOnBar(mockTrade, bar, 12);
      assert.equal(res12.closed, true);
      assert.equal(res12.exitType, "TIME");
      assert.equal(res12.exitPrice, 102.5);
      // grossR = (102.5 - 100.0) / 3.0 = +0.8333R
      assert.equal(res12.grossR, 0.8333);
    });
  });

  describe("4. End-to-End Autonomous Swing Loop & AI Gating", () => {
    test("blocks breakout setup when model probability < P_cutoff", async () => {
      const candles = generateSyntheticCandles(250, 100, 0.2);
      // Force breakout setup on last closed candle
      const prior20High = Math.max(...candles.slice(-21, -1).map((c) => c.high));
      candles[candles.length - 2].close = prior20High + 2.0;

      // Run with an intentionally high cutoff (0.95) to ensure it gets filtered
      const result = await runPaper4HSwingExecutor({
        isDryRun: true,
        customCutoff: 0.95,
        customCandlesMap: {
          BTCUSDT: candles,
          ETHUSDT: generateSyntheticCandles(250, 2000, 0.1),
          SOLUSDT: generateSyntheticCandles(250, 100, 0.1),
        },
      });

      assert.equal(result.success, true);
      const btcSkip = result.skipped_symbols.find((s) => s.symbol === "BTCUSDT");
      assert.ok(btcSkip, "BTCUSDT should be skipped");
      assert.ok(
        btcSkip?.reason.includes("Filtered by AI Meta-Classifier"),
        `Expected AI filter skip, got: ${btcSkip?.reason}`
      );
      assert.equal(result.opened_trades.length, 0);
    });

    test("admits breakout setup and opens trade when model probability >= P_cutoff", async () => {
      const candles = generateSyntheticCandles(250, 100, 0.2);
      const prior20High = Math.max(...candles.slice(-21, -1).map((c) => c.high));
      candles[candles.length - 2].close = prior20High + 2.0;

      // Run with a very low cutoff (0.01) to verify trade opening
      const result = await runPaper4HSwingExecutor({
        isDryRun: true,
        customCutoff: 0.01,
        customCandlesMap: {
          BTCUSDT: candles,
          ETHUSDT: generateSyntheticCandles(250, 2000, 0.1),
          SOLUSDT: generateSyntheticCandles(250, 100, 0.1),
        },
      });

      assert.equal(result.success, true);
      assert.equal(result.opened_trades.length, 1);
      const trade = result.opened_trades[0];
      assert.equal(trade.coin, "BTCUSDT");
      assert.equal(trade.status, "ACTIVE");
      assert.ok(trade.take_profit > trade.entry_price);
      assert.ok(trade.stop_loss < trade.entry_price);
      assert.ok(trade.cost_r > 0, "Cost in R should be deducted based on stop distance");
    });

    test("realizes 10 bps friction deduction on completed trades", async () => {
      const candles = generateSyntheticCandles(250, 100, 0.2);
      const prior20High = Math.max(...candles.slice(-21, -1).map((c) => c.high));
      candles[candles.length - 2].close = prior20High + 2.0;

      // 1. Open trade
      const openRes = await runPaper4HSwingExecutor({
        isDryRun: false, // write to in-memory store
        customCutoff: 0.01,
        customCandlesMap: {
          BTCUSDT: candles,
          ETHUSDT: generateSyntheticCandles(250, 2000, 0.1),
          SOLUSDT: generateSyntheticCandles(250, 100, 0.1),
        },
      });

      assert.equal(openRes.opened_trades.length, 1);
      const openTrade = openRes.opened_trades[0];

      // 2. Simulate next candle hitting take profit (+2.5R)
      const nextCandles = [...candles];
      const lastCandle = nextCandles[nextCandles.length - 1];
      const postEntryCandle: Swing4HCandle = {
        openTime: lastCandle.openTime + 4 * 3600 * 1000,
        open: openTrade.entry_price,
        high: openTrade.take_profit + 5.0, // reaches target
        low: openTrade.entry_price - 0.5,
        close: openTrade.take_profit,
        volume: 2000,
        closeTime: lastCandle.openTime + 8 * 3600 * 1000 - 1,
      };
      nextCandles.push(postEntryCandle);

      // Run executor loop again to process active trade
      const closeRes = await runPaper4HSwingExecutor({
        isDryRun: false,
        customCandlesMap: {
          BTCUSDT: nextCandles,
          ETHUSDT: generateSyntheticCandles(250, 2000, 0.1),
          SOLUSDT: generateSyntheticCandles(250, 100, 0.1),
        },
      });

      assert.equal(closeRes.closed_trades.length, 1);
      const closed = closeRes.closed_trades[0];
      assert.equal(closed.exit_type, "TARGET");
      assert.equal(closed.gross_r, 2.5);

      // Exact net R = gross_R - cost_R
      const expectedNetR = Number((2.5 - closed.cost_r).toFixed(4));
      assert.equal(closed.net_r, expectedNetR);
      assert.ok(closed.net_r! < 2.5, "Net R must reflect 10 bps friction deduction");
    });
  });

  describe("5. API Routes Integration & 15M Scalper Retirement", () => {
    test("GET /api/cron/scalp returns clean deprecation response", async () => {
      const { GET } = await import("../src/app/api/cron/scalp/route");
      const res = await GET();
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.status, "DEPRECATED");
      assert.ok(data.message.includes("15M Scalper retired"));
      assert.ok(data.message.includes("/api/cron/paper-4h-swing"));
    });

    test("GET /api/history returns verified multi-asset historical trades by default", async () => {
      const { GET } = await import("../src/app/api/history/route");
      const req = new Request("http://localhost:3000/api/history?limit=1000");
      const res = await GET(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.totalHistoricalTrades, 4403);
      assert.equal(data.trades.length, 1000);

      // Verify trade structure and multi-asset coverage (Crypto + Commodities)
      const symbols = new Set(data.trades.map((t: any) => t.symbol));
      assert.ok(symbols.has("BTCUSDT"));
      assert.ok(symbols.has("XAUUSDT") || symbols.has("GC=F"));
      assert.ok(symbols.has("XAGUSDT") || symbols.has("SI=F"));
      assert.ok(symbols.has("CLUSDT") || symbols.has("CL=F"));

      // Verify symbol filter (e.g. Gold)
      const reqGold = new Request("http://localhost:3000/api/history?symbol=GC=F&limit=200");
      const resGold = await GET(reqGold);
      const dataGold = await resGold.json();
      assert.equal(dataGold.success, true);
      assert.equal(dataGold.symbol, "GC=F");
      assert.ok(dataGold.totalHistoricalTrades > 0);
      assert.ok(dataGold.trades.every((t: any) => t.symbol === "XAUUSDT" || t.symbol === "GC=F" || t.rawSymbol === "GC=F"));
    });

    test("GET /api/trades defaults to 4H Swing Meta model", async () => {
      const { GET } = await import("../src/app/api/trades/route");
      const req = new Request("http://localhost:3000/api/trades");
      const res = await GET(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.modelId, "4h-swing-meta-017");
      assert.ok(data.metrics);
      assert.equal(data.metrics.avgNetR, 0.052);
    });
  });
});
