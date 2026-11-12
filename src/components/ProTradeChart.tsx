"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  ColorType,
  CrosshairMode,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type UTCTimestamp,
  type SeriesMarker,
} from "lightweight-charts";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ExternalLink,
  Target,
  ShieldAlert,
  Clock,
  Sparkles,
} from "lucide-react";

export interface ChartTrade {
  id: string;
  trade_id?: string;
  entryTime?: string;
  entry_time?: string;
  entry_time_ms?: number;
  exitTime?: string;
  exit_time?: string;
  exit_time_ms?: number;
  direction?: "LONG" | "SHORT";
  side?: "LONG" | "SHORT";
  symbol: string;
  rawSymbol?: string;
  displaySymbol?: string;
  entryPrice: number;
  entry_price?: number;
  stopLoss: number;
  stop_loss?: number;
  takeProfit: number;
  take_profit?: number;
  exitPrice?: number;
  exit_price?: number;
  exitReason?: string;
  exit_type?: string;
  status?: string;
  net_r?: number;
  outcomeR?: number;
  returnPct?: number;
  stopDistancePct?: number;
  stop_distance_pct?: number;
  positionSizeINR?: number;
  pnlNetINR?: number;
  bars_held?: number;
  holdingBars?: number;
  modelId?: string;
  routed_engine?: string;
  routedEngine?: string;
}

interface ProTradeChartProps {
  symbol: string;
  interval: string;
  trades: ChartTrade[];
  selectedTrade: ChartTrade | null;
  onSelectTrade: (trade: ChartTrade | null) => void;
  showFibonacci?: boolean;
  onToggleFibonacci?: () => void;
  filterType: "ALL" | "LIVE" | "HISTORICAL";
  onChangeFilterType: (filter: "ALL" | "LIVE" | "HISTORICAL") => void;
  onSwitchToTradingView: () => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
}

interface RawCandle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PositionBoxCoords {
  x1: number;
  x2: number;
  yEntry: number;
  ySL: number;
  yTP: number;
  isLong: boolean;
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  exitPrice?: number;
  exitReason?: string;
  isLive: boolean;
}

export default function ProTradeChart({
  symbol,
  interval,
  trades,
  selectedTrade,
  onSelectTrade,
  filterType,
  onChangeFilterType,
  onSwitchToTradingView,
  isMaximized,
  onToggleMaximize,
}: ProTradeChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const markersPluginRef = useRef<any>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const [candles, setCandles] = useState<RawCandle[]>([]);
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(true);
  const [currentLivePrice, setCurrentLivePrice] = useState<number | null>(null);
  const [boxCoords, setBoxCoords] = useState<PositionBoxCoords | null>(null);

  // Normalize Interval for Binance API
  const binanceInterval = useMemo(() => {
    const map: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "1h": "1h",
      "4h": "4h",
      "1d": "1d",
    };
    return map[interval.toLowerCase()] || "4h";
  }, [interval]);

  // Clean symbol for Binance
  const cleanSymbol = useMemo(() => {
    return symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }, [symbol]);

  // 1. Fetch Candle Data (up to 1,000 candles)
  useEffect(() => {
    let isMounted = true;
    setIsLoadingCandles(true);

    const fetchCandles = async () => {
      try {
        let fetchedCandles: RawCandle[] = [];

        // Try Binance Futures first
        try {
          const res = await fetch(
            `https://fapi.binance.com/fapi/v1/klines?symbol=${cleanSymbol}&interval=${binanceInterval}&limit=1000`
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              fetchedCandles = data.map((d: any) => ({
                openTime: Number(d[0]),
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
                volume: parseFloat(d[5]),
              }));
            }
          }
        } catch (e) {
          console.warn("Binance futures klines error:", e);
        }

        // Spot fallback
        if (fetchedCandles.length === 0) {
          try {
            const res = await fetch(
              `https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=${binanceInterval}&limit=1000`
            );
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                fetchedCandles = data.map((d: any) => ({
                  openTime: Number(d[0]),
                  open: parseFloat(d[1]),
                  high: parseFloat(d[2]),
                  low: parseFloat(d[3]),
                  close: parseFloat(d[4]),
                  volume: parseFloat(d[5]),
                }));
              }
            }
          } catch (e) {
            console.warn("Binance spot fallback error:", e);
          }
        }

        // Commodities fallback
        if (
          fetchedCandles.length === 0 &&
          ["GC=F", "SI=F", "CL=F", "XAUUSDT", "XAGUSDT", "CLUSDT"].includes(cleanSymbol)
        ) {
          try {
            const res = await fetch(`/api/market/klines?symbol=${encodeURIComponent(cleanSymbol)}&range=1y`);
            if (res.ok) {
              const json = await res.json();
              if (json.success && Array.isArray(json.candles)) {
                fetchedCandles = json.candles;
              }
            }
          } catch (e) {
            console.warn("Commodity klines fallback error:", e);
          }
        }

        if (isMounted) {
          if (fetchedCandles.length > 0) {
            setCandles(fetchedCandles);
            setCurrentLivePrice(fetchedCandles[fetchedCandles.length - 1].close);
          }
          setIsLoadingCandles(false);
        }
      } catch (err) {
        console.error("Failed to fetch chart candles:", err);
        if (isMounted) setIsLoadingCandles(false);
      }
    };

    fetchCandles();

    const refreshTimer = setInterval(fetchCandles, 15000);
    return () => {
      isMounted = false;
      clearInterval(refreshTimer);
    };
  }, [cleanSymbol, binanceInterval]);

  // 2. Initialize Lightweight Chart
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersPluginRef.current = null;
      priceLinesRef.current = [];
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#475569",
        fontFamily: "'GT Standard Mono', 'GeistMono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#f8fafc" },
        horzLines: { color: "#f8fafc" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#94a3b8",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0f172a",
        },
        horzLine: {
          color: "#94a3b8",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0f172a",
        },
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
        scaleMargins: {
          top: 0.12,
          bottom: 0.15,
        },
      },
      timeScale: {
        borderColor: "#e2e8f0",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.88,
        bottom: 0,
      },
    });

    chartInstanceRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartInstanceRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartInstanceRef.current.applyOptions({ width, height });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // 3. Set Candle Data
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries || candles.length === 0) return;

    const sorted = [...candles].sort((a, b) => a.openTime - b.openTime);
    const seenTimes = new Set<number>();
    const candleData: any[] = [];
    const volumeData: any[] = [];

    for (const c of sorted) {
      const t = Math.floor(c.openTime / 1000) as UTCTimestamp;
      if (!seenTimes.has(t)) {
        seenTimes.add(t);
        candleData.push({
          time: t,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        });
        volumeData.push({
          time: t,
          value: c.volume,
          color: c.close >= c.open ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
        });
      }
    }

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
  }, [candles]);

  // Filter Trades for this graph
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      const isLive = t.status === "ACTIVE" || (t.id && t.id.startsWith("router_"));
      if (filterType === "LIVE") return isLive;
      if (filterType === "HISTORICAL") return !isLive;
      return true;
    });
  }, [trades, filterType]);

  // Map timestamp to nearest candle time
  const findNearestCandleTime = useCallback(
    (timeMs: number): UTCTimestamp | null => {
      if (candles.length === 0) return null;
      const sec = Math.floor(timeMs / 1000);
      const firstCandleSec = Math.floor(candles[0].openTime / 1000);
      if (sec < firstCandleSec) return null;

      for (let i = 0; i < candles.length; i++) {
        const curr = Math.floor(candles[i].openTime / 1000);
        const next =
          i < candles.length - 1 ? Math.floor(candles[i + 1].openTime / 1000) : Infinity;
        if (sec >= curr && sec < next) {
          return curr as UTCTimestamp;
        }
      }
      return Math.floor(candles[candles.length - 1].openTime / 1000) as UTCTimestamp;
    },
    [candles]
  );

  // 4. Update Bar Markers (Clean Entry / Exit indicators)
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries || candles.length === 0) return;

    const markers: SeriesMarker<UTCTimestamp>[] = [];

    filteredTrades.forEach((trade) => {
      const entryMs =
        trade.entry_time_ms || (trade.entryTime ? new Date(trade.entryTime).getTime() : 0);
      if (!entryMs) return;

      const candleTime = findNearestCandleTime(entryMs);
      if (!candleTime) return;

      const isLong = (trade.direction || trade.side) === "LONG";
      const isSelected =
        selectedTrade && (selectedTrade.id === trade.id || selectedTrade.trade_id === trade.trade_id);

      // Entry Marker
      markers.push({
        time: candleTime,
        position: isLong ? "belowBar" : "aboveBar",
        shape: isLong ? "arrowUp" : "arrowDown",
        color: isLong ? "#10b981" : "#ef4444",
        text: `${isLong ? "LONG" : "SHORT"} @ $${Number(
          trade.entryPrice || trade.entry_price
        ).toLocaleString()}`,
        size: isSelected ? 2 : 1,
      });

      // Exit Marker (Trailing SL / TP / Expiry)
      const exitMs =
        trade.exit_time_ms || (trade.exitTime ? new Date(trade.exitTime).getTime() : 0);
      if (exitMs && exitMs > entryMs) {
        const exitCandleTime = findNearestCandleTime(exitMs);
        if (exitCandleTime) {
          const exitReason = trade.exitReason || trade.exit_type || "";
          const isTrailingSL =
            exitReason === "STOP_LOSS" ||
            exitReason === "STOP" ||
            exitReason === "TRAILING_SL";
          const isTP =
            exitReason === "TAKE_PROFIT" ||
            exitReason === "TARGET" ||
            (trade.net_r ?? 0) > 0;

          markers.push({
            time: exitCandleTime,
            position: isLong ? "aboveBar" : "belowBar",
            shape: "circle",
            color: isTP ? "#10b981" : isTrailingSL ? "#ef4444" : "#f59e0b",
            text: isTP
              ? "🎯 TP (+2.5R)"
              : isTrailingSL
              ? "🛑 TRAILING SL (-1.0R)"
              : "⏱ EXPIRED",
            size: 1,
          });
        }
      }
    });

    markers.sort((a, b) => (a.time as number) - (b.time as number));

    if (!markersPluginRef.current) {
      markersPluginRef.current = createSeriesMarkers(candleSeries, markers);
    } else {
      markersPluginRef.current.setMarkers(markers);
    }
  }, [candles, filteredTrades, selectedTrade, findNearestCandleTime]);

  // 5. Draw Clean Entry, SL, and TP Price Lines for Selected Trade (NO messy Fib lines!)
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    priceLinesRef.current.forEach((line) => {
      try {
        candleSeries.removePriceLine(line);
      } catch (e) {
        // already removed
      }
    });
    priceLinesRef.current = [];

    if (!selectedTrade) return;

    const entry = Number(selectedTrade.entryPrice || selectedTrade.entry_price || 0);
    const sl = Number(selectedTrade.stopLoss || selectedTrade.stop_loss || 0);
    const tp = Number(selectedTrade.takeProfit || selectedTrade.take_profit || 0);

    if (!entry || !sl || !tp) return;

    const isExitTrailingSL =
      selectedTrade.exitReason === "STOP_LOSS" ||
      selectedTrade.exitReason === "STOP" ||
      selectedTrade.exitReason === "TRAILING_SL";

    // Clean Entry line
    const entryLine = candleSeries.createPriceLine({
      price: entry,
      color: "#2563eb",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `ENTRY $${entry.toLocaleString()}`,
    });
    priceLinesRef.current.push(entryLine);

    // Clean Stop Loss / Trailing SL line
    const slLine = candleSeries.createPriceLine({
      price: sl,
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `${isExitTrailingSL ? "TRAILING SL" : "SL"} $${sl.toLocaleString()}`,
    });
    priceLinesRef.current.push(slLine);

    // Clean Take Profit line
    const tpLine = candleSeries.createPriceLine({
      price: tp,
      color: "#10b981",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `TP $${tp.toLocaleString()}`,
    });
    priceLinesRef.current.push(tpLine);
  }, [selectedTrade]);

  // 6. Compute Pixel Coordinates for TradingView-style Risk/Reward Position Box
  const updatePositionBox = useCallback(() => {
    if (
      !selectedTrade ||
      !chartInstanceRef.current ||
      !candleSeriesRef.current ||
      candles.length === 0
    ) {
      setBoxCoords(null);
      return;
    }

    const chart = chartInstanceRef.current;
    const candleSeries = candleSeriesRef.current;

    const entry = Number(selectedTrade.entryPrice || selectedTrade.entry_price || 0);
    const sl = Number(selectedTrade.stopLoss || selectedTrade.stop_loss || 0);
    const tp = Number(selectedTrade.takeProfit || selectedTrade.take_profit || 0);

    if (!entry || !sl || !tp) {
      setBoxCoords(null);
      return;
    }

    const isLong = (selectedTrade.direction || selectedTrade.side) === "LONG";
    const entryMs =
      selectedTrade.entry_time_ms ||
      (selectedTrade.entryTime ? new Date(selectedTrade.entryTime).getTime() : 0);
    const exitMs =
      selectedTrade.exit_time_ms ||
      (selectedTrade.exitTime ? new Date(selectedTrade.exitTime).getTime() : 0);

    const cEntry = findNearestCandleTime(entryMs);
    let x1: number | null = cEntry ? (chart.timeScale().timeToCoordinate(cEntry) as any) : null;

    let x2: number | null = null;
    if (exitMs && exitMs > entryMs) {
      const cExit = findNearestCandleTime(exitMs);
      x2 = cExit ? (chart.timeScale().timeToCoordinate(cExit) as any) : null;
    }

    const lastCandle = candles[candles.length - 1];
    const lastX = chart.timeScale().timeToCoordinate(
      Math.floor(lastCandle.openTime / 1000) as UTCTimestamp
    ) as any;

    if (x1 === null && lastX !== null && lastX !== undefined) {
      x1 = 0;
    }
    if (x2 === null) {
      const containerW = chartContainerRef.current?.clientWidth || 800;
      x2 = lastX !== null && lastX !== undefined ? Math.min(containerW, Number(lastX) + 100) : (x1 || 0) + 120;
    }

    // Ensure minimum box width
    if (x1 !== null && x2 !== null && Math.abs(x2 - x1) < 60) {
      x2 = Number(x1) + 60;
    }

    const yEntry = candleSeries.priceToCoordinate(entry) as any;
    const ySL = candleSeries.priceToCoordinate(sl) as any;
    const yTP = candleSeries.priceToCoordinate(tp) as any;

    if (x1 === null || x2 === null || yEntry === null || ySL === null || yTP === null) {
      setBoxCoords(null);
      return;
    }

    setBoxCoords({
      x1: Number(x1),
      x2: Number(x2),
      yEntry: Number(yEntry),
      ySL: Number(ySL),
      yTP: Number(yTP),
      isLong,
      entryPrice: entry,
      slPrice: sl,
      tpPrice: tp,
      exitPrice: selectedTrade.exitPrice || selectedTrade.exit_price,
      exitReason: selectedTrade.exitReason || selectedTrade.exit_type,
      isLive:
        selectedTrade.status === "ACTIVE" ||
        Boolean(selectedTrade.id && selectedTrade.id.startsWith("router_")),
    });
  }, [selectedTrade, candles, findNearestCandleTime]);

  // Synchronize Box Coordinates on Chart Scroll / Zoom
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    updatePositionBox();

    const handleRangeChange = () => {
      requestAnimationFrame(updatePositionBox);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);
    chart.timeScale().subscribeVisibleTimeRangeChange(handleRangeChange);

    return () => {
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
        chart.timeScale().unsubscribeVisibleTimeRangeChange(handleRangeChange);
      } catch (e) {
        // cleanup
      }
    };
  }, [updatePositionBox]);

  // Trade Navigation (Prev / Next)
  const currentTradeIndex = useMemo(() => {
    if (!selectedTrade) return -1;
    return filteredTrades.findIndex(
      (t) => t.id === selectedTrade.id || (t.trade_id && t.trade_id === selectedTrade.trade_id)
    );
  }, [selectedTrade, filteredTrades]);

  const handlePrevTrade = () => {
    if (filteredTrades.length === 0) return;
    const nextIdx = currentTradeIndex <= 0 ? filteredTrades.length - 1 : currentTradeIndex - 1;
    onSelectTrade(filteredTrades[nextIdx]);
  };

  const handleNextTrade = () => {
    if (filteredTrades.length === 0) return;
    const nextIdx = currentTradeIndex >= filteredTrades.length - 1 ? 0 : currentTradeIndex + 1;
    onSelectTrade(filteredTrades[nextIdx]);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-white overflow-hidden select-none font-mono">
      {/* 1. Ultra-Clean Minimal Top Bar */}
      <div className="bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between gap-2 z-20 shrink-0 text-xs shadow-2xs">
        {/* Left: Clean Asset & Live Price */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{symbol}</span>
            <span className="text-slate-400">·</span>
            <span>{interval.toUpperCase()}</span>
          </div>

          {currentLivePrice !== null && (
            <div className="font-bold text-slate-900 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
              ${currentLivePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </div>
          )}

          {/* Switch to TradingView Cloud Widget */}
          <button
            onClick={onSwitchToTradingView}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded transition-all cursor-pointer"
            title="Switch to TradingView Cloud Widget"
          >
            <ExternalLink className="w-3 h-3 text-blue-600" />
            <span>TV Cloud</span>
          </button>
        </div>

        {/* Center: Clean Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded text-[11px]">
          <button
            onClick={() => onChangeFilterType("ALL")}
            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
              filterType === "ALL"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-200"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            All Trades ({trades.length})
          </button>
          <button
            onClick={() => onChangeFilterType("LIVE")}
            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer flex items-center gap-1 ${
              filterType === "LIVE"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
            Live
          </button>
          <button
            onClick={() => onChangeFilterType("HISTORICAL")}
            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
              filterType === "HISTORICAL"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-200"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Historical
          </button>
        </div>

        {/* Right: Trade Stepper & Maximize */}
        <div className="flex items-center gap-2">
          {selectedTrade && (
            <div className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
              <span className="font-bold text-slate-900">
                Trade #{currentTradeIndex + 1}
              </span>
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  onClick={handlePrevTrade}
                  className="p-0.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  title="Previous trade"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNextTrade}
                  className="p-0.5 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  title="Next trade"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <button
            onClick={onToggleMaximize}
            className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-950 cursor-pointer"
            title={isMaximized ? "Restore Layout (Esc)" : "Maximize Chart Area"}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Main Canvas Container */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-white">
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* Loading Spinner */}
        {isLoadingCandles && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-30">
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow font-mono text-xs text-slate-700">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading Candlesticks & Trades...</span>
            </div>
          </div>
        )}

        {/* 3. CLASSIC TRADINGVIEW POSITION BOX (Green Profit Box + Red Risk Box) */}
        {boxCoords && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-hidden"
            style={{ width: "100%", height: "100%" }}
          >
            {(() => {
              const left = Math.min(boxCoords.x1, boxCoords.x2);
              const width = Math.abs(boxCoords.x2 - boxCoords.x1);
              const right = left + width;

              // Profit Zone (Green) and Risk Zone (Red)
              const greenTop = boxCoords.isLong ? boxCoords.yTP : boxCoords.yEntry;
              const greenHeight = Math.abs(boxCoords.yTP - boxCoords.yEntry);

              const redTop = boxCoords.isLong ? boxCoords.yEntry : boxCoords.ySL;
              const redHeight = Math.abs(boxCoords.ySL - boxCoords.yEntry);

              const isExitTrailingSL =
                boxCoords.exitReason === "STOP_LOSS" ||
                boxCoords.exitReason === "STOP" ||
                boxCoords.exitReason === "TRAILING_SL";

              const isExitTP =
                boxCoords.exitReason === "TAKE_PROFIT" ||
                boxCoords.exitReason === "TARGET";

              const entryDiffPct =
                boxCoords.entryPrice > 0
                  ? (Math.abs(boxCoords.tpPrice - boxCoords.entryPrice) / boxCoords.entryPrice) * 100
                  : 0;

              const slDiffPct =
                boxCoords.entryPrice > 0
                  ? (Math.abs(boxCoords.entryPrice - boxCoords.slPrice) / boxCoords.entryPrice) * 100
                  : 0;

              return (
                <g>
                  {/* 1. Green Profit Target Box (Exactly like TradingView) */}
                  <rect
                    x={left}
                    y={greenTop}
                    width={width}
                    height={greenHeight}
                    fill="rgba(16, 185, 129, 0.22)"
                    stroke="rgba(16, 185, 129, 0.85)"
                    strokeWidth="1.5"
                    rx="1"
                  />

                  {/* 2. Red Risk / Stop Loss Box (Exactly like TradingView) */}
                  <rect
                    x={left}
                    y={redTop}
                    width={width}
                    height={redHeight}
                    fill="rgba(239, 68, 68, 0.22)"
                    stroke="rgba(239, 68, 68, 0.85)"
                    strokeWidth="1.5"
                    rx="1"
                  />

                  {/* 3. Center Entry Line */}
                  <line
                    x1={left}
                    y1={boxCoords.yEntry}
                    x2={right}
                    y2={boxCoords.yEntry}
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />

                  {/* Entry Price Tag inside box */}
                  <rect
                    x={left + 6}
                    y={boxCoords.yEntry - 9}
                    width={130}
                    height={18}
                    fill="#1e293b"
                    rx="3"
                  />
                  <text
                    x={left + 10}
                    y={boxCoords.yEntry + 3}
                    fill="#93c5fd"
                    fontSize="9.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    ENTRY ${boxCoords.entryPrice.toLocaleString()}
                  </text>

                  {/* Take Profit (TP) Tag */}
                  <rect
                    x={left + 6}
                    y={boxCoords.yTP - 9}
                    width={155}
                    height={18}
                    fill="#065f46"
                    rx="3"
                  />
                  <text
                    x={left + 10}
                    y={boxCoords.yTP + 3}
                    fill="#a7f3d0"
                    fontSize="9.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    TP ${boxCoords.tpPrice.toLocaleString()} (+{entryDiffPct.toFixed(1)}% | +2.5R)
                  </text>

                  {/* Stop Loss (SL) or Trailing SL Tag */}
                  <rect
                    x={left + 6}
                    y={boxCoords.ySL - 9}
                    width={isExitTrailingSL ? 180 : 160}
                    height={18}
                    fill="#881337"
                    rx="3"
                  />
                  <text
                    x={left + 10}
                    y={boxCoords.ySL + 3}
                    fill="#fecdd3"
                    fontSize="9.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {isExitTrailingSL ? "EXIT: TRAILING SL" : "STOP LOSS"} ${boxCoords.slPrice.toLocaleString()} (-{slDiffPct.toFixed(1)}% | -1.0R)
                  </text>

                  {/* 4. Exit Point Indicator at Right Edge */}
                  <line
                    x1={right}
                    y1={Math.min(boxCoords.yTP, boxCoords.ySL)}
                    x2={right}
                    y2={Math.max(boxCoords.yTP, boxCoords.ySL)}
                    stroke={isExitTP ? "#10b981" : isExitTrailingSL ? "#ef4444" : "#3b82f6"}
                    strokeWidth="2"
                    strokeDasharray="3 3"
                  />

                  {/* Exit Outcome Badge */}
                  <g transform={`translate(${right - 8}, ${boxCoords.yEntry - 24})`}>
                    <rect
                      x="-125"
                      y="0"
                      width="130"
                      height="20"
                      fill={isExitTP ? "#047857" : isExitTrailingSL ? "#b91c1c" : "#1e40af"}
                      rx="3"
                    />
                    <text
                      x="-60"
                      y="14"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="9.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {boxCoords.isLive
                        ? "⚡ ACTIVE POSITION"
                        : isExitTP
                        ? "🎯 EXIT: TP (+2.5R)"
                        : isExitTrailingSL
                        ? "🛑 EXIT: TRAILING SL"
                        : "⏱ EXIT: 48H EXPIRY"}
                    </text>
                  </g>
                </g>
              );
            })()}
          </svg>
        )}
      </div>
    </div>
  );
}
