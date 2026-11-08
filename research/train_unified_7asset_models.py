#!/usr/bin/env python3
"""
Institutional Meta-Model Training Pipeline for Unified 7-Asset Architecture
Universe:
  Commodities: GC=F (Gold), SI=F (Silver), CL=F (Crude Oil)
  Crypto: BTCUSDT, ETHUSDT, SOLUSDT, DOTUSDT
Timeframes:
  1. Unified 1-Hour (1H) Meta-Model -> src/models/unified_1h_7assets/
  2. Unified 4-Hour (4H) Meta-Model -> src/models/unified_4h_7assets/
Features: Universal 10-Feature Schema (identical across all 7 assets)
"""

import os
import sys
import json
import math
import time
import datetime
import urllib.request
from pathlib import Path
from typing import Dict, List, Any, Tuple

import numpy as np
import pandas as pd
import lightgbm as lgb

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
MODELS_DIR = ROOT_DIR / "src" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

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

COMMODITIES = ["GC=F", "SI=F", "CL=F"]
CRYPTOS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT"]
ALL_SYMBOLS = COMMODITIES + CRYPTOS

def fetch_binance_klines(symbol: str, interval: str, total_needed: int = 4000) -> pd.DataFrame:
    all_bars = []
    end_time = None
    retries = 0
    while len(all_bars) < total_needed and retries < 5:
        url = f"https://fapi.binance.com/fapi/v1/klines?symbol={symbol}&interval={interval}&limit=1000"
        if end_time:
            url += f"&endTime={end_time}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Trader-Pro-Research/1.0"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode())
            if not data:
                break
            all_bars = data + all_bars
            end_time = data[0][0] - 1
            time.sleep(0.04)
        except Exception as e:
            retries += 1
            time.sleep(0.5)

    if not all_bars:
        print(f"Warning: could not fetch Binance klines for {symbol} {interval}")
        return pd.DataFrame()

    cols = ["ot", "open", "high", "low", "close", "volume", "ct", "qv", "n", "tbv", "tbqv", "i"]
    df = pd.DataFrame(all_bars, columns=cols)
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = df[c].astype(float)
    df["open_time"] = pd.to_datetime(df["ot"], unit="ms", utc=True)
    df = df.drop_duplicates("open_time").sort_values("open_time").reset_index(drop=True)
    return df

def load_commodity_1h(symbol: str) -> pd.DataFrame:
    clean_sym = symbol.replace("=", "_")
    p = DATA_DIR / f"{clean_sym}_1h.parquet"
    if not p.exists():
        print(f"Parquet file {p} does not exist!")
        return pd.DataFrame()
    df = pd.read_parquet(p)
    if "Datetime" in df.columns:
        df["open_time"] = pd.to_datetime(df["Datetime"], utc=True)
    elif "open_time" not in df.columns and "timestamp" in df.columns:
        df["open_time"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df[["open_time", "open", "high", "low", "close", "volume"]].copy()
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = df[c].astype(float)
    return df.sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)

def resample_to_4h(df_1h: pd.DataFrame) -> pd.DataFrame:
    if df_1h.empty:
        return pd.DataFrame()
    df = df_1h.set_index("open_time")
    df_4h = df.resample("4h").agg({
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum"
    }).dropna().reset_index()
    return df_4h

def compute_universal_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    c = df["close"]
    h = df["high"]
    l = df["low"]
    v = df["volume"]

    # True Range and ATR
    prev_c = c.shift(1)
    tr1 = h - l
    tr2 = (h - prev_c).abs()
    tr3 = (l - prev_c).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr14 = tr.rolling(14).mean()
    atr7 = tr.rolling(7).mean()
    atr28 = tr.rolling(28).mean()

    # 1. feat_atr_pct
    df["feat_atr_pct"] = atr14 / (c + 1e-8)

    # 2. feat_vol_zscore (20-bar)
    v_mean20 = v.rolling(20).mean()
    v_std20 = v.rolling(20).std()
    df["feat_vol_zscore"] = (v - v_mean20) / (v_std20 + 1e-8)

    # 3. feat_volatility_ratio
    df["feat_volatility_ratio"] = atr7 / (atr28 + 1e-8)

    # 4. feat_donchian_pos
    donch_high20 = h.shift(1).rolling(20).max()
    donch_low20 = l.shift(1).rolling(20).min()
    df["donch_high20"] = donch_high20
    df["donch_low20"] = donch_low20
    channel_width = donch_high20 - donch_low20
    df["feat_donchian_pos"] = (c - donch_low20) / (channel_width + 1e-8)

    # 5. feat_trend_dist_200
    sma200 = c.rolling(200).mean()
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
    avg_gain = gain.rolling(14).mean()
    avg_loss = loss.rolling(14).mean()
    rs = avg_gain / (avg_loss + 1e-8)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    df["feat_rsi_14"] = (rsi - 50.0) / 50.0

    # 9. feat_dist_ema20
    ema20 = c.ewm(span=20, adjust=False).mean()
    df["feat_dist_ema20"] = (c - ema20) / (c + 1e-8)

    # 10. feat_dist_ema50
    ema50 = c.ewm(span=50, adjust=False).mean()
    df["feat_dist_ema50"] = (c - ema50) / (c + 1e-8)

    # Fill NaNs with 0.0
    for col in FEATURE_NAMES:
        df[col] = df[col].fillna(0.0).clip(-5.0, 5.0)

    return df

def generate_breakouts(
    df: pd.DataFrame,
    symbol: str,
    timeframe: str = "1h",
    max_hold_bars: int = 16,
) -> List[Dict[str, Any]]:
    trades = []
    min_stop = 0.010 if timeframe == "1h" else 0.015
    max_stop = 0.040 if timeframe == "1h" else 0.060
    friction_pct = 0.0005 if "=F" in symbol else 0.0010 # 5 bps for comm, 10 bps for crypto

    n = len(df)
    last_exit_idx = -1

    for i in range(200, n - max_hold_bars):
        if i <= last_exit_idx:
            continue

        c = df["close"].iloc[i]
        d_high = df["donch_high20"].iloc[i]
        d_low = df["donch_low20"].iloc[i]
        sma = df["sma200"].iloc[i]

        if math.isnan(d_high) or math.isnan(d_low) or math.isnan(sma):
            continue

        side = None
        if c > d_high and c > sma:
            side = "LONG"
        elif c < d_low and c < sma:
            side = "SHORT"

        if not side:
            continue

        # Structural stop
        if side == "LONG":
            raw_stop_pct = (c - d_low) / c
            stop_pct = max(min_stop, min(max_stop, raw_stop_pct))
            sl = c * (1.0 - stop_pct)
            tp = c * (1.0 + 2.5 * stop_pct)
        else:
            raw_stop_pct = (d_high - c) / c
            stop_pct = max(min_stop, min(max_stop, raw_stop_pct))
            sl = c * (1.0 + stop_pct)
            tp = c * (1.0 - 2.5 * stop_pct)

        # Forward simulate outcome
        gross_r = 0.0
        exit_type = "TIME"
        exit_bar = i + max_hold_bars
        exit_price = df["close"].iloc[exit_bar]

        for bar_offset in range(1, max_hold_bars + 1):
            curr_idx = i + bar_offset
            bh = df["high"].iloc[curr_idx]
            bl = df["low"].iloc[curr_idx]

            if side == "LONG":
                hit_tp = bh >= tp
                hit_sl = bl <= sl
                if hit_tp and hit_sl: # collision
                    gross_r = -1.0
                    exit_type = "COLLISION_STOP"
                    exit_bar = curr_idx
                    exit_price = sl
                    break
                elif hit_tp:
                    gross_r = 2.5
                    exit_type = "TARGET"
                    exit_bar = curr_idx
                    exit_price = tp
                    break
                elif hit_sl:
                    gross_r = -1.0
                    exit_type = "STOP"
                    exit_bar = curr_idx
                    exit_price = sl
                    break
            else: # SHORT
                hit_tp = bl <= tp
                hit_sl = bh >= sl
                if hit_tp and hit_sl: # collision
                    gross_r = -1.0
                    exit_type = "COLLISION_STOP"
                    exit_bar = curr_idx
                    exit_price = sl
                    break
                elif hit_tp:
                    gross_r = 2.5
                    exit_type = "TARGET"
                    exit_bar = curr_idx
                    exit_price = tp
                    break
                elif hit_sl:
                    gross_r = -1.0
                    exit_type = "STOP"
                    exit_bar = curr_idx
                    exit_price = sl
                    break

        if exit_type == "TIME":
            if side == "LONG":
                gross_r = (exit_price - c) / (c * stop_pct)
            else:
                gross_r = (c - exit_price) / (c * stop_pct)

        cost_r = friction_pct / stop_pct
        net_r = gross_r - cost_r
        # Binary meta-label: 1 if profitable target or positive return, 0 otherwise
        target_y = 1 if gross_r >= 1.5 else 0

        features = [float(df[feat].iloc[i]) for feat in FEATURE_NAMES]

        trades.append({
            "symbol": symbol,
            "side": side,
            "entry_time": str(df["open_time"].iloc[i]),
            "entry_idx": i,
            "exit_idx": exit_bar,
            "entry_price": c,
            "exit_price": exit_price,
            "stop_pct": stop_pct,
            "gross_r": gross_r,
            "cost_r": cost_r,
            "net_r": net_r,
            "exit_type": exit_type,
            "y": target_y,
            "features": features,
        })
        last_exit_idx = exit_bar

    return trades

def train_and_calibrate(
    all_trades: List[Dict[str, Any]],
    timeframe: str,
    output_dir: Path
) -> Tuple[float, Dict[str, Any]]:
    # Sort chronologically
    all_trades.sort(key=lambda t: t["entry_time"])
    n = len(all_trades)
    train_size = int(n * 0.75)
    train_trades = all_trades[:train_size]
    oos_trades = all_trades[train_size:]

    X_train = np.array([t["features"] for t in train_trades])
    y_train = np.array([t["y"] for t in train_trades])
    X_oos = np.array([t["features"] for t in oos_trades])
    y_oos = np.array([t["y"] for t in oos_trades])

    print(f"\n[{timeframe.upper()}] Total Trades: {n} (Train: {len(train_trades)}, OOS: {len(oos_trades)})")
    print(f"[{timeframe.upper()}] Base Win/Target Rate: {y_train.mean()*100:.1f}% (Train), {y_oos.mean()*100:.1f}% (OOS)")

    clf = lgb.LGBMClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_samples=15,
        random_state=42,
        verbosity=-1,
    )
    clf.fit(X_train, y_train)

    train_probs = clf.predict_proba(X_train)[:, 1]
    oos_probs = clf.predict_proba(X_oos)[:, 1]

    # Attach probabilities
    for i, t in enumerate(train_trades):
        t["prob"] = float(train_probs[i])
    for i, t in enumerate(oos_trades):
        t["prob"] = float(oos_probs[i])

    # Calibrate optimal threshold tau*
    best_tau = 0.10
    best_score = -999.0
    best_net_r = 0.0
    best_wr = 0.0
    best_count = 0

    thresholds = np.linspace(0.04, 0.35, 63)
    for tau in thresholds:
        admitted = [t for t in oos_trades if t["prob"] >= tau]
        if len(admitted) < 12:
            continue
        net_r_total = sum(t["net_r"] for t in admitted)
        wins = len([t for t in admitted if t["net_r"] > 0])
        wr = (wins / len(admitted)) * 100.0

        # Max Drawdown
        cum = np.cumsum([t["net_r"] for t in admitted])
        peak = np.maximum.accumulate(cum)
        dd = cum - peak
        max_dd = abs(float(np.min(dd))) if len(dd) > 0 else 0.0

        score = net_r_total - 0.2 * max_dd
        if score > best_score:
            best_score = score
            best_tau = float(tau)
            best_net_r = net_r_total
            best_wr = wr
            best_count = len(admitted)

    print(f"[{timeframe.upper()}] Calibrated Cutoff tau*: {best_tau:.4f}")
    print(f"[{timeframe.upper()}] OOS Admitted Trades: {best_count} / {len(oos_trades)}")
    print(f"[{timeframe.upper()}] OOS Win Rate: {best_wr:.1f}%, OOS Net R: {best_net_r:+.2f}R, Score: {best_score:.2f}")

    # Serialize LightGBM Model
    output_dir.mkdir(parents=True, exist_ok=True)
    model_json = clf.booster_.dump_model()
    with open(output_dir / "model.json", "w") as f:
        json.dump(model_json, f, indent=2)

    # Feature statistics
    feature_stats = {}
    for idx, fname in enumerate(FEATURE_NAMES):
        vals = X_train[:, idx]
        feature_stats[fname] = {
            "mean": float(np.mean(vals)),
            "std": float(np.std(vals)),
            "min": float(np.min(vals)),
            "max": float(np.max(vals)),
        }

    # Verification sample
    verification_samples = []
    for s_idx in [0, 5, 10]:
        if s_idx < len(X_oos):
            verification_samples.append({
                "features": [float(x) for x in X_oos[s_idx]],
                "expected_prob": float(oos_probs[s_idx]),
            })

    metadata = {
        "model_name": f"unified_{timeframe}_7assets",
        "timeframe": timeframe,
        "assets": ALL_SYMBOLS,
        "n_samples": n,
        "target_base_rate": float(y_train.mean()),
        "p_cutoff": round(best_tau, 4),
        "tau_star": round(best_tau, 4),
        "percentile_75": round(float(np.percentile(train_probs, 75)), 4),
        "percentile_80": round(float(np.percentile(train_probs, 80)), 4),
        "percentile_90": round(float(np.percentile(train_probs, 90)), 4),
        "num_trees": 100,
        "feature_names": FEATURE_NAMES,
        "feature_stats": feature_stats,
        "verification_samples": verification_samples,
    }

    with open(output_dir / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"[{timeframe.upper()}] Successfully serialized model.json & metadata.json to {output_dir}")
    return best_tau, metadata

def main():
    print("=" * 80)
    print("TRAINING UNIFIED 7-ASSET META-MODELS (1H & 4H)")
    print("Universe: Gold, Silver, Crude Oil, BTC, ETH, SOL, DOT")
    print("Universal 10-Feature Schema (Identical across all 7 assets)")
    print("=" * 80)

    # 1. Load Data for All 7 Assets
    print("\n[Phase 1] Loading & Resampling Candle Data...")
    dfs_1h = {}
    dfs_4h = {}

    # Commodities (from parquet)
    for comm in COMMODITIES:
        df1 = load_commodity_1h(comm)
        print(f"  Loaded {comm} 1H: {len(df1)} candles")
        dfs_1h[comm] = df1
        df4 = resample_to_4h(df1)
        print(f"  Resampled {comm} 4H: {len(df4)} candles")
        dfs_4h[comm] = df4

    # Crypto (from Binance)
    for crypto in CRYPTOS:
        df1 = fetch_binance_klines(crypto, "1h", 3500)
        print(f"  Fetched {crypto} 1H: {len(df1)} candles")
        dfs_1h[crypto] = df1
        df4 = fetch_binance_klines(crypto, "4h", 3000)
        print(f"  Fetched {crypto} 4H: {len(df4)} candles")
        dfs_4h[crypto] = df4

    # 2. Compute Universal Features
    print("\n[Phase 2] Computing Universal 10-Feature Matrices...")
    feat_dfs_1h = {}
    feat_dfs_4h = {}
    for sym in ALL_SYMBOLS:
        feat_dfs_1h[sym] = compute_universal_features(dfs_1h[sym])
        feat_dfs_4h[sym] = compute_universal_features(dfs_4h[sym])
        print(f"  Universal features computed for {sym} (1H: {len(feat_dfs_1h[sym])}, 4H: {len(feat_dfs_4h[sym])})")

    # 3. Generate Breakout Candidate Trades
    print("\n[Phase 3] Generating Breakout Candidates & Simulating Forward Barriers...")
    all_1h_trades = []
    all_4h_trades = []

    for sym in ALL_SYMBOLS:
        t_1h = generate_breakouts(feat_dfs_1h[sym], sym, "1h", max_hold_bars=24)
        all_1h_trades.extend(t_1h)
        t_4h = generate_breakouts(feat_dfs_4h[sym], sym, "4h", max_hold_bars=12)
        all_4h_trades.extend(t_4h)
        print(f"  {sym} Candidates -> 1H: {len(t_1h)} trades | 4H: {len(t_4h)} trades")

    print(f"\nTotal 1H Candidate Trades across 7 assets: {len(all_1h_trades)}")
    print(f"Total 4H Candidate Trades across 7 assets: {len(all_4h_trades)}")

    # 4. Train & Calibrate 1H Model
    dir_1h = MODELS_DIR / "unified_1h_7assets"
    tau_1h, meta_1h = train_and_calibrate(all_1h_trades, "1h", dir_1h)

    # 5. Train & Calibrate 4H Model
    dir_4h = MODELS_DIR / "unified_4h_7assets"
    tau_4h, meta_4h = train_and_calibrate(all_4h_trades, "4h", dir_4h)

    print("\n" + "=" * 80)
    print("UNIFIED 7-ASSET MODEL TRAINING COMPLETE")
    print(f"  1H Model: {dir_1h} | tau* = {tau_1h:.4f}")
    print(f"  4H Model: {dir_4h} | tau* = {tau_4h:.4f}")
    print("=" * 80)

if __name__ == "__main__":
    main()
