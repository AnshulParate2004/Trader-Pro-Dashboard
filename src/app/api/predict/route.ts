import { NextResponse } from "next/server";
import { getEngineConfig, TOP_MODELS } from "@/lib/tradingEngine";
import { getModelPrediction } from "@/lib/lgbmEvaluator";
import { fetchAllTimeframes } from "@/lib/binanceData";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const config = await getEngineConfig();
    const modelId = searchParams.get("modelId") || config.activeModelId || "15m-sniper-030";

    const is5MModel = modelId.includes("5m") || modelId.includes("master");

    // Fetch multi-timeframe candle data
    const {
      candles15m,
      candles5m,
      candles1h,
      candles4h,
      candles1d,
      candles1w,
    } = await fetchAllTimeframes(is5MModel);

    // Strictly evaluate on COMPLETED CLOSED candles to prevent real-time repainting / UI flicker
    const closedCandles15m = candles15m.slice(0, -1);
    const closedCandles5m = candles5m ? candles5m.slice(0, -1) : undefined;
    const closedCandles1h = candles1h.slice(0, -1);
    const closedCandles4h = candles4h.slice(0, -1);
    const closedCandles1d = candles1d.slice(0, -1);
    const closedCandles1w = candles1w.slice(0, -1);

    const prediction = await getModelPrediction(
      modelId,
      closedCandles15m,
      closedCandles5m,
      closedCandles4h,
      closedCandles1h,
      closedCandles1d,
      closedCandles1w
    );
    const selectedModel = TOP_MODELS.find((m) => m.id === modelId) || TOP_MODELS[0];

    return NextResponse.json({
      success: true,
      model: selectedModel,
      availableModels: TOP_MODELS,
      prediction,
    });
  } catch (error: any) {
    console.error("Prediction API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
