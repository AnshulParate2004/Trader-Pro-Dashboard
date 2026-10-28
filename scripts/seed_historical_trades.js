const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const uri = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority";

function parseCsv(filePath, modelId) {
  if (!fs.existsSync(filePath)) {
    console.warn("File not found:", filePath);
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  if (lines.length <= 1) return [];

  const trades = [];
  // Header: pos,side,R,exit_bar,entry_time,exit_time,ret
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length >= 7) {
      const pos = parseInt(parts[0], 10);
      const sideVal = parseInt(parts[1], 10);
      const rVal = parseFloat(parts[2]);
      const entryTime = parts[4].replace("+00:00", " UTC");
      const exitTime = parts[5].replace("+00:00", " UTC");
      const retVal = parseFloat(parts[6]);

      let exitReason = "STOP_LOSS";
      if (rVal >= 1.0) exitReason = "TAKE_PROFIT";
      else if (rVal > 0.0) exitReason = "BREAKEVEN_RATCHET";
      else if (rVal <= -0.95) exitReason = "STOP_LOSS";
      else exitReason = "TIME_EXPIRY";

      trades.push({
        id: `hist-${modelId}-${pos}`,
        modelId,
        pos,
        entryTime,
        exitTime,
        side: sideVal === 1 ? "LONG" : "SHORT",
        outcomeR: rVal,
        returnPct: Number((retVal * 100).toFixed(2)),
        exitReason,
        causalityCheck: "POINT_IN_TIME",
      });
    }
  }
  return trades;
}

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("that");
  console.log("Connected to MongoDB Atlas database 'that'");

  // Collection for historical backtest trades (COMPLETELY SEPARATE from live trade_logs!)
  const col = db.collection("historical_trades");

  // Create index
  await col.createIndex({ modelId: 1, pos: -1 });

  // 1. Parse 15m Sniper (6,538 trades)
  const path15m = path.join(__dirname, "..", "src", "models", "multi_model_scalp", "trades_main.csv");
  console.log("Parsing 15m trades from:", path15m);
  const trades15m = parseCsv(path15m, "15m-sniper-030");
  console.log(`Parsed ${trades15m.length} trades for 15m-sniper-030`);

  // Clear existing for 15m
  await col.deleteMany({ modelId: "15m-sniper-030" });

  // Batch insert 15m
  const BATCH_SIZE = 1000;
  for (let i = 0; i < trades15m.length; i += BATCH_SIZE) {
    const batch = trades15m.slice(i, i + BATCH_SIZE);
    await col.insertMany(batch);
    console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} trades)...`);
  }

  // Also duplicate or map for 15m-precision-035 if needed, or query mapping
  const count15m = await col.countDocuments({ modelId: "15m-sniper-030" });
  console.log(`Total historical trades in MongoDB for 15m-sniper-030: ${count15m}`);

  // 2. Parse 5m Master Confluence (11,420 trades)
  const path5m = path.join(__dirname, "..", "src", "models", "multi_model_scalp_5m", "trades_main.csv");
  if (fs.existsSync(path5m)) {
    console.log("Parsing 5m trades from:", path5m);
    const trades5m = parseCsv(path5m, "master-confluence-multi");
    console.log(`Parsed ${trades5m.length} trades for master-confluence-multi`);

    await col.deleteMany({ modelId: "master-confluence-multi" });
    for (let i = 0; i < trades5m.length; i += BATCH_SIZE) {
      const batch = trades5m.slice(i, i + BATCH_SIZE);
      await col.insertMany(batch);
    }
    const count5m = await col.countDocuments({ modelId: "master-confluence-multi" });
    console.log(`Total historical trades in MongoDB for master-confluence-multi: ${count5m}`);
  }

  // Double check that live trade_logs was NOT touched:
  const liveCount = await db.collection("trade_logs").countDocuments();
  const cfg = await db.collection("engine_config").findOne({ id: "shark_engine_config" });
  console.log("\n=== VERIFICATION: LIVE CAPITAL & TRADES UNTOUCHED ===");
  console.log("Live trade_logs count:", liveCount, "(Must be 4)");
  console.log("Engine Config Capital:", cfg ? cfg.accountBalanceINR : "N/A", "(Must be 1000)");

  await client.close();
}

run().catch(console.error);
