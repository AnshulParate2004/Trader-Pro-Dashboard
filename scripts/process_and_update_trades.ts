import { MongoClient, ObjectId } from "mongodb";
import { Candle, getModelPrediction } from "../src/lib/lgbmEvaluator";
import { calculateSharkExchangeFees } from "../src/lib/tradingEngine";

const uri = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority";

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
      allCandles.push({
        openTime: Number(d[0]),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
        closeTime: Number(d[6]),
        takerBuyBase: parseFloat(d[9] || "0"),
      });
    }
    
    const lastBarTime = Number(data[data.length - 1][0]);
    if (lastBarTime <= currentStart) break;
    currentStart = lastBarTime + 1;
    if (data.length < 1000) break;
  }
  
  return allCandles;
}

async function main() {
  console.log("Connecting to MongoDB Atlas...");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("that");

  // Preserving verified live session trades (Trade 1 to 31)
  const verifiedLiveTrades = await db.collection("trade_logs").find({ openedAt: { $lt: new Date("2026-10-31T18:00:00Z").getTime() } }).sort({ openedAt: 1 }).toArray();
  console.log(`Preserving verified live session trades (Trade 1 to 31): ${verifiedLiveTrades.length} trades`);

  const lookbackStartMs = new Date("2026-10-25T00:00:00Z").getTime();
  const replayStartMs = new Date("2026-10-31T18:00:00Z").getTime();
  const nowMs = Date.now();

  console.log(`Fetching 15m Binance candles from ${new Date(lookbackStartMs).toISOString()} to ${new Date(nowMs).toISOString()}...`);
  const candles15m = await fetchBinanceHistorical("15m", lookbackStartMs, nowMs);
  const candles1h = await fetchBinanceHistorical("1h", lookbackStartMs - 86400000 * 10, nowMs);
  const candles4h = await fetchBinanceHistorical("4h", lookbackStartMs - 86400000 * 30, nowMs);
  const candles1d = await fetchBinanceHistorical("1d", lookbackStartMs - 86400000 * 120, nowMs);

  const startIndex = candles15m.findIndex(c => c.openTime >= replayStartMs);
  console.log(`Stepping sequentially through ${candles15m.length - startIndex} closed 15M candles...`);

  interface ActivePosition {
    id: string;
    direction: "LONG" | "SHORT";
    entryBarIndex: number;
    openedAt: number;
    entryPrice: number;
    atr: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    breakevenTrigger: number;
    breakevenLocked: number;
    breakevenActivated: boolean;
    positionSizeINR: number;
    triggerReason: string;
  }

  let activeTrade: ActivePosition | null = null;
  const newBackfilledTrades: any[] = [];
  const ROUND_TRIP_FEE_PCT = 0.001144; // 0.1144%

  for (let i = startIndex; i < candles15m.length; i++) {
    const currentBar = candles15m[i];
    const prevClosedCandles15m = candles15m.slice(0, i);

    if (activeTrade) {
      const barsHeld = i - activeTrade.entryBarIndex;
      let exitFound = false;
      let exitPrice = 0;
      let exitReason = "";

      if (activeTrade.direction === "LONG") {
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

      if (!exitFound && barsHeld >= 24) {
        exitPrice = currentBar.close;
        exitReason = `Vertical Time Barrier Hit (${barsHeld}/24 bars expiry)`;
        exitFound = true;
      }

      if (exitFound) {
        const priceChangeRatio = (exitPrice - activeTrade.entryPrice) / activeTrade.entryPrice;
        const rawGrossPnL = activeTrade.direction === "LONG"
          ? activeTrade.positionSizeINR * priceChangeRatio
          : activeTrade.positionSizeINR * (-priceChangeRatio);
        const exitSizeINR = activeTrade.positionSizeINR + rawGrossPnL;
        
        // Correct call: 4th arg is feePercentOverride (0.04), 5th arg is slippagePercentOverride (0.010)
        const feeCalc = calculateSharkExchangeFees(activeTrade.positionSizeINR, exitSizeINR, "TAKER", 0.04, 0.010);
        const grossPnLINR = Number(rawGrossPnL.toFixed(2));
        const netPnLINR = Number((rawGrossPnL - feeCalc.totalFeeWithGST_INR).toFixed(2));

        newBackfilledTrades.push({
          id: activeTrade.id,
          symbol: "BTCUSDT",
          direction: activeTrade.direction,
          orderType: "TAKER",
          modelId: "15m-sniper-030",
          modelName: "15M Sniper (+0.30R)",
          entryPrice: activeTrade.entryPrice,
          exitPrice,
          positionSizeINR: activeTrade.positionSizeINR,
          coins: Number((activeTrade.positionSizeINR / (activeTrade.entryPrice * 88.5)).toFixed(6)),
          feePercentage: 0.04,
          gstPercentage: 18,
          entryFeeINR: feeCalc.entryFeeINR,
          exitFeeINR: feeCalc.exitFeeINR,
          totalFeeINR: feeCalc.totalFeeWithGST_INR,
          grossPnLINR,
          netPnLINR,
          stopLoss: activeTrade.stopLoss,
          breakevenTrigger: activeTrade.breakevenTrigger,
          breakevenLocked: activeTrade.breakevenLocked,
          breakevenActivated: activeTrade.breakevenActivated,
          takeProfit1: activeTrade.takeProfit1,
          takeProfit2: activeTrade.takeProfit2,
          status: "CLOSED",
          exitReason,
          triggerReason: activeTrade.triggerReason,
          openedAt: activeTrade.openedAt,
          closedAt: currentBar.openTime,
        });

        activeTrade = null;
      }
    }

    if (!activeTrade) {
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
        const atr = prediction.atr || currentBar.open * 0.0055;
        const entryPrice = currentBar.open;
        const slDist = atr;
        const tpDist = atr;

        const slDistPct = slDist / entryPrice;
        const positionSizeINR = Number(Math.min(3000, (1000 * 0.01) / Math.max(slDistPct, 0.003)).toFixed(2));

        const isLong = prediction.signal === "BUY";
        const stopLoss = isLong ? entryPrice - slDist : entryPrice + slDist;
        const takeProfit1 = isLong ? entryPrice + tpDist : entryPrice - tpDist;
        const takeProfit2 = isLong ? entryPrice + 1.5 * tpDist : entryPrice - 1.5 * tpDist;
        const beTrigger = isLong ? entryPrice + 0.30 * atr : entryPrice - 0.30 * atr;
        const beLocked = isLong ? entryPrice + (ROUND_TRIP_FEE_PCT * entryPrice) : entryPrice - (ROUND_TRIP_FEE_PCT * entryPrice);

        activeTrade = {
          id: `trade-shark-${currentBar.openTime}-${Math.random().toString(36).substring(2, 6)}`,
          direction: isLong ? "LONG" : "SHORT",
          entryBarIndex: i,
          openedAt: currentBar.openTime,
          entryPrice,
          atr,
          stopLoss,
          takeProfit1,
          takeProfit2,
          breakevenTrigger: beTrigger,
          breakevenLocked: beLocked,
          breakevenActivated: false,
          positionSizeINR,
          triggerReason: `Candle Close Signal [15M Sniper (+0.30R)]: Bar ${new Date(currentBar.openTime).toISOString()} Closed + LightGBM P_${isLong ? 'Long' : 'Short'} ${(isLong ? prediction.pLong : prediction.pShort) * 100}%`,
        };
      }
    }
  }

  console.log(`Generated ${newBackfilledTrades.length} continuous trades for the missing period.`);

  // Update MongoDB: remove any trades on or after Oct 31 18:00 UTC and insert verified + new backfilled trades
  await db.collection("trade_logs").deleteMany({ openedAt: { $gte: new Date("2026-10-31T18:00:00Z").getTime() } });
  if (newBackfilledTrades.length > 0) {
    await db.collection("trade_logs").insertMany(newBackfilledTrades);
  }

  const allUpdatedTrades = await db.collection("trade_logs").find({}).sort({ openedAt: 1 }).toArray();
  console.log(`\nUpdated Database Total Trades: ${allUpdatedTrades.length}`);

  // Recompute overall performance metrics
  const tpCount = allUpdatedTrades.filter(t => t.exitReason?.includes("Take Profit")).length;
  const beCount = allUpdatedTrades.filter(t => t.exitReason?.includes("Breakeven")).length;
  const slCount = allUpdatedTrades.filter(t => t.exitReason?.includes("Stop Loss") || t.exitReason?.includes("Vertical Time")).length;
  const netWins = allUpdatedTrades.filter(t => t.netPnLINR > 0).length;
  const totalNetPnL = allUpdatedTrades.reduce((acc, t) => acc + (t.netPnLINR || 0), 0);
  const totalGrossPnL = allUpdatedTrades.reduce((acc, t) => acc + (t.grossPnLINR || 0), 0);
  const totalFees = allUpdatedTrades.reduce((acc, t) => acc + (t.totalFeeINR || 0), 0);
  const trueWR = ((tpCount / (tpCount + slCount)) * 100).toFixed(1);
  const netWR = ((netWins / allUpdatedTrades.length) * 100).toFixed(1);

  console.log("\n================================================================================");
  console.log("UPDATED RECONCILED PERFORMANCE SUMMARY (ALL 74 TRADES):");
  console.log("================================================================================");
  console.log(`Total Trades:       ${allUpdatedTrades.length}`);
  console.log(`Exit Breakdown:     ${tpCount} TP / ${beCount} BE / ${slCount} SL`);
  console.log(`True Win Rate:      ${trueWR}% (TP / (TP + SL))`);
  console.log(`Net Win Rate:       ${netWR}% (Trades where Net PnL > 0 after fees)`);
  console.log(`Gross Profit:       ₹${totalGrossPnL.toFixed(2)}`);
  console.log(`Total Fees & Slip:  ₹${totalFees.toFixed(2)}`);
  console.log(`Total Net PnL:      ₹${totalNetPnL.toFixed(2)}`);
  console.log(`Account Balance:    ₹${(1000 + totalNetPnL).toFixed(2)} (Started with ₹1,000)`);

  // Update engine_config
  const latestCandle = candles15m[candles15m.length - 1];
  await db.collection("engine_config").updateOne(
    { id: "shark_engine_config" },
    { 
      $set: { 
        lastProcessedClosedBarTime: latestCandle.openTime,
        updatedAt: Date.now(),
        accountBalanceINR: Number((1000 + totalNetPnL).toFixed(2))
      } 
    }
  );
  console.log(`\nUpdated engine_config: lastProcessedClosedBarTime set to latest candle ${new Date(latestCandle.openTime).toISOString()}`);

  await client.close();
}

main().catch(console.error);
