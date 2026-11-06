import Link from "next/link";
import UserAuthPill from "@/components/UserAuthPill";
import {
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-chrome-bg font-body text-chrome-ink selection:bg-accent-tint selection:text-chrome-ink">
      
      {/* Top Header Bar matching Portfolio & Terminal Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-chrome-line px-4 sm:px-8 py-3.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <span className="size-6 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center shrink-0">
            TP
          </span>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2">
            <span className="font-brand text-lg font-medium tracking-tight text-chrome-ink">
              Trader-Pro
            </span>
            <span className="font-mono text-xs lowercase text-chrome-dim hidden sm:inline">
              btc strategy research &amp; paper-trading
            </span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] text-chrome-green-ink bg-win-tint border border-win/30 px-2 py-0.5 rounded ml-2">
            <span className="size-1.5 rounded-full bg-chrome-green animate-pulse" />
            <span>PAPER SYSTEM ACTIVE</span>
          </div>
        </div>

        <nav className="flex items-center gap-2.5">
          <Link
            href="/ai-engine"
            className="flex items-center gap-1 text-chrome-dim hover:text-chrome-ink bg-white border border-chrome-line font-mono text-xs font-bold px-3 py-1.5 rounded transition-all shadow-xs hover:border-chrome-ink"
          >
            <Zap className="w-3.5 h-3.5 text-chrome-green-ink" />
            <span>AI Engine Logs</span>
          </Link>

          <Link
            href="/terminal"
            className="flex items-center gap-1 bg-accent hover:bg-accent-hover text-white font-mono text-xs font-bold px-3.5 py-1.5 rounded transition-all shadow-xs"
          >
            <span>Launch Terminal</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>

          <UserAuthPill />
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-10">
        
        {/* Simple & Clear Hero */}
        <div className="flex flex-col gap-4 text-center items-center max-w-2xl mx-auto pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white border border-chrome-line text-chrome-dim font-mono text-xs">
            <span className="text-chrome-green-ink font-bold">● Walk-Forward Strategy Research</span>
            <span>·</span>
            <span>Zero Lookahead Bias</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-brand font-medium tracking-tight text-chrome-ink leading-tight">
            BTC Strategy Research &amp; <span className="text-chrome-green-ink">Paper-Trading Dashboard</span>
          </h1>

          <p className="text-chrome-dim text-sm sm:text-base leading-relaxed font-body max-w-xl">
            A transparent quantitative research terminal evaluating algorithmic BTC models under realistic taker friction (0.040% fee + 18% GST + 0.010% slippage per side).
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/ai-engine"
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-mono text-sm font-bold px-6 py-2.5 rounded transition-all shadow-xs"
            >
              View Research &amp; Paper Engine
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              href="/terminal"
              className="flex items-center gap-2 bg-white border border-chrome-line text-chrome-ink font-mono text-sm font-semibold px-5 py-2.5 rounded hover:bg-chrome-field transition-all shadow-xs"
            >
              Open Live Chart Terminal
            </Link>
          </div>
        </div>

        {/* Honest Parameters & Invariants */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white border border-chrome-line rounded-lg p-5 shadow-xs">
          <div className="flex flex-col gap-0.5 border-r border-chrome-edge pr-3 last:border-none">
            <span className="text-[10px] font-mono text-chrome-dim uppercase font-bold">Honest Fee Model</span>
            <span className="text-2xl font-bold font-mono text-chrome-green-ink">0.1144%</span>
            <span className="text-[10px] text-chrome-dim font-mono">Round-Trip Taker + GST + Slip</span>
          </div>
          <div className="flex flex-col gap-0.5 border-r border-chrome-edge pr-3 last:border-none">
            <span className="text-[10px] font-mono text-chrome-dim uppercase font-bold">15M Net Expectancy</span>
            <span className="text-2xl font-bold font-mono text-loss">-0.261 R</span>
            <span className="text-[10px] text-chrome-dim font-mono">Paper-Trading Mode Only</span>
          </div>
          <div className="flex flex-col gap-0.5 border-r border-chrome-edge pr-3 last:border-none">
            <span className="text-[10px] font-mono text-chrome-dim uppercase font-bold">Exchange Fee Base</span>
            <span className="text-2xl font-bold font-mono text-chrome-ink">0.040%</span>
            <span className="text-[10px] text-chrome-dim font-mono">Shark Exchange Default</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-mono text-chrome-dim uppercase font-bold">Paper Capital</span>
            <span className="text-2xl font-bold font-mono text-chrome-ink">₹1,000</span>
            <span className="text-[10px] text-chrome-dim font-mono">1% Max Risk / Trade</span>
          </div>
        </section>

        {/* 3-Column Architecture */}
        <section className="grid md:grid-cols-3 gap-4">
          <div className="bg-white border border-chrome-line rounded-lg p-4 sm:p-5 flex flex-col gap-2.5 shadow-xs">
            <div className="w-8 h-8 rounded bg-chrome-field border border-chrome-line flex items-center justify-center text-accent">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold font-mono text-chrome-ink uppercase">1. Live Market Bridge</h3>
            <p className="text-chrome-dim text-xs leading-relaxed font-body">
              Pulls live closed candles from Binance data feeds and evaluates LightGBM conviction models strictly at bar close.
            </p>
          </div>

          <div className="bg-white border border-accent/40 rounded-lg p-4 sm:p-5 flex flex-col gap-2.5 shadow-xs">
            <div className="w-8 h-8 rounded bg-accent-tint border border-accent/30 flex items-center justify-center text-accent">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold font-mono text-accent uppercase">2. Honest Post-Fee Metrics</h3>
            <p className="text-chrome-dim text-xs leading-relaxed font-body">
              All metrics track true win rate, net win rate, and net R after accounting for 0.04% taker fee, 18% GST, and 0.01% slippage.
            </p>
          </div>

          <div className="bg-white border border-chrome-line rounded-lg p-4 sm:p-5 flex flex-col gap-2.5 shadow-xs">
            <div className="w-8 h-8 rounded bg-chrome-field border border-chrome-line flex items-center justify-center text-chrome-dim">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold font-mono text-chrome-ink uppercase">3. Sealed Hold-Out Studies</h3>
            <p className="text-chrome-dim text-xs leading-relaxed font-body">
              Pre-registered multi-coin walk-forward studies across BTC, ETH, SOL, BNB, and XRP with transparent verdicts.
            </p>
          </div>
        </section>

        {/* Action Callout */}
        <div className="bg-white border border-chrome-line rounded-lg p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div>
            <h4 className="text-sm font-brand font-medium text-chrome-ink">Inspect Research &amp; Execution Stream</h4>
            <p className="text-xs text-chrome-dim font-body mt-0.5">Explore the live paper engine, walk-forward research studies, and trade logs.</p>
          </div>
          <Link
            href="/ai-engine"
            className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-mono text-xs font-bold px-4 py-2 rounded transition-all shadow-xs whitespace-nowrap"
          >
            Launch AI Engine
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

      </main>

      {/* Simple Footer Note */}
      <footer className="border-t border-chrome-line py-8 px-6 bg-white text-center font-mono text-xs text-chrome-dim flex flex-col items-center justify-center gap-2 select-none">
        <p className="font-semibold text-chrome-ink">
          Research and paper trading only. Not financial advice.
        </p>
        <p className="text-[11px] text-chrome-dim">
          Trader-Pro · BTC strategy research and paper-trading dashboard
        </p>
      </footer>

    </div>
  );
}
