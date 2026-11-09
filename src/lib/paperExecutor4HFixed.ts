/**
 * Clean, Honest, No-ML Fixed-Rule 4H Trend Engine Executor (v2)
 * Single Source of Truth: config/fixed_rule_4h_v1.json
 *
 * Architecture & Governance Invariants:
 * 1. Timeframe: 4H completed candles; Universe: BTCUSDT, ETHUSDT.
 * 2. Gate 1 Zero-Lookahead: Signal evaluated strictly on closed bar t.
 * 3. Gate 3 Execution Realism: Entry filled strictly at Open of bar t+1.
 * 4. Structural Invalidation: 10-bar Donchian low/high stop clamped strictly [2.3%, 6.0%] (or skipped in 'skip' mode).
 * 5. Trailing Exit: 3 x ATR14 Chandelier trailing stop anchored to highest/lowest close, updated from next bar after entry.
 * 6. Gate 3 Collision Rule: Same-bar stop + trail collision prioritizes STOP.
 * 7. Gate 4 Cost Model: Single constant TAKER friction (0.1144% round-trip) from feeModel.ts (cost_R <= 0.05).
 * 8. Gate 6 Dynamic Risk Normalization: INR 70 risk per trade (1% of INR 7,000 capital).
 * 9. Portfolio Risk Cap: Max 2 concurrent positions across BTC + ETH (2% capital risk cap).
 * 10. Persistence: Writes to data/trades_4h_fixed.json and MongoDB collection paper_trades_4h_fixed.
 */

import fs from "fs";
import path from "path";
import { getDb } from "./mongodb";
import { computeRoundTripFrictionPercent } from "./feeModel";
import {
  checkCostRFilter,
  checkDailyLossLimit,
  evaluateRollingKillSwitch,
  checkDrawdownStop,
} from "./riskEngine";
import { TradeOrder } from "./engineTypes";

export const FIXED_4H_ASSETS = ["BTCUSDT", "ETHUSDT"] as const;
export type Fixed4HAsset = (typeof FIXED_4H_ASSETS)[number];

export interface Candle4H {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: number;
  datetime?: string;
}

export interface FixedRule4HConfig {
  version: string;
  engine_name: string;
  timeframe: string;
  assets: string[];
  entry: {
    donchian_lookback: number;
    sma_filter_period: number;
    eval_bar: string;
    fill_bar: string;
  };
  filters: {
    ema_period: number;
    ema_slope_bars: number;
    ema_slope_threshold: number;
    stretch_atr_mult: number;
    min_body_atr_ratio: number;
    close_quantile_ratio: number;
    min_volume_mult: number;
    volume_sma_period: number;
    atr_period: number;
  };
  btc_regime_gate: {
    enabled_for_alts: boolean;
    btc_symbol: string;
    btc_sma_period: number;
    btc_ema_period: number;
    btc_ema_slope_bars: number;
    btc_ema_slope_min: number;
  };
  stop: {
    lookback_bars: number;
    min_stop_pct: number;
    max_stop_pct: number;
    clamp_mode: "skip" | "clamp";
  };
  exit: {
    type: string;
    chandelier_atr_mult: number;
    chandelier_atr_period: number;
    chandelier_anchor: string;
    chandelier_activation: string;
    max_hold_bars: number;
  };
  execution_realism: {
    same_bar_ambiguity: string;
    trail_update_delay: string;
  };
  costs: {
    taker_round_trip_friction: number;
    funding_rate_fallback_8h_long: number;
    funding_rate_fallback_8h_short: number;
    use_binance_funding_history: boolean;
  };
  sizing: {
    starting_capital_inr: number;
    risk_per_trade_pct: number;
    risk_per_trade_inr: number;
    max_total_open_risk_pct: number;
    max_concurrent_positions: number;
    correlated_group: boolean;
  };
  direction: "LONG" | "SHORT" | "BOTH";
}

// Canonical Fallback Configuration matching config/fixed_rule_4h_v1.json
export const DEFAULT_FIXED_4H_CONFIG: FixedRule4HConfig = {
  version: "1.0.0",
  engine_name: "fixed_rule_4h_v1",
  timeframe: "4h",
  assets: ["BTCUSDT", "ETHUSDT"],
  entry: {
    donchian_lookback: 20,
    sma_filter_period: 200,
    eval_bar: "closed_bar_t",
    fill_bar: "open_bar_t_plus_1",
  },
  filters: {
    ema_period: 50,
    ema_slope_bars: 10,
    ema_slope_threshold: 0.0005,
    stretch_atr_mult: 3.0,
    min_body_atr_ratio: 0.25,
    close_quantile_ratio: 0.60,
    min_volume_mult: 0.85,
    volume_sma_period: 50,
    atr_period: 14,
  },
  btc_regime_gate: {
    enabled_for_alts: true,
    btc_symbol: "BTCUSDT",
    btc_sma_period: 200,
    btc_ema_period: 50,
    btc_ema_slope_bars: 10,
    btc_ema_slope_min: 0.0,
  },
  stop: {
    lookback_bars: 10,
    min_stop_pct: 0.023,
    max_stop_pct: 0.06,
    clamp_mode: "skip",
  },
  exit: {
    type: "chandelier_trailing",
    chandelier_atr_mult: 3.0,
    chandelier_atr_period: 14,
    chandelier_anchor: "highest_close",
    chandelier_activation: "next_bar_after_entry",
    max_hold_bars: 42,
  },
  execution_realism: {
    same_bar_ambiguity: "stop_first",
    trail_update_delay: "next_bar",
  },
  costs: {
    taker_round_trip_friction: 0.001144,
    funding_rate_fallback_8h_long: 0.0001,
    funding_rate_fallback_8h_short: 0.0,
    use_binance_funding_history: true,
  },
  sizing: {
    starting_capital_inr: 7000.0,
    risk_per_trade_pct: 1.0,
    risk_per_trade_inr: 70.0,
    max_total_open_risk_pct: 2.0,
    max_concurrent_positions: 2,
    correlated_group: true,
  },
  direction: "BOTH",
};

export function loadFixedRuleConfig(customPath?: string): FixedRule4HConfig {
  try {
    const candidatePaths = [
      customPath,
      path.resolve(process.cwd(), "config/fixed_rule_4h_v1.json"),
      path.resolve(process.cwd(), "Trader-Pro-Dashboard/config/fixed_rule_4h_v1.json"),
      path.resolve(__dirname, "../../config/fixed_rule_4h_v1.json"),
    ].filter(Boolean) as string[];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        return JSON.parse(raw) as FixedRule4HConfig;
      }
    }
  } catch {
    // Return default config if file read fails
  }
  return DEFAULT_FIXED_4H_CONFIG;
}

export interface PaperTrade4HFixedRecord {
  id: string;
  coin: string;
  side: "LONG" | "SHORT";
  signal_time: string;
  signal_bar_time: number;
  entry_time: string;
  entry_time_ms: number;
  exit_time?: string;
  entry_price: number;
  exit_price?: number;
  initial_stop: number;
  active_stop: number;
  anchor_close: number;
  stop_dist_pct: number;
  risk_inr: number;
  position_size_inr: number;
  status: "ACTIVE" | "CLOSED";
  exit_type?: "STOP" | "TRAIL" | "TIME";
  gross_r?: number;
  fee_r?: number;
  funding_r?: number;
  net_r?: number;
  net_pnl_inr?: number;
  bars_held?: number;
  clamped_flag: boolean;
  last_evaluated_bar_time?: number;
}

export interface Fixed4HExecutorResult {
  success: boolean;
  timestamp: string;
  evaluated_symbols: string[];
  opened_trades: PaperTrade4HFixedRecord[];
  active_trades: PaperTrade4HFixedRecord[];
  closed_trades: PaperTrade4HFixedRecord[];
  skipped_symbols: Array<{ symbol: string; reason: string }>;
  actions: string[];
}

// In-Memory trade state for local execution and test isolation
const inMemoryFixedTrades: Map<string, PaperTrade4HFixedRecord> = new Map();

export function getInMemoryFixedTrades(): PaperTrade4HFixedRecord[] {
  return Array.from(inMemoryFixedTrades.values());
}

export function clearInMemoryFixedTrades(): void {
  inMemoryFixedTrades.clear();
}

// File Storage persistence helper
function getDataFilePath(): string {
  const primary = path.resolve(process.cwd(), "data/trades_4h_fixed.json");
  const fallback = path.resolve(process.cwd(), "Trader-Pro-Dashboard/data/trades_4h_fixed.json");
  return fs.existsSync(path.dirname(primary)) ? primary : fallback;
}

export function loadTradesFromFile(): PaperTrade4HFixedRecord[] {
  try {
    const fpath = getDataFilePath();
    if (fs.existsSync(fpath)) {
      const data = fs.readFileSync(fpath, "utf-8");
      return JSON.parse(data) as PaperTrade4HFixedRecord[];
    }
  } catch {
    // Ignore error and return in-memory
  }
  return getInMemoryFixedTrades();
}

export function saveTradesToFile(trades: PaperTrade4HFixedRecord[]): void {
  try {
    const fpath = getDataFilePath();
    const dir = path.dirname(fpath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fpath, JSON.stringify(trades, null, 2), "utf-8");
  } catch (err: any) {
    console.error(`[FixedRule4H] Failed to persist trades to JSON file: ${err?.message}`);
  }
}

// ============================================================================
// MATHEMATICAL INDICATORS (EXACT NUMERICAL MATCH WITH PYTHON PANDAS / NUMPY)
// ============================================================================

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      result[i] = sum / period;
    }
  }
  return result;
}

/**
 * Exponential Moving Average (EMA) with adjust=false
 * Matching pandas: Series(values).ewm(span=period, adjust=False).mean()
 */
export function calculateEMA(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  if (values.length === 0) return result;

  const alpha = 2.0 / (period + 1.0);
  let ema = values[0];
  result[0] = ema;

  for (let i = 1; i < values.length; i++) {
    ema = alpha * values[i] + (1.0 - alpha) * ema;
    result[i] = ema;
  }
  return result;
}

/**
 * True Range & 14-period Rolling Mean ATR
 * Matching Python backtest:
 * prev_c = np.roll(c, 1)
 * tr = max(h - l, abs(h - prev_c), abs(l - prev_c))
 * atr14 = Series(tr).rolling(14).mean()
 */
export function calculateATR14(candles: Candle4H[], period: number = 14): { tr: number[]; atr14: number[] } {
  const n = candles.length;
  const tr: number[] = new Array(n).fill(0);
  const atr14: number[] = new Array(n).fill(NaN);

  if (n === 0) return { tr, atr14 };

  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < n; i++) {
    const prevC = candles[i - 1].close;
    const h = candles[i].high;
    const l = candles[i].low;
    tr[i] = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
  }

  // 14-period rolling mean
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += tr[i];
    if (i >= period) {
      sum -= tr[i - period];
    }
    if (i >= period - 1) {
      atr14[i] = sum / period;
    }
  }

  return { tr, atr14 };
}

/**
 * Donchian Channel High/Low shifted by 1 bar (bars t-lookback to t-1)
 */
export function calculateShiftedDonchian(
  candles: Candle4H[],
  lookback: number = 20
): { dh: number[]; dl: number[] } {
  const n = candles.length;
  const dh: number[] = new Array(n).fill(NaN);
  const dl: number[] = new Array(n).fill(NaN);

  for (let t = lookback; t < n; t++) {
    let maxHigh = -Infinity;
    let minLow = Infinity;
    for (let j = t - lookback; j < t; j++) {
      if (candles[j].high > maxHigh) maxHigh = candles[j].high;
      if (candles[j].low < minLow) minLow = candles[j].low;
    }
    dh[t] = maxHigh;
    dl[t] = minLow;
  }

  return { dh, dl };
}

/**
 * Structural Invalidation Levels (10-bar low/high shifted by 1 bar: bars t-10 to t-1)
 */
export function calculateStructuralLevels(
  candles: Candle4H[],
  lookback: number = 10
): { ll10: number[]; hh10: number[] } {
  const n = candles.length;
  const ll10: number[] = new Array(n).fill(NaN);
  const hh10: number[] = new Array(n).fill(NaN);

  for (let t = lookback; t < n; t++) {
    let minLow = Infinity;
    let maxHigh = -Infinity;
    for (let j = t - lookback; j < t; j++) {
      if (candles[j].low < minLow) minLow = candles[j].low;
      if (candles[j].high > maxHigh) maxHigh = candles[j].high;
    }
    ll10[t] = minLow;
    hh10[t] = maxHigh;
  }

  return { ll10, hh10 };
}

// ============================================================================
// SIGNAL DETECTOR ON CLOSED BAR t
// ============================================================================

export interface SignalCheckResult {
  signal: "LONG" | "SHORT";
  signalBarIndex: number;
  signalTime: string;
  signalTimeMs: number;
  entryPriceEstimate: number; // For evaluation; fill strictly at Open of t+1
  rawStopPct: number;
  stopPct: number;
  initialStopPrice: number;
  isClamped: boolean;
  atr14: number;
  sma200: number;
  ema50: number;
  emaSlope: number;
}

export function checkSignalOnBar(
  symbol: string,
  candles: Candle4H[],
  t: number,
  btcCandles?: Candle4H[],
  cfg: FixedRule4HConfig = DEFAULT_FIXED_4H_CONFIG
): SignalCheckResult | null {
  if (t < 200 || t >= candles.length) return null;

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);

  const sma200Arr = calculateSMA(closes, cfg.entry.sma_filter_period);
  const ema50Arr = calculateEMA(closes, cfg.filters.ema_period);
  const volSmaArr = calculateSMA(volumes, cfg.filters.volume_sma_period);
  const { atr14: atrArr } = calculateATR14(candles, cfg.filters.atr_period);
  const { dh, dl } = calculateShiftedDonchian(candles, cfg.entry.donchian_lookback);
  const { ll10, hh10 } = calculateStructuralLevels(candles, cfg.stop.lookback_bars);

  const curC = candles[t].close;
  const curO = candles[t].open;
  const curH = candles[t].high;
  const curL = candles[t].low;
  const curV = candles[t].volume;
  const curAtr = atrArr[t];
  const curSma200 = sma200Arr[t];
  const curEma50 = ema50Arr[t];
  const curVolSma = volSmaArr[t];

  if (isNaN(curSma200) || isNaN(curAtr) || curAtr <= 0) return null;

  // 1. Core Donchian Breakout + SMA200 Trend Filter
  const ruleLong = curC > curSma200 && curC > dh[t];
  const ruleShort = curC < curSma200 && curC < dl[t];

  if (!ruleLong && !ruleShort) return null;

  // Direction filter
  if (cfg.direction === "LONG" && !ruleLong) return null;
  if (cfg.direction === "SHORT" && !ruleShort) return null;

  // 2. BTC Macro Regime Gate for Altcoins (ETH)
  if (cfg.btc_regime_gate.enabled_for_alts && symbol !== cfg.btc_regime_gate.btc_symbol) {
    if (!btcCandles || btcCandles.length <= t) return null;
    const btcCloses = btcCandles.map((c) => c.close);
    const btcSma = calculateSMA(btcCloses, cfg.btc_regime_gate.btc_sma_period);
    const btcEma = calculateEMA(btcCloses, cfg.btc_regime_gate.btc_ema_period);
    const btcSlopeBars = cfg.btc_regime_gate.btc_ema_slope_bars;

    if (t < btcSlopeBars) return null;
    const btcSlope = (btcEma[t] - btcEma[t - btcSlopeBars]) / btcEma[t - btcSlopeBars];
    const btcClose = btcCloses[t];

    const btcBull = btcClose > btcSma[t] && btcSlope > cfg.btc_regime_gate.btc_ema_slope_min;
    const btcBear = btcClose < btcSma[t] && btcSlope < -cfg.btc_regime_gate.btc_ema_slope_min;

    if (ruleLong && !btcBull) return null;
    if (ruleShort && !btcBear) return null;
  }

  // 3. EMA50 Slope Filter over 10 bars
  const slopeBars = cfg.filters.ema_slope_bars;
  if (t < slopeBars) return null;
  const emaSlope = (curEma50 - ema50Arr[t - slopeBars]) / ema50Arr[t - slopeBars];
  if (ruleLong && emaSlope <= cfg.filters.ema_slope_threshold) return null;
  if (ruleShort && emaSlope >= -cfg.filters.ema_slope_threshold) return null;

  // 4. Rubber Band Stretch Cap
  const stretch = Math.abs(curC - curEma50) / curAtr;
  if (stretch > cfg.filters.stretch_atr_mult) return null;

  // 5. Decisive Body & Quantile Close
  const candleRange = curH - curL;
  if (candleRange <= 0) return null;
  const body = Math.abs(curC - curO);
  if (body / curAtr < cfg.filters.min_body_atr_ratio) return null;

  if (ruleLong && curC - curL < cfg.filters.close_quantile_ratio * candleRange) return null;
  if (ruleShort && curH - curC < cfg.filters.close_quantile_ratio * candleRange) return null;

  // 6. Volume Confirmation
  if (curV < cfg.filters.min_volume_mult * curVolSma) return null;

  const direction: "LONG" | "SHORT" = ruleLong ? "LONG" : "SHORT";
  const isLong = direction === "LONG";

  // Use close of bar t as estimate for initial invalidation distance
  // (True entry price and fill will occur strictly at Open of t+1)
  const estEntryPrice = curC;
  const rawStop = isLong
    ? (estEntryPrice - ll10[t]) / estEntryPrice
    : (hh10[t] - estEntryPrice) / estEntryPrice;

  const minStop = cfg.stop.min_stop_pct;
  const maxStop = cfg.stop.max_stop_pct;
  const isOutsideClamp = rawStop < minStop || rawStop > maxStop;

  if (cfg.stop.clamp_mode === "skip" && isOutsideClamp) {
    return null; // Skip trade if outside 2.3% - 6.0% invalidation window
  }

  const stopDist = Math.min(maxStop, Math.max(minStop, rawStop));
  const initialStopPrice = isLong
    ? estEntryPrice * (1.0 - stopDist)
    : estEntryPrice * (1.0 + stopDist);

  const sigTime = candles[t].datetime || new Date(candles[t].openTime).toISOString();

  return {
    signal: direction,
    signalBarIndex: t,
    signalTime: sigTime,
    signalTimeMs: candles[t].openTime,
    entryPriceEstimate: estEntryPrice,
    rawStopPct: Number(rawStop.toFixed(5)),
    stopPct: Number(stopDist.toFixed(5)),
    initialStopPrice: Number(initialStopPrice.toFixed(4)),
    isClamped: isOutsideClamp,
    atr14: Number(curAtr.toFixed(4)),
    sma200: Number(curSma200.toFixed(4)),
    ema50: Number(curEma50.toFixed(4)),
    emaSlope: Number(emaSlope.toFixed(6)),
  };
}

// ============================================================================
// ACTIVE TRADE EVALUATOR ON INCOMING CANDLE
// ============================================================================

export interface TradeBarEvaluationResult {
  closed: boolean;
  exitType?: "STOP" | "TRAIL" | "TIME";
  exitPrice?: number;
  exitTime?: string;
  grossR?: number;
  feeR?: number;
  fundingR?: number;
  netR?: number;
  netPnLINR?: number;
  updatedActiveStop: number;
  updatedAnchorClose: number;
}

export function evaluateActiveTradeOnBar(
  trade: PaperTrade4HFixedRecord,
  candle: Candle4H,
  evalBarCount: number, // 0 = entry bar (t+1), 1 = first post-entry bar (t+2), etc.
  atr14: number,
  cfg: FixedRule4HConfig = DEFAULT_FIXED_4H_CONFIG
): TradeBarEvaluationResult {
  const isLong = trade.side === "LONG";
  const bO = candle.open;
  const bH = candle.high;
  const bL = candle.low;
  const bC = candle.close;
  const activeStop = trade.active_stop;
  const initialStop = trade.initial_stop;
  const entryPrice = trade.entry_price;
  const stopDist = trade.stop_dist_pct;

  let closed = false;
  let exitType: "STOP" | "TRAIL" | "TIME" | undefined;
  let exitPrice: number | undefined;

  // 1. Evaluate Stop on Current Bar against activeStop
  // Execution Realism (Gate 3): stop collision beats trail; gap open beyond stop fills at open
  if (isLong) {
    if (bL <= activeStop) {
      exitPrice = Math.min(bO, activeStop);
      exitType = Math.abs(activeStop - initialStop) < 1e-6 ? "STOP" : "TRAIL";
      closed = true;
    }
  } else {
    if (bH >= activeStop) {
      exitPrice = Math.max(bO, activeStop);
      exitType = Math.abs(activeStop - initialStop) < 1e-6 ? "STOP" : "TRAIL";
      closed = true;
    }
  }

  // 2. Max Hold Time Exit (42 bars)
  if (!closed && evalBarCount >= cfg.exit.max_hold_bars) {
    closed = true;
    exitType = "TIME";
    exitPrice = bC;
  }

  let nextActiveStop = activeStop;
  let nextAnchorClose = trade.anchor_close;

  // 3. Trailing Stop Update at Close of Bar (Takes effect on next bar)
  if (!closed) {
    const chandelierMult = cfg.exit.chandelier_atr_mult;
    if (isLong) {
      if (bC > nextAnchorClose) nextAnchorClose = bC;
      const candSl = nextAnchorClose - chandelierMult * atr14;
      if (candSl > nextActiveStop) {
        nextActiveStop = candSl;
      }
    } else {
      if (bC < nextAnchorClose) nextAnchorClose = bC;
      const candSl = nextAnchorClose + chandelierMult * atr14;
      if (candSl < nextActiveStop) {
        nextActiveStop = candSl;
      }
    }
  }

  if (closed && exitPrice !== undefined && exitType !== undefined) {
    const rawReturn = isLong
      ? (exitPrice - entryPrice) / entryPrice
      : (entryPrice - exitPrice) / entryPrice;
    const grossR = Number((rawReturn / stopDist).toFixed(4));

    // Friction in R units
    const takerFriction = cfg.costs.taker_round_trip_friction; // 0.001144
    const feeR = Number((takerFriction / stopDist).toFixed(4));

    // Conservative Funding Rate in R
    const hoursHeld = evalBarCount * 4.0;
    const periods8h = Math.max(1.0, hoursHeld / 8.0);
    const fundingRateTotal = isLong
      ? periods8h * cfg.costs.funding_rate_fallback_8h_long
      : periods8h * cfg.costs.funding_rate_fallback_8h_short;
    const fundingR = Number((fundingRateTotal / stopDist).toFixed(4));

    const netR = Number((grossR - feeR - fundingR).toFixed(4));
    const netPnLINR = Number((netR * trade.risk_inr).toFixed(2));
    const exitTime = candle.datetime || new Date(candle.closeTime || candle.openTime + 4 * 3600 * 1000).toISOString();

    return {
      closed: true,
      exitType,
      exitPrice: Number(exitPrice.toFixed(4)),
      exitTime,
      grossR,
      feeR,
      fundingR,
      netR,
      netPnLINR,
      updatedActiveStop: nextActiveStop,
      updatedAnchorClose: nextAnchorClose,
    };
  }

  return {
    closed: false,
    updatedActiveStop: nextActiveStop,
    updatedAnchorClose: nextAnchorClose,
  };
}

// ============================================================================
// MAIN RUNNER: runPaper4HFixedExecutor
// ============================================================================

export interface RunPaper4HFixedOptions {
  customConfig?: FixedRule4HConfig;
  customCandles?: Record<string, Candle4H[]>;
  dryRun?: boolean;
}

export async function runPaper4HFixedExecutor(
  options: RunPaper4HFixedOptions = {}
): Promise<Fixed4HExecutorResult> {
  const cfg = options.customConfig || loadFixedRuleConfig();
  const isDryRun = !!options.dryRun;
  const actions: string[] = [];
  const evaluatedSymbols: string[] = [];
  const openedTrades: PaperTrade4HFixedRecord[] = [];
  const closedTrades: PaperTrade4HFixedRecord[] = [];
  const skippedSymbols: Array<{ symbol: string; reason: string }> = [];

  const db = await getDb();

  // 1. Load active trades from DB or JSON file / Memory
  let allStoredTrades: PaperTrade4HFixedRecord[] = [];
  if (db && !isDryRun) {
    try {
      const docs = await db.collection("paper_trades_4h_fixed").find({}).toArray();
      allStoredTrades = docs.map((d: any) => ({
        id: d.id,
        coin: d.coin,
        side: d.side,
        signal_time: d.signal_time,
        signal_bar_time: d.signal_bar_time,
        entry_time: d.entry_time,
        entry_time_ms: d.entry_time_ms,
        exit_time: d.exit_time,
        entry_price: d.entry_price,
        exit_price: d.exit_price,
        initial_stop: d.initial_stop,
        active_stop: d.active_stop,
        anchor_close: d.anchor_close,
        stop_dist_pct: d.stop_dist_pct,
        risk_inr: d.risk_inr,
        position_size_inr: d.position_size_inr,
        status: d.status,
        exit_type: d.exit_type,
        gross_r: d.gross_r,
        fee_r: d.fee_r,
        funding_r: d.funding_r,
        net_r: d.net_r,
        net_pnl_inr: d.net_pnl_inr,
        bars_held: d.bars_held,
        clamped_flag: d.clamped_flag,
        last_evaluated_bar_time: d.last_evaluated_bar_time,
      }));
    } catch (err: any) {
      actions.push(`[DB] Fallback to local storage: ${err?.message}`);
      allStoredTrades = loadTradesFromFile();
    }
  } else {
    allStoredTrades = loadTradesFromFile();
  }

  // Sync to memory
  for (const t of allStoredTrades) {
    inMemoryFixedTrades.set(t.id, t);
  }

  const activeTrades = allStoredTrades.filter((t) => t.status === "ACTIVE");
  const closedStoredTrades = allStoredTrades.filter((t) => t.status === "CLOSED");

  // 2. Fetch candles for assets
  const candleMap: Record<string, Candle4H[]> = {};
  for (const sym of cfg.assets) {
    if (options.customCandles && options.customCandles[sym]) {
      candleMap[sym] = options.customCandles[sym];
    } else {
      // Dynamic import to prevent circular dependency
      const { fetchBinanceKlines } = await import("./binanceData");
      try {
        const raw = await fetchBinanceKlines("4h", 250, 10000, sym);
        candleMap[sym] = raw.map((c) => ({
          openTime: c.openTime,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          closeTime: c.closeTime,
          datetime: new Date(c.openTime).toISOString(),
        }));
      } catch (err: any) {
        skippedSymbols.push({ symbol: sym, reason: `Failed to fetch candles: ${err?.message}` });
      }
    }
  }

  const btcCandles = candleMap[cfg.btc_regime_gate.btc_symbol] || candleMap["BTCUSDT"];

  // 3. Evaluate Active Trades on newly closed bars
  const remainingActiveTrades: PaperTrade4HFixedRecord[] = [];
  for (const trade of activeTrades) {
    const candles = candleMap[trade.coin];
    if (!candles || candles.length === 0) {
      remainingActiveTrades.push(trade);
      continue;
    }

    const { atr14: atrArr } = calculateATR14(candles, cfg.filters.atr_period);

    // Find bars since last evaluation
    const lastEvalTime = trade.last_evaluated_bar_time || trade.entry_time_ms;
    const postEntryCandles = candles.filter((c) => c.openTime > lastEvalTime);

    let tradeClosed = false;
    let evalBarCount = trade.bars_held || 0;

    for (let i = 0; i < postEntryCandles.length; i++) {
      const bar = postEntryCandles[i];
      evalBarCount++;
      const barIdxInAll = candles.findIndex((c) => c.openTime === bar.openTime);
      const barAtr = barIdxInAll >= 0 ? atrArr[barIdxInAll] : trade.entry_price * 0.02;

      const evalRes = evaluateActiveTradeOnBar(trade, bar, evalBarCount, barAtr, cfg);

      trade.active_stop = evalRes.updatedActiveStop;
      trade.anchor_close = evalRes.updatedAnchorClose;
      trade.bars_held = evalBarCount;
      trade.last_evaluated_bar_time = bar.openTime;

      if (evalRes.closed) {
        tradeClosed = true;
        trade.status = "CLOSED";
        trade.exit_type = evalRes.exitType;
        trade.exit_price = evalRes.exitPrice;
        trade.exit_time = evalRes.exitTime;
        trade.gross_r = evalRes.grossR;
        trade.fee_r = evalRes.feeR;
        trade.funding_r = evalRes.fundingR;
        trade.net_r = evalRes.netR;
        trade.net_pnl_inr = evalRes.netPnLINR;

        if (db && !isDryRun) {
          try {
            await db.collection("paper_trades_4h_fixed").updateOne(
              { id: trade.id },
              { $set: trade },
              { upsert: true }
            );
          } catch (err: any) {
            actions.push(`[DB] Error updating closed trade ${trade.id}: ${err?.message}`);
          }
        }
        closedTrades.push(trade);
        inMemoryFixedTrades.set(trade.id, { ...trade });
        actions.push(
          `[4H FIXED ${trade.coin}] Trade ${trade.id} CLOSED: ${trade.exit_type} @ $${trade.exit_price} (Net R: ${trade.net_r}R, PnL: ₹${trade.net_pnl_inr})`
        );
        break;
      }
    }

    if (!tradeClosed) {
      remainingActiveTrades.push(trade);
      inMemoryFixedTrades.set(trade.id, { ...trade });
      if (db && !isDryRun) {
        try {
          await db.collection("paper_trades_4h_fixed").updateOne(
            { id: trade.id },
            { $set: trade },
            { upsert: true }
          );
        } catch {
          // ignore
        }
      }
    }
  }

  // 4. Scan for New Signals on Completed Bar t (Penultimate candle in live feed)
  // In live Binance feeds, candle[len-1] is the incomplete/forming bar.
  // Candle[len-2] is bar t (the latest completed bar).
  // Candle[len-1] open price is the exact open of bar t+1!
  for (const sym of cfg.assets) {
    evaluatedSymbols.push(sym);
    const candles = candleMap[sym];
    if (!candles || candles.length < 205) {
      skippedSymbols.push({
        symbol: sym,
        reason: `Insufficient candles (${candles?.length || 0} < 205)`,
      });
      continue;
    }

    // Check if symbol already has an active position
    const hasActivePosition = remainingActiveTrades.some((t) => t.coin === sym);
    if (hasActivePosition) {
      skippedSymbols.push({
        symbol: sym,
        reason: `Active position already open for ${sym}`,
      });
      continue;
    }

    // Portfolio Risk Limit: max concurrent positions
    if (remainingActiveTrades.length >= cfg.sizing.max_concurrent_positions) {
      skippedSymbols.push({
        symbol: sym,
        reason: `Max concurrent positions reached (${remainingActiveTrades.length} >= ${cfg.sizing.max_concurrent_positions})`,
      });
      continue;
    }

    // Bar t is the latest closed candle: index candles.length - 2
    // Bar t+1 is the forming candle starting at candles.length - 1
    const t = candles.length - 2;
    const formingCandle = candles[candles.length - 1];

    const sigResult = checkSignalOnBar(sym, candles, t, btcCandles, cfg);
    if (!sigResult) {
      continue;
    }

    // Cost filter check (cost_R <= 0.05)
    const costCheck = checkCostRFilter(sigResult.stopPct, 0.05, cfg.costs.taker_round_trip_friction);
    if (!costCheck.passed) {
      skippedSymbols.push({
        symbol: sym,
        reason: `Gate 4 Cost filter failed: cost_R ${costCheck.costR} > ${costCheck.threshold}`,
      });
      continue;
    }

    // Risk Engine: Daily Loss Limit & Rolling Kill Switch on closed trades
    const tradeOrdersForRisk: TradeOrder[] = closedStoredTrades.map((t) => ({
      id: t.id,
      symbol: t.coin,
      direction: t.side,
      entryPrice: t.entry_price,
      exitPrice: t.exit_price || 0,
      initialStopLoss: t.initial_stop,
      netPnLINR: t.net_pnl_inr || 0,
      grossPnLINR: (t.gross_r || 0) * t.risk_inr,
      totalFeesINR: (t.fee_r || 0) * t.risk_inr,
      status: "STOP_OUT",
      openedAt: t.entry_time_ms,
      closedAt: t.exit_time ? new Date(t.exit_time).getTime() : t.entry_time_ms,
      entryOrderType: "MARKET",
      exitReason: t.exit_type || "STOP",
      timeframe: "4h",
    }));

    const dailyCheck = checkDailyLossLimit(tradeOrdersForRisk, -3.0);
    if (dailyCheck.exceeded) {
      skippedSymbols.push({
        symbol: sym,
        reason: `Daily loss limit exceeded (${dailyCheck.dailyNetR}R <= ${dailyCheck.limitR}R)`,
      });
      continue;
    }

    const killSwitch = evaluateRollingKillSwitch(tradeOrdersForRisk, 100, -0.05);
    if (killSwitch.shouldKill) {
      skippedSymbols.push({
        symbol: sym,
        reason: killSwitch.reason || `Rolling kill switch triggered (${killSwitch.avgNetR}R)`,
      });
      continue;
    }

    const drawdownCheck = checkDrawdownStop(tradeOrdersForRisk, -10.0);
    if (drawdownCheck.stopped) {
      skippedSymbols.push({
        symbol: sym,
        reason: drawdownCheck.reason || `Max drawdown stop triggered`,
      });
      continue;
    }

    // Gate 3 EXECUTION REALISM: Fill strictly at Open of bar t+1
    const entryPrice = formingCandle.open;
    const entryTimeMs = formingCandle.openTime;
    const entryTimeStr = formingCandle.datetime || new Date(entryTimeMs).toISOString();

    // Recompute structural stop relative to actual entryPrice
    const { ll10, hh10 } = calculateStructuralLevels(candles, cfg.stop.lookback_bars);
    const rawStop = sigResult.signal === "LONG"
      ? (entryPrice - ll10[t]) / entryPrice
      : (hh10[t] - entryPrice) / entryPrice;

    const minStop = cfg.stop.min_stop_pct;
    const maxStop = cfg.stop.max_stop_pct;
    const isOutsideClamp = rawStop < minStop || rawStop > maxStop;

    if (cfg.stop.clamp_mode === "skip" && isOutsideClamp) {
      skippedSymbols.push({
        symbol: sym,
        reason: `Stop distance ${rawStop.toFixed(4)} outside clamp range [${minStop}, ${maxStop}] in skip mode`,
      });
      continue;
    }

    const stopDist = Math.min(maxStop, Math.max(minStop, rawStop));
    const initialStopPrice = sigResult.signal === "LONG"
      ? entryPrice * (1.0 - stopDist)
      : entryPrice * (1.0 + stopDist);

    const riskInr = cfg.sizing.risk_per_trade_inr; // ₹70
    const positionSizeInr = Number((riskInr / stopDist).toFixed(2));
    const tradeId = `FIXED_4H_${sym}_${entryTimeMs}`;

    const newTrade: PaperTrade4HFixedRecord = {
      id: tradeId,
      coin: sym,
      side: sigResult.signal,
      signal_time: sigResult.signalTime,
      signal_bar_time: sigResult.signalTimeMs,
      entry_time: entryTimeStr,
      entry_time_ms: entryTimeMs,
      entry_price: Number(entryPrice.toFixed(4)),
      initial_stop: Number(initialStopPrice.toFixed(4)),
      active_stop: Number(initialStopPrice.toFixed(4)),
      anchor_close: Number(entryPrice.toFixed(4)),
      stop_dist_pct: Number(stopDist.toFixed(5)),
      risk_inr: riskInr,
      position_size_inr: positionSizeInr,
      status: "ACTIVE",
      bars_held: 0,
      clamped_flag: isOutsideClamp,
      last_evaluated_bar_time: entryTimeMs,
    };

    if (db && !isDryRun) {
      try {
        await db.collection("paper_trades_4h_fixed").insertOne(newTrade);
      } catch (err: any) {
        actions.push(`[DB] Error persisting new trade ${newTrade.id}: ${err?.message}`);
      }
    }

    inMemoryFixedTrades.set(newTrade.id, newTrade);
    remainingActiveTrades.push(newTrade);
    openedTrades.push(newTrade);
    actions.push(
      `[4H FIXED ${sym}] Opened ${newTrade.side} trade ${newTrade.id} @ $${newTrade.entry_price} (Stop: $${newTrade.initial_stop}, Risk: ₹${riskInr})`
    );
  }

  // 5. Persist all updated trades to data/trades_4h_fixed.json
  const finalAllTrades = Array.from(inMemoryFixedTrades.values());
  saveTradesToFile(finalAllTrades);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    evaluated_symbols: evaluatedSymbols,
    opened_trades: openedTrades,
    active_trades: remainingActiveTrades,
    closed_trades: closedTrades,
    skipped_symbols: skippedSymbols,
    actions,
  };
}
