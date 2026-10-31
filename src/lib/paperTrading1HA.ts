import { getDb } from "./mongodb";

export interface Paper1HATrade {
  id: string;
  coin: string;
  side: "BUY" | "SELL" | "LONG" | "SHORT";
  timeframe: string;
  entry_time: string;
  exit_time: string;
  exit_type: "TP" | "BE" | "SL" | "TIME";
  R_gross: number;
  cost_R_taker: number;
  cost_R_maker: number;
  R_net_taker: number;
  R_net_maker: number;
  year_month: string;
}

export interface Paper1HAMetrics {
  totalTrades: number;
  cumulativeNetR: number;
  avgNetR: number;
  ciLower: number;
  ciUpper: number;
  trueWinRate: number;
  netWinRate: number;
  netProfitFactor: number;
  maxDrawdown: number;
  targetTrades: number;
  perCoin: {
    coin: string;
    trades: number;
    trueWinRate: number;
    avgNetR: number;
    netProfitFactor: number;
  }[];
}

export async function getPaper1HAMetrics(): Promise<{ metrics: Paper1HAMetrics; trades: Paper1HATrade[] }> {
  const db = await getDb();
  let trades: Paper1HATrade[] = [];

  if (db) {
    try {
      const docs = await db.collection("paper_1h_a").find({}).sort({ entry_time: -1 }).toArray();
      trades = docs.map((d: any) => ({
        id: d.id || d._id.toString(),
        coin: d.coin,
        side: d.side || "BUY",
        timeframe: d.timeframe || "1h",
        entry_time: d.entry_time,
        exit_time: d.exit_time,
        exit_type: d.exit_type || "CLOSED",
        R_gross: d.R_gross || 0,
        cost_R_taker: d.cost_R_taker || 0,
        cost_R_maker: d.cost_R_maker || 0,
        R_net_taker: d.R_net_taker || 0,
        R_net_maker: d.R_net_maker || 0,
        year_month: d.year_month || "",
      }));
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
        trueWinRate: 0,
        netWinRate: 0,
        netProfitFactor: 0,
        maxDrawdown: 0,
        targetTrades: 300,
        perCoin: [],
      },
      trades: [],
    };
  }

  let tpCount = 0;
  let slCount = 0;
  let netWins = 0;
  let totalNetR = 0;
  let netWinsR = 0;
  let netLossesR = 0;

  const coinMap: { [key: string]: { trades: number; tp: number; sl: number; netR: number; posR: number; negR: number } } = {};

  for (const t of trades) {
    const netR = t.R_net_taker;
    totalNetR += netR;

    if (!coinMap[t.coin]) {
      coinMap[t.coin] = { trades: 0, tp: 0, sl: 0, netR: 0, posR: 0, negR: 0 };
    }
    const cObj = coinMap[t.coin];
    cObj.trades++;
    cObj.netR += netR;

    if (t.exit_type === "TP") {
      tpCount++;
      cObj.tp++;
    } else if (t.exit_type === "SL") {
      slCount++;
      cObj.sl++;
    }

    if (netR > 0) {
      netWins++;
      netWinsR += netR;
      cObj.posR += netR;
    } else {
      netLossesR += Math.abs(netR);
      cObj.negR += Math.abs(netR);
    }
  }

  const trueWinRate = tpCount + slCount > 0 ? Number(((tpCount / (tpCount + slCount)) * 100).toFixed(1)) : 0;
  const netWinRate = Number(((netWins / n) * 100).toFixed(1));
  const avgNetR = Number((totalNetR / n).toFixed(4));
  const cumulativeNetR = Number(totalNetR.toFixed(2));
  const netProfitFactor = netLossesR > 0 ? Number((netWinsR / netLossesR).toFixed(2)) : 9.99;

  // Monthly block bootstrap 95% CI pre-computed from empirical study
  // 1H-A: [-0.0052, +0.0856]
  const ciLower = -0.0052;
  const ciUpper = 0.0856;

  // Max Drawdown calculation
  let peak = 0;
  let maxDD = 0;
  let cum = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    cum += trades[i].R_net_taker;
    if (cum > peak) peak = cum;
    const dd = peak > 0 ? ((cum - peak) / peak) * 100 : 0;
    if (dd < maxDD) maxDD = dd;
  }

  const perCoin = Object.keys(coinMap).map((coin) => {
    const item = coinMap[coin];
    const wr = item.tp + item.sl > 0 ? Number(((item.tp / (item.tp + item.sl)) * 100).toFixed(1)) : 0;
    const pf = item.negR > 0 ? Number((item.posR / item.negR).toFixed(2)) : 9.99;
    return {
      coin,
      trades: item.trades,
      trueWinRate: wr,
      avgNetR: Number((item.netR / item.trades).toFixed(4)),
      netProfitFactor: pf,
    };
  });

  return {
    metrics: {
      totalTrades: n,
      cumulativeNetR,
      avgNetR,
      ciLower,
      ciUpper,
      trueWinRate,
      netWinRate,
      netProfitFactor,
      maxDrawdown: Number(maxDD.toFixed(1)),
      targetTrades: 300,
      perCoin,
    },
    trades: trades.slice(0, 50),
  };
}
