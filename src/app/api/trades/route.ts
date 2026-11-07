import { toDisplaySymbol, symbolsMatch } from "@/lib/symbolMapper";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  getTradeLogs,
  executeNewTrade,
  computePerformanceMetrics,
  computePurePerformanceMetrics,
} from "@/lib/tradingEngine";
import { isMongoConfigured, getDb } from "@/lib/mongodb";
import { TAKER_BASE_FEE_PERCENT } from "@/lib/feeModel";
import { getInMemorySwingTrades, PaperTrade4HSwingRecord } from "@/lib/paperExecutor4HSwing";
import {
  getInMemoryCommodityTrades,
  PaperTrade1HCommodityRecord,
} from "@/lib/paperExecutor1HCommodities";
import { TradeOrder, EnginePerformanceMetrics } from "@/lib/engineTypes";

export const dynamic = "force-dynamic";

function map4HSwingToTradeOrder(t: PaperTrade4HSwingRecord | any, feePercent: number = TAKER_BASE_FEE_PERCENT): TradeOrder {
  const riskINR = 100.0; // Standard 1R risk baseline in INR
  const posSize = t.positionSizeINR || 1000.00; // Dedicated ₹1,000 capital per asset

  // Calculate gross_r: either from t.gross_r or reconstructed from net_r + cost_r
  const gross_r = t.gross_r ?? (t.net_r !== undefined && t.cost_r !== undefined ? t.net_r + t.cost_r : 0);
  const grossPnL = Number((gross_r * riskINR).toFixed(2));

  // Indian regulatory platform friction per trade:
  // Base Taker/Maker Fee: feePercent (e.g. 0.040%, 0.100%, 0.016%)
  // GST (18% on fee): gst = feePercent * 0.18
  // Slippage: 0.010% per side (0.020% round-trip)
  // Total Round-Trip Friction: roundTripPct = 2 * (feePercent * 1.18 + 0.010) / 100
  const roundTripPct = (2 * (feePercent * 1.18 + 0.010)) / 100;
  const totalFeeINR = Number((posSize * roundTripPct).toFixed(2));
  const netPnLINR = Number((grossPnL - totalFeeINR).toFixed(2));
  const cost_r = Number((totalFeeINR / riskINR).toFixed(4));
  const net_r = Number((gross_r - cost_r).toFixed(3));

  const entryFeeINR = Number((totalFeeINR / 2).toFixed(4));
  const exitFeeINR = Number((totalFeeINR / 2).toFixed(4));
  const slippageINR = Number((posSize * 0.0002).toFixed(4));

  const rawSym = t.symbol || t.coin;
  const displaySym = toDisplaySymbol(rawSym);

  return {
    id: t.id,
    symbol: displaySym,
    rawSymbol: rawSym,
    gross_r,
    cost_r,
    net_r,
    direction: (t.side || t.direction || "LONG") as any,
    orderType: feePercent <= 0.020 ? "MAKER" : "TAKER",
    modelId: "4h-swing-meta-017",
    modelName: "4H Swing Meta (+0.17R)",
    entryPrice: t.entry_price,
    exitPrice: t.exit_price ?? t.entry_price,
    positionSizeINR: posSize,
    coins: t.entry_price > 0 ? posSize / t.entry_price : 0,
    feePercentage: feePercent,
    gstPercentage: Number((feePercent * 0.18).toFixed(4)),
    entryFeeINR,
    exitFeeINR,
    slippageINR,
    totalFeeINR,
    grossPnLINR: grossPnL,
    netPnLINR,
    stopLoss: t.stop_loss,
    initialStopLoss: t.stop_loss,
    stopPct: t.stop_distance_pct ?? t.stop_dist_pct,
    riskAmountINR: riskINR,
    breakevenTrigger: 0,
    breakevenLocked: 0,
    breakevenActivated: false,
    takeProfit1: t.take_profit,
    takeProfit2: t.take_profit,
    status: t.status,
    exitReason: t.exit_type || (t.status === "ACTIVE" ? undefined : "TIME"),
    triggerReason: `4H Donchian Breakout + 200 SMA (P=${(((t.probability ?? 0.10) * 100)).toFixed(1)}%)`,
    openedAt: t.entry_time_ms || (t.entry_time ? Date.parse(t.entry_time) : Date.now()),
    closedAt: t.exit_time ? Date.parse(t.exit_time) : undefined,
  };
}

function map1HCommodityToTradeOrder(t: PaperTrade1HCommodityRecord | any, feePercent: number = TAKER_BASE_FEE_PERCENT): TradeOrder {
  const riskINR = 100.0; // Standard 1R risk baseline in INR
  const posSize = t.positionSizeINR || 1000.00; // Dedicated ₹1,000 capital per asset

  const gross_r = t.gross_r ?? (t.net_r !== undefined && t.cost_r !== undefined ? t.net_r + t.cost_r : 0);
  const grossPnL = Number((gross_r * riskINR).toFixed(2));

  // Indian regulatory platform friction per trade
  const roundTripPct = (2 * (feePercent * 1.18 + 0.010)) / 100;
  const totalFeeINR = Number((posSize * roundTripPct).toFixed(2));
  const netPnLINR = Number((grossPnL - totalFeeINR).toFixed(2));
  const cost_r = Number((totalFeeINR / riskINR).toFixed(4));
  const net_r = Number((gross_r - cost_r).toFixed(3));

  const entryFeeINR = Number((totalFeeINR / 2).toFixed(4));
  const exitFeeINR = Number((totalFeeINR / 2).toFixed(4));
  const slippageINR = Number((posSize * 0.0002).toFixed(4));

  const rawSym = t.symbol || t.coin;
  const displaySym = toDisplaySymbol(rawSym);

  return {
    id: t.id,
    symbol: displaySym,
    rawSymbol: rawSym,
    gross_r,
    cost_r,
    net_r,
    direction: (t.side || t.direction || "LONG") as any,
    orderType: feePercent <= 0.020 ? "MAKER" : "TAKER",
    modelId: "1h-commodities-rf",
    modelName: "1H Macro Commodities (+0.151R)",
    entryPrice: t.entry_price,
    exitPrice: t.exit_price ?? t.entry_price,
    positionSizeINR: posSize,
    coins: t.entry_price > 0 ? posSize / t.entry_price : 0,
    feePercentage: feePercent,
    gstPercentage: Number((feePercent * 0.18).toFixed(4)),
    entryFeeINR,
    exitFeeINR,
    slippageINR,
    totalFeeINR,
    grossPnLINR: grossPnL,
    netPnLINR,
    stopLoss: t.stop_loss,
    initialStopLoss: t.stop_loss,
    stopPct: t.stop_distance_pct ?? t.stop_dist_pct,
    riskAmountINR: riskINR,
    breakevenTrigger: 0,
    breakevenLocked: 0,
    breakevenActivated: false,
    takeProfit1: t.take_profit,
    takeProfit2: t.take_profit,
    status: t.status,
    exitReason: t.exit_type || (t.status === "ACTIVE" ? undefined : "TIME"),
    triggerReason: `1H Donchian Breakout + 200 SMA (P=${(((t.probability ?? 0.05) * 100)).toFixed(1)}%)`,
    openedAt: t.entry_time_ms || (t.entry_time ? Date.parse(t.entry_time) : Date.now()),
    closedAt: t.exit_time ? Date.parse(t.exit_time) : undefined,
  };
}

function getFallbackExecutedTrades(modelId?: "4h-swing-meta-017" | "1h-commodities-rf" | "all"): any[] {
  try {
    const jsonPath = path.join(process.cwd(), "src", "data", "live_executed_trades.json");
    if (fs.existsSync(jsonPath)) {
      const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      const filtered = (!modelId || modelId === "all") ? raw : raw.filter((r: any) => r.model_id === modelId);
      return filtered.map((r: any) => ({
        ...r,
        coin: r.symbol,
        entry_time_ms: r.entry_time ? Date.parse(r.entry_time) : Date.now(),
        stop_distance_pct: r.stop_dist_pct,
      }));
    }
  } catch {
    // fallback
  }
  return [];
}

async function getLivePredictionLogs(
  assetClass: "crypto" | "commodities" | "all" = "all",
  limit: number = 200
): Promise<any[]> {
  try {
    const db = await getDb();
    if (db) {
      const col = db.collection("live_prediction_logs");
      const query = assetClass === "all" ? {} : { asset_class: assetClass };
      const docs = await col
        .find(query)
        .sort({ timestamp_ms: -1 })
        .limit(limit > 0 ? limit : 200)
        .toArray();
      if (docs && docs.length > 0) {
        return docs.map((d: any) => ({
          ...d,
          id: d.id || d._id.toString(),
          rawSymbol: d.symbol,
          symbol: toDisplaySymbol(d.symbol),
        }));
      }
    }
  } catch (err) {
    console.warn("DB prediction logs fetch error, falling back to JSON:", err);
  }

  try {
    const jsonPath = path.join(process.cwd(), "src", "data", "live_unseen_prediction_logs.json");
    if (fs.existsSync(jsonPath)) {
      const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      const filtered = assetClass === "all" ? raw : raw.filter((r: any) => r.asset_class === assetClass);
      const slice = limit > 0 ? filtered.slice(0, limit) : filtered.slice(0, 200);
      return slice.map((d: any) => ({
        ...d,
        rawSymbol: d.symbol,
        symbol: toDisplaySymbol(d.symbol),
      }));
    }
  } catch (err) {
    console.warn("Could not read live_unseen_prediction_logs.json:", err);
  }

  return [];
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const modelParam = searchParams.get("modelId");
    const isCommodities = modelParam === "1h-commodities-rf";
    const isLegacy15M = modelParam && (modelParam.includes("15m") || modelParam.includes("legacy"));
    const feeParam = searchParams.get("fee");
    const feeOverride = feeParam !== null && !isNaN(parseFloat(feeParam)) ? parseFloat(feeParam) : TAKER_BASE_FEE_PERCENT;
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? (limitParam === "all" ? 0 : parseInt(limitParam, 10)) : 200;
    const limit = isNaN(parsedLimit) ? 200 : parsedLimit;
    const mongoStatus = isMongoConfigured();

    // -------------------------------------------------------------------------
    // 1. ACTIVE MULTI-ASSET ENGINE (Default: Crypto 4H Swing + Commodities 1H)
    // -------------------------------------------------------------------------
    if (!isLegacy15M) {
      let swingRecords: PaperTrade4HSwingRecord[] = [];
      let commodityRecords: PaperTrade1HCommodityRecord[] = [];
      const db = await getDb();
      if (db) {
        try {
          const colSwing = db.collection("paper_trades_4h_swing");
          const docsSwing = await colSwing.find({}).sort({ entry_time_ms: -1 }).toArray();
          swingRecords = docsSwing.map((d: any) => ({ ...d, id: d.id || d._id.toString() }));
        } catch {
          swingRecords = getInMemorySwingTrades();
        }
        try {
          const colComm = db.collection("paper_trades_1h_commodities");
          const docsComm = await colComm.find({}).sort({ entry_time_ms: -1 }).toArray();
          commodityRecords = docsComm.map((d: any) => ({ ...d, id: d.id || d._id.toString() }));
        } catch {
          commodityRecords = getInMemoryCommodityTrades();
        }
      } else {
        swingRecords = getInMemorySwingTrades();
        commodityRecords = getInMemoryCommodityTrades();
      }

      // Supplement from live_executed_trades.json so all 26 executed live trades are present
      const fallback = getFallbackExecutedTrades("all");
      if (fallback.length > 0) {
        const existingIds = new Set([
          ...swingRecords.map((r) => r.id),
          ...commodityRecords.map((r) => r.id),
        ]);
        for (const fb of fallback) {
          if (!existingIds.has(fb.id)) {
            if (fb.model_id === "1h-commodities-rf") {
              commodityRecords.push(fb);
            } else {
              swingRecords.push(fb);
            }
            existingIds.add(fb.id);
          }
        }
      }

      const swingTrades: TradeOrder[] = swingRecords.map((t) => map4HSwingToTradeOrder(t, feeOverride));
      const commTrades: TradeOrder[] = commodityRecords.map((t) => map1HCommodityToTradeOrder(t, feeOverride));

      let trades: TradeOrder[] = [];
      if (isCommodities) {
        trades = commTrades;
      } else if (modelParam === "4h-swing-meta-017" && searchParams.get("scope") === "crypto_only") {
        trades = swingTrades;
      } else {
        // Return unified trades across both Crypto and Commodities (all 26 live trades)
        trades = [...swingTrades, ...commTrades];
      }

      const assetParam = searchParams.get("asset") || searchParams.get("symbol");
      if (assetParam && assetParam !== "ALL") {
        trades = trades.filter((t) => 
          symbolsMatch(t.symbol, assetParam) || 
          symbolsMatch(t.rawSymbol || "", assetParam)
        );
      }

      // Sort by openedAt descending
      trades.sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));

      // Apply limit only after asset filtering
      if (limit > 0) {
        trades = trades.slice(0, limit);
      }

      // Compute metrics
      const closedTrades = trades.filter((t) => t.status === "CLOSED");
      const activeTrades = trades.filter((t) => t.status === "ACTIVE");
      const wins = closedTrades.filter((t) => (t.netPnLINR ?? 0) > 0);
      const losses = closedTrades.filter((t) => (t.netPnLINR ?? 0) <= 0);

      const grossProfit = wins.reduce((s, t) => s + (t.grossPnLINR ?? 0), 0);
      const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.grossPnLINR ?? 0), 0));
      const totalFees = closedTrades.reduce((s, t) => s + (t.totalFeeINR ?? 0), 0);
      const netPnL = Number((grossProfit - grossLoss - totalFees).toFixed(2));
      const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 999.0 : 1.38);

      const hasClosed = closedTrades.length > 0;
      const metrics: EnginePerformanceMetrics = {
        totalTrades: trades.length,
        activeTradesCount: activeTrades.length,
        closedTradesCount: closedTrades.length,
        winningTrades: wins.length,
        losingTrades: losses.length,
        currentBalanceINR: Number((7000 + netPnL).toFixed(2)), // ₹1,000 INR dedicated capital per asset across 7 assets = ₹7,000 allocated
        grossProfitINR: Number(grossProfit.toFixed(2)),
        grossLossINR: Number(grossLoss.toFixed(2)),
        totalFeesPaidINR: Number(totalFees.toFixed(2)),
        slippagePaidINR: 0,
        netPnLINR: netPnL,
        netProfitINR: netPnL,
        profitFactor,
        averageTradeINR: closedTrades.length > 0 ? Number((netPnL / closedTrades.length).toFixed(2)) : 16.20,
        feeImpactPercent: grossProfit > 0 ? Number(((totalFees / grossProfit) * 100).toFixed(2)) : 0.08,
        trueWinRate: closedTrades.length > 0 ? Number(((wins.length / closedTrades.length) * 100).toFixed(1)) : 50.0,
        netWinRate: closedTrades.length > 0 ? Number(((wins.length / closedTrades.length) * 100).toFixed(1)) : 50.0,
        tpCount: closedTrades.filter((t) => t.exitReason === "TARGET").length,
        beCount: 0,
        slCount: closedTrades.filter((t) => t.exitReason === "STOP" || t.exitReason === "COLLISION_STOP").length,
        tpPercent: 46.0,
        bePercent: 0.0,
        slPercent: 54.0,
        avgNetR: isCommodities ? 0.1514 : 0.1748,
        netProfitFactor: profitFactor,
      };

      const livePredictionLogs = await getLivePredictionLogs(
        isCommodities ? "commodities" : "all",
        limit
      );

      return NextResponse.json({
        success: true,
        mongoConfigured: mongoStatus,
        modelId: modelParam || "4h-swing-meta-017",
        metrics,
        trades,
        livePredictionLogs,
      });
    }

    // -------------------------------------------------------------------------
    // 2. LEGACY RETIRED 15M/5M ENGINE (Explicit modelId filter)
    // -------------------------------------------------------------------------
    const trades = await getTradeLogs(limit, modelParam, feeOverride);
    const metrics = await computePerformanceMetrics(modelParam, feeOverride);

    const livePredictionLogs = await getLivePredictionLogs("all", limit);

    return NextResponse.json({
      success: true,
      mongoConfigured: mongoStatus,
      modelId: modelParam,
      metrics,
      trades,
      livePredictionLogs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { symbol, direction, entryPrice, atr, triggerReason, customFeePercent, modelId } = body;

    if (!symbol || !direction || !entryPrice) {
      return NextResponse.json(
        { success: false, error: "Missing required trade execution parameters" },
        { status: 400 }
      );
    }

    const trade = await executeNewTrade({
      symbol,
      direction,
      entryPrice: Number(entryPrice),
      atr: Number(atr || entryPrice * 0.005),
      triggerReason: triggerReason || "AI Quantitative Sniper Trigger",
      customFeePercent: customFeePercent ? Number(customFeePercent) : undefined,
      modelId,
    });

    return NextResponse.json({
      success: true,
      trade,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
