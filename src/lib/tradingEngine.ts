import { getDb, isMongoConfigured } from "./mongodb";
export * from "./engineTypes";
import {
  AIStrategyModel,
  TOP_MODELS,
  TradeOrder,
  EngineConfig,
  EnginePerformanceMetrics,
} from "./engineTypes";

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
  maxConcurrentTrades: 1,
  activeModelId: "15m-sniper-030", // Default: Rank #1 15M Sniper Scalp (+0.30R Ratchet)
};

// Empty initial state: strictly no mock/fake trades when data is not available
let memoryTrades: TradeOrder[] = [];

export function resetMemoryState(): void {
  memoryTrades = [];
  memoryConfig.accountBalanceINR = INITIAL_BALANCE_INR;
}

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
          activeModelId: config.activeModelId || "15m-sniper-030",
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

// Get Trade Logs (optionally filtered by specific AI model)
export async function getTradeLogs(limit: number = 50, modelId?: string): Promise<TradeOrder[]> {
  const db = await getDb();
  if (db) {
    try {
      const query: any = {};
      if (modelId && modelId !== "all") {
        query.modelId = modelId;
      }
      const trades = await db
        .collection("trade_logs")
        .find(query)
        .sort({ openedAt: -1 })
        .limit(limit)
        .toArray();

      if (trades && trades.length > 0) {
        return trades.map((t: any) => ({
          id: t.id || t._id.toString(),
          symbol: t.symbol,
          direction: t.direction,
          orderType: t.orderType || "TAKER",
          modelId: t.modelId || "15m-sniper-030",
          modelName: t.modelName || "15M Sniper (+0.30R)",
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

  let list = [...memoryTrades];
  if (modelId && modelId !== "all") {
    list = list.filter((t) => t.modelId === modelId);
  }
  return list.sort((a, b) => b.openedAt - a.openedAt);
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
  modelId?: string;
}): Promise<TradeOrder> {
  const config = await getEngineConfig();
  const selectedModelId = params.modelId || config.activeModelId || "15m-sniper-030";
  const model = TOP_MODELS.find((m) => m.id === selectedModelId) || TOP_MODELS[0];
  const ratchetR = model.ratchetTriggerR; // 0.30 or 0.35

  const orderType = params.orderType || "TAKER";
  const feePercent = params.customFeePercent ?? (orderType === "TAKER" ? config.tradingFeePercent : config.makerFeePercent);

  // Dynamically size trades based on actual live account balance:
  // If a previous scalp lost ₹10 (e.g. -₹10.94 with fees), your remaining balance is ₹990.
  // The next trade will consider only ₹990 as available capital (true compounding equity).
  const metrics = await computePerformanceMetrics(selectedModelId);
  const currentAvailableBalance = Math.max(50, metrics.currentBalanceINR || config.accountBalanceINR);
  const positionSizeINR = currentAvailableBalance;
  const riskAmountINR = (currentAvailableBalance * config.riskPerTradePercent) / 100;

  // Calculate fees according to Shark Exchange (0.040% Taker + 18% GST)
  const feeCalc = calculateSharkExchangeFees(positionSizeINR, positionSizeINR, orderType, feePercent);

  // Stop loss and breakeven ratchet according to model parameters
  const sl = params.direction === "LONG"
    ? params.entryPrice - 1.0 * params.atr
    : params.entryPrice + 1.0 * params.atr;

  const beTrigger = params.direction === "LONG"
    ? params.entryPrice + ratchetR * params.atr
    : params.entryPrice - ratchetR * params.atr;

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
    modelId: model.id,
    modelName: model.shortName,
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

// Compute Engine Performance in INR (all models or filtered by modelId)
export async function computePerformanceMetrics(modelId?: string): Promise<EnginePerformanceMetrics> {
  const trades = await getTradeLogs(500, modelId);

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
