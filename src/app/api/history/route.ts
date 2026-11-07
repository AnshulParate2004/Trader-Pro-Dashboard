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
    const limit = Math.min(500, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const side = (searchParams.get("side") || searchParams.get("direction") || "ALL").toUpperCase();
    const outcome = (searchParams.get("outcome") || "ALL").toUpperCase();

    // Default to Active Multi-Asset Engine (495 Trades) unless explicitly requesting legacy models
    const isLegacy15M = modelParam && (modelParam.includes("15m") || modelParam.includes("5m") || modelParam.includes("master"));
    const modelId = isLegacy15M ? modelParam : (modelParam || "4h-swing-meta-017");

    // -------------------------------------------------------------------------
    // 1. ACTIVE MULTI-ASSET ENGINE (Default: 495 Trades Across Crypto + Commodities)
    // -------------------------------------------------------------------------
    if (!isLegacy15M) {
      const db = await getDb();
      if (db) {
        try {
          const col = db.collection("historical_trades_multi_asset");
          const query: any = {};
          if (symbolParam && symbolParam !== "ALL") {
            const raw = toRawSymbol(symbolParam);
            const disp = toDisplaySymbol(symbolParam);
            query.symbol = { $in: [symbolParam, raw, disp] };
          }
          if (modelParam === "1h-commodities-rf" && symbolParam === "ALL") {
            query.modelId = "1h-commodities-rf";
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
              modelId,
              symbol: symbolParam,
              source: "mongodb_multi_asset",
              page: validPage,
              limit,
              totalPages,
              totalHistoricalTrades: total,
              returnedCount: trades.length,
              trades,
            });
          }
        } catch (dbErr) {
          console.warn("MongoDB multi-asset historical trades query error, falling back to JSON:", dbErr);
        }
      }

      // Fallback: Read verified_multi_asset_historical_trades.json (495 trades)
      const multiJsonPath = path.join(process.cwd(), "src", "data", "verified_multi_asset_historical_trades.json");
      const fallbackCryptoPath = path.join(process.cwd(), "src", "data", "verified_4h_historical_trades.json");
      const targetPath = fs.existsSync(multiJsonPath) ? multiJsonPath : fallbackCryptoPath;

      if (fs.existsSync(targetPath)) {
        const raw = JSON.parse(fs.readFileSync(targetPath, "utf-8"));
        let filtered = raw;

        if (symbolParam && symbolParam !== "ALL") {
          filtered = filtered.filter((t: any) => 
            symbolsMatch(t.symbol, symbolParam) || 
            symbolsMatch(t.rawSymbol || "", symbolParam)
          );
        }
        if (modelParam === "1h-commodities-rf" && symbolParam === "ALL") {
          filtered = filtered.filter((t: any) => t.modelId === "1h-commodities-rf" || ["GC=F", "SI=F", "CL=F"].includes(t.symbol));
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
          modelId,
          symbol: symbolParam,
          source: targetPath.includes("multi_asset") ? "verified_multi_asset_json" : "verified_4h_json",
          page: validPage,
          limit,
          totalPages,
          totalHistoricalTrades: total,
          returnedCount: trades.length,
          trades,
        });
      }
    }

    // -------------------------------------------------------------------------
    // 2. LEGACY RETIRED MODELS (Optional backward compatibility filter)
    // -------------------------------------------------------------------------
    let queryModelId = "15m-sniper-030";
    if (modelId.includes("5m") || modelId.includes("master")) {
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
          modelId,
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

    // Fallback to legacy filesystem CSV
    const csvSubDir = queryModelId === "master-confluence-multi" ? "multi_model_scalp_5m" : "multi_model_scalp";
    let csvPath = path.join(process.cwd(), "public", "models", csvSubDir, "trades_main.csv");
    if (!fs.existsSync(csvPath)) {
      csvPath = path.join(process.cwd(), "src", "models", csvSubDir, "trades_main.csv");
    }

    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({
        success: true,
        trades: [],
        page: 1,
        limit,
        totalPages: 1,
        totalHistoricalTrades: 0,
      });
    }

    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.trim().split("\n");
    const allFilteredTrades: HistoricalTrade[] = [];

    for (let i = lines.length - 1; i >= 1; i--) {
      const parts = lines[i].split(",");
      if (parts.length >= 7) {
        const sideVal = parseInt(parts[1], 10);
        const rVal = parseFloat(parts[2]);
        const tradeSide = sideVal === 1 ? "LONG" : "SHORT";

        if (side === "LONG" && tradeSide !== "LONG") continue;
        if (side === "SHORT" && tradeSide !== "SHORT") continue;

        let exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "BREAKEVEN_RATCHET" | "TIME_EXPIRY" = "STOP_LOSS";
        if (rVal >= 1.0) exitReason = "TAKE_PROFIT";
        else if (rVal > 0.0) exitReason = "BREAKEVEN_RATCHET";
        else if (rVal <= -0.95) exitReason = "STOP_LOSS";
        else exitReason = "TIME_EXPIRY";

        if (outcome !== "ALL" && exitReason !== outcome) continue;

        allFilteredTrades.push({
          id: `hist-${parts[0]}`,
          entryTime: parts[4].replace("+00:00", " UTC"),
          exitTime: parts[5].replace("+00:00", " UTC"),
          side: tradeSide,
          outcomeR: rVal,
          returnPct: Number((parseFloat(parts[6]) * 100).toFixed(2)),
          exitReason,
        });
      }
    }

    const total = allFilteredTrades.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const validPage = Math.min(page, totalPages);
    const skip = (validPage - 1) * limit;

    return NextResponse.json({
      success: true,
      modelId,
      source: "csv_legacy",
      page: validPage,
      limit,
      totalPages,
      totalHistoricalTrades: total,
      returnedCount: Math.min(limit, allFilteredTrades.length - skip),
      trades: allFilteredTrades.slice(skip, skip + limit),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
