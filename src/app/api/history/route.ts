import { toRawSymbol, toDisplaySymbol, symbolsMatch } from "@/lib/symbolMapper";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export interface HistoricalTrade {
  id: string;
  entryTime: string;
  exitTime: string;
  side: "LONG" | "SHORT";
  outcomeR: number;
  returnPct: number;
  exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "BREAKEVEN_RATCHET" | "TIME_EXPIRY";
  symbol?: string;
  rawSymbol?: string;
  entry_price?: number;
  exit_price?: number;
  probability?: number;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const modelParam = searchParams.get("modelId");
    const symbolParam = (searchParams.get("symbol") || searchParams.get("coin") || "ALL").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(1000, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const side = (searchParams.get("side") || searchParams.get("direction") || "ALL").toUpperCase();
    const outcome = (searchParams.get("outcome") || "ALL").toUpperCase();

    // Route legacy 15m/5m requests separately if explicitly asked
    const isLegacy15M = modelParam && (modelParam.includes("15m") || modelParam.includes("5m") || modelParam.includes("master"));

    if (isLegacy15M) {
      let queryModelId = "15m-sniper-030";
      if (modelParam.includes("5m") || modelParam.includes("master")) {
        queryModelId = "master-confluence-multi";
      }

      const db = await getDb();
      if (db) {
        try {
          const col = db.collection("historical_trades");
          const query: any = { modelId: queryModelId };
          if (side === "LONG" || side === "SHORT") query.side = side;
          if (outcome && outcome !== "ALL") query.exitReason = outcome;

          const total = await col.countDocuments(query);
          const totalPages = Math.max(1, Math.ceil(total / limit));
          const validPage = Math.min(page, totalPages);
          const skip = (validPage - 1) * limit;

          const docs = await col.find(query).sort({ pos: -1 }).skip(skip).limit(limit).toArray();
          const trades: HistoricalTrade[] = docs.map((d: any) => ({
            id: d.id,
            entryTime: d.entryTime,
            exitTime: d.exitTime,
            side: d.side,
            outcomeR: d.outcomeR,
            returnPct: d.returnPct,
            exitReason: d.exitReason,
          }));

          return NextResponse.json({
            success: true,
            modelId: modelParam,
            source: "mongodb_legacy",
            page: validPage,
            limit,
            totalPages,
            totalHistoricalTrades: total,
            returnedCount: trades.length,
            trades,
          });
        } catch (dbErr) {
          console.warn("MongoDB legacy historical trades query error:", dbErr);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3 PURE ALL-7 ASSET ENGINES (Unified 1H, Unified 4H, Pure Rules Baseline)
    // -------------------------------------------------------------------------
    let targetCollection = "historical_trades_unified_1h";
    let fallbackFile = "unified_1h_historical_trades.json";

    if (modelParam === "v1-distributed-4h-engine") {
      targetCollection = "historical_trades_v1_distributed_4h";
      fallbackFile = "v1_distributed_4h_unseen_trades.json";
    } else if (modelParam === "v1-stacking-meta-engine") {
      targetCollection = "historical_trades_v1_stacking_1h";
      fallbackFile = "v1_stacking_1h_unseen_trades.json";
    } else if (modelParam === "v1-distributed-1h-engine") {
      targetCollection = "historical_trades_v1_distributed_1h";
      fallbackFile = "v1_distributed_1h_unseen_trades.json";
    } else if (modelParam === "v1-unified-1h-engine") {
      targetCollection = "historical_trades_v1_unified_1h";
      fallbackFile = "v1_unified_1h_unseen_trades.json";
    } else if (modelParam === "v1-consensus-committee-engine") {
      targetCollection = "historical_trades_v1_consensus_1h";
      fallbackFile = "v1_consensus_1h_unseen_trades.json";
    } else if (modelParam === "v1-unified-4h-engine") {
      targetCollection = "historical_trades_v1_unified_4h";
      fallbackFile = "v1_unified_4h_unseen_trades.json";
    } else if (modelParam === "new-consensus-committee-engine") {
      targetCollection = "historical_trades_new_consensus_1h";
      fallbackFile = "new_consensus_1h_unseen_trades.json";
    } else if (modelParam === "new-stacking-meta-engine") {
      targetCollection = "historical_trades_new_stacking_1h";
      fallbackFile = "new_stacking_1h_unseen_trades.json";
    } else if (modelParam === "om-distributed-4h-engine") {
      targetCollection = "historical_trades_om_distributed_4h";
      fallbackFile = "om_distributed_4h_unseen_trades.json";
    } else if (modelParam === "om-stacking-meta-engine") {
      targetCollection = "historical_trades_om_stacking_1h";
      fallbackFile = "om_stacking_1h_unseen_trades.json";
    } else if (modelParam === "om-distributed-1h-engine") {
      targetCollection = "historical_trades_om_distributed_1h";
      fallbackFile = "om_distributed_1h_unseen_trades.json";
    } else if (modelParam === "om-unified-1h-engine") {
      targetCollection = "historical_trades_om_unified_1h";
      fallbackFile = "om_unified_1h_unseen_trades.json";
    } else if (modelParam === "om-consensus-committee-engine") {
      targetCollection = "historical_trades_om_consensus_1h";
      fallbackFile = "om_consensus_1h_unseen_trades.json";
    } else if (modelParam === "om-unified-4h-engine") {
      targetCollection = "historical_trades_om_unified_4h";
      fallbackFile = "om_unified_4h_unseen_trades.json";
    } else if (modelParam === "distributed-1h-engine") {
      targetCollection = "historical_trades_distributed_1h";
      fallbackFile = "distributed_1h_historical_trades.json";
    } else if (modelParam === "unified-4h-engine" || modelParam === "4h-swing-meta-017") {
      targetCollection = "historical_trades_unified_4h";
      fallbackFile = "unified_4h_historical_trades.json";
    } else if (modelParam === "distributed-4h-engine") {
      targetCollection = "historical_trades_distributed_4h";
      fallbackFile = "distributed_4h_historical_trades.json";
    } else if (modelParam === "pure-rules-4h-baseline") {
      targetCollection = "historical_trades_pure_rules_4h";
      fallbackFile = "pure_rules_4h_historical_trades.json";
    } else if (modelParam === "pure-rules-1h-baseline" || modelParam === "pure-rules-baseline") {
      targetCollection = "historical_trades_pure_rules_1h";
      fallbackFile = "pure_rules_1h_historical_trades.json";
    } else {
      targetCollection = "historical_trades_unified_1h";
      fallbackFile = "unified_1h_historical_trades.json";
    }

    const activeModelId = modelParam || (targetCollection === "historical_trades_unified_4h" ? "unified-4h-engine" : "unified-1h-engine");

    // 1. Try MongoDB on dedicated targetCollection
    const db = await getDb();
    if (db) {
      try {
        const col = db.collection(targetCollection);
        const query: any = {};

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

          const docs = await col.find(query).sort({ pos: 1 }).skip(skip).limit(limit).toArray();
          const trades: HistoricalTrade[] = docs.map((d: any) => ({
            id: d.id,
            entryTime: d.entryTime,
            exitTime: d.exitTime,
            side: d.side,
            outcomeR: d.outcomeR ?? d.net_r,
            returnPct: d.returnPct ?? Number(((d.net_r ?? 0) * 3.0).toFixed(2)),
            exitReason: d.exitReason,
            symbol: toDisplaySymbol(d.symbol),
            rawSymbol: toRawSymbol(d.symbol),
            entry_price: d.entry_price,
            exit_price: d.exit_price,
            probability: d.probability,
          }));

          return NextResponse.json({
            success: true,
            modelId: activeModelId,
            symbol: symbolParam,
            source: targetCollection,
            page: validPage,
            limit,
            totalPages,
            totalHistoricalTrades: total,
            returnedCount: trades.length,
            trades,
          });
        }
      } catch (dbErr) {
        console.warn(`MongoDB query on ${targetCollection} failed, falling back to JSON:`, dbErr);
      }
    }

    // 2. Fallback directly to dedicated JSON file
    const targetPath = path.join(process.cwd(), "src", "data", fallbackFile);
    if (fs.existsSync(targetPath)) {
      const raw = JSON.parse(fs.readFileSync(targetPath, "utf-8"));
      let filtered = raw;

      if (symbolParam && symbolParam !== "ALL") {
        filtered = filtered.filter((t: any) =>
          symbolsMatch(t.symbol, symbolParam) ||
          symbolsMatch(t.rawSymbol || "", symbolParam)
        );
      }

      if (side === "LONG" || side === "SHORT") {
        filtered = filtered.filter((t: any) => t.side === side);
      }
      if (outcome && outcome !== "ALL") {
        filtered = filtered.filter((t: any) => t.exitReason === outcome);
      }

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const validPage = Math.min(page, totalPages);
      const skip = (validPage - 1) * limit;
      const pagedDocs = filtered.slice(skip, skip + limit);

      const trades: HistoricalTrade[] = pagedDocs.map((d: any) => ({
        id: d.id,
        entryTime: d.entryTime,
        exitTime: d.exitTime,
        side: d.side,
        outcomeR: d.outcomeR ?? d.net_r,
        returnPct: d.returnPct ?? Number(((d.net_r ?? 0) * 3.0).toFixed(2)),
        exitReason: d.exitReason,
        symbol: toDisplaySymbol(d.symbol),
        rawSymbol: toRawSymbol(d.symbol),
        entry_price: d.entry_price,
        exit_price: d.exit_price,
        probability: d.probability,
      }));

      return NextResponse.json({
        success: true,
        modelId: activeModelId,
        symbol: symbolParam,
        source: fallbackFile,
        page: validPage,
        limit,
        totalPages,
        totalHistoricalTrades: total,
        returnedCount: trades.length,
        trades,
      });
    }

    return NextResponse.json({
      success: true,
      modelId: activeModelId,
      symbol: symbolParam,
      source: "empty_fallback",
      page: 1,
      limit,
      totalPages: 1,
      totalHistoricalTrades: 0,
      returnedCount: 0,
      trades: [],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
