/**
 * src/lib/equityFeeModel.ts
 *
 * Configurable cost model for the US Equities Book (US-listed NYSE/NASDAQ).
 * Strictly segregated from the 24x7 Perpetual derivatives friction model.
 *
 * Cost Structure:
 *  1. Commission: Per-share rate (e.g. $0.005/share, min $1.00, capped at 0.5% trade value).
 *  2. Slippage & Half-Spread: Volume/Cap-aware basis points (Default: 3 bps for mega-cap, 6 bps large-cap).
 *  3. US Regulatory Fees: SEC Section 31 (sales only) + FINRA TAF (sales only).
 *  4. FX Conversion Markup: INR to USD conversion markup (Configurable, default 50 bps).
 *  5. Tax Parameters (UNCONFIRMED - DEFAULT OFF):
 *     - TCS under LRS (Tax Collected at Source): Configurable rate, default 20% on remittance, OFF.
 *     - Foreign Capital Gains Tax: Indian tax rate for foreign assets, OFF.
 *     - All tax impacts are reported as sensitivity analysis lines and marked UNCONFIRMED.
 */

export interface EquityFeeConfig {
  perShareCommissionUSD: number;   // e.g. $0.005 / share
  minCommissionUSD: number;        // e.g. $1.00 min per execution
  maxCommissionPct: number;        // e.g. 0.5% max of order notional
  slippageBpsMegaCap: number;      // e.g. 3.0 bps for mega-cap (AAPL, MSFT, NVDA, etc.)
  slippageBpsLargeCap: number;     // e.g. 6.0 bps for large-cap / constituents
  secFeeRate: number;              // SEC Section 31 transaction fee (sales only: 0.0000278)
  finraTafPerShare: number;        // FINRA Trading Activity Fee (sales only: $0.000166/share)
  finraTafMaxUSD: number;          // FINRA TAF maximum cap per trade ($8.30)
  fxMarkupBps: number;             // Currency conversion markup (e.g. 50 bps)
  
  // Tax Parameters: Strictly UNCONFIRMED, default OFF
  enableTcsLrsTax: boolean;        // default: false (UNCONFIRMED)
  tcsLrsRatePct: number;           // default: 20.0%
  enableCapitalGainsTax: boolean;  // default: false (UNCONFIRMED)
  shortTermGainsTaxPct: number;    // default: 30.0% (slab rate estimate)
  longTermGainsTaxPct: number;     // default: 20.0%
}

export const DEFAULT_EQUITY_FEE_CONFIG: EquityFeeConfig = {
  perShareCommissionUSD: 0.005,
  minCommissionUSD: 1.0,
  maxCommissionPct: 0.5,
  slippageBpsMegaCap: 3.0,
  slippageBpsLargeCap: 6.0,
  secFeeRate: 0.0000278,
  finraTafPerShare: 0.000166,
  finraTafMaxUSD: 8.30,
  fxMarkupBps: 50.0,
  enableTcsLrsTax: false,
  tcsLrsRatePct: 20.0,
  enableCapitalGainsTax: false,
  shortTermGainsTaxPct: 30.0,
  longTermGainsTaxPct: 20.0,
};

export interface EquityExecutionCost {
  entryCommissionUSD: number;
  exitCommissionUSD: number;
  entrySlippageUSD: number;
  exitSlippageUSD: number;
  secFeeUSD: number;
  finraTafUSD: number;
  totalFrictionUSD: number;
  frictionBps: number;
  
  // Unconfirmed tax sensitivity estimates
  unconfirmedTcsUSD: number;
  unconfirmedTaxUSD: number;
  taxStatus: "UNCONFIRMED_DEFAULT_OFF" | "APPLIED_PENDING_CA_AUDIT";
}

/**
 * Calculates all-in roundtrip friction for a US equity trade.
 */
export function calculateEquityRoundtripCost(
  entryPrice: number,
  exitPrice: number,
  shares: number,
  isMegaCap: boolean = true,
  holdingDays: number = 20,
  cfg: EquityFeeConfig = DEFAULT_EQUITY_FEE_CONFIG
): EquityExecutionCost {
  const entryNotional = entryPrice * shares;
  const exitNotional = exitPrice * shares;

  // 1. Commission per side
  const rawEntryComm = shares * cfg.perShareCommissionUSD;
  const entryComm = Math.min(
    Math.max(rawEntryComm, cfg.minCommissionUSD),
    entryNotional * (cfg.maxCommissionPct / 100)
  );

  const rawExitComm = shares * cfg.perShareCommissionUSD;
  const exitComm = Math.min(
    Math.max(rawExitComm, cfg.minCommissionUSD),
    exitNotional * (cfg.maxCommissionPct / 100)
  );

  // 2. Slippage & Half-spread
  const slippageBps = isMegaCap ? cfg.slippageBpsMegaCap : cfg.slippageBpsLargeCap;
  const slippageRate = slippageBps / 10000;
  const entrySlippage = entryNotional * slippageRate;
  const exitSlippage = exitNotional * slippageRate;

  // 3. US Regulatory fees (sales only)
  const secFee = exitNotional * cfg.secFeeRate;
  const finraTaf = Math.min(shares * cfg.finraTafPerShare, cfg.finraTafMaxUSD);

  // 4. All-in trading friction
  const totalFrictionUSD = entryComm + exitComm + entrySlippage + exitSlippage + secFee + finraTaf;
  const frictionBps = entryNotional > 0 ? (totalFrictionUSD / entryNotional) * 10000 : 0;

  // 5. Unconfirmed Tax calculations (sensitivity line)
  let unconfirmedTcsUSD = 0;
  if (cfg.enableTcsLrsTax) {
    unconfirmedTcsUSD = entryNotional * (cfg.tcsLrsRatePct / 100);
  }

  let unconfirmedTaxUSD = 0;
  const grossProfit = exitNotional - entryNotional - totalFrictionUSD;
  if (cfg.enableCapitalGainsTax && grossProfit > 0) {
    const isLongTerm = holdingDays > 730; // 24 months for unlisted/foreign equities under Indian tax law
    const taxRate = isLongTerm ? cfg.longTermGainsTaxPct : cfg.shortTermGainsTaxPct;
    unconfirmedTaxUSD = grossProfit * (taxRate / 100);
  }

  return {
    entryCommissionUSD: Number(entryComm.toFixed(2)),
    exitCommissionUSD: Number(exitComm.toFixed(2)),
    entrySlippageUSD: Number(entrySlippage.toFixed(2)),
    exitSlippageUSD: Number(exitSlippage.toFixed(2)),
    secFeeUSD: Number(secFee.toFixed(4)),
    finraTafUSD: Number(finraTaf.toFixed(4)),
    totalFrictionUSD: Number(totalFrictionUSD.toFixed(2)),
    frictionBps: Number(frictionBps.toFixed(2)),
    unconfirmedTcsUSD: Number(unconfirmedTcsUSD.toFixed(2)),
    unconfirmedTaxUSD: Number(unconfirmedTaxUSD.toFixed(2)),
    taxStatus: cfg.enableCapitalGainsTax || cfg.enableTcsLrsTax
      ? "APPLIED_PENDING_CA_AUDIT"
      : "UNCONFIRMED_DEFAULT_OFF",
  };
}
