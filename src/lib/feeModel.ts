/**
 * Unified Fee & Exchange Friction Architecture for Shark Exchange (BTCUSDT Perpetuals)
 * Single source of truth for base fees, GST tax, and bid-ask slippage.
 */

// Base Exchange Fees
export const TAKER_BASE_FEE_PERCENT = 0.040; // 0.040% per side (Standard Realistic Taker)
export const MAKER_BASE_FEE_PERCENT = 0.016; // 0.016% per side (Optimistic Benchmark)
export const MID_TAKER_BASE_FEE_PERCENT = 0.030; // 0.030% per side
export const VIP_MAKER_BASE_FEE_PERCENT = 0.018; // 0.018% per side

// Government Statutory Tax
export const GST_RATE_PERCENT = 18.0; // 18% GST on exchange fees

// Market Execution Slippage (per side)
export const TAKER_SLIPPAGE_RATE = 0.00010; // 0.010% slippage per side for taker orders
export const MAKER_SLIPPAGE_RATE = 0.00005; // 0.005% slippage per side for maker orders

// Taker vs Maker Divider Threshold
export const TAKER_FEE_THRESHOLD = 0.020;

export function isTakerFee(feePercent: number): boolean {
  return feePercent > TAKER_FEE_THRESHOLD;
}

export function getSlippageRate(feePercent: number): number {
  return isTakerFee(feePercent) ? TAKER_SLIPPAGE_RATE : MAKER_SLIPPAGE_RATE;
}

export function getEffectiveFeeMultiplier(feePercent: number, gstPercent: number = GST_RATE_PERCENT): number {
  return (feePercent / 100) * (1 + gstPercent / 100);
}

/**
 * Computes exact round-trip friction as a percentage of notional.
 * For standard Taker: 2 * (0.040% * 1.18 + 0.010%) = 0.1144% round-trip
 */
export function computeRoundTripFrictionPercent(
  feePercent: number = TAKER_BASE_FEE_PERCENT,
  gstPercent: number = GST_RATE_PERCENT
): number {
  const isTaker = isTakerFee(feePercent);
  const slipPerSide = isTaker ? TAKER_SLIPPAGE_RATE * 100 : MAKER_SLIPPAGE_RATE * 100;
  const feeWithGstPerSide = feePercent * (1 + gstPercent / 100);
  const roundTrip = 2 * (feeWithGstPerSide + slipPerSide);
  return Number(roundTrip.toFixed(4));
}

export interface TradeCostBreakdown {
  entryFeeINR: number;
  exitFeeINR: number;
  entrySlippageINR: number;
  exitSlippageINR: number;
  totalExchangeFeesINR: number;
  totalSlippageINR: number;
  totalCostINR: number;
  netPnLINR: number;
}

export function computeTradeCost(
  positionSizeINR: number,
  grossPnLINR: number,
  feePercent: number,
  gstPercent: number = GST_RATE_PERCENT
): TradeCostBreakdown {
  const gstRate = gstPercent / 100;
  const slipRate = getSlippageRate(feePercent);
  const effectiveFeeRate = (feePercent / 100) * (1 + gstRate);

  const pos = positionSizeINR;
  const exitPos = Math.max(0, pos + grossPnLINR);

  const entryFeeINR = Number((pos * effectiveFeeRate).toFixed(4));
  const exitFeeINR = Number((exitPos * effectiveFeeRate).toFixed(4));
  const entrySlippageINR = Number((pos * slipRate).toFixed(4));
  const exitSlippageINR = Number((exitPos * slipRate).toFixed(4));

  const totalExchangeFeesINR = Number((entryFeeINR + exitFeeINR).toFixed(4));
  const totalSlippageINR = Number((entrySlippageINR + exitSlippageINR).toFixed(4));
  const totalCostINR = Number((totalExchangeFeesINR + totalSlippageINR).toFixed(2));
  const netPnLINR = Number((grossPnLINR - totalCostINR).toFixed(2));

  return {
    entryFeeINR,
    exitFeeINR,
    entrySlippageINR,
    exitSlippageINR,
    totalExchangeFeesINR,
    totalSlippageINR,
    totalCostINR,
    netPnLINR,
  };
}
