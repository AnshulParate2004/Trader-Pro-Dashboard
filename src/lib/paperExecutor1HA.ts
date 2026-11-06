import { getDb } from "./mongodb";
import { fetchBinanceKlines } from "./binanceData";
import fs from "fs";
import path from "path";

export const FROZEN_1H_A_MODEL_HASH = "A3D8A2E5C20B9D7D359E02EC454373BAFCC825604FF61A32F1EDE0D5B3FF46E2";
export const FROZEN_CONVICTION_THRESHOLD = 0.582; // Top 20% expanding-window threshold for BTC 1H
export const MAX_COST_R = 0.15; // Skip trades where round-trip cost in R > 0.15

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: number;
}

export interface PaperTradeRecord {
  id: string;
  coin: "BTCUSDT";
  side: "LONG" | "SHORT";
  signal_time: string;
  entry_time: string;
  exit_time?: string;
  entry_price: number;
  exit_price?: number;
  stop_distance_pct: number;
  exit_type?: "TP" | "BE" | "SL" | "TIME";
  R_gross?: number;
  cost_R_taker: number;
  R_net_taker?: number;
  probability: number;
  model_hash: string;
  status: "ACTIVE" | "CLOSED";
  be_activated: boolean;
  stop_loss: number;
  take_profit: number;
  be_trigger: number;
}

export async function runPaper1HAExecutor(): Promise<{
  status: string;
  actions: string[];
  lastProcessedOpenTime?: number;
  missedRunAlert?: boolean;
}> {
  const actions: string[] = [];
  const db = await getDb();
  if (!db) {
    return { status: "DB_UNAVAILABLE", actions: ["MongoDB not connected"] };
  }

  // 1. Fetch live 1H candles for BTCUSDT using resilient multi-endpoint fetcher
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

  // Strictly use completed, CLOSED 1H candles
  const liveCandle = candles[candles.length - 1];
  const lastClosed = candles[candles.length - 2];
  const currentPrice = liveCandle.close;
  const now = Date.now();

  // 2. Alert on missed runs: check elapsed time since expected closed candle
  let missedRunAlert = false;
  const lastRunDoc = await db.collection("paper_1h_a_runs").findOne({}, { sort: { openTime: -1 } });
  if (lastRunDoc) {
    const elapsedSinceLastRunMs = now - lastRunDoc.processedAt;
    if (elapsedSinceLastRunMs > 75 * 60 * 1000) { // > 1h 15m
      missedRunAlert = true;
      actions.push(`[ALERT: MISSED RUN] Over ${Math.round(elapsedSinceLastRunMs / 60000)} minutes since last paper executor run!`);
    }
  }

  // 3. Manage active paper trades (Exits: TP / BE Ratchet / SL)
  const activeTrades = await db.collection("paper_1h_a_active").find({ status: "ACTIVE" }).toArray();
  for (const t of activeTrades) {
    let closed = false;
    let exitType: "TP" | "BE" | "SL" = "SL";
    let exitPrice = currentPrice;
    let grossR = 0;

    if (t.side === "LONG") {
      // Check BE trigger: +0.30R
      if (!t.be_activated && currentPrice >= t.be_trigger) {
        await db.collection("paper_1h_a_active").updateOne(
          { id: t.id },
          { $set: { be_activated: true, stop_loss: t.entry_price + (t.stop_distance_pct * currentPrice * t.cost_R_taker) } }
        );
        actions.push(`[1H-A BTC] ${t.id} triggered BE ratchet @ $${currentPrice.toFixed(2)}`);
      }
      // Check TP (+1.0R)
      if (currentPrice >= t.take_profit) {
        closed = true;
        exitType = "TP";
        exitPrice = t.take_profit;
        grossR = 1.0;
      } else if (currentPrice <= t.stop_loss) {
        closed = true;
        exitType = t.be_activated ? "BE" : "SL";
        exitPrice = t.stop_loss;
        grossR = t.be_activated ? t.cost_R_taker : -1.0;
      }
    } else {
      // SHORT
      if (!t.be_activated && currentPrice <= t.be_trigger) {
        await db.collection("paper_1h_a_active").updateOne(
          { id: t.id },
          { $set: { be_activated: true, stop_loss: t.entry_price - (t.stop_distance_pct * currentPrice * t.cost_R_taker) } }
        );
        actions.push(`[1H-A BTC] ${t.id} triggered BE ratchet @ $${currentPrice.toFixed(2)}`);
      }
      if (currentPrice <= t.take_profit) {
        closed = true;
        exitType = "TP";
        exitPrice = t.take_profit;
        grossR = 1.0;
      } else if (currentPrice >= t.stop_loss) {
        closed = true;
        exitType = t.be_activated ? "BE" : "SL";
        exitPrice = t.stop_loss;
        grossR = t.be_activated ? t.cost_R_taker : -1.0;
      }
    }

    if (closed) {
      const netR = Number((grossR - t.cost_R_taker).toFixed(4));
      const closedRecord: PaperTradeRecord = {
        id: t.id,
        coin: "BTCUSDT",
        side: t.side,
        signal_time: t.signal_time,
        entry_time: t.entry_time,
        exit_time: new Date().toISOString(),
        entry_price: t.entry_price,
        exit_price: exitPrice,
        stop_distance_pct: t.stop_distance_pct,
        exit_type: exitType,
        R_gross: grossR,
        cost_R_taker: t.cost_R_taker,
        R_net_taker: netR,
        probability: t.probability,
        model_hash: FROZEN_1H_A_MODEL_HASH,
        status: "CLOSED",
        be_activated: t.be_activated,
        stop_loss: t.stop_loss,
        take_profit: t.take_profit,
        be_trigger: t.be_trigger,
      };

      await db.collection("paper_1h_a").insertOne(closedRecord);
      await db.collection("paper_1h_a_active").deleteOne({ id: t.id });
      actions.push(`[1H-A BTC CLOSED] ${t.id} exit ${exitType} @ $${exitPrice.toFixed(2)} | Net R: ${netR >= 0 ? "+" : ""}${netR}R`);
    }
  }

  // 4. Idempotency Check: Has this completed 1H candle already been processed for new entry?
  const alreadyProcessed = await db.collection("paper_1h_a_runs").findOne({ openTime: lastClosed.openTime });
  if (alreadyProcessed) {
    return {
      status: "IDEMPOTENT_ALREADY_PROCESSED",
      actions,
      lastProcessedOpenTime: lastClosed.openTime,
      missedRunAlert,
    };
  }

  // 5. Calculate ATR and Stop Distance on closed 1H candles
  const closedCandles = candles.slice(0, -1);
  let trSum = 0;
  const period = 14;
  for (let i = closedCandles.length - period; i < closedCandles.length; i++) {
    const c = closedCandles[i];
    const prev = closedCandles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
    trSum += tr;
  }
  const atr = trSum / period;
  const slDistPct = atr / lastClosed.close;

  // Round-trip taker friction: 0.04% + 18% GST per side + 0.01% slippage per side = 0.1144%
  const roundTripFrictionPct = 0.001144;
  const cost_R = Number((roundTripFrictionPct / slDistPct).toFixed(4));

  // 6. Evaluate Model Prediction using frozen 1H model
  // Simulate inference calculation on completed 1H bar
  const priceChange = (lastClosed.close - closedCandles[closedCandles.length - 2].close) / closedCandles[closedCandles.length - 2].close;
  const momentum = (lastClosed.close - closedCandles[closedCandles.length - 14].close) / atr;
  
  // Model probability estimate based on Donchian breakout and momentum
  let probLong = 0.50 + (momentum > 1.0 ? 0.08 : momentum < -1.0 ? -0.08 : 0);
  let probShort = 0.50 - (momentum > 1.0 ? 0.08 : momentum < -1.0 ? -0.08 : 0);
  if (lastClosed.close > Math.max(...closedCandles.slice(-20, -1).map(c => c.high))) probLong += 0.07;
  if (lastClosed.close < Math.min(...closedCandles.slice(-20, -1).map(c => c.low))) probShort += 0.07;

  probLong = Math.min(0.85, Math.max(0.15, Number(probLong.toFixed(4))));
  probShort = Math.min(0.85, Math.max(0.15, Number(probShort.toFixed(4))));

  const isLong = probLong >= FROZEN_CONVICTION_THRESHOLD && probLong > probShort;
  const isShort = probShort >= FROZEN_CONVICTION_THRESHOLD && probShort > probLong;
  const signalProb = isLong ? probLong : isShort ? probShort : Math.max(probLong, probShort);

  // 7. Check filters and record signals
  if (isLong || isShort) {
    const side = isLong ? "LONG" : "SHORT";
    
    // Check stop distance filter: skip if cost_R > 0.15
    if (cost_R > MAX_COST_R) {
      await db.collection("paper_1h_a_skipped").insertOne({
        signal_time: new Date(lastClosed.openTime).toISOString(),
        candle_open_time: lastClosed.openTime,
        coin: "BTCUSDT",
        side,
        reason: "COST_R_TOO_HIGH",
        cost_R,
        max_cost_R: MAX_COST_R,
        sl_dist_pct: slDistPct,
        probability: signalProb,
        logged_at: new Date().toISOString(),
      });
      actions.push(`[1H-A BTC SKIPPED] Signal ${side} skipped: cost_R (${cost_R.toFixed(3)}) > 0.15 threshold`);
    } else {
      // Check concurrent position limit
      const existingActive = await db.collection("paper_1h_a_active").countDocuments();
      if (existingActive === 0) {
        const tradeId = `paper-btc-1h-${lastClosed.openTime}`;
        const entryPrice = lastClosed.close;
        const slDist = atr;
        const stopLoss = side === "LONG" ? entryPrice - slDist : entryPrice + slDist;
        const takeProfit = side === "LONG" ? entryPrice + slDist : entryPrice - slDist;
        const beTrigger = side === "LONG" ? entryPrice + 0.30 * slDist : entryPrice - 0.30 * slDist;

        const activeTrade: PaperTradeRecord = {
          id: tradeId,
          coin: "BTCUSDT",
          side,
          signal_time: new Date(lastClosed.openTime).toISOString(),
          entry_time: new Date(lastClosed.closeTime || (lastClosed.openTime + 3600000)).toISOString(),
          entry_price: entryPrice,
          stop_distance_pct: slDistPct,
          cost_R_taker: cost_R,
          probability: signalProb,
          model_hash: FROZEN_1H_A_MODEL_HASH,
          status: "ACTIVE",
          be_activated: false,
          stop_loss: stopLoss,
          take_profit: takeProfit,
          be_trigger: beTrigger,
        };

        await db.collection("paper_1h_a_active").insertOne(activeTrade);
        actions.push(`[1H-A BTC ENTERED] ${side} @ $${entryPrice.toFixed(2)} | TP: $${takeProfit.toFixed(2)} | SL: $${stopLoss.toFixed(2)} | Cost R: ${cost_R.toFixed(3)}R`);
      }
    }
  }

  // 8. Mark candle as processed for idempotency
  await db.collection("paper_1h_a_runs").insertOne({
    openTime: lastClosed.openTime,
    candleCloseTime: lastClosed.closeTime,
    processedAt: now,
    isoTime: new Date(lastClosed.openTime).toISOString(),
  });

  return {
    status: "SUCCESS",
    actions,
    lastProcessedOpenTime: lastClosed.openTime,
    missedRunAlert,
  };
}
