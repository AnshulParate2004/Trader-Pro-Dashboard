import { NextResponse } from "next/server";
import { getPaper1HAMetrics } from "@/lib/paperTrading1HA";

export async function GET() {
  try {
    const data = await getPaper1HAMetrics();
    return NextResponse.json({
      success: true,
      metrics: data.metrics,
      trades: data.trades,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
