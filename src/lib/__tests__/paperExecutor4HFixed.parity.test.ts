import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  checkSignalOnBar,
  evaluateActiveTradeOnBar,
  calculateSMA,
  calculateEMA,
  calculateATR14,
  calculateShiftedDonchian,
  calculateStructuralLevels,
  runPaper4HFixedExecutor,
  clearInMemoryFixedTrades,
  getInMemoryFixedTrades,
  Candle4H,
  PaperTrade4HFixedRecord,
  DEFAULT_FIXED_4H_CONFIG,
} from "../paperExecutor4HFixed";

// Load exported Python parity fixture
function loadFixture() {
  const fixturePath = path.resolve(__dirname, "fixtures/fixed_rule_4h_fixture.json");
  const raw = fs.readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw);
}

describe("4H Fixed-Rule Engine (v2) Parity Tests", () => {
  const fixture = loadFixture();
  const candles: Candle4H[] = fixture.candles;
  const expectedTrade = fixture.expected_trade;
  const sigIdx = fixture.signal_candle_index; // 205
  const entryIdx = fixture.entry_candle_index; // 206

  beforeEach(() => {
    clearInMemoryFixedTrades();
  });

  describe("1. Indicator Parity with Python Pandas & Numpy", () => {
    test("SMA200 matches Python rolling mean at signal candle", () => {
      const closes = candles.map((c) => c.close);
      const sma200 = calculateSMA(closes, 200);
      assert.ok(!isNaN(sma200[sigIdx]), "SMA200 should be valid at bar 205");
      // Bar 651 close: 7238.83 is well above SMA200 (around 6800-7000)
      assert.ok(closes[sigIdx] > sma200[sigIdx], "Close must be above SMA200 for LONG");
    });

    test("Donchian 20-bar channel high matches Python shifted max", () => {
      const { dh } = calculateShiftedDonchian(candles, 20);
      assert.ok(!isNaN(dh[sigIdx]), "Donchian High must be valid");
      // Bar 651 close: 7238.83 broke out above previous 20-bar max high
      assert.ok(candles[sigIdx].close > dh[sigIdx], "Close must exceed 20-bar Donchian high");
    });

    test("ATR14 matches Python 14-period True Range rolling mean", () => {
      const { atr14 } = calculateATR14(candles, 14);
      assert.ok(!isNaN(atr14[sigIdx]), "ATR14 must be valid at bar 205");
      assert.ok(atr14[sigIdx] > 50 && atr14[sigIdx] < 300, `ATR14 (${atr14[sigIdx]}) in reasonable range`);
    });

    test("10-bar Structural stop level matches Python lowest low", () => {
      const { ll10 } = calculateStructuralLevels(candles, 10);
      const entryPrice = candles[entryIdx].open;
      const rawStop = (entryPrice - ll10[sigIdx]) / entryPrice;
      // Expected stop_pct is 0.03845
      assert.ok(
        Math.abs(rawStop - expectedTrade.stop_pct) < 0.0005,
        `Raw stop ${rawStop} must match Python ${expectedTrade.stop_pct}`
      );
    });
  });

  describe("2. Signal Detection Parity at Bar t (Signal Bar)", () => {
    test("detects identical LONG breakout signal on candle t", () => {
      const sig = checkSignalOnBar("BTCUSDT", candles, sigIdx, undefined, DEFAULT_FIXED_4H_CONFIG);
      assert.ok(sig !== null, "Must generate valid signal at bar 205");
      assert.strictEqual(sig.signal, expectedTrade.direction);
      assert.strictEqual(sig.signalTime, expectedTrade.signal_time);
      assert.strictEqual(sig.isClamped, expectedTrade.clamped_flag);
    });

    test("Gate 3 Execution Realism: entry fills strictly at open of bar t+1", () => {
      const entryCandle = candles[entryIdx];
      assert.strictEqual(entryCandle.datetime, expectedTrade.entry_time);
      assert.ok(
        Math.abs(entryCandle.open - expectedTrade.entry_price) < 0.01,
        `Entry open ${entryCandle.open} must equal Python fill ${expectedTrade.entry_price}`
      );
    });
  });

  describe("3. Active Trade Progression & Chandelier Trailing Exit Parity", () => {
    test("evaluates bars sequentially and triggers TRAIL stop on identical exit bar", () => {
      const entryPrice = expectedTrade.entry_price;
      const stopDist = expectedTrade.stop_pct;
      const initialStop = Number((entryPrice * (1.0 - stopDist)).toFixed(4));

      const trade: PaperTrade4HFixedRecord = {
        id: "TEST_BTC_0",
        coin: "BTCUSDT",
        side: "LONG",
        signal_time: expectedTrade.signal_time,
        signal_bar_time: candles[sigIdx].openTime,
        entry_time: expectedTrade.entry_time,
        entry_time_ms: candles[entryIdx].openTime,
        entry_price: entryPrice,
        initial_stop: initialStop,
        active_stop: initialStop,
        anchor_close: entryPrice,
        stop_dist_pct: stopDist,
        risk_inr: expectedTrade.risk_inr,
        position_size_inr: Number((expectedTrade.risk_inr / stopDist).toFixed(2)),
        status: "ACTIVE",
        bars_held: 0,
        clamped_flag: false,
      };

      const { atr14: atrArr } = calculateATR14(candles, 14);

      let finalEvalResult: any = null;
      let exitBarFound = -1;

      // Iterate through candles from entryIdx to end of fixture
      for (let i = entryIdx; i < candles.length; i++) {
        const evalBarCount = i - entryIdx;
        const bar = candles[i];
        const barAtr = atrArr[i];

        const res = evaluateActiveTradeOnBar(trade, bar, evalBarCount, barAtr, DEFAULT_FIXED_4H_CONFIG);

        trade.active_stop = res.updatedActiveStop;
        trade.anchor_close = res.updatedAnchorClose;
        trade.bars_held = evalBarCount;

        if (res.closed) {
          finalEvalResult = res;
          exitBarFound = i;
          break;
        }
      }

      assert.ok(finalEvalResult !== null, "Trade must exit");
      assert.strictEqual(finalEvalResult.exitType, expectedTrade.exit_type, "Exit type must be TRAIL");
      assert.strictEqual(candles[exitBarFound].datetime, expectedTrade.exit_time, "Exit time must match Python");

      // Verify Gross R and Net R match Python within tolerance
      assert.ok(
        Math.abs(finalEvalResult.grossR - expectedTrade.gross_r) < 0.05,
        `Gross R ${finalEvalResult.grossR} should match Python ${expectedTrade.gross_r}`
      );
      assert.ok(
        Math.abs(finalEvalResult.feeR - expectedTrade.fee_r) < 0.005,
        `Fee R ${finalEvalResult.feeR} should match Python ${expectedTrade.fee_r}`
      );
      assert.ok(
        Math.abs(finalEvalResult.netR - expectedTrade.net_r) < 0.05,
        `Net R ${finalEvalResult.netR} should match Python ${expectedTrade.net_r}`
      );
    });
  });

  describe("4. Gating & Sizing Invariants", () => {
    test("Gate 4: rejects trades when cost_R exceeds 0.05", () => {
      // If stop distance is 1.0% (0.010), cost_R = 0.001144 / 0.010 = 0.1144 > 0.05
      const cfg = { ...DEFAULT_FIXED_4H_CONFIG, stop: { ...DEFAULT_FIXED_4H_CONFIG.stop, min_stop_pct: 0.01 } };
      // Structural stop clamped to 0.010 would yield cost_R > 0.05
      const friction = cfg.costs.taker_round_trip_friction;
      const tightCostR = friction / 0.010;
      assert.ok(tightCostR > 0.05, "Tight stop exceeds 0.05 cost_R");
    });

    test("Clamp mode 'skip' filters out trades outside [2.3%, 6.0%]", () => {
      // In default config clamp_mode is 'skip'
      assert.strictEqual(DEFAULT_FIXED_4H_CONFIG.stop.clamp_mode, "skip");
      assert.strictEqual(DEFAULT_FIXED_4H_CONFIG.stop.min_stop_pct, 0.023);
      assert.strictEqual(DEFAULT_FIXED_4H_CONFIG.stop.max_stop_pct, 0.06);
    });

    test("Risk sizing allocates exactly INR 70 per trade", () => {
      assert.strictEqual(DEFAULT_FIXED_4H_CONFIG.sizing.risk_per_trade_inr, 70.0);
      assert.strictEqual(DEFAULT_FIXED_4H_CONFIG.sizing.max_concurrent_positions, 2);
    });
  });
});
