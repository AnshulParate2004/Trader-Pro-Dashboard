import { NextResponse } from "next/server";
import { runPaper1HCostExecutor } from "@/lib/paperExecutor1HCost";
import { fetchBinanceKlines } from "@/lib/binanceData";

export const dynamic = "force-dynamic";

export async function GET() {
  let livePrice: number | undefined;
  try {
    const candles = await fetchBinanceKlines("1m", 1);
    const last = candles && candles.length > 0 ? candles[candles.length - 1] : undefined;
    if (last && typeof last.close === "number" && !isNaN(last.close) && last.close > 0) {
      livePrice = last.close;
    }
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      status: "NO_LIVE_PRICE",
      error: `Live price fetch failed: ${err.message}`,
      actions: ["[COST-1H BTC] NO_LIVE_PRICE: Binance live price fetch failed; entering no trades"],
    });
  }

  if (livePrice === undefined) {
    return NextResponse.json({
      success: false,
      status: "NO_LIVE_PRICE",
      error: "Binance live price unavailable or empty",
      actions: ["[COST-1H BTC] NO_LIVE_PRICE: Binance live price fetch failed; entering no trades"],
    });
  }

  try {
    const result = await runPaper1HCostExecutor({ livePrice });
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}


