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
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId") || "15m-sniper-030";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(500, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const side = (searchParams.get("side") || searchParams.get("direction") || "ALL").toUpperCase();
    const outcome = (searchParams.get("outcome") || "ALL").toUpperCase();

    // Map modelId to database key
    let queryModelId = "15m-sniper-030";
    if (modelId.includes("5m") || modelId.includes("master")) {
      queryModelId = "master-confluence-multi";
    }

    // 1. Try MongoDB Atlas collection historical_trades (FAST & PERSISTENT)
    const db = await getDb();
    if (db) {
      try {
        const col = db.collection("historical_trades");
        const query: any = { modelId: queryModelId };

        if (side === "LONG" || side === "SHORT") {
          query.side = side;
        }

        if (outcome && outcome !== "ALL") {
          query.exitReason = outcome;
        }

        const total = await col.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const validPage = Math.min(page, totalPages);
        const skip = (validPage - 1) * limit;

        const docs = await col
          .find(query)
          .sort({ pos: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

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
          source: "mongodb",
          page: validPage,
          limit,
          totalPages,
          totalHistoricalTrades: total,
          returnedCount: trades.length,
          trades,
        });
      } catch (dbErr) {
        console.warn("MongoDB historical trades query error:", dbErr);
      }
    }

    // 2. Fallback to filesystem CSV (check public/models then src/models)
    let csvSubDir = queryModelId === "master-confluence-multi" ? "multi_model_scalp_5m" : "multi_model_scalp";
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
        totalHistoricalTrades: queryModelId === "master-confluence-multi" ? 11420 : 6538,
      });
    }

    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.trim().split("\n");
    if (lines.length <= 1) {
      return NextResponse.json({
        success: true,
        trades: [],
        page: 1,
        limit,
        totalPages: 1,
        totalHistoricalTrades: 0,
      });
    }

    // Header: pos,side,R,exit_bar,entry_time,exit_time,ret
    const allFilteredTrades: HistoricalTrade[] = [];

    // Parse from bottom to top (most recent trades first)
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

        const entryTime = parts[4].replace("+00:00", " UTC");
        const exitTime = parts[5].replace("+00:00", " UTC");
        const retVal = parseFloat(parts[6]);

        allFilteredTrades.push({
          id: `hist-${parts[0]}`,
          entryTime,
          exitTime,
          side: tradeSide,
          outcomeR: rVal,
          returnPct: Number((retVal * 100).toFixed(2)),
          exitReason,
        });
      }
    }

    const total = allFilteredTrades.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const validPage = Math.min(page, totalPages);
    const skip = (validPage - 1) * limit;
    const pagedTrades = allFilteredTrades.slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      modelId,
      source: "csv",
      page: validPage,
      limit,
      totalPages,
      totalHistoricalTrades: total,
      returnedCount: pagedTrades.length,
      trades: pagedTrades,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
