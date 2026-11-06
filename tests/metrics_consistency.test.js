const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Import or reference computeMetricsPure
function computeMetricsPure(rawTrades, feeRate = 0.040, gstPercent = 18.0) {
  const gstRate = gstPercent / 100;
  const isTaker = feeRate > 0.020;
  const slipRate = isTaker ? 0.0001 : 0.00005;

  let activeCount = 0;
  let closedCount = 0;
  let winCount = 0;
  let lossCount = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalExchangeFees = 0;
  let totalSlippage = 0;
  let netWinsINR = 0;
  let netLossesINR = 0;
  let totalNetR = 0;

  let tpCount = 0;
  let beCount = 0;
  let slCount = 0;

  for (const t of rawTrades) {
    if (t.status === "ACTIVE" || t.status === "BE_ACTIVATED") {
      activeCount++;
      continue;
    }

    closedCount++;
    const pos = t.positionSizeINR || 1000;
    const gross = t.grossPnLINR !== undefined ? t.grossPnLINR : 0;
    const exitPos = pos + gross;

    const entryFee = Number((pos * (feeRate / 100) * (1 + gstRate)).toFixed(4));
    const exitFee = Number((exitPos * (feeRate / 100) * (1 + gstRate)).toFixed(4));
    const entrySlip = Number((pos * slipRate).toFixed(4));
    const exitSlip = Number((exitPos * slipRate).toFixed(4));

    const tradeExchangeFee = entryFee + exitFee;
    const tradeSlippage = entrySlip + exitSlip;
    const tradeTotalCost = tradeExchangeFee + tradeSlippage;
    const net = Number((gross - tradeTotalCost).toFixed(2));

    totalExchangeFees += tradeExchangeFee;
    totalSlippage += tradeSlippage;

    if (gross > 0) {
      grossProfit += gross;
    } else if (gross < 0) {
      grossLoss += Math.abs(gross);
    }

    if (net > 0) {
      winCount++;
      netWinsINR += net;
    } else {
      lossCount++;
      netLossesINR += Math.abs(net);
    }

    const oneR = pos * 0.01;
    const rVal = oneR > 0 ? net / oneR : 0;
    totalNetR += rVal;

    const reason = (t.exitReason || t.actionReason || "").toUpperCase();
    if (reason.includes("TAKE PROFIT") || reason.includes("TAKE_PROFIT") || reason.includes("TP")) {
      tpCount++;
    } else if (reason.includes("BREAKEVEN") || reason.includes("RATCHET") || reason.includes("BE")) {
      beCount++;
    } else {
      slCount++;
    }
  }

  const totalFeesPaidINR = Number(totalExchangeFees.toFixed(2));
  const slippagePaidINR = Number(totalSlippage.toFixed(2));
  const totalCostINR = Number((totalFeesPaidINR + slippagePaidINR).toFixed(2));
  const grossProfitINR = Number(grossProfit.toFixed(2));
  const grossLossINR = Number(grossLoss.toFixed(2));
  const totalGrossINR = Number((grossProfitINR - grossLossINR).toFixed(2));
  const netPnLINR = Number((totalGrossINR - totalCostINR).toFixed(2));
  const currentBalanceINR = Number((1000 + netPnLINR).toFixed(2));

  const trueWinRate = (tpCount + slCount) > 0 ? Number(((tpCount / (tpCount + slCount)) * 100).toFixed(1)) : 0;
  const netWinRate = closedCount > 0 ? Number(((winCount / closedCount) * 100).toFixed(1)) : 0;
  const tpPercent = closedCount > 0 ? Number(((tpCount / closedCount) * 100).toFixed(1)) : 0;
  const bePercent = closedCount > 0 ? Number(((beCount / closedCount) * 100).toFixed(1)) : 0;
  const slPercent = closedCount > 0 ? Number(((slCount / closedCount) * 100).toFixed(1)) : 0;

  const profitFactor = grossLossINR > 0 ? Number((grossProfitINR / grossLossINR).toFixed(2)) : (grossProfitINR > 0 ? 9.99 : 1.0);
  const netProfitFactor = netLossesINR > 0 ? Number((netWinsINR / netLossesINR).toFixed(2)) : (netWinsINR > 0 ? 9.99 : 1.0);
  const averageTradeINR = closedCount > 0 ? Number((netPnLINR / closedCount).toFixed(2)) : 0;
  const avgNetR = closedCount > 0 ? Number((totalNetR / closedCount).toFixed(3)) : 0;

  return {
    totalTrades: rawTrades.length,
    activeTradesCount: activeCount,
    closedTradesCount: closedCount,
    winningTrades: winCount,
    losingTrades: lossCount,
    tpCount,
    beCount,
    slCount,
    tpPercent,
    bePercent,
    slPercent,
    trueWinRate,
    netWinRate,
    grossProfitINR,
    grossLossINR,
    totalGrossINR,
    totalFeesPaidINR,
    slippagePaidINR,
    totalCostINR,
    netPnLINR,
    currentBalanceINR,
    profitFactor,
    netProfitFactor,
    avgNetR,
    averageTradeINR,
  };
}

describe('Dashboard Metric Consistency Unit Tests', () => {
  test('Displayed percentages must strictly match underlying integer counts (synthetic set)', () => {
    const mockTrades = [
      { status: 'CLOSED', positionSizeINR: 1000, grossPnLINR: 10, exitReason: 'Take Profit 1 Hit (+1.00R)' },
      { status: 'CLOSED', positionSizeINR: 1000, grossPnLINR: 10, exitReason: 'Take Profit 1 Hit (+1.00R)' },
      { status: 'CLOSED', positionSizeINR: 1000, grossPnLINR: 0.5, exitReason: 'Breakeven Hit (+0.05R)' },
      { status: 'CLOSED', positionSizeINR: 1000, grossPnLINR: -10, exitReason: 'Stop Loss Hit (-1.0R)' },
    ];

    const m = computeMetricsPure(mockTrades, 0.040);

    // Counts: 2 TP, 1 BE, 1 SL. Total = 4
    assert.equal(m.tpCount, 2);
    assert.equal(m.beCount, 1);
    assert.equal(m.slCount, 1);
    assert.equal(m.closedTradesCount, 4);

    // True Win Rate: TP / (TP + SL) = 2 / (2 + 1) = 66.7%
    const expectedTrueWinRate = Number(((2 / 3) * 100).toFixed(1));
    assert.equal(m.trueWinRate, expectedTrueWinRate, 'trueWinRate must match TP / (TP + SL)');

    // TP Split %: 2 / 4 = 50.0%
    assert.equal(m.tpPercent, 50.0, 'tpPercent must match tpCount / closedCount');

    // BE Split %: 1 / 4 = 25.0%
    assert.equal(m.bePercent, 25.0, 'bePercent must match beCount / closedCount');

    // SL Split %: 1 / 4 = 25.0%
    assert.equal(m.slPercent, 25.0, 'slPercent must match slCount / closedCount');

    // Sum of split percentages must equal 100%
    const splitSum = Number((m.tpPercent + m.bePercent + m.slPercent).toFixed(1));
    assert.equal(splitSum, 100.0, 'Split sum must equal 100%');

    // Net win rate: trades with net > 0 divided by 4
    const expectedNetWinRate = Number(((m.winningTrades / m.closedTradesCount) * 100).toFixed(1));
    assert.equal(m.netWinRate, expectedNetWinRate, 'netWinRate must match winningTrades / closedCount');
  });

  test('Mathematical identities must strictly balance (PnL, Balance, Fees, Slippage)', () => {
    const mockTrades = [
      { status: 'CLOSED', positionSizeINR: 3000, grossPnLINR: 15.0, exitReason: 'Take Profit 1 Hit (+1.00R)' },
      { status: 'CLOSED', positionSizeINR: 3000, grossPnLINR: -12.0, exitReason: 'Stop Loss Hit (-1.0R)' },
      { status: 'CLOSED', positionSizeINR: 3000, grossPnLINR: 0.48, exitReason: 'Breakeven Hit (+0.05R)' },
    ];

    const m = computeMetricsPure(mockTrades, 0.040);

    // Gross PnL identity: totalGross = grossProfit - grossLoss
    assert.equal(
      m.totalGrossINR,
      Number((m.grossProfitINR - m.grossLossINR).toFixed(2)),
      'totalGrossINR must equal grossProfitINR - grossLossINR'
    );

    // Total Cost identity: totalCost = totalFeesPaid + slippagePaid
    assert.equal(
      m.totalCostINR,
      Number((m.totalFeesPaidINR + m.slippagePaidINR).toFixed(2)),
      'totalCostINR must equal totalFeesPaidINR + slippagePaidINR'
    );

    // Net PnL identity: netPnL = totalGross - totalCost
    assert.equal(
      m.netPnLINR,
      Number((m.totalGrossINR - m.totalCostINR).toFixed(2)),
      'netPnLINR must equal totalGrossINR - totalCostINR'
    );

    // Balance identity: currentBalance = 1000 + netPnL
    assert.equal(
      m.currentBalanceINR,
      Number((1000 + m.netPnLINR).toFixed(2)),
      'currentBalanceINR must equal 1000 + netPnLINR'
    );

    // Win/Loss trade count identity: winningTrades + losingTrades = closedTradesCount
    assert.equal(
      m.winningTrades + m.losingTrades,
      m.closedTradesCount,
      'winningTrades + losingTrades must equal closedTradesCount'
    );
  });
});
