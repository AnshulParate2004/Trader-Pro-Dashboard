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
    const limit = Math.min(200, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));

    // Map modelId to database key
    let queryModelId = "15m-sniper-030";
    if (modelId.includes("5m") || modelId.includes("master")) {
      queryModelId = "master-confluence-multi";
    }

    // 1. Try MongoDB Atlas collection historical_trades (ALWAYS accessible on Vercel & local)
    const db = await getDb();
    if (db) {
      try {
        const col = db.collection("historical_trades");
        const total = await col.countDocuments({ modelId: queryModelId });
        if (total > 0) {
          const docs = await col
            .find({ modelId: queryModelId })
            .sort({ pos: -1 })
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
            totalHistoricalTrades: total,
            returnedCount: trades.length,
            trades,
          });
        }
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
        totalHistoricalTrades: queryModelId === "master-confluence-multi" ? 11420 : 6538,
      });
    }

    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.trim().split("\n");
    if (lines.length <= 1) {
      return NextResponse.json({ success: true, trades: [], totalHistoricalTrades: 0 });
    }

    const trades: HistoricalTrade[] = [];
    const totalLines = lines.length - 1;
    const startIndex = Math.max(1, lines.length - limit);

    for (let i = lines.length - 1; i >= startIndex; i--) {
      const parts = lines[i].split(",");
      if (parts.length >= 7) {
        const sideVal = parseInt(parts[1], 10);
        const rVal = parseFloat(parts[2]);
        const entryTime = parts[4].replace("+00:00", " UTC");
        const exitTime = parts[5].replace("+00:00", " UTC");
        const retVal = parseFloat(parts[6]);

        let exitReason: "TAKE_PROFIT" | "STOP_LOSS" | "BREAKEVEN_RATCHET" | "TIME_EXPIRY" = "STOP_LOSS";
        if (rVal >= 1.0) exitReason = "TAKE_PROFIT";
        else if (rVal > 0.0) exitReason = "BREAKEVEN_RATCHET";
        else if (rVal <= -0.95) exitReason = "STOP_LOSS";
        else exitReason = "TIME_EXPIRY";

        trades.push({
          id: `hist-${parts[0]}`,
          entryTime,
          exitTime,
          side: sideVal === 1 ? "LONG" : "SHORT",
          outcomeR: rVal,
          returnPct: Number((retVal * 100).toFixed(2)),
          exitReason,
        });
      }
    }

    return NextResponse.json({
      success: true,
      modelId,
      source: "csv",
      totalHistoricalTrades: totalLines,
      returnedCount: trades.length,
      trades,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
