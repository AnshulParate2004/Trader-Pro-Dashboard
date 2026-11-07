import { NextResponse } from "next/server";
import { fetchCommodityKlines, COMMODITY_SYMBOLS } from "@/lib/commoditiesData";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol") || "GC=F";
    const range = searchParams.get("range") || "1mo";

    if (COMMODITY_SYMBOLS.includes(symbol as any)) {
      const candles = await fetchCommodityKlines(symbol, range);
      return NextResponse.json({
        success: true,
        symbol,
        count: candles.length,
        candles,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported commodity symbol: ${symbol}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Commodity market klines API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch commodity klines" },
      { status: 500 }
    );
  }
}
