import { NextResponse } from "next/server";
import {
  getTradeLogs,
  executeNewTrade,
  computePerformanceMetrics,
} from "@/lib/tradingEngine";
import { isMongoConfigured } from "@/lib/mongodb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId") || undefined;
    const feeParam = searchParams.get("fee");
    const feeOverride = feeParam ? parseFloat(feeParam) : 0.040;
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? (limitParam === "all" ? 0 : parseInt(limitParam, 10)) : 200;
    const limit = isNaN(parsedLimit) ? 200 : parsedLimit;

    const trades = await getTradeLogs(limit, modelId, feeOverride);
    const metrics = await computePerformanceMetrics(modelId, feeOverride);
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
    const { symbol, direction, entryPrice, atr, triggerReason, customFeePercent, modelId } = body;

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
      modelId,
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
