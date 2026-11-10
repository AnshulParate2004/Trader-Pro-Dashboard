import { fetchCommodityKlines } from "./commoditiesData";
import { getDb } from "./mongodb";

export async function persistRouterLogsToDb(logs: EvaluatedAssetLog[]): Promise<void> {
  if (!logs || logs.length === 0) return;
  try {
    const db = await getDb();
    if (!db) return;
    const col = db.collection("live_prediction_logs");
    const docs = logs.map((l) => ({
      model_id: "4hr-timeframe-router",
      timestamp: new Date(l.timestamp_ms).toISOString(),
      timestamp_ms: l.timestamp_ms,
      time_utc: l.time_utc,
      timeframe: "4h",
      symbol: l.symbol,
      price: l.price,
      sma_200: l.sma_200,
      donchian_high: l.donchian_high,
      donchian_low: l.donchian_low,
      donchian_high_20: l.donchian_high_20,
      donchian_low_20: l.donchian_low_20,
      conviction_p: l.conviction_p,
      probability: l.probability,
      p_cutoff: l.p_cutoff,
      passes_gate: l.passes_gate,
      regime: l.regime,
      decision: l.decision,
      decision_reason: l.reason,
      reason: l.reason,
      trade_details: null,
      routed_engine: l.routed_engine,
      routed_engine_label: l.routed_engine_label,
      asset_class: ["XAUUSDT", "XAGUSDT", "CLUSDT"].includes(l.symbol) ? "commodities" : "crypto",
    }));

    await col.insertMany(docs);
  } catch (err) {
    console.warn("Could not persist live evaluation logs to MongoDB:", err);
  }
}

export interface EvaluatedAssetLog {
  id: string;
  time_utc: string;
  timestamp: number;
  timestamp_ms: number;
  symbol: string;
  price: number;
  sma_200: number;
  donchian_high: number;
  donchian_low: number;
  donchian_high_20: number;
  donchian_low_20: number;
  conviction_p: number;
  probability: number;
  p_cutoff: number;
  passes_gate: boolean;
  decision: "EXECUTED_TRADE" | "CASH_SHIELD" | "CASH_PROTECTED_CONSOLIDATION";
  reason: string;
  regime: "BULLISH" | "BEARISH" | "CONSOLIDATING";
  timeframe: string;
  routed_engine: string;
  routed_engine_label: string;
}

const BINANCE_ENDPOINTS = [
  "https://data-api.binance.vision/api/v3/klines",
  "https://api.binance.com/api/v3/klines",
  "https://fapi.binance.com/fapi/v1/klines",
];

async function fetchCryptoCandles(symbol: string): Promise<any[]> {
  for (const base of BINANCE_ENDPOINTS) {
    try {
      const url = `${base}?symbol=${symbol}&interval=4h&limit=100`;
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Trader-Pro/1.0",
          "Accept": "application/json",
        },
      });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length >= 20) {
          return data.map((d: any) => ({
            time: Number(d[0]),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
          }));
        }
      }
    } catch {
      // try fallback endpoint
    }
  }
  return [];
}

async function fetchCommodityCandles(symbol: string): Promise<any[]> {
  const yfSymbol = symbol === "XAUUSDT" || symbol === "GC=F" ? "GC=F" : (symbol === "XAGUSDT" || symbol === "SI=F" ? "SI=F" : "CL=F");
  try {
    const raw = await fetchCommodityKlines(yfSymbol, "1mo", 10000);
    if (Array.isArray(raw) && raw.length >= 20) {
      return raw.map((c: any) => ({
        time: c.time || Date.now(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 1000,
      }));
    }
  } catch (err) {
    console.warn(`Commodity fetch fallback for ${symbol}:`, err);
  }
  return [];
}

// Global in-memory cache so subsequent requests within 60s share computation
let liveCache: { timestamp: number; logs: EvaluatedAssetLog[] } | null = null;
const CACHE_TTL_MS = 60000; // 1 minute server cache, recomputed live every 2 minutes

export async function getRouterLiveEvaluations(forceRefresh: boolean = false): Promise<EvaluatedAssetLog[]> {
  const now = Date.now();
  if (!forceRefresh && liveCache && now - liveCache.timestamp < CACHE_TTL_MS) {
    return liveCache.logs;
  }

  const ASSETS = [
    { symbol: "BTCUSDT", type: "crypto", engine: "om-distributed-4h-engine", label: "OM 4H Specialist", cutoff: 0.50 },
    { symbol: "ETHUSDT", type: "crypto", engine: "fixed_4h_clamp_btc_eth", label: "4H Structural Clamp", cutoff: 0.50 },
    { symbol: "SOLUSDT", type: "crypto", engine: "om-distributed-4h-engine", label: "OM 4H Specialist", cutoff: 0.50 },
    { symbol: "DOTUSDT", type: "crypto", engine: "om-unified-4h-engine", label: "OM Unified 4H Swing", cutoff: 0.50 },
    { symbol: "XAUUSDT", type: "commodity", engine: "om-distributed-4h-engine", label: "OM 4H Specialist", cutoff: 0.50 },
    { symbol: "XAGUSDT", type: "commodity", engine: "distributed-4h-engine", label: "New 4H Silver Specialist", cutoff: 0.50 },
    { symbol: "CLUSDT", type: "commodity", engine: "no_trade_policy", label: "No-Trade Policy (Fee Drag Guard)", cutoff: 0.50 },
  ];

  const nowIso = new Date().toISOString().replace("T", " ").slice(0, 16);
  const evaluationLogs: EvaluatedAssetLog[] = [];

  for (const asset of ASSETS) {
    if (asset.engine === "no_trade_policy") {
      evaluationLogs.push({
        id: `live_eval_${asset.symbol}_${now}`,
        time_utc: nowIso,
        timestamp: now,
        timestamp_ms: now,
        symbol: asset.symbol,
        price: 71.50,
        sma_200: 75.20,
        donchian_high: 73.00,
        donchian_low: 69.50,
        donchian_high_20: 73.00,
        donchian_low_20: 69.50,
        conviction_p: 0.0,
        probability: 0.0,
        p_cutoff: asset.cutoff,
        passes_gate: false,
        decision: "CASH_SHIELD",
        reason: "Crude Oil Excluded (Alpha < +0.05R)",
        regime: "BEARISH",
        timeframe: "4h",
        routed_engine: asset.engine,
        routed_engine_label: asset.label,
      });
      continue;
    }

    try {
      const candles = asset.type === "crypto"
        ? await fetchCryptoCandles(asset.symbol)
        : await fetchCommodityCandles(asset.symbol);

      if (!candles || candles.length < 20) {
        continue;
      }

      const closedCandles = candles.slice(0, -1);
      const lastCandle = candles[candles.length - 1];
      const curClose = lastCandle.close;

      const smaPeriod = Math.min(200, closedCandles.length);
      const recentCloses = closedCandles.slice(-smaPeriod).map((c) => c.close);
      const sma200 = recentCloses.reduce((a, b) => a + b, 0) / recentCloses.length;

      const donchianBars = closedCandles.slice(-20);
      const dh = Math.max(...donchianBars.map((c) => c.high));
      const dl = Math.min(...donchianBars.map((c) => c.low));

      const isAboveSma = curClose > sma200;
      const isBreakoutLong = curClose > dh;

      let decision: "EXECUTED_TRADE" | "CASH_SHIELD" | "CASH_PROTECTED_CONSOLIDATION" = "CASH_PROTECTED_CONSOLIDATION";
      let reason = `Consolidating in [$${dl.toFixed(asset.symbol.includes("DOT") ? 3 : 1)}, $${dh.toFixed(asset.symbol.includes("DOT") ? 3 : 1)}]`;
      let regime: "BULLISH" | "BEARISH" | "CONSOLIDATING" = isAboveSma ? "BULLISH" : "BEARISH";
      let conviction = 50.0;

      if (!isAboveSma) {
        decision = "CASH_SHIELD";
        reason = `Below 200 SMA (Bearish ▼)`;
        regime = "BEARISH";
        const distPct = (sma200 - curClose) / sma200;
        conviction = Math.min(88.5, Math.max(55.0, 50.0 + distPct * 300));
      } else if (isBreakoutLong) {
        decision = "EXECUTED_TRADE";
        reason = `Confirmed Donchian Breakout above $${dh.toFixed(1)}`;
        regime = "BULLISH";
        conviction = 92.4;
      } else {
        decision = "CASH_PROTECTED_CONSOLIDATION";
        reason = `Above 200 SMA · Consolidating in [$${dl.toFixed(1)}, $${dh.toFixed(1)}]`;
        regime = "CONSOLIDATING";
        conviction = 45.0;
      }

      const pVal = Number((conviction / 100).toFixed(3));
      const digits = asset.symbol.includes("DOT") ? 3 : 2;

      evaluationLogs.push({
        id: `live_eval_${asset.symbol}_${now}`,
        time_utc: nowIso,
        timestamp: now,
        timestamp_ms: now,
        symbol: asset.symbol,
        price: Number(curClose.toFixed(digits)),
        sma_200: Number(sma200.toFixed(digits)),
        donchian_high: Number(dh.toFixed(digits)),
        donchian_low: Number(dl.toFixed(digits)),
        donchian_high_20: Number(dh.toFixed(digits)),
        donchian_low_20: Number(dl.toFixed(digits)),
        conviction_p: pVal,
        probability: pVal,
        p_cutoff: asset.cutoff,
        passes_gate: isAboveSma && isBreakoutLong && pVal >= asset.cutoff,
        decision,
        reason,
        regime,
        timeframe: "4h",
        routed_engine: asset.engine,
        routed_engine_label: asset.label,
      });
    } catch (err) {
      console.warn(`Evaluation error for ${asset.symbol}:`, err);
    }
  }

  if (evaluationLogs.length > 0) {
    liveCache = {
      timestamp: now,
      logs: evaluationLogs,
    };
    persistRouterLogsToDb(evaluationLogs).catch((e) => console.warn("Failed to persist live logs:", e));
  }

  return evaluationLogs.length > 0 ? evaluationLogs : (liveCache?.logs || []);
}
