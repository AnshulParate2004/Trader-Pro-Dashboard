const { MongoClient } = require("mongodb");
const uri = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority";

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("that");
  const trades = await db.collection("trade_logs").find({}).sort({ openedAt: 1 }).toArray();
  console.log("Total trades in trade_logs:", trades.length);
  trades.forEach((t) => {
    const d = new Date(t.openedAt + 5.5 * 3600 * 1000).toISOString();
    console.log(t.id, d, t.direction, t.entryPrice, t.exitPrice, t.status, "NetPnL:", t.netPnLINR);
  });
  const config = await db.collection("engine_config").findOne({ id: "global_config" });
  console.log("Engine config:", JSON.stringify(config, null, 2));
  await client.close();
}

run();
