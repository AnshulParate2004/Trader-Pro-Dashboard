/**
 * Risk Engine: Hardened execution guards and safety limits for quantitative strategies.
 * Enforces:
 * 1. Configurable max cost_R filter (default 0.08R)
 * 2. Rolling 100-trade kill switch (-0.05R threshold)
 * 3. Daily loss limit (-3R default per calendar day)
 * 4. Max equity drawdown stop (-10R from cumulative peak)
 */

import { computeRoundTripFrictionPercent } from "./feeModel";
import { TradeOrder } from "./engineTypes";
import { getTradeRValue } from "./tradingEngine";

export const DEFAULT_MAX_COST_R = 0.08;
export const FROZEN_1HA_MAX_COST_R = 0.15;
export const ROLLING_KILL_SWITCH_THRESHOLD_R = -0.05;
export const ROLLING_KILL_SWITCH_WINDOW = 100;
export const DEFAULT_DAILY_LOSS_LIMIT_R = -3.0;
export const DEFAULT_MAX_DRAWDOWN_R = -10.0;

/**
 * Filter 1: Cost in R friction filter
 * Skip trade if exchange friction exceeds allowed fraction of stop loss.
 */
export function checkCostRFilter(
  stopDistancePercent: number,
  maxCostR: number = DEFAULT_MAX_COST_R,
  roundTripFrictionPercent: number = computeRoundTripFrictionPercent()
): { passed: boolean; costR: number; threshold: number } {
  if (stopDistancePercent <= 0) {
    return { passed: false, costR: Infinity, threshold: maxCostR };
  }
  const costR = Number((roundTripFrictionPercent / stopDistancePercent).toFixed(4));
  return {
    passed: costR <= maxCostR,
    costR,
    threshold: maxCostR,
  };
}

/**
 * Filter 2: Rolling Kill Switch
 * If the average net R over the last N (default 100) closed trades is below threshold (-0.05R),
 * automatically pause the setup to halt capital decay.
 */
export function evaluateRollingKillSwitch(
  trades: TradeOrder[],
  windowSize: number = ROLLING_KILL_SWITCH_WINDOW,
  thresholdR: number = ROLLING_KILL_SWITCH_THRESHOLD_R
): {
  shouldKill: boolean;
  avgNetR: number;
  tradeCount: number;
  reason?: string;
} {
  const closed = trades
    .filter((t) => t.status !== "ACTIVE" && t.status !== "BE_ACTIVATED")
    .sort((a, b) => (a.closedAt || a.openedAt) - (b.closedAt || b.openedAt));

  if (closed.length < windowSize) {
    // Insufficient sample to trigger statistical kill switch
    return {
      shouldKill: false,
      avgNetR: 0,
      tradeCount: closed.length,
    };
  }

  const recentWindow = closed.slice(-windowSize);
  let totalNetR = 0;

  for (const t of recentWindow) {
    const netPnL = t.netPnLINR !== undefined ? t.netPnLINR : 0;
    const rVal = getTradeRValue(t, netPnL);
    totalNetR += rVal;
  }

  const avgNetR = Number((totalNetR / windowSize).toFixed(4));

  if (avgNetR < thresholdR) {
    return {
      shouldKill: true,
      avgNetR,
      tradeCount: windowSize,
      reason: `Rolling Kill Switch Activated: Average net R over the last ${windowSize} closed trades (${avgNetR >= 0 ? "+" : ""}${avgNetR}R) fell below the critical limit (${thresholdR}R). Strategy execution has been automatically paused.`,
    };
  }

  return {
    shouldKill: false,
    avgNetR,
    tradeCount: windowSize,
  };
}

/**
 * Filter 3: Daily Loss Limit
 * Halts new entries if cumulative net R closed within the current UTC day exceeds daily limit (default -3R).
 */
export function checkDailyLossLimit(
  trades: TradeOrder[],
  currentTime: number = Date.now(),
  dailyLimitR: number = DEFAULT_DAILY_LOSS_LIMIT_R
): {
  limitExceeded: boolean;
  todayNetR: number;
  dailyLimitR: number;
  tradesTodayCount: number;
  reason?: string;
} {
  const d = new Date(currentTime);
  const startOfDayUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

  const todayClosed = trades.filter((t) => {
    if (t.status === "ACTIVE" || t.status === "BE_ACTIVATED") return false;
    const closedTime = t.closedAt || t.openedAt;
    return closedTime >= startOfDayUtc;
  });

  let todayNetR = 0;
  for (const t of todayClosed) {
    const netPnL = t.netPnLINR !== undefined ? t.netPnLINR : 0;
    todayNetR += getTradeRValue(t, netPnL);
  }

  todayNetR = Number(todayNetR.toFixed(4));

  if (todayNetR <= dailyLimitR) {
    return {
      limitExceeded: true,
      todayNetR,
      dailyLimitR,
      tradesTodayCount: todayClosed.length,
      reason: `Daily Loss Limit Exceeded: Realized net R today is ${todayNetR}R, breaching the daily safety limit of ${dailyLimitR}R. New trade entries halted until next UTC day.`,
    };
  }

  return {
    limitExceeded: false,
    todayNetR,
    dailyLimitR,
    tradesTodayCount: todayClosed.length,
  };
}

/**
 * Filter 4: Max Drawdown Limit from Equity Peak
 * Halts new entries if cumulative drawdown from the all-time peak exceeds max drawdown limit (default -10R).
 */
export function checkMaxDrawdownLimit(
  trades: TradeOrder[],
  maxDrawdownR: number = DEFAULT_MAX_DRAWDOWN_R
): {
  limitExceeded: boolean;
  currentDrawdownR: number;
  peakCumulativeR: number;
  currentCumulativeR: number;
  maxDrawdownLimitR: number;
  reason?: string;
} {
  const closed = trades
    .filter((t) => t.status !== "ACTIVE" && t.status !== "BE_ACTIVATED")
    .sort((a, b) => (a.closedAt || a.openedAt) - (b.closedAt || b.openedAt));

  let cumulativeR = 0;
  let peakR = 0;
  let maxDD = 0;

  for (const t of closed) {
    const netPnL = t.netPnLINR !== undefined ? t.netPnLINR : 0;
    cumulativeR += getTradeRValue(t, netPnL);

    if (cumulativeR > peakR) {
      peakR = cumulativeR;
    }
    const dd = cumulativeR - peakR;
    if (dd < maxDD) {
      maxDD = dd;
    }
  }

  const currentDrawdownR = Number((cumulativeR - peakR).toFixed(4));
  const peakCumulativeR = Number(peakR.toFixed(4));
  const currentCumulativeR = Number(cumulativeR.toFixed(4));

  if (currentDrawdownR <= maxDrawdownR) {
    return {
      limitExceeded: true,
      currentDrawdownR,
      peakCumulativeR,
      currentCumulativeR,
      maxDrawdownLimitR: maxDrawdownR,
      reason: `Max Drawdown Limit Reached: Current equity drawdown from peak is ${currentDrawdownR}R, breaching the maximum allowed drawdown stop of ${maxDrawdownR}R. Strategy execution halted.`,
    };
  }

  return {
    limitExceeded: false,
    currentDrawdownR,
    peakCumulativeR,
    currentCumulativeR,
    maxDrawdownLimitR: maxDrawdownR,
  };
}
