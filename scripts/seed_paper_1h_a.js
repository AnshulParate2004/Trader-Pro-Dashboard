const { MongoClient } = require('D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/node_modules/mongodb');
const fs = require('fs');
const path = require('path');

const uri = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority";

async function seed() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('that');
  
  // Create / verify paper_1h_a collection (strictly isolated from trade_logs)
  const collection = db.collection('paper_1h_a');
  const count = await collection.countDocuments();
  console.log(`Current documents in paper_1h_a: ${count}`);
  
  if (count === 0) {
    console.log("Reading 1H-A trades from python export...");
    const jsonPath = 'C:/Users/Kaizen/.gemini/antigravity/brain/2a5d3b65-201a-47b6-8a7f-ad98e7c6f21d/scratch/paper_1h_a_seed.json';
    if (fs.existsSync(jsonPath)) {
      const trades = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      console.log(`Seeding ${trades.length} verified 1H-A trades into paper_1h_a...`);
      await collection.insertMany(trades);
      console.log("Seeding complete!");
    } else {
      console.log("Seed JSON not found, skipping initial population.");
    }
  } else {
    console.log("paper_1h_a already has data. Preserving all records.");
  }
  
  await client.close();
}

seed().catch(console.error);
