"use client";

import React, { useState } from "react";
import { BookOpen, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

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
  verdict: "ACTIVE_EDGE" | "NEGATIVE" | "NO_EDGE" | "INCONCLUSIVE" | "FAILED";
  verdictLabel: string;
  notes: string;
}

const RESEARCH_STUDIES: StudyRecord[] = [
  {
    id: "4h-swing-meta",
    strategy: "4H Swing Meta-Labeling (Donchian-20 Breakout + 200 SMA + LightGBM Filter)",
    timeframe: "4H",
    sample: "159 Clean OOS Trades",
    friction: "0.10% round-trip notional",
    avgNetR: "+0.175 R (OOS) [ACTIVE WINNING ENGINE]",
    winRate: "True: 52.8% · Net: 52.8%",
    confidenceInterval: "95% CI [+0.0820, +0.2676] R",
    protocolCheck: "Clean Purged Walk-Forward (2024-2026) with leak-free features, zero lookahead, and full 10 bps friction deducted. LightGBM Top 25% conviction filter triples return per trade and cuts drawdown by 76%.",
    verdict: "ACTIVE_EDGE",
    verdictLabel: "ACTIVE / VERIFIED OOS EDGE",
    notes: "Clean Purged Walk-Forward (2024-2026) with leak-free features, zero lookahead, and full 10 bps friction deducted. LightGBM Top 25% conviction filter triples return per trade and cuts drawdown by 76%.",
  },
  {
    id: "15m-btc-scalp",
    strategy: "15M BTC Scalper (LightGBM + Donchian-20)",
    timeframe: "15M",
    sample: "11,548 Trades (In-sample: model trained until 2026-10-26)",
    friction: "0.1144% round-trip notional",
    avgNetR: "-0.455 R (Middle) / -0.567 R (Strict) [SIMULATOR-BIASED, superseded: earlier -0.261R used biased simulator]",
    winRate: "True: 55.6% · Net: 34.6%",
    confidenceInterval: "95% CI [-0.5857, -0.5477] R",
    protocolCheck: "Simulator-biased: earlier +0.05R breakeven credits and same-candle ratchet arming created phantom returns. Unbiased net is deeply negative.",
    verdict: "NEGATIVE",
    verdictLabel: "NEGATIVE EXPECTANCY (SIMULATOR-BIASED, SUPERSEDED)",
    notes: "Simulator bias audit proved earlier simulator credited +0.05R on breakeven and armed ratchet same-candle. Under unbiased Middle mode (-0.455R) and Strict mode (-0.567R), net return is deeply negative.",
  },
  {
    id: "1h-a-multicoin",
    strategy: "Setup 1H-A Multi-Coin (1:1 TP/SL + 0.30R Ratchet)",
    timeframe: "1H",
    sample: "2,624 Trades (In-sample: model trained until 2026-10-26, not out-of-sample)",
    friction: "0.1144% round-trip notional",
    avgNetR: "-0.192 R (Middle) / -0.293 R (Strict) [SIMULATOR-BIASED, superseded: earlier +0.0412R used biased simulator]",
    winRate: "True: 56.2% · Net: 48.2%",
    confidenceInterval: "95% CI [-0.3297, -0.2557] R",
    protocolCheck: "Contaminated / In-sample: model trained until 2026-10-26. Failed all unbiased execution gates.",
    verdict: "NO_EDGE",
    verdictLabel: "NO DEMONSTRATED EDGE (IN-SAMPLE, SUPERSEDED)",
    notes: "Models were trained until 2026-10-26, so this data was in-sample, not an independent hold-out. Under unbiased execution, net return is negative.",
  },
  {
    id: "4h-a-macro",
    strategy: "Setup 4H-A Multi-Coin Breakout (18-Bar Horizon)",
    timeframe: "4H",
    sample: "598 Trades (In-sample: model trained until 2026-10-26, not out-of-sample)",
    friction: "0.1144% round-trip notional",
    avgNetR: "-0.007 R (Middle) / -0.108 R (Strict) [SIMULATOR-BIASED, superseded: earlier +0.0120R used biased simulator]",
    winRate: "True: 54.3% · Net: 45.1%",
    confidenceInterval: "95% CI [-0.1822, -0.0350] R",
    protocolCheck: "In-sample data overlap; bootstrap distribution crosses zero or negative",
    verdict: "INCONCLUSIVE",
    verdictLabel: "INCONCLUSIVE (IN-SAMPLE, SUPERSEDED)",
    notes: "Insufficient trade count and in-sample training overlap. Cannot reject null hypothesis of zero edge.",
  },
  {
    id: "4h-b-regime-filter",
    strategy: "Setup 4H-B Candidate (Regime + Trend Filter + R0)",
    timeframe: "4H",
    sample: "38 DEV + 65 Contaminated Trades (In-sample: model trained until 2026-10-26)",
    friction: "0.1144% round-trip notional",
    avgNetR: "-0.014 R (Middle) / -0.101 R (Strict) [SIMULATOR-BIASED, superseded: earlier +0.2814R used biased simulator]",
    winRate: "True: 58.5% · Net: 52.3%",
    confidenceInterval: "95% CI [-0.1963, -0.0033] R (Strict Mode)",
    protocolCheck: "Dev gates failed (38 trades); Hold-out contaminated (model trained until 2026-10-26); Net negative in strict mode",
    verdict: "FAILED",
    verdictLabel: "FAILED (IN-SAMPLE, SIMULATOR-BIASED, SUPERSEDED)",
    notes: "Not tested properly: dev gates failed (38 trades), hold-out has 65 trades; contaminated because model was trained through 2026-10-26. Under unbiased middle mode, net is -0.0141R; under strict mode, net is -0.1013R (95% CI [-0.1963, -0.0033]R). No positive edge survives.",
  },
  {
    id: "1h-c-asymmetric",
    strategy: "Setup 1H-C Asymmetric Breakout (1:2 TP/SL + 0.50R Ratchet)",
    timeframe: "1H",
    sample: "740 Pooled Trades (In-sample / not out-of-sample)",
    friction: "0.1144% round-trip notional",
    avgNetR: "-0.0180 R / trade [SIMULATOR-BIASED, superseded]",
    winRate: "True: 29.4% · Net: 26.8%",
    confidenceInterval: "95% CI [-0.0480, +0.0120] R",
    protocolCheck: "Negative net expectancy after taker friction drag",
    verdict: "FAILED",
    verdictLabel: "FAILED (FEE FRICTION DRAG, SUPERSEDED)",
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
              Strict point-in-time cross-validation with zero lookahead bias, tested against realistic taker friction (10 bps round-trip).
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
                if (study.verdict === "ACTIVE_EDGE") {
                  badgeClass = "bg-win-tint text-chrome-green-ink border-win/40 font-black";
                } else if (study.verdict === "NO_EDGE") {
                  badgeClass = "bg-blue-50 text-chrome-dim border-blue-200";
                } else if (study.verdict === "INCONCLUSIVE") {
                  badgeClass = "bg-chrome-field text-chrome-dim border-chrome-line";
                }

                const isWinner = study.verdict === "ACTIVE_EDGE";

                return (
                  <tr
                    key={study.id}
                    className={`transition-colors ${
                      isWinner ? "bg-win-tint/15 hover:bg-win-tint/30" : "hover:bg-chrome-field/40"
                    }`}
                  >
                    <td className="py-3 px-3.5">
                      <div className="flex flex-col gap-1 max-w-md">
                        <span className={`font-bold leading-snug ${isWinner ? "text-chrome-green-ink" : "text-chrome-ink"}`}>
                          {study.strategy}
                        </span>
                        <span className="text-[11px] text-chrome-dim font-sans leading-relaxed">{study.notes}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-chrome-dim font-bold whitespace-nowrap">
                      {study.timeframe}
                    </td>
                    <td className="py-3 px-3 text-chrome-dim text-[11px]">
                      {study.sample}
                    </td>
                    <td className={`py-3 px-3 font-bold whitespace-nowrap ${isWinner ? "text-win" : "text-chrome-ink"}`}>
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
