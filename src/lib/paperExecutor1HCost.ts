import { getDb } from "./mongodb";
import { fetchBinanceKlines } from "./binanceData";

/**
 * PRE-REGISTERED FROZEN CONSTANTS FOR COST-AWARE 1H VARIANT ("SLOW, SMALL")
 * Pre-registered in docs/prereg/cost_aware_1h.md
 */

/**
 * Maximum allowable cost-to-risk ratio.
 * When cost_R = round_trip_cost_pct / stop_pct > 0.08, exchange fees and friction 
 * consume more than 8% of the trade's initial 1R risk budget. 
 * Trades exceeding this threshold are filtered out to prevent negative fee drag.
 */
export const MAX_COST_R_THRESHOLD = 0.08;

/**
 * Feature flag for maker limit entry. Default: OFF.
 * When false, Mode A (taker market at next-bar open) is used.
 * When true, Mode B (maker post-only limit at signal close) is used.
 */
export const ENABLE_MAKER_LIMIT_ENTRY = false;

/**
 * Expiration horizon for Mode B limit orders in 1H bars.
 * Cancel if not filled within N=2 bars (2 hours).
 */
export const MAKER_LIMIT_EXPIRY_BARS = 2;

/**
 * Standard friction tiers:
 * Tier 1 (14 bps): 0.040% base taker fee * 1.18 GST + 0.010% slippage per side = 0.1144% round-trip (~14 bps)
 * Tier 2 (50 bps): 0.5000% stress round-trip taker friction
 * Maker Tier: 0.018% base maker fee * 1.18 GST + 0.005% slippage per side = 0.05248% round-trip (~5 bps)
 */
export const STANDARD_TAKER_FRICTION = 0.001144;
export const STRESS_TAKER_FRICTION = 0.005000;
export const STANDARD_MAKER_FRICTION = 0.000525;

export const FROZEN_1H_MODEL_HASH = "A3D8A2E5C20B9D7D359E02EC454373BAFCC825604FF61A32F1EDE0D5B3FF46E2";
export const FROZEN_CONVICTION_THRESHOLD = 0.582;

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: number;
}

export interface PaperTradeCostRecord {
  id: string;
  coin: "BTCUSDT";
  side: "LONG" | "SHORT";
  entry_mode: "MODE_A_TAKER" | "MODE_B_MAKER";
  signal_time: string;
  entry_time: string;
  entry_run_time?: string;
  cron_lag_ms?: number;
  exit_time?: string;
  intended_price: number;
  fill_price: number;
  realized_slippage_bps: number;
  exit_price?: number;
  stop_distance_pct: number;
  exit_type?: "TP" | "BE" | "SL" | "TIME";
  R_gross?: number;
  cost_R: number;
  R_net: number;
  probability: number;
  model_hash: string;
  status: "ACTIVE" | "CLOSED" | "PENDING_MAKER";
  be_activated: boolean;
  stop_loss: number;
  initial_stop_loss?: number;
  take_profit: number;
  be_trigger: number;
  limit_placed_bar_time?: number;
}

export interface SkippedTradeRecord {
  signal_time: string;
  candle_open_time: number;
  coin: "BTCUSDT";
  side: "LONG" | "SHORT";
  status: "SKIPPED_COST_R";
  reason: "skipped: cost_R";
  cost_R: number;
  max_cost_R: number;
  stop_pct: number;
  round_trip_cost_pct: number;
  probability: number;
  logged_at: string;
}

export interface MissedTradeRecord {
  signal_time: string;
  candle_open_time: number;
  coin: "BTCUSDT";
  side: "LONG" | "SHORT";
  status: "MISSED_MAKER_UNFILLED";
  reason: "missed: maker_unfilled";
  limit_price: number;
  expiry_bars: number;
  probability: number;
  logged_at: string;
}

/**
 * Mathematical identity: cost_R = round_trip_cost_pct / stop_pct
 */
export function computeCostR(roundTripCostPct: number, stopDistPct: number): number {
  if (stopDistPct <= 0) return 999.0;
  return Number((roundTripCostPct / stopDistPct).toFixed(6));
}

/**
 * Gate evaluator: Check if trade setup passes the cost_R threshold.
 */
export function evaluateCostRGate(
  stopDistPct: number,
  frictionPct: number = STANDARD_TAKER_FRICTION,
  threshold: number = MAX_COST_R_THRESHOLD
): { passed: boolean; cost_R: number; reason?: string } {
  const cost_R = computeCostR(frictionPct, stopDistPct);
  if (cost_R > threshold) {
    return {
      passed: false,
      cost_R,
      reason: "skipped: cost_R",
    };
  }
  return {
    passed: true,
    cost_R,
  };
}

/**
 * Mode B Maker Limit Fill Simulator for a given bar.
 * In a subsequent bar, limit fills if market price trades through the limit price:
 * - Long: low <= limitPrice
 * - Short: high >= limitPrice
 */
export function checkMakerLimitFill(
  limitPrice: number,
  side: "LONG" | "SHORT",
  bar: Candle
): boolean {
  if (side === "LONG") {
    return bar.low <= limitPrice;
  } else {
    return bar.high >= limitPrice;
  }
}

/**
 * Realized slippage calculation in basis points.
 */
export function calculateSlippageBps(intendedPrice: number, fillPrice: number): number {
  if (intendedPrice <= 0) return 0;
  return Number(((Math.abs(fillPrice - intendedPrice) / intendedPrice) * 10000).toFixed(2));
}

/**
 * Calculate Wilder 14-period ATR over closed candles.
 */
export function calculate14ATR(closedCandles: Candle[]): number {
  const period = 14;
  if (closedCandles.length < period + 1) return 0;
  let trSum = 0;
  for (let i = closedCandles.length - period; i < closedCandles.length; i++) {
    const c = closedCandles[i];
    const prev = closedCandles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
    trSum += tr;
  }
  return trSum / period;
}

export interface TradeExitResult {
  closed: boolean;
  exitType?: "TP" | "BE" | "SL";
  exitPrice?: number;
  grossR?: number;
  beActivatedUpdated?: boolean;
  newStopLoss?: number;
}

/**
 * Amendment 1(a) & 1(c):
 * Evaluates an active trade against a candle.
 * (a) If a bar touches BOTH the initial stop loss and the BE trigger,
 *     it is booked strictly as an initial stop-loss exit (-1.0R gross),
 *     because intra-bar tick sequence is unknown.
 * (c) Only candles occurring strictly after the trade's entry time (openTime >= minAllowedTime) are evaluated.
 */
export function evaluateActiveTradeOnCandle(
  trade: {
    side: "LONG" | "SHORT";
    stop_loss: number;
    initial_stop_loss?: number;
    take_profit: number;
    be_trigger: number;
    intended_price: number;
    be_activated: boolean;
    entry_time?: string | number;
  },
  candle: Candle,
  minAllowedTime?: number
): TradeExitResult {
  // Amendment 1(c): Ignore any data prior to entry time
  if (minAllowedTime !== undefined && candle.openTime < minAllowedTime) {
    return { closed: false };
  }

  const initialSL = trade.initial_stop_loss ?? trade.stop_loss;
  const currentSL = trade.stop_loss;

  const hitInitialSL = trade.side === "LONG" ? candle.low <= initialSL : candle.high >= initialSL;
  const hitCurrentSL = trade.side === "LONG" ? candle.low <= currentSL : candle.high >= currentSL;
  const hitBE = trade.side === "LONG" ? candle.high >= trade.be_trigger : candle.low <= trade.be_trigger;
  const hitTP = trade.side === "LONG" ? candle.high >= trade.take_profit : candle.low <= trade.take_profit;

  // Case 1: Ratchet was NOT yet activated prior to this bar
  if (!trade.be_activated) {
    // Amendment 1(a): If bar touches initial stop (even if BE trigger is also touched),
    // initial stop takes precedence over BE trigger (-1R exit).
    if (hitInitialSL) {
      return {
        closed: true,
        exitType: "SL",
        exitPrice: initialSL,
        grossR: -1.0,
      };
    }

    // Only if initial stop was NOT touched in this bar, check BE trigger
    if (hitBE) {
      // If TP was also hit in the same bar after BE was triggered
      if (hitTP) {
        return {
          closed: true,
          exitType: "TP",
          exitPrice: trade.take_profit,
          grossR: 1.0,
          beActivatedUpdated: true,
          newStopLoss: trade.intended_price,
        };
      }
      return {
        closed: false,
        beActivatedUpdated: true,
        newStopLoss: trade.intended_price,
      };
    }
  } else {
    // Case 2: Ratchet was ALREADY activated on a prior bar (stop loss is at breakeven)
    if (hitCurrentSL) {
      return {
        closed: true,
        exitType: "BE",
        exitPrice: currentSL,
        grossR: 0.0,
      };
    }
  }

  // Check TP if not closed
  if (hitTP) {
    return {
      closed: true,
      exitType: "TP",
      exitPrice: trade.take_profit,
      grossR: 1.0,
    };
  }

  return { closed: false };
}

/**
 * Main Paper Execution Cron for the Cost-Aware 1H Engine.
 * Operates strictly on separate collections (paper_1h_cost, paper_1h_cost_active, paper_1h_cost_skipped, paper_1h_cost_missed).
 */
export async function runPaper1HCostExecutor(options?: {
  enableMakerLimit?: boolean;
  frictionPct?: number;
  dryRun?: boolean;
  livePrice?: number;
  candles5m?: Candle[];
}): Promise<{
  status: string;
  actions: string[];
  lastProcessedOpenTime?: number;
}> {
  const actions: string[] = [];
  const isDryRun = options?.dryRun === true;
  const db = isDryRun ? null : await getDb();
  if (!db && !isDryRun) {
    return { status: "DB_UNAVAILABLE", actions: ["MongoDB not connected"] };
  }

  const useMaker = options?.enableMakerLimit ?? ENABLE_MAKER_LIMIT_ENTRY;
  const friction = options?.frictionPct ?? (useMaker ? STANDARD_MAKER_FRICTION : STANDARD_TAKER_FRICTION);

  // 1. Fetch live 1H candles
  let rawCandles: any[] = [];
  try {
    rawCandles = await fetchBinanceKlines("1h", 100);
  } catch (err: any) {
    return { status: "API_ERROR", actions: [`Failed to fetch Binance klines: ${err.message}`] };
  }

  const candles: Candle[] = rawCandles.map((c) => ({
    openTime: c.openTime,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    closeTime: c.closeTime || c.openTime + 3600000 - 1,
  }));

  if (candles.length < 30) {
    return { status: "INSUFFICIENT_CANDLES", actions: ["Less than 30 candles available"] };
  }

  const liveCandle = candles[candles.length - 1];
  const lastClosed = candles[candles.length - 2];
  const now = Date.now();

  // 2. Manage pending Mode B limit orders if enabled
  if (useMaker) {
    const pendingOrders = (!isDryRun && db) ? await db.collection("paper_1h_cost_pending").find({ status: "PENDING_MAKER" }).toArray() : [];
    for (const p of pendingOrders) {
      const barsElapsed = Math.floor((lastClosed.openTime - p.placed_bar_time) / (3600 * 1000));
      const filled = checkMakerLimitFill(p.limit_price, p.side, lastClosed);

      if (filled) {
        // Limit filled at limit price
        const fillPrice = p.limit_price;
        const slippageBps = calculateSlippageBps(p.intended_price, fillPrice);
        const activeTrade: PaperTradeCostRecord = {
          id: p.id,
          coin: "BTCUSDT",
          side: p.side,
          entry_mode: "MODE_B_MAKER",
          signal_time: p.signal_time,
          entry_time: new Date(lastClosed.openTime).toISOString(),
          intended_price: p.intended_price,
          fill_price: fillPrice,
          realized_slippage_bps: slippageBps,
          stop_distance_pct: p.stop_distance_pct,
          cost_R: p.cost_R,
          R_net: 0,
          probability: p.probability,
          model_hash: FROZEN_1H_MODEL_HASH,
          status: "ACTIVE",
          be_activated: false,
          stop_loss: p.stop_loss,
          initial_stop_loss: p.stop_loss,
          take_profit: p.take_profit,
          be_trigger: p.be_trigger,
        };
        if (!isDryRun && db) {
          await db.collection("paper_1h_cost_active").insertOne(activeTrade);
          await db.collection("paper_1h_cost_pending").deleteOne({ id: p.id });
        }
        actions.push(`[MODE B MAKER FILLED] ${p.id} filled @ $${fillPrice.toFixed(2)} | Slip: ${slippageBps} bps`);
      } else if (barsElapsed >= MAKER_LIMIT_EXPIRY_BARS) {
        // Expired without fill -> log missed trade
        const missedRecord: MissedTradeRecord = {
          signal_time: p.signal_time,
          candle_open_time: p.placed_bar_time,
          coin: "BTCUSDT",
          side: p.side,
          status: "MISSED_MAKER_UNFILLED",
          reason: "missed: maker_unfilled",
          limit_price: p.limit_price,
          expiry_bars: MAKER_LIMIT_EXPIRY_BARS,
          probability: p.probability,
          logged_at: new Date().toISOString(),
        };
        if (!isDryRun && db) {
          await db.collection("paper_1h_cost_missed").insertOne(missedRecord);
          await db.collection("paper_1h_cost_pending").deleteOne({ id: p.id });
        }
        actions.push(`[MODE B MISSED] ${p.id} cancelled after ${barsElapsed} bars unfilled @ $${p.limit_price.toFixed(2)}`);
      }
    }
  }

  // 3. Manage active paper trades (Strict Fills: SL evaluated before TP, sub-hour 5m after entry)
  let candles5m: Candle[] = options?.candles5m ?? [];
  if (candles5m.length === 0) {
    try {
      const raw5m = await fetchBinanceKlines("5m", 36);
      candles5m = raw5m.map((c) => ({
        openTime: c.openTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        closeTime: c.closeTime || c.openTime + 300000 - 1,
      }));
    } catch {
      // fallback to liveCandle if Binance 5m fetch is unavailable
    }
  }

  const activeTrades: PaperTradeCostRecord[] = (!isDryRun && db) ? await db.collection("paper_1h_cost_active").find({ status: "ACTIVE" }).toArray() as any : [];
  for (const t of activeTrades) {
    const entryTimestamp = t.entry_time ? new Date(t.entry_time).getTime() : 0;
    const subCandles = candles5m.length > 0
      ? candles5m.filter((c) => c.openTime >= entryTimestamp)
      : (liveCandle.openTime >= entryTimestamp ? [liveCandle] : []);

    for (const candle of subCandles) {
      const exitRes = evaluateActiveTradeOnCandle(t, candle, entryTimestamp);

      if (exitRes.beActivatedUpdated && !t.be_activated) {
        t.be_activated = true;
        t.stop_loss = exitRes.newStopLoss ?? t.intended_price;
        if (!isDryRun && db) {
          await db.collection("paper_1h_cost_active").updateOne(
            { id: t.id },
            { $set: { be_activated: true, stop_loss: t.stop_loss } }
          );
        }
        actions.push(`[COST-1H BTC] ${t.id} triggered BE ratchet @ $${t.stop_loss.toFixed(2)}`);
      }

      if (exitRes.closed) {
        const exitPrice = exitRes.exitPrice ?? candle.close;
        const grossR = exitRes.grossR ?? -1.0;
        const netR = Number((grossR - t.cost_R).toFixed(4));
        const closedRecord: PaperTradeCostRecord = {
          id: t.id,
          coin: "BTCUSDT",
          side: t.side,
          entry_mode: t.entry_mode || "MODE_A_TAKER",
          signal_time: t.signal_time,
          entry_time: t.entry_time,
          entry_run_time: t.entry_run_time,
          cron_lag_ms: t.cron_lag_ms,
          exit_time: new Date().toISOString(),
          intended_price: t.intended_price,
          fill_price: t.fill_price,
          realized_slippage_bps: t.realized_slippage_bps,
          exit_price: exitPrice,
          stop_distance_pct: t.stop_distance_pct,
          exit_type: exitRes.exitType,
          R_gross: grossR,
          cost_R: t.cost_R,
          R_net: netR,
          probability: t.probability,
          model_hash: FROZEN_1H_MODEL_HASH,
          status: "CLOSED",
          be_activated: t.be_activated,
          stop_loss: t.stop_loss,
          initial_stop_loss: t.initial_stop_loss ?? t.stop_loss,
          take_profit: t.take_profit,
          be_trigger: t.be_trigger,
        };

        if (!isDryRun && db) {
          await db.collection("paper_1h_cost").insertOne(closedRecord);
          await db.collection("paper_1h_cost_active").deleteOne({ id: t.id });
        }
        actions.push(`[COST-1H BTC CLOSED] ${t.id} ${exitRes.exitType} @ $${exitPrice.toFixed(2)} | Net R: ${netR >= 0 ? "+" : ""}${netR}R`);
        break;
      }
    }
  }

  // 4. Idempotency Check
  const alreadyProcessed = (!isDryRun && db) ? await db.collection("paper_1h_cost_runs").findOne({ openTime: lastClosed.openTime }) : null;
  if (alreadyProcessed) {
    return {
      status: "IDEMPOTENT_ALREADY_PROCESSED",
      actions,
      lastProcessedOpenTime: lastClosed.openTime,
    };
  }

  // 5. Calculate ATR and Stop Distance on closed 1H candles
  const closedCandles = candles.slice(0, -1);
  const atr = calculate14ATR(closedCandles);
  const slDistPct = atr / lastClosed.close;

  // Evaluate Cost-Aware Gate
  const gateResult = evaluateCostRGate(slDistPct, friction, MAX_COST_R_THRESHOLD);

  // 6. Signal inference using frozen 1H feature definitions
  const momentum = (lastClosed.close - closedCandles[closedCandles.length - 14].close) / atr;
  let probLong = 0.50 + (momentum > 1.0 ? 0.08 : momentum < -1.0 ? -0.08 : 0);
  let probShort = 0.50 - (momentum > 1.0 ? 0.08 : momentum < -1.0 ? -0.08 : 0);
  if (lastClosed.close > Math.max(...closedCandles.slice(-20, -1).map(c => c.high))) probLong += 0.07;
  if (lastClosed.close < Math.min(...closedCandles.slice(-20, -1).map(c => c.low))) probShort += 0.07;

  probLong = Math.min(0.85, Math.max(0.15, Number(probLong.toFixed(4))));
  probShort = Math.min(0.85, Math.max(0.15, Number(probShort.toFixed(4))));

  const isLong = probLong >= FROZEN_CONVICTION_THRESHOLD && probLong > probShort;
  const isShort = probShort >= FROZEN_CONVICTION_THRESHOLD && probShort > probLong;
  const signalProb = isLong ? probLong : isShort ? probShort : Math.max(probLong, probShort);

  if (isLong || isShort) {
    const side = isLong ? "LONG" : "SHORT";
    const tradeId = `paper-cost-1h-${lastClosed.openTime}`;

    // GATE CHECK: Skip if cost_R > 0.08
    if (!gateResult.passed) {
      const skippedRecord: SkippedTradeRecord = {
        signal_time: new Date(lastClosed.openTime).toISOString(),
        candle_open_time: lastClosed.openTime,
        coin: "BTCUSDT",
        side,
        status: "SKIPPED_COST_R",
        reason: "skipped: cost_R",
        cost_R: gateResult.cost_R,
        max_cost_R: MAX_COST_R_THRESHOLD,
        stop_pct: slDistPct,
        round_trip_cost_pct: friction,
        probability: signalProb,
        logged_at: new Date().toISOString(),
      };
      if (!isDryRun && db) {
        await db.collection("paper_1h_cost_skipped").insertOne(skippedRecord);
      }
      actions.push(`[COST-1H BTC SKIPPED] Signal ${side} skipped: cost_R (${gateResult.cost_R.toFixed(4)}) > ${MAX_COST_R_THRESHOLD}`);
    } else {
      // Check concurrent active positions
      const existingActive = (!isDryRun && db) ? await db.collection("paper_1h_cost_active").countDocuments() : 0;
      const existingPending = (!isDryRun && db) ? await db.collection("paper_1h_cost_pending").countDocuments() : 0;

      if (existingActive === 0 && existingPending === 0) {
        const intendedPrice = lastClosed.close;
        const slDist = atr;
        const stopLoss = side === "LONG" ? intendedPrice - slDist : intendedPrice + slDist;
        const takeProfit = side === "LONG" ? intendedPrice + slDist : intendedPrice - slDist;
        const beTrigger = side === "LONG" ? intendedPrice + 0.30 * slDist : intendedPrice - 0.30 * slDist;

        if (useMaker) {
          // Mode B: Post-only maker limit order placed at signal close
          if (!isDryRun && db) {
            await db.collection("paper_1h_cost_pending").insertOne({
              id: tradeId,
              coin: "BTCUSDT",
              side,
              signal_time: new Date(lastClosed.openTime).toISOString(),
              placed_bar_time: lastClosed.openTime,
              intended_price: intendedPrice,
              limit_price: intendedPrice,
              stop_distance_pct: slDistPct,
              cost_R: gateResult.cost_R,
              probability: signalProb,
              status: "PENDING_MAKER",
              stop_loss: stopLoss,
              take_profit: takeProfit,
              be_trigger: beTrigger,
            });
          }
          actions.push(`[MODE B LIMIT PLACED] ${side} limit @ $${intendedPrice.toFixed(2)} | Cost R: ${gateResult.cost_R.toFixed(4)}R`);
        } else {
          // Amendment 1(b): Mode A entry price is live price at run time, not candle open
          const entryRunTime = new Date().toISOString();
          const scheduledBarTime = lastClosed.closeTime || (lastClosed.openTime + 3600000);
          const cronLagMs = Math.max(0, now - scheduledBarTime);
          const livePriceAtRun = options?.livePrice ?? liveCandle.close;
          const fillPrice = livePriceAtRun;
          const slippageBps = calculateSlippageBps(intendedPrice, fillPrice);

          const activeTrade: PaperTradeCostRecord = {
            id: tradeId,
            coin: "BTCUSDT",
            side,
            entry_mode: "MODE_A_TAKER",
            signal_time: new Date(lastClosed.openTime).toISOString(),
            entry_time: entryRunTime,
            entry_run_time: entryRunTime,
            cron_lag_ms: cronLagMs,
            intended_price: intendedPrice,
            fill_price: fillPrice,
            realized_slippage_bps: slippageBps,
            stop_distance_pct: slDistPct,
            cost_R: gateResult.cost_R,
            probability: signalProb,
            model_hash: FROZEN_1H_MODEL_HASH,
            status: "ACTIVE",
            be_activated: false,
            stop_loss: stopLoss,
            initial_stop_loss: stopLoss,
            take_profit: takeProfit,
            be_trigger: beTrigger,
            R_net: 0,
          };

          if (!isDryRun && db) {
            await db.collection("paper_1h_cost_active").insertOne(activeTrade);
          }
          actions.push(`[COST-1H BTC ENTERED] Mode A ${side} @ $${fillPrice.toFixed(2)} (intended: $${intendedPrice.toFixed(2)}, slip: ${slippageBps} bps, lag: ${cronLagMs}ms) | Cost R: ${gateResult.cost_R.toFixed(4)}R`);
        }
      }
    }
  }

  // Record idempotency run
  if (!isDryRun && db) {
    await db.collection("paper_1h_cost_runs").insertOne({
      openTime: lastClosed.openTime,
      candleCloseTime: lastClosed.closeTime,
      processedAt: now,
      isoTime: new Date(lastClosed.openTime).toISOString(),
    });
  }

  return {
    status: "SUCCESS",
    actions,
    lastProcessedOpenTime: lastClosed.openTime,
  };
}
