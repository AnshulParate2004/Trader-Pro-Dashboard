const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority";

function calculateSharkExchangeFees(entrySizeINR, exitSizeINR, orderType = "TAKER", feePercentOverride) {
  const baseRate = feePercentOverride ?? (orderType === "TAKER" ? 0.040 : 0.016);
  const baseRateDecimal = baseRate / 100;
  const gstRate = 0.18;

  const rawEntryFee = entrySizeINR * baseRateDecimal;
  const rawExitFee = exitSizeINR * baseRateDecimal;
  const rawTotalFee = rawEntryFee + rawExitFee;

  const gstAmount = rawTotalFee * gstRate;
  const totalWithGST = rawTotalFee + gstAmount;

  return {
    baseFeeRate: baseRate,
    entryFeeINR: Number((rawEntryFee * 1.18).toFixed(4)),
    exitFeeINR: Number((rawExitFee * 1.18).toFixed(4)),
    gstAmountINR: Number(gstAmount.toFixed(4)),
    totalFeeWithGST_INR: Number(totalWithGST.toFixed(4)),
  };
}

const tradesData = [
  {
    symbol: "BTCUSDT",
    direction: "LONG",
    entryPrice: 80957.15,
    exitPrice: 81096.64,
    atr: 139.49,
    exitReason: "WIN (+1.00R Full TP Hit)",
    // 03:00 AM IST = Oct 27 21:30 UTC
    openedAt: 1793136600000,
    closedAt: 1793137500000,
    triggerReason: "15M Donchian Breakout ($80,957.15 > $80,920.00) | LightGBM P_Long: 0.5562",
    stopLoss: 80817.66,
    breakevenTrigger: 80999.00,
    breakevenLocked: 80964.12,
    takeProfit1: 81096.64,
    takeProfit2: 81166.39,
  },
  {
    symbol: "BTCUSDT",
    direction: "LONG",
    entryPrice: 81200.01,
    exitPrice: 81063.00,
    atr: 137.01,
    exitReason: "LOSS (-1.00R Stop Loss Hit)",
    // 09:00 AM IST = Oct 28 03:30 UTC
    openedAt: 1793158200000,
    closedAt: 1793160000000,
    triggerReason: "15M Donchian Breakout ($81,200.01 > $81,180.00) | LightGBM P_Long: 0.5610",
    stopLoss: 81063.00,
    breakevenTrigger: 81241.11,
    breakevenLocked: 81206.86,
    takeProfit1: 81337.02,
    takeProfit2: 81405.52,
  },
  {
    symbol: "BTCUSDT",
    direction: "LONG",
    entryPrice: 81471.36,
    exitPrice: 81562.45,
    atr: 91.09,
    exitReason: "WIN (+1.00R Full TP Hit)",
    // 01:45 PM IST = Oct 28 08:15 UTC
    openedAt: 1793175300000,
    closedAt: 1793176200000,
    triggerReason: "15M Donchian Breakout ($81,471.36 > $81,350.00) | LightGBM P_Long: 0.5548",
    stopLoss: 81380.27,
    breakevenTrigger: 81498.69,
    breakevenLocked: 81475.91,
    takeProfit1: 81562.45,
    takeProfit2: 81608.00,
  },
  {
    symbol: "BTCUSDT",
    direction: "LONG",
    entryPrice: 81681.45,
    exitPrice: 81567.15,
    atr: 114.30,
    exitReason: "LOSS (-1.00R Stop Loss Hit)",
    // 02:00 PM IST = Oct 28 08:30 UTC
    openedAt: 1793176200000,
    closedAt: 1793177100000,
    triggerReason: "15M Donchian Breakout ($81,681.45 > $81,500.00) | LightGBM P_Long: 0.5781",
    stopLoss: 81567.15,
    breakevenTrigger: 81715.74,
    breakevenLocked: 81687.16,
    takeProfit1: 81795.75,
    takeProfit2: 81852.90,
  },
];

async function seed() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("that");

  console.log("Connected to MongoDB Atlas database 'that'");

  // 1. Reset / initialize engine config with ₹1,000 capital
  const INITIAL_CAPITAL = 1000.0;
  let runningBalance = INITIAL_CAPITAL;

  // Clear previous trade logs
  await db.collection("trade_logs").deleteMany({});
  console.log("Cleared existing trade_logs");

  const formattedTrades = [];

  for (let i = 0; i < tradesData.length; i++) {
    const raw = tradesData[i];
    const atrPct = raw.atr / raw.entryPrice;
    const levScale = Math.min(3.0, 0.01 / atrPct);
    const positionSizeINR = Number((runningBalance * levScale).toFixed(2));
    const coins = Number((positionSizeINR / (raw.entryPrice * 88.5)).toFixed(6));

    const priceChangeRatio = (raw.exitPrice - raw.entryPrice) / raw.entryPrice;
    const rawGrossPnL = raw.direction === "LONG"
      ? positionSizeINR * priceChangeRatio
      : positionSizeINR * (-priceChangeRatio);

    const exitSizeINR = positionSizeINR + rawGrossPnL;
    const feeCalc = calculateSharkExchangeFees(positionSizeINR, exitSizeINR, "TAKER", 0.040);

    const grossPnLINR = Number(rawGrossPnL.toFixed(2));
    const netPnLINR = Number((rawGrossPnL - feeCalc.totalFeeWithGST_INR).toFixed(2));

    runningBalance += netPnLINR;

    const tradeDoc = {
      id: `trade-shark-${raw.openedAt}-${i + 1}`,
      symbol: raw.symbol,
      direction: raw.direction,
      orderType: "TAKER",
      modelId: "15m-sniper-030",
      modelName: "15M Sniper (+0.30R)",
      entryPrice: raw.entryPrice,
      exitPrice: raw.exitPrice,
      positionSizeINR,
      coins,
      feePercentage: 0.040,
      gstPercentage: 18.0,
      entryFeeINR: feeCalc.entryFeeINR,
      exitFeeINR: feeCalc.exitFeeINR,
      totalFeeINR: feeCalc.totalFeeWithGST_INR,
      grossPnLINR,
      netPnLINR,
      stopLoss: raw.stopLoss,
      breakevenTrigger: raw.breakevenTrigger,
      breakevenLocked: raw.breakevenLocked,
      breakevenActivated: raw.exitReason.includes("Breakeven"),
      takeProfit1: raw.takeProfit1,
      takeProfit2: raw.takeProfit2,
      status: "CLOSED",
      exitReason: raw.exitReason,
      triggerReason: raw.triggerReason,
      openedAt: raw.openedAt,
      closedAt: raw.closedAt,
    };

    formattedTrades.push(tradeDoc);
    console.log(`Trade #${i + 1} (${new Date(raw.openedAt + 5.5 * 3600 * 1000).toLocaleTimeString("en-IN")}): ${raw.direction} @ $${raw.entryPrice} -> Exit $${raw.exitPrice} | ${raw.exitReason} | Net PnL: ₹${netPnLINR >= 0 ? "+" : ""}${netPnLINR} | Balance: ₹${runningBalance.toFixed(2)}`);
  }

  // Insert trade logs
  if (formattedTrades.length > 0) {
    await db.collection("trade_logs").insertMany(formattedTrades);
    console.log(`Successfully inserted ${formattedTrades.length} trades into trade_logs!`);
  }

  // Update engine config
  await db.collection("engine_config").updateOne(
    { id: "shark_engine_config" },
    {
      $set: {
        id: "shark_engine_config",
        autoTradingEnabled: true,
        currency: "INR",
        accountBalanceINR: INITIAL_CAPITAL,
        tradingFeePercent: 0.040,
        makerFeePercent: 0.016,
        gstPercent: 18.0,
        riskPerTradePercent: 1.0,
        ratchetEnabled: true,
        maxConcurrentTrades: 1,
        activeModelId: "15m-sniper-030",
        lastProcessedClosedBarTime: 1793180700000,
        updatedAt: Date.now(),
      },
    },
    { upsert: true }
  );

  console.log(`Engine config updated: Starting Capital = ₹${INITIAL_CAPITAL}, Current Balance = ₹${runningBalance.toFixed(2)}`);

  // Verify by fetching
  const savedTrades = await db.collection("trade_logs").find().sort({ openedAt: 1 }).toArray();
  console.log("\n--- VERIFIED SAVED TRADES IN MONGODB ---");
  savedTrades.forEach((t, idx) => {
    const timeStr = new Date(t.openedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
    console.log(`Trade #${idx + 1} [${timeStr} IST] ${t.direction} @ $${t.entryPrice} -> Exit: $${t.exitPrice} | ${t.exitReason} | Size: ₹${t.positionSizeINR} | Gross: ₹${t.grossPnLINR} | Fee: ₹${t.totalFeeINR} | Net: ₹${t.netPnLINR}`);
  });

  const totalNet = savedTrades.reduce((acc, t) => acc + (t.netPnLINR || 0), 0);
  const totalFees = savedTrades.reduce((acc, t) => acc + (t.totalFeeINR || 0), 0);
  const wins = savedTrades.filter((t) => (t.netPnLINR || 0) > 0).length;
  const losses = savedTrades.filter((t) => (t.netPnLINR || 0) < 0).length;
  console.log(`\nMetrics: Total=${savedTrades.length}, Wins=${wins}, Losses=${losses}, WinRate=${((wins/savedTrades.length)*100).toFixed(1)}%, TotalFees=₹${totalFees.toFixed(2)}, NetPnL=₹${totalNet.toFixed(2)}, FinalBalance=₹${(INITIAL_CAPITAL + totalNet).toFixed(2)}`);
  
  await client.close();
}

seed().catch(console.error);
