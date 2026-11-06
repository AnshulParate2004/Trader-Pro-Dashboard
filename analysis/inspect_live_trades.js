const fs = require('fs');
const { MongoClient } = require('mongodb');

let uri = '';
if (fs.existsSync('.env.local')) {
  const envText = fs.readFileSync('.env.local', 'utf8');
  for (const line of envText.split('\n')) {
    if (line.startsWith('MONGODB_URI=')) {
      uri = line.substring('MONGODB_URI='.length).trim();
    }
  }
}

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const trades = await db.collection('trade_logs').find({}).toArray();
  
  console.log('Total live trades:', trades.length);
  if (trades.length === 0) return;
  
  let netRs = [];
  let grossRs = [];
  let exitReasons = {};
  let totalGrossINR = 0;
  let totalNetINR = 0;
  let totalFeesINR = 0;
  
  const dates = trades.map(t => t.openedAt).filter(Boolean);
  const minDate = new Date(Math.min(...dates)).toISOString();
  const maxDate = new Date(Math.max(...dates)).toISOString();
  console.log('Date range:', minDate, 'to', maxDate);
  
  for (const t of trades) {
    const reason = t.exitReason || 'UNKNOWN';
    exitReasons[reason] = (exitReasons[reason] || 0) + 1;
    totalGrossINR += (t.grossPnLINR || 0);
    totalNetINR += (t.netPnLINR || 0);
    totalFeesINR += (t.totalFeeINR || 0);
    
    // In live trades, 1R = positionSize * (slDist / entryPrice)
    const slDist = Math.abs(t.entryPrice - t.stopLoss);
    const stopPct = slDist / t.entryPrice;
    const rUnitINR = t.positionSizeINR * stopPct;
    if (rUnitINR > 0) {
      const gR = (t.grossPnLINR || 0) / rUnitINR;
      const nR = (t.netPnLINR || 0) / rUnitINR;
      grossRs.push(gR);
      netRs.push(nR);
    }
  }
  
  console.log('Exit Reasons breakdown:');
  for (const [k, v] of Object.entries(exitReasons)) {
    console.log(`  ${k}: ${v} (${(v / trades.length * 100).toFixed(1)}%)`);
  }
  
  const meanGrossR = grossRs.reduce((a, b) => a + b, 0) / grossRs.length;
  const meanNetR = netRs.reduce((a, b) => a + b, 0) / netRs.length;
  console.log('Mean Gross R:', meanGrossR.toFixed(4) + ' R');
  console.log('Mean Net R:', meanNetR.toFixed(4) + ' R');
  console.log('Total Gross PnL (INR): ₹' + totalGrossINR.toFixed(2));
  console.log('Total Net PnL (INR): ₹' + totalNetINR.toFixed(2));
  console.log('Total Fees Paid (INR): ₹' + totalFeesINR.toFixed(2));
  
  await client.close();
}
run().catch(console.error);
