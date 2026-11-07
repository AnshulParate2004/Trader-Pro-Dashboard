import { NextResponse } from "next/server";
import {
  runPaper1HCommoditiesExecutor,
} from "@/lib/paperExecutor1HCommodities";
import { COMMODITY_SYMBOLS } from "@/lib/commoditiesData";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Enforce CRON_SECRET authorization if configured in environment
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get("secret");

  if (cronSecret) {
    const isBearerAuthorized = authHeader === `Bearer ${cronSecret}`;
    const isQueryAuthorized = querySecret === cronSecret;
    if (!isBearerAuthorized && !isQueryAuthorized) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid or missing CRON_SECRET authorization." },
        { status: 401 }
      );
    }
  }

  try {
    const result = await runPaper1HCommoditiesExecutor();

    return NextResponse.json({
      success: true,
      timestamp: result.timestamp,
      evaluated_symbols: result.evaluated_symbols || Array.from(COMMODITY_SYMBOLS),
      opened_trades: result.opened_trades,
      active_trades: result.active_trades,
      closed_trades: result.closed_trades,
      skipped_symbols: result.skipped_symbols,
      actions: result.actions,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message || "Failed to execute 1H commodities trading loop",
      },
      { status: 500 }
    );
  }
}
