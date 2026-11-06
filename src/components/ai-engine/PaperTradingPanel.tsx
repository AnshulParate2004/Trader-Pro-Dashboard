"use client";

import React, { useState } from "react";
import { Paper1HAMetrics, Paper1HATrade } from "@/lib/paperTrading1HA";
import { Shield, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

interface PaperTradingPanelProps {
  paperMetrics: Paper1HAMetrics | null;
  paperTrades: Paper1HATrade[];
  isPaperLoading: boolean;
  paperCoinFilter: string;
  setPaperCoinFilter: (coin: string) => void;
}

export const PaperTradingPanel: React.FC<PaperTradingPanelProps> = ({
  paperMetrics,
  paperTrades,
  isPaperLoading,
  paperCoinFilter,
  setPaperCoinFilter,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const totalTrades = paperMetrics?.totalTrades ?? 1099;
  const optCumulative = paperMetrics?.cumulativeNetR ?? 45.31;
  const optAvgNet = paperMetrics?.avgNetR ?? 0.0412;
  const optPf = paperMetrics?.netProfitFactor ?? 1.17;
  const optCi = [-0.0052, 0.0856];

  const strictCumulative = paperMetrics?.strictCumulativeNetR ?? -8.11;
  const strictAvgNet = paperMetrics?.strictAvgNetR ?? -0.0074;
  const strictPf = paperMetrics?.strictNetProfitFactor ?? 0.97;
  const strictCi = [paperMetrics?.strictCiLower ?? -0.0503, paperMetrics?.strictCiUpper ?? 0.0351];
  const inflationTotal = paperMetrics?.beFeeInflationTotalR ?? 53.42;
  const inflationPerTrade = paperMetrics?.inflationPerTradeR ?? 0.0486;

  return (
    <section
      aria-label="Phase 2 Baseline: Setup 1H-A Multi-Coin Paper Validation"
      className="w-full bg-white border border-chrome-line rounded-lg p-4 sm:p-5 shadow-xs flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-chrome-edge pb-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded bg-accent-tint border border-accent/30 flex items-center justify-center text-accent text-sm font-bold shrink-0">
            🧊
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-brand text-base font-medium tracking-tight text-chrome-ink">
                Phase 2 Baseline: Setup 1H-A Multi-Coin Paper-Trading Validation
              </h2>
              <span className="text-[10px] font-mono font-bold bg-accent-tint text-accent px-2 py-0.5 rounded border border-accent/30">
                FROZEN PROTOCOL
              </span>
              <span className="text-[10px] font-mono font-bold bg-chrome-field text-chrome-dim px-2 py-0.5 rounded border border-chrome-line">
                collection: {paperMetrics?.isLiveDataSource ? "paper_1h_a (LIVE)" : "backtest_holdout_1h_a (SEALED OOS)"}
              </span>
            </div>
            <p className="font-body text-xs text-chrome-dim leading-relaxed mt-1">
              <strong>Protocol:</strong> 1H Timeframe · 1:1 TP/SL · Breakeven trigger @ +0.30R locking exact round-trip fees · Top 20% ML conviction · Tested across <strong>BTC, ETH, SOL, BNB, XRP</strong> with Shark Exchange taker fee (0.1144% round-trip friction).
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 font-mono text-xs text-chrome-dim hover:text-chrome-ink bg-chrome-field border border-chrome-line px-2.5 py-1 rounded transition-colors self-start md:self-auto cursor-pointer"
        >
          <span>{isOpen ? "Collapse Panel" : "Expand Panel"}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isOpen && (
        <>
          {/* Dual Execution Fills Comparison Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            {/* Optimistic Fills Panel */}
            <div className="bg-amber-50/40 border border-amber-300/50 rounded-lg p-3 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                <span className="text-[10px] uppercase font-bold text-amber-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  Optimistic Fills (Current Frozen Paper Logic)
                </span>
                <span className="text-[9px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                  EXACT STOP FILL
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-chrome-dim block">Avg Net R</span>
                  <span className="text-lg font-bold text-win font-mono">
                    +{optAvgNet.toFixed(4)} R
                  </span>
                  <span className="text-[9px] text-chrome-dim block">CI [{optCi[0].toFixed(4)}, +{optCi[1].toFixed(4)}]</span>
                </div>
                <div>
                  <span className="text-[10px] text-chrome-dim block">Cumulative Net</span>
                  <span className="text-lg font-bold text-win font-mono">
                    +{optCumulative.toFixed(2)} R
                  </span>
                  <span className="text-[9px] text-chrome-dim block">{totalTrades} Trades</span>
                </div>
                <div>
                  <span className="text-[10px] text-chrome-dim block">Profit Factor</span>
                  <span className="text-lg font-bold text-chrome-ink font-mono">
                    {optPf.toFixed(2)}
                  </span>
                  <span className="text-[9px] text-chrome-dim block">TP/(TP+SL): 59.1%</span>
                </div>
              </div>
              <p className="text-[10px] text-amber-800 leading-tight">
                <strong>Execution Assumptions:</strong> Stop is moved to <code className="bg-amber-100 px-1 py-0.2 rounded font-mono">entry + cost_R_taker</code>. Assumes 100% fill at exact stop price with zero slippage (gross +cost_R, net 0.00R), signal-close entry, and TP checked before SL.
              </p>
            </div>

            {/* Pessimistic Fills Shadow Panel */}
            <div className="bg-blue-50/40 border border-blue-300/50 rounded-lg p-3 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between border-b border-blue-200/60 pb-1.5">
                <span className="text-[10px] uppercase font-bold text-blue-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                  Pessimistic Fills (Shadow Metric)
                </span>
                <span className="text-[9px] text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded font-bold">
                  ENTRY EXIT (0.00R GROSS)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-chrome-dim block">Pessimistic Avg Net R</span>
                  <span className={`text-lg font-bold font-mono ${strictAvgNet >= 0 ? "text-win" : "text-loss"}`}>
                    {strictAvgNet >= 0 ? "+" : ""}{strictAvgNet.toFixed(4)} R
                  </span>
                  <span className="text-[9px] text-chrome-dim block">CI [{strictCi[0].toFixed(4)}, +{strictCi[1].toFixed(4)}]</span>
                </div>
                <div>
                  <span className="text-[10px] text-chrome-dim block">Pessimistic Cumulative</span>
                  <span className={`text-lg font-bold font-mono ${strictCumulative >= 0 ? "text-win" : "text-loss"}`}>
                    {strictCumulative >= 0 ? "+" : ""}{strictCumulative.toFixed(2)} R
                  </span>
                  <span className="text-[9px] text-chrome-dim block">Fees Paid</span>
                </div>
                <div>
                  <span className="text-[10px] text-chrome-dim block">Pessimistic PF</span>
                  <span className="text-lg font-bold text-chrome-ink font-mono">
                    {strictPf.toFixed(2)}
                  </span>
                  <span className="text-[9px] text-chrome-dim block">Conservative fills</span>
                </div>
              </div>
              <p className="text-[10px] text-blue-800 leading-tight">
                <strong>Execution Assumptions:</strong> BE stop fills at unadjusted entry price (0.00R gross), paying full round-trip friction (-cost_R). Accounts for slippage risk, eliminating <span className="font-bold">+{inflationTotal.toFixed(2)} R</span> ({inflationPerTrade.toFixed(4)} R/trade) fill optimism across 522 BE exits.
              </p>
            </div>
          </div>

          {/* Decision Rule Evaluation Card */}
          <div className="bg-accent-tint/60 border border-accent/40 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-chrome-ink uppercase tracking-wide">
                  Pre-Registered Decision Rule Check (paper_rules.md & preregistration_multicoin_study.md):
                </span>
                <span className="text-chrome-dim font-body leading-relaxed text-[11px]">
                  Positive edge requires: (1) Pooled Taker Avg Net R &gt; 0 [Optimistic Fills: ✔ <strong>+0.0412R</strong> | Pessimistic Fills: ❌ <strong>-0.0074R</strong>], (2) 95% CI Lower Bound &ge; 0 [❌ <strong>-0.0503R</strong>], (3) At least 4 of 5 coins positive [❌ <strong>3 of 5 positive</strong> under optimistic fills, <strong>2 of 5 positive</strong> under pessimistic fills].
                </span>
              </div>
            </div>
            <div className="shrink-0 bg-white border border-accent/40 px-3 py-1.5 rounded text-center">
              <span className="text-[9px] text-chrome-dim block uppercase font-bold">Protocol Verdict</span>
              <span className="font-bold text-accent text-xs">NO DEMONSTRATED EDGE</span>
            </div>
          </div>

          {/* Per-Coin Breakdown Table */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-bold text-chrome-ink uppercase">
                Per-Coin Hold-Out Breakdown (May 2024 – Oct 2026 Sealed OOS)
              </h3>
              <span className="text-[10px] font-mono text-chrome-dim">Zero tuning per coin · Identical parameters</span>
            </div>
            <div className="overflow-x-auto border border-chrome-line rounded-lg">
              <table className="w-full min-w-[750px] text-left font-mono text-xs">
                <thead className="bg-chrome-field border-b border-chrome-line text-chrome-dim text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">Coin</th>
                    <th className="py-2 px-3">Trades</th>
                    <th className="py-2 px-3">True Win Rate</th>
                    <th className="py-2 px-3">Avg Net R (Optimistic Fills)</th>
                    <th className="py-2 px-3">Avg Net R (Pessimistic Fills)</th>
                    <th className="py-2 px-3">Fill Optimism Gap</th>
                    <th className="py-2 px-3">Pessimistic Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chrome-edge">
                  {paperMetrics?.perCoin && paperMetrics.perCoin.length > 0 ? (
                    paperMetrics.perCoin.map((c) => {
                      const isOptPos = c.avgNetR > 0;
                      const isStrictPos = c.strictAvgNetR > 0;
                      const inflation = c.avgNetR - c.strictAvgNetR;
                      return (
                        <tr key={c.coin} className="hover:bg-chrome-field/50 transition-colors">
                          <td className="py-2 px-3 font-bold text-chrome-ink">{c.coin}</td>
                          <td className="py-2 px-3 text-chrome-dim">{c.trades}</td>
                          <td className="py-2 px-3 text-chrome-dim">{c.trueWinRate}%</td>
                          <td className={`py-2 px-3 font-mono font-semibold ${isOptPos ? "text-win" : "text-loss"}`}>
                            {isOptPos ? "+" : ""}{c.avgNetR.toFixed(4)} R
                          </td>
                          <td className={`py-2 px-3 font-mono font-bold ${isStrictPos ? "text-win" : "text-loss"}`}>
                            {isStrictPos ? "+" : ""}{c.strictAvgNetR.toFixed(4)} R
                          </td>
                          <td className="py-2 px-3 text-accent font-mono">
                            +{inflation.toFixed(4)} R
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                isStrictPos
                                  ? "bg-win-tint text-win-dark border-win/30"
                                  : "bg-loss-tint text-loss-dark border-loss/30"
                              }`}
                            >
                              {isStrictPos ? "✔ POSITIVE" : "❌ NEGATIVE"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-chrome-dim">
                        Loading per-coin metrics...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Closed Paper Trades Stream */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-bold text-chrome-ink uppercase">
                Paper Trade Feed ({paperMetrics?.isLiveDataSource ? "Live Collection: paper_1h_a" : "Hold-Out Collection: backtest_holdout_1h_a"} · Latest 50 Trades)
              </h3>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-chrome-dim text-[11px]">Coin:</span>
                <select
                  value={paperCoinFilter}
                  onChange={(e) => setPaperCoinFilter(e.target.value)}
                  className="bg-chrome-field border border-chrome-line rounded px-2 py-0.5 text-xs font-bold text-chrome-ink outline-none cursor-pointer"
                >
                  <option value="ALL">All 5 Coins</option>
                  <option value="BTCUSDT">BTCUSDT</option>
                  <option value="ETHUSDT">ETHUSDT</option>
                  <option value="SOLUSDT">SOLUSDT</option>
                  <option value="BNBUSDT">BNBUSDT</option>
                  <option value="XRPUSDT">XRPUSDT</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-chrome-line rounded-lg max-h-72 overflow-y-auto">
              <table className="w-full min-w-[800px] text-left font-mono text-xs">
                <thead className="bg-chrome-field border-b border-chrome-line text-chrome-dim text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Entry Time (UTC)</th>
                    <th className="py-2 px-3">Exit Time (UTC)</th>
                    <th className="py-2 px-3">Coin</th>
                    <th className="py-2 px-3">Side</th>
                    <th className="py-2 px-3">Exit Type</th>
                    <th className="py-2 px-3">R Gross</th>
                    <th className="py-2 px-3">Taker Fee</th>
                    <th className="py-2 px-3">Net R (Optimistic Fills)</th>
                    <th className="py-2 px-3">Net R (Pessimistic Fills)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chrome-edge">
                  {paperTrades
                    .filter((t) => paperCoinFilter === "ALL" || t.coin === paperCoinFilter)
                    .slice(0, 50)
                    .map((t) => {
                      const isOptWin = t.R_net_taker > 0;
                      const isStrictWin = t.R_net_strict > 0;
                      return (
                        <tr key={t.id} className="hover:bg-chrome-field/50 transition-colors">
                          <td className="py-2 px-3 text-chrome-dim text-[11px] whitespace-nowrap">{t.entry_time}</td>
                          <td className="py-2 px-3 text-chrome-dim text-[11px] whitespace-nowrap">{t.exit_time}</td>
                          <td className="py-2 px-3 font-bold text-chrome-ink">{t.coin}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                t.side === "LONG" || t.side === "BUY"
                                  ? "bg-win-tint text-win-dark"
                                  : "bg-loss-tint text-loss-dark"
                              }`}
                            >
                              {t.side}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                t.exit_type === "TP"
                                  ? "bg-win-tint text-win-dark border-win/30"
                                  : t.exit_type === "BE"
                                  ? "bg-accent-tint text-accent border-accent/30"
                                  : "bg-loss-tint text-loss-dark border-loss/30"
                              }`}
                            >
                              {t.exit_type}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-semibold text-chrome-ink">
                            {t.R_gross >= 0 ? "+" : ""}{t.R_gross.toFixed(2)} R
                          </td>
                          <td className="py-2 px-3 text-accent font-mono">
                            -{t.cost_R_taker.toFixed(3)} R
                          </td>
                          <td className={`py-2 px-3 font-mono ${isOptWin ? "text-win" : "text-loss"}`}>
                            {t.R_net_taker >= 0 ? "+" : ""}{t.R_net_taker.toFixed(3)} R
                          </td>
                          <td className={`py-2 px-3 font-mono font-bold ${isStrictWin ? "text-win" : "text-loss"}`}>
                            {t.R_net_strict >= 0 ? "+" : ""}{t.R_net_strict.toFixed(3)} R
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default PaperTradingPanel;
