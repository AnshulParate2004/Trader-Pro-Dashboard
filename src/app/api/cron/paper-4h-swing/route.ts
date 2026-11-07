import { NextResponse } from "next/server";
import { runPaper4HSwingExecutor, SWING_ASSETS } from "@/lib/paperExecutor4HSwing";
import { fetchBinanceKlines } from "@/lib/binanceData";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Verify Bearer authorization token if CRON_SECRET is configured
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // If not matching CRON_SECRET, reject request
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid or missing CRON_SECRET bearer token." },
      { status: 401 }
    );
  }

  // Fetch live prices for universe symbols
  const livePriceMap: Record<string, number> = {};
  for (const sym of SWING_ASSETS) {
    try {
      const candles = await fetchBinanceKlines("1m", 1, 5000, sym);
      const last = candles && candles.length > 0 ? candles[candles.length - 1] : undefined;
      if (last && typeof last.close === "number" && !isNaN(last.close) && last.close > 0) {
        livePriceMap[sym] = last.close;
      }
    } catch {
      // If live price fetch fails, executor will fallback to latest closed candle price
    }
  }

  try {
    const result = await runPaper4HSwingExecutor({
      livePriceMap,
    });

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
        error: error.message || "Failed to execute 4H swing trading loop",
      },
      { status: 500 }
    );
  }
}
