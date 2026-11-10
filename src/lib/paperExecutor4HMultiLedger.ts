/**
 * Multi-Ledger Forward Paper Trading Executor for Fixed-Rule 4H Engines
 *
 * Implements Three Independent Forward Ledgers (starting from 2026-10-31):
 *   1. Primary:  v1 (fixed_rule_4h_v1)
 *   2. Shadow 1: V6 (v6_smc_bos_retest)
 *   3. Shadow 2: V8 (v8_no_stretch_cap)
 *
 * Invariants:
 *   - Strictly separate file logs & separate MongoDB collections.
 *   - Identical riskEngine.ts (Daily loss limit, rolling kill switch, max drawdown limit, cost_R filter).
 *   - Identical feeModel.ts (0.1144% taker friction).
 *   - Forward start cutoff: 2026-10-31T00:00:00.000Z.
 *   - No forward tuning.
 */

import fs from "fs";
import path from "path";
import { getDb } from "./mongodb";
import {
  checkCostRFilter,
  checkDailyLossLimit,
  evaluateRollingKillSwitch,
  checkMaxDrawdownLimit,
} from "./riskEngine";
import { TradeOrder } from "./engineTypes";
import {
  Candle4H,
  FixedRule4HConfig,
  PaperTrade4HFixedRecord,
  Fixed4HExecutorResult,
  checkSignalOnBar,
  loadFixedRuleConfig,
  evaluateActiveTradeOnBar,
} from "./paperExecutor4HFixed";

export const FORWARD_TEST_START_DATE = "2026-10-31T00:00:00.000Z";
export const FORWARD_TEST_START_MS = new Date(FORWARD_TEST_START_DATE).getTime();

export type LedgerKey = "v1_primary" | "v6_shadow" | "v8_shadow";

export interface LedgerDefinition {
  key: LedgerKey;
  name: string;
  role: "PRIMARY" | "SHADOW";
  configPath: string;
  dataFileName: string;
  collectionName: string;
}

export const LEDGER_DEFINITIONS: Record<LedgerKey, LedgerDefinition> = {
  v1_primary: {
    key: "v1_primary",
    name: "Fixed Rule 4H v1 (Primary Baseline)",
    role: "PRIMARY",
    configPath: "config/fixed_rule_4h_v1.json",
    dataFileName: "trades_4h_fixed_v1.json",
    collectionName: "paper_trades_4h_fixed_v1",
  },
  v6_shadow: {
    key: "v6_shadow",
    name: "v6 SMC BOS Retest (Shadow)",
    role: "SHADOW",
    configPath: "config/variants/v6_smc_bos_retest.json",
    dataFileName: "trades_4h_shadow_v6.json",
    collectionName: "paper_trades_4h_shadow_v6",
  },
  v8_shadow: {
    key: "v8_shadow",
    name: "v8 No Stretch Cap (Shadow)",
    role: "SHADOW",
    configPath: "config/variants/v8_no_stretch_cap.json",
    dataFileName: "trades_4h_shadow_v8.json",
    collectionName: "paper_trades_4h_shadow_v8",
  },
};

// In-Memory store for all three ledgers
const multiLedgerStore: Record<LedgerKey, Map<string, PaperTrade4HFixedRecord>> = {
  v1_primary: new Map(),
  v6_shadow: new Map(),
  v8_shadow: new Map(),
};

function getLedgerFilePath(dataFileName: string): string {
  if (process.cwd().endsWith("Trader-Pro-Dashboard")) {
    return path.resolve(process.cwd(), "data", dataFileName);
  }
  return path.resolve(process.cwd(), "Trader-Pro-Dashboard", "data", dataFileName);
}

export function loadLedgerTradesFromFile(dataFileName: string): PaperTrade4HFixedRecord[] {
  try {
    const fpath = getLedgerFilePath(dataFileName);
    if (fs.existsSync(fpath)) {
      const data = fs.readFileSync(fpath, "utf-8");
      return JSON.parse(data) as PaperTrade4HFixedRecord[];
    }
  } catch {
    // Return empty on parse error
  }
  return [];
}

export function saveLedgerTradesToFile(dataFileName: string, trades: PaperTrade4HFixedRecord[]): void {
  try {
    const fpath = getLedgerFilePath(dataFileName);
    const dir = path.dirname(fpath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fpath, JSON.stringify(trades, null, 2), "utf-8");
  } catch (err: any) {
    console.error(`[MultiLedger] Failed to save trades to ${dataFileName}: ${err?.message}`);
  }
}

/**
 * SMC BOS Retest Trigger Helper
 */
function checkSMCBOSRetestTrigger(
  candles: Candle4H[],
  t: number,
  swingLen: number = 5
): { signal: "LONG" | "SHORT" | null; swingPrice: number } {
  if (t < swingLen * 2 + 5) return { signal: null, swingPrice: 0 };

  // Detect most recent confirmed swing high and low prior to t
  let lastSH = -1;
  let lastSL = -1;
  for (let b = swingLen * 2; b <= t - 1; b++) {
    const sCheck = b - swingLen;
    // Check swing high
    let isSH = true;
    for (let j = sCheck - swingLen; j <= sCheck + swingLen; j++) {
      if (candles[j].high > candles[sCheck].high) {
        isSH = false;
        break;
      }
    }
    if (isSH) lastSH = candles[sCheck].high;

    // Check swing low
    let isSL = true;
    for (let j = sCheck - swingLen; j <= sCheck + swingLen; j++) {
      if (candles[j].low < candles[sCheck].low) {
        isSL = false;
        break;
      }
    }
    if (isSL) lastSL = candles[sCheck].low;
  }

  const cur = candles[t];
  // Retest Long: price tested lastSH and closed at or above it
  if (lastSH > 0 && cur.low <= lastSH && cur.close >= lastSH && cur.close > cur.open) {
    return { signal: "LONG", swingPrice: lastSH };
  }
  // Retest Short: price tested lastSL and closed at or below it
  if (lastSL > 0 && cur.high >= lastSL && cur.close <= lastSL && cur.close < cur.open) {
    return { signal: "SHORT", swingPrice: lastSL };
  }

  return { signal: null, swingPrice: 0 };
}

/**
 * Evaluates entry signals for a specific ledger definition
 */
function evaluateLedgerSignal(
  symbol: string,
  candles: Candle4H[],
  t: number,
  btcCandles: Candle4H[],
  cfg: FixedRule4HConfig,
  triggerType?: string
): {
  signal: "LONG" | "SHORT" | null;
  stopPct: number;
  entryPrice: number;
  signalTime: string;
  signalTimeMs: number;
} | null {
  if (triggerType === "smc_bos_retest") {
    // V6 SMC Retest Entry Trigger check first
    const retest = checkSMCBOSRetestTrigger(candles, t, 5);
    if (!retest.signal) return null;
  }

  // Use canonical checkSignalOnBar for all filter checks and stop clamping
  const sig = checkSignalOnBar(symbol, candles, t, btcCandles, cfg);
  if (!sig) return null;

  return {
    signal: sig.signal,
    stopPct: sig.stopPct,
    entryPrice: sig.entryPrice,
    signalTime: sig.signalTime,
    signalTimeMs: sig.signalTimeMs,
  };
}

/**
 * Execute a single ledger with forward start constraint and full riskEngine parity
 */
export async function runSingleLedger(
  def: LedgerDefinition,
  candleMap: Record<string, Candle4H[]>,
  btcCandles: Candle4H[],
  isDryRun: boolean = false
): Promise<Fixed4HExecutorResult> {
  const actions: string[] = [];
  const openedTrades: PaperTrade4HFixedRecord[] = [];
  const closedTrades: PaperTrade4HFixedRecord[] = [];
  const skippedSymbols: Array<{ symbol: string; reason: string }> = [];

  const cfg = loadFixedRuleConfig(def.configPath);
  const triggerType = (cfg.entry as any).trigger_type;

  const db = await getDb();
  let storedTrades: PaperTrade4HFixedRecord[] = [];

  // Load from DB or file
  if (db && !isDryRun) {
    try {
      const docs = await db.collection(def.collectionName).find({}).toArray();
      storedTrades = docs.map((d: any) => ({
        id: d.id,
        coin: d.coin,
        side: d.side,
        signal_time: d.signal_time,
        signal_bar_time: d.signal_bar_time,
        entry_time: d.entry_time,
        entry_time_ms: d.entry_time_ms,
        exit_time: d.exit_time,
        entry_price: d.entry_price,
        exit_price: d.exit_price,
        initial_stop: d.initial_stop,
        active_stop: d.active_stop,
        anchor_close: d.anchor_close,
        stop_dist_pct: d.stop_dist_pct,
        risk_inr: d.risk_inr,
        position_size_inr: d.position_size_inr,
        status: d.status,
        exit_type: d.exit_type,
        gross_r: d.gross_r,
        fee_r: d.fee_r,
        funding_r: d.funding_r,
        net_r: d.net_r,
        net_pnl_inr: d.net_pnl_inr,
        bars_held: d.bars_held,
        clamped_flag: d.clamped_flag,
        last_evaluated_bar_time: d.last_evaluated_bar_time,
      }));
    } catch {
      storedTrades = loadLedgerTradesFromFile(def.dataFileName);
    }
  } else {
    storedTrades = loadLedgerTradesFromFile(def.dataFileName);
  }

  // Populate memory map for this ledger
  const memoryMap = multiLedgerStore[def.key];
  for (const t of storedTrades) {
    memoryMap.set(t.id, t);
  }

  const activeTrades = Array.from(memoryMap.values()).filter((t) => t.status === "ACTIVE");
  const closedStoredTrades = Array.from(memoryMap.values()).filter((t) => t.status === "CLOSED");

  // Evaluate active trades
  const remainingActive: PaperTrade4HFixedRecord[] = [];
  for (const trade of activeTrades) {
    const candles = candleMap[trade.coin];
    if (!candles || candles.length === 0) {
      remainingActive.push(trade);
      continue;
    }

    const { atr14: atrArr } = calculateATR14(candles, cfg.filters.atr_period);
    const lastEval = trade.last_evaluated_bar_time || trade.entry_time_ms;
    const postBars = candles.filter((c) => c.openTime > lastEval);

    let tradeClosed = false;
    let held = trade.bars_held || 0;

    for (const bar of postBars) {
      held++;
      const bIdx = candles.findIndex((c) => c.openTime === bar.openTime);
      const bAtr = bIdx >= 0 ? atrArr[bIdx] : trade.entry_price * 0.02;
      const res = evaluateActiveTradeOnBar(trade, bar, held, bAtr, cfg);

      trade.active_stop = res.updatedActiveStop;
      trade.anchor_close = res.updatedAnchorClose;
      trade.bars_held = held;
      trade.last_evaluated_bar_time = bar.openTime;

      if (res.closed) {
        tradeClosed = true;
        trade.status = "CLOSED";
        trade.exit_type = res.exitType;
        trade.exit_price = res.exitPrice;
        trade.exit_time = res.exitTime;
        trade.gross_r = res.grossR;
        trade.fee_r = res.feeR;
        trade.funding_r = res.fundingR;
        trade.net_r = res.netR;
        trade.net_pnl_inr = Number((res.netR * trade.risk_inr).toFixed(2));
        break;
      }
    }

    if (tradeClosed) {
      closedTrades.push(trade);
      if (db && !isDryRun) {
        await db.collection(def.collectionName).updateOne({ id: trade.id }, { $set: trade });
      }
      actions.push(`[${def.key}] Closed trade ${trade.id} via ${trade.exit_type} Net R: ${trade.net_r} (₹${trade.net_pnl_inr})`);
    } else {
      remainingActive.push(trade);
    }
  }

  // Portfolio Cap & Signals: Only evaluate candidates from FORWARD_TEST_START_MS
  if (remainingActive.length < cfg.sizing.max_concurrent_positions) {
    for (const sym of cfg.assets) {
      if (remainingActive.some((t) => t.coin === sym)) continue;
      const candles = candleMap[sym];
      if (!candles || candles.length < 2) continue;

      const closedBarIdx = candles.length - 2;
      const formingBar = candles[candles.length - 1];

      // FORWARD TEST HARD INVARIANT: Bar must be >= 2026-10-31
      if (formingBar.openTime < FORWARD_TEST_START_MS) {
        skippedSymbols.push({
          symbol: sym,
          reason: `Bar timestamp ${new Date(formingBar.openTime).toISOString()} is prior to forward test start cutoff ${FORWARD_TEST_START_DATE}`,
        });
        continue;
      }

      const sig = evaluateLedgerSignal(sym, candles, closedBarIdx, btcCandles, cfg, triggerType);
      if (!sig) continue;

      // Risk Engine Invariants
      const costCheck = checkCostRFilter(sig.stopPct, 0.05, cfg.costs.taker_round_trip_friction);
      if (!costCheck.passed) {
        skippedSymbols.push({ symbol: sym, reason: `Gate 4 Cost filter failed` });
        continue;
      }

      // Format trade orders for risk engine
      const riskOrders = closedStoredTrades.map((t) => ({
        id: t.id,
        symbol: t.coin,
        direction: t.side,
        entryPrice: t.entry_price,
        exitPrice: t.exit_price || 0,
        initialStopLoss: t.initial_stop,
        netPnLINR: t.net_pnl_inr || 0,
        grossPnLINR: (t.gross_r || 0) * t.risk_inr,
        totalFeesINR: (t.fee_r || 0) * t.risk_inr,
        status: "STOP_OUT",
        openedAt: t.entry_time_ms,
        closedAt: t.exit_time ? new Date(t.exit_time).getTime() : t.entry_time_ms,
        entryOrderType: "MARKET",
        exitReason: t.exit_type || "STOP",
        timeframe: "4h",
        orderType: "TAKER",
        modelId: def.key,
        modelName: def.name,
        positionSizeINR: t.position_size_inr,
        coins: t.position_size_inr / t.entry_price,
        feePercentage: 0.040,
        gstPercentage: 18.0,
        entryFeeINR: (t.fee_r || 0) * t.risk_inr * 0.5,
        totalFeeINR: (t.fee_r || 0) * t.risk_inr,
        stopLoss: t.initial_stop,
        stopPct: t.stop_dist_pct,
      })) as unknown as TradeOrder[];

      const dailyCheck = checkDailyLossLimit(riskOrders, -3.0);
      if (dailyCheck.limitExceeded) {
        skippedSymbols.push({ symbol: sym, reason: "Daily loss limit exceeded" });
        continue;
      }

      const killSwitch = evaluateRollingKillSwitch(riskOrders, 100, -0.05);
      if (killSwitch.shouldKill) {
        skippedSymbols.push({ symbol: sym, reason: "Rolling kill switch triggered" });
        continue;
      }

      const ddCheck = checkMaxDrawdownLimit(riskOrders, -10.0);
      if (ddCheck.limitExceeded) {
        skippedSymbols.push({ symbol: sym, reason: "Max drawdown stop triggered" });
        continue;
      }

      // Open new paper trade
      const entryPrice = formingBar.open;
      const entryTimeMs = formingBar.openTime;
      const initialStopPrice = sig.signal === "LONG"
        ? entryPrice * (1.0 - sig.stopPct)
        : entryPrice * (1.0 + sig.stopPct);
      const riskInr = cfg.sizing.risk_per_trade_inr;
      const positionSizeInr = Number((riskInr / sig.stopPct).toFixed(2));
      const tradeId = `${def.key.toUpperCase()}_${sym}_${entryTimeMs}`;

      const newTrade: PaperTrade4HFixedRecord = {
        id: tradeId,
        coin: sym,
        side: sig.signal,
        signal_time: sig.signalTime,
        signal_bar_time: sig.signalTimeMs,
        entry_time: formingBar.datetime || new Date(entryTimeMs).toISOString(),
        entry_time_ms: entryTimeMs,
        entry_price: Number(entryPrice.toFixed(4)),
        initial_stop: Number(initialStopPrice.toFixed(4)),
        active_stop: Number(initialStopPrice.toFixed(4)),
        anchor_close: Number(entryPrice.toFixed(4)),
        stop_dist_pct: Number(sig.stopPct.toFixed(5)),
        risk_inr: riskInr,
        position_size_inr: positionSizeInr,
        status: "ACTIVE",
        bars_held: 0,
        clamped_flag: false,
        last_evaluated_bar_time: entryTimeMs,
      };

      if (db && !isDryRun) {
        try {
          await db.collection(def.collectionName).insertOne(newTrade);
        } catch (err: any) {
          actions.push(`[DB] Error inserting trade into ${def.collectionName}: ${err?.message}`);
        }
      }

      memoryMap.set(newTrade.id, newTrade);
      remainingActive.push(newTrade);
      openedTrades.push(newTrade);
      actions.push(`[${def.key}] Opened ${newTrade.side} trade ${newTrade.id} @ $${newTrade.entry_price}`);
    }
  }

  // Save to file
  const allCurrent = Array.from(memoryMap.values());
  saveLedgerTradesToFile(def.dataFileName, allCurrent);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    evaluated_symbols: cfg.assets,
    opened_trades: openedTrades,
    active_trades: remainingActive,
    closed_trades: closedTrades,
    skipped_symbols: skippedSymbols,
    actions,
  };
}

/**
 * Orchestrates all three forward ledgers in parallel or series
 */
export async function runMultiLedgerExecutor(customCandles?: Record<string, Candle4H[]>): Promise<
  Record<LedgerKey, Fixed4HExecutorResult>
> {
  // Fetch candles if not supplied
  const candleMap: Record<string, Candle4H[]> = customCandles || {};
  if (!customCandles) {
    const { fetchBinanceKlines } = await import("./binanceData");
    for (const sym of ["BTCUSDT", "ETHUSDT"]) {
      try {
        const raw = await fetchBinanceKlines("4h", 250, 10000, sym);
        candleMap[sym] = raw.map((c) => ({
          openTime: c.openTime,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          closeTime: c.closeTime,
          datetime: new Date(c.openTime).toISOString(),
        }));
      } catch (err) {
        console.error(`[MultiLedger] Candle fetch error for ${sym}:`, err);
      }
    }
  }

  const btcCandles = candleMap["BTCUSDT"] || [];

  const results: Record<LedgerKey, Fixed4HExecutorResult> = {
    v1_primary: await runSingleLedger(LEDGER_DEFINITIONS.v1_primary, candleMap, btcCandles),
    v6_shadow: await runSingleLedger(LEDGER_DEFINITIONS.v6_shadow, candleMap, btcCandles),
    v8_shadow: await runSingleLedger(LEDGER_DEFINITIONS.v8_shadow, candleMap, btcCandles),
  };

  return results;
}

/**
 * Returns summary and trades for each ledger
 */
export async function getMultiLedgerStatus(): Promise<
  Record<
    LedgerKey,
    {
      definition: LedgerDefinition;
      activeTrades: PaperTrade4HFixedRecord[];
      closedTrades: PaperTrade4HFixedRecord[];
      totalTrades: number;
      netPnLINR: number;
      netR: number;
      winRate: number;
    }
  >
> {
  const result: any = {};
  for (const key of Object.keys(LEDGER_DEFINITIONS) as LedgerKey[]) {
    const def = LEDGER_DEFINITIONS[key];
    const trades = loadLedgerTradesFromFile(def.dataFileName);
    const active = trades.filter((t) => t.status === "ACTIVE");
    const closed = trades.filter((t) => t.status === "CLOSED");

    let totalPnL = 0;
    let totalR = 0;
    let wins = 0;

    for (const t of closed) {
      totalPnL += t.net_pnl_inr || 0;
      totalR += t.net_r || 0;
      if ((t.net_r || 0) > 0) wins++;
    }

    const winRate = closed.length > 0 ? (wins / closed.length) * 100.0 : 0.0;

    result[key] = {
      definition: def,
      activeTrades: active,
      closedTrades: closed,
      totalTrades: trades.length,
      netPnLINR: Number(totalPnL.toFixed(2)),
      netR: Number(totalR.toFixed(4)),
      winRate: Number(winRate.toFixed(1)),
    };
  }
  return result;
}
