import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { BOOK_CONFIGS } from "@/lib/engineTypes";
import { getNyseSessionStatus } from "@/lib/nyseCalendar";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const SEALED_START_DATE = "2026-11-11";
const LOG_TTL_SECONDS = 90 * 24 * 3600; // 90 days TTL

interface DailyBarSummary {
  symbol: string;
  sessionDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma200?: number;
  momentum12_1?: number; // 12-1 month return: (P_{t-21} - P_{t-252}) / P_{t-252}
}

/**
 * Robust fetcher with retries and timeout for Yahoo Chart v8 daily series
 */
async function fetchDailyBars(symbol: string, retries = 3): Promise<{ bars: DailyBarSummary[]; error?: string }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2y`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TraderPro/2.0" },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (attempt === retries) return { bars: [], error: `HTTP ${res.status}` };
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }

      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) return { bars: [], error: "No chart result" };

      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];
      const closes = quote.close || [];
      const volumes = quote.volume || [];

      const bars: DailyBarSummary[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] != null && opens[i] != null) {
          const dateStr = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
          bars.push({
            symbol,
            sessionDate: dateStr,
            open: opens[i],
            high: highs[i] ?? opens[i],
            low: lows[i] ?? opens[i],
            close: closes[i],
            volume: volumes[i] ?? 0,
          });
        }
      }

      // Compute technical indicators
      if (bars.length >= 200) {
        const last200 = bars.slice(-200);
        const sma200 = last200.reduce((acc, b) => acc + b.close, 0) / 200;
        bars[bars.length - 1].sma200 = sma200;
      }

      if (bars.length >= 252) {
        const p_t21 = bars[bars.length - 21]?.close;
        const p_t252 = bars[bars.length - 252]?.close;
        if (p_t21 && p_t252 && p_t252 > 0) {
          bars[bars.length - 1].momentum12_1 = (p_t21 - p_t252) / p_t252;
        }
      }

      return { bars };
    } catch (err: any) {
      if (attempt === retries) return { bars: [], error: err.message || "Fetch failed" };
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  return { bars: [], error: "Exceeded max retries" };
}

export async function POST(req: Request) {
  return handleEvaluation(req);
}

export async function GET(req: Request) {
  return handleEvaluation(req);
}

async function handleEvaluation(req: Request) {
  try {
    const url = new URL(req.url);

    // 1. Strict Security Guard: Secrets via HEADERS ONLY. Reject query string secrets.
    if (url.searchParams.has("secret") || url.searchParams.has("token")) {
      return NextResponse.json(
        {
          success: false,
          error: "SECURITY VIOLATION: Query string secrets are strictly forbidden. Pass secret via Authorization: Bearer <secret> or x-cron-secret header.",
        },
        { status: 403 }
      );
    }

    const authHeader = req.headers.get("authorization");
    const cronSecretHeader = req.headers.get("x-cron-secret");
    const configuredSecret = process.env.CRON_SECRET;

    const hasValidHeader =
      configuredSecret &&
      (authHeader === `Bearer ${configuredSecret}` || cronSecretHeader === configuredSecret);

    // If no cron secret in header, check if running in non-production local development
    if (!hasValidHeader && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Missing or invalid CRON_SECRET header." },
        { status: 401 }
      );
    }

    // 2. Determine Step ("close" or "open")
    let requestedStep = req.headers.get("x-step") || url.searchParams.get("step");
    if (!requestedStep && req.method === "POST") {
      try {
        const body = await req.json();
        requestedStep = body?.step;
      } catch (_) {
        // body optional
      }
    }

    const now = new Date();
    const nyseSession = getNyseSessionStatus(now);

    // Auto-detect step if unspecified based on market phase
    const step: "close" | "open" =
      requestedStep === "open"
        ? "open"
        : requestedStep === "close"
        ? "close"
        : nyseSession.marketPhase === "POST_CLOSE"
        ? "close"
        : "open";

    // 3. NYSE Calendar Guard: skip execution on weekends or holidays
    if (!nyseSession.isTradingDay) {
      return NextResponse.json({
        success: true,
        action: "SKIPPED_MARKET_CLOSED",
        sessionDate: nyseSession.sessionDate,
        reason: nyseSession.reason,
        step,
      });
    }

    const db = await getDb();

    // Ensure MongoDB TTL and Unique compound indexes exist
    if (db) {
      try {
        await db.collection("live_prediction_logs_us_equities").createIndex(
          { created_at: 1 },
          { expireAfterSeconds: LOG_TTL_SECONDS, background: true }
        );
        await db.collection("paper_trades_us_equities").createIndex(
          { symbol: 1, session_date: 1 },
          { unique: true, background: true }
        );
      } catch (idxErr) {
        console.warn("Index setup warning:", idxErr);
      }
    }

    // Load Universe
    const universePath = path.join(process.cwd(), "config", "us_equities", "universe.json");
    let universeConfig: any = null;
    if (fs.existsSync(universePath)) {
      universeConfig = JSON.parse(fs.readFileSync(universePath, "utf-8"));
    }
    const candidates: string[] = universeConfig?.sample_rebalance_snapshot_2026?.slice(0, 30) || [
      "NVDA", "AAPL", "META", "MSFT", "AMZN", "GOOGL", "TSLA", "AVGO", "AMD", "BRK-B",
      "ORCL", "LLY", "WMT", "JPM", "V", "COST", "NFLX", "MA", "UNH", "XOM",
      "CRM", "HD", "BAC", "PG", "CSCO", "ABBV", "CVX", "KO", "GE", "QCOM"
    ];

    // =========================================================================
    // STEP 1: POST-CLOSE SIGNAL COMPUTATION (After 16:00 ET)
    // =========================================================================
    if (step === "close") {
      // 1. Fetch SPY to assess market regime
      const spyResult = await fetchDailyBars("SPY");
      if (!spyResult.bars.length) {
        throw new Error(`Failed to fetch SPY daily bars: ${spyResult.error}`);
      }
      const latestSpy = spyResult.bars[spyResult.bars.length - 1];

      // Staleness check: ensure bar date is today's trading session
      const isStale = latestSpy.sessionDate < nyseSession.sessionDate;
      const spyClose = latestSpy.close;
      const spySma200 = latestSpy.sma200 ?? spyClose;
      const isRiskOn = spyClose > spySma200;

      // 2. Fetch candidates & compute 12-1 month momentum
      let momentumRankings: { symbol: string; momentum: number; close: number }[] = [];
      if (isRiskOn) {
        const fetchPromises = candidates.map(async (sym) => {
          const res = await fetchDailyBars(sym);
          if (res.bars.length >= 252) {
            const lastBar = res.bars[res.bars.length - 1];
            return {
              symbol: sym,
              momentum: lastBar.momentum12_1 ?? 0,
              close: lastBar.close,
            };
          }
          return null;
        });

        const results = await Promise.all(fetchPromises);
        momentumRankings = results.filter((r): r is { symbol: string; momentum: number; close: number } => r !== null);
        momentumRankings.sort((a, b) => b.momentum - a.momentum);
      }

      // S2 Shadow positions: Top 10 equal-weight if Risk-On; 0 positions (Cash) if Risk-Off
      const selectedTop10 = isRiskOn ? momentumRankings.slice(0, 10) : [];

      // 3. Evaluate SpaceX (SPCX) - Watchlist only, zero trades
      let spcxAudit: any = { ticker: "SPCX", status: "NOT_FETCHED" };
      try {
        const spcxRes = await fetchDailyBars("SPCX");
        if (spcxRes.bars.length) {
          const lastBar = spcxRes.bars[spcxRes.bars.length - 1];
          spcxAudit = {
            ticker: "SPCX",
            sessionDate: lastBar.sessionDate,
            close: lastBar.close,
            action: "WATCHLIST_ONLY_NO_EXECUTION",
            note: "SpaceX forward monitoring only; no execution permitted under pre-registration.",
          };
        }
      } catch (_) {
        spcxAudit = { ticker: "SPCX", status: "FAILED_FETCH_WATCHLIST_SAFE" };
      }

      const pendingOrderDoc = {
        book: "us_equities",
        session_date: nyseSession.sessionDate,
        step: "CLOSE_SIGNAL_GENERATED",
        timestamp_utc: now.toISOString(),
        is_stale_warning: isStale,
        spy_regime: {
          sessionDate: latestSpy.sessionDate,
          close: spyClose,
          sma200: spySma200,
          regime: isRiskOn ? "RISK_ON" : "CASH_SHIELD_BELOW_SMA200",
        },
        intended_fill: "NEXT_DAY_OPEN",
        target_positions: selectedTop10.map((item, idx) => ({
          symbol: item.symbol,
          rank: idx + 1,
          momentum_12_1: item.momentum,
          target_weight_pct: 10.0,
          last_close: item.close,
        })),
        spcx_watchlist: spcxAudit,
        status: "PENDING_OPEN_FILL",
        created_at: now,
      };

      if (db) {
        await db.collection("equities_pending_orders").updateOne(
          { session_date: nyseSession.sessionDate },
          { $set: pendingOrderDoc },
          { upsert: true }
        );

        await db.collection("live_prediction_logs_us_equities").insertOne({
          ...pendingOrderDoc,
          log_type: "DAILY_CLOSE_SIGNALS",
        });
      }

      return NextResponse.json({
        success: true,
        step: "close",
        sessionDate: nyseSession.sessionDate,
        spyRegime: pendingOrderDoc.spy_regime,
        targetConstituentsCount: selectedTop10.length,
        selectedTop10: selectedTop10.map((s) => s.symbol),
        spcxWatchlist: spcxAudit,
        note: "Signals recorded. Fills will execute at the next day NYSE open.",
      });
    }

    // =========================================================================
    // STEP 2: NEXT-DAY OPEN PAPER FILL EXECUTION (After ~09:45 ET)
    // =========================================================================
    if (step === "open") {
      let pendingDoc: any = null;
      if (db) {
        pendingDoc = await db.collection("equities_pending_orders").findOne({
          status: "PENDING_OPEN_FILL",
        });
      }

      const targetSymbols = pendingDoc?.target_positions?.map((p: any) => p.symbol) || [];

      // Fetch actual open prices for today
      const fills: any[] = [];
      for (const sym of targetSymbols) {
        const barRes = await fetchDailyBars(sym);
        if (barRes.bars.length) {
          const latestBar = barRes.bars[barRes.bars.length - 1];
          const openPrice = latestBar.open;
          const startingCapital = BOOK_CONFIGS.us_equities.startingCapital;
          const targetAllocationUSD = startingCapital * 0.10; // 10%
          const shares = openPrice > 0 ? Number((targetAllocationUSD / openPrice).toFixed(4)) : 0;

          const tradeDoc = {
            book: "us_equities",
            strategy: "S2_MOMENTUM_SHADOW",
            symbol: sym,
            session_date: nyseSession.sessionDate,
            side: "BUY",
            shares,
            entry_price: openPrice,
            entry_time: now.toISOString(),
            status: "OPEN",
            sealed_start_date: SEALED_START_DATE,
            created_at: now,
          };

          fills.push(tradeDoc);

          if (db) {
            // Deduplicate by (symbol, session_date)
            await db.collection("paper_trades_us_equities").updateOne(
              { symbol: sym, session_date: nyseSession.sessionDate },
              { $set: tradeDoc },
              { upsert: true }
            );
          }
        }
      }

      // Mark pending orders as filled
      if (db && pendingDoc) {
        await db.collection("equities_pending_orders").updateOne(
          { _id: pendingDoc._id },
          { $set: { status: "FILLED", filled_at: now } }
        );
      }

      // Update local file fallback
      const fallbackTradesPath = path.join(process.cwd(), "src", "data", "paper_trades_us_equities.json");
      let existingTrades: any[] = [];
      if (fs.existsSync(fallbackTradesPath)) {
        try {
          existingTrades = JSON.parse(fs.readFileSync(fallbackTradesPath, "utf-8"));
        } catch (_) {}
      }

      // Merge fills idempotently
      for (const fill of fills) {
        const idx = existingTrades.findIndex(
          (t: any) => t.symbol === fill.symbol && t.session_date === fill.session_date
        );
        if (idx >= 0) {
          existingTrades[idx] = fill;
        } else {
          existingTrades.unshift(fill);
        }
      }
      fs.writeFileSync(fallbackTradesPath, JSON.stringify(existingTrades, null, 2), "utf-8");

      return NextResponse.json({
        success: true,
        step: "open",
        sessionDate: nyseSession.sessionDate,
        filledOrdersCount: fills.length,
        fills: fills.map((f) => ({ symbol: f.symbol, shares: f.shares, openPrice: f.entry_price })),
        sealedStartDate: SEALED_START_DATE,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid step requested" }, { status: 400 });
  } catch (err: any) {
    console.error("US Equities evaluate route error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute equities evaluation" },
      { status: 500 }
    );
  }
}
