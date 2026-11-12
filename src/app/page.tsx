import Link from "next/link";
import UserAuthPill from "@/components/UserAuthPill";
import {
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  Sparkles,
  TrendingUp,
  Database,
  BarChart2,
  Clock,
  DollarSign,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-8 py-3 flex items-center justify-between select-none shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="size-7 rounded-lg bg-slate-900 text-white text-xs font-mono font-bold flex items-center justify-center shrink-0 shadow-xs">
            TP
          </span>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2">
            <span className="font-mono text-base font-black tracking-tight text-slate-900">
              TRADER-PRO
            </span>
            <span className="font-mono text-xs text-slate-500 hidden sm:inline">
              institutional quantitative research &amp; paper execution
            </span>
          </div>
        </div>

        {/* Header Links & Market Switchers */}
        <nav className="flex items-center gap-2">
          <Link
            href="/terminal"
            className="hidden md:flex items-center gap-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-mono text-xs font-bold transition-all"
            title="Launch 24/7 Perpetual Derivatives Terminal"
          >
            <span>🪙 Perp Terminal (₹)</span>
          </Link>

          <Link
            href="/equities"
            className="hidden md:flex items-center gap-1.5 text-blue-700 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 font-mono text-xs font-bold transition-all"
            title="Launch US Equities Stock Terminal"
          >
            <span>🇺🇸 US Stock Terminal ($)</span>
          </Link>

          <UserAuthPill />
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-10">
        
        {/* Hero Section */}
        <div className="flex flex-col gap-3 text-center items-center max-w-3xl mx-auto pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 font-mono text-xs shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-slate-900">Segregated Multi-Market Platform</span>
            <span>·</span>
            <span>Zero Cross-Market Co-Mingling</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-mono font-black tracking-tight text-slate-900 leading-tight">
            Institutional Quantitative Terminals &amp; <span className="text-blue-600">AI Strategy Engines</span>
          </h1>

          <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-sans max-w-2xl">
            Choose your specialized market below. The platform provides two completely segregated trading environments with dedicated charts, isolated capital baselines, distinct fee structures, and separate AI engines.
          </p>
        </div>

        {/* Dual-Market Gateway Cards (Side by Side Segregation) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          
          {/* Market 1: Crypto & Commodities Perpetual Derivatives */}
          <div className="bg-white border-2 border-emerald-500/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-emerald-500 text-white font-mono text-[10px] font-black uppercase px-3 py-1 rounded-bl-lg tracking-wider">
              24/7/365 CONTINUOUS · INR
            </div>

            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 text-2xl shadow-2xs">
                🪙
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-mono font-black text-slate-900">
                    24x7 Perpetual Derivatives
                  </h2>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                    COINSWITCH PRO
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Crypto &amp; Commodities Systematic Swing Trading
                </p>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Algorithmic 4H and 1H models executing on Bitcoin, Ethereum, Solana, Gold, Silver, and Crude Oil.
                Calibrated to realistic taker fees (0.040% fee + 18% GST + 1% TDS).
              </p>

              {/* Key Specs */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Base Capital</span>
                  <span className="font-bold text-slate-900">₹7,000.00 INR</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Trading Hours</span>
                  <span className="font-bold text-emerald-700">24/7 Continuous</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Brain</span>
                  <span className="font-bold text-slate-900">4H Timeframe Router</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Cadence</span>
                  <span className="font-bold text-blue-700">2-Min Live Engine</span>
                </div>
              </div>
            </div>

            {/* Launch Buttons */}
            <div className="pt-6 space-y-2">
              <Link
                href="/terminal"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-sm font-bold px-4 py-3 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <span>Launch Crypto &amp; Cmdty Terminal</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Link
                href="/ai-engine"
                className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                <span>Open Crypto AI Engine Logs</span>
              </Link>
            </div>
          </div>

          {/* Market 2: US Equities Institutional Book */}
          <div className="bg-white border-2 border-blue-500/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-blue-600 text-white font-mono text-[10px] font-black uppercase px-3 py-1 rounded-bl-lg tracking-wider">
              NYSE REGULATED · USD
            </div>

            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 text-2xl shadow-2xs">
                🇺🇸
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-mono font-black text-slate-900">
                    US Equities Institutional
                  </h2>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                    S&amp;P 500 TOP 30
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Point-in-Time Daily Systematic Stocks &amp; Benchmark Tracking
                </p>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Point-in-time Top 30 US equities (SPY, AAPL, NVDA, MSFT, AMZN, META, TSLA).
                Causal SEC EDGAR XBRL filings, 200-day SMA regime shield, and next-day open fills (O_(t+1)).
              </p>

              {/* Key Specs */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Base Capital</span>
                  <span className="font-bold text-slate-900">$100.00 USD</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Trading Hours</span>
                  <span className="font-bold text-blue-700">09:30 - 16:00 ET</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Brain</span>
                  <span className="font-bold text-slate-900">S2 Momentum + 200 SMA</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">SEC Compliance</span>
                  <span className="font-bold text-emerald-700">Filing Date (Zero Bias)</span>
                </div>
              </div>
            </div>

            {/* Launch Buttons */}
            <div className="pt-6 space-y-2">
              <Link
                href="/equities"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-mono text-sm font-bold px-4 py-3 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <span>Launch US Stock Terminal</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Link
                href="/equities/ai-engine"
                className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Open US Strategy Engine &amp; Factor Surfaces</span>
              </Link>
            </div>
          </div>

        </section>

        {/* Platform Integrity & Invariant Pillars */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-mono text-xs font-bold uppercase text-slate-900">Strict Capital Isolation</h3>
            <p className="text-xs text-slate-600 font-sans leading-relaxed">
              Crypto/Commodity balances (INR) and US Equities accounts (USD) are stored in isolated database collections and never merged.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="font-mono text-xs font-bold uppercase text-slate-900">Point-in-Time Data Only</h3>
            <p className="text-xs text-slate-600 font-sans leading-relaxed">
              US Equities use SEC EDGAR acceptance dates (<code className="font-mono text-blue-700">filed &le; t</code>). Truncation test verifies bit-for-bit parity across 200 random dates.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="font-mono text-xs font-bold uppercase text-slate-900">Separate Specialized AI Brains</h3>
            <p className="text-xs text-slate-600 font-sans leading-relaxed">
              Crypto uses a 4H multi-asset LightGBM router; US equities uses an empirical 200-SMA regime shield with point-in-time momentum and value composites.
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
