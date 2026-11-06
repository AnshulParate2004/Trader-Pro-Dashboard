import { getDb } from "./mongodb";

export interface Paper1HATrade {
  id: string;
  coin: string;
  side: "BUY" | "SELL" | "LONG" | "SHORT";
  timeframe: string;
  entry_time: string;
  exit_time: string;
  exit_type: "TP" | "BE" | "SL" | "TIME" | string;
  R_gross: number;
  cost_R_taker: number;
  cost_R_maker: number;
  R_net_taker: number;
  R_net_maker: number;
  year_month: string;
  // Strict-adjusted shadow accounting
  R_gross_strict: number;
  R_net_strict: number;
}

export interface Paper1HAMetrics {
  totalTrades: number;
  // Optimistic accounting (current frozen paper logic)
  cumulativeNetR: number;
  avgNetR: number;
  ciLower: number;
  ciUpper: number;
  // Strict-adjusted accounting (shadow metric: BE gross=0.00R, fees charged)
  strictCumulativeNetR: number;
  strictAvgNetR: number;
  strictCiLower: number;
  strictCiUpper: number;
  beTradesCount: number;
  beFeeInflationTotalR: number;
  inflationPerTradeR: number;
  trueWinRate: number;
  netWinRate: number;
  netProfitFactor: number;
  strictNetProfitFactor: number;
  maxDrawdown: number;
  strictMaxDrawdown: number;
  targetTrades: number;
  isLiveDataSource: boolean;
  perCoin: {
    coin: string;
    trades: number;
    trueWinRate: number;
    avgNetR: number;
    strictAvgNetR: number;
    netProfitFactor: number;
    strictNetProfitFactor: number;
  }[];
}

export interface BacktestHoldoutBTC {
  label: string;
  window: string;
  trades: number;
  trueWinRate: number;
  avgNetR: number;
  strictAvgNetR: number;
  ciLower: number;
  ciUpper: number;
  netProfitFactor: number;
  cumulativeNetR: number;
}

export const BACKTEST_HOLDOUT_BTC: BacktestHoldoutBTC = {
  label: "Backtest hold-out (2024-05 to 2026-10)",
  window: "2024-05-01 to 2026-10-27",
  trades: 104,
  trueWinRate: 62.7,
  avgNetR: 0.0669,
  strictAvgNetR: 0.0076,
  ciLower: -0.065,
  ciUpper: 0.197,
  netProfitFactor: 1.33,
  cumulativeNetR: 6.96,
};

export async function getPaper1HAMetrics(): Promise<{
  metrics: Paper1HAMetrics;
  trades: Paper1HATrade[];
  backtestHoldout: BacktestHoldoutBTC;
}> {
  const db = await getDb();
  let trades: Paper1HATrade[] = [];
  let isLive = false;

  if (db) {
    try {
      // 1. First check live paper trading collection
      let docs = await db.collection("paper_1h_a").find({}).sort({ entry_time: -1 }).toArray();
      if (docs.length > 0) {
        isLive = true;
      } else {
        // Fall back to historical hold-out collection if live paper trades are still pending
        docs = await db.collection("backtest_holdout_1h_a").find({}).sort({ entry_time: -1 }).toArray();
      }

      trades = docs.map((d: any) => {
        const gross = d.R_gross !== undefined ? d.R_gross : (d.gross_r !== undefined ? d.gross_r : 0);
        const costTaker = d.cost_R_taker || 0;
        const optNet = d.R_net_taker !== undefined ? d.R_net_taker : (d.net_r !== undefined ? d.net_r : 0);
        const exitType = d.exit_type || "CLOSED";
        // Strict shadow: BE exit prices at 0.00R gross with fees charged
        const strictGross = exitType === "BE" ? 0.0 : gross;
        const strictNet = Number((strictGross - costTaker).toFixed(4));

        return {
          id: d.id || d._id.toString(),
          coin: d.coin,
          side: d.side || "BUY",
          timeframe: d.timeframe || "1h",
          entry_time: d.entry_time,
          exit_time: d.exit_time,
          exit_type: exitType,
          R_gross: gross,
          cost_R_taker: costTaker,
          cost_R_maker: d.cost_R_maker || 0,
          R_net_taker: optNet,
          R_net_maker: d.R_net_maker || 0,
          year_month: d.year_month || "",
          R_gross_strict: strictGross,
          R_net_strict: strictNet,
        };
      });
    } catch (err) {
      console.warn("MongoDB paper_1h_a fetch error:", err);
    }
  }

  const n = trades.length;
  if (n === 0) {
    return {
      metrics: {
        totalTrades: 0,
        cumulativeNetR: 0,
        avgNetR: 0,
        ciLower: 0,
        ciUpper: 0,
        strictCumulativeNetR: 0,
        strictAvgNetR: 0,
        strictCiLower: 0,
        strictCiUpper: 0,
        beTradesCount: 0,
        beFeeInflationTotalR: 0,
        inflationPerTradeR: 0,
        trueWinRate: 0,
        netWinRate: 0,
        netProfitFactor: 0,
        strictNetProfitFactor: 0,
        maxDrawdown: 0,
        strictMaxDrawdown: 0,
        targetTrades: 300,
        isLiveDataSource: false,
        perCoin: [],
      },
      trades: [],
      backtestHoldout: BACKTEST_HOLDOUT_BTC,
    };
  }

  let tpCount = 0;
  let slCount = 0;
  let beCount = 0;
  let netWins = 0;
  let totalNetR = 0;
  let totalStrictNetR = 0;
  let netWinsR = 0;
  let netLossesR = 0;
  let strictWinsR = 0;
  let strictLossesR = 0;

  const coinMap: {
    [key: string]: {
      trades: number;
      tp: number;
      sl: number;
      be: number;
      netR: number;
      strictNetR: number;
      posR: number;
      negR: number;
      strictPosR: number;
      strictNegR: number;
    };
  } = {};

  for (const t of trades) {
    const netR = t.R_net_taker;
    const strictNet = t.R_net_strict;

    totalNetR += netR;
    totalStrictNetR += strictNet;

    if (!coinMap[t.coin]) {
      coinMap[t.coin] = {
        trades: 0,
        tp: 0,
        sl: 0,
        be: 0,
        netR: 0,
        strictNetR: 0,
        posR: 0,
        negR: 0,
        strictPosR: 0,
        strictNegR: 0,
      };
    }
    const cObj = coinMap[t.coin];
    cObj.trades++;
    cObj.netR += netR;
    cObj.strictNetR += strictNet;

    if (t.exit_type === "TP") {
      tpCount++;
      cObj.tp++;
    } else if (t.exit_type === "SL") {
      slCount++;
      cObj.sl++;
    } else if (t.exit_type === "BE") {
      beCount++;
      cObj.be++;
    }

    if (netR > 0) {
      netWins++;
      netWinsR += netR;
      cObj.posR += netR;
    } else {
      netLossesR += Math.abs(netR);
      cObj.negR += Math.abs(netR);
    }

    if (strictNet > 0) {
      strictWinsR += strictNet;
      cObj.strictPosR += strictNet;
    } else {
      strictLossesR += Math.abs(strictNet);
      cObj.strictNegR += Math.abs(strictNet);
    }
  }

  const trueWinRate = tpCount + slCount > 0 ? Number(((tpCount / (tpCount + slCount)) * 100).toFixed(1)) : 0;
  const netWinRate = Number(((netWins / n) * 100).toFixed(1));
  const avgNetR = Number((totalNetR / n).toFixed(4));
  const cumulativeNetR = Number(totalNetR.toFixed(2));
  const strictAvgNetR = Number((totalStrictNetR / n).toFixed(4));
  const strictCumulativeNetR = Number(totalStrictNetR.toFixed(2));
  const beFeeInflationTotalR = Number((totalNetR - totalStrictNetR).toFixed(2));
  const inflationPerTradeR = Number(((totalNetR - totalStrictNetR) / n).toFixed(4));

  const netProfitFactor = netLossesR > 0 ? Number((netWinsR / netLossesR).toFixed(2)) : 9.99;
  const strictNetProfitFactor = strictLossesR > 0 ? Number((strictWinsR / strictLossesR).toFixed(2)) : 9.99;

  // Monthly block bootstrap 95% CI pre-computed from empirical study
  // Optimistic: [-0.0052, +0.0856]
  const ciLower = -0.0052;
  const ciUpper = 0.0856;
  // Strict shadow: [-0.0503, +0.0351]
  const strictCiLower = -0.0503;
  const strictCiUpper = 0.0351;

  // Max Drawdown calculation (Optimistic)
  let peak = 0;
  let maxDD = 0;
  let cum = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    cum += trades[i].R_net_taker;
    if (cum > peak) peak = cum;
    const dd = peak > 0 ? ((cum - peak) / peak) * 100 : 0;
    if (dd < maxDD) maxDD = dd;
  }

  // Max Drawdown calculation (Strict Shadow)
  let strictPeak = 0;
  let strictMaxDD = 0;
  let strictCum = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    strictCum += trades[i].R_net_strict;
    if (strictCum > strictPeak) strictPeak = strictCum;
    const dd = strictPeak > 0 ? ((strictCum - strictPeak) / strictPeak) * 100 : 0;
    if (dd < strictMaxDD) strictMaxDD = dd;
  }

  const perCoin = Object.keys(coinMap).map((coin) => {
    const item = coinMap[coin];
    const wr = item.tp + item.sl > 0 ? Number(((item.tp / (item.tp + item.sl)) * 100).toFixed(1)) : 0;
    const pf = item.negR > 0 ? Number((item.posR / item.negR).toFixed(2)) : 9.99;
    const strictPf = item.strictNegR > 0 ? Number((item.strictPosR / item.strictNegR).toFixed(2)) : 9.99;
    return {
      coin,
      trades: item.trades,
      trueWinRate: wr,
      avgNetR: Number((item.netR / item.trades).toFixed(4)),
      strictAvgNetR: Number((item.strictNetR / item.trades).toFixed(4)),
      netProfitFactor: pf,
      strictNetProfitFactor: strictPf,
    };
  });

  return {
    metrics: {
      totalTrades: n,
      cumulativeNetR,
      avgNetR,
      ciLower,
      ciUpper,
      strictCumulativeNetR,
      strictAvgNetR,
      strictCiLower,
      strictCiUpper,
      beTradesCount: beCount,
      beFeeInflationTotalR,
      inflationPerTradeR,
      trueWinRate,
      netWinRate,
      netProfitFactor,
      strictNetProfitFactor,
      maxDrawdown: Number(maxDD.toFixed(1)),
      strictMaxDrawdown: Number(strictMaxDD.toFixed(1)),
      targetTrades: 300,
      isLiveDataSource: isLive,
      perCoin,
    },
    trades: trades.slice(0, 50),
    backtestHoldout: BACKTEST_HOLDOUT_BTC,
  };
}
