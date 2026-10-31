export interface AIStrategyModel {
  id: string;
  name: string;
  shortName: string;
  rank: number;
  timeframe: string;
  trueWinRate: number; // TP / (TP + SL) * 100
  netWinRate: number;  // % of trades with net PnL > 0 after fees
  avgNetR: number;     // Average Net R per trade after fees and slippage
  netProfitFactor: number; // Net Profit Factor after fees
  tpSplit: number;     // TP %
  beSplit: number;     // BE %
  slSplit: number;     // SL %
  statusBadge: string; // e.g. "PAPER ONLY - negative expectancy after fees"
  winRateFull5Yr: number; // Legacy gross win rate
  holdOutWinRate: number;
  sharpeRatio: number;
  profitFactor: number; // Legacy gross profit factor
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
    trueWinRate: 62.0,
    netWinRate: 34.6,
    avgNetR: -0.301,
    netProfitFactor: 0.40,
    tpSplit: 36.5,
    beSplit: 41.2,
    slSplit: 22.3,
    statusBadge: "PAPER ONLY - negative expectancy after fees",
    winRateFull5Yr: 77.7,
    holdOutWinRate: 76.1,
    sharpeRatio: 7.18,
    profitFactor: 1.78,
    maxDrawdown: -10.2,
    totalTrades: 6538,
    ratchetTriggerR: 0.30,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "PAPER ONLY. Honest metrics after 0.04% taker + 18% GST + 0.01% slippage: True Win Rate 62.0%, Net Win Rate 34.6%, Avg Net R -0.301R. Sub-breakeven net expectancy.",
  },
  {
    id: "15m-precision-035",
    name: "15M Precision Scalp (+0.35R Ratchet)",
    shortName: "15M Precision (+0.35R)",
    rank: 2,
    timeframe: "15m",
    trueWinRate: 61.4,
    netWinRate: 33.9,
    avgNetR: -0.315,
    netProfitFactor: 0.38,
    tpSplit: 35.2,
    beSplit: 40.0,
    slSplit: 24.8,
    statusBadge: "PAPER ONLY - negative expectancy after fees",
    winRateFull5Yr: 75.2,
    holdOutWinRate: 73.6,
    sharpeRatio: 6.36,
    profitFactor: 1.63,
    maxDrawdown: -10.8,
    totalTrades: 6516,
    ratchetTriggerR: 0.35,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "PAPER ONLY. Wider +0.35R breathing room. Negative net expectancy after realistic exchange fees.",
  },
  {
    id: "master-confluence-multi",
    name: "Full Master Sniper (5M + 15M + 4H)",
    shortName: "Master Sniper (5M/15M/4H)",
    rank: 3,
    timeframe: "multi",
    trueWinRate: 60.5,
    netWinRate: 32.1,
    avgNetR: -0.340,
    netProfitFactor: 0.35,
    tpSplit: 34.0,
    beSplit: 39.5,
    slSplit: 26.5,
    statusBadge: "PAPER ONLY - negative expectancy after fees",
    winRateFull5Yr: 73.1,
    holdOutWinRate: 76.0,
    sharpeRatio: 4.46,
    profitFactor: 1.40,
    maxDrawdown: -10.2,
    totalTrades: 11420,
    ratchetTriggerR: 0.30,
    requires4HMacro: true,
    requires5MMicro: true,
    description: "PAPER ONLY. Requires 4H macro alignment. High trade count causes severe fee friction drag.",
  },
  {
    id: "5m-15m-confluence",
    name: "5M + 15M Confluence Sniper",
    shortName: "5M/15M Confluence",
    rank: 4,
    timeframe: "multi",
    trueWinRate: 58.2,
    netWinRate: 28.4,
    avgNetR: -0.420,
    netProfitFactor: 0.28,
    tpSplit: 31.0,
    beSplit: 42.0,
    slSplit: 27.0,
    statusBadge: "PAPER ONLY - negative expectancy after fees",
    winRateFull5Yr: 73.0,
    holdOutWinRate: 75.8,
    sharpeRatio: 6.16,
    profitFactor: 1.39,
    maxDrawdown: -9.7,
    totalTrades: 21494,
    ratchetTriggerR: 0.30,
    requires4HMacro: false,
    requires5MMicro: true,
    description: "PAPER ONLY. Rapid 5m/15m scalping severely impaired by round-trip taker exchange friction.",
  },
];

export interface TradeOrder {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  orderType: "TAKER" | "MAKER";
  modelId: string;
  modelName: string;
  entryPrice: number;
  exitPrice?: number;
  positionSizeINR: number;
  coins: number;
  feePercentage: number; // Shark Exchange fee: 0.040% Taker / 0.016% Maker
  gstPercentage: number; // 18% GST on Indian derivatives exchanges
  entryFeeINR: number;
  exitFeeINR?: number;
  slippageINR?: number;
  totalFeeINR: number; // Including 18% GST and 0.01% slippage per side
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
  slippagePercent?: number;  // 0.01% slippage per side
  riskPerTradePercent: number; // 1% risk = ₹10 per scalp
  ratchetEnabled: boolean;
  maxConcurrentTrades: number;
  lastProcessedClosedBarTime?: number;
  activeModelId: string;
}

export interface EnginePerformanceMetrics {
  totalTrades: number;
  activeTradesCount: number;
  closedTradesCount: number;
  winningTrades: number; // Trades with netPnLINR > 0
  losingTrades: number;  // Trades with netPnLINR <= 0
  currentBalanceINR: number;
  grossProfitINR: number;
  grossLossINR: number;
  totalFeesPaidINR: number;
  slippagePaidINR: number;
  netPnLINR: number;
  profitFactor: number; // Legacy gross profit factor
  averageTradeINR: number;
  feeImpactPercent: number;
  // Honest Metrics (Spec Step 6b):
  trueWinRate: number;      // TP / (TP + SL) * 100
  netWinRate: number;       // (winningTrades / closedTradesCount) * 100
  tpCount: number;
  beCount: number;
  slCount: number;
  tpPercent: number;
  bePercent: number;
  slPercent: number;
  avgNetR: number;          // Average Net R per trade (where 1R = 1% of position)
  netProfitFactor: number;  // Total net wins / Total net losses
}
