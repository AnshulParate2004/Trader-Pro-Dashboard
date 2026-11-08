#!/usr/bin/env python3
"""
Master Historical Trade Generation Pipeline for 3 Pure All-7 Asset Engines:
1. Unified 1H Multi-Asset Engine (7 Assets on 1H Candles, LightGBM Gated)
2. Unified 4H Swing Engine (7 Assets on 4H Candles, LightGBM Gated)
3. Rule-Based Engine Benchmark (7 Assets, Zero AI Filter Mechanical Donchian-20)

Universe:
- Commodities: Gold (GC=F / XAUUSDT), Silver (SI=F / XAGUSDT), Crude Oil (CL=F / CLUSDT)
- Crypto: BTCUSDT, ETHUSDT, SOLUSDT, DOTUSDT
"""

import os
import sys
import json
import math
import time
import datetime
import urllib.request
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

import numpy as np
import pandas as pd

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard")
SRC_DATA_DIR = ROOT_DIR / "src" / "data"
SRC_MODELS_DIR = ROOT_DIR / "src" / "models"
RESEARCH_DIR = ROOT_DIR / "research"
LOCAL_DATA_DIR = ROOT_DIR / "data"
NB_1H_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro/notebooks/data/1h")
NB_4H_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro/notebooks/data/4h")

SRC_DATA_DIR.mkdir(parents=True, exist_ok=True)
LOCAL_DATA_DIR.mkdir(parents=True, exist_ok=True)

COMMODITY_MAP = {
    "GC=F": {"display": "XAUUSDT", "name": "Gold (XAUUSDT)"},
    "SI=F": {"display": "XAGUSDT", "name": "Silver (XAGUSDT)"},
    "CL=F": {"display": "CLUSDT", "name": "Crude Oil (CLUSDT)"},
}

COMMODITIES = ["GC=F", "SI=F", "CL=F"]
CRYPTOS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT"]
ALL_SYMBOLS = COMMODITIES + CRYPTOS

FEATURE_NAMES = [
    "feat_atr_pct",
    "feat_vol_zscore",
    "feat_volatility_ratio",
    "feat_donchian_pos",
    "feat_trend_dist_200",
    "feat_mom_24h",
    "feat_mom_72h",
    "feat_rsi_14",
    "feat_dist_ema20",
    "feat_dist_ema50",
]

# Friction: 0.059% for commodities, 0.118% for crypto (includes 18% GST)
COMMODITY_FRICTION_PCT = 0.00059
CRYPTO_FRICTION_PCT = 0.00118


# ------------------------------------------------------------------------------
# 1. Tree Inference Evaluator
# ------------------------------------------------------------------------------
def eval_tree_node(node: Dict[str, Any], features: List[float]) -> float:
    if "leaf_value" in node:
        return float(node["leaf_value"])
    feat_idx = node["split_feature"]
    threshold = node["threshold"]
    default_left = node.get("default_left", True)
    val = features[feat_idx] if feat_idx < len(features) else None

    if val is None or math.isnan(val):
        child = node["left_child"] if default_left else node["right_child"]
        return eval_tree_node(child, features)

    if val <= threshold:
        return eval_tree_node(node["left_child"], features)
    else:
        return eval_tree_node(node["right_child"], features)


def predict_tree_probability(model: Dict[str, Any], features: List[float]) -> float:
    trees = model.get("tree_info", [])
    raw_sum = sum(eval_tree_node(t["tree_structure"], features) for t in trees)
    return 1.0 / (1.0 + math.exp(-raw_sum))


# ------------------------------------------------------------------------------
# 2. Resilient Market Data Ingestion
# ------------------------------------------------------------------------------
def fetch_binance_klines(symbol: str, interval: str, start_time_ms: int = 1704067200000) -> pd.DataFrame:
    base_url = "https://fapi.binance.com/fapi/v1/klines"
    end_ms = int(time.time() * 1000)
    curr_start = start_time_ms
    records = []

    print(f"  Downloading Binance {symbol} {interval} from {start_time_ms}...", end="", flush=True)
    retries = 0
    while curr_start < end_ms and retries < 5:
        url = f"{base_url}?symbol={symbol}&interval={interval}&startTime={curr_start}&limit=1500"
        req = urllib.request.Request(url, headers={"User-Agent": "Trader-Pro-Research/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if not data:
                break
            records.extend(data)
            last_open = data[-1][0]
            if last_open <= curr_start:
                break
            step_ms = (1 if interval == "1h" else 4) * 3600 * 1000
            curr_start = last_open + step_ms
            time.sleep(0.04)
        except Exception as e:
            retries += 1
            time.sleep(0.5)

    if not records:
        print(" Failed or empty.")
        return pd.DataFrame()

    cols = ["ot", "open", "high", "low", "close", "volume", "ct", "qv", "n", "tbv", "tbqv", "i"]
    df = pd.DataFrame(records, columns=cols)
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = df[c].astype(float)
    df["open_time"] = pd.to_datetime(df["ot"], unit="ms", utc=True)
    df["close_time"] = pd.to_datetime(df["ct"], unit="ms", utc=True)
    df = df.drop_duplicates("open_time").sort_values("open_time").reset_index(drop=True)
    print(f" Done ({len(df)} bars).")
    return df


def load_1h_data() -> Dict[str, pd.DataFrame]:
    dfs = {}
    print("\n[Data Ingestion] Loading 1-Hour candles for all 7 assets...")

    # Commodities (from local parquets in data/)
    for comm in COMMODITIES:
        clean = comm.replace("=", "_")
        p = LOCAL_DATA_DIR / f"{clean}_1h.parquet"
        if not p.exists():
            raise FileNotFoundError(f"Missing commodity 1H parquet: {p}")
        df = pd.read_parquet(p)
        dt_col = "open_time" if "open_time" in df.columns else ("Datetime" if "Datetime" in df.columns else df.columns[0])
        df["open_time"] = pd.to_datetime(df[dt_col], utc=True)
        for c in ["open", "high", "low", "close", "volume"]:
            df[c] = df[c].astype(float)
        df = df[["open_time", "open", "high", "low", "close", "volume"]].copy()
        df = df.sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
        dfs[comm] = df
        print(f"  Loaded {comm} 1H: {len(df)} candles ({df['open_time'].min()} to {df['open_time'].max()})")

    # Cryptos
    for crypto in CRYPTOS:
        p_nb = NB_1H_DIR / f"{crypto}_1h.parquet"
        p_local = LOCAL_DATA_DIR / f"{crypto}_1h.parquet"

        if p_local.exists():
            df = pd.read_parquet(p_local)
            df["open_time"] = pd.to_datetime(df["open_time"], utc=True)
        elif p_nb.exists():
            df = pd.read_parquet(p_nb)
            dt_col = "open_time" if "open_time" in df.columns else df.columns[0]
            df["open_time"] = pd.to_datetime(df[dt_col], utc=True)
            for c in ["open", "high", "low", "close", "volume"]:
                df[c] = df[c].astype(float)
            df = df[["open_time", "open", "high", "low", "close", "volume"]].copy()
            last_dt = df["open_time"].max()
            if last_dt < pd.Timestamp("2026-11-01", tz="UTC"):
                tail = fetch_binance_klines(crypto, "1h", int(last_dt.timestamp() * 1000))
                if not tail.empty:
                    df = pd.concat([df, tail[["open_time", "open", "high", "low", "close", "volume"]]], ignore_index=True)
            df.to_parquet(p_local)
        else:
            df = fetch_binance_klines(crypto, "1h", 1704067200000)
            df.to_parquet(p_local)

        df = df[df["open_time"] >= "2024-01-01"].sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
        dfs[crypto] = df
        print(f"  Loaded {crypto} 1H: {len(df)} candles ({df['open_time'].min()} to {df['open_time'].max()})")

    return dfs


def load_4h_data(dfs_1h: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    dfs = {}
    print("\n[Data Ingestion] Loading / Resampling 4-Hour candles for all 7 assets...")

    # Commodities: resampled from 1H
    for comm in COMMODITIES:
        df1 = dfs_1h[comm].copy().set_index("open_time")
        df4 = df1.resample("4h").agg({
            "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"
        }).dropna().reset_index()
        dfs[comm] = df4
        print(f"  Resampled {comm} 4H: {len(df4)} candles ({df4['open_time'].min()} to {df4['open_time'].max()})")

    # Cryptos
    for crypto in CRYPTOS:
        p_nb = NB_4H_DIR / f"{crypto}_4h.parquet"
        p_local = LOCAL_DATA_DIR / f"{crypto}_4h.parquet"

        if p_local.exists():
            df = pd.read_parquet(p_local)
            df["open_time"] = pd.to_datetime(df["open_time"], utc=True)
        elif p_nb.exists():
            df = pd.read_parquet(p_nb)
            dt_col = "open_time" if "open_time" in df.columns else df.columns[0]
            df["open_time"] = pd.to_datetime(df[dt_col], utc=True)
            for c in ["open", "high", "low", "close", "volume"]:
                df[c] = df[c].astype(float)
            df = df[["open_time", "open", "high", "low", "close", "volume"]].copy()
            last_dt = df["open_time"].max()
            if last_dt < pd.Timestamp("2026-11-01", tz="UTC"):
                tail = fetch_binance_klines(crypto, "4h", int(last_dt.timestamp() * 1000))
                if not tail.empty:
                    df = pd.concat([df, tail[["open_time", "open", "high", "low", "close", "volume"]]], ignore_index=True)
            df.to_parquet(p_local)
        else:
            df1 = dfs_1h[crypto].copy().set_index("open_time")
            df = df1.resample("4h").agg({
                "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"
            }).dropna().reset_index()
            df.to_parquet(p_local)

        df = df[df["open_time"] >= "2024-01-01"].sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
        dfs[crypto] = df
        print(f"  Loaded {crypto} 4H: {len(df)} candles ({df['open_time'].min()} to {df['open_time'].max()})")

    return dfs


# ------------------------------------------------------------------------------
# 3. Universal 10-Feature Matrix Computation
# ------------------------------------------------------------------------------
def compute_universal_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    c = df["close"]
    h = df["high"]
    l = df["low"]
    v = df["volume"]

    # True Range & ATRs
    prev_c = c.shift(1)
    tr1 = h - l
    tr2 = (h - prev_c).abs()
    tr3 = (l - prev_c).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr14 = tr.rolling(14, min_periods=14).mean()
    atr7 = tr.rolling(7, min_periods=7).mean()
    atr28 = tr.rolling(28, min_periods=28).mean()
    df["atr_14"] = atr14

    # 1. feat_atr_pct
    df["feat_atr_pct"] = atr14 / (c + 1e-8)

    # 2. feat_vol_zscore (20-bar)
    v_mean20 = v.rolling(20, min_periods=5).mean()
    v_std20 = v.rolling(20, min_periods=5).std()
    df["feat_vol_zscore"] = (v - v_mean20) / (v_std20 + 1e-8)

    # 3. feat_volatility_ratio
    df["feat_volatility_ratio"] = atr7 / (atr28 + 1e-8)

    # 4. feat_donchian_pos
    donch_high20 = h.shift(1).rolling(20, min_periods=20).max()
    donch_low20 = l.shift(1).rolling(20, min_periods=20).min()
    df["donch_high20"] = donch_high20
    df["donch_low20"] = donch_low20
    channel_width = donch_high20 - donch_low20
    df["feat_donchian_pos"] = (c - donch_low20) / (channel_width + 1e-8)

    # 5. feat_trend_dist_200
    sma200 = c.rolling(200, min_periods=30).mean()
    df["sma200"] = sma200
    df["feat_trend_dist_200"] = (c - sma200) / (sma200 + 1e-8)

    # 6. feat_mom_24h
    df["feat_mom_24h"] = (c - c.shift(24)) / (c.shift(24) + 1e-8)

    # 7. feat_mom_72h
    df["feat_mom_72h"] = (c - c.shift(72)) / (c.shift(72) + 1e-8)

    # 8. feat_rsi_14
    delta = c.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(14, min_periods=14).mean()
    avg_loss = loss.rolling(14, min_periods=14).mean()
    rs = avg_gain / (avg_loss + 1e-8)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    df["feat_rsi_14"] = (rsi - 50.0) / 50.0

    # 9. feat_dist_ema20
    ema20 = c.ewm(span=20, adjust=False).mean()
    df["feat_dist_ema20"] = (c - ema20) / (c + 1e-8)

    # 10. feat_dist_ema50
    ema50 = c.ewm(span=50, adjust=False).mean()
    df["feat_dist_ema50"] = (c - ema50) / (c + 1e-8)

    # Clean & Clip
    for col in FEATURE_NAMES:
        df[col] = df[col].fillna(0.0).clip(-5.0, 5.0)

    return df


# ------------------------------------------------------------------------------
# 4. Deterministic Backtest Engine (Triple Barrier with Zero Lookahead)
# ------------------------------------------------------------------------------
def execute_engine_backtest(
    df: pd.DataFrame,
    symbol: str,
    timeframe: str,
    model: Optional[Dict[str, Any]],
    p_cutoff: Optional[float],
    engine_id: str,
    engine_name: str,
    max_hold_bars: int = 16,
) -> List[Dict[str, Any]]:
    trades = []
    is_comm = "=F" in symbol or symbol in COMMODITIES
    display_sym = COMMODITY_MAP[symbol]["display"] if is_comm else symbol
    raw_sym = symbol

    min_stop = 0.010 if is_comm else 0.015
    max_stop = 0.040 if is_comm else 0.060
    friction_pct = COMMODITY_FRICTION_PCT if is_comm else CRYPTO_FRICTION_PCT

    n = len(df)
    last_exit_idx = -1

    for i in range(200, n - max_hold_bars):
        if i <= last_exit_idx:
            continue

        c = float(df["close"].iloc[i])
        d_high = float(df["donch_high20"].iloc[i])
        d_low = float(df["donch_low20"].iloc[i])
        sma = float(df["sma200"].iloc[i])
        atr = float(df["atr_14"].iloc[i])

        if math.isnan(d_high) or math.isnan(d_low) or math.isnan(sma) or math.isnan(atr) or atr <= 0:
            continue

        side = None
        if c > d_high and c > sma:
            side = "LONG"
        elif c < d_low and c < sma:
            side = "SHORT"

        if not side:
            continue

        # AI Meta-Model Gating
        prob = None
        if model is not None and p_cutoff is not None:
            features = [float(df[feat].iloc[i]) for feat in FEATURE_NAMES]
            prob = predict_tree_probability(model, features)
            if prob < p_cutoff:
                continue

        # 1.5x ATR Clamped Stop
        raw_stop_dist = 1.5 * atr
        raw_stop_pct = raw_stop_dist / c
        clamped_stop_pct = max(min_stop, min(max_stop, raw_stop_pct))
        stop_dist = c * clamped_stop_pct
        target_dist = 2.5 * stop_dist

        if side == "LONG":
            sl = c - stop_dist
            tp = c + target_dist
        else:
            sl = c + stop_dist
            tp = c - target_dist

        # Forward simulate outcome through future bars
        gross_r = 0.0
        exit_reason = "TIME_EXPIRY"
        exit_type = "TIME_EXPIRY"
        exit_bar = i + max_hold_bars
        exit_price = float(df["close"].iloc[exit_bar])

        for bar_offset in range(1, max_hold_bars + 1):
            curr_idx = i + bar_offset
            bh = float(df["high"].iloc[curr_idx])
            bl = float(df["low"].iloc[curr_idx])

            if side == "LONG":
                hit_tp = bh >= tp
                hit_sl = bl <= sl
                if hit_tp and hit_sl:
                    gross_r = -1.0
                    exit_reason = "STOP_LOSS"
                    exit_type = "COLLISION_STOP"
                    exit_bar = curr_idx
                    exit_price = sl
                    break
                elif hit_tp:
                    gross_r = 2.5
                    exit_reason = "TAKE_PROFIT"
                    exit_type = "TAKE_PROFIT"
                    exit_bar = curr_idx
                    exit_price = tp
                    break
                elif hit_sl:
                    gross_r = -1.0
                    exit_reason = "STOP_LOSS"
                    exit_type = "STOP_LOSS"
                    exit_bar = curr_idx
                    exit_price = sl
                    break
            else:  # SHORT
                hit_tp = bl <= tp
                hit_sl = bh >= sl
                if hit_tp and hit_sl:
                    gross_r = -1.0
                    exit_reason = "STOP_LOSS"
                    exit_type = "COLLISION_STOP"
                    exit_bar = curr_idx
                    exit_price = sl
                    break
                elif hit_tp:
                    gross_r = 2.5
                    exit_reason = "TAKE_PROFIT"
                    exit_type = "TAKE_PROFIT"
                    exit_bar = curr_idx
                    exit_price = tp
                    break
                elif hit_sl:
                    gross_r = -1.0
                    exit_reason = "STOP_LOSS"
                    exit_type = "STOP_LOSS"
                    exit_bar = curr_idx
                    exit_price = sl
                    break

        if exit_reason == "TIME_EXPIRY":
            if side == "LONG":
                gross_r = (exit_price - c) / stop_dist
            else:
                gross_r = (c - exit_price) / stop_dist

        cost_r = friction_pct / clamped_stop_pct
        net_r = gross_r - cost_r
        outcome_r = round(net_r, 4)
        return_pct = round(outcome_r * 3.0, 2)

        entry_time_val = df["open_time"].iloc[i]
        exit_time_val = df["open_time"].iloc[min(exit_bar, len(df) - 1)]

        entry_iso = entry_time_val.isoformat()
        exit_iso = exit_time_val.isoformat()
        entry_ms = int(entry_time_val.timestamp() * 1000)
        exit_ms = int(exit_time_val.timestamp() * 1000)

        trade_id = f"{engine_id[:8]}_{display_sym}_{entry_ms}"

        trades.append({
            "id": trade_id,
            "trade_id": trade_id,
            "pos": 0,  # will re-index
            "entryTime": entry_iso,
            "entry_time": entry_iso,
            "entry_time_ms": entry_ms,
            "exitTime": exit_iso,
            "exit_time": exit_iso,
            "exit_time_ms": exit_ms,
            "side": side,
            "direction": side,
            "symbol": display_sym,
            "rawSymbol": raw_sym,
            "displaySymbol": display_sym,
            "entry_price": round(c, 4),
            "exit_price": round(exit_price, 4),
            "stop_loss": round(sl, 4),
            "take_profit": round(tp, 4),
            "stop_distance_pct": round(clamped_stop_pct, 4),
            "cost_r": round(cost_r, 4),
            "gross_r": round(gross_r, 4),
            "net_r": round(net_r, 4),
            "outcomeR": outcome_r,
            "returnPct": return_pct,
            "exitReason": exit_reason,
            "exit_type": exit_type,
            "bars_held": exit_bar - i,
            "holding_bars": exit_bar - i,
            "timeframe": timeframe,
            "model": engine_name,
            "modelId": engine_id,
            "probability": round(prob, 4) if prob is not None else None,
            "p_cutoff": p_cutoff,
            "status": "CLOSED",
        })
        last_exit_idx = exit_bar

    return trades


# ------------------------------------------------------------------------------
# 5. Master Pipeline Execution
# ------------------------------------------------------------------------------
def main():
    print("=" * 80)
    print("MASTER PIPELINE: GENERATE ALL-7 ASSET DATASETS FOR 3 ENGINES")
    print("=" * 80)

    # 1. Load Data
    dfs_1h = load_1h_data()
    dfs_4h = load_4h_data(dfs_1h)

    # 2. Compute Features
    print("\n[Feature Engineering] Computing Universal 10-Feature matrices for all assets...")
    feat_1h = {}
    feat_4h = {}
    for sym in ALL_SYMBOLS:
        feat_1h[sym] = compute_universal_features(dfs_1h[sym])
        feat_4h[sym] = compute_universal_features(dfs_4h[sym])
        print(f"  Features computed: {sym} (1H: {len(feat_1h[sym])}, 4H: {len(feat_4h[sym])})")

    # 3. Load Trained Meta-Models & Calibrated Cutoffs
    print("\n[Model Loading] Loading trained 7-asset LightGBM meta-models...")
    with open(SRC_MODELS_DIR / "unified_1h_7assets" / "model.json") as f:
        model_1h = json.load(f)
    p_cutoff_1h = 0.062

    with open(SRC_MODELS_DIR / "unified_4h_7assets" / "model.json") as f:
        model_4h = json.load(f)
    p_cutoff_4h = 0.060

    # Update metadata files to keep everything synchronized
    p_meta_1h = SRC_MODELS_DIR / "unified_1h_7assets" / "metadata.json"
    with open(p_meta_1h, "r", encoding="utf-8") as f:
        meta_1h = json.load(f)
    meta_1h["p_cutoff"] = p_cutoff_1h
    with open(p_meta_1h, "w", encoding="utf-8") as f:
        json.dump(meta_1h, f, indent=2)

    p_meta_4h = SRC_MODELS_DIR / "unified_4h_7assets" / "metadata.json"
    with open(p_meta_4h, "r", encoding="utf-8") as f:
        meta_4h = json.load(f)
    meta_4h["p_cutoff"] = p_cutoff_4h
    with open(p_meta_4h, "w", encoding="utf-8") as f:
        json.dump(meta_4h, f, indent=2)

    print(f"  1H Model calibrated cutoff: p_cutoff = {p_cutoff_1h}")
    print(f"  4H Model calibrated cutoff: p_cutoff = {p_cutoff_4h}")

    # 4. Generate Dataset 1: Unified 1H Multi-Asset (ALL 7 ASSETS)
    print("\n" + "-" * 60)
    print("Generating Engine 1: Unified 1H Multi-Asset (7 Assets, LightGBM Gated)")
    print("-" * 60)
    trades_1h_all = []
    for sym in ALL_SYMBOLS:
        t = execute_engine_backtest(
            df=feat_1h[sym],
            symbol=sym,
            timeframe="1h",
            model=model_1h,
            p_cutoff=p_cutoff_1h,
            engine_id="unified-1h-engine",
            engine_name="Unified 1H Multi-Asset Engine",
            max_hold_bars=16,
        )
        trades_1h_all.extend(t)
        print(f"  1H Gated Trades for {sym}: {len(t)}")

    trades_1h_all.sort(key=lambda x: x["entry_time_ms"])
    for idx, tr in enumerate(trades_1h_all, 1):
        tr["pos"] = idx

    path_1h = SRC_DATA_DIR / "unified_1h_historical_trades.json"
    with open(path_1h, "w", encoding="utf-8") as f:
        json.dump(trades_1h_all, f, indent=2)
    print(f"  --> Saved {len(trades_1h_all)} trades to {path_1h.name}")

    # 5. Generate Dataset 2: Unified 4H Swing (ALL 7 ASSETS)
    print("\n" + "-" * 60)
    print("Generating Engine 2: Unified 4H Swing (7 Assets, LightGBM Gated)")
    print("-" * 60)
    trades_4h_all = []
    for sym in ALL_SYMBOLS:
        t = execute_engine_backtest(
            df=feat_4h[sym],
            symbol=sym,
            timeframe="4h",
            model=model_4h,
            p_cutoff=p_cutoff_4h,
            engine_id="unified-4h-engine",
            engine_name="Unified 4H Swing Engine",
            max_hold_bars=12,
        )
        trades_4h_all.extend(t)
        print(f"  4H Gated Trades for {sym}: {len(t)}")

    trades_4h_all.sort(key=lambda x: x["entry_time_ms"])
    for idx, tr in enumerate(trades_4h_all, 1):
        tr["pos"] = idx

    path_4h = SRC_DATA_DIR / "unified_4h_historical_trades.json"
    with open(path_4h, "w", encoding="utf-8") as f:
        json.dump(trades_4h_all, f, indent=2)
    print(f"  --> Saved {len(trades_4h_all)} trades to {path_4h.name}")

    # 6. Generate Dataset 3: Pure Rule-Based Engine (ALL 7 ASSETS, Zero AI Gating)
    print("\n" + "-" * 60)
    print("Generating Engine 3: Pure Rules Baseline (7 Assets, Zero AI Filter)")
    print("-" * 60)
    trades_rules_all = []
    for sym in ALL_SYMBOLS:
        t = execute_engine_backtest(
            df=feat_1h[sym],
            symbol=sym,
            timeframe="1h",
            model=None,
            p_cutoff=None,
            engine_id="pure-rules-baseline",
            engine_name="Rule-Based Engine (No AI Filter)",
            max_hold_bars=16,
        )
        trades_rules_all.extend(t)
        print(f"  Pure Rule Trades for {sym}: {len(t)}")

    trades_rules_all.sort(key=lambda x: x["entry_time_ms"])
    for idx, tr in enumerate(trades_rules_all, 1):
        tr["pos"] = idx

    path_rules = SRC_DATA_DIR / "pure_rule_historical_trades.json"
    with open(path_rules, "w", encoding="utf-8") as f:
        json.dump(trades_rules_all, f, indent=2)
    print(f"  --> Saved {len(trades_rules_all)} trades to {path_rules.name}")

    # 7. Delete old contaminated bundles
    print("\n[Cleanup] Removing old contaminated historical bundles...")
    for old_file in [
        SRC_DATA_DIR / "verified_multi_asset_historical_trades.json",
        SRC_DATA_DIR / "verified_4h_historical_trades.json",
    ]:
        if old_file.exists():
            old_file.unlink()
            print(f"  Removed old file: {old_file.name}")
        else:
            print(f"  Already absent: {old_file.name}")

    # 8. Print Comparative Institutional Summary
    def calc_stats(tr_list, name):
        if not tr_list:
            return
        wins = [x for x in tr_list if x["net_r"] > 0]
        losses = [x for x in tr_list if x["net_r"] <= 0]
        net_r = sum(x["net_r"] for x in tr_list)
        gross_r = sum(x["gross_r"] for x in tr_list)
        costs = sum(x["cost_r"] for x in tr_list)
        wr = len(wins) / len(tr_list) * 100
        gross_win = sum(x["net_r"] for x in wins)
        gross_loss = abs(sum(x["net_r"] for x in losses))
        pf = gross_win / gross_loss if gross_loss > 0 else float("inf")
        symbols = set(x["symbol"] for x in tr_list)

        print(f"\n{name}:")
        print(f"  Total Trades: {len(tr_list)}")
        print(f"  Symbols ({len(symbols)}): {sorted(list(symbols))}")
        print(f"  Win Rate: {wr:.1f}% ({len(wins)}W / {len(losses)}L)")
        print(f"  Gross Return: {gross_r:+.2f} R | Friction: {costs:.2f} R")
        print(f"  Net Return: {net_r:+.2f} R ({net_r / len(tr_list):+.3f} R/trade)")
        print(f"  Profit Factor: {pf:.2f}")

    print("\n" + "=" * 80)
    print("FINAL 3-ENGINE ALL-7 ASSET SUMMARY AUDIT")
    print("=" * 80)
    calc_stats(trades_1h_all, "1. Unified 1H Multi-Asset Engine (7 Assets)")
    calc_stats(trades_4h_all, "2. Unified 4H Swing Engine (7 Assets)")
    calc_stats(trades_rules_all, "3. Pure Rule-Based Engine (7 Assets)")


if __name__ == "__main__":
    main()
