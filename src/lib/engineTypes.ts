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
    trueWinRate: 44.7,
    netWinRate: 44.7,
    avgNetR: -0.011,
    avgGrossR: 0.026,
    netProfitFactor: 0.97,
    tpSplit: 44.7,
    beSplit: 0.0,
    slSplit: 55.3,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 44.7,
    holdOutWinRate: 44.7,
    sharpeRatio: 1.95,
    profitFactor: 0.97,
    maxDrawdown: -12.4,
    totalTrades: 32,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "UNIFIED 1H ENGINE: Single universal LightGBM brain trading all 7 assets on 1-Hour candles (4,403 historical OOS trades, 32 live trades).",
  },
  {
    id: "distributed-1h-engine",
    name: "Distributed 1H Specialists Engine [7 Dedicated Models]",
    shortName: "1H Distributed [7 Specialists]",
    rank: 2,
    timeframe: "1h",
    trueWinRate: 43.9,
    netWinRate: 43.9,
    avgNetR: -0.035,
    avgGrossR: 0.002,
    netProfitFactor: 0.92,
    tpSplit: 43.9,
    beSplit: 0.0,
    slSplit: 56.1,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 43.9,
    holdOutWinRate: 43.9,
    sharpeRatio: 2.30,
    profitFactor: 0.92,
    maxDrawdown: -28.9,
    totalTrades: 32,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "DISTRIBUTED 1H SPECIALISTS: 7 dedicated LightGBM specialist models trained per asset (4,376 historical OOS trades, 32 live trades).",
  },
  {
    id: "unified-4h-engine",
    name: "Unified 4H Swing Engine [1 Universal Brain]",
    shortName: "4H Unified [1 Brain]",
    rank: 3,
    timeframe: "4h",
    trueWinRate: 46.6,
    netWinRate: 46.6,
    avgNetR: 0.052,
    avgGrossR: 0.073,
    netProfitFactor: 1.16,
    tpSplit: 46.6,
    beSplit: 0.0,
    slSplit: 53.4,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 46.6,
    holdOutWinRate: 46.6,
    sharpeRatio: 2.10,
    profitFactor: 1.16,
    maxDrawdown: -9.8,
    totalTrades: 1,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "UNIFIED 4H SWING: Single universal LightGBM brain trading all 7 assets on 4-Hour swing candles (511 historical OOS trades, +26.71R).",
  },
  {
    id: "distributed-4h-engine",
    name: "Distributed 4H Specialists Engine [7 Dedicated Models]",
    shortName: "4H Distributed [7 Specialists]",
    rank: 4,
    timeframe: "4h",
    trueWinRate: 46.9,
    netWinRate: 46.9,
    avgNetR: 0.007,
    avgGrossR: 0.028,
    netProfitFactor: 1.02,
    tpSplit: 46.9,
    beSplit: 0.0,
    slSplit: 53.1,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 46.9,
    holdOutWinRate: 46.9,
    sharpeRatio: 1.85,
    profitFactor: 1.02,
    maxDrawdown: -15.3,
    totalTrades: 9,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "DISTRIBUTED 4H SPECIALISTS: 7 dedicated 4-Hour specialist models trained per asset (1,086 historical OOS trades, 9 live trades).",
  },
  {
    id: "pure-rules-1h-baseline",
    name: "Rule-Based Engine (1H) [BENCHMARK]",
    shortName: "1H Rule-Based [No AI]",
    rank: 5,
    timeframe: "1h",
    trueWinRate: 43.3,
    netWinRate: 43.3,
    avgNetR: -0.021,
    avgGrossR: 0.016,
    netProfitFactor: 0.95,
    tpSplit: 43.3,
    beSplit: 0.0,
    slSplit: 56.7,
    statusBadge: "BENCHMARK ENGINE (1H Zero AI Filter)",
    winRateFull5Yr: 43.3,
    holdOutWinRate: 43.3,
    sharpeRatio: 0.52,
    profitFactor: 0.95,
    maxDrawdown: -15.9,
    totalTrades: 62,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "BENCHMARK ENGINE (1H): Pure 20-bar Donchian breakout above/below 200 SMA across all 7 assets without AI gating (6,217 historical OOS trades, 62 live trades).",
  },
  {
    id: "pure-rules-4h-baseline",
    name: "Rule-Based Engine (4H Swing) [BENCHMARK]",
    shortName: "4H Rule-Based [No AI]",
    rank: 6,
    timeframe: "4h",
    trueWinRate: 46.0,
    netWinRate: 46.0,
    avgNetR: 0.023,
    avgGrossR: 0.044,
    netProfitFactor: 1.07,
    tpSplit: 46.0,
    beSplit: 0.0,
    slSplit: 54.0,
    statusBadge: "BENCHMARK ENGINE (4H Zero AI Filter)",
    winRateFull5Yr: 46.0,
    holdOutWinRate: 46.0,
    sharpeRatio: 0.65,
    profitFactor: 1.07,
    maxDrawdown: -12.1,
    totalTrades: 21,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "BENCHMARK ENGINE (4H): Pure 20-bar Donchian breakout above/below 200 SMA across all 7 assets on 4-Hour candles (2,005 historical OOS trades, 21 live trades).",
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
