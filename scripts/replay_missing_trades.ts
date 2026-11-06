import fs from "fs";
import path from "path";
import { Candle, getModelPrediction } from "../src/lib/lgbmEvaluator";

interface SimulationTrade {
  id: string;
  direction: "LONG" | "SHORT";
  openedAt: number;
  openDate: string;
  entryPrice: number;
  closedAt: number;
  closeDate: string;
  exitPrice: number;
  exitReason: string;
  barsHeld: number;
  grossPnLPct: number;
  netPnLPct: number;
  netPnLINR: number;
}

// Cost Constants: Taker 0.04% + 18% GST (0.0472%) + 0.01% slip = 0.0572% per side -> 0.1144% round-trip
const ROUND_TRIP_FEE_PCT = 0.001144;
const CAPITAL_INR = 1000.0;
const RISK_PER_TRADE_PCT = 0.01; // 1% = ₹10

async function fetchBinanceHistorical(interval: string, startTimeMs: number, endTimeMs: number): Promise<Candle[]> {
  const allCandles: Candle[] = [];
  let currentStart = startTimeMs;
  
  while (currentStart < endTimeMs) {
    const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&startTime=${currentStart}&limit=1000`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance API error: ${res.statusText}`);
    const data: any[] = await res.json();
    if (!data || data.length === 0) break;
    
    for (const d of data) {
      const c: Candle = {
        openTime: Number(d[0]),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
        closeTime: Number(d[6]),
        takerBuyBase: parseFloat(d[9] || "0"),
      };
      if (c.openTime < endTimeMs) {
        allCandles.push(c);
      }
    }
    
    const lastBarTime = Number(data[data.length - 1][0]);
    if (lastBarTime <= currentStart) break;
    currentStart = lastBarTime + 1;
    if (data.length < 1000) break;
  }
  
  return allCandles;
}

async function runReplay() {
  console.log("================================================================================");
  console.log("REPLAYING MISSED 15M BTC CANDLES (OCT 31 TO PRESENT)");
  console.log("================================================================================");

  // We need enough historical lookback for HTF and 15M features (need ~100 bars prior to Oct 31)
  const lookbackStartMs = new Date("2026-10-25T00:00:00Z").getTime();
  const replayStartMs = new Date("2026-10-31T18:00:00Z").getTime();
  const nowMs = Date.now();

  console.log(`Fetching 15m candles from ${new Date(lookbackStartMs).toISOString()} to ${new Date(nowMs).toISOString()}...`);
  const candles15m = await fetchBinanceHistorical("15m", lookbackStartMs, nowMs);
  const candles1h = await fetchBinanceHistorical("1h", lookbackStartMs - 86400000 * 10, nowMs);
  const candles4h = await fetchBinanceHistorical("4h", lookbackStartMs - 86400000 * 30, nowMs);
  const candles1d = await fetchBinanceHistorical("1d", lookbackStartMs - 86400000 * 120, nowMs);

  console.log(`Fetched: 15m: ${candles15m.length} bars | 1h: ${candles1h.length} bars | 4h: ${candles4h.length} bars | 1d: ${candles1d.length} bars`);

  // Find index where replayStartMs begins
  const startIndex = candles15m.findIndex(c => c.openTime >= replayStartMs);
  console.log(`Replay begins at 15M candle index ${startIndex} (${new Date(candles15m[startIndex].openTime).toISOString()})`);
  console.log(`Total 15M candles to step through: ${candles15m.length - startIndex}\n`);

  interface ActivePosition {
    id: string;
    direction: "LONG" | "SHORT";
    entryBarIndex: number;
    openedAt: number;
    entryPrice: number;
    atr: number;
    stopLoss: number;
    takeProfit1: number;
    breakevenTrigger: number;
    breakevenLocked: number;
    breakevenActivated: boolean;
    positionSizeINR: number;
  }

  let activeTrade: ActivePosition | null = null;
  const completedTrades: SimulationTrade[] = [];
  let signalsCount = 0;

  for (let i = startIndex; i < candles15m.length; i++) {
    const currentBar = candles15m[i];
    const prevClosedCandles15m = candles15m.slice(0, i); // Closed candles up to bar i-1

    // 1. If we have an active trade, check exit conditions using currentBar (H, L, C)
    if (activeTrade) {
      const barsHeld = i - activeTrade.entryBarIndex;
      let exitFound = false;
      let exitPrice = 0;
      let exitReason = "";

      if (activeTrade.direction === "LONG") {
        // Stop Loss Check
        if (currentBar.low <= activeTrade.stopLoss) {
          exitPrice = activeTrade.stopLoss;
          exitReason = activeTrade.breakevenActivated ? "Breakeven Hit (+0.05R)" : "Stop Loss Hit (-1.0R)";
          exitFound = true;
        } else if (currentBar.high >= activeTrade.takeProfit1) {
          exitPrice = activeTrade.takeProfit1;
          exitReason = "Take Profit 1 Hit (+1.00R)";
          exitFound = true;
        } else if (!activeTrade.breakevenActivated && currentBar.high >= activeTrade.breakevenTrigger) {
          activeTrade.breakevenActivated = true;
          activeTrade.stopLoss = activeTrade.breakevenLocked;
        }
      } else {
        // SHORT
        if (currentBar.high >= activeTrade.stopLoss) {
          exitPrice = activeTrade.stopLoss;
          exitReason = activeTrade.breakevenActivated ? "Breakeven Hit (+0.05R)" : "Stop Loss Hit (-1.0R)";
          exitFound = true;
        } else if (currentBar.low <= activeTrade.takeProfit1) {
          exitPrice = activeTrade.takeProfit1;
          exitReason = "Take Profit 1 Hit (+1.00R)";
          exitFound = true;
        } else if (!activeTrade.breakevenActivated && currentBar.low <= activeTrade.breakevenTrigger) {
          activeTrade.breakevenActivated = true;
          activeTrade.stopLoss = activeTrade.breakevenLocked;
        }
      }

      // Vertical Time Barrier (24 bars = 6 hours)
      if (!exitFound && barsHeld >= 24) {
        exitPrice = currentBar.close;
        exitReason = `Vertical Time Barrier Hit (${barsHeld}/24 bars expiry)`;
        exitFound = true;
      }

      if (exitFound) {
        const grossPnLPct = activeTrade.direction === "LONG" 
          ? (exitPrice - activeTrade.entryPrice) / activeTrade.entryPrice 
          : (activeTrade.entryPrice - exitPrice) / activeTrade.entryPrice;
        const netPnLPct = grossPnLPct - ROUND_TRIP_FEE_PCT;
        const netPnLINR = netPnLPct * activeTrade.positionSizeINR;

        completedTrades.push({
          id: activeTrade.id,
          direction: activeTrade.direction,
          openedAt: activeTrade.openedAt,
          openDate: new Date(activeTrade.openedAt).toISOString(),
          entryPrice: activeTrade.entryPrice,
          closedAt: currentBar.openTime,
          closeDate: new Date(currentBar.openTime).toISOString(),
          exitPrice,
          exitReason,
          barsHeld,
          grossPnLPct: grossPnLPct * 100,
          netPnLPct: netPnLPct * 100,
          netPnLINR: Math.round(netPnLINR * 100) / 100,
        });

        activeTrade = null;
      }
    }

    // 2. If no position is open, evaluate model on closed candles up to bar i-1 to enter at bar i open
    if (!activeTrade) {
      // Find HTF candles strictly closed before currentBar.openTime
      const htf1hClosed = candles1h.filter(c => (c.closeTime ?? 0) <= currentBar.openTime);
      const htf4hClosed = candles4h.filter(c => (c.closeTime ?? 0) <= currentBar.openTime);
      const htf1dClosed = candles1d.filter(c => (c.closeTime ?? 0) <= currentBar.openTime);

      const prediction = await getModelPrediction(
        "15m-sniper-030",
        prevClosedCandles15m,
        undefined,
        htf4hClosed,
        htf1hClosed,
        htf1dClosed
      );

      if (prediction.signal === "BUY" || prediction.signal === "SELL") {
        signalsCount++;
        const atr = prediction.atr || currentBar.open * 0.0055;
        const entryPrice = currentBar.open;
        const slDist = atr;
        const tpDist = atr;

        // Position sizing based on 1% risk
        const slDistPct = slDist / entryPrice;
        const positionSizeINR = Math.min(CAPITAL_INR * 3.0, (CAPITAL_INR * RISK_PER_TRADE_PCT) / Math.max(slDistPct, 0.003));

        const isLong = prediction.signal === "BUY";
        const stopLoss = isLong ? entryPrice - slDist : entryPrice + slDist;
        const takeProfit1 = isLong ? entryPrice + tpDist : entryPrice - tpDist;
        const beTrigger = isLong ? entryPrice + 0.30 * atr : entryPrice - 0.30 * atr;
        const beLocked = isLong ? entryPrice + (ROUND_TRIP_FEE_PCT * entryPrice) : entryPrice - (ROUND_TRIP_FEE_PCT * entryPrice);

        activeTrade = {
          id: `trade-backfill-${currentBar.openTime}-${completedTrades.length + 33}`,
          direction: isLong ? "LONG" : "SHORT",
          entryBarIndex: i,
          openedAt: currentBar.openTime,
          entryPrice,
          atr,
          stopLoss,
          takeProfit1,
          breakevenTrigger: beTrigger,
          breakevenLocked: beLocked,
          breakevenActivated: false,
          positionSizeINR,
        };
      }
    }
  }

  console.log(`Replay Complete!`);
  console.log(`Total Signal Opportunities Evaluated: ${candles15m.length - startIndex} bars`);
  console.log(`Total Signals Triggered: ${signalsCount}`);
  console.log(`Total Missed Trades Completed: ${completedTrades.length}`);
  if (activeTrade) {
    console.log(`Active trade currently still OPEN: ${activeTrade.direction} @ ${activeTrade.entryPrice} from ${new Date(activeTrade.openedAt).toISOString()}`);
  }

  console.log("\n================================================================================");
  console.log("MISSED TRADES LOG (OCT 31 18:00 TO PRESENT):");
  console.log("================================================================================");
  completedTrades.forEach((t, idx) => {
    console.log(`[#${idx + 34}] ${t.id} | ${t.direction} | In: ${t.openDate} @ $${t.entryPrice.toFixed(1)} | Out: ${t.closeDate} @ $${t.exitPrice.toFixed(1)} | ${t.exitReason} (${t.barsHeld} bars) | Net PnL: ₹${t.netPnLINR.toFixed(2)} (${t.netPnLPct > 0 ? '+' : ''}${t.netPnLPct.toFixed(2)}%)`);
  });

  const totalPnLINR = completedTrades.reduce((acc, t) => acc + t.netPnLINR, 0);
  const winCount = completedTrades.filter(t => t.netPnLINR > 0).length;
  const beCount = completedTrades.filter(t => t.exitReason.includes("Breakeven")).length;
  const slCount = completedTrades.filter(t => t.exitReason.includes("Stop Loss")).length;
  const tpCount = completedTrades.filter(t => t.exitReason.includes("Take Profit")).length;

  console.log("\n--- Summary of Missed Trades ---");
  console.log(`Count: ${completedTrades.length} trades`);
  console.log(`Wins (Net PnL > 0): ${winCount} / ${completedTrades.length} (${(winCount / completedTrades.length * 100 || 0).toFixed(1)}%)`);
  console.log(`TP: ${tpCount} | BE: ${beCount} | SL: ${slCount}`);
  console.log(`Total Net PnL for missed period: ₹${totalPnLINR.toFixed(2)}`);
}

runReplay().catch(console.error);
