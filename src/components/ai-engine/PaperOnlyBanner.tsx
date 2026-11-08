"use client";
import { toDisplaySymbol, toRawSymbol, symbolsMatch } from "@/lib/symbolMapper";
import { TradeOrder } from "@/lib/engineTypes";

import React from "react";
import { ShieldCheck, ShieldAlert, ArrowDownRight, ArrowUpRight } from "lucide-react";

export interface AssetPerformanceData {
  assetKey: string;
  assetLabel: string;
  timeframe: string;
  historicalTradesCount: number;
  liveTradesCount: number;
  avgNetR: number;
  realizedReturnR: number;
  netPnLINR: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownR: number;
  tpPercent: number;
  slPercent: number;
  allocatedCapitalINR: number;
  totalPortfolioCapitalINR: number;
  description: string;
  // Live real-time performance & capital accounting
  liveAvgNetR: number;
  liveRealizedReturnR: number;
  liveNetPnLINR: number;
  liveChargesINR: number;
  liveCurrentCapitalINR: number;
  liveWinRate: number;
  liveProfitFactor: number;
  liveTpPercent: number;
  liveSlPercent: number;
  liveDescription?: string;
}

export const ASSET_METRICS_MAP: Record<string, AssetPerformanceData> = {
  ALL: {
    assetKey: "ALL",
    assetLabel: "Portfolio - All 7 Assets",
    timeframe: "4H / 1H Multi-Asset",
    historicalTradesCount: 4403,
    liveTradesCount: 32,
    avgNetR: -0.011,
    realizedReturnR: -1.51,
    netPnLINR: -151.30,
    winRate: 44.7,
    profitFactor: 0.97,
    maxDrawdownR: -12.40,
    tpPercent: 44.7,
    slPercent: 55.3,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Unified 1-Hour quantitative multi-asset engine across all 7 continuous assets with universal LightGBM meta-labeling (4,403 unseen holdout trades, 32 live trades).",
    liveAvgNetR: -0.047,
    liveRealizedReturnR: -1.51,
    liveNetPnLINR: -151.30,
    liveChargesINR: 81.92,
    liveCurrentCapitalINR: 6848.70,
    liveWinRate: 43.8,
    liveProfitFactor: 0.88,
    liveTpPercent: 43.8,
    liveSlPercent: 56.2,
    liveDescription: "Live paper trading executions on unseen real-time feeds with ₹1,000 allocated per asset (₹7,000 portfolio). 32 pure 1H live trades across all 7 assets (14W / 18L).",
  },
  ALL_1H: {
    assetKey: "ALL",
    assetLabel: "Unified 1H Multi-Asset [1 Universal Brain]",
    timeframe: "1H Multi-Asset",
    historicalTradesCount: 4403,
    liveTradesCount: 32,
    avgNetR: -0.011,
    realizedReturnR: -1.51,
    netPnLINR: -151.30,
    winRate: 44.7,
    profitFactor: 0.97,
    maxDrawdownR: -12.40,
    tpPercent: 44.7,
    slPercent: 55.3,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Unified 1-Hour quantitative multi-asset engine across all 7 continuous assets (BTCUSDT, ETHUSDT, SOLUSDT, DOTUSDT, XAUUSDT, XAGUSDT, CLUSDT) with universal LightGBM meta-labeling (4,403 holdout trades, 32 live trades).",
    liveAvgNetR: -0.047,
    liveRealizedReturnR: -1.51,
    liveNetPnLINR: -151.30,
    liveChargesINR: 81.92,
    liveCurrentCapitalINR: 6848.70,
    liveWinRate: 43.8,
    liveProfitFactor: 0.88,
    liveTpPercent: 43.8,
    liveSlPercent: 56.2,
    liveDescription: "Live paper trading executions on unseen real-time feeds with ₹1,000 allocated per asset (₹7,000 portfolio). 32 pure 1H live trades across all 7 assets (14W / 18L).",
  },
  ALL_1H_DIST: {
    assetKey: "ALL",
    assetLabel: "Distributed 1H Specialists [7 Dedicated Models]",
    timeframe: "1H Multi-Asset",
    historicalTradesCount: 4376,
    liveTradesCount: 32,
    avgNetR: -0.035,
    realizedReturnR: 2.18,
    netPnLINR: 218.40,
    winRate: 43.9,
    profitFactor: 0.92,
    maxDrawdownR: -28.90,
    tpPercent: 43.9,
    slPercent: 56.1,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Distributed 1-Hour quantitative specialists engine with 7 dedicated LightGBM models trained per asset (4,376 historical OOS trades, 32 live trades).",
    liveAvgNetR: 0.068,
    liveRealizedReturnR: 2.18,
    liveNetPnLINR: 218.40,
    liveChargesINR: 82.10,
    liveCurrentCapitalINR: 7218.40,
    liveWinRate: 56.3,
    liveProfitFactor: 1.25,
    liveTpPercent: 56.3,
    liveSlPercent: 43.7,
    liveDescription: "Live paper trading executions across all 7 assets gated by 7 dedicated 1H specialist models (32 live trades, 18W / 14L, 56.3% win rate, +2.18R net return).",
  },
  ALL_4H: {
    assetKey: "ALL",
    assetLabel: "Unified 4H Swing [1 Universal Brain]",
    timeframe: "4H Swing Multi-Asset",
    historicalTradesCount: 511,
    liveTradesCount: 1,
    avgNetR: 0.052,
    realizedReturnR: 0.00,
    netPnLINR: 0.00,
    winRate: 46.6,
    profitFactor: 1.16,
    maxDrawdownR: -9.80,
    tpPercent: 46.6,
    slPercent: 53.4,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Unified 4-Hour quantitative swing engine across all 7 continuous assets with LightGBM meta-labeling (511 clean OOS historical trades, 1 live trade, 100% Cash-Preserved below 200 SMA).",
    liveAvgNetR: 0.000,
    liveRealizedReturnR: 0.00,
    liveNetPnLINR: 0.00,
    liveChargesINR: 0.00,
    liveCurrentCapitalINR: 7000.00,
    liveWinRate: 0.0,
    liveProfitFactor: 1.00,
    liveTpPercent: 0.0,
    liveSlPercent: 0.0,
    liveDescription: "Live 4H swing paper trading: 100% Cash preservation safe below 200 SMA regime filter. Zero capital risked.",
  },
  ALL_4H_DIST: {
    assetKey: "ALL",
    assetLabel: "Distributed 4H Specialists [7 Dedicated Models]",
    timeframe: "4H Swing Multi-Asset",
    historicalTradesCount: 1086,
    liveTradesCount: 9,
    avgNetR: 0.007,
    realizedReturnR: 2.21,
    netPnLINR: 220.80,
    winRate: 46.9,
    profitFactor: 1.02,
    maxDrawdownR: -15.30,
    tpPercent: 46.9,
    slPercent: 53.1,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Distributed 4-Hour quantitative swing specialists engine with 7 dedicated per-asset models (1,086 verified holdout trades, 9 live trades).",
    liveAvgNetR: 0.245,
    liveRealizedReturnR: 2.21,
    liveNetPnLINR: 220.80,
    liveChargesINR: 23.04,
    liveCurrentCapitalINR: 7220.80,
    liveWinRate: 77.8,
    liveProfitFactor: 2.89,
    liveTpPercent: 77.8,
    liveSlPercent: 22.2,
    liveDescription: "Live 4H swing paper trading executions across all 7 assets gated by 7 dedicated 4H specialist models (9 live trades, 7W / 2L, 77.8% win rate, +2.21R net return, 2.89 PF).",
  },
  ALL_RULES_1H: {
    assetKey: "ALL",
    assetLabel: "Rule-Based Engine (1H) [No AI]",
    timeframe: "1H Multi-Asset Baseline",
    historicalTradesCount: 6217,
    liveTradesCount: 62,
    avgNetR: -0.021,
    realizedReturnR: -3.20,
    netPnLINR: -320.00,
    winRate: 43.3,
    profitFactor: 0.95,
    maxDrawdownR: -15.90,
    tpPercent: 43.3,
    slPercent: 56.7,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Mechanical Donchian-20 breakout benchmark above/below 200 SMA across all 7 assets on 1H candles without AI gating (6,217 historical holdout trades, 62 live trades).",
    liveAvgNetR: -0.052,
    liveRealizedReturnR: -3.20,
    liveNetPnLINR: -320.00,
    liveChargesINR: 158.40,
    liveCurrentCapitalINR: 6680.00,
    liveWinRate: 46.8,
    liveProfitFactor: 0.91,
    liveTpPercent: 46.8,
    liveSlPercent: 53.2,
    liveDescription: "Live 1H mechanical Donchian-20 breakouts evaluated across all 7 assets with zero AI gating (62 live trades, 29W / 33L, 46.8% win rate).",
  },
  ALL_RULES_4H: {
    assetKey: "ALL",
    assetLabel: "Rule-Based Engine (4H Swing) [No AI]",
    timeframe: "4H Swing Baseline",
    historicalTradesCount: 2005,
    liveTradesCount: 21,
    avgNetR: 0.023,
    realizedReturnR: 2.48,
    netPnLINR: 248.00,
    winRate: 46.0,
    profitFactor: 1.07,
    maxDrawdownR: -12.10,
    tpPercent: 46.0,
    slPercent: 54.0,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Mechanical Donchian-20 swing breakout benchmark above/below 200 SMA across all 7 assets on 4H candles with zero AI gating (2,005 historical holdout trades, 21 live trades).",
    liveAvgNetR: 0.118,
    liveRealizedReturnR: 2.48,
    liveNetPnLINR: 248.00,
    liveChargesINR: 53.76,
    liveCurrentCapitalINR: 7248.00,
    liveWinRate: 61.9,
    liveProfitFactor: 1.34,
    liveTpPercent: 61.9,
    liveSlPercent: 38.1,
    liveDescription: "Live 4H swing mechanical Donchian-20 breakouts evaluated across all 7 assets with zero AI gating (21 live trades, 13W / 8L, 61.9% win rate, +2.48R).",
  },
  ALL_RULES: {
    assetKey: "ALL",
    assetLabel: "Rule-Based Engine (1H) [No AI]",
    timeframe: "1H Multi-Asset Baseline",
    historicalTradesCount: 6217,
    liveTradesCount: 62,
    avgNetR: -0.021,
    realizedReturnR: -3.20,
    netPnLINR: -320.00,
    winRate: 43.3,
    profitFactor: 0.95,
    maxDrawdownR: -15.90,
    tpPercent: 43.3,
    slPercent: 56.7,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Mechanical Donchian-20 breakout benchmark above/below 200 SMA across all 7 assets without AI gating (6,217 historical trades, 62 live trades).",
    liveAvgNetR: -0.052,
    liveRealizedReturnR: -3.20,
    liveNetPnLINR: -320.00,
    liveChargesINR: 158.40,
    liveCurrentCapitalINR: 6680.00,
    liveWinRate: 46.8,
    liveProfitFactor: 0.91,
    liveTpPercent: 46.8,
    liveSlPercent: 53.2,
    liveDescription: "Live 1H mechanical Donchian-20 breakouts evaluated across all 7 assets with zero AI gating (62 live trades, 46.8% win rate).",
  },
  BTCUSDT: {
    assetKey: "BTCUSDT",
    assetLabel: "Bitcoin (BTC/USDT)",
    timeframe: "1H / 4H",
    historicalTradesCount: 626,
    liveTradesCount: 1,
    avgNetR: -0.006,
    realizedReturnR: -1.02,
    netPnLINR: -102.50,
    winRate: 48.9,
    profitFactor: 0.98,
    maxDrawdownR: -11.59,
    tpPercent: 48.9,
    slPercent: 51.1,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bitcoin continuous perp Donchian breakouts with LightGBM meta-filter above the 200 SMA.",
    liveAvgNetR: -1.025,
    liveRealizedReturnR: -1.02,
    liveNetPnLINR: -102.50,
    liveChargesINR: 2.52,
    liveCurrentCapitalINR: 897.50,
    liveWinRate: 0.0,
    liveProfitFactor: 0.00,
    liveTpPercent: 0.0,
    liveSlPercent: 100.0,
    liveDescription: "Initial test trade booked at -1.025R; remaining periods strictly preserved in 100% cash below 200 SMA regime filter.",
  },
  ETHUSDT: {
    assetKey: "ETHUSDT",
    assetLabel: "Ethereum (ETH/USDT)",
    timeframe: "1H / 4H",
    historicalTradesCount: 287,
    liveTradesCount: 2,
    avgNetR: 0.095,
    realizedReturnR: 0.45,
    netPnLINR: 45.20,
    winRate: 46.7,
    profitFactor: 1.23,
    maxDrawdownR: -9.20,
    tpPercent: 46.7,
    slPercent: 53.3,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Ethereum continuous perp Donchian breakouts with LightGBM meta-filter above the 200 SMA.",
    liveAvgNetR: 0.226,
    liveRealizedReturnR: 0.45,
    liveNetPnLINR: 45.20,
    liveChargesINR: 5.12,
    liveCurrentCapitalINR: 1045.20,
    liveWinRate: 50.0,
    liveProfitFactor: 1.62,
    liveTpPercent: 50.0,
    liveSlPercent: 50.0,
  },
  SOLUSDT: {
    assetKey: "SOLUSDT",
    assetLabel: "Solana (SOL/USDT)",
    timeframe: "1H / 4H",
    historicalTradesCount: 261,
    liveTradesCount: 3,
    avgNetR: -0.076,
    realizedReturnR: 0.06,
    netPnLINR: 5.80,
    winRate: 41.8,
    profitFactor: 0.86,
    maxDrawdownR: -6.80,
    tpPercent: 41.8,
    slPercent: 58.2,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Solana continuous perp Donchian breakouts with LightGBM meta-filter above the 200 SMA.",
    liveAvgNetR: 0.019,
    liveRealizedReturnR: 0.06,
    liveNetPnLINR: 5.80,
    liveChargesINR: 7.68,
    liveCurrentCapitalINR: 1005.80,
    liveWinRate: 66.7,
    liveProfitFactor: 1.25,
    liveTpPercent: 66.7,
    liveSlPercent: 33.3,
  },
  DOTUSDT: {
    assetKey: "DOTUSDT",
    assetLabel: "Polkadot (DOT/USDT)",
    timeframe: "1H / 4H",
    historicalTradesCount: 416,
    liveTradesCount: 4,
    avgNetR: 0.094,
    realizedReturnR: -0.45,
    netPnLINR: -44.60,
    winRate: 46.6,
    profitFactor: 1.21,
    maxDrawdownR: -5.40,
    tpPercent: 46.6,
    slPercent: 53.4,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Polkadot continuous perp Donchian breakouts with LightGBM meta-filter above the 200 SMA.",
    liveAvgNetR: -0.112,
    liveRealizedReturnR: -0.45,
    liveNetPnLINR: -44.60,
    liveChargesINR: 10.24,
    liveCurrentCapitalINR: 955.40,
    liveWinRate: 50.0,
    liveProfitFactor: 0.85,
    liveTpPercent: 50.0,
    liveSlPercent: 50.0,
  },
  XAUUSDT: {
    assetKey: "XAUUSDT",
    assetLabel: "Gold (XAUUSDT 1H)",
    timeframe: "1H Commodities",
    historicalTradesCount: 613,
    liveTradesCount: 7,
    avgNetR: 0.031,
    realizedReturnR: 1.82,
    netPnLINR: 182.10,
    winRate: 52.7,
    profitFactor: 1.11,
    maxDrawdownR: -14.20,
    tpPercent: 52.7,
    slPercent: 47.3,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bi-directional 1-Hour Donchian breakout / breakdown on Gold (XAUUSDT) continuous crypto perp gated by LightGBM meta-classifier.",
    liveAvgNetR: 0.260,
    liveRealizedReturnR: 1.82,
    liveNetPnLINR: 182.10,
    liveChargesINR: 17.92,
    liveCurrentCapitalINR: 1182.10,
    liveWinRate: 57.1,
    liveProfitFactor: 2.14,
    liveTpPercent: 57.1,
    liveSlPercent: 42.9,
    liveDescription: "Live 1-Hour Donchian breakout / breakdown on Gold (XAUUSDT) continuous perp. +1.82R (+₹182.10) net profit.",
  },
  XAGUSDT: {
    assetKey: "XAGUSDT",
    assetLabel: "Silver (XAGUSDT 1H)",
    timeframe: "1H Commodities",
    historicalTradesCount: 668,
    liveTradesCount: 10,
    avgNetR: -0.074,
    realizedReturnR: 1.14,
    netPnLINR: 114.20,
    winRate: 45.7,
    profitFactor: 0.81,
    maxDrawdownR: -15.40,
    tpPercent: 45.7,
    slPercent: 54.3,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bi-directional 1-Hour Donchian breakout / breakdown on Silver (XAGUSDT) continuous crypto perp gated by LightGBM meta-classifier.",
    liveAvgNetR: 0.114,
    liveRealizedReturnR: 1.14,
    liveNetPnLINR: 114.20,
    liveChargesINR: 25.60,
    liveCurrentCapitalINR: 1114.20,
    liveWinRate: 60.0,
    liveProfitFactor: 1.48,
    liveTpPercent: 60.0,
    liveSlPercent: 40.0,
    liveDescription: "Live 1-Hour Donchian breakout / breakdown on Silver (XAGUSDT) continuous perp. +1.14R (+₹114.20) net profit.",
  },
  CLUSDT: {
    assetKey: "CLUSDT",
    assetLabel: "Crude Oil (CLUSDT 1H)",
    timeframe: "1H Commodities",
    historicalTradesCount: 652,
    liveTradesCount: 5,
    avgNetR: -0.162,
    realizedReturnR: 1.25,
    netPnLINR: 125.40,
    winRate: 39.6,
    profitFactor: 0.67,
    maxDrawdownR: -18.10,
    tpPercent: 39.6,
    slPercent: 60.4,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bi-directional 1-Hour Donchian breakout / breakdown on Crude Oil (CLUSDT) continuous crypto perp gated by LightGBM meta-classifier.",
    liveAvgNetR: 0.251,
    liveRealizedReturnR: 1.25,
    liveNetPnLINR: 125.40,
    liveChargesINR: 12.80,
    liveCurrentCapitalINR: 1125.40,
    liveWinRate: 60.0,
    liveProfitFactor: 1.85,
    liveTpPercent: 60.0,
    liveSlPercent: 40.0,
    liveDescription: "Live 1-Hour Donchian breakout / breakdown on Crude Oil (CLUSDT) continuous perp. +1.25R (+₹125.40) net profit.",
  },
  // Aliases for backwards compatibility
  "GC=F": {
    assetKey: "XAUUSDT",
    assetLabel: "Gold (XAUUSDT Alias)",
    timeframe: "1H Commodities",
    historicalTradesCount: 613,
    liveTradesCount: 7,
    avgNetR: 0.031,
    realizedReturnR: 1.82,
    netPnLINR: 182.10,
    winRate: 52.7,
    profitFactor: 1.11,
    maxDrawdownR: -14.20,
    tpPercent: 52.7,
    slPercent: 47.3,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Alias mapping to Gold (XAUUSDT) continuous crypto perp.",
    liveAvgNetR: 0.260,
    liveRealizedReturnR: 1.82,
    liveNetPnLINR: 182.10,
    liveChargesINR: 17.92,
    liveCurrentCapitalINR: 1182.10,
    liveWinRate: 57.1,
    liveProfitFactor: 2.14,
    liveTpPercent: 57.1,
    liveSlPercent: 42.9,
  },
  "SI=F": {
    assetKey: "XAGUSDT",
    assetLabel: "Silver (XAGUSDT Alias)",
    timeframe: "1H Commodities",
    historicalTradesCount: 668,
    liveTradesCount: 10,
    avgNetR: -0.074,
    realizedReturnR: 1.14,
    netPnLINR: 114.20,
    winRate: 45.7,
    profitFactor: 0.81,
    maxDrawdownR: -15.40,
    tpPercent: 45.7,
    slPercent: 54.3,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Alias mapping to Silver (XAGUSDT) continuous crypto perp.",
    liveAvgNetR: 0.114,
    liveRealizedReturnR: 1.14,
    liveNetPnLINR: 114.20,
    liveChargesINR: 25.60,
    liveCurrentCapitalINR: 1114.20,
    liveWinRate: 60.0,
    liveProfitFactor: 1.48,
    liveTpPercent: 60.0,
    liveSlPercent: 40.0,
  },
  "CL=F": {
    assetKey: "CLUSDT",
    assetLabel: "Crude Oil (CLUSDT Alias)",
    timeframe: "1H Commodities",
    historicalTradesCount: 652,
    liveTradesCount: 5,
    avgNetR: -0.162,
    realizedReturnR: 1.25,
    netPnLINR: 125.40,
    winRate: 39.6,
    profitFactor: 0.67,
    maxDrawdownR: -18.10,
    tpPercent: 39.6,
    slPercent: 60.4,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Alias mapping to Crude Oil (CLUSDT) continuous crypto perp.",
    liveAvgNetR: 0.251,
    liveRealizedReturnR: 1.25,
    liveNetPnLINR: 125.40,
    liveChargesINR: 12.80,
    liveCurrentCapitalINR: 1125.40,
    liveWinRate: 60.0,
    liveProfitFactor: 1.85,
    liveTpPercent: 60.0,
    liveSlPercent: 40.0,
  },
};

export function getAssetMetrics(
  selectedAsset: string = "ALL",
  selectedModelId: string = "unified-1h-engine"
): AssetPerformanceData {
  if (selectedAsset && selectedAsset !== "ALL") {
    return (
      ASSET_METRICS_MAP[selectedAsset] ||
      ASSET_METRICS_MAP[toDisplaySymbol(selectedAsset)] ||
      ASSET_METRICS_MAP[toRawSymbol(selectedAsset)] ||
      ASSET_METRICS_MAP["ALL"]
    );
  }

  if (selectedModelId === "distributed-1h-engine") return ASSET_METRICS_MAP["ALL_1H_DIST"];
  if (selectedModelId === "distributed-4h-engine") return ASSET_METRICS_MAP["ALL_4H_DIST"];
  if (selectedModelId === "unified-4h-engine" || selectedModelId === "4h-swing-meta-017") return ASSET_METRICS_MAP["ALL_4H"];
  if (selectedModelId === "pure-rules-4h-baseline") return ASSET_METRICS_MAP["ALL_RULES_4H"];
  if (selectedModelId === "pure-rules-1h-baseline" || selectedModelId === "pure-rules-baseline") return ASSET_METRICS_MAP["ALL_RULES_1H"];
  return ASSET_METRICS_MAP["ALL_1H"] || ASSET_METRICS_MAP["ALL"];
}

interface PaperOnlyBannerProps {
  avgNetR?: number;
  netPnLINR?: number;
  isTaker: boolean;
  feePercent: number;
  closedTradesCount: number;
  selectedModelId?: string;
  selectedAsset?: string;
  assetData?: AssetPerformanceData;
  isLiveMode?: boolean;
  trades?: TradeOrder[];
  tradingFeePercent?: number;
}

export const PaperOnlyBanner: React.FC<PaperOnlyBannerProps> = ({
  avgNetR = 0.165,
  netPnLINR = 7870,
  isTaker,
  feePercent,
  closedTradesCount,
  selectedModelId = "4h-swing-meta-017",
  selectedAsset = "ALL",
  assetData,
  isLiveMode = true,
  trades = [],
  tradingFeePercent,
}) => {
  const isDistributed1H = selectedModelId === "distributed-1h-engine";
  const isDistributed4H = selectedModelId === "distributed-4h-engine";
  const is4H = selectedModelId === "unified-4h-engine" || selectedModelId === "4h-swing-meta-017" || selectedModelId === "pure-rules-4h-baseline";
  const is1H = selectedModelId === "unified-1h-engine" || selectedModelId === "1h-commodities-rf" || selectedModelId === "pure-rules-1h-baseline";
  const isRules = selectedModelId.includes("pure-rules") || selectedModelId === "pure-rules-baseline";
  const isLegacy = !is4H && !is1H && !isRules && !isDistributed1H && !isDistributed4H;

  // Use dynamic assetData values if provided or lookup from map with symbol alias & active model fallback
  const resolved = assetData || getAssetMetrics(selectedAsset, selectedModelId);

  // Filter live trades array for selected asset using transparent alias matching
  const filteredLiveTrades = trades && trades.length > 0
    ? (selectedAsset && selectedAsset !== "ALL" ? trades.filter(t => symbolsMatch(t.symbol, selectedAsset)) : trades)
    : [];

  const dynamicTotalFees = filteredLiveTrades.length > 0
    ? filteredLiveTrades.reduce((acc, t) => acc + (t.totalFeeINR || 0), 0)
    : 0;

  const dynamicNetProfit = filteredLiveTrades.length > 0
    ? filteredLiveTrades.reduce((acc, t) => acc + (t.netPnLINR || 0), 0)
    : 0;

  const dynamicAvgNetR = filteredLiveTrades.length > 0
    ? filteredLiveTrades.reduce((acc, t) => acc + ((t.netPnLINR ?? 0) / 100), 0) / filteredLiveTrades.length
    : 0;

  const dynamicReturnR = filteredLiveTrades.length > 0
    ? filteredLiveTrades.reduce((acc, t) => acc + ((t.netPnLINR ?? 0) / 100), 0)
    : 0;

  const baseCapital = selectedAsset === "ALL" ? 7000 : 1000;
  const dynamicCapital = baseCapital + dynamicNetProfit;

  // Differentiate live mode vs historical mode
  const currentAvgNetR = isLiveMode ? dynamicAvgNetR : resolved.avgNetR;
  const currentReturnR = isLiveMode ? dynamicReturnR : resolved.realizedReturnR;
  const currentTradeCount = isLiveMode ? filteredLiveTrades.length : resolved.historicalTradesCount;

  const isPositiveExpectancy = !isLegacy && currentAvgNetR >= 0;
  const isCommodityAsset = ["GC=F", "SI=F", "CL=F", "XAUUSDT", "XAGUSDT", "CLUSDT"].includes(selectedAsset);
  const isAll = selectedAsset === "ALL";

  const feeModeString = isCommodityAsset || (isAll && is1H)
    ? "0.05% Institutional Friction Deducted"
    : (isAll && (is4H || isRules))
    ? "0.10% Taker Friction Deducted"
    : isAll
    ? "Institutional Multi-Asset Friction Deducted (0.10% Crypto / 0.05% Commodities)"
    : is4H || isRules
    ? "0.10% Taker Friction Deducted"
    : "0.05% Institutional Friction Deducted";

  const assetDisplayLabel = resolved.assetLabel || (isAll ? "Portfolio - All 7 Assets" : selectedAsset);

  return (
    <section
      aria-label="Net Expectancy and Paper Trading Status"
      className={`w-full bg-white border-2 rounded-lg pt-7 pb-6 px-5 sm:px-6 shadow-xs relative overflow-hidden transition-all ${
        isPositiveExpectancy ? "border-win/30" : "border-accent/30"
      }`}
    >
      {/* Subtle top indicator bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          isLiveMode
            ? currentAvgNetR >= 0 ? "bg-win" : "bg-amber-500"
            : isPositiveExpectancy ? "bg-win" : "bg-accent"
        }`}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Headline & Explanation */}
        <div className="flex flex-col gap-2.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            {isLiveMode ? (
              currentAvgNetR >= 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-win-tint text-chrome-green-ink border border-win/40 font-mono text-[11px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-win" />
                  LIVE REAL-TIME EXECUTION [${assetDisplayLabel}]
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-300 font-mono text-[11px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  LIVE FORWARD EXECUTION · DRAWDOWN CONSOLIDATION [${assetDisplayLabel}]
                </span>
              )
            ) : isPositiveExpectancy ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-win-tint text-chrome-green-ink border border-win/40 font-mono text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-win" />
                ACTIVE · POSITIVE EXPECTANCY [${assetDisplayLabel}]
              </span>
            ) : isRules ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-chrome-field text-chrome-dim border border-chrome-line font-mono text-[11px] font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5 text-chrome-dim" />
                BENCHMARK ENGINE (NO AI FILTER) [${assetDisplayLabel}]
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-50 text-rose-800 border border-rose-300 font-mono text-[11px] font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                RETIRED · Negative Expectancy at Live Stop Size
              </span>
            )}

            <span
              className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                isPositiveExpectancy
                  ? "bg-win-tint text-chrome-green-ink border-win/30"
                  : isTaker
                  ? "bg-accent-tint text-chrome-green-ink border-accent/30"
                  : "bg-blue-50 text-chrome-dim border-blue-200"
              }`}
            >
              Fee Mode: {feeModeString}
            </span>

            <span className="font-mono text-[11px] text-chrome-dim font-bold">
              ({currentTradeCount} {isLiveMode ? "Live Executions Tracked" : "Clean OOS Trades Evaluated"})
            </span>
          </div>

          <h1 className="font-brand text-2xl sm:text-3xl font-medium tracking-tight text-chrome-ink mt-1">
            {isLiveMode
              ? `Live Net Expectancy: ${currentAvgNetR >= 0 ? `+${currentAvgNetR.toFixed(3)}` : currentAvgNetR.toFixed(3)} R / trade (${currentReturnR >= 0 ? `+${currentReturnR.toFixed(2)}` : currentReturnR.toFixed(2)} R Realized)`
              : `Net Expectancy After Fees: ${currentAvgNetR >= 0 ? `+${currentAvgNetR.toFixed(3)}` : currentAvgNetR.toFixed(3)} R / trade`}
          </h1>

          {isLiveMode ? (
            <p className="font-body text-xs sm:text-sm text-chrome-dim leading-relaxed">
              <strong>Capital Given:</strong> ₹{resolved.allocatedCapitalINR.toLocaleString("en-IN", { minimumFractionDigits: 2 })} {isAll ? "(₹1,000 / asset)" : ""} &nbsp;|&nbsp;
              <strong>Current Balance:</strong> <span className={dynamicCapital >= resolved.allocatedCapitalINR ? "text-win font-bold" : "text-loss font-bold"}>₹{dynamicCapital.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span> &nbsp;|&nbsp;
              <strong>Shark Charges (w/ GST) Paid:</strong> ₹{dynamicTotalFees.toFixed(2)} &nbsp;|&nbsp;
              <strong>{currentTradeCount} Live Executions Tracked.</strong>
              {resolved.liveTradesCount === 0 ? " 100% Cash preservation safe below 200 SMA regime filter. Zero capital risked." : ""}
              {selectedAsset === "BTCUSDT" ? " Initial test trade booked at -1.025R; remaining period strictly preserved in 100% cash below 200 SMA." : ""}
            </p>
          ) : (
            <p className="font-body text-xs sm:text-sm text-chrome-dim leading-relaxed">
              {resolved.description}{" "}
              Validated across <strong>{resolved.historicalTradesCount} out-of-sample trades with institutional friction deducted</strong> ({currentAvgNetR >= 0 ? `+${currentAvgNetR.toFixed(3)}` : currentAvgNetR.toFixed(3)}R expectancy, {resolved.profitFactor.toFixed(2)} PF, {resolved.winRate.toFixed(1)}% WR).
            </p>
          )}
        </div>

        {/* Right: Key Big Numbers */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 lg:gap-6 shrink-0 border-t lg:border-t-0 lg:border-l border-chrome-edge pt-4 lg:pt-0 lg:pl-6">
          {/* Avg Net R */}
          <div className="flex flex-col min-w-[140px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase font-bold text-chrome-dim">
                Avg Net R
              </span>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border bg-chrome-field text-chrome-dim border-chrome-line font-bold">
                {isLiveMode ? "Live Window" : (isCommodityAsset ? "5 bps" : isAll ? "Multi-Asset" : "10 bps")}
              </span>
            </div>
            <div
              className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight mt-1 flex items-center gap-1 ${
                isPositiveExpectancy ? "text-win" : "text-loss"
              }`}
            >
              {isPositiveExpectancy ? (
                <ArrowUpRight className="w-6 h-6 inline text-win" />
              ) : (
                <ArrowDownRight className="w-6 h-6 inline text-loss" />
              )}
              <span>
                {currentAvgNetR >= 0 ? `+${currentAvgNetR.toFixed(3)} R` : `${currentAvgNetR.toFixed(3)} R`}
              </span>
            </div>
            <span className="font-mono text-[10px] text-chrome-dim mt-0.5">
              {isLiveMode ? "per live execution" : `per closed ${isAll ? "portfolio trade" : `${selectedAsset} trade`}`}
            </span>
          </div>

          {/* Realized Net PnL / Return */}
          <div className="flex flex-col min-w-[140px] pl-4 border-l border-chrome-edge">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase font-bold text-chrome-dim">
                {isLiveMode ? "Realized Live Return" : "Realized OOS Return"}
              </span>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border bg-chrome-field text-chrome-dim border-chrome-line font-bold">
                {isLiveMode ? "Live Edge" : "OOS Edge"}
              </span>
            </div>
            <div
              className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight mt-1 ${
                isPositiveExpectancy ? "text-win" : "text-loss"
              }`}
            >
              {currentReturnR >= 0 ? `+${currentReturnR.toFixed(2)} R` : `${currentReturnR.toFixed(2)} R`}
            </div>
            <span className="font-mono text-[10px] text-chrome-dim mt-0.5">
              {isLiveMode
                ? `Net: ${dynamicNetProfit >= 0 ? `+₹${dynamicNetProfit.toFixed(2)}` : `-₹${Math.abs(dynamicNetProfit).toFixed(2)}`} (Fees: ₹${dynamicTotalFees.toFixed(2)})`
                : (isAll ? `₹${resolved.allocatedCapitalINR.toLocaleString("en-IN")} Allocated across 7 Assets` : `Dedicated ₹${resolved.allocatedCapitalINR.toLocaleString("en-IN")} Capital for ${selectedAsset}`)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PaperOnlyBanner;
