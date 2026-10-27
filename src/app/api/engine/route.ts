import { NextResponse } from "next/server";
import {
  getEngineConfig,
  updateEngineConfig,
  computePerformanceMetrics,
} from "@/lib/tradingEngine";
import { isMongoConfigured } from "@/lib/mongodb";

export async function GET() {
  try {
    const config = await getEngineConfig();
    const metrics = await computePerformanceMetrics();
    const mongoStatus = isMongoConfigured();

    return NextResponse.json({
      success: true,
      mongoConfigured: mongoStatus,
      config,
      metrics,
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
    const { autoTradingEnabled, tradingFeePercent, riskPerTradePercent, accountBalanceUSD, ratchetEnabled } = body;

    const updates: any = {};
    if (typeof autoTradingEnabled === "boolean") updates.autoTradingEnabled = autoTradingEnabled;
    if (typeof tradingFeePercent === "number") updates.tradingFeePercent = tradingFeePercent;
    if (typeof riskPerTradePercent === "number") updates.riskPerTradePercent = riskPerTradePercent;
    if (typeof accountBalanceUSD === "number") updates.accountBalanceUSD = accountBalanceUSD;
    if (typeof ratchetEnabled === "boolean") updates.ratchetEnabled = ratchetEnabled;

    const updatedConfig = await updateEngineConfig(updates);

    return NextResponse.json({
      success: true,
      config: updatedConfig,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
