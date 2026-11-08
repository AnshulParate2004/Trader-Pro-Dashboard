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
    name: "Unified 1H Multi-Asset Engine [ACTIVE LIVE]",
    shortName: "Unified 1H Engine [LIVE]",
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
    description: "ACTIVE LIVE ENGINE: All 7 assets (Gold, Silver, Crude Oil, BTC, ETH, SOL, DOT) executed on 1-Hour candles gated by unified LightGBM meta-model. Strict 1-position lock, platform fees & GST fully deducted.",
  },
  {
    id: "unified-4h-engine",
    name: "Unified 4H Swing Engine [INCREMENTAL SYNC]",
    shortName: "Unified 4H Swing Engine",
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
    description: "SWING ENGINE: All 7 assets executed on 4-Hour candles gated by unified 4H meta-model. Synchronizes incrementally from the last stored watermark timestamp.",
  },
  {
    id: "pure-rules-baseline",
    name: "Rule-Based Engine (No AI Filter) [BENCHMARK]",
    shortName: "Rule-Based Engine [No AI]",
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
    description: "BENCHMARK ENGINE: Evaluates raw mechanical 20-bar Donchian breakouts above/below 200 SMA without AI probability filtering. Automatically checks watermark and updates missing delta.",
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
