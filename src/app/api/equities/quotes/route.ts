import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface QuoteItem {
  symbol: string;
  price: number;
  previousClose: number;
  changePct: number;
  changeUSD: number;
  timestamp: number;
  high?: number;
  low?: number;
  volume?: number;
}

interface QuotesResponse {
  success: boolean;
  market: {
    isOpen: boolean;
    session: "REGULAR" | "CLOSED";
    nyseTime: string;
    timezone: string;
  };
  cached: boolean;
  stale: boolean;
  updatedAt: string;
  quotes: Record<string, QuoteItem>;
  source: string;
  error?: string;
}

// In-memory cache
let cachedQuotes: Record<string, QuoteItem> = {};
let lastCacheTime = 0;
const CACHE_TTL_MS = 20 * 1000; // 20 seconds

const DEFAULT_UNIVERSE = [
  "SPY",
  "AAPL",
  "NVDA",
  "MSFT",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "JPM",
];

// Determine if NYSE is open
function isNYSEMarketOpen(): { isOpen: boolean; session: "REGULAR" | "CLOSED"; nyseTime: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
  });

  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));
  const weekday = parts.weekday; // 'Mon', 'Tue', etc.
  const hour = parseInt(parts.hour, 10);
  const minute = parseInt(parts.minute, 10);
  const month = parseInt(parts.month, 10);
  const day = parseInt(parts.day, 10);

  const nyseTimeString = `${parts.year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ET`;

  // Weekend check
  if (weekday === "Sat" || weekday === "Sun") {
    return { isOpen: false, session: "CLOSED", nyseTime: nyseTimeString };
  }

  // Common US market holidays (fixed date checks or known holidays)
  // Jan 1: New Year's Day
  if (month === 1 && day === 1) return { isOpen: false, session: "CLOSED", nyseTime: nyseTimeString };
  // June 19: Juneteenth
  if (month === 6 && day === 19) return { isOpen: false, session: "CLOSED", nyseTime: nyseTimeString };
  // July 4: Independence Day
  if (month === 7 && day === 4) return { isOpen: false, session: "CLOSED", nyseTime: nyseTimeString };
  // Dec 25: Christmas
  if (month === 12 && day === 25) return { isOpen: false, session: "CLOSED", nyseTime: nyseTimeString };

  // Regular NYSE hours: 09:30 to 16:00 ET
  const timeInMinutes = hour * 60 + minute;
  const isDuringRegularHours = timeInMinutes >= 9 * 60 + 30 && timeInMinutes < 16 * 60;

  return {
    isOpen: isDuringRegularHours,
    session: isDuringRegularHours ? "REGULAR" : "CLOSED",
    nyseTime: nyseTimeString,
  };
}

async function fetchQuoteFromYahoo(symbol: string): Promise<QuoteItem | null> {
  const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

  for (const host of hosts) {
    try {
      const url = `${host}/v8/finance/chart/${symbol}?interval=1d&range=1d`;
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
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) continue;

      const price = meta.regularMarketPrice;
      const previousClose = meta.chartPreviousClose || meta.previousClose || price;
      const changeUSD = price - previousClose;
      const changePct = previousClose > 0 ? (changeUSD / previousClose) * 100 : 0;
      const timestamp = meta.regularMarketTime || Math.floor(Date.now() / 1000);

      return {
        symbol,
        price: Number(price.toFixed(2)),
        previousClose: Number(previousClose.toFixed(2)),
        changePct: Number(changePct.toFixed(2)),
        changeUSD: Number(changeUSD.toFixed(2)),
        timestamp,
        high: meta.regularMarketDayHigh ? Number(meta.regularMarketDayHigh.toFixed(2)) : undefined,
        low: meta.regularMarketDayLow ? Number(meta.regularMarketDayLow.toFixed(2)) : undefined,
      };
    } catch {
      // Try next host
    }
  }

  // Fallback: If FINNHUB_API_KEY is configured in env
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        if (d && d.c) {
          const price = d.c;
          const previousClose = d.pc || price;
          const changeUSD = d.d || price - previousClose;
          const changePct = d.dp || (previousClose > 0 ? (changeUSD / previousClose) * 100 : 0);
          return {
            symbol,
            price: Number(price.toFixed(2)),
            previousClose: Number(previousClose.toFixed(2)),
            changePct: Number(changePct.toFixed(2)),
            changeUSD: Number(changeUSD.toFixed(2)),
            timestamp: d.t || Math.floor(Date.now() / 1000),
            high: d.h ? Number(d.h.toFixed(2)) : undefined,
            low: d.l ? Number(d.l.toFixed(2)) : undefined,
          };
        }
      }
    } catch {
      // Pass
    }
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");
  const symbolsToFetch = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_UNIVERSE;

  const marketInfo = isNYSEMarketOpen();
  const now = Date.now();

  // Check if cache is still fresh and contains all requested symbols
  const isCacheFresh = now - lastCacheTime < CACHE_TTL_MS;
  const hasAllSymbols = symbolsToFetch.every((s) => cachedQuotes[s]);

  if (isCacheFresh && hasAllSymbols) {
    const filteredQuotes: Record<string, QuoteItem> = {};
    for (const sym of symbolsToFetch) {
      if (cachedQuotes[sym]) filteredQuotes[sym] = cachedQuotes[sym];
    }
    return NextResponse.json<QuotesResponse>({
      success: true,
      market: {
        isOpen: marketInfo.isOpen,
        session: marketInfo.session,
        nyseTime: marketInfo.nyseTime,
        timezone: "America/New_York",
      },
      cached: true,
      stale: false,
      updatedAt: new Date(lastCacheTime).toISOString(),
      quotes: filteredQuotes,
      source: "in_memory_cache",
    });
  }

  // Fetch quotes concurrently
  const fetchPromises = symbolsToFetch.map(async (symbol) => {
    const quote = await fetchQuoteFromYahoo(symbol);
    return { symbol, quote };
  });

  const results = await Promise.all(fetchPromises);
  const newQuotes: Record<string, QuoteItem> = {};
  let anyFailed = false;

  for (const { symbol, quote } of results) {
    if (quote) {
      newQuotes[symbol] = quote;
      cachedQuotes[symbol] = quote;
    } else {
      anyFailed = true;
      // If single ticker failed, try using cached quote if present
      if (cachedQuotes[symbol]) {
        newQuotes[symbol] = cachedQuotes[symbol];
      }
    }
  }

  // If we got quotes for all or most, update cache time
  const hasQuotes = Object.keys(newQuotes).length > 0;
  if (hasQuotes) {
    lastCacheTime = now;
  }

  if (!hasQuotes) {
    // If completely empty and failed, check if we have any stale cache
    const staleKeys = Object.keys(cachedQuotes);
    if (staleKeys.length > 0) {
      return NextResponse.json<QuotesResponse>({
        success: true,
        market: {
          isOpen: marketInfo.isOpen,
          session: marketInfo.session,
          nyseTime: marketInfo.nyseTime,
          timezone: "America/New_York",
        },
        cached: false,
        stale: true,
        updatedAt: new Date(lastCacheTime).toISOString(),
        quotes: cachedQuotes,
        source: "stale_fallback",
        error: "Upstream provider unreachable; returning stale cached prices",
      });
    }

    return NextResponse.json<QuotesResponse>(
      {
        success: false,
        market: {
          isOpen: marketInfo.isOpen,
          session: marketInfo.session,
          nyseTime: marketInfo.nyseTime,
          timezone: "America/New_York",
        },
        cached: false,
        stale: false,
        updatedAt: new Date().toISOString(),
        quotes: {},
        source: "upstream_failed",
        error: "Failed to fetch live quotes from market data providers. Zero synthetic fallback.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json<QuotesResponse>({
    success: true,
    market: {
      isOpen: marketInfo.isOpen,
      session: marketInfo.session,
      nyseTime: marketInfo.nyseTime,
      timezone: "America/New_York",
    },
    cached: false,
    stale: anyFailed,
    updatedAt: new Date(now).toISOString(),
    quotes: newQuotes,
    source: "yahoo_finance_chart",
  });
}
