/**
 * Universal Symbol Mapper & Alias System
 * Maps Yahoo Finance / CME commodity futures tickers (GC=F, SI=F, CL=F)
 * to perpetual synthetic pairs (XAUUSDT, XAGUSDT, CLUSDT) across all UI views.
 */

export const DISPLAY_SYMBOL_MAP: Record<string, string> = {
  "GC=F": "XAUUSDT",
  "SI=F": "XAGUSDT",
  "CL=F": "CLUSDT",
  "XAUUSDT": "XAUUSDT",
  "XAGUSDT": "XAGUSDT",
  "CLUSDT": "CLUSDT",
  "BTCUSDT": "BTCUSDT",
  "ETHUSDT": "ETHUSDT",
  "SOLUSDT": "SOLUSDT",
  "DOTUSDT": "DOTUSDT",
};

export const RAW_SYMBOL_MAP: Record<string, string> = {
  "XAUUSDT": "GC=F",
  "XAGUSDT": "SI=F",
  "CLUSDT": "CL=F",
  "GC=F": "GC=F",
  "SI=F": "SI=F",
  "CL=F": "CL=F",
  "BTCUSDT": "BTCUSDT",
  "ETHUSDT": "ETHUSDT",
  "SOLUSDT": "SOLUSDT",
  "DOTUSDT": "DOTUSDT",
};

export const DISPLAY_NAME_MAP: Record<string, string> = {
  "GC=F": "Gold (XAUUSDT)",
  "SI=F": "Silver (XAGUSDT)",
  "CL=F": "Crude Oil (CLUSDT)",
  "XAUUSDT": "Gold (XAUUSDT)",
  "XAGUSDT": "Silver (XAGUSDT)",
  "CLUSDT": "Crude Oil (CLUSDT)",
  "BTCUSDT": "Bitcoin (BTCUSDT)",
  "ETHUSDT": "Ethereum (ETHUSDT)",
  "SOLUSDT": "Solana (SOLUSDT)",
  "DOTUSDT": "Polkadot (DOTUSDT)",
};

/**
 * Returns user-facing perpetual ticker (e.g. GC=F -> XAUUSDT)
 */
export function toDisplaySymbol(symbol: string): string {
  if (!symbol) return symbol;
  const clean = symbol.trim().toUpperCase();
  return DISPLAY_SYMBOL_MAP[clean] || DISPLAY_SYMBOL_MAP[symbol] || symbol;
}

/**
 * Returns underlying raw data ticker (e.g. XAUUSDT -> GC=F)
 */
export function toRawSymbol(symbol: string): string {
  if (!symbol) return symbol;
  const clean = symbol.trim().toUpperCase();
  return RAW_SYMBOL_MAP[clean] || RAW_SYMBOL_MAP[symbol] || symbol;
}

/**
 * Returns user-facing asset name with pair (e.g. GC=F -> Gold (XAUUSDT))
 */
export function toDisplayName(symbol: string): string {
  if (!symbol) return symbol;
  const clean = symbol.trim().toUpperCase();
  return DISPLAY_NAME_MAP[clean] || DISPLAY_NAME_MAP[symbol] || symbol;
}

/**
 * Returns true if two symbols match either by raw ticker or display alias
 */
export function symbolsMatch(symA?: string, symB?: string): boolean {
  if (!symA || !symB) return false;
  if (symA === "ALL" || symB === "ALL") return true;
  const aDisplay = toDisplaySymbol(symA);
  const bDisplay = toDisplaySymbol(symB);
  if (aDisplay === bDisplay) return true;
  const aRaw = toRawSymbol(symA);
  const bRaw = toRawSymbol(symB);
  return aRaw === bRaw;
}
