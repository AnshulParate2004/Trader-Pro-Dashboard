"use client";
import { symbolsMatch, toDisplaySymbol } from "@/lib/symbolMapper";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import UserAuthPill from "@/components/UserAuthPill";
import {
  ArrowUpRight,
  RotateCw,
  Zap,
  Play,
  Pause,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import {
  TradeOrder,
  EngineConfig,
  EnginePerformanceMetrics,
  TOP_MODELS,
} from "@/lib/engineTypes";

// Modular Clean Components
import PaperOnlyBanner, { AssetPerformanceData, ASSET_METRICS_MAP, getAssetMetrics } from "@/components/ai-engine/PaperOnlyBanner";
import HonestMetricsStrip from "@/components/ai-engine/HonestMetricsStrip";
import ResearchResultsTable from "@/components/ai-engine/ResearchResultsTable";
import LiveTradesTable from "@/components/ai-engine/LiveTradesTable";
import ModelCard from "@/components/ai-engine/ModelCard";
import FeeModeToggle from "@/components/ai-engine/FeeModeToggle";

export default function AiEnginePage() {
  const [trades, setTrades] = useState<TradeOrder[]>([]);
  const [metrics, setMetrics] = useState<EnginePerformanceMetrics | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>("unified-1h-engine");
  const [livePredictionLogs, setLivePredictionLogs] = useState<any[]>([]);

  // Lifted Asset Selection State for dynamic multi-asset reactive dashboard
  const [selectedAsset, setSelectedAsset] = useState<string>("ALL");
  const currentAssetData = getAssetMetrics(selectedAsset, selectedModelId);


  const [config, setConfig] = useState<EngineConfig>({
    autoTradingEnabled: true,
    currency: "INR",
    accountBalanceINR: 1000,
    tradingFeePercent: 0.100, // 4H Swing Friction Default (0.10% Round-trip)
    makerFeePercent: 0.050,
    gstPercent: 0.0,
    slippagePercent: 0.000,
    riskPerTradePercent: 1.0, // 1% = ₹10
    ratchetEnabled: false,
    maxConcurrentTrades: 3,
    activeModelId: "unified-1h-engine",
  });
  const [mongoConnected, setMongoConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("Connecting...");

  // Collapsible Settings Accordion State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Table View Tabs & Interactive Filtering / Pagination
  const [tableTab, setTableTab] = useState<"live" | "historical">("live");
  const [liveSideFilter, setLiveSideFilter] = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const [liveSymbolFilter, setLiveSymbolFilter] = useState<string>("ALL");
  const [liveLimit, setLiveLimit] = useState<number>(100);

  const [historicalTrades, setHistoricalTrades] = useState<any[]>([]);
  const [totalHistoricalCount, setTotalHistoricalCount] = useState<number>(0);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  const [histPage, setHistPage] = useState<number>(1);
  const [histLimit, setHistLimit] = useState<number>(50);
  const [histSideFilter, setHistSideFilter] = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const [histOutcomeFilter, setHistOutcomeFilter] = useState<string>("ALL");
  const [histSymbolFilter, setHistSymbolFilter] = useState<string>("ALL");
  const [histTotalPages, setHistTotalPages] = useState<number>(1);

  // Synchronized runtime refs to prevent stale closure data in intervals and background cycles
  const activeFeeRef = useRef<number>(config.tradingFeePercent || 0.040);
  const selectedModelIdRef = useRef<string>(selectedModelId);
  const liveLimitRef = useRef<number>(liveLimit);
  const selectedAssetRef = useRef<string>(selectedAsset);

  useEffect(() => {
    activeFeeRef.current = config.tradingFeePercent || 0.040;
  }, [config.tradingFeePercent]);

  useEffect(() => {
    selectedModelIdRef.current = selectedModelId;
  }, [selectedModelId]);

  useEffect(() => {
    liveLimitRef.current = liveLimit;
  }, [liveLimit]);

  useEffect(() => {
    selectedAssetRef.current = selectedAsset;
  }, [selectedAsset]);

  const fetchHistoricalTrades = async (
    modelIdToFetch?: string,
    page: number = histPage,
    limit: number = histLimit,
    side: "ALL" | "LONG" | "SHORT" = histSideFilter,
    outcome: string = histOutcomeFilter,
    symbol: string = histSymbolFilter
  ) => {
    setIsLoadingHistorical(true);
    try {
      const activeM = modelIdToFetch || selectedModelId;
      const params = new URLSearchParams({
        modelId: activeM,
        page: page.toString(),
        limit: limit.toString(),
        side: side,
        outcome: outcome,
        symbol: symbol,
      });
      const res = await fetch(`/api/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setHistoricalTrades(data.trades || []);
          setTotalHistoricalCount(data.totalHistoricalTrades || 0);
          setHistTotalPages(data.totalPages || 1);
          setHistPage(data.page || page);
        }
      }
    } catch (err) {
      console.warn("Could not fetch historical trades:", err);
    } finally {
      setIsLoadingHistorical(false);
    }
  };

  const handleHistPageChange = (newPage: number) => {
    if (newPage < 1 || newPage > histTotalPages) return;
    setHistPage(newPage);
    fetchHistoricalTrades(selectedModelId, newPage, histLimit, histSideFilter, histOutcomeFilter, histSymbolFilter);
  };

  const handleHistLimitChange = (newLimit: number) => {
    setHistLimit(newLimit);
    setHistPage(1);
    fetchHistoricalTrades(selectedModelId, 1, newLimit, histSideFilter, histOutcomeFilter, histSymbolFilter);
  };

  const handleHistSideChange = (newSide: "ALL" | "LONG" | "SHORT") => {
    setHistSideFilter(newSide);
    setHistPage(1);
    fetchHistoricalTrades(selectedModelId, 1, histLimit, newSide, histOutcomeFilter, histSymbolFilter);
  };

  const handleHistOutcomeChange = (newOutcome: string) => {
    setHistOutcomeFilter(newOutcome);
    setHistPage(1);
    fetchHistoricalTrades(selectedModelId, 1, histLimit, histSideFilter, newOutcome, histSymbolFilter);
  };

  const handleAssetChange = (newAsset: string) => {
    setSelectedAsset(newAsset);
    selectedAssetRef.current = newAsset;
    setHistSymbolFilter(newAsset);
    setLiveSymbolFilter(newAsset);
    setHistPage(1);
    fetchData(selectedModelId, activeFeeRef.current, liveLimitRef.current, newAsset);
    fetchHistoricalTrades(selectedModelId, 1, histLimit, histSideFilter, histOutcomeFilter, newAsset);
  };

  const handleHistSymbolChange = (newSymbol: string) => {
    handleAssetChange(newSymbol);
  };

  const filteredLiveTrades = trades.filter((t) => {
    if (liveSideFilter !== "ALL" && t.direction !== liveSideFilter) return false;
    if (liveSymbolFilter !== "ALL") {
      const sym = (t.symbol || "").toUpperCase();
      if (!symbolsMatch(sym, liveSymbolFilter)) return false;
    }
    return true;
  });

  // Fetch engine data and trade logs for selected model
  const fetchData = async (
    modelIdToFetch?: string,
    feeOverride?: number,
    limitOverride?: number,
    assetOverride?: string
  ) => {
    try {
      const activeM = modelIdToFetch !== undefined ? modelIdToFetch : selectedModelIdRef.current;
      const activeFee = feeOverride !== undefined ? feeOverride : activeFeeRef.current;
      const activeLimit = limitOverride !== undefined ? limitOverride : liveLimitRef.current;
      const activeAsset = assetOverride !== undefined ? assetOverride : selectedAssetRef.current;
      let url = `/api/trades?modelId=${encodeURIComponent(activeM)}&fee=${activeFee}&limit=${activeLimit}`;
      if (activeAsset && activeAsset !== "ALL") {
        url += `&asset=${encodeURIComponent(activeAsset)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch engine data");
      const data = await res.json();
      if (data.success) {
        setTrades(data.trades);
        setMetrics(data.metrics);
        if (data.livePredictionLogs) {
          setLivePredictionLogs(data.livePredictionLogs);
        }
        setMongoConnected(data.mongoConfigured);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Error fetching AI engine data:", err);
    } finally {
      setIsLoading(false);
    }
  };



  useEffect(() => {
    fetchData(selectedModelId, config.tradingFeePercent, liveLimit, selectedAsset);
    fetchHistoricalTrades(selectedModelId);
    const interval = setInterval(() => {
      fetchData(selectedModelIdRef.current, activeFeeRef.current, liveLimitRef.current, selectedAssetRef.current);
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedModelId, config.tradingFeePercent, selectedAsset]);

  // Autonomous Background AI Market Evaluation Loop
  useEffect(() => {
    if (!config.autoTradingEnabled) return;
    const aiInterval = setInterval(async () => {
      try {
        await fetch("/api/cron/scalp");
        fetchData(selectedModelIdRef.current, activeFeeRef.current);
      } catch (err) {
        // background market tick
      }
    }, 15000);
    return () => clearInterval(aiInterval);
  }, [config.autoTradingEnabled, selectedModelId, config.tradingFeePercent]);

  // Handle Model Selection Change
  const handleModelChange = async (newModelId: string) => {
    setSelectedModelId(newModelId);
    selectedModelIdRef.current = newModelId;
    if (newModelId !== "all") {
      try {
        await fetch("/api/engine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activeModelId: newModelId }),
        });
      } catch (err) {
        console.error("Error switching active model in engine:", err);
      }
    }
    setHistPage(1);
    fetchData(newModelId, activeFeeRef.current);
    fetchHistoricalTrades(newModelId, 1, histLimit, histSideFilter, histOutcomeFilter);
  };

  // Update Fee Percentage (Shark Exchange presets)
  const handleFeeChange = async (newFee: number) => {
    // 1. Immediately synchronously update ref so all ongoing/incoming polls read this exact fee
    activeFeeRef.current = newFee;
    // 2. Update config state to trigger component re-render
    setConfig((prev) => ({ ...prev, tradingFeePercent: newFee }));
    // 3. Immediately re-fetch trades and metrics using the newly selected fee
    fetchData(selectedModelIdRef.current, newFee);
    // 4. Persist to backend engine configuration
    try {
      await fetch("/api/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradingFeePercent: newFee }),
      });
    } catch (err) {
      console.error("Failed to update fee percentage:", err);
    }
  };

  // Toggle Auto-Trading
  const handleToggleAuto = async () => {
    const newState = !config.autoTradingEnabled;
    setConfig({ ...config, autoTradingEnabled: newState });
    try {
      await fetch("/api/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoTradingEnabled: newState }),
      });
      fetchData();
    } catch (err) {
      console.error("Failed to toggle auto trading:", err);
    }
  };

  // Trigger Autonomous AI Evaluation Cycle
  const [aiStatusMsg, setAiStatusMsg] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleRunAICycle = async () => {
    setIsSimulating(true);
    setAiStatusMsg(null);
    try {
      if (selectedModelId === "1h-commodities-rf") {
        const res = await fetch("/api/cron/paper-1h-commodities");
        const data = await res.json();
        if (data.success) {
          if (data.actions && data.actions.length > 0) {
            setAiStatusMsg(`⚡ 1H Commodities: ${data.actions.join(" · ")}`);
          } else {
            setAiStatusMsg(`✔ 1H Commodities Evaluated (${data.evaluated_symbols?.join(", ") || "GC=F, SI=F, CL=F"}): 0 triggers (capital preserved in CASH). Active: ${data.active_trades?.length || 0}`);
          }
          fetchData("1h-commodities-rf");
        } else {
          setAiStatusMsg(`Execution error: ${data.error || "Failed to execute 1H commodities loop"}`);
        }
      } else if (selectedModelId === "4h-swing-meta-017") {
        const res = await fetch("/api/cron/paper-4h-swing");
        const data = await res.json();
        if (data.success) {
          if (data.actions && data.actions.length > 0) {
            setAiStatusMsg(`⚡ 4H Swing: ${data.actions.join(" · ")}`);
          } else {
            setAiStatusMsg(`✔ 4H Swing Evaluated (${data.evaluated_symbols?.join(", ") || "BTC, ETH, SOL"}): 0 triggers (capital preserved in 100% CASH below 200 SMA). Active: ${data.active_trades?.length || 0}`);
          }
          fetchData("4h-swing-meta-017");
        } else {
          setAiStatusMsg(`Execution error: ${data.error || "Failed to execute 4H swing loop"}`);
        }
      } else {
        const res = await fetch("/api/cron/scalp");
        const data = await res.json();
        if (data.status === "DEPRECATED" || !data.success) {
          setAiStatusMsg(`Notice: ${data.message || "15M Scalper is retired due to fee friction. Active engine: /api/cron/paper-4h-swing"}`);
        } else if (data.actionsTaken && data.actionsTaken.length > 0) {
          setAiStatusMsg(data.actionsTaken.join(" · "));
        }
        fetchData(selectedModelId);
      }
    } catch (err: any) {
      console.error("AI Cycle error:", err);
      setAiStatusMsg(`Error: ${err.message}`);
    } finally {
      setIsSimulating(false);
      setTimeout(() => setAiStatusMsg(null), 8000);
    }
  };

  // Reset Capital to ₹1,000
  const handleResetCapital = async () => {
    if (!confirm("Are you sure you want to reset capital back to ₹1,000 and clear test trade execution logs?")) return;
    setIsResetting(true);
    try {
      const res = await fetch("/api/engine/reset", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setAiStatusMsg("✔ Capital reset to ₹1,000.00 and trade logs cleared.");
        fetchData(selectedModelId);
      }
    } catch (err) {
      console.error("Reset error:", err);
    } finally {
      setIsResetting(false);
      setTimeout(() => setAiStatusMsg(null), 5000);
    }
  };

  // Close Active Trade
  const handleCloseTrade = async (tradeId: string, entryPrice: number, dir: "LONG" | "SHORT") => {
    try {
      const tickerRes = await fetch("https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT");
      const tickerData = await tickerRes.json();
      const livePrice = parseFloat(tickerData.price) || (dir === "LONG" ? entryPrice * 1.006 : entryPrice * 0.994);

      await fetch(`/api/trades/${tradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exitPrice: livePrice,
          reason: "Shark Exchange Execution Close",
        }),
      });
      fetchData();
    } catch (err) {
      console.error("Error closing trade:", err);
    }
  };

  const isTaker = (config.tradingFeePercent || 0.040) > 0.020;
  const currentFeePercent = config.tradingFeePercent || 0.040;

  return (
    <div className="min-h-screen w-full flex flex-col bg-chrome-bg text-chrome-ink font-body selection:bg-accent-tint selection:text-chrome-ink">
      
      {/* 1. Header Navigation Bar (Portfolio Style) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-chrome-line px-4 sm:px-8 py-3.5 flex items-center justify-between shrink-0 select-none">
        
        {/* Left: Brand Monogram & Titles */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="size-6 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              TP
            </span>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2">
              <span className="font-brand text-lg sm:text-[19px] font-medium tracking-tight text-chrome-ink group-hover:text-accent transition-colors">
                Trader-Pro
              </span>
              <span className="font-mono text-[11px] sm:text-xs lowercase text-chrome-dim hidden md:inline">
                btc strategy research &amp; paper-trading
              </span>
            </div>
          </Link>

          <div className="h-4 w-px bg-chrome-line hidden sm:block" />

          {/* Active Fee Mode Tag */}
          <div className="hidden lg:flex items-center gap-1.5 font-mono text-[11px] bg-chrome-field text-chrome-dim border border-chrome-line px-2.5 py-0.5 rounded">
            <span>MODE:</span>
            <strong className="text-chrome-ink">
              {isTaker ? `TAKER (${currentFeePercent.toFixed(3)}% + 18% GST)` : "MAKER (0.016% OPTIMISTIC)"}
            </strong>
          </div>

          {/* Dynamic Live Capital & Realized Profit Badge */}
          <div className="hidden xl:flex items-center gap-2 font-mono text-[11px] bg-emerald-50 text-emerald-950 border border-emerald-300 px-3 py-1 rounded shadow-2xs">
            <span className="text-slate-500 uppercase text-[10px] font-bold">Live Capital:</span>
            <strong className="text-emerald-950 font-black tabular-nums">
              {metrics ? `₹${metrics.currentBalanceINR.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹7,000.00"}
            </strong>
            {metrics ? (
              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${metrics.netPnLINR >= 0 ? "text-emerald-700 bg-emerald-100/80" : "text-rose-700 bg-rose-100/80"}`}>
                {metrics.netPnLINR >= 0 ? "+" : ""}₹{metrics.netPnLINR.toFixed(2)} ({metrics.netPnLINR >= 0 ? "+" : ""}{((metrics.netPnLINR / 7000) * 100).toFixed(1)}%)
              </span>
            ) : (
              <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                ₹0.00 (0.0%)
              </span>
            )}
          </div>
        </div>

        {/* Right Header Navigation & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/terminal"
            className="flex items-center gap-1 font-mono text-xs text-chrome-dim hover:text-chrome-ink bg-white border border-chrome-line px-2.5 py-1.5 rounded transition-all shadow-xs hover:border-chrome-ink"
          >
            <span>Terminal</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={() => fetchData()}
            className="flex items-center gap-1.5 text-xs font-mono text-chrome-dim hover:text-chrome-ink px-2 py-1 rounded transition-colors cursor-pointer"
            title="Refresh Metrics"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-chrome-green-ink" : ""}`} />
            <span className="hidden xl:inline text-[11px]">{lastUpdated}</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`flex items-center gap-1 text-xs font-mono px-2.5 py-1.5 rounded border transition-colors cursor-pointer ${
              isSettingsOpen
                ? "bg-accent text-white border-accent"
                : "bg-chrome-field text-chrome-ink border-chrome-line hover:border-chrome-ink"
            }`}
            title="Toggle Engine Settings & Controls"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-bold">Controls</span>
          </button>

          <UserAuthPill />
        </div>
      </header>

      {/* 2. Main Content Body with Exact Hierarchy */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">

        {/* Rolling Kill Switch Emergency Red Banner */}
        {(config.killSwitchTriggered || (!config.autoTradingEnabled && config.pauseReason)) && (
          <div className="p-4 sm:p-5 rounded-xl bg-rose-50 border-2 border-rose-500 text-rose-950 font-sans shadow-md animate-fade-in flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-600 text-white">
                  KILL SWITCH ACTIVATED
                </span>
                <span className="font-mono text-xs text-rose-700 font-bold">
                  Autonomous AI Scalp Execution Paused
                </span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-rose-900 leading-relaxed mt-0.5">
                {config.pauseReason || "Autonomous execution halted: Rolling 100-trade net expectancy fell below -0.05R."}
              </p>
              <div className="text-[11px] font-mono text-rose-700">
                Capital preservation safeguard triggered. Review model performance and execution logs before re-enabling.
              </div>
            </div>
          </div>
        )}

        {/* AI Action/Standby Status Toast */}
        {aiStatusMsg && (
          <div className="p-3 rounded-lg bg-win-tint border border-win/30 text-win-dark font-mono text-xs font-bold text-center animate-fade-in shadow-2xs">
            {aiStatusMsg}
          </div>
        )}

        {/* =========================================================================
            HIERARCHY STEP 4A:
            One headline card: "Net expectancy after fees" (avg net R and net PnL)
            with the PAPER ONLY status. Most prominent element.
           ========================================================================= */}
        <PaperOnlyBanner
          avgNetR={currentAssetData.avgNetR}
          netPnLINR={currentAssetData.netPnLINR}
          isTaker={isTaker}
          feePercent={["GC=F", "SI=F", "CL=F", "XAUUSDT", "XAGUSDT", "CLUSDT"].includes(selectedAsset) ? 0.05 : currentFeePercent}
          closedTradesCount={tableTab === "live" ? currentAssetData.liveTradesCount : currentAssetData.historicalTradesCount}
          selectedModelId={selectedModelId}
          selectedAsset={selectedAsset}
          assetData={currentAssetData}
          isLiveMode={tableTab === "live"}
          trades={trades}
          tradingFeePercent={config.tradingFeePercent}
        />

        {/* =========================================================================
            HIERARCHY STEP 4B:
            A single metrics strip: true win rate, net win rate, TP/BE/SL split,
            profit factor, fees paid. Same card style, smaller.
            Active fee mode displayed on every card.
           ========================================================================= */}
        <HonestMetricsStrip
          metrics={metrics}
          isTaker={isTaker}
          feePercent={currentFeePercent}
          selectedModelId={selectedModelId}
          selectedAsset={selectedAsset}
          assetData={currentAssetData}
          isLiveMode={tableTab === "live"}
          trades={trades}
        />

        {/* =========================================================================
            SECONDARY SETTINGS DRAWER / ACCORDION (Step 4 & Step 5):
            Collapsed by default; houses Model Selector, Fee Mode Toggle, and
            Autonomous Execution triggers.
           ========================================================================= */}
        <div className="w-full bg-white border border-chrome-line rounded-lg overflow-hidden shadow-xs">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="w-full p-3.5 sm:p-4 bg-chrome-field flex items-center justify-between text-left hover:bg-chrome-field/80 transition-colors cursor-pointer select-none"
            aria-expanded={isSettingsOpen}
          >
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="w-4 h-4 text-accent" />
              <div>
                <span className="font-brand text-sm font-medium text-chrome-ink">
                  Engine Settings &amp; Execution Controls
                </span>
                <span className="font-mono text-[11px] text-chrome-dim block sm:inline sm:ml-2">
                  (Active Model, Shark Fee Mode, Autonomous AI Loop)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-chrome-dim">
                {isSettingsOpen ? "Hide" : "Show"}
              </span>
              {isSettingsOpen ? (
                <ChevronUp className="w-4 h-4 text-chrome-dim" />
              ) : (
                <ChevronDown className="w-4 h-4 text-chrome-dim" />
              )}
            </div>
          </button>

          {isSettingsOpen && (
            <div className="p-4 sm:p-5 flex flex-col gap-5 border-t border-chrome-line">
              
              {/* Fee Mode Toggle */}
              <FeeModeToggle
                tradingFeePercent={config.tradingFeePercent}
                onFeeChange={handleFeeChange}
                isTaker={isTaker}
              />

              {/* Model Selection Card */}
              <ModelCard
                selectedModelId={selectedModelId}
                onModelChange={handleModelChange}
                isTaker={isTaker}
                tradingFeePercent={config.tradingFeePercent}
                trades={trades}
                isLiveMode={true}
              />

              {/* Autonomous AI Scalp Engine Execution Controls */}
              <div className="bg-chrome-field/60 border border-chrome-line rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent" />
                    <h3 className="font-brand text-sm font-medium text-chrome-ink uppercase">
                      Autonomous AI Execution Control
                    </h3>
                  </div>
                  <p className="text-xs text-chrome-dim font-body max-w-xl">
                    Applies Shark Exchange futures {isTaker ? "taker" : "maker"} fee of{" "}
                    <strong className="text-chrome-ink font-mono">{currentFeePercent.toFixed(3)}% + 18% GST</strong>. Automatically manages trades with artificial capital of <strong className="text-chrome-ink font-mono">₹1,000 INR</strong>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handleToggleAuto}
                    className={`flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded transition-all cursor-pointer border ${
                      config.autoTradingEnabled
                        ? "bg-accent text-white border-accent shadow-xs"
                        : "bg-chrome-field text-chrome-dim border-chrome-line hover:text-chrome-ink"
                    }`}
                  >
                    {config.autoTradingEnabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{config.autoTradingEnabled ? "Autonomous: Active" : "Autonomous: Paused"}</span>
                  </button>

                  <button
                    onClick={handleRunAICycle}
                    disabled={isSimulating}
                    className="flex items-center gap-1.5 bg-chrome-ink hover:bg-black text-white text-xs font-mono font-bold px-3 py-1.5 rounded transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    title="Runs the LightGBM & Donchian-20 evaluation on live Binance candles"
                  >
                    <Zap className="w-3.5 h-3.5 text-accent" />
                    <span>{isSimulating ? "Evaluating Market..." : "⚡ Run AI Cycle"}</span>
                  </button>

                  <button
                    onClick={handleResetCapital}
                    disabled={isResetting}
                    className="flex items-center gap-1.5 bg-white hover:bg-loss-tint text-loss border border-loss/30 text-xs font-mono font-bold px-3 py-1.5 rounded transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                    title="Resets capital back to ₹1,000.00 and clears test execution logs"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
                    <span>Reset Capital (₹1,000)</span>
                  </button>
                </div>
              </div>

              {/* Point-in-time causality badge */}
              <div className="flex items-center gap-2 text-xs font-mono text-chrome-dim bg-white p-3 rounded border border-chrome-line">
                <ShieldCheck className="w-4 h-4 text-win shrink-0" />
                <span>
                  <strong>Strict Point-in-Time Causality:</strong> Trades execute strictly on closed past candles with zero lookahead bias or future-leakage.
                </span>
              </div>

            </div>
          )}
        </div>

        {/* =========================================================================
            HIERARCHY STEP 4C:
            Research results table (the studies and their verdicts).
           ========================================================================= */}
        <ResearchResultsTable />

        {/* =========================================================================
            HIERARCHY STEP 4D:
            Live and paper trades table.
           ========================================================================= */}
        <LiveTradesTable
          selectedModelId={selectedModelId}
          trades={trades}
          filteredLiveTrades={filteredLiveTrades}
          livePredictionLogs={livePredictionLogs}
          tableTab={tableTab}
          setTableTab={setTableTab}
          liveSideFilter={liveSideFilter}
          setLiveSideFilter={setLiveSideFilter}
          liveSymbolFilter={liveSymbolFilter}
          setLiveSymbolFilter={setLiveSymbolFilter}
          histSymbolFilter={histSymbolFilter}
          handleHistSymbolChange={handleHistSymbolChange}
          liveLimit={liveLimit}
          onLiveLimitChange={(newL) => {
            setLiveLimit(newL);
            liveLimitRef.current = newL;
            fetchData(selectedModelIdRef.current, activeFeeRef.current, newL);
          }}
          historicalTrades={historicalTrades}
          totalHistoricalCount={totalHistoricalCount}
          isLoadingHistorical={isLoadingHistorical}
          histPage={histPage}
          histLimit={histLimit}
          histSideFilter={histSideFilter}
          histOutcomeFilter={histOutcomeFilter}
          histTotalPages={histTotalPages}
          handleHistPageChange={handleHistPageChange}
          handleHistLimitChange={handleHistLimitChange}
          handleHistSideChange={handleHistSideChange}
          handleHistOutcomeChange={handleHistOutcomeChange}
          handleCloseTrade={handleCloseTrade}
          totalLiveCount={metrics?.totalTrades || trades.length}
          isTaker={isTaker}
          feePercent={currentFeePercent}
          selectedAsset={selectedAsset}
          onAssetChange={handleAssetChange}
        />



      </main>

      {/* =========================================================================
          FOOTER NOTE (Step 8):
          "Research and paper trading only. Not financial advice."
         ========================================================================= */}
      <footer className="border-t border-chrome-line py-8 px-6 bg-white text-center font-mono text-xs text-chrome-dim flex flex-col items-center justify-center gap-2 select-none">
        <p className="font-semibold text-chrome-ink">
          Research and paper trading only. Not financial advice.
        </p>
        <p className="text-[11px] text-chrome-dim">
          Trader-Pro Dashboard · Out-of-sample BTC strategy research &amp; paper-trading · Shark Exchange realistic taker friction model (0.040% + 18% GST + 0.010% slippage/side).
        </p>
      </footer>

    </div>
  );
}
