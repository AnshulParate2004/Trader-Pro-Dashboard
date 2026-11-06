const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('that');
    const lastTrade = await db.collection('trade_logs').findOne({}, { sort: { openedAt: -1 } });
    console.log('Last trade object:');
    console.log(JSON.stringify(lastTrade, null, 2));

    const trade31 = await db.collection('trade_logs').findOne({ id: 'trade-shark-1793447100000-31' });
    console.log('\nTrade 31:');
    console.log(JSON.stringify(trade31, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(console.error);
