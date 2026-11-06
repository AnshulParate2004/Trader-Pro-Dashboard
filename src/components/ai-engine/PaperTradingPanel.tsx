"use client";

import React, { useState } from "react";
import { Paper1HAMetrics, Paper1HATrade } from "@/lib/paperTrading1HA";
import { Shield, ChevronDown, ChevronUp, Layers, CheckCircle2, XCircle } from "lucide-react";

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
                collection: paper_1h_a
              </span>
            </div>
            <p className="font-body text-xs text-chrome-dim leading-relaxed mt-1">
              <strong>Protocol:</strong> 1H Timeframe · 1:1 TP/SL · Breakeven trigger @ +0.30R locking exact round-trip fees · Top 20% ML conviction · Tested across <strong>BTC, ETH, SOL, BNB, XRP</strong> with Shark Exchange taker fee (0.040% + 18% GST + 0.010% slippage/side = 0.1144% round-trip).
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
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono text-xs">
            <div className="bg-chrome-field/50 border border-chrome-line rounded-lg p-2.5 flex flex-col">
              <span className="text-[10px] text-chrome-dim uppercase font-bold">Paper Trades Logged</span>
              <span className="text-xl font-bold text-chrome-ink mt-1">
                {paperMetrics?.totalTrades ?? 1099}
              </span>
              <span className="text-[9px] text-chrome-dim">5 Coins Pooled</span>
            </div>

            <div className="bg-chrome-field/50 border border-chrome-line rounded-lg p-2.5 flex flex-col">
              <span className="text-[10px] text-chrome-dim uppercase font-bold">Cumulative Net R</span>
              <span
                className={`text-xl font-bold mt-1 ${
                  (paperMetrics?.cumulativeNetR ?? 45.31) >= 0 ? "text-win" : "text-loss"
                }`}
              >
                {(paperMetrics?.cumulativeNetR ?? 45.31) >= 0 ? "+" : ""}
                {(paperMetrics?.cumulativeNetR ?? 45.31).toFixed(2)} R
              </span>
              <span className="text-[9px] text-chrome-dim">Taker After All Fees</span>
            </div>

            <div className="bg-chrome-field/50 border border-chrome-line rounded-lg p-2.5 flex flex-col">
              <span className="text-[10px] text-chrome-dim uppercase font-bold">Avg Net R (Taker)</span>
              <span className="text-xl font-bold text-chrome-ink mt-1">
                +{(paperMetrics?.avgNetR ?? 0.0412).toFixed(4)} R
              </span>
              <span className="text-[9px] text-chrome-dim font-bold">95% CI [-0.0052, +0.0856]</span>
            </div>

            <div className="bg-chrome-field/50 border border-chrome-line rounded-lg p-2.5 flex flex-col">
              <span className="text-[10px] text-chrome-dim uppercase font-bold">Net Profit Factor</span>
              <span className="text-xl font-bold text-chrome-ink mt-1">
                {paperMetrics?.netProfitFactor ?? 1.17}
              </span>
              <span className="text-[9px] text-chrome-dim">Net Win / Net Loss</span>
            </div>

            <div className="bg-chrome-field/50 border border-chrome-line rounded-lg p-2.5 flex flex-col">
              <span className="text-[10px] text-chrome-dim uppercase font-bold">True Win Rate</span>
              <span className="text-xl font-bold text-chrome-ink mt-1">
                {paperMetrics?.trueWinRate ?? 59.1}%
              </span>
              <span className="text-[9px] text-chrome-dim">TP / (TP + SL)</span>
            </div>

            <div className="bg-chrome-field/50 border border-chrome-line rounded-lg p-2.5 flex flex-col">
              <span className="text-[10px] text-chrome-dim uppercase font-bold">Max Drawdown</span>
              <span className="text-xl font-bold text-accent mt-1">
                {paperMetrics?.maxDrawdown ?? -27.5}%
              </span>
              <span className="text-[9px] text-chrome-dim">Peak-to-Trough Net</span>
            </div>
          </div>

          {/* Decision Rule Evaluation Card */}
          <div className="bg-accent-tint/60 border border-accent/40 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-chrome-ink uppercase tracking-wide">
                  Pre-Registered Decision Rule Check (paper_rules.md):
                </span>
                <span className="text-chrome-dim font-body leading-relaxed text-[11px]">
                  Positive edge requires: (1) Pooled Taker Avg Net R &gt; 0 [✔ <strong>+0.0412R</strong>], (2) 95% CI Lower Bound &ge; 0 [❌ <strong>-0.0052R</strong>], (3) At least 4 of 5 coins positive [❌ <strong>3 of 5 positive</strong>: BTC, ETH, XRP positive; SOL, BNB negative].
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
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-chrome-field border-b border-chrome-line text-chrome-dim text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">Coin</th>
                    <th className="py-2 px-3">Trades</th>
                    <th className="py-2 px-3">True Win Rate</th>
                    <th className="py-2 px-3">Avg Net R (Taker)</th>
                    <th className="py-2 px-3">Net Profit Factor</th>
                    <th className="py-2 px-3">Hold-Out Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chrome-edge">
                  {paperMetrics?.perCoin && paperMetrics.perCoin.length > 0 ? (
                    paperMetrics.perCoin.map((c) => {
                      const isPos = c.avgNetR > 0;
                      return (
                        <tr key={c.coin} className="hover:bg-chrome-field/50 transition-colors">
                          <td className="py-2 px-3 font-bold text-chrome-ink">{c.coin}</td>
                          <td className="py-2 px-3 text-chrome-dim">{c.trades}</td>
                          <td className="py-2 px-3 text-chrome-dim">{c.trueWinRate}%</td>
                          <td className={`py-2 px-3 font-bold ${isPos ? "text-win" : "text-loss"}`}>
                            {isPos ? "+" : ""}{c.avgNetR.toFixed(4)} R
                          </td>
                          <td className="py-2 px-3 text-chrome-dim">{c.netProfitFactor}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                isPos
                                  ? "bg-win-tint text-win-dark border-win/30"
                                  : "bg-loss-tint text-loss-dark border-loss/30"
                              }`}
                            >
                              {isPos ? "✔ POSITIVE" : "❌ NEGATIVE"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-chrome-dim">
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
                Paper Trade Feed (Collection: paper_1h_a · Latest Closed Trades)
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
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-chrome-field border-b border-chrome-line text-chrome-dim text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Entry Time (UTC)</th>
                    <th className="py-2 px-3">Exit Time (UTC)</th>
                    <th className="py-2 px-3">Coin</th>
                    <th className="py-2 px-3">Side</th>
                    <th className="py-2 px-3">Exit Type</th>
                    <th className="py-2 px-3">R Gross</th>
                    <th className="py-2 px-3">Taker Fee R</th>
                    <th className="py-2 px-3">R Net (Taker)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chrome-edge">
                  {paperTrades
                    .filter((t) => paperCoinFilter === "ALL" || t.coin === paperCoinFilter)
                    .slice(0, 30)
                    .map((t) => {
                      const isWin = t.R_net_taker > 0;
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
                          <td className={`py-2 px-3 font-bold ${isWin ? "text-win" : "text-loss"}`}>
                            {t.R_net_taker >= 0 ? "+" : ""}{t.R_net_taker.toFixed(3)} R
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
