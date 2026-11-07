import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  computeCommodityClampedStop,
  checkCommodityCandidateSignal,
  evaluateActiveCommodityTradeOnCandle,
  runPaper1HCommoditiesExecutor,
  clearInMemoryCommodityTrades,
  getInMemoryCommodityTrades,
  PaperTrade1HCommodityRecord,
  COMMODITY_FRICTION_PCT,
  TARGET_R,
  STOP_R,
  TIME_BARRIER_BARS,
  MIN_STOP_PCT,
  MAX_STOP_PCT,
  DEFAULT_COMMODITY_P_CUTOFF,
} from "../src/lib/paperExecutor1HCommodities";
import {
  predictCommoditiesMetaProb,
  loadCommodities1HModel,
  alignCommoditiesFeatureVector,
  COMMODITIES_1H_FEATURE_NAMES,
} from "../src/lib/commoditiesModelInference";
import { Candle } from "../src/lib/features";

function generateSyntheticCandles(
  count: number = 250,
  startPrice: number = 100.0,
  trendSlope: number = 0.1
): Candle[] {
  const candles: Candle[] = [];
  let price = startPrice;
  const baseTime = Date.parse("2026-01-01T00:00:00.000Z");

  for (let i = 0; i < count; i++) {
    const open = price;
    price += trendSlope;
    const close = price;
    const high = Math.max(open, close) + 0.3;
    const low = Math.min(open, close) - 0.3;
    const volume = 1500 + i * 5;
    const openTime = baseTime + i * 3600 * 1000;

    candles.push({
      openTime,
      open,
      high,
      low,
      close,
      volume,
      closeTime: openTime + 3600 * 1000 - 1,
    });
  }

  return candles;
}

describe("1H Macro Commodities Paper Trading Engine Unit Tests", () => {
  beforeEach(() => {
    clearInMemoryCommodityTrades();
  });

  describe("1. Random Forest / Tree In-Memory Inference", () => {
    test("loads model and metadata with 100 decision trees and 8 features", () => {
      const { model, metadata } = loadCommodities1HModel();
      assert.equal(model.tree_info.length, 100, "Should contain exactly 100 decision trees");
      assert.equal(metadata.num_trees, 100);
      assert.equal(metadata.feature_names.length, 8);
      assert.ok(metadata.p_cutoff > 0 && metadata.p_cutoff < 1);
    });

    test("computes bounded sigmoid probabilities [0, 1] for all input vectors", () => {
      const zeroFeatures: Record<string, number> = {};
      for (const f of COMMODITIES_1H_FEATURE_NAMES) {
        zeroFeatures[f] = 0.0;
      }
      const res = predictCommoditiesMetaProb(zeroFeatures);
      assert.ok(!isNaN(res.probability), "Probability must not be NaN");
      assert.ok(res.probability >= 0.0 && res.probability <= 1.0, "Probability must be bounded in [0, 1]");
      assert.ok(!isNaN(res.rawScore), "Raw score must not be NaN");
    });

    test("accurately applies cutoff threshold gating", () => {
      const resHigh = predictCommoditiesMetaProb({}, 0.0001);
      assert.equal(resHigh.passesGate, true, "Should pass when cutoff is ultra-low");

      const resLow = predictCommoditiesMetaProb({}, 0.9999);
      assert.equal(resLow.passesGate, false, "Should fail when cutoff is ultra-high");
    });

    test("alignCommoditiesFeatureVector sanitizes NaNs and missing values to 0.0", () => {
      const dirty = { feat_vol_zscore: NaN, feat_atr_pct: 0.015 };
      const aligned = alignCommoditiesFeatureVector(dirty);
      assert.equal(aligned.length, 8);
      assert.equal(aligned[3], 0.0, "NaN should be converted to 0.0");
      assert.equal(aligned[5], 0.015, "Valid number should be preserved");
    });
  });

  describe("2. Bi-directional Setup Detection (Donchian-20 + 200 SMA)", () => {
    test("detects LONG breakout when Close > SMA200 and Close > max(High t-20..t-1)", () => {
      // 250 candles with upward trend
      const candles = generateSyntheticCandles(250, 100, 0.15);
      const last = candles[candles.length - 1];
      // Elevate last close above all previous 20 highs
      const prev20High = Math.max(...candles.slice(-21, -1).map((c) => c.high));
      last.close = prev20High + 1.5;
      last.high = last.close + 0.5;

      const signal = checkCommodityCandidateSignal(candles);
      assert.equal(signal.isCandidate, true);
      assert.equal(signal.side, "LONG");
      assert.ok(signal.entryPrice > 0);
      assert.ok(signal.extremePrice10 > 0);
    });

    test("detects SHORT breakdown when Close < SMA200 and Close < min(Low t-20..t-1)", () => {
      // 250 candles with downward trend
      const candles = generateSyntheticCandles(250, 200, -0.2);
      const last = candles[candles.length - 1];
      // Depress last close below all previous 20 lows
      const prev20Low = Math.min(...candles.slice(-21, -1).map((c) => c.low));
      last.close = prev20Low - 1.5;
      last.low = last.close - 0.5;

      const signal = checkCommodityCandidateSignal(candles);
      assert.equal(signal.isCandidate, true);
      assert.equal(signal.side, "SHORT");
      assert.ok(signal.entryPrice > 0);
      assert.ok(signal.extremePrice10 > 0);
    });

    test("rejects when price is inside Donchian channel", () => {
      const candles = generateSyntheticCandles(250, 100, 0.05);
      const last = candles[candles.length - 1];
      const prev20High = Math.max(...candles.slice(-21, -1).map((c) => c.high));
      const prev20Low = Math.min(...candles.slice(-21, -1).map((c) => c.low));

      // Put last close squarely in the middle
      last.close = (prev20High + prev20Low) / 2.0;

      const signal = checkCommodityCandidateSignal(candles);
      assert.equal(signal.isCandidate, false);
      assert.ok(signal.reason?.includes("Inside Donchian channel"));
    });

    test("rejects conflicting regime (Bullish breakout below 200 SMA)", () => {
      // Downward trend so 200 SMA is above price
      const candles = generateSyntheticCandles(250, 200, -0.2);
      const last = candles[candles.length - 1];
      const prev20High = Math.max(...candles.slice(-21, -1).map((c) => c.high));
      // Breakout above 20-bar high, but still far below 200 SMA
      last.close = prev20High + 0.5;

      const signal = checkCommodityCandidateSignal(candles);
      assert.equal(signal.isCandidate, false);
      assert.ok(signal.reason?.includes("200 SMA"));
    });
  });

  describe("3. Clamped Structural Stop Loss [1.0%, 4.0%]", () => {
    test("clamps stop distance to 1.0% minimum when raw distance is too tight", () => {
      const entryPrice = 2000.0; // Gold price
      const tightLow = 1995.0; // Only 0.25% away
      const clamped = computeCommodityClampedStop(entryPrice, "LONG", tightLow);

      assert.equal(clamped.stopDistPct, MIN_STOP_PCT, "Should clamp to 1.0%");
      assert.equal(clamped.stopLoss, entryPrice * (1 - MIN_STOP_PCT));
      assert.equal(clamped.takeProfit, entryPrice + TARGET_R * clamped.stopDist);
    });

    test("clamps stop distance to 4.0% maximum when raw distance is too wide", () => {
      const entryPrice = 2000.0;
      const wideLow = 1850.0; // 7.5% away
      const clamped = computeCommodityClampedStop(entryPrice, "LONG", wideLow);

      assert.equal(clamped.stopDistPct, MAX_STOP_PCT, "Should clamp to 4.0%");
      assert.equal(clamped.stopLoss, entryPrice * (1 - MAX_STOP_PCT));
      assert.equal(clamped.takeProfit, entryPrice + TARGET_R * clamped.stopDist);
    });

    test("preserves intermediate structural distance within [1.0%, 4.0%]", () => {
      const entryPrice = 2000.0;
      const validLow = 1950.0; // 2.5% away
      const clamped = computeCommodityClampedStop(entryPrice, "LONG", validLow);

      assert.equal(Number(clamped.stopDistPct.toFixed(3)), 0.025);
      assert.equal(clamped.stopLoss, 1950.0);
      assert.equal(clamped.takeProfit, 2000.0 + 2.5 * 50.0);
    });

    test("correctly calculates SHORT side stop loss and take profit", () => {
      const entryPrice = 80.0; // Crude oil
      const validHigh = 82.0; // 2.5% away
      const clamped = computeCommodityClampedStop(entryPrice, "SHORT", validHigh);

      assert.equal(Number(clamped.stopDistPct.toFixed(3)), 0.025);
      assert.equal(clamped.stopLoss, 82.0);
      assert.equal(clamped.takeProfit, 80.0 - 2.5 * 2.0);
    });
  });

  describe("4. Trade Bar Evaluation & Governance Invariants", () => {
    const mockLongTrade: PaperTrade1HCommodityRecord = {
      id: "mock-comm-long-1",
      symbol: "GC=F",
      side: "LONG",
      signal_time: "2026-01-01T00:00:00.000Z",
      entry_time: "2026-01-01T00:00:00.000Z",
      entry_time_ms: Date.parse("2026-01-01T00:00:00.000Z"),
      entry_price: 2000.0,
      stop_loss: 1960.0, // 2.0% stop dist ($40)
      take_profit: 2100.0, // +2.5R ($100)
      stop_distance: 40.0,
      stop_distance_pct: 0.02,
      cost_r: 0.0005 / 0.02, // 0.025R friction
      status: "ACTIVE",
      probability: 0.08,
      p_cutoff: 0.0635,
    };

    test("books Target Hit (+2.5R) when High touches takeProfit and Low does not hit stop", () => {
      const candle: Candle = {
        openTime: Date.parse("2026-01-01T01:00:00.000Z"),
        open: 2050,
        high: 2105, // Touches TP 2100
        low: 2040,  // Stays far above SL 1960
        close: 2090,
        volume: 5000,
      };

      const res = evaluateActiveCommodityTradeOnCandle(mockLongTrade, candle, 1);
      assert.equal(res.closed, true);
      assert.equal(res.exitType, "TARGET");
      assert.equal(res.grossR, 2.5);
      assert.equal(res.exitPrice, 2100.0);
    });

    test("books Stop Loss (-1.0R) when Low touches stopLoss and High does not hit TP", () => {
      const candle: Candle = {
        openTime: Date.parse("2026-01-01T01:00:00.000Z"),
        open: 1980,
        high: 1990,
        low: 1955, // Breaches SL 1960
        close: 1970,
        volume: 5000,
      };

      const res = evaluateActiveCommodityTradeOnCandle(mockLongTrade, candle, 1);
      assert.equal(res.closed, true);
      assert.equal(res.exitType, "STOP");
      assert.equal(res.grossR, -1.0);
      assert.equal(res.exitPrice, 1960.0);
    });

    test("GOVERNANCE INVARIANT: Simultaneous touch collision booked strictly as Stop Loss (-1.0R)", () => {
      // Wild volatility bar that touches BOTH take profit AND stop loss in the exact same hour
      const collisionCandle: Candle = {
        openTime: Date.parse("2026-01-01T01:00:00.000Z"),
        open: 2000,
        high: 2120, // Touches TP 2100
        low: 1950,  // Touches SL 1960
        close: 2050,
        volume: 10000,
      };

      const res = evaluateActiveCommodityTradeOnCandle(mockLongTrade, collisionCandle, 2);
      assert.equal(res.closed, true);
      assert.equal(res.exitType, "COLLISION_STOP", "Collision must book COLLISION_STOP");
      assert.equal(res.grossR, -1.0, "Collision must strictly book -1.0R to prevent optimistic lookahead bias");
      assert.equal(res.exitPrice, 1960.0, "Exit price must be recorded as stop loss");
    });

    test("enforces 24-bar time barrier expiry at market close", () => {
      const benignCandle: Candle = {
        openTime: Date.parse("2026-01-02T00:00:00.000Z"),
        open: 2010,
        high: 2030,
        low: 1990,
        close: 2020, // Inside channel, +0.5R
        volume: 5000,
      };

      // At 23 bars: still active
      const res23 = evaluateActiveCommodityTradeOnCandle(mockLongTrade, benignCandle, 23);
      assert.equal(res23.closed, false);

      // At 24 bars: time barrier expires
      const res24 = evaluateActiveCommodityTradeOnCandle(mockLongTrade, benignCandle, 24);
      assert.equal(res24.closed, true);
      assert.equal(res24.exitType, "TIME");
      assert.equal(res24.exitPrice, 2020.0);
      // grossR = (2020 - 2000) / 40 = +0.5R
      assert.equal(res24.grossR, 0.5);
    });

    test("strictly deducts 5 bps institutional friction from net return", () => {
      // 5 bps on notional = 0.05%
      // With stopDistPct = 2.0%, costR = 0.0005 / 0.02 = 0.025 R
      assert.equal(mockLongTrade.cost_r, 0.025);

      // On a winning trade (+2.5R gross): Net R = 2.5 - 0.025 = 2.475 R
      const winNetR = Number((2.5 - mockLongTrade.cost_r).toFixed(4));
      assert.equal(winNetR, 2.475);

      // On a losing trade (-1.0R gross): Net R = -1.0 - 0.025 = -1.025 R
      const lossNetR = Number((-1.0 - mockLongTrade.cost_r).toFixed(4));
      assert.equal(lossNetR, -1.025);
    });
  });

  describe("5. End-to-End Paper Execution Loop (Dry Run)", () => {
    test("runs paper executor dry-run without throwing and returns valid result structure", async () => {
      // Dry run mock using synthetic candles for Gold, Silver, Crude Oil, and DXY
      const gcF = generateSyntheticCandles(250, 2050, 0.1);
      const siF = generateSyntheticCandles(250, 25.0, 0.01);
      const clF = generateSyntheticCandles(250, 75.0, -0.05);
      const dxy = generateSyntheticCandles(250, 104.0, 0.005);

      const mockCandleMap = {
        "GC=F": gcF,
        "SI=F": siF,
        "CL=F": clF,
        "DX-Y.NYB": dxy,
      };

      const result = await runPaper1HCommoditiesExecutor({
        isDryRun: true,
        customCandlesMap: mockCandleMap,
      });

      assert.equal(result.success, true);
      assert.equal(result.evaluated_symbols.length, 3);
      assert.ok(Array.isArray(result.opened_trades));
      assert.ok(Array.isArray(result.closed_trades));
      assert.ok(Array.isArray(result.actions));
      assert.ok(result.timestamp.length > 0);
    });
  });
});
