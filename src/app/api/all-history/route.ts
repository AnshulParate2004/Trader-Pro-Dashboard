import { toRawSymbol, toDisplaySymbol, symbolsMatch } from "@/lib/symbolMapper";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export interface HistoricalTransactionTrade {
  id: string;
  trade_id?: string;
  pos: number;
  model_id: string;
  modelId: string;
  timeframe: string;
  entryTime: string;
  entry_time: string;
  entry_time_ms: number;
  exitTime: string;
  exit_time: string;
  exit_time_ms: number;
  direction: "LONG" | "SHORT";
  side: "LONG" | "SHORT";
  symbol: string;
  rawSymbol: string;
  displaySymbol: string;
  entryPrice: number;
  entry_price: number;
  exitPrice: number;
  exit_price: number;
  stopLoss: number;
  stop_loss: number;
  takeProfit: number;
  take_profit: number;
  stopDistancePct: number;
  stop_distance_pct: number;
  positionSizeINR: number;
  gross_r: number;
  cost_r: number;
  net_r: number;
  outcomeR: number;
  returnPct: number;
  pnlGrossINR: number;
  totalFeeINR: number;
  pnlNetINR: number;
  capital: number;
  exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "TIME_EXPIRY";
  exit_type: string;
  bars_held: number;
  holdingBars: number;
  probability?: number | null;
  p_cutoff?: number | null;
  status: "CLOSED";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const modelParam = searchParams.get("modelId") || "om-distributed-4h-engine";
    const symbolParam = (searchParams.get("symbol") || searchParams.get("coin") || "ALL").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(1000, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const side = (searchParams.get("side") || searchParams.get("direction") || "ALL").toUpperCase();
    const outcome = (searchParams.get("outcome") || "ALL").toUpperCase();

    // 1. Try MongoDB Atlas on master collection `all_historical_trades`
    const db = await getDb();
    if (db) {
      try {
        const col = db.collection("all_historical_trades");
        const query: any = { model_id: modelParam };

        if (symbolParam && symbolParam !== "ALL") {
          const raw = toRawSymbol(symbolParam);
          const disp = toDisplaySymbol(symbolParam);
          query.symbol = { $in: [symbolParam, raw, disp] };
        }

        if (side === "LONG" || side === "SHORT") query.side = side;
        if (outcome && outcome !== "ALL") query.exitReason = outcome;

        const total = await col.countDocuments(query);
        if (total > 0) {
          const totalPages = Math.max(1, Math.ceil(total / limit));
          const validPage = Math.min(page, totalPages);
          const skip = (validPage - 1) * limit;

          // Retrieve sorted by entry_time_ms descending (latest first)
          const docs = await col
            .find(query)
            .sort({ entry_time_ms: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

          const trades: HistoricalTransactionTrade[] = docs.map((d: any) => ({
            id: d.id,
            trade_id: d.trade_id || d.id,
            pos: d.pos,
            model_id: d.model_id,
            modelId: d.modelId || d.model_id,
            timeframe: d.timeframe || "1h",
            entryTime: d.entryTime || d.entry_time,
            entry_time: d.entry_time || d.entryTime,
            entry_time_ms: d.entry_time_ms,
            exitTime: d.exitTime || d.exit_time,
            exit_time: d.exit_time || d.exitTime,
            exit_time_ms: d.exit_time_ms,
            direction: d.direction || d.side,
            side: d.side || d.direction,
            symbol: toDisplaySymbol(d.symbol),
            rawSymbol: toRawSymbol(d.symbol),
            displaySymbol: toDisplaySymbol(d.symbol),
            entryPrice: d.entryPrice ?? d.entry_price,
            entry_price: d.entry_price ?? d.entryPrice,
            exitPrice: d.exitPrice ?? d.exit_price,
            exit_price: d.exit_price ?? d.exitPrice,
            stopLoss: d.stopLoss ?? d.stop_loss,
            stop_loss: d.stop_loss ?? d.stopLoss,
            takeProfit: d.takeProfit ?? d.take_profit,
            take_profit: d.take_profit ?? d.takeProfit,
            stopDistancePct: d.stopDistancePct ?? d.stop_distance_pct,
            stop_distance_pct: d.stop_distance_pct ?? d.stopDistancePct,
            positionSizeINR: d.positionSizeINR ?? 1000.0,
            gross_r: d.gross_r,
            cost_r: d.cost_r,
            net_r: d.net_r,
            outcomeR: d.outcomeR ?? d.net_r,
            returnPct: d.returnPct,
            pnlGrossINR: d.pnlGrossINR,
            totalFeeINR: d.totalFeeINR,
            pnlNetINR: d.pnlNetINR,
            capital: d.capital,
            exitReason: d.exitReason,
            exit_type: d.exit_type || d.exitReason,
            bars_held: d.bars_held ?? d.holdingBars,
            holdingBars: d.holdingBars ?? d.bars_held,
            probability: d.probability,
            p_cutoff: d.p_cutoff,
            status: "CLOSED",
          }));

          // Fetch model summary metrics if available
          let summaryMetrics = null;
          try {
            const metricsDoc = await db.collection("all_historical_metrics").findOne({});
            if (metricsDoc && metricsDoc.metrics && metricsDoc.metrics[modelParam]) {
              summaryMetrics = metricsDoc.metrics[modelParam];
            }
          } catch (_) {}

          return NextResponse.json({
            success: true,
            modelId: modelParam,
            symbol: symbolParam,
            source: "mongodb_atlas",
            page: validPage,
            limit,
            totalPages,
            totalHistoricalTrades: total,
            metrics: summaryMetrics,
            returnedCount: trades.length,
            trades,
          });
        }
      } catch (dbErr) {
        console.warn("MongoDB Atlas all_historical_trades query failed, using static JSON:", dbErr);
      }
    }

    // 2. Static JSON fallback: src/data/all_historical/all_historical_<modelId>.json
    const jsonPath = path.join(process.cwd(), "src", "data", "all_historical", `all_historical_${modelParam}.json`);
    let summaryMetrics = null;

    try {
      const summaryPath = path.join(process.cwd(), "src", "data", "all_historical_summary.json");
      if (fs.existsSync(summaryPath)) {
        const sumData = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
        if (sumData[modelParam]) {
          summaryMetrics = sumData[modelParam];
        }
      }
    } catch (_) {}

    if (fs.existsSync(jsonPath)) {
      const rawData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      let filtered = rawData;

      if (symbolParam && symbolParam !== "ALL") {
        filtered = filtered.filter((t: any) =>
          symbolsMatch(t.symbol, symbolParam) ||
          symbolsMatch(t.rawSymbol || "", symbolParam) ||
          symbolsMatch(t.displaySymbol || "", symbolParam)
        );
      }

      if (side === "LONG" || side === "SHORT") {
        filtered = filtered.filter((t: any) => t.side === side || t.direction === side);
      }

      if (outcome && outcome !== "ALL") {
        filtered = filtered.filter((t: any) => t.exitReason === outcome);
      }

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const validPage = Math.min(page, totalPages);
      const skip = (validPage - 1) * limit;

      // Newest first
      const sorted = [...filtered].sort((a: any, b: any) => b.entry_time_ms - a.entry_time_ms);
      const paginated = sorted.slice(skip, skip + limit);

      return NextResponse.json({
        success: true,
        modelId: modelParam,
        symbol: symbolParam,
        source: "static_json_bundle",
        page: validPage,
        limit,
        totalPages,
        totalHistoricalTrades: total,
        metrics: summaryMetrics,
        returnedCount: paginated.length,
        trades: paginated,
      });
    }

    return NextResponse.json({
      success: true,
      modelId: modelParam,
      symbol: symbolParam,
      source: "empty_fallback",
      page: 1,
      limit,
      totalPages: 1,
      totalHistoricalTrades: 0,
      metrics: null,
      returnedCount: 0,
      trades: [],
    });
  } catch (err: any) {
    console.error("Error in /api/all-history GET:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch historical transactions" },
      { status: 500 }
    );
  }
}
