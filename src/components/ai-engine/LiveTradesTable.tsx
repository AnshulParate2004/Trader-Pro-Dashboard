"use client";
import { toDisplaySymbol, toDisplayName } from "@/lib/symbolMapper";

import React from "react";
import { useRouter } from "next/navigation";
import { TradeOrder, TOP_MODELS, ALL_MODELS } from "@/lib/engineTypes";
import {
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Layers,
  Target,
  ExternalLink,
} from "lucide-react";

interface LiveTradesTableProps {
  trades: TradeOrder[];
  filteredLiveTrades: TradeOrder[];
  livePredictionLogs?: any[];
  tableTab: "live" | "historical" | "all_historical";
  setTableTab: (tab: "live" | "historical" | "all_historical") => void;
  liveSideFilter: "ALL" | "LONG" | "SHORT";
  setLiveSideFilter: (filter: "ALL" | "LONG" | "SHORT") => void;
  liveSymbolFilter?: string;
  setLiveSymbolFilter?: (filter: string) => void;
  liveLimit: number;
  onLiveLimitChange: (limit: number) => void;
  historicalTrades: any[];
  totalHistoricalCount: number;
  isLoadingHistorical: boolean;
  histPage: number;
  histLimit: number;
  histSideFilter: "ALL" | "LONG" | "SHORT";
  histOutcomeFilter: string;
  histSymbolFilter?: string;
  handleHistSymbolChange?: (symbol: string) => void;
  histTotalPages: number;
  handleHistPageChange: (newPage: number) => void;
  handleHistLimitChange: (newLimit: number) => void;
  handleHistSideChange: (newSide: "ALL" | "LONG" | "SHORT") => void;
  handleHistOutcomeChange: (newOutcome: string) => void;
  handleCloseTrade: (tradeId: string, entryPrice: number, dir: "LONG" | "SHORT") => void;
  onInspectTrade?: (trade: any) => void;
  totalLiveCount?: number;
  isTaker?: boolean;
  feePercent?: number;
  selectedAsset?: string;
  onAssetChange?: (asset: string) => void;
  selectedModelId?: string;
  // All Historical Transactions (2020-2026/10/20) Props
  allHistoricalTrades?: any[];
  totalAllHistoricalCount?: number;
  isLoadingAllHistorical?: boolean;
  allHistPage?: number;
  allHistLimit?: number;
  allHistSideFilter?: "ALL" | "LONG" | "SHORT";
  allHistOutcomeFilter?: string;
  allHistTotalPages?: number;
  handleAllHistPageChange?: (newPage: number) => void;
  handleAllHistLimitChange?: (newLimit: number) => void;
  handleAllHistSideChange?: (newSide: "ALL" | "LONG" | "SHORT") => void;
  handleAllHistOutcomeChange?: (newOutcome: string) => void;
  allHistMetrics?: any;
}

export const LiveTradesTable: React.FC<LiveTradesTableProps> = ({
  trades,
  filteredLiveTrades,
  livePredictionLogs = [],
  tableTab,
  setTableTab,
  liveSideFilter,
  setLiveSideFilter,
  liveSymbolFilter = "ALL",
  setLiveSymbolFilter,
  liveLimit,
  onLiveLimitChange,
  historicalTrades,
  totalHistoricalCount,
  isLoadingHistorical,
  histPage,
  histLimit,
  histSideFilter,
  histOutcomeFilter,
  histSymbolFilter = "ALL",
  handleHistSymbolChange,
  histTotalPages,
  handleHistPageChange,
  handleHistLimitChange,
  handleHistSideChange,
  handleHistOutcomeChange,
  handleCloseTrade,
  onInspectTrade,
  totalLiveCount,
  isTaker = true,
  feePercent = 0.040,
  selectedAsset = "ALL",
  onAssetChange,
  selectedModelId = "om-distributed-4h-engine",
  allHistoricalTrades = [],
  totalAllHistoricalCount = 0,
  isLoadingAllHistorical = false,
  allHistPage = 1,
  allHistLimit = 50,
  allHistSideFilter = "ALL",
  allHistOutcomeFilter = "ALL",
  allHistTotalPages = 1,
  handleAllHistPageChange,
  handleAllHistLimitChange,
  handleAllHistSideChange,
  handleAllHistOutcomeChange,
  allHistMetrics = null,
}) => {
  const activeModelMeta = ALL_MODELS.find((m) => m.id === selectedModelId) || TOP_MODELS.find((m) => m.id === selectedModelId);
  const getFallbackCount = (mId: string) => {
    switch (mId) {
      case "4hr-timeframe-router": return "622";
      case "om-distributed-4h-engine": return "364";
      case "om-stacking-meta-engine": return "1,315";
      case "option-a-1h-hand-written": return "0";
      case "om-distributed-1h-engine": return "1,369";
      case "om-unified-1h-engine": return "1,414";
      case "om-consensus-committee-engine": return "811";
      case "om-unified-4h-engine": return "196";
      case "v1-distributed-4h-engine": return "336";
      case "v1-stacking-meta-engine": return "1,669";
      case "v1-distributed-1h-engine": return "1,659";
      case "v1-unified-1h-engine": return "2,527";
      case "v1-consensus-committee-engine": return "1,404";
      case "v1-unified-4h-engine": return "53";
      case "unified-4h-engine":
      case "4h-swing-meta-017": return "511";
      case "distributed-4h-engine": return "1,086";
      case "new-consensus-committee-engine": return "3,381";
      case "new-stacking-meta-engine": return "3,678";
      case "distributed-1h-engine": return "4,376";
      case "pure-rules-4h-baseline": return "2,005";
      case "pure-rules-1h-baseline":
      case "pure-rules-baseline": return "6,217";
      default: return "4,403";
    }
  };

  const getDisplayModelName = (t: TradeOrder) => {
    if (selectedModelId === "4hr-timeframe-router") {
      const sym = t.symbol || t.rawSymbol;
      const routed = (t as any).routedEngine;
      if (routed === "fixed_4h_clamp_btc_eth" || sym === "ETHUSDT") return "4H Clamp";
      if (routed === "om-unified-4h-engine" || sym === "DOTUSDT") return "4H Unified";
      if (routed === "distributed-4h-engine" || sym === "XAGUSDT") return "4H Spec (New)";
      if (routed === "om-distributed-4h-engine") return "4H Spec (OM)";
      return "4H Router";
    }
    if (selectedModelId === "option-a-1h-hand-written") return "Option A (1H)";
    if (selectedModelId === "om-distributed-4h-engine") return "OM 4H Spec";
    if (selectedModelId === "om-stacking-meta-engine") return "OM Stacking";
    if (selectedModelId === "om-distributed-1h-engine") return "OM 1H Spec";
    if (selectedModelId === "om-unified-1h-engine") return "OM 1H Uni";
    if (selectedModelId === "om-consensus-committee-engine") return "OM Consensus";
    if (selectedModelId === "om-unified-4h-engine") return "OM 4H Uni";
    if (selectedModelId === "v1-distributed-4h-engine") return "v1 4H Spec";
    if (selectedModelId === "v1-stacking-meta-engine") return "v1 Stacking";
    if (selectedModelId === "v1-distributed-1h-engine") return "v1 1H Spec";
    if (selectedModelId === "v1-unified-1h-engine") return "v1 1H Uni";
    if (selectedModelId === "v1-consensus-committee-engine") return "v1 Consensus";
    if (selectedModelId === "v1-unified-4h-engine") return "v1 4H Uni";
    if (selectedModelId === "new-consensus-committee-engine") return "New Consensus";
    if (selectedModelId === "new-stacking-meta-engine") return "New Stacking";
    if (selectedModelId === "distributed-4h-engine") return "New 4H Spec";
    if (selectedModelId === "distributed-1h-engine") return "New 1H Spec";
    if (selectedModelId === "unified-4h-engine" || selectedModelId === "4h-swing-meta-017") return "New 4H Uni";
    if (selectedModelId === "pure-rules-4h-baseline") return "4H Rules";
    if (selectedModelId === "pure-rules-1h-baseline" || selectedModelId === "pure-rules-baseline") return "1H Rules";
    if (t.modelName && !t.modelName.includes("4H Swing Meta")) return t.modelName.slice(0, 14);
    return "Unified 1H";
  };

  const router = useRouter();

  const handleInspect = (trade: any) => {
    if (onInspectTrade) {
      onInspectTrade(trade);
    } else {
      const sym = trade.symbol || trade.rawSymbol || "BTCUSDT";
      const tradeId = trade.id || trade.trade_id || "";
      router.push(
        `/terminal?symbol=${encodeURIComponent(sym)}&tradeId=${encodeURIComponent(tradeId)}&modelId=${encodeURIComponent(selectedModelId || "4hr-timeframe-router")}`
      );
    }
  };
  // Live Prediction Logs Filter & Pagination State
  const [logAssetFilter, setLogAssetFilter] = React.useState<"ALL" | "crypto" | "commodities">("ALL");
  const [logDecisionFilter, setLogDecisionFilter] = React.useState<"ALL" | "EXECUTED_TRADE" | "CASH_PROTECTED_BEARISH" | "CASH_PROTECTED_CONSOLIDATION" | "CASH_PROTECTED_POSITION_ACTIVE">("ALL");
  const [logPage, setLogPage] = React.useState<number>(1);
  const [logLimit, setLogLimit] = React.useState<number>(25);

  const filteredLogs = React.useMemo(() => {
    return (livePredictionLogs || []).filter((log: any) => {
      if (logAssetFilter !== "ALL" && log.asset_class !== logAssetFilter) return false;
      if (logDecisionFilter !== "ALL") {
        if (logDecisionFilter === "EXECUTED_TRADE") {
          if (log.decision !== "EXECUTED_TRADE") return false;
        } else if (logDecisionFilter === "CASH_PROTECTED_BEARISH") {
          const isBearish = log.decision === "CASH_PROTECTED_BEARISH" || log.decision === "CASH_SHIELD" || log.regime === "BEARISH" || (log.price < log.sma_200);
          if (!isBearish) return false;
        } else if (logDecisionFilter === "CASH_PROTECTED_CONSOLIDATION") {
          if (log.decision !== "CASH_PROTECTED_CONSOLIDATION" && log.decision !== "CASH_SAFE" && log.decision !== "GATE_BLOCKED") return false;
        }
      }
      return true;
    });
  }, [livePredictionLogs, logAssetFilter, logDecisionFilter]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / logLimit));
  const paginatedLogs = filteredLogs.slice((logPage - 1) * logLimit, logPage * logLimit);
  // Prediction Feed View Mode: "snapshot" (7 latest assets) vs "feed" (all chronological bars)
  const [feedViewMode, setFeedViewMode] = React.useState<"snapshot" | "feed">("snapshot");

  const snapshotLogs = React.useMemo(() => {
    const symbolOrder = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT", "XAUUSDT", "XAGUSDT", "CLUSDT"];
    const latestBySymbol = new Map<string, any>();
    for (const log of (livePredictionLogs || [])) {
      const disp = toDisplaySymbol(log.symbol || "");
      // Keep newest (first encountered) record
      if (!latestBySymbol.has(disp)) {
        latestBySymbol.set(disp, log);
      }
    }
    const result: any[] = [];
    for (const sym of symbolOrder) {
      if (latestBySymbol.has(sym)) {
        result.push(latestBySymbol.get(sym));
      }
    }
    latestBySymbol.forEach((log, sym) => {
      if (!symbolOrder.includes(sym)) {
        result.push(log);
      }
    });
    return result;
  }, [livePredictionLogs]);

  const displayedLogs = feedViewMode === "snapshot" ? snapshotLogs : paginatedLogs;
  // Compute running balance curve starting from ₹7,000 portfolio baseline
  const BASE_CAPITAL = 7000.00;
  const balanceMap = React.useMemo(() => {
    let running = BASE_CAPITAL;
    const map = new Map<string, number>();
    // Iterate chronologically (oldest trade first)
    const chronological = [...trades].reverse();
    for (const t of chronological) {
      running += (t.netPnLINR || 0);
      map.set(t.id, Number(running.toFixed(2)));
    }
    return map;
  }, [trades]);

  const liveTradesWithBalance = React.useMemo(() => {
    return filteredLiveTrades.map((t) => ({
      ...t,
      runningBalanceINR: balanceMap.get(t.id) ?? Number((BASE_CAPITAL + (t.netPnLINR || 0)).toFixed(2)),
    }));
  }, [filteredLiveTrades, balanceMap]);

  return (
    <section
      aria-label="Trade Execution Logs"
      className="w-full bg-white border border-chrome-line rounded-lg overflow-hidden shadow-xs flex flex-col"
    >
      {/* Top Header & Tab Buttons */}
      <div className="p-3 sm:p-4 border-b border-chrome-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-chrome-field">
        <div className="flex items-center gap-2">
          <div className="flex bg-chrome-line/40 p-0.5 rounded-md font-mono text-xs">
            <button
              onClick={() => setTableTab("live")}
              className={`px-3 py-1.5 rounded font-bold transition-all cursor-pointer ${
                tableTab === "live"
                  ? "bg-white text-chrome-ink shadow-xs"
                  : "text-chrome-dim hover:text-chrome-ink"
              }`}
            >
              🟢 Live Trades ({selectedAsset !== "ALL" ? `${filteredLiveTrades.length}/${trades.length}` : trades.length})
            </button>
            <button
              onClick={() => setTableTab("historical")}
              className={`px-3 py-1.5 rounded font-bold transition-all cursor-pointer ${
                tableTab === "historical"
                  ? "bg-white text-chrome-ink shadow-xs"
                  : "text-chrome-dim hover:text-chrome-ink"
              }`}
            >
              📊 Unseen Trades ({totalHistoricalCount ? totalHistoricalCount.toLocaleString() : (selectedAsset === "ALL" ? getFallbackCount(selectedModelId) : "0")})
            </button>
            <button
              onClick={() => setTableTab("all_historical")}
              className={`px-3 py-1.5 rounded font-bold transition-all cursor-pointer ${
                tableTab === "all_historical"
                  ? "bg-white text-chrome-ink shadow-xs"
                  : "text-chrome-dim hover:text-chrome-ink"
              }`}
            >
              📜 Historical Transactions (2020 - 2026/10/20) ({totalAllHistoricalCount ? totalAllHistoricalCount.toLocaleString() : (allHistMetrics?.totalTrades ? allHistMetrics.totalTrades.toLocaleString() : "...")})
            </button>
          </div>
        </div>

        <div className="text-xs text-chrome-dim font-mono">
          {tableTab === "all_historical"
            ? `All Historical Transactions (2020-01-01 to 2026-10-20 | 6-Year Complete Processing on ₹7,000 Capital | ${activeModelMeta?.name || selectedModelId})`
            : tableTab === "live"
            ? selectedModelId === "om-distributed-4h-engine"
              ? "[OM] Distributed 4H Specialists (Train 2020-2023 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "om-stacking-meta-engine"
              ? "[OM] Stacking Meta-Learner (Train 2020-2023 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "om-distributed-1h-engine"
              ? "[OM] Distributed 1H Specialists (Train 2020-2023 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "om-unified-1h-engine"
              ? "[OM] Unified 1H Multi-Asset (Train 2020-2023 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "om-consensus-committee-engine"
              ? "[OM] Consensus Committee (Train 2020-2023 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "om-unified-4h-engine"
              ? "[OM] Unified 4H Swing (Train 2020-2023 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "v1-distributed-4h-engine"
              ? "[v1] Distributed 4H Specialists (Train 2020-2023 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "v1-stacking-meta-engine"
              ? "[v1] Stacking Meta-Learner (Train 2020-2023 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "v1-distributed-1h-engine"
              ? "[v1] Distributed 1H Specialists (Train 2020-2023 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "v1-unified-1h-engine"
              ? "[v1] Unified 1H Multi-Asset (Train 2020-2023 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "v1-consensus-committee-engine"
              ? "[v1] Consensus Committee (Train 2020-2023 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "v1-unified-4h-engine"
              ? "[v1] Unified 4H Swing (Train 2020-2023 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "new-consensus-committee-engine"
              ? "[New] Consensus Committee (Train 2024-2025 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "new-stacking-meta-engine"
              ? "[New] Stacking Meta-Learner (Train 2024-2025 | Forward Live: Oct 21 - Nov 07, 2026)"
              : selectedModelId === "distributed-1h-engine"
              ? "Distributed 1H Specialists Execution (7 Dedicated Models | Platform Friction Deducted)"
              : selectedModelId === "unified-4h-engine" || selectedModelId === "4h-swing-meta-017"
              ? "Unified 4H Swing Execution (7 Assets on 4-Hour Candles | Platform Friction Deducted)"
              : selectedModelId === "distributed-4h-engine"
              ? "Distributed 4H Specialists Swing Execution (7 Dedicated Models | Platform Friction Deducted)"
              : selectedModelId === "pure-rules-4h-baseline"
              ? "Pure Mechanical 4H Rules Execution (Zero AI Filter Benchmark | Platform Friction Deducted)"
              : selectedModelId === "pure-rules-baseline" || selectedModelId === "pure-rules-1h-baseline"
              ? "Pure Mechanical Rules Execution (Zero AI Filter Benchmark | Platform Friction Deducted)"
              : "Unified 1H Multi-Asset Execution (7 Assets on 1-Hour Candles | Platform Friction Deducted)"
            : selectedModelId.startsWith("om-")
              ? "Unseen Holdout Trades (2025-01-01 to 2026-10-20 | ~22-Month Out-Of-Sample Holdout)"
              : selectedModelId.startsWith("v1-")
              ? "Unseen Holdout Trades (2024-01-01 to 2025-12-31 | 2-Year Out-Of-Sample Holdout)"
              : "Unseen Holdout Trades (2020-01-01 to 2023-12-31 | 4-Year Out-Of-Sample Holdout)"}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="px-3 sm:px-4 py-2.5 bg-white border-b border-chrome-edge flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {tableTab === "all_historical" ? (
          <>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-chrome-dim font-bold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-chrome-dim" /> 6Yr Filters:
              </span>

              {/* Asset Filter */}
              <div className="flex items-center gap-1.5 bg-chrome-field border border-chrome-line rounded px-2.5 py-1">
                <span className="text-[11px] text-chrome-dim">Asset:</span>
                <select
                  value={selectedAsset}
                  onChange={(e) => onAssetChange && onAssetChange(e.target.value)}
                  aria-label="Filter historical transactions by asset"
                  className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Assets (7)</option>
                  <option value="BTCUSDT">BTCUSDT (Bitcoin)</option>
                  <option value="ETHUSDT">ETHUSDT (Ethereum)</option>
                  <option value="SOLUSDT">SOLUSDT (Solana)</option>
                  <option value="DOTUSDT">DOTUSDT (Polkadot)</option>
                  <option value="XAUUSDT">Gold (XAUUSDT)</option>
                  <option value="XAGUSDT">Silver (XAGUSDT)</option>
                  <option value="CLUSDT">Crude Oil (CLUSDT)</option>
                </select>
              </div>

              {/* Direction Filter */}
              <div className="flex items-center gap-1.5 bg-chrome-field border border-chrome-line rounded px-2.5 py-1">
                <span className="text-[11px] text-chrome-dim">Direction:</span>
                <select
                  value={allHistSideFilter}
                  onChange={(e) => handleAllHistSideChange && handleAllHistSideChange(e.target.value as any)}
                  aria-label="Filter historical transactions by direction"
                  className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Directions</option>
                  <option value="LONG">🟢 LONG Only</option>
                  <option value="SHORT">🔴 SHORT Only</option>
                </select>
              </div>

              {/* Outcome Filter */}
              <div className="flex items-center gap-1.5 bg-chrome-field border border-chrome-line rounded px-2.5 py-1">
                <span className="text-[11px] text-chrome-dim">Outcome:</span>
                <select
                  value={allHistOutcomeFilter}
                  onChange={(e) => handleAllHistOutcomeChange && handleAllHistOutcomeChange(e.target.value)}
                  aria-label="Filter historical transactions by outcome"
                  className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="TAKE_PROFIT">🎯 Take Profit (+2.5R)</option>
                  <option value="TIME_EXPIRY">⏱️ Time Barrier Exit</option>
                  <option value="STOP_LOSS">🛑 Stop Loss (-1.0R)</option>
                </select>
              </div>

              {/* Rows */}
              <div className="flex items-center gap-1.5 bg-chrome-field border border-chrome-line rounded px-2.5 py-1">
                <span className="text-[11px] text-chrome-dim">Rows:</span>
                <select
                  value={allHistLimit}
                  onChange={(e) => handleAllHistLimitChange && handleAllHistLimitChange(parseInt(e.target.value, 10))}
                  aria-label="Select rows per page"
                  className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                  <option value={250}>250 per page</option>
                  <option value={500}>500 per page</option>
                </select>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[11px] text-chrome-dim whitespace-nowrap">
                Page <strong className="text-chrome-ink">{allHistPage}</strong> of{" "}
                <strong className="text-chrome-ink">{allHistTotalPages}</strong> ({totalAllHistoricalCount.toLocaleString()} total)
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAllHistPageChange && handleAllHistPageChange(1)}
                  disabled={allHistPage <= 1 || isLoadingAllHistorical}
                  className="p-1.5 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="First Page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5 text-chrome-ink" />
                </button>
                <button
                  onClick={() => handleAllHistPageChange && handleAllHistPageChange(allHistPage - 1)}
                  disabled={allHistPage <= 1 || isLoadingAllHistorical}
                  className="p-1.5 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-chrome-ink" />
                </button>
                <span className="px-2 py-0.5 text-[11px] font-bold text-chrome-ink bg-chrome-field rounded border border-chrome-line">
                  {allHistPage}
                </span>
                <button
                  onClick={() => handleAllHistPageChange && handleAllHistPageChange(allHistPage + 1)}
                  disabled={allHistPage >= allHistTotalPages || isLoadingAllHistorical}
                  className="p-1.5 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-chrome-ink" />
                </button>
                <button
                  onClick={() => handleAllHistPageChange && handleAllHistPageChange(allHistTotalPages)}
                  disabled={allHistPage >= allHistTotalPages || isLoadingAllHistorical}
                  className="p-1.5 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="Last Page"
                >
                  <ChevronsRight className="w-3.5 h-3.5 text-chrome-ink" />
                </button>
              </div>
            </div>
          </>
        ) : tableTab === "historical" ? (
          <>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-chrome-dim font-bold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-chrome-dim" /> Filters:
              </span>

              {/* Asset/Symbol Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-chrome-field border border-chrome-line rounded px-2.5 py-1">
                <span className="text-[11px] text-chrome-dim">Asset:</span>
                <select
                  value={selectedAsset || histSymbolFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (handleHistSymbolChange) handleHistSymbolChange(val);
                    if (onAssetChange) onAssetChange(val);
                  }}
                  aria-label="Filter historical trades by asset"
                  className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Assets (7)</option>
                  <option value="BTCUSDT">BTCUSDT (Bitcoin)</option>
                  <option value="ETHUSDT">ETHUSDT (Ethereum)</option>
                  <option value="SOLUSDT">SOLUSDT (Solana)</option>
                  <option value="DOTUSDT">DOTUSDT (Polkadot)</option>
                  <option value="XAUUSDT">Gold (XAUUSDT)</option>
                  <option value="XAGUSDT">Silver (XAGUSDT)</option>
                  <option value="CLUSDT">Crude Oil (CLUSDT)</option>
                  <option value="GC=F">Gold (GC=F Alias)</option>
                  <option value="SI=F">Silver (SI=F Alias)</option>
                  <option value="CL=F">Crude Oil (CL=F Alias)</option>
                </select>
              </div>

              {/* Direction Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-chrome-field border border-chrome-line rounded px-2.5 py-1">
                <span className="text-[11px] text-chrome-dim">Direction:</span>
                <select
                  value={histSideFilter}
                  onChange={(e) => handleHistSideChange(e.target.value as any)}
                  aria-label="Filter historical trades by direction"
                  className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Directions</option>
                  <option value="LONG">🟢 LONG Only</option>
                  <option value="SHORT">🔴 SHORT Only</option>
                </select>
              </div>

              {/* Outcome Trigger Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-chrome-field border border-chrome-line rounded px-2.5 py-1">
                <span className="text-[11px] text-chrome-dim">Outcome:</span>
                <select
                  value={histOutcomeFilter}
                  onChange={(e) => handleHistOutcomeChange(e.target.value)}
                  aria-label="Filter historical trades by outcome"
                  className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="TAKE_PROFIT">🎯 Take Profit (+2.5R)</option>
                  <option value="TIME_EXPIRY">⏱️ Time Barrier Exit</option>
                  <option value="STOP_LOSS">🛑 Stop Loss (-1.0R)</option>
                </select>
              </div>

              {/* Rows Per Page Dropdown */}
              <div className="flex items-center gap-1.5 bg-chrome-field border border-chrome-line rounded px-2.5 py-1">
                <span className="text-[11px] text-chrome-dim">Rows:</span>
                <select
                  value={histLimit}
                  onChange={(e) => handleHistLimitChange(parseInt(e.target.value, 10))}
                  aria-label="Select rows per page for historical trades"
                  className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                  <option value={250}>250 per page</option>
                  <option value={500}>500 per page</option>
                </select>
              </div>
            </div>

            {/* Pagination controls top */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[11px] text-chrome-dim whitespace-nowrap">
                Page <strong className="text-chrome-ink">{histPage}</strong> of{" "}
                <strong className="text-chrome-ink">{histTotalPages}</strong> ({totalHistoricalCount.toLocaleString()} total)
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleHistPageChange(1)}
                  disabled={histPage <= 1 || isLoadingHistorical}
                  aria-label="Jump to first page"
                  className="p-1.5 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="First Page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5 text-chrome-ink" />
                </button>
                <button
                  onClick={() => handleHistPageChange(histPage - 1)}
                  disabled={histPage <= 1 || isLoadingHistorical}
                  aria-label="Previous page"
                  className="p-1.5 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-chrome-ink" />
                </button>
                <span className="px-2 py-0.5 text-[11px] font-bold text-chrome-ink bg-chrome-field rounded border border-chrome-line">
                  {histPage}
                </span>
                <button
                  onClick={() => handleHistPageChange(histPage + 1)}
                  disabled={histPage >= histTotalPages || isLoadingHistorical}
                  aria-label="Next page"
                  className="p-1.5 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-chrome-ink" />
                </button>
                <button
                  onClick={() => handleHistPageChange(histTotalPages)}
                  disabled={histPage >= histTotalPages || isLoadingHistorical}
                  aria-label="Jump to last page"
                  className="p-1.5 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="Last Page"
                >
                  <ChevronsRight className="w-3.5 h-3.5 text-chrome-ink" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-chrome-dim font-bold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-chrome-dim" /> Filter:
              </span>

              {/* Live Asset/Symbol Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-chrome-field border border-chrome-line rounded px-2.5 py-1">
                <span className="text-[11px] text-chrome-dim">Asset:</span>
                <select
                  value={selectedAsset || liveSymbolFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (setLiveSymbolFilter) setLiveSymbolFilter(val);
                    if (onAssetChange) onAssetChange(val);
                  }}
                  aria-label="Filter live session trades by asset"
                  className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Assets (7)</option>
                  <option value="BTCUSDT">BTCUSDT</option>
                  <option value="ETHUSDT">ETHUSDT</option>
                  <option value="SOLUSDT">SOLUSDT</option>
                  <option value="DOTUSDT">DOTUSDT</option>
                  <option value="XAUUSDT">Gold (XAUUSDT)</option>
                  <option value="XAGUSDT">Silver (XAGUSDT)</option>
                  <option value="CLUSDT">Crude Oil (CLUSDT)</option>
                  <option value="GC=F">Gold (GC=F Alias)</option>
                  <option value="SI=F">Silver (SI=F Alias)</option>
                  <option value="CL=F">Crude Oil (CL=F Alias)</option>
                </select>
              </div>

              {/* Direction Filter */}
              <div className="flex items-center gap-1.5 bg-chrome-field border border-chrome-line rounded px-2.5 py-1">
                <span className="text-[11px] text-chrome-dim">Direction:</span>
                <select
                  value={liveSideFilter}
                  onChange={(e) => setLiveSideFilter(e.target.value as any)}
                  aria-label="Filter live session trades by direction"
                  className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                >
                  <option value="ALL">All Live Trades ({trades.length})</option>
                  <option value="LONG">🟢 LONG ({trades.filter((t) => t.direction === "LONG").length})</option>
                  <option value="SHORT">🔴 SHORT ({trades.filter((t) => t.direction === "SHORT").length})</option>
                </select>
              </div>

              {/* Rows Filter */}
              <div className="flex items-center gap-1.5 bg-chrome-field border border-chrome-line rounded px-2.5 py-1">
                <span className="text-[11px] text-chrome-dim">Rows:</span>
                <select
                  value={liveLimit}
                  onChange={(e) => onLiveLimitChange(Number(e.target.value))}
                  aria-label="Filter number of live trades displayed"
                  className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                >
                  <option value={50}>50 trades</option>
                  <option value={100}>100 trades</option>
                  <option value={200}>200 trades</option>
                  <option value={500}>500 trades</option>
                </select>
              </div>
            </div>
            <div className="text-[11px] text-chrome-dim">
              Showing <strong>{filteredLiveTrades.length}</strong> of <strong>{totalLiveCount || trades.length}</strong> live executions
            </div>
          </div>
        )}
      </div>

      {/* Table Data View - Optimized to eliminate horizontal scroll */}
      <div className="w-full overflow-x-auto xl:overflow-x-visible">
        {tableTab === "live" ? (
          <>
          <table className="w-full text-left border-collapse font-mono text-xs table-auto">
            <thead>
              <tr className="bg-chrome-field/80 border-b border-chrome-line text-chrome-dim uppercase text-[10px] tracking-wider">
                <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Time</th>
                <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Engine</th>
                <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Pair</th>
                <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Side</th>
                <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Entry</th>
                <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Exit</th>
                <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Size</th>
                <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Fee</th>
                <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Net PnL</th>
                <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Capital</th>
                <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Outcome / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chrome-edge">
              {liveTradesWithBalance.length > 0 ? (
                liveTradesWithBalance.map((trade) => {
                  const isClosed = trade.status === "CLOSED";
                  const isPositive = (trade.netPnLINR || 0) >= 0;

                  return (
                    <tr
                      key={trade.id}
                      onClick={() => handleInspect(trade)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                      title="Click to view this trade on the Terminal chart"
                    >
                      <td className="py-2 px-1.5 sm:px-2 text-chrome-dim text-[11px] whitespace-nowrap">
                        {new Date(trade.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-chrome-field border border-chrome-line font-bold text-[10px] text-chrome-ink">
                          {getDisplayModelName(trade)}
                        </span>
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 font-bold text-chrome-ink whitespace-nowrap">
                        <span className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                          {toDisplaySymbol(trade.symbol)}
                          <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                        </span>
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            trade.direction === "LONG"
                              ? "bg-win-tint text-win-dark border border-win/30"
                              : "bg-loss-tint text-loss-dark border border-loss/30"
                          }`}
                        >
                          {trade.direction}
                        </span>
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 font-bold text-chrome-ink tabular-nums whitespace-nowrap">
                        ${trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 font-bold text-chrome-ink tabular-nums whitespace-nowrap">
                        {trade.exitPrice
                          ? `$${trade.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 text-chrome-ink font-semibold tabular-nums whitespace-nowrap">
                        ₹{(trade.positionSizeINR || 1000).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 text-accent font-semibold tabular-nums whitespace-nowrap">
                        ₹{trade.totalFeeINR?.toFixed(2) || "0.00"}
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 font-bold tabular-nums whitespace-nowrap">
                        {isClosed ? (
                          <div>
                            <span className={isPositive ? "text-win" : "text-loss"}>
                              {isPositive ? "+" : ""}₹{trade.netPnLINR?.toFixed(2)}
                            </span>
                            <span className="text-[9px] text-chrome-dim block font-normal">
                              Gross: {trade.grossPnLINR && trade.grossPnLINR >= 0 ? "+" : ""}₹{trade.grossPnLINR?.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-accent animate-pulse font-bold">In Flight</span>
                        )}
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 font-mono font-bold tabular-nums whitespace-nowrap">
                        <span className={(trade.runningBalanceINR ?? 7000) >= 7000 ? "text-emerald-700" : "text-rose-700"}>
                          ₹{(trade.runningBalanceINR ?? 7000).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-2 px-1.5 sm:px-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleInspect(trade)}
                            className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold rounded cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                            title="Inspect this trade on Terminal Chart"
                          >
                            <Target className="w-2.5 h-2.5" />
                            <span>Chart</span>
                          </button>
                          {trade.status === "ACTIVE" ? (
                            <button
                              onClick={() => handleCloseTrade(trade.id, trade.entryPrice, trade.direction)}
                              className="px-2 py-0.5 bg-white hover:bg-loss-tint text-loss border border-loss/30 text-[10px] font-bold rounded cursor-pointer transition-colors shadow-2xs"
                            >
                              Close
                            </button>
                          ) : (
                            <span className="text-chrome-dim text-[10.5px] font-semibold">
                              {trade.exitReason === "TARGET"
                                ? "🎯 Target"
                                : trade.exitReason === "STOP" || trade.exitReason === "COLLISION_STOP"
                                ? "🛑 Stop"
                                : "⏱️ Time"}
                              <span className="text-[9px] text-slate-400 block font-normal">Closed</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-chrome-dim">
                    No live trades match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* LIVE PREDICTION & MARKET EVALUATION AUDIT FEED (Oct 21 – Nov 7, 2026) */}
          <div className="mt-6 border-t-2 border-chrome-line pt-4 px-2">
            
            {/* Feed Header & Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]" />
                <div>
                  <div className="font-mono text-xs font-black text-chrome-ink flex flex-wrap items-center gap-2">
                    <span>LIVE PREDICTION &amp; REGIME EVALUATION FEED</span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_#10b981]" />
                      LIVE 2-MIN ENGINE (ZERO CRON)
                    </span>
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                      ACTIVE ENGINE: {activeModelMeta?.shortName || activeModelMeta?.name || selectedModelId || "Unified 1H"}
                    </span>
                    <div className="flex bg-chrome-line/50 p-0.5 rounded font-mono text-[11px]">
                      <button
                        onClick={() => setFeedViewMode("snapshot")}
                        className={`px-2.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          feedViewMode === "snapshot"
                            ? "bg-white text-chrome-ink shadow-2xs"
                            : "text-chrome-dim hover:text-chrome-ink"
                        }`}
                      >
                        ⚡ Latest Snapshot (7 Assets)
                      </button>
                      <button
                        onClick={() => setFeedViewMode("feed")}
                        className={`px-2.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          feedViewMode === "feed"
                            ? "bg-white text-chrome-ink shadow-2xs"
                            : "text-chrome-dim hover:text-chrome-ink"
                        }`}
                      >
                        📜 Hourly Audit Ledger ({filteredLogs.length})
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-chrome-dim font-sans mt-0.5">
                    {feedViewMode === "snapshot"
                      ? "Displaying the latest synchronized hourly bar across all 7 assets with live prices and 200 SMA regime"
                      : `Sequential bar-by-bar audit (${filteredLogs.length.toLocaleString()} bars analyzed · Zero lookahead · Strict t-1 lag)`}
                  </div>
                </div>
              </div>

              {/* Feed Filters */}
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Asset Filter */}
                <div className="flex items-center gap-1 bg-chrome-field border border-chrome-line rounded px-2 py-1 text-xs font-mono">
                  <span className="text-chrome-dim text-[10px]">Asset:</span>
                  <select
                    value={logAssetFilter}
                    onChange={(e) => {
                      setLogAssetFilter(e.target.value as any);
                      setLogPage(1);
                    }}
                    className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                  >
                    <option value="ALL">All Assets</option>
                    <option value="crypto">4H Crypto Only</option>
                    <option value="commodities">1H Commodities Only</option>
                  </select>
                </div>

                {/* Decision Filter */}
                <div className="flex items-center gap-1 bg-chrome-field border border-chrome-line rounded px-2 py-1 text-xs font-mono">
                  <span className="text-chrome-dim text-[10px]">Decision:</span>
                  <select
                    value={logDecisionFilter}
                    onChange={(e) => {
                      setLogDecisionFilter(e.target.value as any);
                      setLogPage(1);
                    }}
                    className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                  >
                    <option value="ALL">All Decisions</option>
                    <option value="EXECUTED_TRADE">🟢 Executed Trades</option>
                    <option value="CASH_PROTECTED_BEARISH">🛡️ Bearish Cash Shield</option>
                    <option value="CASH_PROTECTED_CONSOLIDATION">🔒 Consolidation Safe</option>
                  </select>
                </div>

                {/* Rows per page */}
                <div className="flex items-center gap-1 bg-chrome-field border border-chrome-line rounded px-2 py-1 text-xs font-mono">
                  <span className="text-chrome-dim text-[10px]">Rows:</span>
                  <select
                    value={logLimit}
                    onChange={(e) => {
                      setLogLimit(Number(e.target.value));
                      setLogPage(1);
                    }}
                    className="bg-transparent font-bold text-chrome-ink outline-none cursor-pointer text-xs"
                  >
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Live Feed Table - Optimized for Zero Horizontal Scrolling */}
            <div className="w-full overflow-x-auto xl:overflow-x-visible border border-chrome-line rounded-lg shadow-2xs">
              <table className="w-full text-left border-collapse font-mono text-xs table-auto">
                <thead>
                  <tr className="bg-chrome-field/80 border-b border-chrome-line text-chrome-dim uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Time (UTC)</th>
                    <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Symbol</th>
                    <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">Price</th>
                    <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">200 SMA</th>
                    <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">{selectedModelId === "4hr-timeframe-router" ? "Donchian Bounds" : "Donchian Range"}</th>
                    <th className="py-2 px-1.5 sm:px-2 whitespace-nowrap">AI Conviction (P)</th>
                    <th className="py-2 px-1.5 sm:px-2">Decision / AI Mind State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chrome-edge bg-white">
                  {displayedLogs.length > 0 ? (
                    displayedLogs.map((log: any) => {
                      const isExecuted = log.decision === "EXECUTED_TRADE";
                      const isPositionActive = log.decision === "CASH_PROTECTED_POSITION_ACTIVE";
                      const isAboveSma = log.price >= log.sma_200;
                      const isRouter = selectedModelId === "4hr-timeframe-router" || !!log.routed_engine;
                      const isNoTrade = log.symbol === "CLUSDT" || log.symbol === "CL=F" || log.routed_engine === "no_trade_policy";
                      const isEthClamp = log.routed_engine === "fixed_4h_clamp_btc_eth";
                      const isBearish = !isNoTrade && (log.decision === "CASH_PROTECTED_BEARISH" || log.decision === "CASH_SHIELD" || log.regime === "BEARISH" || !isAboveSma);

                      return (
                        <tr key={log.id} className="hover:bg-chrome-field/40 transition-colors">
                          <td className="py-2 px-2 sm:px-2.5 text-chrome-dim text-[11px] whitespace-nowrap">
                            {log.time_utc || (log.timestamp ? new Date(log.timestamp).toISOString().replace("T", " ").slice(0, 16) : "")}
                          </td>
                          <td className="py-2 px-2 sm:px-2.5 font-bold text-chrome-ink whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded bg-chrome-field border border-chrome-line text-[11px]">
                              {toDisplaySymbol(log.symbol)}
                            </span>
                          </td>
                          <td className="py-2 px-2 sm:px-2.5 font-bold text-chrome-ink tabular-nums">
                            ${log.price?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2 sm:px-2.5 text-chrome-dim tabular-nums">
                            <span className={isAboveSma ? "text-emerald-700 font-semibold" : "text-amber-700 font-semibold"}>
                              ${log.sma_200?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                              {" "}({isAboveSma ? "Bullish ▲" : "Bearish ▼"})
                            </span>
                          </td>
                          <td className="py-2 px-2 sm:px-2.5 text-chrome-dim text-[11px] tabular-nums whitespace-nowrap">
                            {isNoTrade ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-bold">
                                🚫 No-Trade Policy (Fee Drag Guard)
                              </span>
                            ) : isRouter && log.routed_engine_label ? (
                              <div>
                                <span className="text-[9.5px] font-semibold text-slate-500 block">{log.routed_engine_label}</span>
                                <span>
                                  ${(log.donchian_low ?? log.donchian_low_20)?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} – ${(log.donchian_high ?? log.donchian_high_20)?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ) : (
                              <span>
                                ${(log.donchian_low ?? log.donchian_low_20)?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} – ${(log.donchian_high ?? log.donchian_high_20)?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-1.5 sm:px-2 whitespace-nowrap">
                            {isNoTrade ? (
                              <span className="font-mono text-[10.5px] font-bold text-amber-700">Excluded</span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <div className="w-10 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                                  <div
                                    className={`h-full ${(log.probability ?? log.conviction_p ?? 0) >= (log.p_cutoff ?? 0.50) ? "bg-emerald-500" : "bg-slate-400"}`}
                                    style={{ width: `${Math.min(100, Math.max(0, (log.probability ?? log.conviction_p ?? 0) * 100))}%` }}
                                  />
                                </div>
                                <span className={`font-mono text-[10.5px] font-bold ${(log.probability ?? log.conviction_p ?? 0) >= (log.p_cutoff ?? 0.50) ? "text-emerald-700" : "text-slate-500"}`}>
                                  {`${((log.probability ?? log.conviction_p ?? 0) * 100).toFixed(1)}%`}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-1.5 sm:px-2">
                            {isExecuted ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[9.5px] whitespace-nowrap">
                                  🟢 {log.side || "LONG"} EXECUTED
                                </span>
                                <span className="text-slate-600 text-[10px]">
                                  {log.decision_reason || "Breakout Confirmed"}
                                </span>
                              </div>
                            ) : isPositionActive ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300 font-bold text-[9.5px] whitespace-nowrap">
                                  ⚡ 1-POS LOCKED
                                </span>
                                <span className="text-slate-600 text-[10px]">
                                  Position running · 100% Capital Deployed
                                </span>
                              </div>
                            ) : isNoTrade ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[9.5px] whitespace-nowrap">
                                  🛡️ CASH SHIELD
                                </span>
                                <span className="text-slate-600 text-[10px]">
                                  Crude Oil Excluded (Alpha &lt; +0.05R)
                                </span>
                              </div>
                            ) : isBearish ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[9.5px] whitespace-nowrap">
                                  🛡️ CASH SHIELD
                                </span>
                                <span className="text-slate-600 text-[10px]">
                                  Below 200 SMA (Bearish)
                                </span>
                              </div>
                            ) : isEthClamp ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300 font-bold text-[9.5px] whitespace-nowrap">
                                  🔒 CLAMP SAFE
                                </span>
                                <span className="text-slate-600 text-[10px]">
                                  Inside Structural Clamp
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 font-bold text-[9.5px] whitespace-nowrap">
                                  🔒 CASH SAFE
                                </span>
                                <span className="text-slate-600 text-[10px]">
                                  Consolidating inside Donchian range
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-chrome-dim text-xs">
                        No prediction logs match the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-xs font-mono py-2.5 px-1 text-chrome-dim border-t border-chrome-line mt-1">
              <div>
                Showing <strong>{((logPage - 1) * logLimit) + (paginatedLogs.length > 0 ? 1 : 0)}</strong> to{" "}
                <strong>{Math.min(logPage * logLimit, filteredLogs.length)}</strong> of{" "}
                <strong>{filteredLogs.length.toLocaleString()}</strong> live evaluation records
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLogPage(1)}
                  disabled={logPage <= 1}
                  className="px-2 py-1 rounded bg-chrome-field border border-chrome-line disabled:opacity-40 cursor-pointer font-bold text-xs"
                >
                  « First
                </button>
                <button
                  type="button"
                  onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  disabled={logPage <= 1}
                  className="px-2 py-1 rounded bg-chrome-field border border-chrome-line disabled:opacity-40 cursor-pointer font-bold text-xs"
                >
                  ‹ Prev
                </button>
                <span className="px-2 font-bold text-chrome-ink">
                  Page {logPage} of {totalLogPages}
                </span>
                <button
                  type="button"
                  onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                  disabled={logPage >= totalLogPages}
                  className="px-2 py-1 rounded bg-chrome-field border border-chrome-line disabled:opacity-40 cursor-pointer font-bold text-xs"
                >
                  Next ›
                </button>
                <button
                  type="button"
                  onClick={() => setLogPage(totalLogPages)}
                  disabled={logPage >= totalLogPages}
                  className="px-2 py-1 rounded bg-chrome-field border border-chrome-line disabled:opacity-40 cursor-pointer font-bold text-xs"
                >
                  Last »
                </button>
              </div>
            </div>

          </div>
          </>
        ) : tableTab === "all_historical" ? (
          <table className="w-full min-w-full lg:min-w-0 text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-chrome-field/70 border-b border-chrome-line text-chrome-dim uppercase text-[10px] tracking-wider">
                <th className="py-2 px-2 sm:px-2.5">#</th>
                <th className="py-2 px-2 sm:px-2.5">Entry Time (UTC)</th>
                <th className="py-2 px-2 sm:px-2.5">Exit Time (UTC)</th>
                <th className="py-2 px-2 sm:px-2.5">Pair</th>
                <th className="py-2 px-2 sm:px-2.5">Direction</th>
                <th className="py-2 px-2 sm:px-2.5">Entry Price</th>
                <th className="py-2 px-2 sm:px-2.5">Exit Price</th>
                <th className="py-2 px-2 sm:px-2.5">Position</th>
                <th className="py-2 px-2 sm:px-2.5">Fee (w/ GST)</th>
                <th className="py-2 px-2 sm:px-2.5">Net R</th>
                <th className="py-2 px-2 sm:px-2.5">Net PnL (INR)</th>
                <th className="py-2 px-2 sm:px-2.5">Running Capital (₹7K)</th>
                <th className="py-2 px-2 sm:px-2.5">Outcome Trigger</th>
                <th className="py-2 px-2 sm:px-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chrome-edge">
              {allHistoricalTrades.length > 0 ? (
                allHistoricalTrades.map((t, idx) => {
                  const isWin = (t.net_r ?? t.outcomeR ?? 0) > 0;
                  const isTP = t.exitReason === "TAKE_PROFIT" || (t.net_r ?? 0) >= 1.0;
                  const isBE = (t.net_r ?? 0) > 0 && (t.net_r ?? 0) < 0.2;

                  return (
                    <tr
                      key={t.id || idx}
                      onClick={() => handleInspect(t)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                      title="Click to view this trade on the Terminal chart"
                    >
                      <td className="py-2 px-2 sm:px-2.5 text-chrome-dim text-[11px] font-bold">
                        #{t.pos || idx + 1}
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 text-chrome-dim text-[11px] whitespace-nowrap">
                        {t.entryTime || t.entry_time}
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 text-chrome-dim text-[11px] whitespace-nowrap">
                        {t.exitTime || t.exit_time}
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 font-bold text-chrome-ink">
                        {toDisplaySymbol(t.symbol || "BTCUSDT")}
                      </td>
                      <td className="py-2 px-2 sm:px-2.5">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            t.side === "LONG" || t.direction === "LONG"
                              ? "bg-win-tint text-win-dark border border-win/30"
                              : "bg-loss-tint text-loss-dark border border-loss/30"
                          }`}
                        >
                          {t.side || t.direction}
                        </span>
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 font-mono text-chrome-ink">
                        ${typeof t.entryPrice === "number" ? t.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : t.entry_price}
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 font-mono text-chrome-ink">
                        ${typeof t.exitPrice === "number" ? t.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : t.exit_price}
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 text-chrome-dim font-mono">
                        ₹{(t.positionSizeINR || 1000).toLocaleString()}
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 text-chrome-dim font-mono">
                        ₹{(t.totalFeeINR ?? t.fee ?? 1.14).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 font-bold font-mono">
                        <span className={isWin ? "text-win" : "text-loss"}>
                          {(t.net_r ?? t.outcomeR ?? 0) >= 0 ? "+" : ""}
                          {(t.net_r ?? t.outcomeR ?? 0).toFixed(3)}R
                        </span>
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 font-bold font-mono">
                        <span className={isWin ? "text-win font-black" : "text-loss"}>
                          {(t.pnlNetINR ?? 0) >= 0 ? "+₹" : "-₹"}
                          {Math.abs(t.pnlNetINR ?? 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 font-mono font-bold text-chrome-ink bg-chrome-field/30">
                        ₹{typeof t.capital === "number" ? t.capital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "7,000.00"}
                      </td>
                      <td className="py-2 px-2 sm:px-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isTP
                              ? "bg-win-tint text-win-dark border-win/30"
                              : isBE
                              ? "bg-accent-tint text-accent border-accent/30"
                              : "bg-loss-tint text-loss-dark border-loss/30"
                          }`}
                        >
                          {t.exitReason === "TAKE_PROFIT"
                            ? "🎯 Take Profit (+2.5R)"
                            : t.exitReason === "TIME_EXPIRY"
                            ? `⏱️ Time Barrier (${(t.net_r ?? 0) >= 0 ? "+" : ""}${(t.net_r ?? 0).toFixed(2)}R)`
                            : "🛑 Stop Loss (-1.0R)"}
                        </span>
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspect(t);
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/30 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Open on Terminal Chart"
                        >
                          <Target className="w-3 h-3" />
                          <span>Chart</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-chrome-dim">
                    {isLoadingAllHistorical ? "Loading 6-year complete historical transactions from MongoDB Atlas..." : "No historical transactions found for this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-full lg:min-w-0 text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-chrome-field/70 border-b border-chrome-line text-chrome-dim uppercase text-[10px] tracking-wider">
                <th className="py-2 px-2 sm:px-2.5">Entry Time (UTC)</th>
                <th className="py-2 px-2 sm:px-2.5">Exit Time (UTC)</th>
                <th className="py-2 px-2 sm:px-2.5">Pair</th>
                <th className="py-2 px-2 sm:px-2.5">Direction</th>
                <th className="py-2 px-2 sm:px-2.5">R-Multiple</th>
                <th className="py-2 px-2 sm:px-2.5">Net Return %</th>
                <th className="py-2 px-2 sm:px-2.5">Outcome Trigger</th>
                <th className="py-2 px-2 sm:px-2.5">Causality Check</th>
                <th className="py-2 px-2 sm:px-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chrome-edge">
              {historicalTrades.length > 0 ? (
                historicalTrades.map((t) => {
                  const isTP = t.outcomeR >= 1.0;
                  const isBE = t.outcomeR > 0 && t.outcomeR < 0.2;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => handleInspect(t)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                      title="Click to view this trade on the Terminal chart"
                    >
                      <td className="py-2 px-2 sm:px-2.5 text-chrome-dim text-[11px] whitespace-nowrap">
                        {t.entryTime}
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 text-chrome-dim text-[11px] whitespace-nowrap">
                        {t.exitTime}
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 font-bold text-chrome-ink">{toDisplaySymbol(t.symbol || "BTCUSDT")}</td>
                      <td className="py-2 px-2 sm:px-2.5">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            t.side === "LONG"
                              ? "bg-win-tint text-win-dark border border-win/30"
                              : "bg-loss-tint text-loss-dark border border-loss/30"
                          }`}
                        >
                          {t.side}
                        </span>
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 font-bold">
                        <span
                          className={
                            isTP
                              ? "text-win"
                              : isBE
                              ? "text-accent"
                              : "text-loss"
                          }
                        >
                          {t.outcomeR >= 0 ? "+" : ""}
                          {t.outcomeR.toFixed(2)}R
                        </span>
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 font-bold">
                        <span className={t.returnPct >= 0 ? "text-win" : "text-loss"}>
                          {t.returnPct >= 0 ? "+" : ""}
                          {t.returnPct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-2 px-2 sm:px-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isTP
                              ? "bg-win-tint text-win-dark border-win/30"
                              : isBE
                              ? "bg-accent-tint text-accent border-accent/30"
                              : "bg-loss-tint text-loss-dark border-loss/30"
                          }`}
                        >
                          {t.exitReason === "TAKE_PROFIT"
                            ? `🎯 Take Profit (${t.outcomeR >= 0 ? "+" : ""}${t.outcomeR.toFixed(2)}R)`
                            : t.exitReason === "TIME_EXPIRY"
                            ? `⏱️ Time Barrier (${t.outcomeR >= 0 ? "+" : ""}${t.outcomeR.toFixed(2)}R)`
                            : `🛑 Stop Loss (${t.outcomeR.toFixed(2)}R)`}
                        </span>
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 text-[10px] text-chrome-dim">
                        <span className="text-chrome-dim bg-chrome-field border border-chrome-line px-1.5 py-0.5 rounded font-mono font-semibold">
                          ✔ Point-in-Time (No Leakage)
                        </span>
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspect(t);
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/30 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Open on Terminal Chart"
                        >
                          <Target className="w-3 h-3" />
                          <span>Chart</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-chrome-dim">
                    {isLoadingHistorical ? "Loading verified out-of-sample trades..." : "No historical trades loaded."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Pagination Toolbar for 6-Year Historical Transactions */}
      {tableTab === "all_historical" && totalAllHistoricalCount > 0 && (
        <div className="p-3 border-t border-chrome-line bg-chrome-field flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <span className="text-chrome-dim text-[11px]">
            Showing <strong className="text-chrome-ink">{Math.min(totalAllHistoricalCount, (allHistPage - 1) * allHistLimit + 1)}</strong> to{" "}
            <strong className="text-chrome-ink">{Math.min(totalAllHistoricalCount, allHistPage * allHistLimit)}</strong> of{" "}
            <strong className="text-chrome-ink">{totalAllHistoricalCount.toLocaleString()}</strong> historical transactions (2020-2026)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleAllHistPageChange && handleAllHistPageChange(1)}
              disabled={allHistPage <= 1 || isLoadingAllHistorical}
              className="px-2.5 py-1 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors font-bold text-[11px] shadow-2xs"
            >
              ⏮ First
            </button>
            <button
              onClick={() => handleAllHistPageChange && handleAllHistPageChange(allHistPage - 1)}
              disabled={allHistPage <= 1 || isLoadingAllHistorical}
              className="px-2.5 py-1 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors font-bold text-[11px] shadow-2xs"
            >
              ◀ Prev
            </button>
            <span className="px-3 py-1 font-bold text-chrome-ink bg-white rounded border border-chrome-line text-[11px]">
              Page {allHistPage} of {allHistTotalPages}
            </span>
            <button
              onClick={() => handleAllHistPageChange && handleAllHistPageChange(allHistPage + 1)}
              disabled={allHistPage >= allHistTotalPages || isLoadingAllHistorical}
              className="px-2.5 py-1 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors font-bold text-[11px] shadow-2xs"
            >
              Next ▶
            </button>
            <button
              onClick={() => handleAllHistPageChange && handleAllHistPageChange(allHistTotalPages)}
              disabled={allHistPage >= allHistTotalPages || isLoadingAllHistorical}
              className="px-2.5 py-1 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors font-bold text-[11px] shadow-2xs"
            >
              Last ⏭
            </button>
          </div>
        </div>
      )}

      {/* Bottom Pagination Toolbar for Historical Trades */}
      {tableTab === "historical" && totalHistoricalCount > 0 && (
        <div className="p-3 border-t border-chrome-line bg-chrome-field flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <span className="text-chrome-dim text-[11px]">
            Showing <strong className="text-chrome-ink">{Math.min(totalHistoricalCount, (histPage - 1) * histLimit + 1)}</strong> to{" "}
            <strong className="text-chrome-ink">{Math.min(totalHistoricalCount, histPage * histLimit)}</strong> of{" "}
            <strong className="text-chrome-ink">{totalHistoricalCount.toLocaleString()}</strong> verified historical trades
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleHistPageChange(1)}
              disabled={histPage <= 1 || isLoadingHistorical}
              className="px-2.5 py-1 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors font-bold text-[11px] shadow-2xs"
            >
              ⏮ First
            </button>
            <button
              onClick={() => handleHistPageChange(histPage - 1)}
              disabled={histPage <= 1 || isLoadingHistorical}
              className="px-2.5 py-1 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors font-bold text-[11px] shadow-2xs"
            >
              ◀ Prev
            </button>
            <span className="px-3 py-1 font-bold text-chrome-ink bg-white rounded border border-chrome-line text-[11px]">
              Page {histPage} of {histTotalPages}
            </span>
            <button
              onClick={() => handleHistPageChange(histPage + 1)}
              disabled={histPage >= histTotalPages || isLoadingHistorical}
              className="px-2.5 py-1 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors font-bold text-[11px] shadow-2xs"
            >
              Next ▶
            </button>
            <button
              onClick={() => handleHistPageChange(histTotalPages)}
              disabled={histPage >= histTotalPages || isLoadingHistorical}
              className="px-2.5 py-1 rounded border border-chrome-line bg-white hover:bg-chrome-field disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors font-bold text-[11px] shadow-2xs"
            >
              Last ⏭
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default LiveTradesTable;
