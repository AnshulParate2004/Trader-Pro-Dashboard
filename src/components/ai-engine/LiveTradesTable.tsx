"use client";

import React from "react";
import { TradeOrder } from "@/lib/engineTypes";
import {
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Layers,
} from "lucide-react";

interface LiveTradesTableProps {
  trades: TradeOrder[];
  filteredLiveTrades: TradeOrder[];
  livePredictionLogs?: any[];
  tableTab: "live" | "historical";
  setTableTab: (tab: "live" | "historical") => void;
  liveSideFilter: "ALL" | "LONG" | "SHORT";
  setLiveSideFilter: (filter: "ALL" | "LONG" | "SHORT") => void;
  liveLimit: number;
  onLiveLimitChange: (limit: number) => void;
  historicalTrades: any[];
  totalHistoricalCount: number;
  isLoadingHistorical: boolean;
  histPage: number;
  histLimit: number;
  histSideFilter: "ALL" | "LONG" | "SHORT";
  histOutcomeFilter: string;
  histTotalPages: number;
  handleHistPageChange: (newPage: number) => void;
  handleHistLimitChange: (newLimit: number) => void;
  handleHistSideChange: (newSide: "ALL" | "LONG" | "SHORT") => void;
  handleHistOutcomeChange: (newOutcome: string) => void;
  handleCloseTrade: (tradeId: string, entryPrice: number, dir: "LONG" | "SHORT") => void;
  totalLiveCount?: number;
  isTaker?: boolean;
  feePercent?: number;
}

export const LiveTradesTable: React.FC<LiveTradesTableProps> = ({
  trades,
  filteredLiveTrades,
  livePredictionLogs = [],
  tableTab,
  setTableTab,
  liveSideFilter,
  setLiveSideFilter,
  liveLimit,
  onLiveLimitChange,
  historicalTrades,
  totalHistoricalCount,
  isLoadingHistorical,
  histPage,
  histLimit,
  histSideFilter,
  histOutcomeFilter,
  histTotalPages,
  handleHistPageChange,
  handleHistLimitChange,
  handleHistSideChange,
  handleHistOutcomeChange,
  handleCloseTrade,
  totalLiveCount,
  isTaker = true,
  feePercent = 0.040,
}) => {
  // Live Prediction Logs Filter & Pagination State
  const [logAssetFilter, setLogAssetFilter] = React.useState<"ALL" | "crypto" | "commodities">("ALL");
  const [logDecisionFilter, setLogDecisionFilter] = React.useState<"ALL" | "EXECUTED_TRADE" | "CASH_PROTECTED_BEARISH" | "CASH_PROTECTED_CONSOLIDATION">("ALL");
  const [logPage, setLogPage] = React.useState<number>(1);
  const [logLimit, setLogLimit] = React.useState<number>(25);

  const filteredLogs = React.useMemo(() => {
    return (livePredictionLogs || []).filter((log: any) => {
      if (logAssetFilter !== "ALL" && log.asset_class !== logAssetFilter) return false;
      if (logDecisionFilter !== "ALL" && log.decision !== logDecisionFilter) return false;
      return true;
    });
  }, [livePredictionLogs, logAssetFilter, logDecisionFilter]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / logLimit));
  const paginatedLogs = filteredLogs.slice((logPage - 1) * logLimit, logPage * logLimit);

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
              🟢 Live 4H Swing Trades ({trades.length})
            </button>
            <button
              onClick={() => setTableTab("historical")}
              className={`px-3 py-1.5 rounded font-bold transition-all cursor-pointer ${
                tableTab === "historical"
                  ? "bg-white text-chrome-ink shadow-xs"
                  : "text-chrome-dim hover:text-chrome-ink"
              }`}
            >
              📊 Verified Historical OOS Trades ({totalHistoricalCount ? totalHistoricalCount.toLocaleString() : "159"})
            </button>
          </div>
        </div>

        <div className="text-xs text-chrome-dim font-mono">
          {tableTab === "live"
            ? "4H Swing Execution (0.10% Round-Trip Friction Deducted)"
            : "Verified out-of-sample backtest logs (Point-in-Time execution)"}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="px-3 sm:px-4 py-2.5 bg-white border-b border-chrome-edge flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {tableTab === "historical" ? (
          <>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-chrome-dim font-bold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-chrome-dim" /> Filters:
              </span>

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
                  <option value="TAKE_PROFIT">🎯 Take Profit (+1.0R)</option>
                  <option value="BREAKEVEN_RATCHET">⚡ Breakeven Exit (+0.05R Lock)</option>
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

      {/* Table Data View */}
      <div className="overflow-x-auto">
        {tableTab === "live" ? (
          <>
          <table className="w-full min-w-[1080px] text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-chrome-field/70 border-b border-chrome-line text-chrome-dim uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">AI Model</th>
                <th className="py-2.5 px-3">Pair</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Entry Price</th>
                <th className="py-2.5 px-3">Exit Price</th>
                <th className="py-2.5 px-3">Position (INR)</th>
                <th className="py-2.5 px-3">Shark Fee (w/ GST)</th>
                <th className="py-2.5 px-3">Gross PnL</th>
                <th className="py-2.5 px-3">Net PnL</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chrome-edge">
              {filteredLiveTrades.length > 0 ? (
                filteredLiveTrades.map((trade) => {
                  const isClosed = trade.status === "CLOSED";
                  const isPositive = (trade.netPnLINR || 0) >= 0;

                  return (
                    <tr key={trade.id} className="hover:bg-chrome-field/50 transition-colors">
                      <td className="py-2.5 px-3 text-chrome-dim text-[11px] whitespace-nowrap">
                        {new Date(trade.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-chrome-field border border-chrome-line font-bold text-[10px] text-chrome-ink">
                          {trade.modelName || "4H Swing Meta (+0.17R)"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-chrome-ink">{trade.symbol}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            trade.direction === "LONG"
                              ? "bg-win-tint text-win-dark border border-win/30"
                              : "bg-loss-tint text-loss-dark border border-loss/30"
                          }`}
                        >
                          {trade.direction}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-chrome-ink">
                        ${trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-chrome-ink">
                        {trade.exitPrice
                          ? `$${trade.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}`
                          : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-chrome-ink font-semibold">
                        ₹{trade.positionSizeINR.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-accent font-semibold">
                        ₹{trade.totalFeeINR?.toFixed(3) || "0.000"}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        {isClosed ? (
                          <span className={trade.grossPnLINR && trade.grossPnLINR >= 0 ? "text-win" : "text-loss"}>
                            {trade.grossPnLINR && trade.grossPnLINR >= 0 ? "+" : ""}₹{trade.grossPnLINR?.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-chrome-dim">Floating</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        {isClosed ? (
                          <span className={isPositive ? "text-win" : "text-loss"}>
                            {isPositive ? "+" : ""}₹{trade.netPnLINR?.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-accent animate-pulse">Running</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isClosed
                              ? "bg-chrome-field text-chrome-dim border-chrome-line"
                              : "bg-win-tint text-win-dark border-win/30"
                          }`}
                        >
                          {trade.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {!isClosed ? (
                          <button
                            onClick={() => handleCloseTrade(trade.id, trade.entryPrice, trade.direction)}
                            className="bg-chrome-ink hover:bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded transition-colors cursor-pointer"
                          >
                            Close
                          </button>
                        ) : (
                          <span className="text-chrome-dim text-[10px]">{trade.exitReason || "Done"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="py-8 text-center bg-emerald-50/20">
                    <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                      <div className="flex items-center gap-2 font-mono text-xs font-black text-emerald-900">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                        <span>ACTIVE CAPITAL 100% SHIELDED IN CASH (₹1,000 PROTECTED)</span>
                      </div>
                      <span className="text-xs text-slate-500 font-sans max-w-md">
                        Market chop and counter-trend regimes filtered by 200 SMA &amp; Donchian channels. Below is the real-time evaluation feed.
                      </span>
                    </div>
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
                  <div className="font-mono text-xs font-black text-chrome-ink flex items-center gap-2">
                    <span>LIVE PREDICTION &amp; REGIME EVALUATION FEED</span>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-full">
                      UNSEEN WINDOW: OCT 21 – NOV 7, 2026
                    </span>
                  </div>
                  <div className="text-[11px] text-chrome-dim font-sans mt-0.5">
                    Sequential bar-by-bar audit ({filteredLogs.length.toLocaleString()} bars analyzed · Zero lookahead · Strict t-1 lag)
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

            {/* Live Feed Table */}
            <div className="overflow-x-auto border border-chrome-line rounded-lg shadow-2xs">
              <table className="w-full min-w-[1020px] text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="bg-chrome-field/80 border-b border-chrome-line text-chrome-dim uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Time (UTC)</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Price</th>
                    <th className="py-2.5 px-3">200 SMA</th>
                    <th className="py-2.5 px-3">Donchian Range</th>
                    <th className="py-2.5 px-3">AI Conviction (P)</th>
                    <th className="py-2.5 px-3">Decision / AI Mind State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chrome-edge bg-white">
                  {paginatedLogs.length > 0 ? (
                    paginatedLogs.map((log: any) => {
                      const isExecuted = log.decision === "EXECUTED_TRADE";
                      const isBearish = log.decision === "CASH_PROTECTED_BEARISH";
                      const isAboveSma = log.price >= log.sma_200;

                      return (
                        <tr key={log.id} className="hover:bg-chrome-field/40 transition-colors">
                          <td className="py-2 px-3 text-chrome-dim text-[11px] whitespace-nowrap">
                            {new Date(log.timestamp_ms).toISOString().replace("T", " ").replace(":00.000Z", " UTC")}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="font-bold text-chrome-ink mr-1.5">{log.symbol}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-chrome-field border border-chrome-line text-chrome-dim">
                              {log.timeframe.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-bold text-chrome-ink tabular-nums">
                            ${log.price.toLocaleString("en-US", { minimumFractionDigits: log.asset_class === "crypto" ? 1 : 2 })}
                          </td>
                          <td className="py-2 px-3 tabular-nums">
                            <span className="font-semibold text-slate-700">
                              ${log.sma_200.toLocaleString("en-US", { minimumFractionDigits: 1 })}
                            </span>
                            <span className={`ml-1.5 text-[9px] font-black px-1.5 py-0.2 rounded ${
                              isAboveSma ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}>
                              {isAboveSma ? "▲ ABOVE" : "▼ BELOW"}
                            </span>
                          </td>
                          <td className="py-2 px-3 tabular-nums text-[11px] text-slate-600">
                            [${log.donchian_low_20.toLocaleString()} - ${log.donchian_high_20.toLocaleString()}]
                          </td>
                          <td className="py-2 px-3 tabular-nums">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-black ${log.passes_gate ? "text-emerald-700" : "text-slate-600"}`}>
                                {(log.probability * 100).toFixed(1)}%
                              </span>
                              <span className="text-[9px] text-slate-400">
                                (cutoff {(log.p_cutoff * 100).toFixed(1)}%)
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            {isExecuted ? (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded font-black text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  🟢 EXECUTED {log.trade_details?.side || "BREAKOUT"}
                                </span>
                                {log.trade_details && (
                                  <span className={`text-[10px] font-mono font-bold ${
                                    (log.trade_details.net_r ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                                  }`}>
                                    {(log.trade_details.net_r ?? 0) >= 0 ? "+" : ""}{log.trade_details.net_r?.toFixed(2)}R ({log.trade_details.exit_type})
                                  </span>
                                )}
                              </div>
                            ) : isBearish ? (
                              <div className="flex items-center gap-1 text-[11px]">
                                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-50 text-amber-900 border border-amber-300">
                                  🛡️ CASH SAFE
                                </span>
                                <span className="text-slate-600 text-[10.5px]">Price below 200 SMA (₹1,000 Protected)</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[11px]">
                                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-300">
                                  🔒 CASH SAFE
                                </span>
                                <span className="text-slate-600 text-[10.5px]">Consolidating inside Donchian range</span>
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
        ) : (
          <table className="w-full min-w-[960px] text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-chrome-field/70 border-b border-chrome-line text-chrome-dim uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Entry Time (UTC)</th>
                <th className="py-2.5 px-3">Exit Time (UTC)</th>
                <th className="py-2.5 px-3">Pair</th>
                <th className="py-2.5 px-3">Direction</th>
                <th className="py-2.5 px-3">R-Multiple</th>
                <th className="py-2.5 px-3">Net Return %</th>
                <th className="py-2.5 px-3">Outcome Trigger</th>
                <th className="py-2.5 px-3">Causality Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chrome-edge">
              {historicalTrades.length > 0 ? (
                historicalTrades.map((t) => {
                  const isTP = t.outcomeR >= 1.0;
                  const isBE = t.outcomeR > 0 && t.outcomeR < 0.2;

                  return (
                    <tr key={t.id} className="hover:bg-chrome-field/50 transition-colors">
                      <td className="py-2.5 px-3 text-chrome-dim text-[11px] whitespace-nowrap">
                        {t.entryTime}
                      </td>
                      <td className="py-2.5 px-3 text-chrome-dim text-[11px] whitespace-nowrap">
                        {t.exitTime}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-chrome-ink">BTCUSDT</td>
                      <td className="py-2.5 px-3">
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
                      <td className="py-2.5 px-3 font-bold">
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
                      <td className="py-2.5 px-3 font-bold">
                        <span className={t.returnPct >= 0 ? "text-win" : "text-loss"}>
                          {t.returnPct >= 0 ? "+" : ""}
                          {t.returnPct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isTP
                              ? "bg-win-tint text-win-dark border-win/30"
                              : isBE
                              ? "bg-accent-tint text-accent border-accent/30"
                              : "bg-loss-tint text-loss-dark border-loss/30"
                          }`}
                        >
                          {isTP
                            ? "🎯 Take Profit (+1.0R)"
                            : isBE
                            ? "⚡ Breakeven Exit (+0.05R Lock)"
                            : "🛑 Stop Loss (-1.0R)"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[10px] text-chrome-dim">
                        <span className="text-chrome-dim bg-chrome-field border border-chrome-line px-1.5 py-0.5 rounded font-mono font-semibold">
                          ✔ Point-in-Time (No Leakage)
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-chrome-dim">
                    {isLoadingHistorical ? "Loading verified out-of-sample trades..." : "No historical trades loaded."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

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
