const { MongoClient } = require('D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/node_modules/mongodb');
const uri = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority";

async function check() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('that');
  const trades = await db.collection('trade_logs').find().toArray();
  
  let tpCount = 0, beCount = 0, slCount = 0;
  let netWins = 0;
  let totalNetPnL = 0, totalFees = 0;
  let netRList = [];

  for (const t of trades) {
    const gross = t.grossPnLINR !== undefined ? t.grossPnLINR : 0;
    // Taker 0.04% + 18% GST (0.0472%) + 0.01% slip = 0.0572% per side = 0.1144% round-trip
    const pos = t.positionSizeINR || 1000;
    const fee = Number((pos * 0.001144).toFixed(2));
    const net = Number((gross - fee).toFixed(2));
    const rNet = Number((net / 10).toFixed(3)); // 1% risk of 1000 = 10 INR
    netRList.push(rNet);

    totalFees += fee;
    totalNetPnL += net;
    if (net > 0) netWins++;

    const reason = (t.exitReason || '').toUpperCase();
    if (reason.includes('TP') || reason.includes('TAKE_PROFIT') || gross >= 6) tpCount++;
    else if (reason.includes('BE') || reason.includes('RATCHET') || reason.includes('BREAKEVEN') || (gross > 0 && gross < 5)) beCount++;
    else slCount++;
  }

  const trueWR = tpCount + slCount > 0 ? (tpCount / (tpCount + slCount) * 100).toFixed(1) : 'N/A';
  const netWR = (netWins / trades.length * 100).toFixed(1);
  const avgNetR = (netRList.reduce((a,b)=>a+b, 0) / trades.length).toFixed(3);
  
  const posNet = trades.filter(t => (t.grossPnLINR - (t.positionSizeINR||1000)*0.001144) > 0).reduce((acc, t) => acc + (t.grossPnLINR - (t.positionSizeINR||1000)*0.001144), 0);
  const negNet = Math.abs(trades.filter(t => (t.grossPnLINR - (t.positionSizeINR||1000)*0.001144) < 0).reduce((acc, t) => acc + (t.grossPnLINR - (t.positionSizeINR||1000)*0.001144), 0));
  const netPF = negNet > 0 ? (posNet / negNet).toFixed(2) : 'N/A';

  console.log('=== HONEST LIVE SESSION METRICS (31 TRADES, OCT 28-31) ===');
  console.log('Total Trades:', trades.length);
  console.log('TP / BE / SL Split:', `${tpCount} (${(tpCount/trades.length*100).toFixed(1)}%) / ${beCount} (${(beCount/trades.length*100).toFixed(1)}%) / ${slCount} (${(slCount/trades.length*100).toFixed(1)}%)`);
  console.log('True Win Rate (TP/(TP+SL)):', trueWR + '%');
  console.log('Net Win Rate (Net PnL > 0):', netWR + '%');
  console.log('Avg Net R per Trade:', avgNetR + ' R');
  console.log('Net Profit Factor:', netPF);
  console.log('Total Fees Paid (with GST + Slip):', '₹' + totalFees.toFixed(2));
  console.log('Total Net PnL:', '₹' + totalNetPnL.toFixed(2));
  await client.close();
}
check();
