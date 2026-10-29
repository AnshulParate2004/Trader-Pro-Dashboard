import { Candle } from "./features";

interface CachedCandles {
  timestamp: number;
  candles: Candle[];
}

const candleCache: Record<string, CachedCandles> = {};

/**
 * Resilient multi-endpoint Binance public klines fetcher.
 * Uses global unblocked data networks (data-api.binance.vision & spot APIs)
 * to prevent AWS/Vercel (US region iad1) 451/403 geo-blocking.
 */
const BINANCE_BASE_URLS = [
  "https://data-api.binance.vision/api/v3/klines",
  "https://api.binance.com/api/v3/klines",
  "https://api1.binance.com/api/v3/klines",
  "https://api2.binance.com/api/v3/klines",
  "https://api3.binance.com/api/v3/klines",
  "https://fapi.binance.com/fapi/v1/klines",
];

export async function fetchBinanceKlines(
  interval: string,
  limit: number = 150,
  ttlMs: number = 10000
): Promise<Candle[]> {
  const cacheKey = `${interval}_${limit}`;
  const now = Date.now();
  const cached = candleCache[cacheKey];

  if (cached && now - cached.timestamp < ttlMs) {
    return cached.candles;
  }

  let lastError: any = null;

  for (const base of BINANCE_BASE_URLS) {
    try {
      const url = `${base}?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Trader-Pro/1.0",
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} from ${base}`);
        continue;
      }

      const raw = await res.json();
      if (!Array.isArray(raw) || raw.length === 0) {
        lastError = new Error(`Invalid response format from ${base}`);
        continue;
      }

      const candles: Candle[] = raw.map((d: any) => ({
        openTime: Number(d[0]),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
        closeTime: Number(d[6]),
        takerBuyBase: parseFloat(d[9] || "0"),
      }));

      candleCache[cacheKey] = {
        timestamp: now,
        candles,
      };

      return candles;
    } catch (err: any) {
      lastError = err;
    }
  }

  if (cached) return cached.candles;
  throw new Error(`All Binance endpoints failed for ${interval}: ${lastError?.message || "Unknown error"}`);
}

/**
 * Concurrently fetches and buffers all timeframes needed for 53-feature extraction & MTF confluence
 */
export async function fetchAllTimeframes(require5m: boolean = false): Promise<{
  candles15m: Candle[];
  candles5m?: Candle[];
  candles1h: Candle[];
  candles4h: Candle[];
  candles1d: Candle[];
  candles1w: Candle[];
}> {
  const [candles15m, candles1h, candles4h, candles1d, candles1w, candles5m] = await Promise.all([
    fetchBinanceKlines("15m", 150, 5000),
    fetchBinanceKlines("1h", 150, 60000),
    fetchBinanceKlines("4h", 300, 120000),
    fetchBinanceKlines("1d", 300, 300000),
    fetchBinanceKlines("1w", 150, 600000),
    require5m ? fetchBinanceKlines("5m", 150, 5000) : Promise.resolve(undefined),
  ]);

  return {
    candles15m,
    candles5m: candles5m || undefined,
    candles1h,
    candles4h,
    candles1d,
    candles1w,
  };
}
