const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const uri = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority";

async function run() {
  const jsonPath = path.join(
    "C:",
    "Users",
    "Kaizen",
    ".gemini",
    "antigravity",
    "brain",
    "2a5d3b65-201a-47b6-8a7f-ad98e7c6f21d",
    "scratch",
    "reprocessed_trades_oct28_to_now.json"
  );

  const trades = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`Loaded ${trades.length} reprocessed trades starting from Oct 28`);

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("that");

  console.log("Connected to MongoDB Atlas database 'that'");

  // 1. Clear existing live trade logs
  await db.collection("trade_logs").deleteMany({});
  console.log("Cleared existing trade_logs");

  // 2. Insert all 31 reprocessed trades
  const insertResult = await db.collection("trade_logs").insertMany(trades);
  console.log(`Successfully inserted ${insertResult.insertedCount} trades into 'trade_logs'`);

  // 3. Compute net metrics
  let totalFees = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let netPnL = 0;
  let wins = 0;
  let losses = 0;

  for (const t of trades) {
    totalFees += t.totalFeeINR || 0;
    const gross = t.grossPnLINR || 0;
    const net = t.netPnLINR || 0;
    if (net > 0) {
      wins++;
      grossProfit += gross;
    } else if (net < 0) {
      losses++;
      grossLoss += Math.abs(gross);
    }
    netPnL += net;
  }

  const finalBalance = 1000.0 + netPnL;

  // 4. Update engine_config
  await db.collection("engine_config").updateOne(
    { id: "shark_engine_config" },
    {
      $set: {
        id: "shark_engine_config",
        autoTradingEnabled: true,
        currency: "INR",
        accountBalanceINR: Number(finalBalance.toFixed(2)),
        initialCapitalINR: 1000.0,
        tradingFeePercent: 0.040,
        makerFeePercent: 0.016,
        gstPercent: 18.0,
        riskPerTradePercent: 1.0,
        ratchetEnabled: true,
        maxConcurrentTrades: 1,
        activeModelId: "15m-sniper-030",
        lastProcessedClosedBarTime: trades[trades.length - 1].openedAt,
        updatedAt: Date.now(),
      },
    },
    { upsert: true }
  );

  console.log("Engine configuration successfully updated:");
  console.log(`  Initial Capital: INR 1,000.00`);
  console.log(`  Final Balance:   INR ${finalBalance.toFixed(2)} (Net PnL: INR ${netPnL.toFixed(2)})`);
  console.log(`  Trades Count:    ${trades.length} (Wins: ${wins}, Losses: ${losses}, Win Rate: ${(wins / trades.length * 100).toFixed(1)}%)`);
  console.log(`  Gross Profit:    INR ${grossProfit.toFixed(2)} | Gross Loss: INR ${grossLoss.toFixed(2)}`);
  console.log(`  Total Shark Fee: INR ${totalFees.toFixed(2)}`);

  await client.close();
  console.log("Done!");
}

run().catch((err) => {
  console.error("Error seeding trades:", err);
  process.exit(1);
});
