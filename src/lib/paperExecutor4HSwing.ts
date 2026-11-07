/**
 * 4-Hour (4H) Swing Paper Trading Execution Engine
 * Specification: docs/prereg/swing_meta_labeling_4h.md (Amendment 1)
 *
 * Invariants:
 * 1. Universe: BTCUSDT, ETHUSDT, SOLUSDT (4H candlestick cadence).
 * 2. Macro Regime: Close > 200 SMA.
 * 3. Breakout Trigger: Close > max(High of previous 20 completed bars t-20..t-1).
 * 4. Stop Loss: Lowest Low of previous 10 bars (clamped strictly [1.5%, 6.0%]).
 * 5. Target: +2.5R upper barrier; Time Barrier: 12 bars (48 hours).
 * 6. Simultaneous Touch: Collision bookings strictly as Stop Loss (-1.0R).
 * 7. Transaction Friction: 10 bps (0.10%) round-trip deducted from every trade.
 * 8. Meta-Classifier Filter: Top 25% Quantile Gating (P >= P_cutoff = 0.10).
 * 9. Database: MongoDB collection `paper_trades_4h_swing` with resilient in-memory fallback.
 */

import { getDb } from "./mongodb";
import { fetchBinanceKlines } from "./binanceData";
import {
  predictSwingMetaProb,
  SWING_4H_FEATURE_NAMES,
  Swing4HFeatureName,
} from "./swingModelInference";

export const SWING_ASSETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;
export type SwingAsset = typeof SWING_ASSETS[number];

export const ROUND_TRIP_FRICTION_PCT = 0.0010; // 10 bps
export const TARGET_R = 2.5;
export const STOP_R = 1.0;
export const TIME_BARRIER_BARS = 12; // 48 hours on 4H
export const MIN_STOP_PCT = 0.015; // 1.5%
export const MAX_STOP_PCT = 0.060; // 6.0%
export const DEFAULT_P_CUTOFF = 0.10; // Top 25% quantile gating

export interface Swing4HCandle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: number;
}

export interface PaperTrade4HSwingRecord {
  id: string;
  coin: string;
  side: "LONG";
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
  exit_type?: "TARGET" | "STOP" | "TIME";
  gross_r?: number;
  cost_r: number;
  net_r?: number;
  probability: number;
  p_cutoff: number;
  bars_held?: number;
  feature_snapshot?: Record<string, number>;
  last_evaluated_bar_time?: number;
}

export interface Swing4HExecutorResult {
  success: boolean;
  timestamp: string;
  evaluated_symbols: string[];
  opened_trades: PaperTrade4HSwingRecord[];
  active_trades: PaperTrade4HSwingRecord[];
  closed_trades: PaperTrade4HSwingRecord[];
  skipped_symbols: Array<{ symbol: string; reason: string; probability?: number }>;
  actions: string[];
}

// Resilient in-memory fallback store when MongoDB is absent (e.g. offline unit testing)
const inMemoryTrades: Map<string, PaperTrade4HSwingRecord> = new Map();

export function getInMemorySwingTrades(): PaperTrade4HSwingRecord[] {
  return Array.from(inMemoryTrades.values());
}

export function clearInMemorySwingTrades(): void {
  inMemoryTrades.clear();
}

/**
 * Calculates clamped structural stop loss from the lowest low of the past 10 bars:
 * Clamped strictly between 1.5% and 6.0%.
 */
export function computeClampedStop(
  entryPrice: number,
  lowestLow10: number
): { stopLoss: number; stopDistPct: number; stopDist: number; costR: number } {
  const rawDistPct = (entryPrice - lowestLow10) / entryPrice;
  const clampedDistPct = Math.min(MAX_STOP_PCT, Math.max(MIN_STOP_PCT, rawDistPct));
  const stopLoss = Number((entryPrice * (1.0 - clampedDistPct)).toFixed(4));
  const stopDist = Number((entryPrice - stopLoss).toFixed(4));
  const costR = Number((ROUND_TRIP_FRICTION_PCT / clampedDistPct).toFixed(6));

  return {
    stopLoss,
    stopDistPct: clampedDistPct,
    stopDist,
    costR,
  };
}

/**
 * Checks for valid 20-period Donchian Breakout + 200 SMA trend setup on completed bars.
 * Note: uses bars <= t-1 for Donchian reference; bar t is the latest completed candle.
 */
export function checkCandidateBreakoutSignal(
  candles: Swing4HCandle[]
): {
  isBreakout: boolean;
  entryPrice: number;
  lowestLow10: number;
  sma200: number;
  donchianHigh20: number;
  reason?: string;
} {
  if (candles.length < 205) {
    return {
      isBreakout: false,
      entryPrice: 0,
      lowestLow10: 0,
      sma200: 0,
      donchianHigh20: 0,
      reason: `Insufficient candles: requires >= 205, got ${candles.length}`,
    };
  }

  // Bar t is the latest completed candle
  const tIdx = candles.length - 1;
  const barT = candles[tIdx];

  // 1. 200-SMA calculation on completed bars up to t
  const slice200 = candles.slice(tIdx - 199, tIdx + 1);
  const sma200 = slice200.reduce((sum, c) => sum + c.close, 0) / 200;

  if (barT.close <= sma200) {
    return {
      isBreakout: false,
      entryPrice: barT.close,
      lowestLow10: 0,
      sma200,
      donchianHigh20: 0,
      reason: `Trend filter rejected: close (${barT.close}) <= 200 SMA (${sma200.toFixed(2)})`,
    };
  }

  // 2. 20-bar Donchian High on bars t-20 through t-1 (strictly prior to bar t)
  const sliceDonchian = candles.slice(tIdx - 20, tIdx);
  const donchianHigh20 = Math.max(...sliceDonchian.map((c) => c.high));

  if (barT.close <= donchianHigh20) {
    return {
      isBreakout: false,
      entryPrice: barT.close,
      lowestLow10: 0,
      sma200,
      donchianHigh20,
      reason: `No breakout: close (${barT.close}) <= 20-bar high (${donchianHigh20.toFixed(2)})`,
    };
  }

  // 3. Lowest low of the past 10 bars (bars t-10 through t-1)
  const sliceLow10 = candles.slice(tIdx - 10, tIdx);
  const lowestLow10 = Math.min(...sliceLow10.map((c) => c.low));

  return {
    isBreakout: true,
    entryPrice: barT.close,
    lowestLow10,
    sma200,
    donchianHigh20,
  };
}

/**
 * Extracts the 14 canonical swing features matching Python's features.py.
 * Every feature strictly uses data up to bar t-1.
 */
export function extractSwing4HFeatures(
  candles: Swing4HCandle[],
  btcCandles?: Swing4HCandle[],
  fundingRateSeries?: number[],
  openInterestSeries?: number[]
): Record<string, number> {
  const tIdx = candles.length - 1;
  const barLag = candles[tIdx - 1]; // Bar t-1
  const closeLag = barLag.close;

  // 1. Relative Strength vs BTC (3d, 7d, 30d => 18, 42, 180 bars)
  let rs3d = 0.0;
  let rs7d = 0.0;
  let rs30d = 0.0;

  if (btcCandles && btcCandles.length >= 181 && candles.length >= 181) {
    const btcLag = btcCandles[btcCandles.length - 2];
    const assetRet3d = closeLag / candles[tIdx - 1 - 18].close - 1.0;
    const btcRet3d = btcLag.close / btcCandles[btcCandles.length - 2 - 18].close - 1.0;
    rs3d = (1.0 + assetRet3d) / (1.0 + Math.max(-0.99, btcRet3d)) - 1.0;

    const assetRet7d = closeLag / candles[tIdx - 1 - 42].close - 1.0;
    const btcRet7d = btcLag.close / btcCandles[btcCandles.length - 2 - 42].close - 1.0;
    rs7d = (1.0 + assetRet7d) / (1.0 + Math.max(-0.99, btcRet7d)) - 1.0;

    const assetRet30d = closeLag / candles[tIdx - 1 - 180].close - 1.0;
    const btcRet30d = btcLag.close / btcCandles[btcCandles.length - 2 - 180].close - 1.0;
    rs30d = (1.0 + assetRet30d) / (1.0 + Math.max(-0.99, btcRet30d)) - 1.0;
  }

  // 2. Funding Rate Z-Score & OI Deltas
  let fundingZScore = 0.0;
  if (fundingRateSeries && fundingRateSeries.length >= 20) {
    const frSlice = fundingRateSeries.slice(-61, -1);
    const mean = frSlice.reduce((s, v) => s + v, 0) / frSlice.length;
    const variance = frSlice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / frSlice.length;
    const std = Math.sqrt(variance);
    fundingZScore = std > 1e-8 ? (frSlice[frSlice.length - 1] - mean) / std : 0.0;
  }

  let oiDelta1d = 0.0;
  let oiDelta3d = 0.0;
  if (openInterestSeries && openInterestSeries.length >= 19) {
    const oiLag = openInterestSeries[openInterestSeries.length - 2];
    const oiPrev6 = openInterestSeries[openInterestSeries.length - 2 - 6];
    const oiPrev18 = openInterestSeries[openInterestSeries.length - 2 - 18];
    if (oiPrev6 > 0) oiDelta1d = oiLag / oiPrev6 - 1.0;
    if (oiPrev18 > 0) oiDelta3d = oiLag / oiPrev18 - 1.0;
  }

  // 3. EWMA Volatility Ratio (30-day baseline = 180 bars)
  const returns: number[] = [];
  for (let i = 1; i <= tIdx - 1; i++) {
    returns.push(candles[i].close / candles[i - 1].close - 1.0);
  }

  let ewmaVar = 0.0;
  const decay = 0.94;
  for (const r of returns) {
    ewmaVar = decay * ewmaVar + (1.0 - decay) * (r * r);
  }
  const ewmaVol = Math.sqrt(ewmaVar);

  const baselineSlice = returns.slice(-180);
  const baselineMean = baselineSlice.reduce((s, v) => s + v, 0) / baselineSlice.length;
  const baselineVar =
    baselineSlice.reduce((s, v) => s + Math.pow(v - baselineMean, 2), 0) / baselineSlice.length;
  const baselineStd = Math.max(1e-6, Math.sqrt(baselineVar));
  const volRatio30d = ewmaVol / baselineStd;

  // 4. Volume Z-score (20-period)
  const volSlice = candles.slice(tIdx - 20, tIdx).map((c) => c.volume);
  const volMean = volSlice.reduce((s, v) => s + v, 0) / 20;
  const volVar = volSlice.reduce((s, v) => s + Math.pow(v - volMean, 2), 0) / 20;
  const volStd = Math.max(1e-8, Math.sqrt(volVar));
  const volumeZScore20 = (barLag.volume - volMean) / volStd;

  // 5. Exponential & Simple Moving Averages
  const closesLagged = candles.slice(0, tIdx).map((c) => c.close);

  // EMA 20
  const alpha20 = 2 / (20 + 1);
  let ema20 = closesLagged[0];
  for (let i = 1; i < closesLagged.length; i++) {
    ema20 = alpha20 * closesLagged[i] + (1 - alpha20) * ema20;
  }

  // EMA 50
  const alpha50 = 2 / (50 + 1);
  let ema50 = closesLagged[0];
  for (let i = 1; i < closesLagged.length; i++) {
    ema50 = alpha50 * closesLagged[i] + (1 - alpha50) * ema50;
  }

  // SMA 200
  const sliceSMA200 = closesLagged.slice(-200);
  const sma200 = sliceSMA200.reduce((s, v) => s + v, 0) / sliceSMA200.length;

  const distEma20 = (closeLag - ema20) / (ema20 + 1e-8);
  const distEma50 = (closeLag - ema50) / (ema50 + 1e-8);
  const distSma200 = (closeLag - sma200) / (sma200 + 1e-8);
  const trendAligned = closeLag > ema50 && ema50 > sma200 ? 1.0 : 0.0;

  // 6. Donchian Position 20-period
  const donchSlice = candles.slice(tIdx - 20, tIdx);
  const donchHigh = Math.max(...donchSlice.map((c) => c.high));
  const donchLow = Math.min(...donchSlice.map((c) => c.low));
  const donchRange = Math.max(1e-8, donchHigh - donchLow);
  const donchianPos20 = (closeLag - donchLow) / donchRange;

  // 7. ATR (14-period)
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
  const atr = trs.reduce((s, v) => s + v, 0) / trs.length;
  const atrPct = atr / (closeLag + 1e-8);

  return {
    rs_vs_btc_3d: Number(rs3d.toFixed(6)),
    rs_vs_btc_7d: Number(rs7d.toFixed(6)),
    rs_vs_btc_30d: Number(rs30d.toFixed(6)),
    funding_rate_zscore: Number(fundingZScore.toFixed(6)),
    oi_delta_1d: Number(oiDelta1d.toFixed(6)),
    oi_delta_3d: Number(oiDelta3d.toFixed(6)),
    vol_ratio_30d: Number(volRatio30d.toFixed(6)),
    volume_zscore_20: Number(volumeZScore20.toFixed(6)),
    dist_ema_20: Number(distEma20.toFixed(6)),
    dist_ema_50: Number(distEma50.toFixed(6)),
    dist_sma_200: Number(distSma200.toFixed(6)),
    trend_aligned: trendAligned,
    donchian_pos_20: Number(donchianPos20.toFixed(6)),
    atr_pct: Number(atrPct.toFixed(6)),
  };
}

/**
 * Evaluates an active trade against a completed 4H candlestick bar.
 * Invariant: Simultaneous touch books Stop Loss (-1.0R).
 */
export function evaluateActiveTradeOnBar(
  trade: PaperTrade4HSwingRecord,
  bar: Swing4HCandle,
  barsHeld: number
): {
  closed: boolean;
  exitType?: "TARGET" | "STOP" | "TIME";
  exitPrice?: number;
  grossR?: number;
} {
  const hitTarget = bar.high >= trade.take_profit;
  const hitStop = bar.low <= trade.stop_loss;

  // Simultaneous Touch Collision Invariant: Stop Loss takes precedence (-1.0R)
  if (hitStop && hitTarget) {
    return {
      closed: true,
      exitType: "STOP",
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

  // Time Barrier Hit (12 bars / 48 hours)
  if (barsHeld >= TIME_BARRIER_BARS) {
    const grossR = (bar.close - trade.entry_price) / trade.stop_distance;
    return {
      closed: true,
      exitType: "TIME",
      exitPrice: bar.close,
      grossR: Number(grossR.toFixed(4)),
    };
  }

  return { closed: false };
}

/**
 * Main Paper Executor for 4H Swing Meta-Labeling Engine.
 * Evaluates active trades, scans candidate breakout setups, and opens new gated trades.
 */
export async function runPaper4HSwingExecutor(options?: {
  isDryRun?: boolean;
  customCutoff?: number;
  livePriceMap?: Record<string, number>;
  customCandlesMap?: Record<string, Swing4HCandle[]>;
  baseDir?: string;
}): Promise<Swing4HExecutorResult> {
  const isDryRun = options?.isDryRun ?? false;
  const pCutoff = options?.customCutoff ?? DEFAULT_P_CUTOFF;
  const actions: string[] = [];
  const openedTrades: PaperTrade4HSwingRecord[] = [];
  const closedTrades: PaperTrade4HSwingRecord[] = [];
  const skippedSymbols: Array<{ symbol: string; reason: string; probability?: number }> = [];

  let db: any = null;
  try {
    db = await getDb();
  } catch {
    db = null;
  }

  // 1. Load active trades from DB or in-memory store
  let activeTrades: PaperTrade4HSwingRecord[] = [];
  if (db && !isDryRun) {
    try {
      const records = await db
        .collection("paper_trades_4h_swing")
        .find({ status: "ACTIVE" })
        .toArray();
      activeTrades = records.map((r: any) => ({ ...r, id: r.id || r._id.toString() }));
    } catch {
      activeTrades = Array.from(inMemoryTrades.values()).filter((t) => t.status === "ACTIVE");
    }
  } else {
    activeTrades = Array.from(inMemoryTrades.values()).filter((t) => t.status === "ACTIVE");
  }

  // 2. Ingest 4H candles for all universe assets
  const candleMap: Record<string, Swing4HCandle[]> = {};
  for (const sym of SWING_ASSETS) {
    if (options?.customCandlesMap && options.customCandlesMap[sym]) {
      candleMap[sym] = options.customCandlesMap[sym];
    } else {
      try {
        const raw = await fetchBinanceKlines("4h", 250, 10000, sym);
        candleMap[sym] = raw.map((c) => ({
          openTime: c.openTime,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          closeTime: c.closeTime || c.openTime + 4 * 3600 * 1000 - 1,
        }));
      } catch (err: any) {
        actions.push(`[4H SWING ${sym}] Failed to fetch klines: ${err?.message}`);
      }
    }
  }

  const btcCandles = candleMap["BTCUSDT"] || [];

  // 3. Evaluate Active Trades
  const remainingActiveTrades: PaperTrade4HSwingRecord[] = [];
  for (const trade of activeTrades) {
    const symCandles = candleMap[trade.coin];
    if (!symCandles || symCandles.length === 0) {
      remainingActiveTrades.push(trade);
      continue;
    }

    // Evaluate against candles that opened after trade entry
    const entryTime = trade.entry_time_ms;
    const postEntryCandles = symCandles.filter((c) => c.openTime > entryTime);

    let tradeClosed = false;
    let evalBarCount = trade.bars_held ?? 0;

    for (let i = 0; i < postEntryCandles.length; i++) {
      const bar = postEntryCandles[i];
      evalBarCount = i + 1;

      const evalRes = evaluateActiveTradeOnBar(trade, bar, evalBarCount);
      if (evalRes.closed) {
        tradeClosed = true;
        const grossR = evalRes.grossR ?? -STOP_R;
        const netR = Number((grossR - trade.cost_r).toFixed(4));
        const exitTime = new Date(bar.closeTime || bar.openTime + 4 * 3600 * 1000).toISOString();

        trade.status = "CLOSED";
        trade.exit_type = evalRes.exitType;
        trade.exit_price = evalRes.exitPrice;
        trade.exit_time = exitTime;
        trade.gross_r = grossR;
        trade.net_r = netR;
        trade.bars_held = evalBarCount;
        trade.last_evaluated_bar_time = bar.openTime;

        if (db && !isDryRun) {
          try {
            await db.collection("paper_trades_4h_swing").updateOne(
              { id: trade.id },
              {
                $set: {
                  status: "CLOSED",
                  exit_type: trade.exit_type,
                  exit_price: trade.exit_price,
                  exit_time: trade.exit_time,
                  gross_r: trade.gross_r,
                  net_r: trade.net_r,
                  bars_held: trade.bars_held,
                  last_evaluated_bar_time: trade.last_evaluated_bar_time,
                },
              }
            );
          } catch (err: any) {
            actions.push(`[4H SWING DB] Failed to update trade ${trade.id}: ${err?.message}`);
          }
        }
        inMemoryTrades.set(trade.id, { ...trade });
        closedTrades.push(trade);
        actions.push(
          `[4H SWING ${trade.coin}] Trade ${trade.id} CLOSED: ${trade.exit_type} @ $${trade.exit_price?.toFixed(2)} (Gross: ${trade.gross_r}R, Net: ${trade.net_r}R)`
        );
        break;
      }
    }

    if (!tradeClosed) {
      trade.bars_held = evalBarCount;
      if (postEntryCandles.length > 0) {
        trade.last_evaluated_bar_time = postEntryCandles[postEntryCandles.length - 1].openTime;
      }
      remainingActiveTrades.push(trade);
      inMemoryTrades.set(trade.id, { ...trade });
    }
  }

  // 4. Scan for New Breakout Opportunities
  for (const sym of SWING_ASSETS) {
    const candles = candleMap[sym];
    if (!candles || candles.length < 205) {
      skippedSymbols.push({
        symbol: sym,
        reason: `Insufficient candles (${candles?.length ?? 0} < 205)`,
      });
      continue;
    }

    // Check if symbol already has an active trade
    const hasActivePosition = remainingActiveTrades.some((t) => t.coin === sym);
    if (hasActivePosition) {
      skippedSymbols.push({
        symbol: sym,
        reason: "Position already active",
      });
      continue;
    }

    // Evaluate breakout setup on latest completed closed candles (candles[0..N-2])
    // The last element in Binance klines is the active forming bar; candle[length - 2] is the completed bar
    const closedCandles = candles.slice(0, -1);
    const setup = checkCandidateBreakoutSignal(closedCandles);

    if (!setup.isBreakout) {
      skippedSymbols.push({
        symbol: sym,
        reason: setup.reason || "Setup conditions not met",
      });
      continue;
    }

    // Extract features for meta-classifier inference
    const features = extractSwing4HFeatures(closedCandles, btcCandles);

    // Run LightGBM meta-classifier
    let inferenceRes;
    try {
      inferenceRes = predictSwingMetaProb(features, pCutoff, options?.baseDir);
    } catch (err: any) {
      skippedSymbols.push({
        symbol: sym,
        reason: `Model inference error: ${err?.message}`,
      });
      continue;
    }

    // Quantile Gating: Require P >= P_cutoff (Top 25% conviction)
    if (!inferenceRes.passesGate) {
      skippedSymbols.push({
        symbol: sym,
        reason: `Filtered by AI Meta-Classifier: P(${inferenceRes.probability.toFixed(4)}) < P_cutoff(${pCutoff.toFixed(4)})`,
        probability: inferenceRes.probability,
      });
      actions.push(
        `[4H SWING ${sym} FILTERED] Breakout detected but blocked by AI: P=${inferenceRes.probability.toFixed(4)} < ${pCutoff.toFixed(4)}`
      );
      continue;
    }

    // Trade Qualified: Execute Entry
    const lastClosedBar = closedCandles[closedCandles.length - 1];
    const livePrice = options?.livePriceMap?.[sym] ?? lastClosedBar.close;
    const { stopLoss, stopDistPct, stopDist, costR } = computeClampedStop(
      livePrice,
      setup.lowestLow10
    );
    const takeProfit = Number((livePrice + TARGET_R * stopDist).toFixed(4));
    const tradeId = `paper-swing-4h-${sym}-${lastClosedBar.openTime}`;

    const newTrade: PaperTrade4HSwingRecord = {
      id: tradeId,
      coin: sym,
      side: "LONG",
      signal_time: new Date(lastClosedBar.openTime).toISOString(),
      entry_time: new Date().toISOString(),
      entry_time_ms: lastClosedBar.openTime,
      entry_price: livePrice,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      stop_distance_pct: stopDistPct,
      stop_distance: stopDist,
      status: "ACTIVE",
      cost_r: costR,
      probability: inferenceRes.probability,
      p_cutoff: pCutoff,
      bars_held: 0,
      feature_snapshot: features,
      last_evaluated_bar_time: lastClosedBar.openTime,
    };

    if (db && !isDryRun) {
      try {
        await db.collection("paper_trades_4h_swing").insertOne(newTrade);
      } catch (err: any) {
        actions.push(`[4H SWING DB] Insert trade failed: ${err?.message}`);
      }
    }
    inMemoryTrades.set(newTrade.id, newTrade);
    openedTrades.push(newTrade);
    remainingActiveTrades.push(newTrade);

    actions.push(
      `[4H SWING ${sym} ENTRY] Opened LONG @ $${livePrice.toFixed(2)} | SL: $${stopLoss.toFixed(2)} (-${(stopDistPct * 100).toFixed(2)}%) | TP: $${takeProfit.toFixed(2)} (+2.5R) | P: ${inferenceRes.probability.toFixed(4)}`
    );
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    evaluated_symbols: Array.from(SWING_ASSETS),
    opened_trades: openedTrades,
    active_trades: remainingActiveTrades,
    closed_trades: closedTrades,
    skipped_symbols: skippedSymbols,
    actions,
  };
}
