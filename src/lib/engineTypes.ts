export interface AIStrategyModel {
  id: string;
  name: string;
  shortName: string;
  rank: number;
  timeframe: string;
  trueWinRate: number; // TP / (TP + SL) * 100
  netWinRate: number;  // % of trades with net PnL > 0 after fees
  avgNetR: number;     // Average Net R per trade after fees and slippage
  avgGrossR?: number;  // Average Gross R per trade before friction
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
    id: "unified-1h-engine",
    name: "Unified 1H Multi-Asset Engine [1 Universal Brain]",
    shortName: "1H Unified [1 Brain]",
    rank: 1,
    timeframe: "1h",
    trueWinRate: 51.4,
    netWinRate: 51.4,
    avgNetR: 0.185,
    avgGrossR: 0.220,
    netProfitFactor: 1.45,
    tpSplit: 51.4,
    beSplit: 0.0,
    slSplit: 48.6,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 48.2,
    holdOutWinRate: 51.4,
    sharpeRatio: 1.95,
    profitFactor: 1.45,
    maxDrawdown: -12.4,
    totalTrades: 37,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "UNIFIED 1H ENGINE: Single universal 100-tree LightGBM brain trading all 7 assets on 1-Hour candles.",
  },
  {
    id: "distributed-1h-engine",
    name: "Distributed 1H Specialists Engine [7 Dedicated Models]",
    shortName: "1H Distributed [7 Specialists]",
    rank: 2,
    timeframe: "1h",
    trueWinRate: 48.5,
    netWinRate: 48.5,
    avgNetR: 0.219,
    avgGrossR: 0.255,
    netProfitFactor: 1.49,
    tpSplit: 48.5,
    beSplit: 0.0,
    slSplit: 51.5,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 48.5,
    holdOutWinRate: 48.5,
    sharpeRatio: 2.30,
    profitFactor: 1.66,
    maxDrawdown: -28.9,
    totalTrades: 33,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "DISTRIBUTED 1H SPECIALISTS: 7 dedicated LightGBM specialist models trained per asset (+609.99R historical return, 1,651 trades).",
  },
  {
    id: "unified-4h-engine",
    name: "Unified 4H Swing Engine [1 Universal Brain]",
    shortName: "4H Unified [1 Brain]",
    rank: 3,
    timeframe: "4h",
    trueWinRate: 62.5,
    netWinRate: 62.5,
    avgNetR: 0.204,
    avgGrossR: 0.240,
    netProfitFactor: 1.68,
    tpSplit: 62.5,
    beSplit: 0.0,
    slSplit: 37.5,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 45.2,
    holdOutWinRate: 62.5,
    sharpeRatio: 2.10,
    profitFactor: 1.68,
    maxDrawdown: -9.8,
    totalTrades: 8,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "UNIFIED 4H SWING: Single universal LightGBM brain trading all 7 assets on 4-Hour swing candles (373 historical trades, +318.27R).",
  },
  {
    id: "distributed-4h-engine",
    name: "Distributed 4H Specialists Engine [7 Dedicated Models]",
    shortName: "4H Distributed [7 Specialists]",
    rank: 4,
    timeframe: "4h",
    trueWinRate: 38.5,
    netWinRate: 38.5,
    avgNetR: -0.209,
    avgGrossR: -0.170,
    netProfitFactor: 0.63,
    tpSplit: 38.5,
    beSplit: 0.0,
    slSplit: 61.5,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 49.6,
    holdOutWinRate: 38.5,
    sharpeRatio: 1.85,
    profitFactor: 1.98,
    maxDrawdown: -15.3,
    totalTrades: 13,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "DISTRIBUTED 4H SPECIALISTS: 7 dedicated 4-Hour specialist models trained per asset (+425.00R historical return, 418 trades).",
  },
  {
    id: "pure-rules-1h-baseline",
    name: "Rule-Based Engine (1H) [BENCHMARK]",
    shortName: "1H Rule-Based [No AI]",
    rank: 5,
    timeframe: "1h",
    trueWinRate: 43.4,
    netWinRate: 43.4,
    avgNetR: 0.070,
    avgGrossR: 0.095,
    netProfitFactor: 1.14,
    tpSplit: 11.8,
    beSplit: 46.1,
    slSplit: 42.1,
    statusBadge: "BENCHMARK ENGINE (1H Zero AI Filter)",
    winRateFull5Yr: 39.9,
    holdOutWinRate: 43.4,
    sharpeRatio: 0.52,
    profitFactor: 1.14,
    maxDrawdown: -15.9,
    totalTrades: 76,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "BENCHMARK ENGINE (1H): Pure 20-bar Donchian breakout above/below 200 SMA across all 7 assets on 1-Hour candles without AI gating (76 live trades, 4,390 historical).",
  },
  {
    id: "pure-rules-4h-baseline",
    name: "Rule-Based Engine (4H Swing) [BENCHMARK]",
    shortName: "4H Rule-Based [No AI]",
    rank: 6,
    timeframe: "4h",
    trueWinRate: 47.6,
    netWinRate: 47.6,
    avgNetR: 0.020,
    avgGrossR: 0.045,
    netProfitFactor: 1.04,
    tpSplit: 14.3,
    beSplit: 38.1,
    slSplit: 47.6,
    statusBadge: "BENCHMARK ENGINE (4H Zero AI Filter)",
    winRateFull5Yr: 40.8,
    holdOutWinRate: 47.6,
    sharpeRatio: 0.38,
    profitFactor: 1.04,
    maxDrawdown: -4.1,
    totalTrades: 21,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "BENCHMARK ENGINE (4H): Pure 20-bar Donchian breakout above/below 200 SMA across all 7 assets on 4-Hour swing candles without AI gating (21 live trades, 1,247 historical).",
  },
];

export interface TradeOrder {
  id: string;
  symbol: string;
  rawSymbol?: string;
  gross_r?: number;
  cost_r?: number;
  net_r?: number;
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
  runningBalanceINR?: number;
  stopLoss: number;
  initialStopLoss?: number;
  stopPct?: number;
  riskAmountINR?: number;
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
  pauseReason?: string;
  pausedAt?: number;
  killSwitchTriggered?: boolean;
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
  netProfitINR?: number;
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
