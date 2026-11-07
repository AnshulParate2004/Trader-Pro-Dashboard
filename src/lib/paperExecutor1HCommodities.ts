/**
 * 1-Hour Macro Commodities Paper Trading Execution Engine
 * Evaluates Gold (GC=F), Silver (SI=F), and Crude Oil (CL=F)
 *
 * Invariants:
 * 1. Timeframe: 1-Hour candlestick cadence.
 * 2. Setup (Bi-directional):
 *    - Long: Close > 200 SMA AND Close > max(High of previous 20 completed bars t-20..t-1).
 *    - Short: Close < 200 SMA AND Close < min(Low of previous 20 completed bars t-20..t-1).
 * 3. Stop Loss: Lowest Low (Long) or Highest High (Short) of past 10 bars, clamped strictly [1.0%, 4.0%].
 * 4. Target: Entry +/- 2.5 * Stop Distance (+2.5R); Time Barrier: 24 bars (24 hours).
 * 5. Simultaneous Touch Collision: Booked strictly as Stop Loss (-1.0R).
 * 6. Institutional Transaction Friction: 0.05% (5 bps) round-trip deducted from every trade.
 * 7. AI Meta-Classifier Gating: Top quantile gating (P >= P_cutoff = 0.0635).
 * 8. Database: MongoDB collection `paper_trades_1h_commodities` with resilient in-memory fallback.
 */

import { getDb } from "./mongodb";
import { Candle } from "./features";
import {
  fetchCommodityKlines,
  COMMODITY_SYMBOLS,
  COMMODITY_BENCHMARK,
  CommoditySymbol,
} from "./commoditiesData";
import {
  predictCommoditiesMetaProb,
  COMMODITIES_1H_FEATURE_NAMES,
} from "./commoditiesModelInference";

export const COMMODITY_FRICTION_PCT = 0.0005; // 5 bps round-trip friction
export const TARGET_R = 2.5;
export const STOP_R = 1.0;
export const TIME_BARRIER_BARS = 24; // 24 hours on 1H
export const MIN_STOP_PCT = 0.010; // 1.0%
export const MAX_STOP_PCT = 0.040; // 4.0%
export const DEFAULT_COMMODITY_P_CUTOFF = 0.0635;

export interface PaperTrade1HCommodityRecord {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  signal_time: string;
  entry_time: string;
  entry_time_ms: number;
  exit_time?: string;
  entry_price: number;
  exit_price?: number;
  stop_loss: number;
  take_profit: number;
  stop_distance_pct: number;
  stop_distance: number;
  status: "ACTIVE" | "CLOSED";
  exit_type?: "TARGET" | "STOP" | "TIME" | "COLLISION_STOP";
  gross_r?: number;
  cost_r: number;
  net_r?: number;
  probability: number;
  p_cutoff: number;
  bars_held?: number;
  feature_snapshot?: Record<string, number>;
  last_evaluated_bar_time?: number;
}

export interface CommoditiesExecutorResult {
  success: boolean;
  timestamp: string;
  evaluated_symbols: string[];
  opened_trades: PaperTrade1HCommodityRecord[];
  active_trades: PaperTrade1HCommodityRecord[];
  closed_trades: PaperTrade1HCommodityRecord[];
  skipped_symbols: Array<{ symbol: string; reason: string; probability?: number }>;
  actions: string[];
}

// In-memory fallback for testing / offline environments
const inMemoryCommodityTrades: Map<string, PaperTrade1HCommodityRecord> = new Map();

export function getInMemoryCommodityTrades(): PaperTrade1HCommodityRecord[] {
  return Array.from(inMemoryCommodityTrades.values());
}

export function clearInMemoryCommodityTrades(): void {
  inMemoryCommodityTrades.clear();
}

/**
 * Computes clamped structural stop loss:
 * Clamped strictly between 1.0% and 4.0%.
 */
export function computeCommodityClampedStop(
  entryPrice: number,
  side: "LONG" | "SHORT",
  extremePrice10: number
): { stopLoss: number; stopDistPct: number; stopDist: number; costR: number; takeProfit: number } {
  let rawDistPct = 0.0;
  if (side === "LONG") {
    rawDistPct = (entryPrice - extremePrice10) / entryPrice;
  } else {
    rawDistPct = (extremePrice10 - entryPrice) / entryPrice;
  }

  const clampedDistPct = Math.min(MAX_STOP_PCT, Math.max(MIN_STOP_PCT, rawDistPct));
  const stopDist = Number((entryPrice * clampedDistPct).toFixed(4));
  const stopLoss = side === "LONG"
    ? Number((entryPrice - stopDist).toFixed(4))
    : Number((entryPrice + stopDist).toFixed(4));
  const takeProfit = side === "LONG"
    ? Number((entryPrice + TARGET_R * stopDist).toFixed(4))
    : Number((entryPrice - TARGET_R * stopDist).toFixed(4));

  const costR = Number((COMMODITY_FRICTION_PCT / clampedDistPct).toFixed(6));

  return {
    stopLoss,
    stopDistPct: clampedDistPct,
    stopDist,
    costR,
    takeProfit,
  };
}

/**
 * Checks for candidate breakout signal on completed 1H candles:
 * Long Setup: Close > 200 SMA AND Close > max(High t-20..t-1)
 * Short Setup: Close < 200 SMA AND Close < min(Low t-20..t-1)
 */
export function checkCommodityCandidateSignal(
  candles: Candle[]
): {
  isCandidate: boolean;
  side?: "LONG" | "SHORT";
  entryPrice: number;
  extremePrice10: number;
  sma200: number;
  donchianLevel20: number;
  reason?: string;
} {
  if (candles.length < 205) {
    return {
      isCandidate: false,
      entryPrice: 0,
      extremePrice10: 0,
      sma200: 0,
      donchianLevel20: 0,
      reason: `Insufficient candles: requires >= 205, got ${candles.length}`,
    };
  }

  const tIdx = candles.length - 1;
  const barT = candles[tIdx];

  // 1. 200-SMA on completed bars up to t
  const slice200 = candles.slice(tIdx - 199, tIdx + 1);
  const sma200 = slice200.reduce((sum, c) => sum + c.close, 0) / 200;

  // 2. 20-bar Donchian high & low on bars t-20 through t-1
  const sliceDonchian = candles.slice(tIdx - 20, tIdx);
  const donchianHigh20 = Math.max(...sliceDonchian.map((c) => c.high));
  const donchianLow20 = Math.min(...sliceDonchian.map((c) => c.low));

  // Check Long Breakout
  if (barT.close > sma200 && barT.close > donchianHigh20) {
    const sliceLow10 = candles.slice(tIdx - 10, tIdx);
    const lowestLow10 = Math.min(...sliceLow10.map((c) => c.low));
    return {
      isCandidate: true,
      side: "LONG",
      entryPrice: barT.close,
      extremePrice10: lowestLow10,
      sma200,
      donchianLevel20: donchianHigh20,
    };
  }

  // Check Short Breakdown
  if (barT.close < sma200 && barT.close < donchianLow20) {
    const sliceHigh10 = candles.slice(tIdx - 10, tIdx);
    const highestHigh10 = Math.max(...sliceHigh10.map((c) => c.high));
    return {
      isCandidate: true,
      side: "SHORT",
      entryPrice: barT.close,
      extremePrice10: highestHigh10,
      sma200,
      donchianLevel20: donchianLow20,
    };
  }

  // Regime conflicts
  if (barT.close > donchianHigh20 && barT.close <= sma200) {
    return {
      isCandidate: false,
      entryPrice: barT.close,
      extremePrice10: 0,
      sma200,
      donchianLevel20: donchianHigh20,
      reason: `Bullish breakout rejected: Close (${barT.close}) is below 200 SMA (${sma200.toFixed(2)})`,
    };
  }

  if (barT.close < donchianLow20 && barT.close >= sma200) {
    return {
      isCandidate: false,
      entryPrice: barT.close,
      extremePrice10: 0,
      sma200,
      donchianLevel20: donchianLow20,
      reason: `Bearish breakdown rejected: Close (${barT.close}) is above 200 SMA (${sma200.toFixed(2)})`,
    };
  }

  return {
    isCandidate: false,
    entryPrice: barT.close,
    extremePrice10: 0,
    sma200,
    donchianLevel20: barT.close > sma200 ? donchianHigh20 : donchianLow20,
    reason: `Inside Donchian channel: close (${barT.close}) does not break out of 20-bar range [${donchianLow20.toFixed(2)}, ${donchianHigh20.toFixed(2)}]`,
  };
}

/**
 * Extracts the 8 canonical macro commodities features matching Python training.
 * Every indicator strictly uses completed data <= t-1.
 */
export function extractCommodityFeatures(
  candles: Candle[],
  dxyCandles?: Candle[]
): Record<string, number> {
  const tIdx = candles.length - 1;
  const barLag = candles[tIdx - 1]; // Bar t-1
  const closeLag = barLag.close;

  // 1. DXY Momentum & Correlation (lagged t-1)
  let dxyMom24h = 0.0;
  let dxyMom72h = 0.0;
  let dxyCorr60 = 0.0;

  if (dxyCandles && dxyCandles.length >= 75) {
    const dxyLag = dxyCandles[dxyCandles.length - 2];
    const dxyPrev24 = dxyCandles[dxyCandles.length - 2 - 24];
    const dxyPrev72 = dxyCandles[dxyCandles.length - 2 - 72];

    if (dxyPrev24 && dxyPrev24.close > 0) {
      dxyMom24h = Math.max(-0.1, Math.min(0.1, dxyLag.close / dxyPrev24.close - 1.0));
    }
    if (dxyPrev72 && dxyPrev72.close > 0) {
      dxyMom72h = Math.max(-0.15, Math.min(0.15, dxyLag.close / dxyPrev72.close - 1.0));
    }

    // 60-period correlation
    if (candles.length >= 62 && dxyCandles.length >= 62) {
      const cRets: number[] = [];
      const dRets: number[] = [];
      for (let i = tIdx - 60; i < tIdx; i++) {
        cRets.push(candles[i].close / candles[i - 1].close - 1.0);
        dRets.push(dxyCandles[i].close / dxyCandles[i - 1].close - 1.0);
      }
      const meanC = cRets.reduce((a, b) => a + b, 0) / cRets.length;
      const meanD = dRets.reduce((a, b) => a + b, 0) / dRets.length;
      let num = 0.0;
      let denC = 0.0;
      let denD = 0.0;
      for (let i = 0; i < cRets.length; i++) {
        const diffC = cRets[i] - meanC;
        const diffD = dRets[i] - meanD;
        num += diffC * diffD;
        denC += diffC * diffC;
        denD += diffD * diffD;
      }
      const denom = Math.sqrt(denC * denD);
      dxyCorr60 = denom > 1e-8 ? Math.max(-1.0, Math.min(1.0, num / denom)) : 0.0;
    }
  }

  // 2. Volume Z-Score (20-period moving average on t-20..t-1)
  const volSlice = candles.slice(tIdx - 20, tIdx).map((c) => c.volume);
  const volMean = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;
  const volVar = volSlice.reduce((a, b) => a + Math.pow(b - volMean, 2), 0) / volSlice.length;
  const volStd = Math.sqrt(volVar);
  const volZScore = volStd > 1e-8 ? Math.max(-4.0, Math.min(4.0, (barLag.volume - volMean) / volStd)) : 0.0;

  // 3. EWMA Volatility Ratio
  const returns: number[] = [];
  for (let i = 1; i <= tIdx - 1; i++) {
    returns.push(Math.log(candles[i].close / candles[i - 1].close));
  }
  let ewmaVar = 0.0;
  const alpha = 0.06;
  for (const r of returns) {
    ewmaVar = alpha * (r * r) + (1.0 - alpha) * ewmaVar;
  }
  const ewmaVol = Math.sqrt(ewmaVar);

  const baselineSlice = returns.slice(-720);
  const bMean = baselineSlice.reduce((a, b) => a + b, 0) / baselineSlice.length;
  const bVar = baselineSlice.reduce((a, b) => a + Math.pow(b - bMean, 2), 0) / baselineSlice.length;
  const baseVol = Math.sqrt(bVar);
  const volRatio = baseVol > 1e-8 ? Math.max(0.2, Math.min(5.0, ewmaVol / baseVol)) : 1.0;

  // 4. ATR% (14-period True Range / close)
  const trs: number[] = [];
  for (let i = tIdx - 14; i < tIdx; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trs.push(tr);
  }
  const atr = trs.reduce((a, b) => a + b, 0) / trs.length;
  const atrPct = Math.max(0.001, Math.min(0.08, atr / (closeLag + 1e-8)));

  // 5. Donchian Position
  const donchSlice = candles.slice(tIdx - 20, tIdx);
  const donchHigh = Math.max(...donchSlice.map((c) => c.high));
  const donchLow = Math.min(...donchSlice.map((c) => c.low));
  const sma20 = donchSlice.reduce((a, b) => a + b.close, 0) / donchSlice.length;
  const donchRange = Math.max(1e-8, donchHigh - donchLow);
  const donchianPos = Math.max(-2.0, Math.min(2.0, (closeLag - sma20) / donchRange));

  // 6. 200-SMA Distance
  const sma200Slice = candles.slice(Math.max(0, tIdx - 200), tIdx);
  const sma200 = sma200Slice.reduce((a, b) => a + b.close, 0) / sma200Slice.length;
  const trendDist200 = Math.max(-0.3, Math.min(0.3, (closeLag - sma200) / (sma200 + 1e-8)));

  return {
    feat_dxy_mom_24h: Number(dxyMom24h.toFixed(6)),
    feat_dxy_mom_72h: Number(dxyMom72h.toFixed(6)),
    feat_dxy_corr_60: Number(dxyCorr60.toFixed(6)),
    feat_vol_zscore: Number(volZScore.toFixed(6)),
    feat_volatility_ratio: Number(volRatio.toFixed(6)),
    feat_atr_pct: Number(atrPct.toFixed(6)),
    feat_donchian_pos: Number(donchianPos.toFixed(6)),
    feat_trend_dist_200: Number(trendDist200.toFixed(6)),
  };
}

/**
 * Evaluates an active trade against a completed 1H candle.
 * Invariant: Collision (both TP & SL touched) books strictly as Stop Loss (-1.0R).
 */
export function evaluateActiveCommodityTradeOnCandle(
  trade: PaperTrade1HCommodityRecord,
  candle: Candle,
  barsHeld: number
): {
  closed: boolean;
  exitType?: "TARGET" | "STOP" | "TIME" | "COLLISION_STOP";
  exitPrice?: number;
  grossR?: number;
} {
  const isLong = trade.side === "LONG";
  const hitTarget = isLong ? candle.high >= trade.take_profit : candle.low <= trade.take_profit;
  const hitStop = isLong ? candle.low <= trade.stop_loss : candle.high >= trade.stop_loss;

  // Collision Rule: If both barriers touched in same bar, Stop Loss takes absolute precedence
  if (hitTarget && hitStop) {
    return {
      closed: true,
      exitType: "COLLISION_STOP",
      exitPrice: trade.stop_loss,
      grossR: -STOP_R,
    };
  }

  // Target Hit (+2.5R)
  if (hitTarget) {
    return {
      closed: true,
      exitType: "TARGET",
      exitPrice: trade.take_profit,
      grossR: TARGET_R,
    };
  }

  // Stop Loss Hit (-1.0R)
  if (hitStop) {
    return {
      closed: true,
      exitType: "STOP",
      exitPrice: trade.stop_loss,
      grossR: -STOP_R,
    };
  }

  // Time Barrier Hit (24 bars / 24 hours)
  if (barsHeld >= TIME_BARRIER_BARS) {
    const grossR = isLong
      ? (candle.close - trade.entry_price) / trade.stop_distance
      : (trade.entry_price - candle.close) / trade.stop_distance;
    return {
      closed: true,
      exitType: "TIME",
      exitPrice: candle.close,
      grossR: Number(grossR.toFixed(4)),
    };
  }

  return { closed: false };
}

/**
 * Main Paper Trading Executor for 1H Macro Commodities.
 */
export async function runPaper1HCommoditiesExecutor(options?: {
  isDryRun?: boolean;
  customCutoff?: number;
  customCandlesMap?: Record<string, Candle[]>;
  baseDir?: string;
}): Promise<CommoditiesExecutorResult> {
  const isDryRun = options?.isDryRun ?? false;
  const pCutoff = options?.customCutoff ?? DEFAULT_COMMODITY_P_CUTOFF;
  const actions: string[] = [];
  const openedTrades: PaperTrade1HCommodityRecord[] = [];
  const closedTrades: PaperTrade1HCommodityRecord[] = [];
  const skippedSymbols: Array<{ symbol: string; reason: string; probability?: number }> = [];

  let db: any = null;
  try {
    db = await getDb();
  } catch {
    db = null;
  }

  // 1. Load active trades from DB or in-memory map
  let activeTrades: PaperTrade1HCommodityRecord[] = [];
  if (db && !isDryRun) {
    try {
      const records = await db
        .collection("paper_trades_1h_commodities")
        .find({ status: "ACTIVE" })
        .toArray();
      activeTrades = records.map((r: any) => ({ ...r, id: r.id || r._id.toString() }));
    } catch {
      activeTrades = Array.from(inMemoryCommodityTrades.values()).filter((t) => t.status === "ACTIVE");
    }
  } else {
    activeTrades = Array.from(inMemoryCommodityTrades.values()).filter((t) => t.status === "ACTIVE");
  }

  // 2. Ingest 1H candles for all 3 commodities and DXY benchmark
  const candleMap: Record<string, Candle[]> = {};
  for (const sym of COMMODITY_SYMBOLS) {
    if (options?.customCandlesMap && options.customCandlesMap[sym]) {
      candleMap[sym] = options.customCandlesMap[sym];
    } else {
      const klines = await fetchCommodityKlines(sym, "1mo");
      candleMap[sym] = klines;
    }
  }

  // Benchmark candles for DXY
  let dxyCandles: Candle[] = [];
  if (options?.customCandlesMap && options.customCandlesMap[COMMODITY_BENCHMARK]) {
    dxyCandles = options.customCandlesMap[COMMODITY_BENCHMARK];
  } else {
    dxyCandles = await fetchCommodityKlines(COMMODITY_BENCHMARK, "1mo");
  }

  // 3. Evaluate Active Trades
  for (const trade of activeTrades) {
    const candles = candleMap[trade.symbol] || [];
    if (candles.length === 0) continue;

    const lastBar = candles[candles.length - 1];
    const tradeTime = trade.entry_time_ms;
    const barsSinceEntry = candles.filter((c) => c.openTime > tradeTime).length;

    const evaluation = evaluateActiveCommodityTradeOnCandle(trade, lastBar, barsSinceEntry);
    if (evaluation.closed) {
      const grossR = evaluation.grossR ?? 0;
      const netR = Number((grossR - trade.cost_r).toFixed(4));
      const exitTimeStr = new Date(lastBar.closeTime || lastBar.openTime + 3599999).toISOString();

      trade.status = "CLOSED";
      trade.exit_type = evaluation.exitType;
      trade.exit_price = evaluation.exitPrice;
      trade.exit_time = exitTimeStr;
      trade.gross_r = grossR;
      trade.net_r = netR;
      trade.bars_held = barsSinceEntry;

      closedTrades.push(trade);
      actions.push(
        `[CLOSE] ${trade.symbol} ${trade.side} closed via ${trade.exit_type} at ${trade.exit_price} (Gross: ${grossR >= 0 ? "+" : ""}${grossR.toFixed(2)}R, Net: ${netR >= 0 ? "+" : ""}${netR.toFixed(2)}R)`
      );

      // Persist to MongoDB or in-memory
      if (db && !isDryRun) {
        try {
          await db
            .collection("paper_trades_1h_commodities")
            .updateOne({ id: trade.id }, { $set: trade as any }, { upsert: true });
        } catch {
          inMemoryCommodityTrades.set(trade.id, trade);
        }
      } else {
        inMemoryCommodityTrades.set(trade.id, trade);
      }
    }
  }

  // Filter still active trades
  const remainingActive = activeTrades.filter((t) => t.status === "ACTIVE");

  // 4. Scan Candidate Setups for Each Symbol
  for (const sym of COMMODITY_SYMBOLS) {
    const isAlreadyActive = remainingActive.some((t) => t.symbol === sym);
    if (isAlreadyActive) {
      skippedSymbols.push({ symbol: sym, reason: "Active trade already in flight" });
      continue;
    }

    const candles = candleMap[sym] || [];
    const signalCheck = checkCommodityCandidateSignal(candles);
    if (!signalCheck.isCandidate || !signalCheck.side) {
      skippedSymbols.push({
        symbol: sym,
        reason: signalCheck.reason || "No valid breakout signal",
      });
      continue;
    }

    // Extract features strictly lagged t-1
    const features = extractCommodityFeatures(candles, dxyCandles);
    const inference = predictCommoditiesMetaProb(features, pCutoff, options?.baseDir);

    if (!inference.passesGate) {
      skippedSymbols.push({
        symbol: sym,
        reason: `AI Conviction gate skipped: Probability (${(inference.probability * 100).toFixed(2)}%) < Cutoff (${(pCutoff * 100).toFixed(2)}%)`,
        probability: inference.probability,
      });
      actions.push(
        `[FILTER] ${sym} ${signalCheck.side} setup skipped by AI gate (P=${(inference.probability * 100).toFixed(2)}% < ${(pCutoff * 100).toFixed(2)}%)`
      );
      continue;
    }

    // AI Passed: Open Trade
    const entryPrice = signalCheck.entryPrice;
    const side = signalCheck.side;
    const clampedStop = computeCommodityClampedStop(entryPrice, side, signalCheck.extremePrice10);
    const latestBar = candles[candles.length - 1];
    const tradeId = `comm-1h-${sym}-${latestBar.openTime}`;

    const newTrade: PaperTrade1HCommodityRecord = {
      id: tradeId,
      symbol: sym,
      side,
      signal_time: new Date(latestBar.openTime).toISOString(),
      entry_time: new Date(latestBar.openTime).toISOString(),
      entry_time_ms: latestBar.openTime,
      entry_price: entryPrice,
      stop_loss: clampedStop.stopLoss,
      take_profit: clampedStop.takeProfit,
      stop_distance: clampedStop.stopDist,
      stop_distance_pct: clampedStop.stopDistPct,
      cost_r: clampedStop.costR,
      status: "ACTIVE",
      probability: inference.probability,
      p_cutoff: pCutoff,
      feature_snapshot: features,
      bars_held: 0,
      last_evaluated_bar_time: latestBar.openTime,
    };

    openedTrades.push(newTrade);
    remainingActive.push(newTrade);
    actions.push(
      `[OPEN] ${sym} ${side} entry at ${entryPrice} (SL: ${clampedStop.stopLoss}, TP: ${clampedStop.takeProfit}, Stop%: ${(clampedStop.stopDistPct * 100).toFixed(2)}%, P: ${(inference.probability * 100).toFixed(2)}%)`
    );

    if (db && !isDryRun) {
      try {
        await db
          .collection("paper_trades_1h_commodities")
          .updateOne({ id: newTrade.id }, { $set: newTrade as any }, { upsert: true });
      } catch {
        inMemoryCommodityTrades.set(newTrade.id, newTrade);
      }
    } else {
      inMemoryCommodityTrades.set(newTrade.id, newTrade);
    }
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    evaluated_symbols: Array.from(COMMODITY_SYMBOLS),
    opened_trades: openedTrades,
    active_trades: remainingActive,
    closed_trades: closedTrades,
    skipped_symbols: skippedSymbols,
    actions,
  };
}
