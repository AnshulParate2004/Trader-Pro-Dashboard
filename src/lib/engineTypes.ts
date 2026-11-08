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
    id: "1h-commodities-rf",
    name: "1H Macro Commodities & Multi-Asset Engine [ACTIVE LIVE]",
    shortName: "1H Macro Engine (+0.151R) [LIVE]",
    rank: 1,
    timeframe: "1h",
    trueWinRate: 66.7,
    netWinRate: 66.7,
    avgNetR: 0.343,
    avgGrossR: 0.368,
    netProfitFactor: 3.14,
    tpSplit: 66.7,
    beSplit: 0.0,
    slSplit: 33.3,
    statusBadge: "ACTIVE LIVE PAPER ENGINE (Platform Friction Deducted)",
    winRateFull5Yr: 49.7,
    holdOutWinRate: 66.7,
    sharpeRatio: 2.14,
    profitFactor: 3.14,
    maxDrawdown: -3.0,
    totalTrades: 27,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "ACTIVE LIVE ENGINE: 1-Hour Donchian breakout on Gold (XAUUSDT), Silver (XAGUSDT), and Crude Oil (CLUSDT) gated by LightGBM meta-classifier (tau* = 0.0425) with strict 1-position lock. Platform friction and GST fully deducted.",
  },
  {
    id: "4h-swing-meta-017",
    name: "4H Swing Meta Engine (+0.17R) [INCREMENTAL SYNC]",
    shortName: "4H Swing Meta (+0.17R)",
    rank: 2,
    timeframe: "4h",
    trueWinRate: 52.8,
    netWinRate: 52.8,
    avgNetR: 0.1748,
    avgGrossR: 0.2048,
    netProfitFactor: 1.46,
    tpSplit: 52.8,
    beSplit: 0.0,
    slSplit: 47.2,
    statusBadge: "INCREMENTAL SYNC (Cached Delta)",
    winRateFull5Yr: 52.8,
    holdOutWinRate: 52.8,
    sharpeRatio: 1.85,
    profitFactor: 1.46,
    maxDrawdown: -11.59,
    totalTrades: 159,
    ratchetTriggerR: 0,
    requires4HMacro: true,
    requires5MMicro: false,
    description: "SWING STUDY: 4-Hour Donchian breakout + 200 SMA regime gated by LightGBM meta-classifier. Synchronizes incrementally from the last stored watermark timestamp.",
  },
  {
    id: "pure-rules-baseline",
    name: "Pure Mechanical Rules Engine (No AI Filter) [BENCHMARK]",
    shortName: "Pure Mechanical Rules [NO AI]",
    rank: 3,
    timeframe: "1h",
    trueWinRate: 49.3,
    netWinRate: 49.3,
    avgNetR: 0.0676,
    avgGrossR: 0.0926,
    netProfitFactor: 1.29,
    tpSplit: 49.3,
    beSplit: 0.0,
    slSplit: 50.7,
    statusBadge: "BASELINE BENCHMARK STUDY (Cached Delta)",
    winRateFull5Yr: 49.3,
    holdOutWinRate: 49.3,
    sharpeRatio: 1.29,
    profitFactor: 1.29,
    maxDrawdown: -45.2,
    totalTrades: 2019,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "BENCHMARK STUDY: Evaluates raw mechanical 20-bar Donchian breakouts above/below 200 SMA without AI probability filtering. Automatically checks watermark and updates missing delta.",
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
