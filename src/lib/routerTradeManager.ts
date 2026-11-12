/**
 * Router Trade Manager & Lifecycle Auditor
 *
 * Provides long-term persistence and lifecycle tracking for trades executed
 * by the Champion 4HR Timeframe Router ("4hr-timeframe-router").
 *
 * Persistence Invariants:
 * 1. Primary Ledger: MongoDB collection `paper_trades_4hr_timeframe_router`
 * 2. Secondary/Fallback Ledger: `src/data/4hr_timeframe_router_live_trades.json`
 * 3. Atomic Upserts: Every trade is keyed by deterministic id `router_${symbol}_${entry_time_ms}`
 * 4. Active Trade Auditing:
 *    - Collision Rule: Same-bar touch books STOP (-1.0R).
 *    - Target Barrier: +2.5R target touch books TARGET (+2.5R).
 *    - Time Barrier: 12 bars (48 hours) books TIME_EXPIRY at bar close.
 *    - Live Unrealized Tracking: Updates unrealized gross_r & net_r on each new bar.
 */

import fs from "fs";
import path from "path";
import { getDb } from "./mongodb";
import { toDisplaySymbol } from "./symbolMapper";

export interface RouterTradeRecord {
  id: string;
  trade_id: string;
  entryTime: string;
  entry_time: string;
  entry_time_ms: number;
  exitTime?: string;
  exit_time?: string;
  exit_time_ms?: number;
  direction: "LONG" | "SHORT";
  side: "LONG" | "SHORT";
  symbol: string;
  rawSymbol: string;
  displaySymbol: string;
  entryPrice: number;
  entry_price: number;
  exitPrice?: number;
  exit_price?: number;
  stopLoss: number;
  stop_loss: number;
  takeProfit: number;
  take_profit: number;
  stopDistancePct: number;
  stop_distance_pct: number;
  positionSizeINR: number;
  position_size_inr: number;
  gross_r: number;
  cost_r: number;
  net_r: number;
  outcomeR?: number;
  returnPct?: number;
  pnlGrossINR?: number;
  totalFeeINR?: number;
  pnlNetINR?: number;
  capital?: number;
  exitReason?: string;
  exit_type?: "TARGET" | "STOP" | "TIME_EXPIRY";
  bars_held: number;
  holdingBars?: number;
  timeframe: string;
  model: string;
  modelId: string;
  model_id?: string;
  probability: number;
  p_cutoff: number;
  status: "ACTIVE" | "CLOSED";
  modelName: string;
  routedEngine: string;
  routed_engine?: string;
  last_evaluated_bar_time?: number;
}

const DEFAULT_COST_R = 0.0404; // 10-11 bps roundtrip friction normalized by stop
const TARGET_R_MULT = 2.5;
const MAX_HOLD_BARS = 12; // 48 hours on 4H candles

function getTradesFilePath(): string {
  const primary = path.join(process.cwd(), "src", "data", "4hr_timeframe_router_live_trades.json");
  if (fs.existsSync(primary)) return primary;
  const secondary = path.join(process.cwd(), "Trader-Pro-Dashboard", "src", "data", "4hr_timeframe_router_live_trades.json");
  if (fs.existsSync(secondary)) return secondary;
  return primary;
}

export function readRouterTradesFromFile(): RouterTradeRecord[] {
  try {
    const fpath = getTradesFilePath();
    if (fs.existsSync(fpath)) {
      const content = fs.readFileSync(fpath, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("[RouterTradeManager] File read error:", err);
  }
  return [];
}

export function writeRouterTradesToFile(trades: RouterTradeRecord[]): void {
  try {
    const fpath = getTradesFilePath();
    const sorted = [...trades].sort((a, b) => b.entry_time_ms - a.entry_time_ms);
    fs.writeFileSync(fpath, JSON.stringify(sorted, null, 2), "utf-8");
  } catch (err) {
    // In serverless environments (e.g. Vercel), disk writes may fail silently; MongoDB handles persistence
    console.warn("[RouterTradeManager] File write note (serverless/read-only):", err);
  }
}

/**
 * Loads all router trades, prioritizing MongoDB and falling back to JSON file.
 */
export async function getAllRouterTrades(): Promise<RouterTradeRecord[]> {
  try {
    const db = await getDb();
    if (db) {
      const col = db.collection<RouterTradeRecord>("paper_trades_4hr_timeframe_router");
      const docs = await col.find({}).sort({ entry_time_ms: -1 }).toArray();
      if (docs && docs.length > 0) {
        return docs.map((d: any) => ({
          ...d,
          id: d.id || d.trade_id,
          trade_id: d.trade_id || d.id,
        }));
      }
    }
  } catch (err) {
    console.warn("[RouterTradeManager] DB fetch warning:", err);
  }

  return readRouterTradesFromFile();
}

/**
 * Persists or updates a single router trade into MongoDB and the fallback JSON file.
 */
export async function persistRouterTrade(trade: RouterTradeRecord): Promise<void> {
  const db = await getDb();
  if (db) {
    try {
      const col = db.collection("paper_trades_4hr_timeframe_router");
      await col.updateOne(
        { id: trade.id },
        { $set: trade },
        { upsert: true }
      );
    } catch (err) {
      console.warn(`[RouterTradeManager] DB upsert failed for trade ${trade.id}:`, err);
    }
  }

  // Update fallback file
  try {
    const fileTrades = readRouterTradesFromFile();
    const idx = fileTrades.findIndex((t) => t.id === trade.id);
    if (idx !== -1) {
      fileTrades[idx] = { ...fileTrades[idx], ...trade };
    } else {
      fileTrades.unshift(trade);
    }
    writeRouterTradesToFile(fileTrades);
  } catch (err) {
    console.warn("[RouterTradeManager] File update warning:", err);
  }
}

/**
 * Executes a new router paper trade if no active trade already exists for this symbol.
 */
export async function executeNewRouterTrade(params: {
  symbol: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  lowestLow10: number;
  highestHigh10: number;
  routedEngine: string;
  routedEngineLabel: string;
  probability: number;
  pCutoff: number;
  candleTimeMs: number;
}): Promise<RouterTradeRecord | null> {
  const {
    symbol,
    direction,
    entryPrice,
    lowestLow10,
    highestHigh10,
    routedEngine,
    probability,
    pCutoff,
    candleTimeMs,
  } = params;

  // 1. Check for existing active trade on this symbol
  const allTrades = await getAllRouterTrades();
  const existingActive = allTrades.find(
    (t) => t.symbol === symbol && t.status === "ACTIVE"
  );
  if (existingActive) {
    return existingActive; // Position already open
  }

  // 2. Compute structural stop loss clamped strictly between [1.5%, 6.0%]
  const digits = symbol.includes("DOT") ? 3 : symbol.includes("XAG") ? 3 : 2;
  let rawDistPct = 0.025;

  if (direction === "LONG") {
    rawDistPct = lowestLow10 > 0 ? (entryPrice - lowestLow10) / entryPrice : 0.025;
  } else {
    rawDistPct = highestHigh10 > 0 ? (highestHigh10 - entryPrice) / entryPrice : 0.025;
  }

  const clampedDistPct = Math.min(0.060, Math.max(0.015, Math.abs(rawDistPct)));
  const stopDist = entryPrice * clampedDistPct;

  const stopLoss = direction === "LONG"
    ? Number((entryPrice - stopDist).toFixed(digits))
    : Number((entryPrice + stopDist).toFixed(digits));

  const takeProfit = direction === "LONG"
    ? Number((entryPrice + TARGET_R_MULT * stopDist).toFixed(digits))
    : Number((entryPrice - TARGET_R_MULT * stopDist).toFixed(digits));

  const costR = Number((0.001144 / clampedDistPct).toFixed(4));
  const tradeId = `router_${symbol}_${candleTimeMs}`;
  const nowIso = new Date(candleTimeMs).toISOString();

  const newTrade: RouterTradeRecord = {
    id: tradeId,
    trade_id: tradeId,
    entryTime: nowIso,
    entry_time: nowIso,
    entry_time_ms: candleTimeMs,
    direction,
    side: direction,
    symbol,
    rawSymbol: symbol,
    displaySymbol: toDisplaySymbol(symbol),
    entryPrice: Number(entryPrice.toFixed(digits)),
    entry_price: Number(entryPrice.toFixed(digits)),
    stopLoss,
    stop_loss: stopLoss,
    takeProfit,
    take_profit: takeProfit,
    stopDistancePct: Number((clampedDistPct * 100).toFixed(2)),
    stop_distance_pct: Number(clampedDistPct.toFixed(4)),
    positionSizeINR: 1000.0,
    position_size_inr: 1000.0,
    gross_r: 0,
    cost_r: costR > 0 ? costR : DEFAULT_COST_R,
    net_r: -1 * (costR > 0 ? costR : DEFAULT_COST_R),
    outcomeR: 0,
    status: "ACTIVE",
    bars_held: 0,
    holdingBars: 0,
    timeframe: "4h",
    model: "[Router] 4HR Timeframe Router",
    modelId: "4hr-timeframe-router",
    model_id: "4hr-timeframe-router",
    modelName: "[Router] 4HR Timeframe Router",
    routedEngine,
    probability: Number(probability.toFixed(4)),
    p_cutoff: Number(pCutoff.toFixed(2)),
    last_evaluated_bar_time: candleTimeMs,
  };

  await persistRouterTrade(newTrade);
  console.log(`[RouterTradeManager] Opened ${direction} on ${symbol} @ $${entryPrice} (SL: $${stopLoss}, TP: $${takeProfit})`);
  return newTrade;
}

/**
 * Audits all active router trades against recent completed 4H candlestick bars.
 * Updates trade state (TARGET, STOP, or TIME_EXPIRY) and persists to MongoDB & JSON file.
 */
export async function auditRouterActiveTrades(
  candlesMap: Record<string, Array<{ time: number; open: number; high: number; low: number; close: number }>>
): Promise<{ auditedCount: number; closedCount: number }> {
  const allTrades = await getAllRouterTrades();
  const activeTrades = allTrades.filter((t) => t.status === "ACTIVE");

  if (activeTrades.length === 0) {
    return { auditedCount: 0, closedCount: 0 };
  }

  let closedCount = 0;

  for (const trade of activeTrades) {
    const candles = candlesMap[trade.symbol];
    if (!candles || candles.length === 0) continue;

    const entryTime = trade.entry_time_ms;
    const postEntryCandles = candles.filter((c) => c.time > entryTime);

    let tradeClosed = false;
    let evalBarCount = trade.bars_held || 0;

    for (let i = 0; i < postEntryCandles.length; i++) {
      const bar = postEntryCandles[i];
      evalBarCount = i + 1;

      const isLong = trade.direction === "LONG";
      const hitStop = isLong ? bar.low <= trade.stop_loss : bar.high >= trade.stop_loss;
      const hitTarget = isLong ? bar.high >= trade.take_profit : bar.low <= trade.take_profit;

      let exitType: "TARGET" | "STOP" | "TIME_EXPIRY" | null = null;
      let exitPrice = bar.close;
      let grossR = 0;

      // 1. Collision Rule: Simultaneous stop + target touch prioritizes STOP (-1.0R)
      if (hitStop && hitTarget) {
        exitType = "STOP";
        exitPrice = trade.stop_loss;
        grossR = -1.0;
      } else if (hitStop) {
        exitType = "STOP";
        exitPrice = trade.stop_loss;
        grossR = -1.0;
      } else if (hitTarget) {
        exitType = "TARGET";
        exitPrice = trade.take_profit;
        grossR = TARGET_R_MULT;
      } else if (evalBarCount >= MAX_HOLD_BARS) {
        exitType = "TIME_EXPIRY";
        exitPrice = bar.close;
        const stopDist = Math.abs(trade.entry_price - trade.stop_loss);
        grossR = isLong
          ? (bar.close - trade.entry_price) / (stopDist > 0 ? stopDist : 1)
          : (trade.entry_price - bar.close) / (stopDist > 0 ? stopDist : 1);
      }

      if (exitType) {
        tradeClosed = true;
        closedCount++;

        const netR = Number((grossR - trade.cost_r).toFixed(4));
        const riskINR = 100.0;
        const pnlGrossINR = Number((grossR * riskINR).toFixed(2));
        const feeINR = Number((trade.cost_r * riskINR).toFixed(2));
        const pnlNetINR = Number((netR * riskINR).toFixed(2));
        const returnPct = Number(
          (
            (isLong
              ? (exitPrice - trade.entry_price) / trade.entry_price
              : (trade.entry_price - exitPrice) / trade.entry_price) * 100
          ).toFixed(2)
        );

        const exitTimeIso = new Date(bar.time + 4 * 3600 * 1000).toISOString();

        trade.status = "CLOSED";
        trade.exit_type = exitType;
        trade.exitReason = exitType;
        trade.exitPrice = exitPrice;
        trade.exit_price = exitPrice;
        trade.exitTime = exitTimeIso;
        trade.exit_time = exitTimeIso;
        trade.exit_time_ms = bar.time + 4 * 3600 * 1000;
        trade.gross_r = Number(grossR.toFixed(4));
        trade.net_r = netR;
        trade.outcomeR = netR;
        trade.pnlGrossINR = pnlGrossINR;
        trade.totalFeeINR = feeINR;
        trade.pnlNetINR = pnlNetINR;
        trade.returnPct = returnPct;
        trade.bars_held = evalBarCount;
        trade.holdingBars = evalBarCount;
        trade.last_evaluated_bar_time = bar.time;

        await persistRouterTrade(trade);
        console.log(`[RouterTradeManager] Trade ${trade.id} CLOSED (${exitType}) @ $${exitPrice} | Net R: ${netR}`);
        break;
      }
    }

    if (!tradeClosed) {
      trade.bars_held = evalBarCount;
      trade.holdingBars = evalBarCount;
      if (postEntryCandles.length > 0) {
        const latestBar = postEntryCandles[postEntryCandles.length - 1];
        trade.last_evaluated_bar_time = latestBar.time;
        const isLong = trade.direction === "LONG";
        const stopDist = Math.abs(trade.entry_price - trade.stop_loss);
        const curGrossR = isLong
          ? (latestBar.close - trade.entry_price) / (stopDist > 0 ? stopDist : 1)
          : (trade.entry_price - latestBar.close) / (stopDist > 0 ? stopDist : 1);
        trade.gross_r = Number(curGrossR.toFixed(4));
        trade.net_r = Number((curGrossR - trade.cost_r).toFixed(4));
      }
      await persistRouterTrade(trade);
    }
  }

  return { auditedCount: activeTrades.length, closedCount };
}

/**
 * Reconciles historical prediction logs with the trades ledger.
 * Backfills any unrecorded EXECUTED_TRADE signals (such as the Nov 7 DOTUSDT trade).
 */
export async function reconcilePastRouterTrades(
  fetchCandlesFn: (symbol: string) => Promise<any[]>
): Promise<number> {
  let backfilledCount = 0;
  const db = await getDb();
  if (!db) return 0;

  try {
    const logsCol = db.collection("live_prediction_logs");
    const executedLogs = await logsCol
      .find({
        model_id: "4hr-timeframe-router",
        decision: "EXECUTED_TRADE",
      })
      .toArray();

    if (executedLogs.length === 0) return 0;

    const existingTrades = await getAllRouterTrades();
    const tradeIds = new Set(existingTrades.map((t) => t.id));

    for (const log of executedLogs) {
      const expectedId = `router_${log.symbol}_${log.timestamp_ms}`;
      if (tradeIds.has(expectedId)) continue;

      // Found an unrecorded executed trade!
      console.log(`[RouterTradeManager] Reconciling unrecorded trade for ${log.symbol} at ${log.time_utc}...`);

      const candles = await fetchCandlesFn(log.symbol);
      const isShort = log.decision_reason?.toLowerCase().includes("short") || log.regime === "BEARISH";
      const direction: "LONG" | "SHORT" = isShort ? "SHORT" : "LONG";
      const entryPrice = log.price;
      const digits = log.symbol.includes("DOT") ? 3 : 2;

      const stopDistClamped = Math.min(
        0.060,
        Math.max(
          0.015,
          isShort
            ? (log.donchian_high - entryPrice) / entryPrice
            : (entryPrice - log.donchian_low) / entryPrice
        )
      );
      const stopDist = entryPrice * stopDistClamped;
      const stopLoss = isShort
        ? Number((entryPrice + stopDist).toFixed(digits))
        : Number((entryPrice - stopDist).toFixed(digits));
      const takeProfit = isShort
        ? Number((entryPrice - TARGET_R_MULT * stopDist).toFixed(digits))
        : Number((entryPrice + TARGET_R_MULT * stopDist).toFixed(digits));

      const newTrade: RouterTradeRecord = {
        id: expectedId,
        trade_id: expectedId,
        entryTime: new Date(log.timestamp_ms).toISOString(),
        entry_time: new Date(log.timestamp_ms).toISOString(),
        entry_time_ms: log.timestamp_ms,
        direction,
        side: direction,
        symbol: log.symbol,
        rawSymbol: log.symbol,
        displaySymbol: toDisplaySymbol(log.symbol),
        entryPrice: Number(entryPrice.toFixed(digits)),
        entry_price: Number(entryPrice.toFixed(digits)),
        stopLoss,
        stop_loss: stopLoss,
        takeProfit,
        take_profit: takeProfit,
        stopDistancePct: Number((stopDistClamped * 100).toFixed(2)),
        stop_distance_pct: Number(stopDistClamped.toFixed(4)),
        positionSizeINR: 1000.0,
        position_size_inr: 1000.0,
        gross_r: 0,
        cost_r: DEFAULT_COST_R,
        net_r: -DEFAULT_COST_R,
        status: "ACTIVE",
        bars_held: 0,
        timeframe: "4h",
        model: "[Router] 4HR Timeframe Router",
        modelId: "4hr-timeframe-router",
        modelName: "[Router] 4HR Timeframe Router",
        routedEngine: log.routed_engine || "om-unified-4h-engine",
        probability: log.probability || 0.75,
        p_cutoff: log.p_cutoff || 0.5,
      };

      await persistRouterTrade(newTrade);
      tradeIds.add(expectedId);

      // Now audit against candles
      if (candles && candles.length > 0) {
        await auditRouterActiveTrades({ [log.symbol]: candles });
      }

      // Update the prediction log so it references this trade
      await logsCol.updateOne(
        { _id: log._id },
        {
          $set: {
            trade_details: {
              trade_id: expectedId,
              side: direction,
              entry_price: entryPrice,
              stop_loss: stopLoss,
              take_profit: takeProfit,
              position_size: 1000.0,
              risk_r: 1.0,
            },
          },
        }
      );

      backfilledCount++;
    }
  } catch (err) {
    console.warn("[RouterTradeManager] Reconciliation error:", err);
  }

  return backfilledCount;
}
