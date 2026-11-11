import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { DEFAULT_EQUITY_FEE_CONFIG } from "@/lib/equityFeeModel";
import { BOOK_CONFIGS } from "@/lib/engineTypes";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const strategy = searchParams.get("strategy") || "all";

    let trades: any[] = [];
    let mongoConfigured = false;

    try {
      const db = await getDb();
      if (db) {
        mongoConfigured = true;
        const col = db.collection("paper_trades_us_equities");
        const query: any = { book: "us_equities" };
        if (strategy !== "all") {
          query.strategy = strategy;
        }
        trades = await col.find(query).sort({ entry_time: -1 }).limit(limit).toArray();
      }
    } catch (err) {
      console.warn("MongoDB fetch error for US Equities, using fallback file:", err);
    }

    if (!trades || trades.length === 0) {
      const fallbackPath = path.join(process.cwd(), "src", "data", "paper_trades_us_equities.json");
      if (fs.existsSync(fallbackPath)) {
        trades = JSON.parse(fs.readFileSync(fallbackPath, "utf-8"));
      }
    }

    // Portfolio metrics calculation (USD base)
    const startingCapitalUSD = BOOK_CONFIGS.us_equities.startingCapital;
    const closedTrades = trades.filter((t: any) => t.status === "CLOSED");
    const netPnLUSD = closedTrades.reduce((acc: number, t: any) => acc + (t.net_pnl_usd || 0), 0);
    const winTrades = closedTrades.filter((t: any) => (t.net_pnl_usd || 0) > 0);
    const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : null;

    return NextResponse.json({
      success: true,
      book: "us_equities",
      bookConfig: BOOK_CONFIGS.us_equities,
      feeConfig: DEFAULT_EQUITY_FEE_CONFIG,
      taxStatus: "UNCONFIRMED_DEFAULT_OFF",
      taxNotice: "TCS under LRS and Foreign Capital Gains taxes are displayed as sensitivity metrics marked UNCONFIRMED until verified with a Chartered Accountant (CA).",
      metrics: {
        startingCapitalUSD,
        currentEquityUSD: startingCapitalUSD + netPnLUSD,
        netPnLUSD: Number(netPnLUSD.toFixed(2)),
        totalTrades: trades.length,
        closedTrades: closedTrades.length,
        winRatePct: winRate !== null ? Number(winRate.toFixed(2)) : null,
      },
      trades,
      mongoConfigured,
    });
  } catch (err: any) {
    console.error("US Equities trades API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch US Equities trades" },
      { status: 500 }
    );
  }
}
