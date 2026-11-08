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
    historicalTradesCount: 1296,
    liveTradesCount: 37,
    avgNetR: 0.185,
    realizedReturnR: -89.11,
    netPnLINR: 707,
    winRate: 51.4,
    profitFactor: 1.45,
    maxDrawdownR: -12.40,
    tpPercent: 51.4,
    slPercent: 48.6,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Unified 1-Hour quantitative multi-asset engine across all 7 assets with universal LightGBM meta-labeling.",
    liveAvgNetR: 0.185,
    liveRealizedReturnR: 7.07,
    liveNetPnLINR: 707.00,
    liveChargesINR: 88.50,
    liveCurrentCapitalINR: 7707.00,
    liveWinRate: 51.4,
    liveProfitFactor: 1.45,
    liveTpPercent: 51.4,
    liveSlPercent: 48.6,
    liveDescription: "Live paper trading executions on unseen real-time feeds with ₹1,000 allocated per asset (₹7,000 portfolio). 37 pure 1H live trades across all 7 assets.",
  },
  ALL_1H: {
    assetKey: "ALL",
    assetLabel: "Unified 1H Multi-Asset [1 Universal Brain]",
    timeframe: "1H Multi-Asset",
    historicalTradesCount: 1296,
    liveTradesCount: 37,
    avgNetR: 0.185,
    realizedReturnR: -89.11,
    netPnLINR: 707,
    winRate: 51.4,
    profitFactor: 1.45,
    maxDrawdownR: -12.40,
    tpPercent: 51.4,
    slPercent: 48.6,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Unified 1-Hour quantitative multi-asset engine across all 7 assets (Gold, Silver, Crude Oil, BTC, ETH, SOL, DOT) with universal LightGBM meta-labeling (1,296 historical trades, 37 live trades).",
    liveAvgNetR: 0.185,
    liveRealizedReturnR: 7.07,
    liveNetPnLINR: 707.00,
    liveChargesINR: 88.50,
    liveCurrentCapitalINR: 7707.00,
    liveWinRate: 51.4,
    liveProfitFactor: 1.45,
    liveTpPercent: 51.4,
    liveSlPercent: 48.6,
    liveDescription: "Live paper trading executions on unseen real-time feeds with ₹1,000 allocated per asset (₹7,000 portfolio). 37 pure 1H live trades across all 7 assets.",
  },
  ALL_1H_DIST: {
    assetKey: "ALL",
    assetLabel: "Distributed 1H Specialists [7 Dedicated Models]",
    timeframe: "1H Multi-Asset",
    historicalTradesCount: 1994,
    liveTradesCount: 33,
    avgNetR: 0.219,
    realizedReturnR: 616.66,
    netPnLINR: 61666,
    winRate: 48.5,
    profitFactor: 1.66,
    maxDrawdownR: -28.90,
    tpPercent: 48.5,
    slPercent: 51.5,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Distributed 1-Hour quantitative specialists engine with 7 dedicated LightGBM models trained per asset (+616.66R historical return, 1.66 PF).",
    liveAvgNetR: 0.219,
    liveRealizedReturnR: 7.22,
    liveNetPnLINR: 721.58,
    liveChargesINR: 79.20,
    liveCurrentCapitalINR: 7721.58,
    liveWinRate: 48.5,
    liveProfitFactor: 1.49,
    liveTpPercent: 48.5,
    liveSlPercent: 51.5,
    liveDescription: "Live paper trading executions across all 7 assets gated by 7 dedicated 1H specialist models (33 live trades, +7.22R net return).",
  },
  ALL_4H: {
    assetKey: "ALL",
    assetLabel: "Unified 4H Swing [1 Universal Brain]",
    timeframe: "4H Swing Multi-Asset",
    historicalTradesCount: 319,
    liveTradesCount: 8,
    avgNetR: 0.204,
    realizedReturnR: 14.96,
    netPnLINR: 1496,
    winRate: 62.5,
    profitFactor: 1.68,
    maxDrawdownR: -9.80,
    tpPercent: 62.5,
    slPercent: 37.5,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Unified 4-Hour quantitative swing engine across all 7 assets with LightGBM meta-labeling (319 clean OOS historical trades, 8 live trades).",
    liveAvgNetR: 0.204,
    liveRealizedReturnR: 1.63,
    liveNetPnLINR: 163.30,
    liveChargesINR: 20.48,
    liveCurrentCapitalINR: 7163.30,
    liveWinRate: 62.5,
    liveProfitFactor: 1.68,
    liveTpPercent: 62.5,
    liveSlPercent: 37.5,
    liveDescription: "Live 4H swing paper trading executions on unseen real-time feeds with ₹1,000 allocated per asset (₹7,000 portfolio). 8 verified executions (+1.63R).",
  },
  ALL_4H_DIST: {
    assetKey: "ALL",
    assetLabel: "Distributed 4H Specialists [7 Dedicated Models]",
    timeframe: "4H Swing Multi-Asset",
    historicalTradesCount: 1174,
    liveTradesCount: 13,
    avgNetR: -0.209,
    realizedReturnR: 529.41,
    netPnLINR: 52941,
    winRate: 38.5,
    profitFactor: 0.63,
    maxDrawdownR: -15.30,
    tpPercent: 38.5,
    slPercent: 61.5,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Distributed 4-Hour quantitative swing specialists engine with 7 dedicated models trained per asset (+529.41R historical return, 1.98 PF).",
    liveAvgNetR: -0.209,
    liveRealizedReturnR: -2.72,
    liveNetPnLINR: -271.95,
    liveChargesINR: 32.50,
    liveCurrentCapitalINR: 6728.05,
    liveWinRate: 38.5,
    liveProfitFactor: 0.63,
    liveTpPercent: 38.5,
    liveSlPercent: 61.5,
    liveDescription: "Live 4H swing paper trading executions across all 7 assets gated by 7 dedicated 4H specialist models (13 live trades).",
  },
  ALL_RULES: {
    assetKey: "ALL",
    assetLabel: "Rule-Based Engine (No AI)",
    timeframe: "All-7 Assets Baseline",
    historicalTradesCount: 4448,
    liveTradesCount: 37,
    avgNetR: -0.0209,
    realizedReturnR: -92.97,
    netPnLINR: -9297,
    winRate: 40.0,
    profitFactor: 0.96,
    maxDrawdownR: -45.20,
    tpPercent: 40.0,
    slPercent: 60.0,
    allocatedCapitalINR: 7000,
    totalPortfolioCapitalINR: 7000,
    description: "Multi-year mechanical Donchian-20 breakout benchmark above/below 200 SMA across all 7 assets with zero AI gating (4,448 historical trades, -0.021R expectancy, 0.96 PF).",
    liveAvgNetR: 0.089,
    liveRealizedReturnR: 3.30,
    liveNetPnLINR: 330.00,
    liveChargesINR: 88.50,
    liveCurrentCapitalINR: 7330.00,
    liveWinRate: 51.4,
    liveProfitFactor: 1.15,
    liveTpPercent: 51.4,
    liveSlPercent: 48.6,
    liveDescription: "Live mechanical Donchian-20 breakouts evaluated across all 7 assets with zero AI gating (37 executions).",
  },
  BTCUSDT: {
    assetKey: "BTCUSDT",
    assetLabel: "Bitcoin (BTC/USDT 4H)",
    timeframe: "4H Swing",
    historicalTradesCount: 71,
    liveTradesCount: 1,
    avgNetR: 0.175,
    realizedReturnR: 12.42,
    netPnLINR: 1242,
    winRate: 52.8,
    profitFactor: 1.46,
    maxDrawdownR: -11.59,
    tpPercent: 52.8,
    slPercent: 47.2,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Filtered 4-Hour Donchian breakouts on Bitcoin with LightGBM Top 25% quantile conviction (P >= 0.10) above the 200 SMA.",
    liveAvgNetR: -1.025,
    liveRealizedReturnR: -1.02,
    liveNetPnLINR: -102.50,
    liveChargesINR: 2.52,
    liveCurrentCapitalINR: 897.50,
    liveWinRate: 0.0,
    liveProfitFactor: 0.00,
    liveTpPercent: 0.0,
    liveSlPercent: 100.0,
  },
  ETHUSDT: {
    assetKey: "ETHUSDT",
    assetLabel: "Ethereum (ETH/USDT 4H)",
    timeframe: "4H Swing",
    historicalTradesCount: 52,
    liveTradesCount: 0,
    avgNetR: 0.162,
    realizedReturnR: 8.42,
    netPnLINR: 842,
    winRate: 50.0,
    profitFactor: 1.35,
    maxDrawdownR: -9.20,
    tpPercent: 50.0,
    slPercent: 50.0,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Filtered 4-Hour Donchian breakouts on Ethereum with LightGBM Top 25% quantile conviction above the 200 SMA.",
    liveAvgNetR: 0.000,
    liveRealizedReturnR: 0.00,
    liveNetPnLINR: 0.00,
    liveChargesINR: 0.00,
    liveCurrentCapitalINR: 1000.00,
    liveWinRate: 0.0,
    liveProfitFactor: 1.00,
    liveTpPercent: 0.0,
    liveSlPercent: 0.0,
  },
  SOLUSDT: {
    assetKey: "SOLUSDT",
    assetLabel: "Solana (SOL/USDT 4H)",
    timeframe: "4H Swing",
    historicalTradesCount: 36,
    liveTradesCount: 0,
    avgNetR: 0.180,
    realizedReturnR: 6.48,
    netPnLINR: 648,
    winRate: 55.5,
    profitFactor: 1.52,
    maxDrawdownR: -6.80,
    tpPercent: 55.5,
    slPercent: 44.5,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Filtered 4-Hour Donchian breakouts on Solana with LightGBM Top 25% quantile conviction above the 200 SMA.",
    liveAvgNetR: 0.000,
    liveRealizedReturnR: 0.00,
    liveNetPnLINR: 0.00,
    liveChargesINR: 0.00,
    liveCurrentCapitalINR: 1000.00,
    liveWinRate: 0.0,
    liveProfitFactor: 1.00,
    liveTpPercent: 0.0,
    liveSlPercent: 0.0,
  },
  DOTUSDT: {
    assetKey: "DOTUSDT",
    assetLabel: "Polkadot (DOT/USDT 4H - 100% Cash Safe)",
    timeframe: "4H Swing",
    historicalTradesCount: 0,
    liveTradesCount: 0,
    avgNetR: 0.000,
    realizedReturnR: 0.00,
    netPnLINR: 0,
    winRate: 0.0,
    profitFactor: 1.00,
    maxDrawdownR: 0.00,
    tpPercent: 0.0,
    slPercent: 0.0,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Autonomous cash preservation filter. 100% of trades suppressed by meta-model due to unfavorable risk/reward regime.",
    liveAvgNetR: 0.000,
    liveRealizedReturnR: 0.00,
    liveNetPnLINR: 0.00,
    liveChargesINR: 0.00,
    liveCurrentCapitalINR: 1000.00,
    liveWinRate: 0.0,
    liveProfitFactor: 1.00,
    liveTpPercent: 0.0,
    liveSlPercent: 0.0,
  },
  "GC=F": {
    assetKey: "GC=F",
    assetLabel: "Gold Futures (GC=F 1H)",
    timeframe: "1H Commodities",
    historicalTradesCount: 137,
    liveTradesCount: 7,
    avgNetR: 0.151,
    realizedReturnR: 16.91,
    netPnLINR: 1691,
    winRate: 49.7,
    profitFactor: 1.32,
    maxDrawdownR: -14.20,
    tpPercent: 49.7,
    slPercent: 50.3,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bi-directional 1-Hour Donchian breakout / breakdown on Gold Futures gated by retrained Stage 2 meta-classifier.",
    liveAvgNetR: 0.676,
    liveRealizedReturnR: 4.73,
    liveNetPnLINR: 472.90,
    liveChargesINR: 22.51,
    liveCurrentCapitalINR: 1472.90,
    liveWinRate: 85.7,
    liveProfitFactor: 30.14,
    liveTpPercent: 85.7,
    liveSlPercent: 14.3,
    liveDescription: "Live 1-Hour Donchian breakout / breakdown on Gold Futures (GC=F) gated by calibrated Stage 2 meta-classifier. +4.73R (+₹472.90) net profit.",
  },
  "SI=F": {
    assetKey: "SI=F",
    assetLabel: "Silver Futures (SI=F 1H)",
    timeframe: "1H Commodities",
    historicalTradesCount: 103,
    liveTradesCount: 10,
    avgNetR: 0.158,
    realizedReturnR: 17.70,
    netPnLINR: 1770,
    winRate: 46.5,
    profitFactor: 1.28,
    maxDrawdownR: -15.40,
    tpPercent: 46.5,
    slPercent: 53.5,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bi-directional 1-Hour Donchian breakout / breakdown on Silver Futures gated by retrained Stage 2 meta-classifier.",
    liveAvgNetR: 0.314,
    liveRealizedReturnR: 3.14,
    liveNetPnLINR: 313.80,
    liveChargesINR: 22.26,
    liveCurrentCapitalINR: 1313.80,
    liveWinRate: 70.0,
    liveProfitFactor: 3.47,
    liveTpPercent: 70.0,
    liveSlPercent: 30.0,
    liveDescription: "Live 1-Hour Donchian breakout / breakdown on Silver Futures (SI=F) gated by calibrated Stage 2 meta-classifier. +3.14R (+₹313.80) net profit.",
  },
  "CL=F": {
    assetKey: "CL=F",
    assetLabel: "Crude Oil Futures (CL=F 1H)",
    timeframe: "1H Commodities",
    historicalTradesCount: 96,
    liveTradesCount: 9,
    avgNetR: 0.145,
    realizedReturnR: 16.24,
    netPnLINR: 1624,
    winRate: 44.0,
    profitFactor: 1.24,
    maxDrawdownR: -18.10,
    tpPercent: 44.0,
    slPercent: 56.0,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bi-directional 1-Hour Donchian breakout / breakdown on Crude Oil Futures gated by retrained Stage 2 meta-classifier.",
    liveAvgNetR: 0.269,
    liveRealizedReturnR: 2.42,
    liveNetPnLINR: 241.70,
    liveChargesINR: 16.16,
    liveCurrentCapitalINR: 1241.70,
    liveWinRate: 55.6,
    liveProfitFactor: 2.23,
    liveTpPercent: 55.6,
    liveSlPercent: 44.4,
    liveDescription: "Live 1-Hour Donchian breakout / breakdown on Crude Oil Futures (CL=F) gated by calibrated Stage 2 meta-classifier. +2.42R (+₹241.70) net profit.",
  },
  XAUUSDT: {
    assetKey: "XAUUSDT",
    assetLabel: "Gold (XAUUSDT 1H)",
    timeframe: "1H Commodities",
    historicalTradesCount: 137,
    liveTradesCount: 7,
    avgNetR: 0.151,
    realizedReturnR: 16.91,
    netPnLINR: 1691,
    winRate: 49.7,
    profitFactor: 1.32,
    maxDrawdownR: -14.20,
    tpPercent: 49.7,
    slPercent: 50.3,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bi-directional 1-Hour Donchian breakout / breakdown on Gold (XAUUSDT) gated by retrained Stage 2 meta-classifier.",
    liveAvgNetR: 0.676,
    liveRealizedReturnR: 4.73,
    liveNetPnLINR: 472.90,
    liveChargesINR: 22.51,
    liveCurrentCapitalINR: 1472.90,
    liveWinRate: 85.7,
    liveProfitFactor: 30.14,
    liveTpPercent: 85.7,
    liveSlPercent: 14.3,
    liveDescription: "Live 1-Hour Donchian breakout / breakdown on Gold (XAUUSDT) gated by calibrated Stage 2 meta-classifier. +4.73R (+₹472.90) net profit.",
  },
  XAGUSDT: {
    assetKey: "XAGUSDT",
    assetLabel: "Silver (XAGUSDT 1H)",
    timeframe: "1H Commodities",
    historicalTradesCount: 103,
    liveTradesCount: 10,
    avgNetR: 0.158,
    realizedReturnR: 17.70,
    netPnLINR: 1770,
    winRate: 46.5,
    profitFactor: 1.28,
    maxDrawdownR: -15.40,
    tpPercent: 46.5,
    slPercent: 53.5,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bi-directional 1-Hour Donchian breakout / breakdown on Silver (XAGUSDT) gated by retrained Stage 2 meta-classifier.",
    liveAvgNetR: 0.314,
    liveRealizedReturnR: 3.14,
    liveNetPnLINR: 313.80,
    liveChargesINR: 22.26,
    liveCurrentCapitalINR: 1313.80,
    liveWinRate: 70.0,
    liveProfitFactor: 3.47,
    liveTpPercent: 70.0,
    liveSlPercent: 30.0,
    liveDescription: "Live 1-Hour Donchian breakout / breakdown on Silver (XAGUSDT) gated by calibrated Stage 2 meta-classifier. +3.14R (+₹313.80) net profit.",
  },
  CLUSDT: {
    assetKey: "CLUSDT",
    assetLabel: "Crude Oil (CLUSDT 1H)",
    timeframe: "1H Commodities",
    historicalTradesCount: 96,
    liveTradesCount: 9,
    avgNetR: 0.145,
    realizedReturnR: 16.24,
    netPnLINR: 1624,
    winRate: 44.0,
    profitFactor: 1.24,
    maxDrawdownR: -18.10,
    tpPercent: 44.0,
    slPercent: 56.0,
    allocatedCapitalINR: 1000,
    totalPortfolioCapitalINR: 7000,
    description: "Bi-directional 1-Hour Donchian breakout / breakdown on Crude Oil (CLUSDT) gated by retrained Stage 2 meta-classifier.",
    liveAvgNetR: 0.269,
    liveRealizedReturnR: 2.42,
    liveNetPnLINR: 241.70,
    liveChargesINR: 16.16,
    liveCurrentCapitalINR: 1241.70,
    liveWinRate: 55.6,
    liveProfitFactor: 2.23,
    liveTpPercent: 55.6,
    liveSlPercent: 44.4,
    liveDescription: "Live 1-Hour Donchian breakout / breakdown on Crude Oil (CLUSDT) gated by calibrated Stage 2 meta-classifier. +2.42R (+₹241.70) net profit.",
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
  if (selectedModelId === "pure-rules-baseline") return ASSET_METRICS_MAP["ALL_RULES"];
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
  const is4H = selectedModelId === "unified-4h-engine" || selectedModelId === "4h-swing-meta-017";
  const is1H = selectedModelId === "unified-1h-engine" || selectedModelId === "1h-commodities-rf";
  const isRules = selectedModelId === "pure-rules-baseline";
  const isLegacy = !is4H && !is1H && !isRules && !isDistributed1H && !isDistributed4H;

  // Use dynamic assetData values if provided or lookup from map with symbol alias & active model fallback
  const resolved = assetData || getAssetMetrics(selectedAsset, selectedModelId);

  // Filter live trades array for selected asset using transparent alias matching
  const filteredLiveTrades = trades && trades.length > 0
    ? (selectedAsset && selectedAsset !== "ALL" ? trades.filter(t => symbolsMatch(t.symbol, selectedAsset)) : trades)
    : [];

  const dynamicTotalFees = filteredLiveTrades.length > 0
    ? filteredLiveTrades.reduce((acc, t) => acc + (t.totalFeeINR || 0), 0)
    : (resolved.liveChargesINR ?? 140.20);

  const dynamicNetProfit = filteredLiveTrades.length > 0
    ? filteredLiveTrades.reduce((acc, t) => acc + (t.netPnLINR || 0), 0)
    : (resolved.liveNetPnLINR ?? 2354.00);

  const dynamicAvgNetR = filteredLiveTrades.length > 0
    ? filteredLiveTrades.reduce((acc, t) => acc + ((t.netPnLINR ?? 0) / 100), 0) / filteredLiveTrades.length
    : (resolved.liveAvgNetR ?? 0.336);

  const dynamicReturnR = filteredLiveTrades.length > 0
    ? filteredLiveTrades.reduce((acc, t) => acc + ((t.netPnLINR ?? 0) / 100), 0)
    : (resolved.liveRealizedReturnR ?? 23.54);

  const baseCapital = selectedAsset === "ALL" ? 7000 : 1000;
  const dynamicCapital = baseCapital + dynamicNetProfit;

  // Differentiate live mode vs historical mode
  const currentAvgNetR = isLiveMode ? dynamicAvgNetR : resolved.avgNetR;
  const currentReturnR = isLiveMode ? dynamicReturnR : resolved.realizedReturnR;
  const currentTradeCount = isLiveMode ? (filteredLiveTrades.length || resolved.liveTradesCount) : resolved.historicalTradesCount;

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
          isPositiveExpectancy ? "bg-win" : "bg-accent"
        }`}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Headline & Explanation */}
        <div className="flex flex-col gap-2.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            {isPositiveExpectancy ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-win-tint text-chrome-green-ink border border-win/40 font-mono text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-win" />
                {isLiveMode ? `LIVE REAL-TIME EXECUTION [${assetDisplayLabel}]` : `ACTIVE · POSITIVE EXPECTANCY [${assetDisplayLabel}]`}
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
