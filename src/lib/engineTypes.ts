export interface AIStrategyModel {
  id: string;
  name: string;
  shortName: string;
  rank: number;
  timeframe: string;
  winRateFull5Yr: number;
  holdOutWinRate: number;
  sharpeRatio: number;
  profitFactor: number;
  maxDrawdown: number;
  totalTrades: number;
  ratchetTriggerR: number; // e.g. 0.30 or 0.35
  requires4HMacro: boolean;
  requires5MMicro: boolean;
  description: string;
}

export const TOP_MODELS: AIStrategyModel[] = [
  {
    id: "15m-sniper-030",
    name: "15M Sniper Scalp (+0.30R Ratchet)",
    shortName: "15M Sniper (+0.30R)",
    rank: 1,
    timeframe: "15m",
    winRateFull5Yr: 77.7,
    holdOutWinRate: 76.1,
    sharpeRatio: 7.18,
    profitFactor: 1.78,
    maxDrawdown: -10.2,
    totalTrades: 6538,
    ratchetTriggerR: 0.30,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "Rank #1 overall. LightGBM purged walk-forward with instant +0.30R Breakeven Ratchet (+0.05R fee shield). Highest win rate & Sharpe.",
  },
  {
    id: "15m-precision-035",
    name: "15M Precision Scalp (+0.35R Ratchet)",
    shortName: "15M Precision (+0.35R)",
    rank: 2,
    timeframe: "15m",
    winRateFull5Yr: 75.2,
    holdOutWinRate: 73.6,
    sharpeRatio: 6.36,
    profitFactor: 1.63,
    maxDrawdown: -10.8,
    totalTrades: 6516,
    ratchetTriggerR: 0.35,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "Rank #2. High-precision 15m entry with wider +0.35R breathing room before ratchet activation.",
  },
  {
    id: "master-confluence-multi",
    name: "Full Master Sniper (5M + 15M + 4H)",
    shortName: "Master Sniper (5M/15M/4H)",
    rank: 3,
    timeframe: "multi",
    winRateFull5Yr: 73.1,
    holdOutWinRate: 76.0,
    sharpeRatio: 4.46,
    profitFactor: 1.40,
    maxDrawdown: -10.2,
    totalTrades: 11420,
    ratchetTriggerR: 0.30,
    requires4HMacro: true,
    requires5MMicro: true,
    description: "Rank #3. Highest Hold-Out (76.0% OOS). Requires 4H macro trend alignment before taking 5M/15M confluence scalps.",
  },
  {
    id: "5m-15m-confluence",
    name: "5M + 15M Confluence Sniper",
    shortName: "5M/15M Confluence",
    rank: 4,
    timeframe: "multi",
    winRateFull5Yr: 73.0,
    holdOutWinRate: 75.8,
    sharpeRatio: 6.16,
    profitFactor: 1.39,
    maxDrawdown: -9.7,
    totalTrades: 21494,
    ratchetTriggerR: 0.30,
    requires4HMacro: false,
    requires5MMicro: true,
    description: "Rank #4. Lowest Max Drawdown (-9.7%). Fast scalp alignment between 5M micro momentum and 15M S/R pivots.",
  },
];

export interface TradeOrder {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  orderType: "TAKER" | "MAKER";
  modelId?: string;
  modelName?: string;
  entryPrice: number;
  exitPrice?: number;
  positionSizeINR: number;
  coins: number;
  feePercentage: number; // Shark Exchange fee: 0.040% Taker / 0.016% Maker
  gstPercentage: number; // 18% GST on Indian derivatives exchanges
  entryFeeINR: number;
  exitFeeINR?: number;
  totalFeeINR: number; // Including 18% GST
  grossPnLINR?: number;
  netPnLINR?: number;
  stopLoss: number;
  breakevenTrigger: number;
  breakevenLocked: number;
  breakevenActivated: boolean;
  takeProfit1: number;
  takeProfit2: number;
  status: "ACTIVE" | "BE_ACTIVATED" | "TP1_HIT" | "TP2_HIT" | "SL_HIT" | "CLOSED";
  exitReason?: string;
  triggerReason: string;
  openedAt: number;
  closedAt?: number;
}

export interface EngineConfig {
  autoTradingEnabled: boolean;
  currency: "INR";
  accountBalanceINR: number; // Artificial ₹1,000 starting capital
  tradingFeePercent: number; // Shark Exchange Taker: 0.040%
  makerFeePercent: number;   // Shark Exchange Maker: 0.016%
  gstPercent: number;        // 18% GST on trading fees
  riskPerTradePercent: number; // 1% risk = ₹10 per scalp
  ratchetEnabled: boolean;
  maxConcurrentTrades: number;
  activeModelId: string; // "15m-sniper-030" | "15m-precision-035" | "master-confluence-multi" | "5m-15m-confluence"
}

export interface EnginePerformanceMetrics {
  totalTrades: number;
  activeTradesCount: number;
  closedTradesCount: number;
  winningTrades: number;
  losingTrades: number;
  currentBalanceINR: number;
  grossProfitINR: number;
  grossLossINR: number;
  totalFeesPaidINR: number;
  netPnLINR: number;
  profitFactor: number;
  averageTradeINR: number;
  feeImpactPercent: number;
}
