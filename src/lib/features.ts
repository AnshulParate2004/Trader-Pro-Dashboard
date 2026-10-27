export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: number;
  takerBuyBase?: number;
}

export interface LevelConfig {
  pivot_k: number;
  lookback: number;
  cap: number;
  inval_atr: number;
  far_atr: number | null;
  single_use: boolean;
}

export const TF_CONFIGS: Record<string, LevelConfig> = {
  "15m": { pivot_k: 3, lookback: 144, cap: 3, inval_atr: 0.0, far_atr: null, single_use: true },
  "1h": { pivot_k: 4, lookback: 125, cap: 5, inval_atr: 0.0, far_atr: 3.0, single_use: false },
  "4h": { pivot_k: 5, lookback: 215, cap: 7, inval_atr: 0.0, far_atr: 4.0, single_use: false },
  "1d": { pivot_k: 5, lookback: 270, cap: 6, inval_atr: 0.0, far_atr: null, single_use: false },
  "1w": { pivot_k: 3, lookback: 125, cap: 4, inval_atr: 2.0, far_atr: null, single_use: false },
};

export const CONF_TOL = 0.0035;

/**
 * Wilder's RMA (equivalent to pandas ewm(alpha=1/n, adjust=False))
 */
export function calcWilderATR(candles: Candle[], n: number = 14): number[] {
  const len = candles.length;
  if (len === 0) return [];
  const tr: number[] = new Array(len);
  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < len; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }

  const alpha = 1 / n;
  const atr: number[] = new Array(len);
  atr[0] = tr[0];
  for (let i = 1; i < len; i++) {
    atr[i] = alpha * tr[i] + (1 - alpha) * atr[i - 1];
  }
  return atr;
}

/**
 * Wilder's RSI (equivalent to pandas ewm(alpha=1/n, adjust=False))
 */
export function calcWilderRSI(closes: number[], n: number = 14): number[] {
  const len = closes.length;
  if (len === 0) return [];
  const rsi: number[] = new Array(len).fill(50);
  if (len < 2) return rsi;

  const alpha = 1 / n;
  let ru = 0;
  let rd = 0;

  for (let i = 1; i < len; i++) {
    const diff = closes[i] - closes[i - 1];
    const up = Math.max(diff, 0);
    const dn = Math.max(-diff, 0);

    if (i === 1) {
      ru = up;
      rd = dn;
    } else {
      ru = alpha * up + (1 - alpha) * ru;
      rd = alpha * dn + (1 - alpha) * rd;
    }

    if (rd === 0) {
      rsi[i] = ru === 0 ? 50 : 100;
    } else {
      const rs = ru / rd;
      rsi[i] = 100 - 100 / (1 + rs);
    }
  }
  return rsi;
}

/**
 * Exponential Moving Average (span=n, adjust=False)
 */
export function calcEMA(values: number[], span: number): number[] {
  const len = values.length;
  if (len === 0) return [];
  const ema: number[] = new Array(len);
  const k = 2 / (span + 1);
  ema[0] = values[0];
  for (let i = 1; i < len; i++) {
    ema[i] = k * values[i] + (1 - k) * ema[i - 1];
  }
  return ema;
}

/**
 * Exact MACD Histogram normalized by Close: (MACD - EMA9(MACD)) / Close
 */
export function calcMACDHist(closes: number[]): number[] {
  const len = closes.length;
  if (len === 0) return [];
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    macd[i] = ema12[i] - ema26[i];
  }
  const signal = calcEMA(macd, 9);
  const hist: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    hist[i] = closes[i] > 0 ? (macd[i] - signal[i]) / closes[i] : 0;
  }
  return hist;
}

/**
 * Rolling Mean and Sample Standard Deviation (ddof=1)
 */
export function calcRollingStats(values: number[], window: number): { mean: number[]; std: number[] } {
  const len = values.length;
  const mean: number[] = new Array(len).fill(0);
  const std: number[] = new Array(len).fill(0);

  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += values[i];
    if (i >= window) {
      sum -= values[i - window];
    }
    const count = Math.min(i + 1, window);
    const m = sum / count;
    mean[i] = m;

    if (count > 1) {
      let varSum = 0;
      const start = Math.max(0, i - window + 1);
      for (let j = start; j <= i; j++) {
        varSum += (values[j] - m) ** 2;
      }
      std[i] = Math.sqrt(varSum / (count - 1));
    } else {
      std[i] = 0;
    }
  }
  return { mean, std };
}

export interface LevelRow {
  sup_px: number;
  sup_age: number;
  sup_touch: number;
  res_px: number;
  res_age: number;
  res_touch: number;
  n_sup: number;
  n_res: number;
  ev_sup: number;
  ev_res: number;
}

/**
 * Dynamic Support/Resistance swing-pivot level engine (spec sections 1-2)
 * Ported 1:1 from 01_train_15m.ipynb: build_levels(d, cfg)
 */
export function buildLevels(candles: Candle[], cfg: LevelConfig, atrValues: number[]): LevelRow[] {
  const n = candles.length;
  const k = cfg.pivot_k;
  const cap = cfg.cap;
  const sideCap = Math.max(1, Math.ceil(cap / 2));
  const w = 2 * k + 1;

  // Pre-calculate pivot highs and pivot lows (centered rolling window)
  const ph = new Array<boolean>(n).fill(false);
  const pl = new Array<boolean>(n).fill(false);

  for (let j = k; j < n - k; j++) {
    const curH = candles[j].high;
    const curL = candles[j].low;
    let isH = true;
    let isL = true;
    for (let m = j - k; m <= j + k; m++) {
      if (candles[m].high > curH) isH = false;
      if (candles[m].low < curL) isL = false;
    }
    ph[j] = isH;
    pl[j] = isL;
  }

  // sup and res: [price, pivot_idx, touches]
  let sup: Array<[number, number, number]> = [];
  let res: Array<[number, number, number]> = [];

  const out: LevelRow[] = [];

  for (let i = 0; i < n; i++) {
    const a = atrValues[i];
    if (isNaN(a) || a <= 0) {
      out.push({
        sup_px: NaN, sup_age: NaN, sup_touch: NaN,
        res_px: NaN, res_age: NaN, res_touch: NaN,
        n_sup: 0, n_res: 0, ev_sup: 0, ev_res: 0
      });
      continue;
    }

    const j = i - k;
    if (j >= 0) {
      if (pl[j]) {
        const lo_j = candles[j].low;
        const tooClose = sup.some((L) => Math.abs(L[0] - lo_j) < 0.25 * a);
        if (!tooClose) {
          sup.push([lo_j, j, 0]);
        }
      }
      if (ph[j]) {
        const hi_j = candles[j].high;
        const tooClose = res.some((L) => Math.abs(L[0] - hi_j) < 0.25 * a);
        if (!tooClose) {
          res.push([hi_j, j, 0]);
        }
      }
    }

    let ev_s = 0.0;
    let ev_r = 0.0;
    const cl_i = candles[i].close;
    const lo_i = candles[i].low;
    const hi_i = candles[i].high;

    // Prune and update support levels
    const keepSup: Array<[number, number, number]> = [];
    for (const L of sup) {
      const [p, j0] = L;
      if (cl_i < p - cfg.inval_atr * a) continue; // broken
      if (i - j0 > cfg.lookback) continue; // too old
      if (cfg.far_atr !== null && Math.abs(cl_i - p) > cfg.far_atr * a) continue;
      if (lo_i <= p + 0.1 * a) {
        ev_s = 1.0;
        if (cfg.single_use) continue; // purge on 1st touch
        L[2] += 1;
      }
      keepSup.push(L);
    }
    // Sort descending by pivot index (most recent first) and cap
    sup = keepSup.sort((a, b) => b[1] - a[1]).slice(0, sideCap);

    // Prune and update resistance levels
    const keepRes: Array<[number, number, number]> = [];
    for (const L of res) {
      const [p, j0] = L;
      if (cl_i > p + cfg.inval_atr * a) continue; // broken
      if (i - j0 > cfg.lookback) continue; // too old
      if (cfg.far_atr !== null && Math.abs(cl_i - p) > cfg.far_atr * a) continue;
      if (hi_i >= p - 0.1 * a) {
        ev_r = 1.0;
        if (cfg.single_use) continue; // purge on 1st touch
        L[2] += 1;
      }
      keepRes.push(L);
    }
    res = keepRes.sort((a, b) => b[1] - a[1]).slice(0, sideCap);

    // Closest level below and above close
    const below = sup.filter((L) => L[0] <= cl_i);
    const above = res.filter((L) => L[0] >= cl_i);

    let sup_px = NaN;
    let sup_age = NaN;
    let sup_touch = NaN;
    if (below.length > 0) {
      const best = below.reduce((prev, curr) => (curr[0] > prev[0] ? curr : prev));
      sup_px = best[0];
      sup_age = i - best[1];
      sup_touch = best[2];
    }

    let res_px = NaN;
    let res_age = NaN;
    let res_touch = NaN;
    if (above.length > 0) {
      const best = above.reduce((prev, curr) => (curr[0] < prev[0] ? curr : prev));
      res_px = best[0];
      res_age = i - best[1];
      res_touch = best[2];
    }

    out.push({
      sup_px,
      sup_age,
      sup_touch,
      res_px,
      res_age,
      res_touch,
      n_sup: sup.length,
      n_res: res.length,
      ev_sup: ev_s,
      ev_res: ev_r,
    });
  }

  return out;
}

export interface HTFData {
  candles1h?: Candle[];
  candles4h?: Candle[];
  candles1d?: Candle[];
  candles1w?: Candle[];
}

/**
 * Computes the complete 53-feature vector for LightGBM evaluation
 * exactly conforming to 01_train_15m.ipynb: build_all(df, CFG, TF)
 */
export function computeFull53Features(
  candles15m: Candle[],
  htfData: HTFData = {}
): { features: Record<string, number>; atr: number; htfScore: number } {
  const n = candles15m.length;
  if (n < 30) {
    return { features: {}, atr: 0, htfScore: 0 };
  }

  const lastIdx = n - 1;
  const lastBar = candles15m[lastIdx];
  const lastC = lastBar.close;
  const lastO = lastBar.open;
  const lastH = lastBar.high;
  const lastL = lastBar.low;
  const lastV = lastBar.volume;
  const lastTaker = lastBar.takerBuyBase ?? lastV * 0.5;

  const closes = candles15m.map((c) => c.close);
  const logCloses = closes.map((c) => Math.log(c));

  // 1-5: Log returns
  const ret = (period: number) => {
    if (lastIdx < period) return 0;
    return logCloses[lastIdx] - logCloses[lastIdx - period];
  };

  // 6-7: Wilder ATR
  const atrSeries = calcWilderATR(candles15m, 14);
  const currentATR = atrSeries[lastIdx];
  const { mean: atr50Mean } = calcRollingStats(atrSeries, 50);
  const atr50 = atr50Mean[lastIdx];
  const atr_pct = currentATR / lastC;
  const atr_ratio = atr50 > 0 ? currentATR / atr50 : 1.0;

  // 8-11: Price action micro metrics
  const range_pct = (lastH - lastL) / lastC;
  const body_pct = (lastC - lastO) / lastC;
  const rng = lastH - lastL || 1e-8;
  const upper_wick = (lastH - Math.max(lastO, lastC)) / rng;
  const lower_wick = (Math.min(lastO, lastC) - lastL) / rng;

  // 12: Wilder RSI 14
  const rsiSeries = calcWilderRSI(closes, 14);
  const rsi14 = rsiSeries[lastIdx];

  // 13: Exact MACD Normalized Histogram
  const macdHistSeries = calcMACDHist(closes);
  const macd_hist = macdHistSeries[lastIdx];

  // 14-15: Bollinger Bands (20, 2)
  const { mean: bbMean, std: bbStd } = calcRollingStats(closes, 20);
  const ma20 = bbMean[lastIdx];
  const sd20 = bbStd[lastIdx];
  const bb_pctb = sd20 > 0 ? (lastC - (ma20 - 2 * sd20)) / (4 * sd20) : 0.5;
  const bb_width = ma20 > 0 ? (4 * sd20) / ma20 : 0;

  // 16-19: EMAs (20, 50) and slope
  const ema20Series = calcEMA(closes, 20);
  const ema50Series = calcEMA(closes, 50);
  const ema20 = ema20Series[lastIdx];
  const ema50 = ema50Series[lastIdx];
  const ema_dist_20 = (lastC - ema20) / lastC;
  const ema_dist_50 = (lastC - ema50) / lastC;
  const ema_20_50 = (ema20 - ema50) / lastC;
  const prev5Ema20 = lastIdx >= 5 ? ema20Series[lastIdx - 5] : ema20;
  const ema20_slope = prev5Ema20 > 0 ? (ema20 - prev5Ema20) / prev5Ema20 : 0;

  // 20-22: Volume & Volatility dynamics
  const logVolumes = candles15m.map((c) => Math.log1p(Math.max(0, c.volume)));
  const { mean: lvMean, std: lvStd } = calcRollingStats(logVolumes, 50);
  const vol_z = lvStd[lastIdx] > 0 ? (logVolumes[lastIdx] - lvMean[lastIdx]) / lvStd[lastIdx] : 0;
  const taker_ratio = lastV > 0 ? Math.min(1.0, Math.max(0.0, lastTaker / lastV)) : 0.5;

  // vol_ratio: 20-bar std of log returns / 50-bar std of log returns
  const r1: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    r1[i] = logCloses[i] - logCloses[i - 1];
  }
  const { std: r1Std20 } = calcRollingStats(r1, 20);
  const { std: r1Std50 } = calcRollingStats(r1, 50);
  const vol_ratio = r1Std50[lastIdx] > 0 ? r1Std20[lastIdx] / r1Std50[lastIdx] : 1.0;

  // 23-26: Cyclical UTC time
  const lastDate = new Date(lastBar.openTime);
  const hour = lastDate.getUTCHours() + lastDate.getUTCMinutes() / 60;
  // Python dt.dayofweek: Monday=0, Sunday=6
  // JS getUTCDay(): Sunday=0, Monday=1, ..., Saturday=6
  const dow = (lastDate.getUTCDay() + 6) % 7;
  const hour_sin = Math.sin((2 * Math.PI * hour) / 24);
  const hour_cos = Math.cos((2 * Math.PI * hour) / 24);
  const dow_sin = Math.sin((2 * Math.PI * dow) / 7);
  const dow_cos = Math.cos((2 * Math.PI * dow) / 7);

  // 27-38: Dynamic Support & Resistance levels on 15m
  const lev15m = buildLevels(candles15m, TF_CONFIGS["15m"], atrSeries);
  const lastLev = lev15m[lastIdx];
  const sup_own = lastLev.sup_px;
  const res_own = lastLev.res_px;

  const dsup_own = !isNaN(sup_own) ? (lastC - sup_own) / lastC : 0;
  const dres_own = !isNaN(res_own) ? (res_own - lastC) / lastC : 0;
  const dsup_atr = !isNaN(sup_own) && currentATR > 0 ? (lastC - sup_own) / currentATR : 0;
  const dres_atr = !isNaN(res_own) && currentATR > 0 ? (res_own - lastC) / currentATR : 0;

  const sup_age = !isNaN(lastLev.sup_age) ? lastLev.sup_age : 0;
  const res_age = !isNaN(lastLev.res_age) ? lastLev.res_age : 0;
  const sup_touch = !isNaN(lastLev.sup_touch) ? lastLev.sup_touch : 0;
  const res_touch = !isNaN(lastLev.res_touch) ? lastLev.res_touch : 0;
  const n_sup = lastLev.n_sup;
  const n_res = lastLev.n_res;
  const ev_sup = lastLev.ev_sup;
  const ev_res = lastLev.ev_res;

  // 39-50: Multi-Timeframe S/R Distances and Trends (1h, 4h, 1d, 1w)
  let conf_s = !isNaN(sup_own) ? 1.0 : 0.0;
  let conf_r = !isNaN(res_own) ? 1.0 : 0.0;
  const htfTrends: Record<string, number> = {};

  const processHTF = (
    tfName: "1h" | "4h" | "1d" | "1w",
    htfCandles?: Candle[]
  ): { dsup: number; dres: number; trend: number } => {
    if (!htfCandles || htfCandles.length < 20) {
      // Fallback if HTF candles not yet fetched
      const trend = lastC >= ema50 ? 1.0 : -1.0;
      htfTrends[tfName] = trend;
      return { dsup: 0, dres: 0, trend };
    }

    const htfATR = calcWilderATR(htfCandles, 14);
    const htfLevels = buildLevels(htfCandles, TF_CONFIGS[tfName], htfATR);
    const htfCloses = htfCandles.map((c) => c.close);
    const htfEma50 = calcEMA(htfCloses, 50);

    // Merge as-of: find the latest HTF candle that closed at or before 15m candle close time
    const targetCloseTime = lastBar.closeTime || lastBar.openTime + 15 * 60 * 1000 - 1;
    let matchIdx = -1;
    for (let i = htfCandles.length - 1; i >= 0; i--) {
      const cTime = htfCandles[i].closeTime || htfCandles[i].openTime + (tfName === "1h" ? 3600000 : tfName === "4h" ? 14400000 : tfName === "1d" ? 86400000 : 604800000) - 1;
      if (cTime <= targetCloseTime) {
        matchIdx = i;
        break;
      }
    }
    if (matchIdx === -1) matchIdx = htfCandles.length - 1;

    const matchedLev = htfLevels[matchIdx];
    const s = matchedLev.sup_px;
    const r = matchedLev.res_px;
    const trend = Math.sign(htfCandles[matchIdx].close - htfEma50[matchIdx]) || 1.0;
    htfTrends[tfName] = trend;

    const dsup = !isNaN(s) ? (lastC - s) / lastC : 0;
    const dres = !isNaN(r) ? (r - lastC) / lastC : 0;

    if (!isNaN(s) && !isNaN(sup_own) && Math.abs(s - sup_own) / lastC <= CONF_TOL) {
      conf_s += 1.0;
    }
    if (!isNaN(r) && !isNaN(res_own) && Math.abs(r - res_own) / lastC <= CONF_TOL) {
      conf_r += 1.0;
    }

    return { dsup, dres, trend };
  };

  const htf1h = processHTF("1h", htfData.candles1h);
  const htf4h = processHTF("4h", htfData.candles4h);
  const htf1d = processHTF("1d", htfData.candles1d);
  const htf1w = processHTF("1w", htfData.candles1w);

  // 51-52: Multi-timeframe confluence
  const conf_sup = conf_s;
  const conf_res = conf_r;

  // 53: Higher Timeframe Macro Score = mean(trend_4h, trend_1d, trend_1w)
  const gateTrends = [htf4h.trend, htf1d.trend, htf1w.trend];
  const htf_score = gateTrends.reduce((a, b) => a + b, 0) / gateTrends.length;

  const features: Record<string, number> = {
    ret_1: ret(1),
    ret_3: ret(3),
    ret_6: ret(6),
    ret_12: ret(12),
    ret_24: ret(24),
    atr_pct,
    atr_ratio,
    range_pct,
    body_pct,
    upper_wick,
    lower_wick,
    rsi14,
    macd_hist,
    bb_pctb,
    bb_width,
    ema_dist_20,
    ema_dist_50,
    ema_20_50,
    ema20_slope,
    vol_z,
    taker_ratio,
    vol_ratio,
    hour_sin,
    hour_cos,
    dow_sin,
    dow_cos,
    dsup_own,
    dres_own,
    dsup_atr,
    dres_atr,
    sup_age,
    res_age,
    sup_touch,
    res_touch,
    n_sup,
    n_res,
    ev_sup,
    ev_res,
    dsup_1h: htf1h.dsup,
    dres_1h: htf1h.dres,
    trend_1h: htf1h.trend,
    dsup_4h: htf4h.dsup,
    dres_4h: htf4h.dres,
    trend_4h: htf4h.trend,
    dsup_1d: htf1d.dsup,
    dres_1d: htf1d.dres,
    trend_1d: htf1d.trend,
    dsup_1w: htf1w.dsup,
    dres_1w: htf1w.dres,
    trend_1w: htf1w.trend,
    conf_sup,
    conf_res,
    htf_score,
  };

  return { features, atr: currentATR, htfScore: htf_score };
}
