import { NextResponse } from "next/server";
import { getEngineConfig, TOP_MODELS } from "@/lib/tradingEngine";
import { getModelPrediction, Candle } from "@/lib/lgbmEvaluator";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const config = await getEngineConfig();
    const modelId = searchParams.get("modelId") || config.activeModelId || "15m-sniper-030";

    // Fetch Binance 15m klines
    const res15m = await fetch(
      "https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=15m&limit=100",
      { cache: "no-store" }
    );
    if (!res15m.ok) {
      throw new Error(`Binance 15m fetch error: ${res15m.statusText}`);
    }
    const raw15m = await res15m.json();
    const candles15m: Candle[] = raw15m.map((d: any) => ({
      openTime: Number(d[0]),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
      takerBuyBase: parseFloat(d[9] || "0"),
    }));

    // Optional 5m klines for confluence models
    let candles5m: Candle[] | undefined;
    if (modelId.includes("5m") || modelId.includes("master")) {
      try {
        const res5m = await fetch(
          "https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=5m&limit=50",
          { cache: "no-store" }
        );
        if (res5m.ok) {
          const raw5m = await res5m.json();
          candles5m = raw5m.map((d: any) => ({
            openTime: Number(d[0]),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
            takerBuyBase: parseFloat(d[9] || "0"),
          }));
        }
      } catch (err) {
        console.warn("Could not fetch 5m candles:", err);
      }
    }

    // Optional 4h klines for master macro gate
    let candles4h: Candle[] | undefined;
    if (modelId.includes("master") || modelId.includes("4h")) {
      try {
        const res4h = await fetch(
          "https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=4h&limit=50",
          { cache: "no-store" }
        );
        if (res4h.ok) {
          const raw4h = await res4h.json();
          candles4h = raw4h.map((d: any) => ({
            openTime: Number(d[0]),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
          }));
        }
      } catch (err) {
        console.warn("Could not fetch 4h candles:", err);
      }
    }

    const prediction = await getModelPrediction(modelId, candles15m, candles5m, candles4h);
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
