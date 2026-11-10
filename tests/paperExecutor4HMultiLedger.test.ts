import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  LEDGER_DEFINITIONS,
  FORWARD_TEST_START_MS,
  runSingleLedger,
  getMultiLedgerStatus,
} from "../src/lib/paperExecutor4HMultiLedger";
import { Candle4H } from "../src/lib/paperExecutor4HFixed";

describe("MultiLedger Forward Paper Trading Harness (2026-10-31 Forward)", () => {
  test("verifies definition of 3 distinct ledgers (v1 primary, v6 shadow, v8 shadow)", () => {
    assert.ok(LEDGER_DEFINITIONS.v1_primary);
    assert.equal(LEDGER_DEFINITIONS.v1_primary.role, "PRIMARY");
    assert.equal(LEDGER_DEFINITIONS.v1_primary.dataFileName, "trades_4h_fixed_v1.json");

    assert.ok(LEDGER_DEFINITIONS.v6_shadow);
    assert.equal(LEDGER_DEFINITIONS.v6_shadow.role, "SHADOW");
    assert.equal(LEDGER_DEFINITIONS.v6_shadow.dataFileName, "trades_4h_shadow_v6.json");

    assert.ok(LEDGER_DEFINITIONS.v8_shadow);
    assert.equal(LEDGER_DEFINITIONS.v8_shadow.role, "SHADOW");
    assert.equal(LEDGER_DEFINITIONS.v8_shadow.dataFileName, "trades_4h_shadow_v8.json");
  });

  test("enforces forward test start cutoff date (bars prior to 2026-10-31 are rejected)", async () => {
    // Generate synthetic historical candles strictly BEFORE 2026-10-31
    const pastMs = new Date("2026-08-01T00:00:00.000Z").getTime();
    const mockCandles: Candle4H[] = [];
    for (let i = 0; i < 210; i++) {
      mockCandles.push({
        openTime: pastMs + i * 4 * 3600 * 1000, // 210 * 4h = 35 days -> Sept 5, 2026
        open: 50000 + i * 10,
        high: 50100 + i * 10,
        low: 49900 + i * 10,
        close: 50050 + i * 10,
        volume: 1000,
        closeTime: pastMs + (i + 1) * 4 * 3600 * 1000 - 1,
        datetime: new Date(pastMs + i * 4 * 3600 * 1000).toISOString(),
      });
    }

    const candleMap: Record<string, Candle4H[]> = {
      BTCUSDT: mockCandles,
      ETHUSDT: mockCandles,
    };

    // Run each ledger
    for (const key of ["v1_primary", "v6_shadow", "v8_shadow"] as const) {
      const def = LEDGER_DEFINITIONS[key];
      const res = await runSingleLedger(def, candleMap, mockCandles, true);
      // Since all candles are prior to 2026-10-31, 0 trades can be opened
      assert.equal(res.opened_trades.length, 0);
      assert.ok(
        res.skipped_symbols.some((s) => s.reason.includes("prior to forward test start cutoff"))
      );
    }
  });

  test("checks getMultiLedgerStatus retrieves all three ledgers", async () => {
    const status = await getMultiLedgerStatus();
    assert.ok(status.v1_primary);
    assert.ok(status.v6_shadow);
    assert.ok(status.v8_shadow);
  });
});
