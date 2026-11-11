/**
 * src/lib/equityRiskManager.ts
 *
 * Dedicated Risk & Sizing Engine for the US Equities Book.
 * Segregated from the crypto/commodity ₹7,000 INR risk manager.
 *
 * Rules:
 *  - 1% portfolio equity risk per trade.
 *  - Maximum 8 concurrent positions.
 *  - Maximum 20% of portfolio equity per position (position cap).
 *  - Configurable starting capital (default $100,000 USD).
 *  - Fractional shares supported and flagged.
 *  - Gap-aware stops: if open gaps below stop, exit evaluated at open.
 */

export interface EquityPortfolioState {
  cashUSD: number;
  portfolioEquityUSD: number;
  openPositionsCount: number;
  maxOpenPositions: number;
  maxRiskPctPerTrade: number;
  maxPositionSizePct: number;
  allowFractionalShares: boolean;
}

export interface EquityPositionSizeResult {
  allowed: boolean;
  rejectReason?: string;
  shares: number;
  dollarAllocation: number;
  allocationPct: number;
  riskDollars: number;
  riskPct: number;
  stopLossPrice: number;
  isFractional: boolean;
}

export class EquityRiskManager {
  private initialCapitalUSD: number;
  private currentEquityUSD: number;
  private cashUSD: number;
  private maxPositions: number;
  private maxRiskPct: number;
  private maxPositionPct: number;
  private allowFractional: boolean;

  constructor(
    initialCapitalUSD: number = 100000.0,
    maxPositions: number = 8,
    maxRiskPct: number = 1.0,
    maxPositionPct: number = 20.0,
    allowFractional: boolean = true
  ) {
    this.initialCapitalUSD = initialCapitalUSD;
    this.currentEquityUSD = initialCapitalUSD;
    this.cashUSD = initialCapitalUSD;
    this.maxPositions = maxPositions;
    this.maxRiskPct = maxRiskPct;
    this.maxPositionPct = maxPositionPct;
    this.allowFractional = allowFractional;
  }

  public getPortfolioState(activePositionsCount: number): EquityPortfolioState {
    return {
      cashUSD: Number(this.cashUSD.toFixed(2)),
      portfolioEquityUSD: Number(this.currentEquityUSD.toFixed(2)),
      openPositionsCount: activePositionsCount,
      maxOpenPositions: this.maxPositions,
      maxRiskPctPerTrade: this.maxRiskPct,
      maxPositionSizePct: this.maxPositionPct,
      allowFractionalShares: this.allowFractional,
    };
  }

  public calculatePositionSize(
    entryPrice: number,
    stopLossPrice: number,
    currentActivePositions: number
  ): EquityPositionSizeResult {
    // 1. Check max position slots
    if (currentActivePositions >= this.maxPositions) {
      return {
        allowed: false,
        rejectReason: `Max concurrent positions reached (${this.maxPositions}/${this.maxPositions})`,
        shares: 0,
        dollarAllocation: 0,
        allocationPct: 0,
        riskDollars: 0,
        riskPct: 0,
        stopLossPrice,
        isFractional: false,
      };
    }

    // 2. Validate stop loss
    if (stopLossPrice >= entryPrice || entryPrice <= 0) {
      return {
        allowed: false,
        rejectReason: `Invalid stop loss: Stop ($${stopLossPrice}) must be below Entry ($${entryPrice})`,
        shares: 0,
        dollarAllocation: 0,
        allocationPct: 0,
        riskDollars: 0,
        riskPct: 0,
        stopLossPrice,
        isFractional: false,
      };
    }

    const stopDistance = entryPrice - stopLossPrice;
    const targetRiskUSD = this.currentEquityUSD * (this.maxRiskPct / 100.0);

    // 3. Raw shares sized to 1% risk
    let shares = targetRiskUSD / stopDistance;
    let notional = shares * entryPrice;

    // 4. Cap at max position size (20% of portfolio equity)
    const maxNotional = this.currentEquityUSD * (this.maxPositionPct / 100.0);
    if (notional > maxNotional) {
      notional = maxNotional;
      shares = notional / entryPrice;
    }

    // 5. Check cash availability
    if (notional > this.cashUSD) {
      notional = Math.max(0, this.cashUSD);
      shares = notional / entryPrice;
    }

    if (notional <= 0 || shares <= 0) {
      return {
        allowed: false,
        rejectReason: "Insufficient cash or zero position sizing",
        shares: 0,
        dollarAllocation: 0,
        allocationPct: 0,
        riskDollars: 0,
        riskPct: 0,
        stopLossPrice,
        isFractional: false,
      };
    }

    const isFractional = !Number.isInteger(shares);
    const finalShares = this.allowFractional ? Number(shares.toFixed(4)) : Math.floor(shares);

    if (finalShares <= 0) {
      return {
        allowed: false,
        rejectReason: "Calculated whole shares rounded to zero",
        shares: 0,
        dollarAllocation: 0,
        allocationPct: 0,
        riskDollars: 0,
        riskPct: 0,
        stopLossPrice,
        isFractional: false,
      };
    }

    const finalNotional = finalShares * entryPrice;
    const actualRiskUSD = finalShares * stopDistance;

    return {
      allowed: true,
      shares: finalShares,
      dollarAllocation: Number(finalNotional.toFixed(2)),
      allocationPct: Number(((finalNotional / this.currentEquityUSD) * 100).toFixed(2)),
      riskDollars: Number(actualRiskUSD.toFixed(2)),
      riskPct: Number(((actualRiskUSD / this.currentEquityUSD) * 100).toFixed(2)),
      stopLossPrice,
      isFractional,
    };
  }

  public updateEquity(newEquityUSD: number, newCashUSD: number): void {
    this.currentEquityUSD = newEquityUSD;
    this.cashUSD = newCashUSD;
  }
}
