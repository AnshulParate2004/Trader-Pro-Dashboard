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
    id: "4h-swing-meta-017",
    name: "4H Swing Meta (+0.17R) [ACTIVE]",
    shortName: "4H Swing Meta (+0.17R) [ACTIVE]",
    rank: 1,
    timeframe: "4h",
    trueWinRate: 52.8,
    netWinRate: 52.8,
    avgNetR: 0.1748,
    avgGrossR: 0.2048,
    netProfitFactor: 1.46,
    tpSplit: 52.8,
    beSplit: 0.0,
    slSplit: 47.2,
    statusBadge: "ACTIVE PAPER ENGINE (0.10% friction deducted)",
    winRateFull5Yr: 52.8,
    holdOutWinRate: 52.8,
    sharpeRatio: 1.85,
    profitFactor: 1.46,
    maxDrawdown: -11.59,
    totalTrades: 159,
    ratchetTriggerR: 0,
    requires4HMacro: true,
    requires5MMicro: false,
    description: "ACTIVE: 4-Hour Donchian breakout + 200 SMA regime gated by LightGBM meta-classifier (Top 25% quantile conviction P >= 0.10). Out-of-sample verified with 10 bps friction (+0.175R expectancy, 1.46 PF, -11.59R max DD).",
  },
  {
    id: "1h-commodities-rf",
    name: "1H Macro Commodities (Gold, Silver, Oil) [ACTIVE]",
    shortName: "1H Commodities (+0.151R) [ACTIVE]",
    rank: 1,
    timeframe: "1h",
    trueWinRate: 49.7,
    netWinRate: 45.2,
    avgNetR: 0.1514,
    avgGrossR: 0.1639,
    netProfitFactor: 1.32,
    tpSplit: 45.2,
    beSplit: 0.0,
    slSplit: 54.8,
    statusBadge: "ACTIVE PAPER ENGINE (0.05% friction deducted)",
    winRateFull5Yr: 49.7,
    holdOutWinRate: 45.2,
    sharpeRatio: 2.14,
    profitFactor: 1.32,
    maxDrawdown: -36.78,
    totalTrades: 336,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "ACTIVE: 1-Hour Donchian breakout on Gold (GC=F), Silver (SI=F), and Crude Oil (CL=F) gated by Random Forest meta-classifier (Top 20% quantile conviction P >= 0.0635). OOS verified with 5 bps institutional friction (+0.151R expectancy, 1.32 PF, 4.07 trades/day).",
  },
  {
    id: "15m-sniper-030",
    name: "15M Sniper Scalp (+0.30R Ratchet) [RETIRED]",
    shortName: "15M Sniper (+0.30R) [RETIRED]",
    rank: 2,
    timeframe: "15m",
    trueWinRate: 62.0,
    netWinRate: 34.6,
    avgNetR: -0.259,
    avgGrossR: 0.0410,
    netProfitFactor: 0.40,
    tpSplit: 36.5,
    beSplit: 41.2,
    slSplit: 22.3,
    statusBadge: "RETIRED: negative net expectancy at live stop size (CI upper bound below 0)",
    winRateFull5Yr: 77.7,
    holdOutWinRate: 76.1,
    sharpeRatio: 7.18,
    profitFactor: 1.78,
    maxDrawdown: -10.2,
    totalTrades: 6538,
    ratchetTriggerR: 0.30,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "RETIRED: negative net expectancy at live stop size (CI upper bound below 0: [-0.273, -0.245]R). Cron trading stopped; data preserved for research.",
  },
  {
    id: "15m-precision-035",
    name: "15M Precision Scalp (+0.35R Ratchet) [RETIRED]",
    shortName: "15M Precision (+0.35R) [RETIRED]",
    rank: 2,
    timeframe: "15m",
    trueWinRate: 61.4,
    netWinRate: 33.9,
    avgNetR: -0.275,
    netProfitFactor: 0.38,
    tpSplit: 35.2,
    beSplit: 40.0,
    slSplit: 24.8,
    statusBadge: "RETIRED: negative net expectancy at live stop size (CI upper bound below 0)",
    winRateFull5Yr: 75.2,
    holdOutWinRate: 73.6,
    sharpeRatio: 6.36,
    profitFactor: 1.63,
    maxDrawdown: -10.8,
    totalTrades: 6516,
    ratchetTriggerR: 0.35,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "RETIRED: negative net expectancy at live stop size (CI upper bound below 0). Cron trading stopped.",
  },
  {
    id: "master-confluence-multi",
    name: "Full Master Sniper (5M + 15M + 4H) [RETIRED]",
    shortName: "Master Sniper (5M/15M/4H) [RETIRED]",
    rank: 4,
    timeframe: "multi",
    trueWinRate: 60.5,
    netWinRate: 32.1,
    avgNetR: -0.340,
    netProfitFactor: 0.35,
    tpSplit: 34.0,
    beSplit: 39.5,
    slSplit: 26.5,
    statusBadge: "RETIRED: negative net expectancy at live stop size (CI upper bound below 0)",
    winRateFull5Yr: 73.1,
    holdOutWinRate: 76.0,
    sharpeRatio: 4.46,
    profitFactor: 1.40,
    maxDrawdown: -10.2,
    totalTrades: 11420,
    ratchetTriggerR: 0.30,
    requires4HMacro: true,
    requires5MMicro: true,
    description: "RETIRED: negative net expectancy at live stop size (CI upper bound below 0). Excessive fee friction drag.",
  },
  {
    id: "5m-15m-confluence",
    name: "5M + 15M Confluence Sniper [RETIRED]",
    shortName: "5M/15M Confluence [RETIRED]",
    rank: 5,
    timeframe: "multi",
    trueWinRate: 58.2,
    netWinRate: 28.4,
    avgNetR: -0.420,
    netProfitFactor: 0.28,
    tpSplit: 31.0,
    beSplit: 42.0,
    slSplit: 27.0,
    statusBadge: "RETIRED: negative net expectancy at live stop size (CI upper bound below 0)",
    winRateFull5Yr: 73.0,
    holdOutWinRate: 75.8,
    sharpeRatio: 6.16,
    profitFactor: 1.39,
    maxDrawdown: -9.7,
    totalTrades: 21494,
    ratchetTriggerR: 0.30,
    requires4HMacro: false,
    requires5MMicro: true,
    description: "RETIRED: negative net expectancy at live stop size (CI upper bound below 0). Severe round-trip friction impairment.",
  },
  {
    id: "1h-trend-donchian",
    name: "1H Trend Donchian Model [RETIRED]",
    shortName: "1H Trend Model [RETIRED]",
    rank: 6,
    timeframe: "1h",
    trueWinRate: 58.0,
    netWinRate: 37.2,
    avgNetR: -0.049,
    netProfitFactor: 0.72,
    tpSplit: 37.2,
    beSplit: 35.9,
    slSplit: 26.9,
    statusBadge: "RETIRED: negative at estimated live stop",
    winRateFull5Yr: 61.2,
    holdOutWinRate: 58.5,
    sharpeRatio: 2.14,
    profitFactor: 1.15,
    maxDrawdown: -14.2,
    totalTrades: 3395,
    ratchetTriggerR: 0.30,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "RETIRED: negative at estimated live stop (-0.0487R, 95% CI [-0.0759, -0.0219]R). Does not survive taker friction.",
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
