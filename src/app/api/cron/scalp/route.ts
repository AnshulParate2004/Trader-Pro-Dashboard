import { NextResponse } from "next/server";
import {
  getEngineConfig,
  getTradeLogs,
  executeNewTrade,
  closeTrade,
  computePerformanceMetrics,
} from "@/lib/tradingEngine";
import { getDb, isMongoConfigured } from "@/lib/mongodb";

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

    const candles = rawKlines.map((d: any) => ({
      openTime: Number(d[0]),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));

    const lastCandle = candles[candles.length - 1];
    const currentPrice = lastCandle.close;

    // Calculate ATR (14)
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const h = candles[i].high;
      const l = candles[i].low;
      const prevC = candles[i - 1].close;
      trs.push(Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC)));
    }
    const recentTRs = trs.slice(-14);
    const atr = recentTRs.reduce((a, b) => a + b, 0) / recentTRs.length || currentPrice * 0.005;

    // Calculate Dynamic 50-bar Swing Pivots
    const lookback = candles.slice(-50);
    const pivotHigh = Math.max(...lookback.map((c: any) => c.high));
    const pivotLow = Math.min(...lookback.map((c: any) => c.low));

    // EMA 20 & EMA 50
    const closes = candles.map((c: any) => c.close);
    const calcEMA = (period: number) => {
      const k = 2 / (period + 1);
      let ema = closes[0];
      for (let i = 1; i < closes.length; i++) {
        ema = closes[i] * k + ema * (1 - k);
      }
      return ema;
    };
    const ema20 = calcEMA(20);
    const ema50 = calcEMA(50);
    const emaSpread = (ema20 - ema50) / ema50;

    const actionsTaken: string[] = [];

    // 2. Inspect Active Trades & Manage Exits / Breakeven Ratchets
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
        // Take Profit 2 Check (+1.5R)
        if (currentPrice >= trade.takeProfit2) {
          await closeTrade(trade.id, currentPrice, "Take Profit 2 Hit (+1.50R)");
          actionsTaken.push(`[LONG CLOSED] ${trade.id} hit Target TP2 (+1.5R) at $${currentPrice.toFixed(1)}`);
          continue;
        }
        // Take Profit 1 Check (+1.0R)
        if (currentPrice >= trade.takeProfit1 && !trade.breakevenActivated) {
          await closeTrade(trade.id, currentPrice, "Take Profit 1 Hit (+1.00R)");
          actionsTaken.push(`[LONG CLOSED] ${trade.id} hit TP1 (+1.0R) at $${currentPrice.toFixed(1)}`);
          continue;
        }
        // Breakeven Ratchet Check (+0.30R)
        if (config.ratchetEnabled && !trade.breakevenActivated && currentPrice >= trade.breakevenTrigger) {
          trade.breakevenActivated = true;
          trade.stopLoss = trade.breakevenLocked; // Move SL to lock in profit covering fees
          trade.status = "BE_ACTIVATED";
          const db = await getDb();
          if (db) {
            await db.collection("trade_logs").updateOne(
              { id: trade.id },
              { $set: { breakevenActivated: true, stopLoss: trade.stopLoss, status: "BE_ACTIVATED" } }
            );
          }
          actionsTaken.push(`[LONG RATCHET] ${trade.id} moved SL to Breakeven (+0.05R lock)`);
        }
      } else if (trade.direction === "SHORT") {
        // Stop Loss Check
        if (currentPrice >= trade.stopLoss) {
          await closeTrade(trade.id, currentPrice, "Stop Loss Hit (-1.0R)");
          actionsTaken.push(`[SHORT CLOSED] ${trade.id} hit Stop Loss at $${currentPrice.toFixed(1)}`);
          continue;
        }
        // Take Profit 2 Check (+1.5R)
        if (currentPrice <= trade.takeProfit2) {
          await closeTrade(trade.id, currentPrice, "Take Profit 2 Hit (+1.50R)");
          actionsTaken.push(`[SHORT CLOSED] ${trade.id} hit Target TP2 (+1.5R) at $${currentPrice.toFixed(1)}`);
          continue;
        }
        // Take Profit 1 Check (+1.0R)
        if (currentPrice <= trade.takeProfit1 && !trade.breakevenActivated) {
          await closeTrade(trade.id, currentPrice, "Take Profit 1 Hit (+1.00R)");
          actionsTaken.push(`[SHORT CLOSED] ${trade.id} hit TP1 (+1.0R) at $${currentPrice.toFixed(1)}`);
          continue;
        }
        // Breakeven Ratchet Check (+0.30R)
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
          actionsTaken.push(`[SHORT RATCHET] ${trade.id} moved SL to Breakeven (+0.05R lock)`);
        }
      }
    }

    // 3. Check If New Scalp Order Should Be Placed
    const remainingActive = allTrades.filter(
      (t) => t.status === "ACTIVE" || t.status === "BE_ACTIVATED"
    ).length;

    if (remainingActive < config.maxConcurrentTrades) {
      const distToSupportATR = Math.abs(currentPrice - pivotLow) / atr;
      const distToResistanceATR = Math.abs(pivotHigh - currentPrice) / atr;

      // Bullish Confluence Setup: Bounce off Dynamic Support or Strong Upward Momentum
      if (distToSupportATR <= 1.2 && emaSpread > 0.0003) {
        const newTrade = await executeNewTrade({
          symbol: "BTCUSDT",
          direction: "LONG",
          entryPrice: currentPrice,
          atr,
          triggerReason: `Autonomous Cloud Scalp: Dynamic Support Rebound ($${pivotLow.toFixed(1)}) + Bullish EMA Momentum`,
          customFeePercent: config.tradingFeePercent,
          modelId: config.activeModelId,
        });
        actionsTaken.push(`[NEW LONG EXECUTED] ${newTrade.id} entered at $${currentPrice.toFixed(1)} on ₹1,000 capital (${newTrade.modelName || "AI Model"})`);
      }
      // Bearish Confluence Setup: Rejection at Dynamic Resistance or Strong Downward Momentum
      else if (distToResistanceATR <= 1.2 && emaSpread < -0.0003) {
        const newTrade = await executeNewTrade({
          symbol: "BTCUSDT",
          direction: "SHORT",
          entryPrice: currentPrice,
          atr,
          triggerReason: `Autonomous Cloud Scalp: Dynamic Resistance Rejection ($${pivotHigh.toFixed(1)}) + Bearish EMA Momentum`,
          customFeePercent: config.tradingFeePercent,
          modelId: config.activeModelId,
        });
        actionsTaken.push(`[NEW SHORT EXECUTED] ${newTrade.id} entered at $${currentPrice.toFixed(1)} on ₹1,000 capital (${newTrade.modelName || "AI Model"})`);
      }
    }

    const updatedMetrics = await computePerformanceMetrics();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      currentBTCPrice: currentPrice,
      mongoConfigured: isMongoConfigured(),
      activeTradesCount: remainingActive,
      actionsTaken: actionsTaken.length > 0 ? actionsTaken : ["Monitoring live ticks - No trigger threshold crossed"],
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
