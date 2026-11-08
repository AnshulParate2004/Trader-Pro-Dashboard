const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const MONGO_URI = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority";
const DATA_DIR = path.join(__dirname, "..", "src", "data");

const LIVE_COLLECTIONS = [
  { col: "paper_trades_v1_distributed_4h", file: "v1_distributed_4h_live_trades.json" },
  { col: "paper_trades_v1_stacking_1h", file: "v1_stacking_1h_live_trades.json" },
  { col: "paper_trades_v1_distributed_1h", file: "v1_distributed_1h_live_trades.json" },
  { col: "paper_trades_v1_unified_1h", file: "v1_unified_1h_live_trades.json" },
  { col: "paper_trades_v1_consensus_1h", file: "v1_consensus_1h_live_trades.json" },
  { col: "paper_trades_v1_unified_4h", file: "v1_unified_4h_live_trades.json" },
  { col: "paper_trades_new_consensus_1h", file: "new_consensus_1h_live_trades.json" },
  { col: "paper_trades_new_stacking_1h", file: "new_stacking_1h_live_trades.json" },
  // OM Suites (6-Year Segmentation Architecture)
  { col: "paper_trades_om_distributed_4h", file: "om_distributed_4h_live_trades.json" },
  { col: "paper_trades_om_stacking_1h", file: "om_stacking_1h_live_trades.json" },
  { col: "paper_trades_om_distributed_1h", file: "om_distributed_1h_live_trades.json" },
  { col: "paper_trades_om_unified_1h", file: "om_unified_1h_live_trades.json" },
  { col: "paper_trades_om_consensus_1h", file: "om_consensus_1h_live_trades.json" },
  { col: "paper_trades_om_unified_4h", file: "om_unified_4h_live_trades.json" },
];

const HISTORICAL_COLLECTIONS = [
  { col: "historical_trades_v1_distributed_4h", file: "v1_distributed_4h_unseen_trades.json" },
  { col: "historical_trades_v1_stacking_1h", file: "v1_stacking_1h_unseen_trades.json" },
  { col: "historical_trades_v1_distributed_1h", file: "v1_distributed_1h_unseen_trades.json" },
  { col: "historical_trades_v1_unified_1h", file: "v1_unified_1h_unseen_trades.json" },
  { col: "historical_trades_v1_consensus_1h", file: "v1_consensus_1h_unseen_trades.json" },
  { col: "historical_trades_v1_unified_4h", file: "v1_unified_4h_unseen_trades.json" },
  { col: "historical_trades_new_consensus_1h", file: "new_consensus_1h_unseen_trades.json" },
  { col: "historical_trades_new_stacking_1h", file: "new_stacking_1h_unseen_trades.json" },
  // OM Suites (6-Year Segmentation Architecture)
  { col: "historical_trades_om_distributed_4h", file: "om_distributed_4h_unseen_trades.json" },
  { col: "historical_trades_om_stacking_1h", file: "om_stacking_1h_unseen_trades.json" },
  { col: "historical_trades_om_distributed_1h", file: "om_distributed_1h_unseen_trades.json" },
  { col: "historical_trades_om_unified_1h", file: "om_unified_1h_unseen_trades.json" },
  { col: "historical_trades_om_consensus_1h", file: "om_consensus_1h_unseen_trades.json" },
  { col: "historical_trades_om_unified_4h", file: "om_unified_4h_unseen_trades.json" },
];

async function seed() {
  console.log("Connecting to MongoDB Atlas...");
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db("that");
  console.log("Connected to MongoDB database 'that'!\n");

  console.log("=== SEEDING LIVE COLLECTIONS ===");
  for (const item of LIVE_COLLECTIONS) {
    const filePath = path.join(DATA_DIR, item.file);
    if (!fs.existsSync(filePath)) {
      console.log(`[SKIP] Missing file: ${item.file}`);
      continue;
    }
    const trades = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const col = db.collection(item.col);

    await col.deleteMany({});
    if (trades.length > 0) {
      await col.insertMany(trades);
      await col.createIndex({ entry_time_ms: -1 });
      await col.createIndex({ symbol: 1 });
      await col.createIndex({ model_id: 1 });
    }
    console.log(`[OK] Seeded ${trades.length} trades into ${item.col}`);
  }

  console.log("\n=== SEEDING HISTORICAL UNSEEN COLLECTIONS ===");
  for (const item of HISTORICAL_COLLECTIONS) {
    const filePath = path.join(DATA_DIR, item.file);
    if (!fs.existsSync(filePath)) {
      console.log(`[SKIP] Missing file: ${item.file}`);
      continue;
    }
    const trades = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const col = db.collection(item.col);

    await col.deleteMany({});
    if (trades.length > 0) {
      // Insert in chunks of 1000
      for (let i = 0; i < trades.length; i += 1000) {
        const chunk = trades.slice(i, i + 1000);
        await col.insertMany(chunk);
      }
      await col.createIndex({ entry_time_ms: -1 });
      await col.createIndex({ symbol: 1 });
      await col.createIndex({ model_id: 1 });
    }
    console.log(`[OK] Seeded ${trades.length} trades into ${item.col}`);
  }

  console.log("\nAll MongoDB collections successfully seeded and indexed!");
  await client.close();
}

seed().catch(err => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
