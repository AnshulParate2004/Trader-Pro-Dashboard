/**
 * Commodities Market Data Fetcher for 1-Hour Macro Swing Engine
 *
 * Supported Symbols:
 * - Gold: GC=F
 * - Silver: SI=F
 * - Crude Oil: CL=F
 * - Benchmark (US Dollar Index): DX-Y.NYB
 *
 * Data Provider: Yahoo Finance v8 Chart Endpoint
 */

import { Candle } from "./features";

export const COMMODITY_SYMBOLS = ["GC=F", "SI=F", "CL=F"] as const;
export type CommoditySymbol = typeof COMMODITY_SYMBOLS[number];
export const COMMODITY_BENCHMARK = "DX-Y.NYB";

interface CachedCandles {
  timestamp: number;
  candles: Candle[];
}

const candleCache: Record<string, CachedCandles> = {};

/**
 * Fetches 1-Hour OHLCV data from Yahoo Finance chart endpoint with TTL caching and resilient error handling.
 */
export async function fetchCommodityKlines(
  symbol: string,
  range: string = "1mo",
  ttlMs: number = 30000
): Promise<Candle[]> {
  const cacheKey = `${symbol}_1h_${range}`;
  const now = Date.now();
  const cached = candleCache[cacheKey];

  if (cached && now - cached.timestamp < ttlMs) {
    return cached.candles;
  }

  const encodedSymbol = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=1h&range=${range}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Yahoo Finance HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      throw new Error("Invalid or empty chart payload returned from Yahoo Finance");
    }

    const timestamps: number[] = result.timestamp;
    const quote = result.indicators.quote[0];
    const opens: Array<number | null> = quote.open || [];
    const highs: Array<number | null> = quote.high || [];
    const lows: Array<number | null> = quote.low || [];
    const closes: Array<number | null> = quote.close || [];
    const volumes: Array<number | null> = quote.volume || [];

    const candles: Candle[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i];
      const h = highs[i];
      const l = lows[i];
      const c = closes[i];
      const v = volumes[i];

      // Drop holiday gaps or null bars
      if (
        o === null || o === undefined || isNaN(o) ||
        h === null || h === undefined || isNaN(h) ||
        l === null || l === undefined || isNaN(l) ||
        c === null || c === undefined || isNaN(c)
      ) {
        continue;
      }

      const openTime = timestamps[i] * 1000;
      const closeTime = (timestamps[i] + 3600) * 1000 - 1;

      candles.push({
        openTime,
        closeTime,
        open: Number(Number(o).toFixed(4)),
        high: Number(Number(h).toFixed(4)),
        low: Number(Number(l).toFixed(4)),
        close: Number(Number(c).toFixed(4)),
        volume: Number(v || 0),
      });
    }

    // Sort by openTime ascending & deduplicate
    candles.sort((a, b) => a.openTime - b.openTime);
    const deduplicated: Candle[] = [];
    const seenTimes = new Set<number>();
    for (const c of candles) {
      if (!seenTimes.has(c.openTime)) {
        seenTimes.add(c.openTime);
        deduplicated.push(c);
      }
    }

    candleCache[cacheKey] = {
      timestamp: now,
      candles: deduplicated,
    };

    return deduplicated;
  } catch (err: any) {
    console.warn(`[fetchCommodityKlines] Failed fetching ${symbol}: ${err?.message || err}`);
    if (cached) {
      console.warn(`[fetchCommodityKlines] Returning stale cache for ${symbol} (${cached.candles.length} bars)`);
      return cached.candles;
    }
    return [];
  }
}

/**
 * Clears the commodity candles cache (useful in tests).
 */
export function clearCommodityCandlesCache(): void {
  for (const k of Object.keys(candleCache)) {
    delete candleCache[k];
  }
}
