import { NextResponse } from "next/server";
import { runPaper4HFixedExecutor, FIXED_4H_ASSETS } from "@/lib/paperExecutor4HFixed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // 1. Verify Bearer authorization token if CRON_SECRET is configured
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid or missing CRON_SECRET bearer token." },
      { status: 401 }
    );
  }

  try {
    const result = await runPaper4HFixedExecutor();

    return NextResponse.json({
      success: true,
      timestamp: result.timestamp,
      evaluated_symbols: result.evaluated_symbols,
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
        error: error.message || "Failed to execute 4H fixed-rule trading loop",
      },
      { status: 500 }
    );
  }
}
