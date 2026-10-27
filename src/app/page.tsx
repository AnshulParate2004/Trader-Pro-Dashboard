import Link from "next/link";
import {
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Activity,
  BarChart2,
  Layers,
  Cpu,
  CheckCircle2,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-white font-sans text-gray-900 selection:bg-emerald-500/20">
      
      {/* Top Header Bar matching Terminal Header */}
      <header className="h-14 border-b border-gray-200 bg-white sticky top-0 z-50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-gray-900 flex items-center justify-center text-white font-mono text-xs font-bold shadow-sm">
            TP
          </div>
          <span className="font-mono text-sm font-bold tracking-tight text-gray-900">
            TRADER-PRO <span className="text-emerald-600 font-extrabold">QUANT</span>
          </span>
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full ml-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>SYSTEM ACTIVE</span>
          </div>
        </div>

        <nav className="flex items-center gap-3">
          <Link
            href="/ai-engine"
            className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900 bg-gray-50 border border-gray-300 font-mono text-xs font-bold px-3.5 py-2 rounded-md transition-all shadow-xs"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            AI Engine Logs
          </Link>

          <Link
            href="/terminal"
            className="flex items-center gap-1.5 bg-emerald-600 text-white font-mono text-xs font-bold px-4 py-2 rounded-md hover:bg-emerald-700 transition-all shadow-sm"
          >
            Launch Terminal
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-14 flex flex-col gap-12">
        
        {/* Simple & Clear Hero */}
        <div className="flex flex-col gap-5 text-center items-center max-w-2xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700 font-mono text-xs font-medium">
            <span className="text-emerald-600 font-bold">★ Ranked Quantitative Scalp Engine</span>
            <span>·</span>
            <span>Institutional Confluence</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight font-sans text-gray-900 leading-tight">
            Institutional Quantitative Precision For <span className="text-emerald-600">Crypto Scalping</span>
          </h1>

          <p className="text-gray-600 text-base leading-relaxed font-sans">
            Bridge your live TradingView charts directly into a statistical multi-timeframe quantitative terminal. Real-time Binance data feeds, dynamic support/resistance invariants, and automated <span className="font-mono font-semibold text-gray-900">+0.30R Breakeven Ratchets</span>.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/terminal"
              className="flex items-center gap-2 bg-gray-900 text-white font-mono text-sm font-bold px-6 py-3 rounded-lg hover:bg-black transition-all shadow-md"
            >
              Launch Live Terminal
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <a
              href="#metrics"
              className="flex items-center gap-2 bg-gray-50 border border-gray-300 text-gray-800 font-mono text-sm font-semibold px-5 py-3 rounded-lg hover:bg-gray-100 transition-all"
            >
              View Model Metrics
            </a>
          </div>
        </div>

        {/* Quantitative Invariants & Execution Parameters */}
        <section id="metrics" className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#f8f9fa] border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col gap-1 border-r border-gray-200 pr-4 last:border-none">
            <span className="text-xs font-mono text-gray-500 uppercase font-semibold">Risk : Reward</span>
            <span className="text-3xl font-extrabold font-mono text-emerald-600">1 : 1.50</span>
            <span className="text-[11px] text-gray-500 font-mono">Target Asymmetry</span>
          </div>
          <div className="flex flex-col gap-1 border-r border-gray-200 pr-4 last:border-none">
            <span className="text-xs font-mono text-gray-500 uppercase font-semibold">Breakeven Ratchet</span>
            <span className="text-3xl font-extrabold font-mono text-gray-900">+0.30R</span>
            <span className="text-[11px] text-gray-500 font-mono">Fee Protection Lock</span>
          </div>
          <div className="flex flex-col gap-1 border-r border-gray-200 pr-4 last:border-none">
            <span className="text-xs font-mono text-gray-500 uppercase font-semibold">Shark Exchange Fee</span>
            <span className="text-3xl font-extrabold font-mono text-blue-600">0.040%</span>
            <span className="text-[11px] text-gray-500 font-mono">Futures Taker (+18% GST)</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-mono text-gray-500 uppercase font-semibold">Paper Capital</span>
            <span className="text-3xl font-extrabold font-mono text-gray-900">₹1,000</span>
            <span className="text-[11px] text-gray-500 font-mono">1% Max Scalp Risk</span>
          </div>
        </section>

        {/* Simple 3-Column Architecture */}
        <section className="grid md:grid-cols-3 gap-5">
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:border-gray-300 transition-all">
            <div className="w-9 h-9 rounded bg-gray-50 border border-gray-200 flex items-center justify-center text-blue-600">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold font-mono text-gray-900">1. Chrome TV Scraper</h3>
            <p className="text-gray-600 text-xs leading-relaxed">
              Detects the active TradingView chart pair and timeframe automatically, injecting a floating quick trigger pill with zero DOM overhead.
            </p>
          </div>

          <div className="bg-white border-2 border-emerald-500/50 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:border-emerald-500 transition-all">
            <div className="w-9 h-9 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold font-mono text-emerald-700">2. #1 Sniper Scalp Engine</h3>
            <p className="text-gray-600 text-xs leading-relaxed">
              Calculates dynamic 50-bar swing pivots, true ATR, and volume Z-scores. Includes the <span className="font-mono font-semibold text-gray-900">+0.30R Breakeven Ratchet</span> to protect your capital.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:border-gray-300 transition-all">
            <div className="w-9 h-9 rounded bg-gray-50 border border-gray-200 flex items-center justify-center text-amber-600">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold font-mono text-gray-900">3. Full-Screen Terminal</h3>
            <p className="text-gray-600 text-xs leading-relaxed">
              Edge-to-edge light TradingView charts with genuine Binance feeds, dynamic S/R ladder, and institutional 1% risk position sizing.
            </p>
          </div>
        </section>

        {/* Action Callout */}
        <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-bold text-gray-900">Open Full-Screen Trading Desk</h4>
            <p className="text-xs text-gray-500">Live candlestick feeds, sniper execution triggers, and risk management.</p>
          </div>
          <Link
            href="/terminal"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold px-5 py-2.5 rounded-md transition-all whitespace-nowrap"
          >
            Launch Terminal Now
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

      </main>

      {/* Simple Footer */}
      <footer className="border-t border-gray-200 py-6 px-6 text-center text-xs font-mono text-gray-500">
        TRADER-PRO QUANTITATIVE TRADING PLATFORM · NEXT.JS 14
      </footer>

    </div>
  );
}