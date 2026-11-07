#!/usr/bin/env python3
"""
Stage 1: Strict Institutional Rules Engine & Baseline Backtest (2020-2026)
Trader-Pro Quant Architecture (Stage 1 of 2-Stage Multi-Asset Engine)

Strict Invariants:
1. NEVER modify src/lib/paperExecutor1HA.ts (SHA-256: C1DE3359D29A4B4C6BFB3662A65C2ABF5DD4001052BDF6CAA1A7AA50FB8B33A8).
2. Dedicated Retail Capital: ₹1,000 INR per asset across 7 assets (₹7,000 total portfolio).
   Maximum risk per trade bounded to ₹50.00 - ₹100.00 INR (1R = ₹100.00).
3. Realistic Exchange Friction Deducted:
   - Crypto (4H): 10 bps (0.10%) + 18% GST = 0.118% round-trip taker friction.
   - Commodities (1H): 5 bps (0.05%) + 18% GST = 0.059% round-trip institutional friction.
4. Zero Lookahead: All indicators, moving averages, and pattern triggers evaluated strictly at candle closes (t-1 and earlier).
5. Triple Barrier:
   - Upper: +2.5R (strictly 1:2.5 payout)
   - Lower: -1.0R (1.5x ATR clamped [1.5%, 6.0%] on Crypto, [1.0%, 4.0%] on Commodities)
   - Time Barrier: 12 bars (48h on 4H, 12h on 1H)
   - Fee-Shield Breakeven: At +0.30R, auto-trail SL to Entry + round-trip fees (locking in 0.00R net exit)
   - Simultaneous Collision Invariant: Bar touching both TP and SL booked strictly as Stop Loss (-1.0R).
"""

import os
import sys
import json
import math
import time
import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

import numpy as np
import pandas as pd

# Windows UTF-8 console output
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Paths
ROOT_DIR = Path(__file__).resolve().parent.parent
RESEARCH_DIR = ROOT_DIR / "research"
DATA_DIR = ROOT_DIR / "data"
NOTEBOOKS_DATA_4H = Path("D:/Projects_Main/Trade-Pro/Trader-Pro/notebooks/data/4h")
OUTPUT_JSON_PATH = RESEARCH_DIR / "stage1_candidate_trades.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
RESEARCH_DIR.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------------------------
# Asset Universe Specification
# ------------------------------------------------------------------------------
CRYPTO_ASSETS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT"]
COMMODITY_ASSETS = ["GC=F", "SI=F", "CL=F"]
ALL_ASSETS = CRYPTO_ASSETS + COMMODITY_ASSETS

# Capital Configuration
CAPITAL_PER_ASSET_INR = 1000.00
PORTFOLIO_CAPITAL_INR = 7000.00
RISK_PER_TRADE_INR = 100.00  # 1R baseline = ₹100.00 INR

# Friction Configuration (Including 18% GST)
CRYPTO_ROUND_TRIP_FRICTION = 0.00118     # 10 bps + 18% GST = 0.118%
COMMODITY_ROUND_TRIP_FRICTION = 0.00059  # 5 bps + 18% GST = 0.059%


# ------------------------------------------------------------------------------
# 1. Resilient Data Ingestion
# ------------------------------------------------------------------------------
def fetch_binance_4h_klines(symbol: str) -> pd.DataFrame:
    """Downloads Binance 4H klines from inception and caches locally."""
    import urllib.request
    base_url = "https://fapi.binance.com/fapi/v1/klines"
    end_ms = int(time.time() * 1000)
    curr_start = 1577836800000  # 2020-01-01
    records = []
    
    print(f"  Downloading full 4H history for {symbol} from Binance...", end="", flush=True)
    while curr_start < end_ms:
        url = f"{base_url}?symbol={symbol}&interval=4h&startTime={curr_start}&limit=1500"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            time.sleep(1.0)
            continue
        if not data:
            break
        records.extend(data)
        last_open_ms = data[-1][0]
        if last_open_ms <= curr_start:
            break
        curr_start = last_open_ms + (4 * 3600 * 1000)
        time.sleep(0.04)

    cols = ["open_time", "open", "high", "low", "close", "volume", "close_time", "quote_volume", "trades", "taker_buy_base", "taker_buy_quote", "ignore"]
    df = pd.DataFrame(records, columns=cols)
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = df[c].astype(float)
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    df["close_time"] = pd.to_datetime(df["close_time"], unit="ms", utc=True)
    df = df.sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
    print(f" Done ({len(df)} bars).")
    return df


def load_asset_data(symbol: str) -> pd.DataFrame:
    """Loads OHLCV dataset for given symbol from local stores or remote fetch."""
    if symbol in CRYPTO_ASSETS:
        p1 = NOTEBOOKS_DATA_4H / f"{symbol}_4h.parquet"
        p2 = DATA_DIR / f"{symbol}_4h.parquet"
        
        if p1.exists():
            df = pd.read_parquet(p1)
        elif p2.exists():
            df = pd.read_parquet(p2)
        else:
            df = fetch_binance_4h_klines(symbol)
            df.to_parquet(p2)
            
        df.columns = [c.lower() for c in df.columns]
        if "open_time" in df.columns and not isinstance(df["open_time"].iloc[0], pd.Timestamp):
            df["open_time"] = pd.to_datetime(df["open_time"], utc=True)
        return df
        
    elif symbol in COMMODITY_ASSETS:
        clean_name = symbol.replace("=", "_")
        cache_file = DATA_DIR / f"{clean_name}_1h.parquet"
        if cache_file.exists():
            df = pd.read_parquet(cache_file)
        else:
            import yfinance as yf
            print(f"  Downloading 1H candles for {symbol} via yfinance...", end="", flush=True)
            df = yf.download(symbol, period="730d", interval="1h", progress=False)
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = [c[0].lower() for c in df.columns]
            else:
                df.columns = [c.lower() for c in df.columns]
            df = df.reset_index()
            df.to_parquet(cache_file)
            print(f" Done ({len(df)} bars).")
            
        dt_col = next((c for c in df.columns if c.lower() in ("datetime", "date", "open_time")), "datetime")
        df["open_time"] = pd.to_datetime(df[dt_col], utc=True)
        return df
    else:
        raise ValueError(f"Unknown asset symbol: {symbol}")


# ------------------------------------------------------------------------------
# 2. Indicator Calculation Engine (Zero Lookahead)
# ------------------------------------------------------------------------------
def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Computes moving averages, ATR, and Donchian channels with zero lookahead."""
    df = df.copy()
    close = df["close"]
    high = df["high"]
    low = df["low"]
    
    # Pillar 1: Macro Regime (200 SMA)
    df["sma_200"] = close.rolling(200, min_periods=200).mean()
    
    # Pillar 3: Dynamic 20 & 50 EMA
    df["ema_20"] = close.ewm(span=20, adjust=False).mean()
    df["ema_50"] = close.ewm(span=50, adjust=False).mean()
    
    # Pillar 5: Rubber Band Guard (50 SMA & ATR 14)
    df["sma_50"] = close.rolling(50, min_periods=50).mean()
    
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    df["atr_14"] = tr.rolling(14, min_periods=14).mean()
    
    # Pillar 2: 20-period Donchian Channels of strictly prior bars (shift 1)
    df["donchian_high_20"] = high.shift(1).rolling(20, min_periods=20).max()
    df["donchian_low_20"] = low.shift(1).rolling(20, min_periods=20).min()
    
    # Lowest Low & Highest High of last 10 bars for structural stop loss
    df["lowest_low_10"] = low.shift(1).rolling(10, min_periods=10).min()
    df["highest_high_10"] = high.shift(1).rolling(10, min_periods=10).max()
    
    return df


# ------------------------------------------------------------------------------
# 3. Strict 5-Pillar Confluence Rule Evaluator
# ------------------------------------------------------------------------------
def check_confluence_setup(
    df: pd.DataFrame,
    t: int,
    direction: int, # +1 for LONG, -1 for SHORT
    is_commodity: bool,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Evaluates completed bar t against all 5 Pillars:
    1. Macro Regime Gate (SMA 200)
    2. Market Structure / Donchian Breakout Trigger
    3. Dynamic 20/50 EMA Elastic Pocket (<= 1.5% distance)
    4. Harmonic Fibonacci Retracement (Golden Zone test of preceding swing)
    5. Rubber Band Exhaustion Guard (Stretch <= 4.5)
    """
    row = df.iloc[t]
    c_t = row["close"]
    h_t = row["high"]
    l_t = row["low"]
    
    sma_200 = row["sma_200"]
    sma_50 = row["sma_50"]
    ema_20 = row["ema_20"]
    ema_50 = row["ema_50"]
    atr_14 = row["atr_14"]
    dh_20 = row["donchian_high_20"]
    dl_20 = row["donchian_low_20"]
    
    if np.isnan(sma_200) or np.isnan(atr_14) or np.isnan(dh_20) or atr_14 <= 0:
        return False, {}
        
    # --- Pillar 5: Rubber Band Exhaustion Guard ---
    stretch_ratio = abs(c_t - sma_50) / atr_14
    if stretch_ratio > 4.5:
        return False, {}
        
    if direction == 1:  # LONG
        # --- Pillar 1: Macro Regime Gate ---
        if c_t <= sma_200:
            return False, {}
            
        # --- Pillar 2: Market Structure Breakout Trigger ---
        prev_row = df.iloc[t - 1]
        if c_t <= dh_20 or prev_row["close"] > prev_row["donchian_high_20"]:
            return False, {}
            
        # --- Pillar 3: Dynamic 20/50 EMA Elastic Pocket ---
        dist_20 = abs(c_t - ema_20) / c_t
        recent_pockets = [
            min(abs(df.iloc[t - k]["close"] - df.iloc[t - k]["ema_20"]),
                abs(df.iloc[t - k]["close"] - df.iloc[t - k]["ema_50"])) / df.iloc[t - k]["close"]
            for k in range(min(4, t))
        ]
        min_recent_pocket = min(recent_pockets) if recent_pockets else 999.0
        if dist_20 > 0.015 and min_recent_pocket > 0.015 and not (min(ema_20, ema_50) <= c_t <= max(ema_20, ema_50)):
            return False, {}
            
        # --- Pillar 4: Harmonic Fibonacci Retracement ---
        lookback = min(35, t)
        highs_sub = df["high"].iloc[t - lookback:t].values
        lows_sub = df["low"].iloc[t - lookback:t].values
        
        apex_idx = int(np.argmax(highs_sub))
        apex_p = highs_sub[apex_idx]
        
        if apex_idx >= 2:
            origin_p = float(np.min(lows_sub[:apex_idx]))
        else:
            origin_p = float(np.min(lows_sub))
            
        if apex_idx < lookback - 1:
            trough_p = float(np.min(lows_sub[apex_idx:]))
        else:
            trough_p = l_t
            
        impulse = apex_p - origin_p
        depth = (apex_p - trough_p) / impulse if impulse > 0 else 0.5
        
        # Golden Zone: 0.500 to 0.618 (with standard institutional leeway 0.450 to 0.680)
        in_golden_zone = (depth >= 0.450 and depth <= 0.680)
        if not in_golden_zone:
            return False, {}
            
        return True, {
            "direction": "LONG",
            "stretch_ratio": round(float(stretch_ratio), 3),
            "fib_depth": round(float(depth), 3),
            "entry_price": float(c_t),
            "atr_14": float(atr_14),
            "lowest_low_10": float(row["lowest_low_10"]),
        }
        
    else:  # SHORT (Commodities Only)
        if not is_commodity:
            return False, {}
            
        # --- Pillar 1: Macro Regime Gate ---
        if c_t >= sma_200:
            return False, {}
            
        # --- Pillar 2: Market Structure Breakdown Trigger ---
        prev_row = df.iloc[t - 1]
        if c_t >= dl_20 or prev_row["close"] < prev_row["donchian_low_20"]:
            return False, {}
            
        # --- Pillar 3: Dynamic 20/50 EMA Elastic Pocket ---
        dist_20 = abs(c_t - ema_20) / c_t
        recent_pockets = [
            min(abs(df.iloc[t - k]["close"] - df.iloc[t - k]["ema_20"]),
                abs(df.iloc[t - k]["close"] - df.iloc[t - k]["ema_50"])) / df.iloc[t - k]["close"]
            for k in range(min(4, t))
        ]
        min_recent_pocket = min(recent_pockets) if recent_pockets else 999.0
        if dist_20 > 0.015 and min_recent_pocket > 0.015 and not (min(ema_20, ema_50) <= c_t <= max(ema_20, ema_50)):
            return False, {}
            
        # --- Pillar 4: Harmonic Fibonacci Retracement ---
        lookback = min(35, t)
        highs_sub = df["high"].iloc[t - lookback:t].values
        lows_sub = df["low"].iloc[t - lookback:t].values
        
        apex_idx = int(np.argmin(lows_sub))
        apex_p = lows_sub[apex_idx]
        
        if apex_idx >= 2:
            origin_p = float(np.max(highs_sub[:apex_idx]))
        else:
            origin_p = float(np.max(highs_sub))
            
        if apex_idx < lookback - 1:
            peak_p = float(np.max(highs_sub[apex_idx:]))
        else:
            peak_p = h_t
            
        impulse = origin_p - apex_p
        depth = (peak_p - apex_p) / impulse if impulse > 0 else 0.5
        
        in_golden_zone = (depth >= 0.450 and depth <= 0.680)
        if not in_golden_zone:
            return False, {}
            
        return True, {
            "direction": "SHORT",
            "stretch_ratio": round(float(stretch_ratio), 3),
            "fib_depth": round(float(depth), 3),
            "entry_price": float(c_t),
            "atr_14": float(atr_14),
            "highest_high_10": float(row["highest_high_10"]),
        }


# ------------------------------------------------------------------------------
# 4. Triple-Barrier Execution Engine with Fee-Shield & Collision Invariant
# ------------------------------------------------------------------------------
def execute_triple_barrier_trade(
    df: pd.DataFrame,
    entry_idx: int,
    setup_info: Dict[str, Any],
    symbol: str,
    friction_pct: float,
    min_stop_pct: float,
    max_stop_pct: float,
    time_barrier_bars: int = 12,
) -> Dict[str, Any]:
    """
    Executes a candidate setup using the strict Triple Barrier:
    - Upper: +2.5R
    - Lower: -1.0R (clamped [min_stop_pct, max_stop_pct])
    - Fee-Shield: At +0.30R, SL auto-trails to Entry + round-trip friction for subsequent bars
    - Collision Invariant: Bar touching both TP and SL booked strictly as Stop Loss (-1.0R)
    - Time Barrier: 12 bars (market close)
    """
    n = len(df)
    direction_str = setup_info["direction"]
    direction = 1 if direction_str == "LONG" else -1
    entry_price = setup_info["entry_price"]
    entry_bar = df.iloc[entry_idx]
    entry_time = entry_bar["open_time"]
    
    # 1.5x ATR Stop Calculation
    atr_14 = setup_info["atr_14"]
    raw_stop_dist = 1.5 * atr_14
    raw_stop_pct = raw_stop_dist / entry_price
    
    clamped_stop_pct = max(min_stop_pct, min(max_stop_pct, raw_stop_pct))
    stop_dist = entry_price * clamped_stop_pct
    
    target_dist = 2.5 * stop_dist
    cost_r = friction_pct / clamped_stop_pct
    
    if direction == 1:
        initial_stop_price = entry_price - stop_dist
        target_price = entry_price + target_dist
        be_trigger_price = entry_price + (0.30 * stop_dist)
        be_stop_price = entry_price * (1.0 + friction_pct)  # Locks in 0.00R net exit
    else:
        initial_stop_price = entry_price + stop_dist
        target_price = entry_price - target_dist
        be_trigger_price = entry_price - (0.30 * stop_dist)
        be_stop_price = entry_price * (1.0 - friction_pct)
        
    be_activated = False
    exit_type = None
    exit_price = None
    exit_time = None
    bars_held = 0
    gross_r = 0.0
    net_r = 0.0
    
    max_idx = min(entry_idx + time_barrier_bars, n - 1)
    
    for k in range(1, time_barrier_bars + 1):
        curr_idx = entry_idx + k
        if curr_idx >= n:
            break
            
        bar = df.iloc[curr_idx]
        b_high = bar["high"]
        b_low = bar["low"]
        b_time = bar["open_time"]
        bars_held = k
        
        effective_stop = be_stop_price if be_activated else initial_stop_price
        
        if direction == 1:  # LONG
            hit_tp = b_high >= target_price
            hit_sl = b_low <= effective_stop
            
            # GOVERNANCE INVARIANT: Collision touches both TP and SL in same bar -> STOP LOSS (-1.0R)
            if hit_tp and hit_sl:
                exit_type = "COLLISION_STOP"
                exit_price = effective_stop
                exit_time = b_time
                gross_r = cost_r if be_activated else -1.0
                net_r = 0.0 if be_activated else (-1.0 - cost_r)
                break
                
            if hit_tp:
                exit_type = "TAKE_PROFIT"
                exit_price = target_price
                exit_time = b_time
                gross_r = 2.50
                net_r = 2.50 - cost_r
                break
                
            if hit_sl:
                if be_activated:
                    exit_type = "BREAKEVEN"
                    exit_price = be_stop_price
                    exit_time = b_time
                    gross_r = cost_r
                    net_r = 0.0
                else:
                    exit_type = "STOP_LOSS"
                    exit_price = initial_stop_price
                    exit_time = b_time
                    gross_r = -1.0
                    net_r = -1.0 - cost_r
                break
                
            # If bar survived without hitting TP or SL, check if BE trigger was crossed for subsequent bars
            if b_high >= be_trigger_price:
                be_activated = True
                
        else:  # SHORT
            hit_tp = b_low <= target_price
            hit_sl = b_high >= effective_stop
            
            if hit_tp and hit_sl:
                exit_type = "COLLISION_STOP"
                exit_price = effective_stop
                exit_time = b_time
                gross_r = cost_r if be_activated else -1.0
                net_r = 0.0 if be_activated else (-1.0 - cost_r)
                break
                
            if hit_tp:
                exit_type = "TAKE_PROFIT"
                exit_price = target_price
                exit_time = b_time
                gross_r = 2.50
                net_r = 2.50 - cost_r
                break
                
            if hit_sl:
                if be_activated:
                    exit_type = "BREAKEVEN"
                    exit_price = be_stop_price
                    exit_time = b_time
                    gross_r = cost_r
                    net_r = 0.0
                else:
                    exit_type = "STOP_LOSS"
                    exit_price = initial_stop_price
                    exit_time = b_time
                    gross_r = -1.0
                    net_r = -1.0 - cost_r
                break
                
            if b_low <= be_trigger_price:
                be_activated = True
                
    # If not closed by barrier, close on bar 12 Time Barrier
    if exit_type is None:
        last_bar = df.iloc[max_idx]
        exit_type = "TIME_EXPIRY"
        exit_price = last_bar["close"]
        exit_time = last_bar["open_time"]
        bars_held = max_idx - entry_idx
        
        if direction == 1:
            gross_r = (exit_price - entry_price) / stop_dist
        else:
            gross_r = (entry_price - exit_price) / stop_dist
            
        net_r = gross_r - cost_r
        if be_activated and net_r < 0.0:
            net_r = 0.0
            gross_r = cost_r
            exit_type = "BREAKEVEN"

    # Monetary Sizing: Dedicated ₹1,000 INR Capital per asset, 1R = ₹100.00
    pnl_inr = round(net_r * RISK_PER_TRADE_INR, 2)
    fees_paid_inr = round(cost_r * RISK_PER_TRADE_INR, 2)

    return {
        "trade_id": f"stage1_{symbol}_{int(entry_time.timestamp() * 1000)}",
        "symbol": symbol,
        "direction": direction_str,
        "entry_time": entry_time.isoformat(),
        "exit_time": exit_time.isoformat() if exit_time else entry_time.isoformat(),
        "entry_price": round(float(entry_price), 4),
        "exit_price": round(float(exit_price), 4),
        "initial_stop_price": round(float(initial_stop_price), 4),
        "target_price": round(float(target_price), 4),
        "stop_distance_pct": round(float(clamped_stop_pct), 4),
        "cost_r": round(float(cost_r), 4),
        "gross_r": round(float(gross_r), 4),
        "net_r": round(float(net_r), 4),
        "exit_type": exit_type,
        "bars_held": bars_held,
        "stretch_ratio": setup_info.get("stretch_ratio", 0.0),
        "fib_depth": setup_info.get("fib_depth", 0.0),
        "position_size_inr": CAPITAL_PER_ASSET_INR,
        "pnl_inr": pnl_inr,
        "fees_paid_inr": fees_paid_inr,
    }


# ------------------------------------------------------------------------------
# 5. Asset Execution Engine
# ------------------------------------------------------------------------------
def backtest_stage1_asset(symbol: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Runs Stage 1 Strict Rules Engine across full historical bars of an asset."""
    is_commodity = symbol in COMMODITY_ASSETS
    friction = COMMODITY_ROUND_TRIP_FRICTION if is_commodity else CRYPTO_ROUND_TRIP_FRICTION
    min_stop = 0.010 if is_commodity else 0.015
    max_stop = 0.040 if is_commodity else 0.060
    time_barrier = 12
    
    print(f"Ingesting & preprocessing {symbol}...")
    df_raw = load_asset_data(symbol)
    df = compute_indicators(df_raw)
    
    n = len(df)
    trades: List[Dict[str, Any]] = []
    
    t = 200
    while t < n - 12:
        is_long, setup_long = check_confluence_setup(df, t, direction=1, is_commodity=is_commodity)
        if is_long:
            trade = execute_triple_barrier_trade(
                df, t, setup_long, symbol, friction, min_stop, max_stop, time_barrier
            )
            trades.append(trade)
            t += max(1, trade["bars_held"])
            continue
            
        if is_commodity:
            is_short, setup_short = check_confluence_setup(df, t, direction=-1, is_commodity=is_commodity)
            if is_short:
                trade = execute_triple_barrier_trade(
                    df, t, setup_short, symbol, friction, min_stop, max_stop, time_barrier
                )
                trades.append(trade)
                t += max(1, trade["bars_held"])
                continue
                
        t += 1
        
    total_trades = len(trades)
    if total_trades == 0:
        return [], {
            "symbol": symbol,
            "total_trades": 0,
            "win_rate_pct": 0.0,
            "gross_r": 0.0,
            "net_r": 0.0,
            "avg_net_r": 0.0,
            "profit_factor": 1.0,
            "max_drawdown_r": 0.0,
            "net_pnl_inr": 0.0,
            "status": "100% Cash Safe / No Clean Entries",
        }
        
    wins = [t for t in trades if t["net_r"] > 0]
    losses = [t for t in trades if t["net_r"] < 0]
    
    win_rate = (len(wins) / total_trades) * 100.0
    total_gross_r = sum(t["gross_r"] for t in trades)
    total_net_r = sum(t["net_r"] for t in trades)
    avg_net_r = total_net_r / total_trades
    
    gross_gains = sum(t["net_r"] for t in wins)
    gross_losses = abs(sum(t["net_r"] for t in losses))
    profit_factor = (gross_gains / gross_losses) if gross_losses > 0 else (999.0 if gross_gains > 0 else 1.0)
    
    cumulative_r = 0.0
    peak_r = 0.0
    max_dd_r = 0.0
    for tr in trades:
        cumulative_r += tr["net_r"]
        if cumulative_r > peak_r:
            peak_r = cumulative_r
        dd = cumulative_r - peak_r
        if dd < max_dd_r:
            max_dd_r = dd
            
    net_pnl_inr = round(total_net_r * RISK_PER_TRADE_INR, 2)
    
    summary = {
        "symbol": symbol,
        "total_trades": total_trades,
        "win_rate_pct": round(win_rate, 1),
        "gross_r": round(total_gross_r, 2),
        "net_r": round(total_net_r, 2),
        "avg_net_r": round(avg_net_r, 3),
        "profit_factor": round(profit_factor, 2),
        "max_drawdown_r": round(max_dd_r, 2),
        "net_pnl_inr": net_pnl_inr,
        "status": "POSITIVE EXPECTANCY" if avg_net_r > 0 else "NEGATIVE DRAG",
    }
    return trades, summary


# ------------------------------------------------------------------------------
# 6. Main Orchestrator & Multi-Asset Scorecard Generation
# ------------------------------------------------------------------------------
def main():
    print("=" * 80)
    print("STAGE 1: STRICT INSTITUTIONAL RULES ENGINE & BASELINE BACKTEST")
    print("Multi-Asset Universe: 4H Crypto (BTC, ETH, SOL, DOT) & 1H Commodities (Gold, Silver, Crude Oil)")
    print("Protocol: Marcos López de Prado Triple-Barrier + 5-Pillar Confluence + Full Friction")
    print("=" * 80)
    
    all_trades: List[Dict[str, Any]] = []
    scorecards: List[Dict[str, Any]] = []
    
    start_clock = time.time()
    
    for symbol in ALL_ASSETS:
        print(f"\nProcessing {symbol}...")
        trades, summary = backtest_stage1_asset(symbol)
        all_trades.extend(trades)
        scorecards.append(summary)
        print(f"  -> {summary['total_trades']} Trades | WR: {summary['win_rate_pct']}% | Net: {summary['net_r']:+.2f}R | Avg: {summary['avg_net_r']:+.3f}R | PF: {summary['profit_factor']:.2f}")

    tot_trades = sum(s["total_trades"] for s in scorecards)
    portfolio_gross_r = sum(s["gross_r"] for s in scorecards)
    portfolio_net_r = sum(s["net_r"] for s in scorecards)
    portfolio_pnl_inr = sum(s["net_pnl_inr"] for s in scorecards)
    
    all_wins = [t for t in all_trades if t["net_r"] > 0]
    all_losses = [t for t in all_trades if t["net_r"] < 0]
    portfolio_win_rate = (len(all_wins) / tot_trades * 100.0) if tot_trades > 0 else 0.0
    portfolio_avg_net_r = (portfolio_net_r / tot_trades) if tot_trades > 0 else 0.0
    
    gross_gains_all = sum(t["net_r"] for t in all_wins)
    gross_losses_all = abs(sum(t["net_r"] for t in all_losses))
    portfolio_pf = (gross_gains_all / gross_losses_all) if gross_losses_all > 0 else (999.0 if gross_gains_all > 0 else 1.0)
    
    all_trades_sorted = sorted(all_trades, key=lambda x: x["entry_time"])
    cum = 0.0
    peak = 0.0
    port_max_dd = 0.0
    for t in all_trades_sorted:
        cum += t["net_r"]
        if cum > peak:
            peak = cum
        dd = cum - peak
        if dd < port_max_dd:
            port_max_dd = dd

    # Export Dataset for Stage 2 ML Training
    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(all_trades_sorted, f, indent=2)
    print(f"\nExported {len(all_trades_sorted)} candidate trades to {OUTPUT_JSON_PATH}")

    elapsed = round(time.time() - start_clock, 2)
    
    print("\n" + "=" * 80)
    print("STAGE 1 BASELINE PERFORMANCE SCORECARD (STRICT CONFLUENCE RULES)")
    print("=" * 80)
    
    scorecard_md = f"""
### Stage 1 Strict Rules Engine: Multi-Asset Performance Scorecard (2020–2026)

| Asset Symbol | Asset Class | Cadence | Total Trades | Win Rate (%) | Gross Return | Net Return (R) | Avg Net R (R_net) | Profit Factor | Max Drawdown (R) | Net PnL (₹1,000/Asset) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
"""
    for s in scorecards:
        asset_class = "Crypto" if s["symbol"] in CRYPTO_ASSETS else "Commodity"
        cadence = "4H" if s["symbol"] in CRYPTO_ASSETS else "1H"
        scorecard_md += f"| **{s['symbol']}** | {asset_class} | {cadence} | {s['total_trades']} | {s['win_rate_pct']:.1f}% | {s['gross_r']:+.2f}R | **{s['net_r']:+.2f}R** | **{s['avg_net_r']:+.3f}R** | {s['profit_factor']:.2f} | {s['max_drawdown_r']:.2f}R | **{'+' if s['net_pnl_inr'] >= 0 else ''}₹{s['net_pnl_inr']:,.2f}** |\n"

    scorecard_md += f"""| **COMBINED PORTFOLIO** | **Multi-Asset** | **4H / 1H** | **{tot_trades}** | **{portfolio_win_rate:.1f}%** | **{portfolio_gross_r:+.2f}R** | **{portfolio_net_r:+.2f}R** | **{portfolio_avg_net_r:+.3f}R** | **{portfolio_pf:.2f}** | **{port_max_dd:.2f}R** | **{'+' if portfolio_pnl_inr >= 0 else ''}₹{portfolio_pnl_inr:,.2f}** |

---

### Capital & Risk Accounting Summary:
- **Dedicated Capital:** ₹1,000 INR per asset across 7 assets = **₹7,000.00 Total Portfolio Capital**.
- **Risk Per Trade (1R):** ₹100.00 INR (10.0% of dedicated asset capital / 1.43% of total portfolio).
- **Current Portfolio Value:** **₹{7000.00 + portfolio_pnl_inr:,.2f} INR**.
- **Net Expectancy Verdict:** Stage 1 established a **{('POSITIVE' if portfolio_avg_net_r > 0 else 'NEGATIVE')}** baseline expectancy of **{portfolio_avg_net_r:+.3f}R / trade** across **{tot_trades} clean trades** with full round-trip friction and 18% GST deducted.
- **Stage 2 Hand-off:** Candidate trades saved to `research/stage1_candidate_trades.json` for training Stage 2 meta-labeling classifiers (LightGBM & Random Forest).
"""
    print(scorecard_md)
    print(f"Elapsed Time: {elapsed} seconds.")


if __name__ == "__main__":
    main()
