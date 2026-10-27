import { getDb, isMongoConfigured } from "./mongodb";

export interface TradeOrder {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  orderType: "TAKER" | "MAKER";
  entryPrice: number;
  exitPrice?: number;
  positionSizeINR: number;
  coins: number;
  feePercentage: number; // Shark Exchange fee: 0.040% Taker / 0.016% Maker
  gstPercentage: number; // 18% GST on Indian derivatives exchanges
  entryFeeINR: number;
  exitFeeINR?: number;
  totalFeeINR: number; // Including 18% GST
  grossPnLINR?: number;
  netPnLINR?: number;
  stopLoss: number;
  breakevenTrigger: number;
  breakevenLocked: number;
  breakevenActivated: boolean;
  takeProfit1: number;
  takeProfit2: number;
  status: "ACTIVE" | "BE_ACTIVATED" | "TP1_HIT" | "TP2_HIT" | "SL_HIT" | "CLOSED";
  exitReason?: string;
  triggerReason: string;
  openedAt: number;
  closedAt?: number;
}

export interface EngineConfig {
  autoTradingEnabled: boolean;
  currency: "INR";
  accountBalanceINR: number; // Artificial ₹1,000 starting capital
  tradingFeePercent: number; // Shark Exchange Taker: 0.040%
  makerFeePercent: number;   // Shark Exchange Maker: 0.016%
  gstPercent: number;        // 18% GST on trading fees
  riskPerTradePercent: number; // 1% risk = ₹10 per scalp
  ratchetEnabled: boolean;
  maxConcurrentTrades: number;
}

export interface EnginePerformanceMetrics {
  totalTrades: number;
  activeTradesCount: number;
  closedTradesCount: number;
  winningTrades: number;
  losingTrades: number;
  currentBalanceINR: number;
  grossProfitINR: number;
  grossLossINR: number;
  totalFeesPaidINR: number;
  netPnLINR: number;
  profitFactor: number;
  averageTradeINR: number;
  feeImpactPercent: number;
}

// Shark Exchange Fee Calculations (0.040% Taker, 0.016% Maker, 18% Indian GST)
export function calculateSharkExchangeFees(
  entrySizeINR: number,
  exitSizeINR: number,
  orderType: "TAKER" | "MAKER" = "TAKER",
  feePercentOverride?: number
): {
  baseFeeRate: number;
  entryFeeINR: number;
  exitFeeINR: number;
  gstAmountINR: number;
  totalFeeWithGST_INR: number;
} {
  const baseRate = feePercentOverride ?? (orderType === "TAKER" ? 0.040 : 0.016);
  const baseRateDecimal = baseRate / 100;
  const gstRate = 0.18; // 18% GST

  const rawEntryFee = entrySizeINR * baseRateDecimal;
  const rawExitFee = exitSizeINR * baseRateDecimal;
  const rawTotalFee = rawEntryFee + rawExitFee;

  const gstAmount = rawTotalFee * gstRate;
  const totalWithGST = rawTotalFee + gstAmount;

  return {
    baseFeeRate: baseRate,
    entryFeeINR: Number((rawEntryFee * 1.18).toFixed(4)),
    exitFeeINR: Number((rawExitFee * 1.18).toFixed(4)),
    gstAmountINR: Number(gstAmount.toFixed(4)),
    totalFeeWithGST_INR: Number(totalWithGST.toFixed(4)),
  };
}

// In-Memory initial state (₹1,000 INR Artificial Paper Capital)
const INITIAL_BALANCE_INR = 1000;

let memoryConfig: EngineConfig = {
  autoTradingEnabled: true,
  currency: "INR",
  accountBalanceINR: INITIAL_BALANCE_INR,
  tradingFeePercent: 0.040, // Shark Exchange Taker Fee (0.040%)
  makerFeePercent: 0.016,   // Shark Exchange Maker Fee (0.016%)
  gstPercent: 18.0,         // 18% GST
  riskPerTradePercent: 1.0, // 1% risk = ₹10 on ₹1,000
  ratchetEnabled: true,
  maxConcurrentTrades: 2,
};

// Empty initial state: strictly no mock/fake trades when data is not available
let memoryTrades: TradeOrder[] = [];

// Get Engine Configuration
export async function getEngineConfig(): Promise<EngineConfig> {
  const db = await getDb();
  if (db) {
    try {
      const config = await db.collection("engine_config").findOne({ id: "shark_engine_config" });
      if (config) {
        return {
          autoTradingEnabled: Boolean(config.autoTradingEnabled),
          currency: "INR",
          accountBalanceINR: Number(config.accountBalanceINR || INITIAL_BALANCE_INR),
          tradingFeePercent: Number(config.tradingFeePercent || 0.040),
          makerFeePercent: Number(config.makerFeePercent || 0.016),
          gstPercent: Number(config.gstPercent || 18.0),
          riskPerTradePercent: Number(config.riskPerTradePercent || 1.0),
          ratchetEnabled: config.ratchetEnabled !== false,
          maxConcurrentTrades: Number(config.maxConcurrentTrades || 2),
        };
      } else {
        // Initialize Shark Exchange default in DB
        await db.collection("engine_config").insertOne({
          id: "shark_engine_config",
          ...memoryConfig,
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      console.warn("MongoDB config error, using memory config:", err);
    }
  }
  return memoryConfig;
}

// Update Engine Configuration
export async function updateEngineConfig(updates: Partial<EngineConfig>): Promise<EngineConfig> {
  memoryConfig = { ...memoryConfig, ...updates };

  const db = await getDb();
  if (db) {
    try {
      await db.collection("engine_config").updateOne(
        { id: "shark_engine_config" },
        { $set: { ...memoryConfig, updatedAt: Date.now() } },
        { upsert: true }
      );
    } catch (err) {
      console.warn("MongoDB config update error:", err);
    }
  }

  return memoryConfig;
}

// Get Trade Logs
export async function getTradeLogs(limit: number = 50): Promise<TradeOrder[]> {
  const db = await getDb();
  if (db) {
    try {
      const trades = await db
        .collection("trade_logs")
        .find({})
        .sort({ openedAt: -1 })
        .limit(limit)
        .toArray();

      if (trades && trades.length > 0) {
        return trades.map((t: any) => ({
          id: t.id || t._id.toString(),
          symbol: t.symbol,
          direction: t.direction,
          orderType: t.orderType || "TAKER",
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice,
          positionSizeINR: t.positionSizeINR,
          coins: t.coins,
          feePercentage: t.feePercentage || 0.040,
          gstPercentage: t.gstPercentage || 18.0,
          entryFeeINR: t.entryFeeINR,
          exitFeeINR: t.exitFeeINR,
          totalFeeINR: t.totalFeeINR,
          grossPnLINR: t.grossPnLINR,
          netPnLINR: t.netPnLINR,
          stopLoss: t.stopLoss,
          breakevenTrigger: t.breakevenTrigger,
          breakevenLocked: t.breakevenLocked,
          breakevenActivated: t.breakevenActivated,
          takeProfit1: t.takeProfit1,
          takeProfit2: t.takeProfit2,
          status: t.status,
          exitReason: t.exitReason,
          triggerReason: t.triggerReason,
          openedAt: t.openedAt,
          closedAt: t.closedAt,
        }));
      }
    } catch (err) {
      console.warn("MongoDB trade logs fetch error, returning memory trades:", err);
    }
  }

  return [...memoryTrades].sort((a, b) => b.openedAt - a.openedAt);
}

// Execute New Automated Trade Order sized on ₹1,000 INR
export async function executeNewTrade(params: {
  symbol: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  atr: number;
  triggerReason: string;
  orderType?: "TAKER" | "MAKER";
  customFeePercent?: number;
}): Promise<TradeOrder> {
  const config = await getEngineConfig();
  const orderType = params.orderType || "TAKER";
  const feePercent = params.customFeePercent ?? (orderType === "TAKER" ? config.tradingFeePercent : config.makerFeePercent);

  // Position sizing on ₹1,000 INR capital:
  // 1% risk of ₹1,000 = ₹10.00 max risk per scalp
  const riskAmountINR = (config.accountBalanceINR * config.riskPerTradePercent) / 100; // ₹10.00
  const positionSizeINR = config.accountBalanceINR; // Scalp position sized to virtual margin ₹1,000

  // Calculate fees according to Shark Exchange (0.040% Taker + 18% GST)
  const feeCalc = calculateSharkExchangeFees(positionSizeINR, positionSizeINR, orderType, feePercent);

  // Stop loss and breakeven ratchet
  const sl = params.direction === "LONG"
    ? params.entryPrice - 1.0 * params.atr
    : params.entryPrice + 1.0 * params.atr;

  const beTrigger = params.direction === "LONG"
    ? params.entryPrice + 0.30 * params.atr
    : params.entryPrice - 0.30 * params.atr;

  const beLocked = params.direction === "LONG"
    ? params.entryPrice + 0.05 * params.atr
    : params.entryPrice - 0.05 * params.atr;

  const tp1 = params.direction === "LONG"
    ? params.entryPrice + 1.0 * params.atr
    : params.entryPrice - 1.0 * params.atr;

  const tp2 = params.direction === "LONG"
    ? params.entryPrice + 1.5 * params.atr
    : params.entryPrice - 1.5 * params.atr;

  const newTrade: TradeOrder = {
    id: `trade-shark-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    symbol: params.symbol,
    direction: params.direction,
    orderType,
    entryPrice: params.entryPrice,
    positionSizeINR,
    coins: Number((positionSizeINR / (params.entryPrice * 88.5)).toFixed(6)), // approx BTC/INR coins
    feePercentage: feePercent,
    gstPercentage: config.gstPercent,
    entryFeeINR: feeCalc.entryFeeINR,
    totalFeeINR: feeCalc.entryFeeINR,
    stopLoss: sl,
    breakevenTrigger: beTrigger,
    breakevenLocked: beLocked,
    breakevenActivated: false,
    takeProfit1: tp1,
    takeProfit2: tp2,
    status: "ACTIVE",
    triggerReason: params.triggerReason,
    openedAt: Date.now(),
  };

  memoryTrades.unshift(newTrade);

  const db = await getDb();
  if (db) {
    try {
      await db.collection("trade_logs").insertOne({ ...newTrade });
    } catch (err) {
      console.warn("MongoDB trade insert error:", err);
    }
  }

  return newTrade;
}

// Close an Existing Trade and compute Shark Exchange Fees & Net PnL in INR
export async function closeTrade(tradeId: string, exitPrice: number, reason: string): Promise<TradeOrder | null> {
  const trades = await getTradeLogs();
  const trade = trades.find((t) => t.id === tradeId);
  if (!trade || trade.status === "CLOSED") return null;

  // Price change ratio
  const priceChangeRatio = (exitPrice - trade.entryPrice) / trade.entryPrice;
  const rawGrossPnL = trade.direction === "LONG"
    ? trade.positionSizeINR * priceChangeRatio
    : trade.positionSizeINR * (-priceChangeRatio);

  const exitSizeINR = trade.positionSizeINR + rawGrossPnL;
  const feeCalc = calculateSharkExchangeFees(trade.positionSizeINR, exitSizeINR, trade.orderType, trade.feePercentage);

  const grossPnLINR = Number(rawGrossPnL.toFixed(2));
  const netPnLINR = Number((rawGrossPnL - feeCalc.totalFeeWithGST_INR).toFixed(2));

  trade.exitPrice = exitPrice;
  trade.exitFeeINR = feeCalc.exitFeeINR;
  trade.totalFeeINR = feeCalc.totalFeeWithGST_INR;
  trade.grossPnLINR = grossPnLINR;
  trade.netPnLINR = netPnLINR;
  trade.status = "CLOSED";
  trade.exitReason = reason;
  trade.closedAt = Date.now();

  const memIdx = memoryTrades.findIndex((t) => t.id === tradeId);
  if (memIdx !== -1) {
    memoryTrades[memIdx] = { ...trade };
  }

  const db = await getDb();
  if (db) {
    try {
      await db.collection("trade_logs").updateOne(
        { id: tradeId },
        {
          $set: {
            exitPrice,
            exitFeeINR: feeCalc.exitFeeINR,
            totalFeeINR: feeCalc.totalFeeWithGST_INR,
            grossPnLINR,
            netPnLINR,
            status: "CLOSED",
            exitReason: reason,
            closedAt: trade.closedAt,
          },
        }
      );
    } catch (err) {
      console.warn("MongoDB trade update error:", err);
    }
  }

  return trade;
}

// Compute Engine Performance in INR
export async function computePerformanceMetrics(): Promise<EnginePerformanceMetrics> {
  const trades = await getTradeLogs(500);

  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      activeTradesCount: 0,
      closedTradesCount: 0,
      winningTrades: 0,
      losingTrades: 0,
      currentBalanceINR: INITIAL_BALANCE_INR,
      grossProfitINR: 0,
      grossLossINR: 0,
      totalFeesPaidINR: 0,
      netPnLINR: 0,
      profitFactor: 0,
      averageTradeINR: 0,
      feeImpactPercent: 0,
    };
  }

  let activeCount = 0;
  let closedCount = 0;
  let winCount = 0;
  let lossCount = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalFees = 0;
  let netPnL = 0;

  for (const t of trades) {
    totalFees += t.totalFeeINR || 0;
    if (t.status === "ACTIVE" || t.status === "BE_ACTIVATED") {
      activeCount++;
    } else {
      closedCount++;
      const gross = t.grossPnLINR || 0;
      const net = t.netPnLINR || 0;

      if (net > 0) {
        winCount++;
        grossProfit += gross;
      } else if (net < 0) {
        lossCount++;
        grossLoss += Math.abs(gross);
      }
      netPnL += net;
    }
  }

  const currentBalance = INITIAL_BALANCE_INR + netPnL;
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 9.99 : 1.0;
  const averageTradeINR = closedCount > 0 ? Number((netPnL / closedCount).toFixed(2)) : 0;
  const feeImpactPercent = grossProfit > 0 ? Number(((totalFees / grossProfit) * 100).toFixed(1)) : 0;

  return {
    totalTrades: trades.length,
    activeTradesCount: activeCount,
    closedTradesCount: closedCount,
    winningTrades: winCount,
    losingTrades: lossCount,
    currentBalanceINR: Number(currentBalance.toFixed(2)),
    grossProfitINR: Number(grossProfit.toFixed(2)),
    grossLossINR: Number(grossLoss.toFixed(2)),
    totalFeesPaidINR: Number(totalFees.toFixed(2)),
    netPnLINR: Number(netPnL.toFixed(2)),
    profitFactor,
    averageTradeINR,
    feeImpactPercent,
  };
}
