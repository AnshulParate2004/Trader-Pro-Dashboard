import { NextResponse } from "next/server";
import {
  getEngineConfig,
  getTradeLogs,
  executeNewTrade,
  closeTrade,
  computePerformanceMetrics,
} from "@/lib/tradingEngine";
import { getDb, isMongoConfigured } from "@/lib/mongodb";
import { getModelPrediction, Candle } from "@/lib/lgbmEvaluator";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const config = await getEngineConfig();
    if (!config.autoTradingEnabled) {
      return NextResponse.json({
        success: true,
        message: "Automated AI Scalp Engine is currently PAUSED in configuration.",
        actions: [],
      });
    }

    // 1. Fetch live 15m candle data from Binance for BTCUSDT
    const binanceRes = await fetch(
      "https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=15m&limit=100",
      { cache: "no-store" }
    );
    if (!binanceRes.ok) {
      throw new Error(`Binance API error: ${binanceRes.statusText}`);
    }
    const rawKlines = await binanceRes.json();
    if (!Array.isArray(rawKlines) || rawKlines.length < 30) {
      throw new Error("Insufficient kline bars returned from Binance");
    }

    const candles: Candle[] = rawKlines.map((d: any) => ({
      openTime: Number(d[0]),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
      takerBuyBase: parseFloat(d[9] || "0"),
    }));

    const lastCandle = candles[candles.length - 1];
    const currentPrice = lastCandle.close;

    // Optional 5m & 4h candles for multi-timeframe confluence models
    let candles5m: Candle[] | undefined;
    let candles4h: Candle[] | undefined;

    if (config.activeModelId.includes("5m") || config.activeModelId.includes("master")) {
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
          }));
        }
      } catch (e) {
        console.warn("Could not fetch 5m candles:", e);
      }
    }

    if (config.activeModelId.includes("master") || config.activeModelId.includes("4h")) {
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
      } catch (e) {
        console.warn("Could not fetch 4h candles:", e);
      }
    }

    // 2. Evaluate Exact Machine Learning Model Prediction (from 01, 06, 07 notebooks)
    const prediction = await getModelPrediction(config.activeModelId, candles, candles5m, candles4h);
    const atr = prediction.atr || currentPrice * 0.0055;

    const actionsTaken: string[] = [];

    // 3. Inspect Active Trades & Manage Exits / Breakeven Ratchets
    const allTrades = await getTradeLogs(50);
    const activeTrades = allTrades.filter(
      (t) => t.status === "ACTIVE" || t.status === "BE_ACTIVATED"
    );

    for (const trade of activeTrades) {
      if (trade.direction === "LONG") {
        // Stop Loss Check
        if (currentPrice <= trade.stopLoss) {
          await closeTrade(trade.id, currentPrice, "Stop Loss Hit (-1.0R)");
          actionsTaken.push(`[LONG CLOSED] ${trade.id} hit Stop Loss at $${currentPrice.toFixed(1)}`);
          continue;
        }
        // Take Profit Check (+1.0R)
        if (currentPrice >= trade.takeProfit1) {
          await closeTrade(trade.id, currentPrice, "Take Profit 1 Hit (+1.00R)");
          actionsTaken.push(`[LONG CLOSED] ${trade.id} hit Target TP (+1.0R) at $${currentPrice.toFixed(1)}`);
          continue;
        }
        // Breakeven Ratchet Check (+0.30R or +0.35R)
        if (config.ratchetEnabled && !trade.breakevenActivated && currentPrice >= trade.breakevenTrigger) {
          trade.breakevenActivated = true;
          trade.stopLoss = trade.breakevenLocked; // Move SL to lock in profit covering round-trip exchange fees
          trade.status = "BE_ACTIVATED";
          const db = await getDb();
          if (db) {
            await db.collection("trade_logs").updateOne(
              { id: trade.id },
              { $set: { breakevenActivated: true, stopLoss: trade.stopLoss, status: "BE_ACTIVATED" } }
            );
          }
          actionsTaken.push(`[LONG RATCHET] ${trade.id} moved SL to Breakeven (+0.05R fee shield) at $${currentPrice.toFixed(1)}`);
        }
      } else if (trade.direction === "SHORT") {
        // Stop Loss Check
        if (currentPrice >= trade.stopLoss) {
          await closeTrade(trade.id, currentPrice, "Stop Loss Hit (-1.0R)");
          actionsTaken.push(`[SHORT CLOSED] ${trade.id} hit Stop Loss at $${currentPrice.toFixed(1)}`);
          continue;
        }
        // Take Profit Check (+1.0R)
        if (currentPrice <= trade.takeProfit1) {
          await closeTrade(trade.id, currentPrice, "Take Profit 1 Hit (+1.00R)");
          actionsTaken.push(`[SHORT CLOSED] ${trade.id} hit Target TP (+1.0R) at $${currentPrice.toFixed(1)}`);
          continue;
        }
        // Breakeven Ratchet Check (+0.30R or +0.35R)
        if (config.ratchetEnabled && !trade.breakevenActivated && currentPrice <= trade.breakevenTrigger) {
          trade.breakevenActivated = true;
          trade.stopLoss = trade.breakevenLocked;
          trade.status = "BE_ACTIVATED";
          const db = await getDb();
          if (db) {
            await db.collection("trade_logs").updateOne(
              { id: trade.id },
              { $set: { breakevenActivated: true, stopLoss: trade.stopLoss, status: "BE_ACTIVATED" } }
            );
          }
          actionsTaken.push(`[SHORT RATCHET] ${trade.id} moved SL to Breakeven (+0.05R fee shield) at $${currentPrice.toFixed(1)}`);
        }
      }
    }

    // 4. Check If Autonomous AI Trade Should Be Executed (strictly on Model Signal)
    const remainingActive = allTrades.filter(
      (t) => t.status === "ACTIVE" || t.status === "BE_ACTIVATED"
    ).length;

    if (remainingActive < config.maxConcurrentTrades) {
      if (prediction.signal === "BUY") {
        const newTrade = await executeNewTrade({
          symbol: "BTCUSDT",
          direction: "LONG",
          entryPrice: currentPrice,
          atr,
          triggerReason: `AI Model Instinct [${prediction.modelName}]: Donchian Breakout + LightGBM P_Long ${(prediction.pLong * 100).toFixed(1)}% (Conviction ${prediction.confidence}%)`,
          customFeePercent: config.tradingFeePercent,
          modelId: config.activeModelId,
        });
        actionsTaken.push(`[AI AUTONOMOUS LONG EXECUTED] ${newTrade.id} opened at $${currentPrice.toFixed(1)} on ₹${newTrade.positionSizeINR.toFixed(2)} capital (${newTrade.modelName})`);
      } else if (prediction.signal === "SELL") {
        const newTrade = await executeNewTrade({
          symbol: "BTCUSDT",
          direction: "SHORT",
          entryPrice: currentPrice,
          atr,
          triggerReason: `AI Model Instinct [${prediction.modelName}]: Donchian Breakdown + LightGBM P_Short ${(prediction.pShort * 100).toFixed(1)}% (Conviction ${prediction.confidence}%)`,
          customFeePercent: config.tradingFeePercent,
          modelId: config.activeModelId,
        });
        actionsTaken.push(`[AI AUTONOMOUS SHORT EXECUTED] ${newTrade.id} opened at $${currentPrice.toFixed(1)} on ₹${newTrade.positionSizeINR.toFixed(2)} capital (${newTrade.modelName})`);
      } else {
        actionsTaken.push(`AI Standby: Waiting for Model Signal (P_Long: ${(prediction.pLong * 100).toFixed(1)}%, P_Short: ${(prediction.pShort * 100).toFixed(1)}%, Donchian: ${prediction.donchianBreakout})`);
      }
    }

    const updatedMetrics = await computePerformanceMetrics();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      currentBTCPrice: currentPrice,
      activeModel: config.activeModelId,
      predictionSignal: prediction.signal,
      predictionConfidence: prediction.confidence,
      activeTradesCount: remainingActive,
      actionsTaken,
      metrics: updatedMetrics,
    });
  } catch (error: any) {
    console.error("Cron Scalp execution error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
