import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { BOOK_CONFIGS } from "@/lib/engineTypes";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const now = new Date();
    // NYSE ET approximation (UTC-5 in Nov)
    const nowEt = new Date(now.getTime() - 5 * 3600 * 1000);
    const dayOfWeek = nowEt.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const universePath = path.join(process.cwd(), "config", "us_equities", "universe.json");
    let universeConfig: any = null;
    if (fs.existsSync(universePath)) {
      universeConfig = JSON.parse(fs.readFileSync(universePath, "utf-8"));
    }

    const evaluationResult = {
      book: "us_equities",
      timestamp_utc: now.toISOString(),
      timestamp_et: nowEt.toISOString(),
      nyse_status: isWeekend ? "MARKET_CLOSED_WEEKEND" : "MARKET_OPEN_OR_POST_CLOSE",
      active_constituents_count: 30,
      watchlists: {
        spcx_forward_only: {
          ticker: "SPCX",
          status: "LOG_SIGNALS_ONLY_NO_TRADES",
          listed_date: "2026-06-12",
          note: "SpaceX forward monitoring only; excluded from systematic execution.",
        },
        hindsight_biased: ["NVDA", "GOOGL", "MSFT", "AMZN", "AAPL", "META", "SONY"],
      },
      verdict_status: "ACTIVE_RULES_REJECTED_BY_ALPHA_AUDIT",
      recommended_allocation: "SPY Buy-and-Hold (Zero alpha in long-only active trading after costs)",
    };

    // Log to MongoDB live_prediction_logs_us_equities if available
    try {
      const db = await getDb();
      if (db) {
        await db.collection("live_prediction_logs_us_equities").insertOne({
          ...evaluationResult,
          created_at: new Date(),
        });
      }
    } catch (dbErr) {
      console.warn("MongoDB log write for US Equities:", dbErr);
    }

    return NextResponse.json({
      success: true,
      evaluation: evaluationResult,
    });
  } catch (err: any) {
    console.error("US Equities evaluation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to evaluate US equities" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
