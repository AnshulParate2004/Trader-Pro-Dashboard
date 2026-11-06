import { getDb, isMongoConfigured } from "./mongodb";
export * from "./engineTypes";
export * from "./feeModel";
import {
  AIStrategyModel,
  TOP_MODELS,
  TradeOrder,
  EngineConfig,
  EnginePerformanceMetrics,
} from "./engineTypes";
import {
  computeTradeCost,
  getSlippageRate,
  isTakerFee,
  TAKER_BASE_FEE_PERCENT,
  MAKER_BASE_FEE_PERCENT,
  GST_RATE_PERCENT,
} from "./feeModel";

// Shark Exchange Fee Calculations (0.040% Taker, 0.016% Maker, 18% Indian GST, 0.01% Slippage)
export function calculateSharkExchangeFees(
  entrySizeINR: number,
  exitSizeINR: number,
  orderType: "TAKER" | "MAKER" = "TAKER",
  feePercentOverride?: number,
  slippagePercentOverride: number = 0.010
): {
  baseFeeRate: number;
  entryFeeINR: number;
  exitFeeINR: number;
  gstAmountINR: number;
  slippageINR: number;
  totalFeeWithGST_INR: number;
} {
  const baseRate = feePercentOverride ?? (orderType === "TAKER" ? 0.040 : 0.016);
  const baseRateDecimal = baseRate / 100;
  const gstRate = 0.18; // 18% GST
  const slipRateDecimal = (orderType === "TAKER" ? slippagePercentOverride : 0.005) / 100;

  const rawEntryFee = entrySizeINR * baseRateDecimal;
  const rawExitFee = exitSizeINR * baseRateDecimal;
  const rawTotalFee = rawEntryFee + rawExitFee;

  const gstAmount = rawTotalFee * gstRate;
  const totalFeeWithGST = rawTotalFee + gstAmount;

  const entrySlip = entrySizeINR * slipRateDecimal;
  const exitSlip = exitSizeINR * slipRateDecimal;
  const totalSlip = entrySlip + exitSlip;

  const totalCost = totalFeeWithGST + totalSlip;

  return {
    baseFeeRate: baseRate,
    entryFeeINR: Number((rawEntryFee * 1.18).toFixed(4)),
    exitFeeINR: Number((rawExitFee * 1.18).toFixed(4)),
    gstAmountINR: Number(gstAmount.toFixed(4)),
    slippageINR: Number(totalSlip.toFixed(4)),
    totalFeeWithGST_INR: Number(totalCost.toFixed(4)),
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

// Get Trade Logs (optionally filtered by specific AI model and dynamic fee override)
export async function getTradeLogs(limit: number = 200, modelId?: string, feeOverride?: number): Promise<TradeOrder[]> {
  const config = await getEngineConfig();
  const feeRate = feeOverride !== undefined && !isNaN(feeOverride) ? feeOverride : (config.tradingFeePercent || 0.040);
  const gstRate = (config.gstPercent || 18.0) / 100;
  const effectiveFeeRate = (feeRate / 100) * (1 + gstRate);

  const db = await getDb();
  if (db) {
    try {
      const query: any = {};
      if (modelId && modelId !== "all") {
        query.modelId = modelId;
      }
      let cursor = db
        .collection("trade_logs")
        .find(query)
        .sort({ openedAt: -1 });

      if (limit > 0) {
        cursor = cursor.limit(limit);
      }
      const trades = await cursor.toArray();

      if (Array.isArray(trades)) {
        return trades.map((t: any) => {
          const pos = t.positionSizeINR || 1000;
          const gross = t.grossPnLINR !== undefined ? t.grossPnLINR : 0;
          const exitPos = pos + gross;
          const isTaker = feeRate > 0.020;
          const slipRate = isTaker ? 0.0001 : 0.00005; // 0.01% per side on taker
          const entryFee = Number((pos * (feeRate / 100) * (1 + gstRate)).toFixed(4));
          const exitFee = Number((exitPos * (feeRate / 100) * (1 + gstRate)).toFixed(4));
          const entrySlip = pos * slipRate;
          const exitSlip = exitPos * slipRate;
          const totalSlip = Number((entrySlip + exitSlip).toFixed(4));
          const totalFee = Number((entryFee + exitFee + totalSlip).toFixed(4));
          const net = Number((gross - totalFee).toFixed(2));

          return {
            id: t.id || t._id.toString(),
            symbol: t.symbol,
            direction: t.direction,
            orderType: t.orderType || (feeRate <= 0.020 ? "MAKER" : "TAKER"),
            modelId: t.modelId || "15m-sniper-030",
            modelName: t.modelName || "15M Sniper (+0.30R)",
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            positionSizeINR: pos,
            coins: t.coins,
            feePercentage: feeRate,
            gstPercentage: config.gstPercent || 18.0,
            entryFeeINR: entryFee,
            exitFeeINR: exitFee,
            slippageINR: totalSlip,
            totalFeeINR: totalFee,
            grossPnLINR: gross,
            netPnLINR: net,
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
          };
        });
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

// Query all currently active and breakeven-activated trades directly (Never misses trades beyond pagination/limit)
export async function getActiveTradeLogs(): Promise<TradeOrder[]> {
  const db = await getDb();
  if (db) {
    try {
      const activeDocs = await db
        .collection("trade_logs")
        .find({ status: { $in: ["ACTIVE", "BE_ACTIVATED"] } })
        .sort({ openedAt: 1 })
        .toArray();

      if (Array.isArray(activeDocs) && activeDocs.length > 0) {
        return activeDocs.map((t: any) => ({
          id: t.id || t._id.toString(),
          symbol: t.symbol,
          direction: t.direction,
          orderType: t.orderType || "TAKER",
          modelId: t.modelId || "15m-sniper-030",
          modelName: t.modelName || "15M Sniper (+0.30R)",
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice,
          positionSizeINR: t.positionSizeINR || 1000,
          coins: t.coins,
          feePercentage: t.feePercentage || TAKER_BASE_FEE_PERCENT,
          gstPercentage: t.gstPercentage || GST_RATE_PERCENT,
          entryFeeINR: t.entryFeeINR || 0,
          exitFeeINR: t.exitFeeINR || 0,
          slippageINR: t.slippageINR || 0,
          totalFeeINR: t.totalFeeINR || 0,
          grossPnLINR: t.grossPnLINR || 0,
          netPnLINR: t.netPnLINR || 0,
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
      console.warn("MongoDB getActiveTradeLogs error, falling back to memory:", err);
    }
  }

  // Warn loudly on serverless if MONGODB_URI is not set
  if (process.env.NODE_ENV === "production" && !process.env.MONGODB_URI) {
    console.error("CRITICAL PRODUCTION MISCONFIGURATION: MONGODB_URI is missing on serverless! Trades and engine state will vanish across invocations.");
  }

  return memoryTrades.filter(
    (t) => t.status === "ACTIVE" || t.status === "BE_ACTIVATED"
  );
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

  // Dynamically size trades using exact 1R volatility risk parity (spec section 6):
  // positionSize = equity * min(MAX_LEV, RISK_PCT / (ATR / price))
  const metrics = await computePerformanceMetrics(selectedModelId);
  const currentAvailableBalance = Math.max(50, metrics.currentBalanceINR || config.accountBalanceINR);
  const atrPct = params.entryPrice > 0 ? params.atr / params.entryPrice : 0.005;
  const riskPct = (config.riskPerTradePercent || 1.0) / 100; // 0.01 = 1% risk (1R)
  const maxLev = 3.0; // 3.0x max notional leverage cap
  const levScale = atrPct > 0 ? Math.min(maxLev, riskPct / atrPct) : 1.0;
  const positionSizeINR = Number((currentAvailableBalance * levScale).toFixed(2));

  // Calculate fees according to Shark Exchange (0.040% Taker + 18% GST)
  const feeCalc = calculateSharkExchangeFees(positionSizeINR, positionSizeINR, orderType, feePercent);

  // Stop loss with hard cap (5% for 15m, 3% for 5m) guarding against flash wicks
  const maxSlPct = model.requires5MMicro ? 0.03 : 0.05;
  const slDist = Math.min(1.0 * params.atr, maxSlPct * params.entryPrice);

  const sl = params.direction === "LONG"
    ? params.entryPrice - slDist
    : params.entryPrice + slDist;

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

// Pure synchronous computation of all performance metrics from a list of trades using the unified fee model
export function computePurePerformanceMetrics(
  trades: TradeOrder[],
  feeRate: number = TAKER_BASE_FEE_PERCENT,
  gstPercent: number = GST_RATE_PERCENT
): EnginePerformanceMetrics {
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
      slippagePaidINR: 0,
      netPnLINR: 0,
      profitFactor: 0,
      averageTradeINR: 0,
      feeImpactPercent: 0,
      trueWinRate: 0,
      netWinRate: 0,
      tpCount: 0,
      beCount: 0,
      slCount: 0,
      tpPercent: 0,
      bePercent: 0,
      slPercent: 0,
      avgNetR: 0,
      netProfitFactor: 0,
    };
  }

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

  for (const t of trades) {
    if (t.status === "ACTIVE" || t.status === "BE_ACTIVATED") {
      activeCount++;
      continue;
    }

    closedCount++;
    const pos = t.positionSizeINR || 1000;
    const gross = t.grossPnLINR !== undefined ? t.grossPnLINR : 0;

    const cost = computeTradeCost(pos, gross, feeRate, gstPercent);
    const net = cost.netPnLINR;

    totalExchangeFees += cost.totalExchangeFeesINR;
    totalSlippage += cost.totalSlippageINR;

    // Gross PnL classification (independent of fees)
    if (gross > 0) {
      grossProfit += gross;
    } else if (gross < 0) {
      grossLoss += Math.abs(gross);
    }

    // Net PnL classification (after fees)
    if (net > 0) {
      winCount++;
      netWinsINR += net;
    } else {
      lossCount++;
      netLossesINR += Math.abs(net);
    }

    // 1R = 1% volatility risk parity
    const oneR = pos * 0.01;
    const rVal = oneR > 0 ? net / oneR : 0;
    totalNetR += rVal;

    // Exit reason classification:
    const reason = ((t as any).exitReason || (t as any).actionReason || "").toUpperCase();
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
  const currentBalanceINR = Number((INITIAL_BALANCE_INR + netPnLINR).toFixed(2));

  const trueWinRate = (tpCount + slCount) > 0 ? Number(((tpCount / (tpCount + slCount)) * 100).toFixed(1)) : 0;
  const netWinRate = closedCount > 0 ? Number(((winCount / closedCount) * 100).toFixed(1)) : 0;
  const tpPercent = closedCount > 0 ? Number(((tpCount / closedCount) * 100).toFixed(1)) : 0;
  const bePercent = closedCount > 0 ? Number(((beCount / closedCount) * 100).toFixed(1)) : 0;
  const slPercent = closedCount > 0 ? Number(((slCount / closedCount) * 100).toFixed(1)) : 0;

  const profitFactor = grossLossINR > 0 ? Number((grossProfitINR / grossLossINR).toFixed(2)) : (grossProfitINR > 0 ? 9.99 : 1.0);
  const netProfitFactor = netLossesINR > 0 ? Number((netWinsINR / netLossesINR).toFixed(2)) : (netWinsINR > 0 ? 9.99 : 1.0);
  const averageTradeINR = closedCount > 0 ? Number((netPnLINR / closedCount).toFixed(2)) : 0;
  const avgNetR = closedCount > 0 ? Number((totalNetR / closedCount).toFixed(3)) : 0;
  const feeImpactPercent = grossProfitINR > 0 ? Number(((totalCostINR / grossProfitINR) * 100).toFixed(1)) : 0;

  return {
    totalTrades: trades.length,
    activeTradesCount: activeCount,
    closedTradesCount: closedCount,
    winningTrades: winCount,
    losingTrades: lossCount,
    currentBalanceINR,
    grossProfitINR,
    grossLossINR,
    totalFeesPaidINR,
    slippagePaidINR,
    netPnLINR,
    profitFactor,
    averageTradeINR,
    feeImpactPercent,
    trueWinRate,
    netWinRate,
    tpCount,
    beCount,
    slCount,
    tpPercent,
    bePercent,
    slPercent,
    avgNetR,
    netProfitFactor,
  };
}

// Compute Engine Performance in INR (all models or filtered by modelId, with dynamic fee calculation)
// Strictly computes all metrics (true win rate, net win rate, split, avg R, profit factor, fees, slippage, gross, net, balance)
// from the same single unified list of closed trades using the active fee mode (default Taker: 0.040% + 18% GST + 0.010% slippage/side).
export async function computePerformanceMetrics(modelId?: string, feeOverride?: number): Promise<EnginePerformanceMetrics> {
  const config = await getEngineConfig();
  // Default fee mode is strictly Taker (0.040%) unless an override is provided
  const feeRate = feeOverride !== undefined && !isNaN(feeOverride) ? feeOverride : (config.tradingFeePercent || TAKER_BASE_FEE_PERCENT);
  const gstRate = config.gstPercent || GST_RATE_PERCENT;

  const trades = await getTradeLogs(500, modelId, feeRate);
  return computePurePerformanceMetrics(trades, feeRate, gstRate);
}
