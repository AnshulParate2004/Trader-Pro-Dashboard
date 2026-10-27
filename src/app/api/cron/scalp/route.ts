import { NextResponse } from "next/server";
import {
  getEngineConfig,
  updateEngineConfig,
  getTradeLogs,
  executeNewTrade,
  closeTrade,
  computePerformanceMetrics,
} from "@/lib/tradingEngine";
import { getDb } from "@/lib/mongodb";
import { getModelPrediction, Candle } from "@/lib/lgbmEvaluator";
import { fetchAllTimeframes } from "@/lib/binanceData";

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

    const is5MActive = config.activeModelId.includes("5m") || config.activeModelId.includes("master");

    // 1. Fetch live multi-timeframe candles (15m, 1h, 4h, 1d, 1w, and optional 5m)
    const {
      candles15m,
      candles5m,
      candles1h,
      candles4h,
      candles1d,
      candles1w,
    } = await fetchAllTimeframes(is5MActive);

    const now = Date.now();
    const liveCandle15m = candles15m[candles15m.length - 1];
    const currentPrice = liveCandle15m.close;

    // Strictly separate completed CLOSED candles for zero-lookahead ML inference
    const closedCandles15m = candles15m.slice(0, -1);
    const closedCandles5m = candles5m ? candles5m.slice(0, -1) : undefined;
    const closedCandles1h = candles1h.slice(0, -1);
    const closedCandles4h = candles4h.slice(0, -1);
    const closedCandles1d = candles1d.slice(0, -1);
    const closedCandles1w = candles1w.slice(0, -1);

    const latestClosed15m = closedCandles15m[closedCandles15m.length - 1];
    const latestClosed5m = closedCandles5m ? closedCandles5m[closedCandles5m.length - 1] : undefined;

    // Determine execution cadence and countdown based on active model
    const executionCandle = is5MActive && latestClosed5m ? latestClosed5m : latestClosed15m;
    const executionInterval = is5MActive ? "5M" : "15M";
    const liveCandle = is5MActive && candles5m ? candles5m[candles5m.length - 1] : liveCandle15m;
    const barIntervalMs = is5MActive ? 5 * 60 * 1000 : 15 * 60 * 1000;
    const candleClosingInSeconds = Math.max(0, Math.round((liveCandle.openTime + barIntervalMs - now) / 1000));

    // 2. Evaluate Exact Machine Learning Model Prediction strictly on CLOSED candles (Zero Lookahead)
    const prediction = await getModelPrediction(
      config.activeModelId,
      closedCandles15m,
      closedCandles5m,
      closedCandles4h,
      closedCandles1h,
      closedCandles1d,
      closedCandles1w
    );
    const atr = prediction.atr || currentPrice * 0.0055;

    const actionsTaken: string[] = [];

    // 3. Inspect Active Trades & Manage Exits / Breakeven Ratchets / Vertical Time Barrier
    const allTrades = await getTradeLogs(50);
    const activeTrades = allTrades.filter(
      (t) => t.status === "ACTIVE" || t.status === "BE_ACTIVATED"
    );

    for (const trade of activeTrades) {
      // Invariant: Vertical Time Barrier (Horizon Expiry Exit)
      // 15m models: H = 24 bars (6.0 hours)
      // 5m models:  H = 36 bars (3.0 hours)
      const tradeIs5M = (trade.modelId || config.activeModelId).includes("5m") || (trade.modelId || config.activeModelId).includes("master");
      const horizonBars = tradeIs5M ? 36 : 24;
      const tradeBarIntervalMs = tradeIs5M ? 5 * 60 * 1000 : 15 * 60 * 1000;
      const elapsedBars = Math.floor((now - trade.openedAt) / tradeBarIntervalMs);

      if (elapsedBars >= horizonBars) {
        await closeTrade(trade.id, currentPrice, `Vertical Time Barrier Hit (${elapsedBars}/${horizonBars} bars expiry)`);
        actionsTaken.push(`[TIME BARRIER EXIT] ${trade.id} auto-closed at $${currentPrice.toFixed(1)} after ${elapsedBars} bars`);
        continue;
      }

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

    // 4. Strict Single-Position & CANDLE-CLOSE Execution Rule:
    // User Rule: "IT WILL DO TRADE AFTER THE CANDLE CLOSE ONLY ELSE IT WILL NOT DO THE TRADE"
    const remainingActive = allTrades.filter(
      (t) => t.status === "ACTIVE" || t.status === "BE_ACTIVATED"
    ).length;

    if (remainingActive >= 1) {
      actionsTaken.push(`AI Holding 1 Active Position: Capital fully allocated. Awaiting Target TP, Ratchet, or Vertical Time Barrier exit before taking next trade.`);
    } else {
      // Check if a brand-new candle on the active cadence has just closed
      const lastProcessedTime = config.lastProcessedClosedBarTime || 0;
      const isNewClosedCandle = executionCandle.openTime > lastProcessedTime;

      if (!isNewClosedCandle) {
        const minsLeft = Math.floor(candleClosingInSeconds / 60);
        const secsLeft = candleClosingInSeconds % 60;
        actionsTaken.push(`Candle-Close Standby: Current ${executionInterval} candle is forming (closes in ${minsLeft}m ${secsLeft}s). Next trade evaluation strictly on candle close.`);
      } else {
        // A new candle has closed! Evaluate signal on this closed candle:
        if (prediction.signal === "BUY") {
          const newTrade = await executeNewTrade({
            symbol: "BTCUSDT",
            direction: "LONG",
            entryPrice: currentPrice,
            atr,
            triggerReason: `Candle Close Signal [${prediction.modelName}]: Bar ${new Date(executionCandle.openTime).toISOString()} Closed + LightGBM P_Long ${(prediction.pLong * 100).toFixed(1)}% (Conviction ${prediction.confidence}%, HTF Score: ${prediction.htfScore.toFixed(2)})`,
            customFeePercent: config.tradingFeePercent,
            modelId: config.activeModelId,
          });
          await updateEngineConfig({ lastProcessedClosedBarTime: executionCandle.openTime });
          actionsTaken.push(`[AI AUTONOMOUS LONG ON CANDLE CLOSE] ${newTrade.id} opened at $${currentPrice.toFixed(1)} on ₹${newTrade.positionSizeINR.toFixed(2)} capital (${newTrade.modelName})`);
        } else if (prediction.signal === "SELL") {
          const newTrade = await executeNewTrade({
            symbol: "BTCUSDT",
            direction: "SHORT",
            entryPrice: currentPrice,
            atr,
            triggerReason: `Candle Close Signal [${prediction.modelName}]: Bar ${new Date(executionCandle.openTime).toISOString()} Closed + LightGBM P_Short ${(prediction.pShort * 100).toFixed(1)}% (Conviction ${prediction.confidence}%, HTF Score: ${prediction.htfScore.toFixed(2)})`,
            customFeePercent: config.tradingFeePercent,
            modelId: config.activeModelId,
          });
          await updateEngineConfig({ lastProcessedClosedBarTime: executionCandle.openTime });
          actionsTaken.push(`[AI AUTONOMOUS SHORT ON CANDLE CLOSE] ${newTrade.id} opened at $${currentPrice.toFixed(1)} on ₹${newTrade.positionSizeINR.toFixed(2)} capital (${newTrade.modelName})`);
        } else {
          // Closed candle did not have edge; mark bar as processed so we wait for NEXT candle close!
          await updateEngineConfig({ lastProcessedClosedBarTime: executionCandle.openTime });
          actionsTaken.push(`Candle Closed Neutral: Bar ${new Date(executionCandle.openTime).toISOString()} closed without edge (P_L: ${(prediction.pLong * 100).toFixed(1)}%, P_S: ${(prediction.pShort * 100).toFixed(1)}%, HTF: ${prediction.htfScore.toFixed(2)}). Next evaluation strictly on next ${executionInterval} candle close.`);
        }
      }
    }

    const updatedMetrics = await computePerformanceMetrics();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      currentBTCPrice: currentPrice,
      activeModel: config.activeModelId,
      executionInterval,
      predictionSignal: prediction.signal,
      predictionConfidence: prediction.confidence,
      htfScore: prediction.htfScore,
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
