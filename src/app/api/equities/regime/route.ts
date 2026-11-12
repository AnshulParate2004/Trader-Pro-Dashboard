import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RegimeResponse {
  success: boolean;
  symbol: string;
  price: number;
  sma200: number;
  dist200SmaPct: number;
  isAbove200Sma: boolean;
  barsEvaluated: number;
  regime: "RISK_ON" | "CASH_DEFENSE";
  updatedAt: string;
  cached: boolean;
  stale: boolean;
  source: string;
  error?: string;
}

// In-memory cache
let cachedRegime: RegimeResponse | null = null;
let lastCacheTime = 0;
const REGIME_CACHE_TTL_MS = 60 * 1000; // 60 seconds

async function fetchSPYDailyBars(): Promise<{ closes: number[]; lastPrice: number } | null> {
  const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

  for (const host of hosts) {
    try {
      const url = `${host}/v8/finance/chart/SPY?interval=1d&range=1y`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!res.ok) continue;

      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;

      const rawCloses: (number | null)[] = result?.indicators?.quote?.[0]?.close || [];
      const validCloses = rawCloses.filter((c): c is number => typeof c === "number" && !isNaN(c));

      const metaPrice = result?.meta?.regularMarketPrice;
      const lastPrice = typeof metaPrice === "number" ? metaPrice : validCloses[validCloses.length - 1];

      if (validCloses.length >= 200 && typeof lastPrice === "number") {
        return { closes: validCloses, lastPrice };
      }
    } catch {
      // Try next host
    }
  }

  return null;
}

export async function GET() {
  const now = Date.now();

  // Return cached result if fresh
  if (cachedRegime && now - lastCacheTime < REGIME_CACHE_TTL_MS) {
    return NextResponse.json<RegimeResponse>({
      ...cachedRegime,
      cached: true,
      stale: false,
    });
  }

  const barData = await fetchSPYDailyBars();

  if (!barData) {
    // Return stale cache if available
    if (cachedRegime) {
      return NextResponse.json<RegimeResponse>({
        ...cachedRegime,
        cached: false,
        stale: true,
        source: "stale_fallback",
        error: "Upstream provider unreachable; returning stale cached regime",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch SPY daily closes from market data provider. Zero synthetic fallback.",
      },
      { status: 503 }
    );
  }

  const { closes, lastPrice } = barData;
  const last200 = closes.slice(-200);
  const sum = last200.reduce((acc, c) => acc + c, 0);
  const sma200 = sum / 200;
  const dist200SmaPct = sma200 > 0 ? ((lastPrice - sma200) / sma200) * 100 : 0;
  const isAbove200Sma = lastPrice > sma200;

  const response: RegimeResponse = {
    success: true,
    symbol: "SPY",
    price: Number(lastPrice.toFixed(2)),
    sma200: Number(sma200.toFixed(2)),
    dist200SmaPct: Number(dist200SmaPct.toFixed(2)),
    isAbove200Sma,
    barsEvaluated: 200,
    regime: isAbove200Sma ? "RISK_ON" : "CASH_DEFENSE",
    updatedAt: new Date(now).toISOString(),
    cached: false,
    stale: false,
    source: "yahoo_finance_1y_daily",
  };

  cachedRegime = response;
  lastCacheTime = now;

  return NextResponse.json<RegimeResponse>(response);
}
