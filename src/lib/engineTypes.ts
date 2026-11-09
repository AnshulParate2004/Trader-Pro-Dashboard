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

export const DEFAULT_MODEL_ID = 'om-distributed-4h-engine';

export const TOP_MODELS: AIStrategyModel[] = [
  // =========================================================================
  // OPTION A: ZERO-TRAINING HAND-WRITTEN NEURAL NETWORK (16->32->16->2 MLP)
  // =========================================================================
  {
    id: "option-a-1h-hand-written",
    name: "[Option A] Hand-Written Neural Network [1H High-Conviction 🏆]",
    shortName: "[Option A] 1H Hand-Written [80% WR 🏆]",
    rank: 1,
    timeframe: "1h",
    trueWinRate: 80.0,
    netWinRate: 80.0,
    avgNetR: 0.632,
    avgGrossR: 0.652,
    netProfitFactor: 4.13,
    tpSplit: 80.0,
    beSplit: 0.0,
    slSplit: 20.0,
    statusBadge: "ACTIVE LIVE HAND-CRAFTED ENGINE",
    winRateFull5Yr: 80.0,
    holdOutWinRate: 80.0,
    sharpeRatio: 3.45,
    profitFactor: 4.13,
    maxDrawdown: -1.01,
    totalTrades: 5,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[Option A] ZERO-TRAINING HAND-WRITTEN NEURAL NETWORK (16->32->16->2 MLP): Closed-form mathematical weights without backpropagation. 1H Timeframe: 5 trades, 80.0% Win Rate, +3.16R, 4.13 Profit Factor under Shark friction.",
  },

  // =========================================================================
  // OM MODEL SUITE (6-Year Optimal Segmentation: Train 2020-2023 | Val 2024 | Unseen 2025-2026 | Live Oct-Nov 2026)
  // =========================================================================
  {
    id: "om-distributed-4h-engine",
    name: "[OM] Distributed 4H Specialists [7 Dedicated Models]",
    shortName: "[OM] 4H Distributed [Top Performer]",
    rank: 1,
    timeframe: "4h",
    trueWinRate: 52.5,
    netWinRate: 52.5,
    avgNetR: 0.100,
    avgGrossR: 0.121,
    netProfitFactor: 1.38,
    tpSplit: 52.5,
    beSplit: 0.0,
    slSplit: 47.5,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 52.5,
    holdOutWinRate: 52.5,
    sharpeRatio: 2.90,
    profitFactor: 1.38,
    maxDrawdown: -5.8,
    totalTrades: 9,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[OM] DISTRIBUTED 4H SPECIALISTS: Trained 2020-2023 across 7 asset models with 2024 ETF calibration. Unseen Data: 2025-2026 (364 unseen trades, +36.26R, 52.5% WR). Live Window: 9 trades, +1.28R, 66.7% WR.",
  },
  {
    id: "om-stacking-meta-engine",
    name: "[OM] Stacking Meta-Learner (Logistic Meta-Ensemble)",
    shortName: "[OM] Stacking Meta [Ensemble]",
    rank: 2,
    timeframe: "1h",
    trueWinRate: 46.7,
    netWinRate: 46.7,
    avgNetR: 0.006,
    avgGrossR: 0.027,
    netProfitFactor: 1.01,
    tpSplit: 46.7,
    beSplit: 0.0,
    slSplit: 53.3,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 46.7,
    holdOutWinRate: 46.7,
    sharpeRatio: 2.25,
    profitFactor: 1.01,
    maxDrawdown: -12.4,
    totalTrades: 26,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[OM] STACKING META-LEARNER: Trained 2020-2023 with 2024 post-ETF meta-weights (beta_uni=2.61, beta_spec=13.47). Unseen Data: 2025-2026 (1,315 unseen trades, +7.24R, 46.7% WR). Live Window: 26 trades, +3.71R, 57.7% WR.",
  },
  {
    id: "om-distributed-1h-engine",
    name: "[OM] Distributed 1H Specialists [7 Dedicated Models]",
    shortName: "[OM] 1H Distributed [7 Specialists]",
    rank: 3,
    timeframe: "1h",
    trueWinRate: 46.0,
    netWinRate: 46.0,
    avgNetR: -0.003,
    avgGrossR: 0.018,
    netProfitFactor: 0.99,
    tpSplit: 46.0,
    beSplit: 0.0,
    slSplit: 54.0,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 46.0,
    holdOutWinRate: 46.0,
    sharpeRatio: 2.15,
    profitFactor: 0.99,
    maxDrawdown: -14.2,
    totalTrades: 28,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[OM] DISTRIBUTED 1H SPECIALISTS: 7 dedicated 1H asset specialists trained 2020-2023. Unseen Data: 2025-2026 (1,369 unseen trades, -4.76R, 46.0% WR). Live Window: 28 trades, +3.91R, 57.1% WR.",
  },
  {
    id: "om-unified-1h-engine",
    name: "[OM] Unified 1H Multi-Asset Engine [1 Universal Brain]",
    shortName: "[OM] 1H Unified [1 Brain]",
    rank: 4,
    timeframe: "1h",
    trueWinRate: 47.0,
    netWinRate: 47.0,
    avgNetR: 0.007,
    avgGrossR: 0.028,
    netProfitFactor: 1.02,
    tpSplit: 47.0,
    beSplit: 0.0,
    slSplit: 53.0,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 47.0,
    holdOutWinRate: 47.0,
    sharpeRatio: 1.95,
    profitFactor: 1.02,
    maxDrawdown: -22.5,
    totalTrades: 25,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[OM] UNIFIED 1H ENGINE: Single universal LightGBM brain trained 2020-2023. Unseen Data: 2025-2026 (1,414 unseen trades, +10.03R, 47.0% WR). Live Window: 25 trades, -2.38R, 44.0% WR.",
  },
  {
    id: "om-consensus-committee-engine",
    name: "[OM] Dual-Gating Consensus Committee [1H Unified + Specialists]",
    shortName: "[OM] 1H Consensus Committee",
    rank: 5,
    timeframe: "1h",
    trueWinRate: 47.0,
    netWinRate: 47.0,
    avgNetR: 0.004,
    avgGrossR: 0.025,
    netProfitFactor: 1.01,
    tpSplit: 47.0,
    beSplit: 0.0,
    slSplit: 53.0,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 47.0,
    holdOutWinRate: 47.0,
    sharpeRatio: 1.85,
    profitFactor: 1.01,
    maxDrawdown: -15.0,
    totalTrades: 10,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[OM] CONSENSUS COMMITTEE: Dual-gating agreement filter (Unified 1H & Specialists >= 0.45). Unseen Data: 2025-2026 (811 unseen trades, +3.40R, 47.0% WR). Live Window: 10 trades, +0.72R, 60.0% WR.",
  },
  {
    id: "om-unified-4h-engine",
    name: "[OM] Unified 4H Swing Engine [1 Universal Brain]",
    shortName: "[OM] 4H Unified [1 Brain]",
    rank: 6,
    timeframe: "4h",
    trueWinRate: 49.5,
    netWinRate: 49.5,
    avgNetR: 0.057,
    avgGrossR: 0.078,
    netProfitFactor: 1.19,
    tpSplit: 49.5,
    beSplit: 0.0,
    slSplit: 50.5,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 49.5,
    holdOutWinRate: 49.5,
    sharpeRatio: 2.10,
    profitFactor: 1.19,
    maxDrawdown: -7.3,
    totalTrades: 4,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[OM] UNIFIED 4H SWING: Universal 4H swing model trained 2020-2023. Unseen Data: 2025-2026 (196 unseen trades, +11.26R, 49.5% WR). Live Window: 4 trades, +0.17R, 75.0% WR.",
  },

  // =========================================================================
  // v1 MODEL SUITE (Trained: 2020-2023 | Unseen: 2024-2025 | Live: Oct-Nov 2026)
  // =========================================================================
  {
    id: "v1-distributed-4h-engine",
    name: "[v1] Distributed 4H Specialists [7 Dedicated Models]",
    shortName: "[v1] 4H Distributed [Top Performer]",
    rank: 7,
    timeframe: "4h",
    trueWinRate: 53.3,
    netWinRate: 53.3,
    avgNetR: 0.122,
    avgGrossR: 0.143,
    netProfitFactor: 1.41,
    tpSplit: 53.3,
    beSplit: 0.0,
    slSplit: 46.7,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 53.3,
    holdOutWinRate: 53.3,
    sharpeRatio: 2.85,
    profitFactor: 1.41,
    maxDrawdown: -6.2,
    totalTrades: 11,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[v1] DISTRIBUTED 4H SPECIALISTS: Trained 2020-2023 across 7 asset models. Unseen Data: 2024-2025 (336 unseen trades, +40.88R, 53.3% WR). Live Window: 11 trades, +1.19R, 72.7% WR.",
  },
  {
    id: "v1-stacking-meta-engine",
    name: "[v1] Stacking Meta-Learner (Logistic Meta-Ensemble)",
    shortName: "[v1] Stacking Meta [Ensemble]",
    rank: 8,
    timeframe: "1h",
    trueWinRate: 47.8,
    netWinRate: 47.8,
    avgNetR: 0.018,
    avgGrossR: 0.039,
    netProfitFactor: 1.05,
    tpSplit: 47.8,
    beSplit: 0.0,
    slSplit: 52.2,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 47.8,
    holdOutWinRate: 47.8,
    sharpeRatio: 2.15,
    profitFactor: 1.05,
    maxDrawdown: -14.1,
    totalTrades: 27,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[v1] STACKING META-LEARNER: Trained 2020-2023 with logistic meta-learner weights. Unseen Data: 2024-2025 (1,669 unseen trades, +30.05R, 47.8% WR). Live Window: 27 trades, -0.79R, 51.9% WR.",
  },
  {
    id: "v1-distributed-1h-engine",
    name: "[v1] Distributed 1H Specialists [7 Dedicated Models]",
    shortName: "[v1] 1H Distributed [7 Specialists]",
    rank: 9,
    timeframe: "1h",
    trueWinRate: 47.7,
    netWinRate: 47.7,
    avgNetR: 0.019,
    avgGrossR: 0.040,
    netProfitFactor: 1.05,
    tpSplit: 47.7,
    beSplit: 0.0,
    slSplit: 52.3,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 47.7,
    holdOutWinRate: 47.7,
    sharpeRatio: 2.10,
    profitFactor: 1.05,
    maxDrawdown: -15.8,
    totalTrades: 25,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[v1] DISTRIBUTED 1H SPECIALISTS: Trained 2020-2023 per asset. Unseen Data: 2024-2025 (1,659 unseen trades, +31.46R, 47.7% WR). Live Window: 25 trades, -2.48R, 48.0% WR.",
  },
  {
    id: "v1-unified-1h-engine",
    name: "[v1] Unified 1H Multi-Asset Engine [1 Universal Brain]",
    shortName: "[v1] 1H Unified [1 Brain]",
    rank: 10,
    timeframe: "1h",
    trueWinRate: 46.6,
    netWinRate: 46.6,
    avgNetR: 0.002,
    avgGrossR: 0.023,
    netProfitFactor: 1.01,
    tpSplit: 46.6,
    beSplit: 0.0,
    slSplit: 53.4,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 46.6,
    holdOutWinRate: 46.6,
    sharpeRatio: 1.80,
    profitFactor: 1.01,
    maxDrawdown: -18.2,
    totalTrades: 46,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[v1] UNIFIED 1H ENGINE: Single universal LightGBM brain trained 2020-2023. Unseen Data: 2024-2025 (2,527 unseen trades, +5.85R, 46.6% WR). Live Window: 46 trades, +1.19R, 47.8% WR.",
  },
  {
    id: "v1-consensus-committee-engine",
    name: "[v1] Dual-Gating Consensus Committee [1H Unified + Specialists]",
    shortName: "[v1] 1H Consensus Committee",
    rank: 11,
    timeframe: "1h",
    trueWinRate: 47.1,
    netWinRate: 47.1,
    avgNetR: 0.000,
    avgGrossR: 0.021,
    netProfitFactor: 1.00,
    tpSplit: 47.1,
    beSplit: 0.0,
    slSplit: 52.9,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 47.1,
    holdOutWinRate: 47.1,
    sharpeRatio: 1.70,
    profitFactor: 1.00,
    maxDrawdown: -16.5,
    totalTrades: 21,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[v1] CONSENSUS COMMITTEE: Dual-gating agreement filter (Unified 1H & Specialists >= 0.45). Unseen Data: 2024-2025 (1,404 unseen trades, +0.33R, 47.1% WR). Live Window: 21 trades, -1.96R, 47.6% WR.",
  },
  {
    id: "v1-unified-4h-engine",
    name: "[v1] Unified 4H Swing Engine [1 Universal Brain]",
    shortName: "[v1] 4H Unified [1 Brain]",
    rank: 12,
    timeframe: "4h",
    trueWinRate: 45.3,
    netWinRate: 45.3,
    avgNetR: -0.027,
    avgGrossR: -0.006,
    netProfitFactor: 0.93,
    tpSplit: 45.3,
    beSplit: 0.0,
    slSplit: 54.7,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 45.3,
    holdOutWinRate: 45.3,
    sharpeRatio: 1.40,
    profitFactor: 0.93,
    maxDrawdown: -11.0,
    totalTrades: 1,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[v1] UNIFIED 4H SWING: Universal 4H model trained 2020-2023. Unseen Data: 2024-2025 (53 unseen trades, -1.43R, 45.3% WR). Live Window: 1 trade, +0.39R, 100% WR.",
  },

  // =========================================================================
  // NEW MODEL SUITE (Trained: 2024-2025 | Unseen: 2020-2023 | Live: Oct-Nov 2026)
  // =========================================================================
  {
    id: "unified-4h-engine",
    name: "[New] Unified 4H Swing Engine [1 Universal Brain]",
    shortName: "[New] 4H Unified [1 Brain]",
    rank: 13,
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
    description: "[New] UNIFIED 4H SWING: Single universal LightGBM brain trained 2024-2025. Unseen Data: 2020-2023 (511 unseen trades, +26.71R, 46.6% WR). Live Window: 1 trade, -0.76R.",
  },
  {
    id: "distributed-4h-engine",
    name: "[New] Distributed 4H Specialists Engine [7 Dedicated Models]",
    shortName: "[New] 4H Distributed [7 Specialists]",
    rank: 14,
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
    description: "[New] DISTRIBUTED 4H SPECIALISTS: 7 dedicated 4-Hour specialist models trained 2024-2025. Unseen Data: 2020-2023 (1,086 unseen trades, +7.34R, 46.9% WR). Live Window: 9 trades, +2.20R, 77.8% WR.",
  },

  {
    id: "distributed-1h-engine",
    name: "[New] Distributed 1H Specialists Engine [7 Dedicated Models]",
    shortName: "[New] 1H Distributed [7 Specialists]",
    rank: 15,
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
    description: "[New] DISTRIBUTED 1H SPECIALISTS: 7 dedicated LightGBM specialist models trained 2024-2025. Unseen Data: 2020-2023 (4,376 unseen trades, -151.17R, 43.9% WR). Live Window: 32 trades, -0.07R, 56.2% WR.",
  },
  {
    id: "new-consensus-committee-engine",
    name: "[New] Dual-Gating Consensus Committee [1H Unified + Specialists]",
    shortName: "[New] 1H Consensus Committee",
    rank: 16,
    timeframe: "1h",
    trueWinRate: 44.6,
    netWinRate: 44.6,
    avgNetR: -0.008,
    avgGrossR: 0.013,
    netProfitFactor: 0.98,
    tpSplit: 44.6,
    beSplit: 0.0,
    slSplit: 55.4,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 44.6,
    holdOutWinRate: 44.6,
    sharpeRatio: 1.75,
    profitFactor: 0.98,
    maxDrawdown: -16.2,
    totalTrades: 37,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[New] CONSENSUS COMMITTEE: Dual-gating agreement filter trained 2024-2025. Unseen Data: 2020-2023 (3,381 unseen trades, -28.35R, 44.6% WR). Live Window: 37 trades, -9.90R, 35.1% WR.",
  },
  {
    id: "new-stacking-meta-engine",
    name: "[New] Stacking Meta-Learner (Logistic Meta-Ensemble)",
    shortName: "[New] Stacking Meta [Ensemble]",
    rank: 17,
    timeframe: "1h",
    trueWinRate: 43.9,
    netWinRate: 43.9,
    avgNetR: -0.025,
    avgGrossR: -0.004,
    netProfitFactor: 0.94,
    tpSplit: 43.9,
    beSplit: 0.0,
    slSplit: 56.1,
    statusBadge: "ACTIVE LIVE PAPER ENGINE",
    winRateFull5Yr: 43.9,
    holdOutWinRate: 43.9,
    sharpeRatio: 1.60,
    profitFactor: 0.94,
    maxDrawdown: -22.5,
    totalTrades: 39,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[New] STACKING META-LEARNER: Trained 2024-2025 with meta-learner weights. Unseen Data: 2020-2023 (3,678 unseen trades, -91.17R, 43.9% WR). Live Window: 39 trades, -11.98R, 33.3% WR.",
  },

  // =========================================================================
  // RULE-BASED BENCHMARKS (Zero AI Filter)
  // =========================================================================
  {
    id: "pure-rules-4h-baseline",
    name: "Rule-Based Engine (4H Swing) [BENCHMARK]",
    shortName: "4H Rule-Based [No AI]",
    rank: 18,
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
    description: "BENCHMARK ENGINE (4H): Pure 20-bar Donchian breakout above/below 200 SMA across all 7 assets on 4-Hour candles (2,005 unseen trades, 21 live trades).",
  },
  {
    id: "pure-rules-1h-baseline",
    name: "Rule-Based Engine (1H) [BENCHMARK]",
    shortName: "1H Rule-Based [No AI]",
    rank: 19,
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
    description: "BENCHMARK ENGINE (1H): Pure 20-bar Donchian breakout above/below 200 SMA across all 7 assets without AI gating (6,217 unseen trades, 62 live trades).",
  },
];

export const ARCHIVED_MODELS: AIStrategyModel[] = [
  {
    id: "unified-1h-engine",
    name: "[New] Unified 1H Multi-Asset Engine [ARCHIVED - LOSS MAKING]",
    shortName: "[Archived] 1H Unified [Retired]",
    rank: 99,
    timeframe: "1h",
    trueWinRate: 37.9,
    netWinRate: 37.9,
    avgNetR: -0.0055,
    avgGrossR: 0.0510,
    netProfitFactor: 0.99,
    tpSplit: 16.9,
    beSplit: 0.0,
    slSplit: 52.7,
    statusBadge: "ARCHIVED - NEGATIVE EXPECTANCY (-₹5,396 LOSS)",
    winRateFull5Yr: 37.9,
    holdOutWinRate: 37.9,
    sharpeRatio: 0.0,
    profitFactor: 0.99,
    maxDrawdown: -93.12,
    totalTrades: 9785,
    ratchetTriggerR: 0,
    requires4HMacro: false,
    requires5MMicro: false,
    description: "[Archived] UNIFIED 1H ENGINE: Retired from active production rank #15 due to net loss (-₹5,396.57 on ₹7k base capital across 9,785 trades over 6 years). Unconstrained standalone 1H decision tree failed against exchange taker friction and 18% GST.",
  },
];

export const ALL_MODELS: AIStrategyModel[] = [...TOP_MODELS, ...ARCHIVED_MODELS];

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
