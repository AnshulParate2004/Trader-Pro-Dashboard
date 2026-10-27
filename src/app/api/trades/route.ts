import { NextResponse } from "next/server";
import {
  getTradeLogs,
  executeNewTrade,
  computePerformanceMetrics,
} from "@/lib/tradingEngine";
import { isMongoConfigured } from "@/lib/mongodb";

export async function GET() {
  try {
    const trades = await getTradeLogs(50);
    const metrics = await computePerformanceMetrics();
    const mongoStatus = isMongoConfigured();

    return NextResponse.json({
      success: true,
      mongoConfigured: mongoStatus,
      metrics,
      trades,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { symbol, direction, entryPrice, atr, triggerReason, customFeePercent } = body;

    if (!symbol || !direction || !entryPrice) {
      return NextResponse.json(
        { success: false, error: "Missing required trade execution parameters" },
        { status: 400 }
      );
    }

    const trade = await executeNewTrade({
      symbol,
      direction,
      entryPrice: Number(entryPrice),
      atr: Number(atr || entryPrice * 0.005),
      triggerReason: triggerReason || "AI Quantitative Sniper Trigger",
      customFeePercent: customFeePercent ? Number(customFeePercent) : undefined,
    });

    return NextResponse.json({
      success: true,
      trade,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
