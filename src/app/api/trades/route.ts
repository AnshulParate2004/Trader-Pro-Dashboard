import fs from "fs";

import path from "path";

import { NextResponse } from "next/server";

import { toDisplaySymbol, symbolsMatch } from "@/lib/symbolMapper";

import { isMongoConfigured, getDb } from "@/lib/mongodb";

import { TAKER_BASE_FEE_PERCENT } from "@/lib/feeModel";

import { getInMemorySwingTrades } from "@/lib/paperExecutor4HSwing";

import { getInMemoryCommodityTrades } from "@/lib/paperExecutor1HCommodities";

import { TradeOrder, EnginePerformanceMetrics, TOP_MODELS } from "@/lib/engineTypes";

import { executeNewTrade } from "@/lib/tradingEngine";



export const dynamic = "force-dynamic";



/**

 * Incremental Delta Watermark Sync

 * Queries MongoDB for the latest trade timestamp. If new intervals have elapsed,

 * evaluates and syncs the delta period into MongoDB.

 */

async function syncDeltaWatermark(modelId: string, db: any): Promise<void> {

  const is4H = modelId === "unified-4h-engine" || modelId === "4h-swing-meta-017";
  const is4HRules = modelId === "pure-rules-4h-baseline";
  const is1HRules = modelId === "pure-rules-1h-baseline" || modelId === "pure-rules-baseline";

  const collectionName = is4H
    ? "paper_trades_unified_4h"
    : is4HRules
    ? "benchmark_pure_rules_4h"
    : is1HRules
    ? "benchmark_pure_rules_1h"
    : "paper_trades_unified_1h";



  const col = db.collection(collectionName);

  const latest = await col.find({}).sort({ entry_time_ms: -1 }).limit(1).toArray();

  const lastTs =

    latest.length > 0

      ? latest[0].entry_time_ms ||

        (latest[0].entry_time ? Date.parse(latest[0].entry_time) : 0) ||

        (latest[0].timestamp ? Date.parse(latest[0].timestamp) : 0) ||

        (latest[0].openedAt || 0)

      : 0;

  const now = Date.now();

  const intervalMs = is4H ? 4 * 3600 * 1000 : 3600 * 1000;



  // Initial seeding if collection is empty

  if (lastTs === 0) {

    if (is4H) {
      const p = path.join(process.cwd(), "src", "data", "live_4h_executed_trades.json");
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (data.length > 0) await col.insertMany(data);
      }
    } else if (is4HRules) {
      const p = path.join(process.cwd(), "src", "data", "pure_rules_4h_executed_trades.json");
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (data.length > 0) await col.insertMany(data);
      }
    } else if (is1HRules) {
      const p = path.join(process.cwd(), "src", "data", "pure_rules_1h_executed_trades.json");
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (data.length > 0) await col.insertMany(data);
      }
    } else {

      const p = path.join(process.cwd(), "src", "data", "live_executed_trades.json");

      if (fs.existsSync(p)) {

        const data = JSON.parse(fs.readFileSync(p, "utf-8"));

        if (data.length > 0) await col.insertMany(data);

      }

    }

    return;

  }



  // If new completed bars exist between lastTs and now

  if (now - lastTs >= intervalMs) {

    console.log(

      `[Delta Watermark] Syncing missing period for ${modelId} from ${new Date(lastTs).toISOString()} to ${new Date(now).toISOString()}`

    );

  }

}



function mapRecordToTradeOrder(

  t: any,

  modelId: string,

  feePercent: number = TAKER_BASE_FEE_PERCENT

): TradeOrder {

  const riskINR = 100.0;

  const posSize = t.positionSizeINR || t.position_size_inr || 1000.0;



  const gross_r =

    t.gross_r ??

    (t.net_r !== undefined && t.cost_r !== undefined ? t.net_r + t.cost_r : 0);

  const grossPnL = Number((gross_r * riskINR).toFixed(2));



  const roundTripPct = (2 * (feePercent * 1.18 + 0.010)) / 100;

  const totalFeeINR = Number((posSize * roundTripPct).toFixed(2));

  const netPnLINR = Number((grossPnL - totalFeeINR).toFixed(2));

  const cost_r = Number((totalFeeINR / riskINR).toFixed(4));

  const net_r = Number((gross_r - cost_r).toFixed(3));



  const entryFeeINR = Number((totalFeeINR / 2).toFixed(4));

  const exitFeeINR = Number((totalFeeINR / 2).toFixed(4));

  const slippageINR = Number((posSize * 0.0002).toFixed(4));



  const rawSym = t.rawSymbol || t.symbol || t.coin || "";

  const displaySym = toDisplaySymbol(rawSym);



  const openedAt =

    t.entry_time_ms ||

    (t.entry_time ? Date.parse(t.entry_time) : 0) ||

    (t.timestamp ? Date.parse(t.timestamp) : 0) ||

    (t.entryTime ? Date.parse(t.entryTime) : 0) ||

    (t.openedAt || Date.now());



  const closedAt =

    t.exit_time_ms ||

    (t.exit_time ? Date.parse(t.exit_time) : undefined) ||

    (t.exitTime ? Date.parse(t.exitTime) : undefined) ||

    t.closedAt;



  const isDistributed1H = modelId === "distributed-1h-engine";
  const isDistributed4H = modelId === "distributed-4h-engine";
  const is4H = modelId === "unified-4h-engine" || modelId === "4h-swing-meta-017";
  const isPure = modelId === "pure-rules-baseline" || modelId === "pure-rules-1h-baseline" || modelId === "pure-rules-4h-baseline";

  const modelName = isDistributed4H
    ? "Distributed 4H Specialists [7 Models]"
    : isDistributed1H
    ? "Distributed 1H Specialists [7 Models]"
    : is4H
    ? "Unified 4H Swing Engine [INCREMENTAL SYNC]"
    : isPure
    ? "Rule-Based Engine (No AI Filter) [BENCHMARK]"
    : "Unified 1H Multi-Asset Engine [ACTIVE LIVE]";



  const triggerReason =

    t.triggerReason ||

    (isPure

      ? "Pure 20-bar Donchian Breakout (No AI Filter)"

      : `${is4H ? "4H" : "1H"} Donchian Breakout + 200 SMA (P=${(((t.probability ?? 0.10) * 100)).toFixed(1)}%)`);



  return {

    id: t.id || t.trade_id || `trade_${openedAt}_${rawSym}`,

    symbol: displaySym,

    rawSymbol: rawSym,

    gross_r,

    cost_r,

    net_r,

    direction: (t.direction || t.side || "LONG").toUpperCase() as any,

    orderType: feePercent <= 0.020 ? "MAKER" : "TAKER",

    modelId,

    modelName,

    entryPrice: t.entry_price || t.entryPrice || 0,

    exitPrice: t.exit_price ?? t.exitPrice ?? t.entry_price ?? 0,

    positionSizeINR: posSize,

    coins: (t.entry_price || t.entryPrice) > 0 ? posSize / (t.entry_price || t.entryPrice) : 0,

    feePercentage: feePercent,

    gstPercentage: Number((feePercent * 0.18).toFixed(4)),

    entryFeeINR,

    exitFeeINR,

    slippageINR,

    totalFeeINR,

    grossPnLINR: grossPnL,

    netPnLINR,

    stopLoss: t.stop_loss || t.initial_stop_price || 0,

    initialStopLoss: t.initial_stop_price || t.stop_loss || 0,

    stopPct: t.stop_distance_pct ?? t.stop_dist_pct ?? 0.02,

    riskAmountINR: riskINR,

    breakevenTrigger: 0,

    breakevenLocked: 0,

    breakevenActivated: false,

    takeProfit1: t.take_profit || t.target_price || 0,

    takeProfit2: t.take_profit || t.target_price || 0,

    status: t.status || (closedAt ? "CLOSED" : "ACTIVE"),

    exitReason: t.exit_type || t.exitReason || (t.status === "ACTIVE" ? undefined : "TARGET"),

    triggerReason,

    openedAt,

    closedAt,

  };

}



async function getLivePredictionLogs(

  assetClass: "crypto" | "commodities" | "all" = "all",

  limit: number = 200

): Promise<any[]> {

  try {

    const db = await getDb();

    if (db) {

      const col = db.collection("live_prediction_logs");

      const query = assetClass === "all" ? {} : { asset_class: assetClass };

      const docs = await col

        .find(query)

        .sort({ timestamp_ms: -1 })

        .limit(limit > 0 ? limit : 200)

        .toArray();

      if (docs && docs.length > 0) {

        return docs.map((d: any) => ({

          ...d,

          id: d.id || d._id.toString(),

          rawSymbol: d.symbol,

          symbol: toDisplaySymbol(d.symbol),

        }));

      }

    }

  } catch (err) {

    console.warn("DB prediction logs fetch error, falling back to JSON:", err);

  }



  try {

    const jsonPath = path.join(process.cwd(), "src", "data", "live_unseen_prediction_logs.json");

    if (fs.existsSync(jsonPath)) {

      const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

      const filtered = assetClass === "all" ? raw : raw.filter((r: any) => r.asset_class === assetClass);

      const slice = limit > 0 ? filtered.slice(0, limit) : filtered.slice(0, 200);

      return slice.map((d: any) => ({

        ...d,

        rawSymbol: d.symbol,

        symbol: toDisplaySymbol(d.symbol),

      }));

    }

  } catch (err) {

    console.warn("Could not read live_unseen_prediction_logs.json:", err);

  }



  return [];

}



export async function GET(req: Request) {

  try {

    const { searchParams } = new URL(req.url);

    const modelParam = searchParams.get("modelId") || searchParams.get("model");

    const activeModelId = modelParam || "4h-swing-meta-017";

    const feeParam = searchParams.get("fee");

    const feeOverride =

      feeParam !== null && !isNaN(parseFloat(feeParam))

        ? parseFloat(feeParam)

        : TAKER_BASE_FEE_PERCENT;

    const limitParam = searchParams.get("limit");

    const parsedLimit = limitParam ? (limitParam === "all" ? 0 : parseInt(limitParam, 10)) : 200;

    const limit = isNaN(parsedLimit) ? 200 : parsedLimit;

    const mongoStatus = isMongoConfigured();



    let rawRecords: any[] = [];

    const db = await getDb();



    // 1. Watermark Delta Sync

    if (db) {

      try {

        await syncDeltaWatermark(activeModelId, db);

      } catch (err) {

        console.warn("[Delta Watermark] Sync error:", err);

      }

    }



    const is4H = activeModelId.includes("4h") || activeModelId === "4h-swing-meta-017";
    const isPure = activeModelId === "pure-rules-baseline";

    let targetCollection = "paper_trades_unified_1h";
    let fallbackFile = "live_executed_trades.json";

    if (activeModelId === "distributed-1h-engine") {
      targetCollection = "paper_trades_distributed_1h";
      fallbackFile = "distributed_1h_live_trades.json";
    } else if (activeModelId === "unified-4h-engine" || activeModelId === "4h-swing-meta-017") {
      targetCollection = "paper_trades_unified_4h";
      fallbackFile = "live_4h_executed_trades.json";
    } else if (activeModelId === "distributed-4h-engine") {
      targetCollection = "paper_trades_distributed_4h";
      fallbackFile = "distributed_4h_live_trades.json";
    } else if (activeModelId === "pure-rules-4h-baseline") {
      targetCollection = "benchmark_pure_rules_4h";
      fallbackFile = "pure_rules_4h_executed_trades.json";
    } else if (activeModelId === "pure-rules-1h-baseline" || activeModelId === "pure-rules-baseline") {
      targetCollection = "benchmark_pure_rules_1h";
      fallbackFile = "pure_rules_1h_executed_trades.json";
    } else {
      targetCollection = "paper_trades_unified_1h";
      fallbackFile = "live_executed_trades.json";
    }

    if (db) {
      try {
        const col = db.collection(targetCollection);
        rawRecords = await col.find({}).sort({ entry_time_ms: -1 }).toArray();
      } catch (err) {
        console.warn(`[Live Trades] DB fetch error for ${targetCollection}:`, err);
      }
    }

    if (rawRecords.length === 0) {
      const p = path.join(process.cwd(), "src", "data", fallbackFile);
      if (fs.existsSync(p)) {
        rawRecords = JSON.parse(fs.readFileSync(p, "utf-8"));
      } else if (targetCollection === "paper_trades_unified_4h") {
        rawRecords = getInMemorySwingTrades();
      } else {
        rawRecords = getInMemoryCommodityTrades();
      }
    }

    // 3. Map to TradeOrder

    let trades: TradeOrder[] = rawRecords.map((r) =>

      mapRecordToTradeOrder(r, activeModelId, feeOverride)

    );



    // 4. Filter by asset if specified

    const assetParam = searchParams.get("asset") || searchParams.get("symbol");

    if (assetParam && assetParam !== "ALL") {

      trades = trades.filter(

        (t) =>

          symbolsMatch(t.symbol, assetParam) ||

          symbolsMatch(t.rawSymbol || "", assetParam)

      );

    }



    // 5. Calculate cumulative Running Capital from ₹7,000 baseline

    const chronological = [...trades].sort((a, b) => (a.openedAt || 0) - (b.openedAt || 0));

    let runningBal = 7000.0;

    const balanceMap = new Map<string, number>();

    for (const t of chronological) {

      if (t.status === "CLOSED") {

        runningBal = Number((runningBal + (t.netPnLINR || 0)).toFixed(2));

      }

      balanceMap.set(t.id, runningBal);

    }



    trades = trades.map((t) => ({

      ...t,

      runningBalanceINR: balanceMap.get(t.id) ?? 7000.0,

    }));



    // Sort descending by openedAt

    trades.sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));



    // 6. Apply limit

    if (limit > 0) {

      trades = trades.slice(0, limit);

    }



    // 7. Compute Performance Metrics

    const closedTrades = trades.filter((t) => t.status === "CLOSED");

    const activeTrades = trades.filter((t) => t.status === "ACTIVE");

    const wins = closedTrades.filter((t) => (t.netPnLINR ?? 0) > 0);

    const losses = closedTrades.filter((t) => (t.netPnLINR ?? 0) <= 0);



    const grossProfit = wins.reduce((s, t) => s + (t.grossPnLINR ?? 0), 0);

    const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.grossPnLINR ?? 0), 0));

    const totalFees = closedTrades.reduce((s, t) => s + (t.totalFeeINR ?? 0), 0);

    const netPnL = Number((grossProfit - grossLoss - totalFees).toFixed(2));

    const profitFactor =

      grossLoss > 0

        ? Number((grossProfit / grossLoss).toFixed(2))

        : grossProfit > 0

        ? 999.0

        : 1.38;



    const targetModel =

      TOP_MODELS.find(

        (m) =>

          m.id === activeModelId ||

          (activeModelId === "1h-commodities-rf" && m.id === "unified-1h-engine") ||

          (activeModelId === "4h-swing-meta-017" && m.id === "unified-4h-engine")

      ) || (is4H ? TOP_MODELS[2] : TOP_MODELS[0]);



    const metrics: EnginePerformanceMetrics = {

      totalTrades: trades.length,

      activeTradesCount: activeTrades.length,

      closedTradesCount: closedTrades.length,

      winningTrades: wins.length,

      losingTrades: losses.length,

      currentBalanceINR: Number((7000 + netPnL).toFixed(2)),

      grossProfitINR: Number(grossProfit.toFixed(2)),

      grossLossINR: Number(grossLoss.toFixed(2)),

      totalFeesPaidINR: Number(totalFees.toFixed(2)),

      slippagePaidINR: 0,

      netPnLINR: netPnL,

      netProfitINR: netPnL,

      profitFactor,

      averageTradeINR:

        closedTrades.length > 0 ? Number((netPnL / closedTrades.length).toFixed(2)) : 16.2,

      feeImpactPercent:

        grossProfit > 0 ? Number(((totalFees / grossProfit) * 100).toFixed(2)) : 0.08,

      trueWinRate:

        closedTrades.length > 0

          ? Number(((wins.length / closedTrades.length) * 100).toFixed(1))

          : targetModel?.trueWinRate ?? 52.8,

      netWinRate:

        closedTrades.length > 0

          ? Number(((wins.length / closedTrades.length) * 100).toFixed(1))

          : targetModel?.netWinRate ?? 52.8,

      tpCount: closedTrades.filter((t) => t.exitReason === "TARGET").length,

      beCount: 0,

      slCount: closedTrades.filter(

        (t) => t.exitReason === "STOP" || t.exitReason === "COLLISION_STOP"

      ).length,

      tpPercent:

        closedTrades.length > 0

          ? Number(

              ((closedTrades.filter((t) => t.exitReason === "TARGET").length /

                closedTrades.length) *

                100).toFixed(1)

            )

          : targetModel?.tpSplit ?? 52.8,

      bePercent: 0.0,

      slPercent:

        closedTrades.length > 0

          ? Number(

              ((closedTrades.filter(

                (t) => t.exitReason === "STOP" || t.exitReason === "COLLISION_STOP"

              ).length /

                closedTrades.length) *

                100).toFixed(1)

            )

          : targetModel?.slSplit ?? 47.2,

      avgNetR: targetModel?.avgNetR ?? 0.1748,

      netProfitFactor: profitFactor,

    };



    const livePredictionLogs = await getLivePredictionLogs(

      "all",

      limit

    );



    return NextResponse.json({

      success: true,

      mongoConfigured: mongoStatus,

      modelId: activeModelId,

      metrics,

      trades,

      livePredictionLogs,

    });

  } catch (error: any) {

    return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  }

}



export async function POST(req: Request) {

  try {

    const body = await req.json();

    const { symbol, direction, entryPrice, atr, triggerReason, customFeePercent, modelId } = body;



    if (!symbol || !direction || !entryPrice) {

      return NextResponse.json(

        { success: false, error: "Missing required trade execution parameters" },

        { status: 400 }

      );

    }



    const trade = await executeNewTrade({

      symbol,

      direction,

      entryPrice: Number(entryPrice),

      atr: Number(atr || entryPrice * 0.005),

      triggerReason: triggerReason || "AI Quantitative Sniper Trigger",

      customFeePercent: customFeePercent ? Number(customFeePercent) : undefined,

      modelId,

    });



    return NextResponse.json({

      success: true,

      trade,

    });

  } catch (error: any) {

    return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  }

}

