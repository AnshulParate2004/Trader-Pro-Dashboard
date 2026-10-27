import { Candle } from "./features";

interface CachedCandles {
  timestamp: number;
  candles: Candle[];
}

const candleCache: Record<string, CachedCandles> = {};

/**
 * Robust fetch for Binance Futures klines with smart memory caching
 */
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

  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      if (cached) return cached.candles;
      throw new Error(`Binance API error for ${interval}: ${res.statusText}`);
    }

    const raw = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) {
      if (cached) return cached.candles;
      throw new Error(`Invalid Binance response format for ${interval}`);
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
  } catch (err) {
    if (cached) return cached.candles;
    throw err;
  }
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
