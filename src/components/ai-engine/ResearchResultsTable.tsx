"use client";

import React, { useState } from "react";
import { BookOpen, ShieldCheck, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface StudyRecord {
  id: string;
  strategy: string;
  timeframe: string;
  sample: string;
  friction: string;
  avgNetR: string;
  winRate: string;
  confidenceInterval: string;
  protocolCheck: string;
  verdict: "NEGATIVE" | "NO_EDGE" | "INCONCLUSIVE" | "FAILED";
  verdictLabel: string;
  notes: string;
}

const RESEARCH_STUDIES: StudyRecord[] = [
  {
    id: "15m-btc-scalp",
    strategy: "15M BTC Scalper (LightGBM + Donchian-20)",
    timeframe: "15M",
    sample: "6,538 OOS Backtest + 50 Live Executions",
    friction: "0.1144% round-trip notional",
    avgNetR: "-0.261 R (Live) / -0.301 R (Backtest)",
    winRate: "True: 62.0% · Net: 34.6%",
    confidenceInterval: "[-0.325, -0.278] R",
    protocolCheck: "61.3% exits at breakeven trigger fees without capturing alpha",
    verdict: "NEGATIVE",
    verdictLabel: "NEGATIVE EXPECTANCY (PAPER ONLY)",
    notes: "Round-trip taker fees and slippage drain capital. Sub-breakeven expectancy. Real-money trading locked.",
  },
  {
    id: "1h-a-multicoin",
    strategy: "Setup 1H-A Multi-Coin (1:1 TP/SL + 0.30R Ratchet)",
    timeframe: "1H",
    sample: "1,099 Pooled Hold-Out Trades (BTC, ETH, SOL, BNB, XRP)",
    friction: "0.1144% round-trip notional",
    avgNetR: "+0.0412 R / trade",
    winRate: "True: 59.1% · Net: 48.2%",
    confidenceInterval: "95% CI [-0.0052, +0.0856] R",
    protocolCheck: "Failed 2 of 3 pre-registered criteria (CI spans 0; 3/5 coins positive)",
    verdict: "NO_EDGE",
    verdictLabel: "NO DEMONSTRATED EDGE",
    notes: "While pooled average is slightly positive (+0.0412R), the 95% bootstrap CI spans zero (-0.0052R) and only 3/5 coins showed positive returns.",
  },
  {
    id: "4h-a-macro",
    strategy: "Setup 4H-A Multi-Coin Breakout (18-Bar Horizon)",
    timeframe: "4H",
    sample: "312 Pooled Hold-Out Trades (5 coins)",
    friction: "0.1144% round-trip notional",
    avgNetR: "+0.0120 R / trade",
    winRate: "True: 54.3% · Net: 45.1%",
    confidenceInterval: "95% CI [-0.0210, +0.0450] R",
    protocolCheck: "Low trade sample size; bootstrap distribution crosses zero",
    verdict: "INCONCLUSIVE",
    verdictLabel: "INCONCLUSIVE (CI CROSSES ZERO)",
    notes: "Insufficient trade count to establish statistical significance. Cannot reject null hypothesis of zero edge.",
  },
  {
    id: "4h-b-regime-filter",
    strategy: "Setup 4H-B Candidate (Regime + Trend Filter + R0)",
    timeframe: "4H",
    sample: "38 DEV + 65 Sealed Hold-Out Trades (BTCUSDT)",
    friction: "0.1144% round-trip notional",
    avgNetR: "+0.2814 R / trade (Hold-Out)",
    winRate: "True: 58.5% · Net: 52.3%",
    confidenceInterval: "95% CI [+0.0483, +0.5069] R",
    protocolCheck: "Failed pre-registered sample size threshold (N = 65 < 150 trades)",
    verdict: "NO_EDGE",
    verdictLabel: "NO DEMONSTRATED EDGE (N < 150 TRADES)",
    notes: "Although hold-out net expectancy was positive (+0.2814R) and CI lower bound remained positive (+0.0483R), 4H-B produced only 65 closed trades (38 on DEV), strictly failing the pre-registered minimum of 150 trades. Excluded from live cron.",
  },
  {
    id: "1h-c-asymmetric",
    strategy: "Setup 1H-C Asymmetric Breakout (1:2 TP/SL + 0.50R Ratchet)",
    timeframe: "1H",
    sample: "740 Pooled Hold-Out Trades (5 coins)",
    friction: "0.1144% round-trip notional",
    avgNetR: "-0.0180 R / trade",
    winRate: "True: 29.4% · Net: 26.8%",
    confidenceInterval: "95% CI [-0.0480, +0.0120] R",
    protocolCheck: "Negative net expectancy after taker friction drag",
    verdict: "FAILED",
    verdictLabel: "FAILED (FEE FRICTION DRAG)",
    notes: "Lower win rate of 1:2 R:R fails to overcome cumulative round-trip exchange fees and slippage on crypto futures.",
  },
];

export const ResearchResultsTable: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section
      aria-label="Walk-Forward Strategy Research Studies & Verdicts"
      className="w-full bg-white border border-chrome-line rounded-lg overflow-hidden shadow-xs"
    >
      {/* Table Header */}
      <div className="p-4 bg-chrome-field border-b border-chrome-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-accent" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="font-brand text-sm font-medium tracking-tight text-chrome-ink uppercase">
                Walk-Forward Strategy Research &amp; Honest Verdicts
              </h2>
              <span className="font-mono text-[10px] bg-chrome-canvas text-chrome-dim border border-chrome-line px-2 py-0.5 rounded font-bold">
                SEALED OOS PROTOCOLS
              </span>
            </div>
            <p className="font-body text-xs text-chrome-dim mt-0.5">
              Strict point-in-time cross-validation with zero lookahead bias, tested against realistic taker friction (0.1144% round-trip).
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 font-mono text-xs text-chrome-dim hover:text-chrome-ink bg-white border border-chrome-line px-2.5 py-1 rounded transition-colors self-start sm:self-auto cursor-pointer"
        >
          <span>{isExpanded ? "Collapse Studies" : "Expand Studies"}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Table Content */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-chrome-field/60 border-b border-chrome-line text-chrome-dim uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3.5 w-[36%] min-w-[320px]">Study / Strategy</th>
                <th className="py-2.5 px-3 w-[6%] min-w-[50px]">TF</th>
                <th className="py-2.5 px-3 w-[20%] min-w-[180px]">Sample Size</th>
                <th className="py-2.5 px-3 w-[15%] min-w-[150px]">Avg Net R (Taker)</th>
                <th className="py-2.5 px-3 w-[12%] min-w-[130px]">95% Bootstrap CI</th>
                <th className="py-2.5 px-3.5 w-[11%] min-w-[190px]">Pre-Registered Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chrome-edge">
              {RESEARCH_STUDIES.map((study) => {
                let badgeClass = "bg-rose-50 text-loss-dark border-loss/30";
                if (study.verdict === "NO_EDGE") {
                  badgeClass = "bg-blue-50 text-chrome-dim border-blue-200";
                } else if (study.verdict === "INCONCLUSIVE") {
                  badgeClass = "bg-chrome-field text-chrome-dim border-chrome-line";
                }

                return (
                  <tr key={study.id} className="hover:bg-chrome-field/40 transition-colors">
                    <td className="py-3 px-3.5">
                      <div className="flex flex-col gap-1 max-w-md">
                        <span className="font-bold text-chrome-ink leading-snug">{study.strategy}</span>
                        <span className="text-[11px] text-chrome-dim font-sans leading-relaxed">{study.notes}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-chrome-dim font-bold whitespace-nowrap">
                      {study.timeframe}
                    </td>
                    <td className="py-3 px-3 text-chrome-dim text-[11px]">
                      {study.sample}
                    </td>
                    <td className="py-3 px-3 font-bold whitespace-nowrap text-chrome-ink">
                      {study.avgNetR}
                    </td>
                    <td className="py-3 px-3 text-chrome-dim text-[11px] whitespace-nowrap">
                      {study.confidenceInterval}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold border inline-block ${badgeClass}`}>
                        {study.verdictLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ResearchResultsTable;
