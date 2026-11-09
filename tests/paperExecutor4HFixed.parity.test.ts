import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  checkSignalOnBar,
  evaluateActiveTradeOnBar,
  calculateSMA,
  calculateShiftedDonchian,
  calculateATR14,
  calculateStructuralLevels,
  clearInMemoryFixedTrades,
  Candle4H,
  PaperTrade4HFixedRecord,
  DEFAULT_FIXED_4H_CONFIG,
} from "../src/lib/paperExecutor4HFixed";

function loadFixture() {
  const fixturePath = path.resolve(__dirname, "fixtures/fixed_rule_4h_fixture.json");
  const raw = fs.readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw);
}

describe("4H Fixed-Rule Parity Test Suite (Node Runner)", () => {
  const fixture = loadFixture();
  const candles: Candle4H[] = fixture.candles;
  const expectedTrade = fixture.expected_trade;
  const sigIdx = fixture.signal_candle_index;
  const entryIdx = fixture.entry_candle_index;

  beforeEach(() => {
    clearInMemoryFixedTrades();
  });

  test("Indicator parity: SMA200, Donchian, ATR14, and Structural Level", () => {
    const closes = candles.map((c) => c.close);
    const sma200 = calculateSMA(closes, 200);
    const { dh } = calculateShiftedDonchian(candles, 20);
    const { atr14 } = calculateATR14(candles, 14);
    const { ll10 } = calculateStructuralLevels(candles, 10);

    assert.ok(closes[sigIdx] > sma200[sigIdx]);
    assert.ok(closes[sigIdx] > dh[sigIdx]);
    assert.ok(atr14[sigIdx] > 0);

    const entryPrice = candles[entryIdx].open;
    const rawStop = (entryPrice - ll10[sigIdx]) / entryPrice;
    assert.ok(Math.abs(rawStop - expectedTrade.stop_pct) < 0.0005);
  });

  test("Signal & Fill Realism: Signal at t, Fill at t+1 Open", () => {
    const sig = checkSignalOnBar("BTCUSDT", candles, sigIdx, undefined, DEFAULT_FIXED_4H_CONFIG);
    assert.ok(sig !== null);
    assert.strictEqual(sig.signal, expectedTrade.direction);

    const entryCandle = candles[entryIdx];
    assert.strictEqual(entryCandle.datetime, expectedTrade.entry_time);
    assert.ok(Math.abs(entryCandle.open - expectedTrade.entry_price) < 0.01);
  });

  test("Trailing Stop & Exit Parity", () => {
    const entryPrice = expectedTrade.entry_price;
    const stopDist = expectedTrade.stop_pct;
    const initialStop = Number((entryPrice * (1.0 - stopDist)).toFixed(4));

    const trade: PaperTrade4HFixedRecord = {
      id: "TEST_PARITY",
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
    let finalRes: any = null;
    let exitBarFound = -1;

    for (let i = entryIdx; i < candles.length; i++) {
      const evalBarCount = i - entryIdx;
      const bar = candles[i];
      const barAtr = atrArr[i];
      const res = evaluateActiveTradeOnBar(trade, bar, evalBarCount, barAtr, DEFAULT_FIXED_4H_CONFIG);

      trade.active_stop = res.updatedActiveStop;
      trade.anchor_close = res.updatedAnchorClose;
      trade.bars_held = evalBarCount;

      if (res.closed) {
        finalRes = res;
        exitBarFound = i;
        break;
      }
    }

    assert.ok(finalRes !== null);
    assert.strictEqual(finalRes.exitType, expectedTrade.exit_type);
    assert.strictEqual(candles[exitBarFound].datetime, expectedTrade.exit_time);
    assert.ok(Math.abs(finalRes.netR - expectedTrade.net_r) < 0.05);
  });
});
