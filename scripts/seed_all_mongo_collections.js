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
];

async function seed() {
  console.log("Connecting to MongoDB Atlas...");
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db("that");
  console.log("Connected to MongoDB database 'that'!\n");

  console.log("--- SEEDING LIVE COLLECTIONS ---");
  for (const item of LIVE_COLLECTIONS) {
    const filePath = path.join(DATA_DIR, item.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`File missing: ${filePath}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const col = db.collection(item.col);
    await col.drop().catch(() => {});
    if (data.length > 0) {
      await col.insertMany(data);
      await col.createIndex({ entry_time_ms: -1 });
    }
    const count = await col.countDocuments();
    console.log(`✓ Seeded ${item.col} : ${count} trades`);
  }

  console.log("\n--- SEEDING HISTORICAL UNSEEN COLLECTIONS ---");
  for (const item of HISTORICAL_COLLECTIONS) {
    const filePath = path.join(DATA_DIR, item.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`File missing: ${filePath}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const col = db.collection(item.col);
    await col.drop().catch(() => {});
    if (data.length > 0) {
      const batchSize = 1000;
      for (let i = 0; i < data.length; i += batchSize) {
        await col.insertMany(data.slice(i, i + batchSize));
      }
      await col.createIndex({ entry_time_ms: -1 });
    }
    const count = await col.countDocuments();
    console.log(`✓ Seeded ${item.col} : ${count} trades`);
  }

  await client.close();
  console.log("\nAll collections seeded successfully into MongoDB Atlas!");
}

seed().catch(console.error);
