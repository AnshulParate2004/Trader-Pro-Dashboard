#!/usr/bin/env python3
"""
Master Execution Pipeline: 2.75-Year Window (Post-ETF: Jan 1, 2024 to Oct 20, 2026)
Retrain All 4 Engines, Generate Clean Datasets, and Re-seed MongoDB Atlas
"""

import os
import sys
import json
import math
import shutil
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

import numpy as np
import pandas as pd
import lightgbm as lgb
from pymongo import MongoClient

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard")
DATA_DIR = ROOT_DIR / "data"
SRC_DATA_DIR = ROOT_DIR / "src" / "data"
SRC_MODELS_DIR = ROOT_DIR / "src" / "models"

SRC_DATA_DIR.mkdir(parents=True, exist_ok=True)
SRC_MODELS_DIR.mkdir(parents=True, exist_ok=True)

COMMODITY_MAP = {
    "GC=F": {"display": "XAUUSDT", "name": "Gold (XAUUSDT)", "aliases": ["GC=F", "GC_F", "XAUUSDT"]},
    "SI=F": {"display": "XAGUSDT", "name": "Silver (XAGUSDT)", "aliases": ["SI=F", "SI_F", "XAGUSDT"]},
    "CL=F": {"display": "CLUSDT", "name": "Crude Oil (CLUSDT)", "aliases": ["CL=F", "CL_F", "CLUSDT"]},
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

COMMODITY_FRICTION_PCT = 0.00059  # 5.9 bps net of GST
CRYPTO_FRICTION_PCT = 0.00118     # 11.8 bps net of GST

# Strict Temporal Boundaries (2.75Y Window)
START_CUTOFF = pd.Timestamp("2024-01-01 00:00:00", tz="UTC")
IN_SAMPLE_CUTOFF = pd.Timestamp("2026-10-21 00:00:00", tz="UTC")
LIVE_END_CUTOFF = pd.Timestamp("2026-11-08 00:00:00", tz="UTC")

MONGO_URI = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority"


# ==============================================================================
# STEP 1: Purge Stale Files & Old Models
# ==============================================================================
def purge_stale_artifacts():
    print("\n" + "=" * 80)
    print("STEP 1: PURGING STALE DATASETS & OLD MODEL TREES")
    print("=" * 80)

    files_to_delete = [
        SRC_DATA_DIR / "unified_1h_historical_trades.json",
        SRC_DATA_DIR / "unified_4h_historical_trades.json",
        SRC_DATA_DIR / "distributed_1h_historical_trades.json",
        SRC_DATA_DIR / "distributed_4h_historical_trades.json",
    ]
    for f in files_to_delete:
        if f.exists():
            f.unlink()
            print(f"  ✓ Deleted stale dataset: {f.name}")

    dirs_to_purge = [
        SRC_MODELS_DIR / "distributed_1h_7assets",
        SRC_MODELS_DIR / "distributed_4h_7assets",
        SRC_MODELS_DIR / "unified_1h_7assets",
        SRC_MODELS_DIR / "unified_4h_7assets",
    ]
    for d in dirs_to_purge:
        if d.exists():
            shutil.rmtree(d)
            print(f"  ✓ Purged model directory: {d.name}")
        d.mkdir(parents=True, exist_ok=True)


# ==============================================================================
# Helper: Feature Computation & Setup Detection
# ==============================================================================
def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    c, h, l, v = df["close"], df["high"], df["low"], df["volume"]

    prev_c = c.shift(1)
    tr = pd.concat([h - l, (h - prev_c).abs(), (l - prev_c).abs()], axis=1).max(axis=1)
    atr14 = tr.rolling(14, min_periods=14).mean()
    atr7 = tr.rolling(7, min_periods=7).mean()
    atr28 = tr.rolling(28, min_periods=28).mean()
    df["atr_14"] = atr14

    df["feat_atr_pct"] = atr14 / (c + 1e-8)
    v_mean20 = v.rolling(20, min_periods=5).mean()
    v_std20 = v.rolling(20, min_periods=5).std()
    df["feat_vol_zscore"] = (v - v_mean20) / (v_std20 + 1e-8)
    df["feat_volatility_ratio"] = atr7 / (atr28 + 1e-8)

    donch_high20 = h.shift(1).rolling(20, min_periods=20).max()
    donch_low20 = l.shift(1).rolling(20, min_periods=20).min()
    df["donch_high20"] = donch_high20
    df["donch_low20"] = donch_low20
    channel_width = donch_high20 - donch_low20
    df["feat_donchian_pos"] = (c - donch_low20) / (channel_width + 1e-8)

    sma200 = c.rolling(200, min_periods=30).mean()
    df["sma200"] = sma200
    df["feat_trend_dist_200"] = (c - sma200) / (sma200 + 1e-8)

    df["feat_mom_24h"] = (c - c.shift(24)) / (c.shift(24) + 1e-8)
    df["feat_mom_72h"] = (c - c.shift(72)) / (c.shift(72) + 1e-8)

    delta = c.diff()
    gain = delta.clip(lower=0).rolling(14, min_periods=14).mean()
    loss = (-delta.clip(upper=0)).rolling(14, min_periods=14).mean()
    rs = gain / (loss + 1e-8)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    df["feat_rsi_14"] = (rsi - 50.0) / 50.0

    df["feat_dist_ema20"] = (c - c.ewm(span=20, adjust=False).mean()) / (c + 1e-8)
    df["feat_dist_ema50"] = (c - c.ewm(span=50, adjust=False).mean()) / (c + 1e-8)

    for col in FEATURE_NAMES:
        df[col] = df[col].fillna(0.0).clip(-5.0, 5.0)

    return df


def generate_candidate_setups(df: pd.DataFrame, symbol: str, timeframe: str) -> List[Dict[str, Any]]:
    trades = []
    is_comm = "=F" in symbol or symbol in COMMODITIES
    display_sym = COMMODITY_MAP[symbol]["display"] if is_comm else symbol
    raw_sym = symbol

    min_stop = 0.010 if is_comm else 0.015
    max_stop = 0.040 if is_comm else 0.060
    friction_pct = COMMODITY_FRICTION_PCT if is_comm else CRYPTO_FRICTION_PCT
    max_hold_bars = 16 if timeframe == "1h" else 12

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

        y = 1 if exit_type == "TAKE_PROFIT" or gross_r >= 1.5 else 0
        features = [float(df[feat].iloc[i]) for feat in FEATURE_NAMES]

        trades.append({
            "entry_dt": entry_time_val,
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
            "y": y,
            "features": features,
        })
        last_exit_idx = exit_bar

    return trades


# ==============================================================================
# In-Memory LightGBM Tree Serializer
# ==============================================================================
def serialize_lgbm_model(clf: lgb.LGBMClassifier, output_path: Path):
    booster = clf.booster_
    dump = booster.dump_model()
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(dump, f, indent=2)


# ==============================================================================
# MAIN RETRAINING PIPELINE (2.75Y WINDOW)
# ==============================================================================
def main():
    purge_stale_artifacts()

    print("\n" + "=" * 80)
    print("STEP 2: INGESTING CANDLES & RESTRICTING TO 2.75Y WINDOW (Jan 1, 2024 – Oct 20, 2026)")
    print("=" * 80)

    dfs_1h = {}
    dfs_4h = {}

    # Commodities
    for comm in COMMODITIES:
        clean = comm.replace("=", "_")
        p = DATA_DIR / f"{clean}_1h.parquet"
        df = pd.read_parquet(p)
        dt_col = "open_time" if "open_time" in df.columns else ("Datetime" if "Datetime" in df.columns else df.columns[0])
        df["open_time"] = pd.to_datetime(df[dt_col], utc=True)
        for c in ["open", "high", "low", "close", "volume"]:
            df[c] = df[c].astype(float)
        df = df[["open_time", "open", "high", "low", "close", "volume"]].sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
        dfs_1h[comm] = df

        df4 = df.copy().set_index("open_time").resample("4h").agg({
            "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"
        }).dropna().reset_index()
        dfs_4h[comm] = df4

    # Crypto
    for crypto in CRYPTOS:
        p1 = DATA_DIR / f"{crypto}_1h.parquet"
        p4 = DATA_DIR / f"{crypto}_4h.parquet"
        df1 = pd.read_parquet(p1)
        df1["open_time"] = pd.to_datetime(df1["open_time"], utc=True)
        for c in ["open", "high", "low", "close", "volume"]:
            df1[c] = df1[c].astype(float)
        df1 = df1[["open_time", "open", "high", "low", "close", "volume"]].sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
        dfs_1h[crypto] = df1

        if p4.exists():
            df4 = pd.read_parquet(p4)
            df4["open_time"] = pd.to_datetime(df4["open_time"], utc=True)
            for c in ["open", "high", "low", "close", "volume"]:
                df4[c] = df4[c].astype(float)
            df4 = df4[["open_time", "open", "high", "low", "close", "volume"]].sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
        else:
            df4 = df1.copy().set_index("open_time").resample("4h").agg({
                "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"
            }).dropna().reset_index()
        dfs_4h[crypto] = df4

    # Generate Candidate Setups
    print("\nComputing features and extracting breakout candidates...")
    setups_1h = {}
    setups_4h = {}

    for sym in ALL_SYMBOLS:
        df1_feat = compute_features(dfs_1h[sym])
        setups_1h[sym] = generate_candidate_setups(df1_feat, sym, "1h")

        df4_feat = compute_features(dfs_4h[sym])
        setups_4h[sym] = generate_candidate_setups(df4_feat, sym, "4h")

    # Filter candidates strictly to 2.75-Year Window (Jan 1, 2024 to Oct 20, 2026)
    is_setups_1h = {s: [t for t in setups_1h[s] if START_CUTOFF <= t["entry_dt"] < IN_SAMPLE_CUTOFF] for s in ALL_SYMBOLS}
    is_setups_4h = {s: [t for t in setups_4h[s] if START_CUTOFF <= t["entry_dt"] < IN_SAMPLE_CUTOFF] for s in ALL_SYMBOLS}

    print("\nIn-Sample Candidates (Jan 2024 - Oct 20, 2026):")
    for s in ALL_SYMBOLS:
        print(f"  {s:<8} | 1H: {len(is_setups_1h[s]):>4} setups | 4H: {len(is_setups_4h[s]):>4} setups")

    # --------------------------------------------------------------------------
    # ENGINE 1: UNIFIED 1H ENGINE
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("TRAINING ENGINE 1: UNIFIED 1H MULTI-ASSET ENGINE")
    print("=" * 80)
    all_is_1h = []
    for s in ALL_SYMBOLS:
        all_is_1h.extend(is_setups_1h[s])
    all_is_1h.sort(key=lambda x: x["entry_time_ms"])

    split_1h = int(len(all_is_1h) * 0.75)
    train_1h = all_is_1h[:split_1h]
    calib_1h = all_is_1h[split_1h:]

    clf_uni_1h = lgb.LGBMClassifier(
        n_estimators=100, max_depth=4, learning_rate=0.03,
        subsample=0.8, colsample_bytree=0.8, min_child_samples=15,
        random_state=42, verbosity=-1
    )
    clf_uni_1h.fit(np.array([t["features"] for t in train_1h]), np.array([t["y"] for t in train_1h]))

    # Calibrate tau* for unified 1h
    calib_probs = clf_uni_1h.predict_proba(np.array([t["features"] for t in calib_1h]))[:, 1]
    best_tau_1h = 0.065
    best_obj_1h = -999.0
    for tau in np.linspace(0.04, 0.25, 45):
        adm = [calib_1h[i] for i, p in enumerate(calib_probs) if p >= tau]
        if len(adm) < 15:
            continue
        tot_r = sum(t["net_r"] for t in adm)
        wr = len([t for t in adm if t["net_r"] > 0]) / len(adm)
        if tot_r * wr > best_obj_1h:
            best_obj_1h = tot_r * wr
            best_tau_1h = tau

    # Export Unified 1H Model
    uni_1h_dir = SRC_MODELS_DIR / "unified_1h_7assets"
    serialize_lgbm_model(clf_uni_1h, uni_1h_dir / "model.json")
    meta_uni_1h = {
        "model_name": "lgbm_unified_1h_7assets",
        "timeframe": "1h",
        "universe": [COMMODITY_MAP.get(s, {}).get("display", s) for s in ALL_SYMBOLS],
        "n_samples": len(all_is_1h),
        "target_base_rate": float(np.mean([t["y"] for t in train_1h])),
        "p_cutoff": round(best_tau_1h, 4),
        "tau_star": round(best_tau_1h, 4),
        "num_trees": 100,
        "feature_names": FEATURE_NAMES,
    }
    with open(uni_1h_dir / "metadata.json", "w") as f:
        json.dump(meta_uni_1h, f, indent=2)

    # Filter Unified 1H Historical Trades
    uni_1h_probs = clf_uni_1h.predict_proba(np.array([t["features"] for t in all_is_1h]))[:, 1]
    uni_1h_trades = []
    for idx, t in enumerate(all_is_1h):
        if uni_1h_probs[idx] >= best_tau_1h:
            tr = dict(t)
            del tr["entry_dt"]
            tr["probability"] = round(float(uni_1h_probs[idx]), 4)
            tr["id"] = f"uni1h_{tr['symbol']}_{tr['entry_time_ms']}"
            tr["trade_id"] = tr["id"]
            tr["model"] = "Unified 1H Multi-Asset Engine [1 Universal Brain]"
            tr["pos"] = len(uni_1h_trades) + 1
            uni_1h_trades.append(tr)

    with open(SRC_DATA_DIR / "unified_1h_historical_trades.json", "w", encoding="utf-8") as f:
        json.dump(uni_1h_trades, f, indent=2)

    wins_uni_1h = len([t for t in uni_1h_trades if t["net_r"] > 0])
    wr_uni_1h = wins_uni_1h / len(uni_1h_trades) * 100 if uni_1h_trades else 0
    net_r_uni_1h = sum(t["net_r"] for t in uni_1h_trades)
    avg_r_uni_1h = net_r_uni_1h / len(uni_1h_trades) if uni_1h_trades else 0
    print(f"  ✓ Unified 1H: {len(uni_1h_trades)} historical trades | Win Rate: {wr_uni_1h:.1f}% | Total Net R: {net_r_uni_1h:+.2f}R | Avg Net R: {avg_r_uni_1h:+.3f}R (tau*={best_tau_1h:.3f})")

    # --------------------------------------------------------------------------
    # ENGINE 2: DISTRIBUTED 1H SPECIALISTS
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("TRAINING ENGINE 2: DISTRIBUTED 1H SPECIALISTS (7 Dedicated Models)")
    print("=" * 80)
    dist_1h_trades = []
    dist_1h_dir = SRC_MODELS_DIR / "distributed_1h_7assets"

    for sym in ALL_SYMBOLS:
        candidates = is_setups_1h[sym]
        candidates.sort(key=lambda x: x["entry_time_ms"])
        n_c = len(candidates)
        split = int(n_c * 0.75)
        tr_set, cal_set = candidates[:split], candidates[split:]

        clf_s = lgb.LGBMClassifier(
            n_estimators=100, max_depth=4, learning_rate=0.03,
            subsample=0.8, colsample_bytree=0.8, min_child_samples=12,
            random_state=42, verbosity=-1
        )
        clf_s.fit(np.array([t["features"] for t in tr_set]), np.array([t["y"] for t in tr_set]))

        cal_p = clf_s.predict_proba(np.array([t["features"] for t in cal_set]))[:, 1]
        best_tau = 0.08
        best_obj = -999.0
        for tau in np.linspace(0.03, 0.35, 45):
            adm = [cal_set[i] for i, p in enumerate(cal_p) if p >= tau]
            if len(adm) < 4:
                continue
            tot_r = sum(t["net_r"] for t in adm)
            wr = len([t for t in adm if t["net_r"] > 0]) / len(adm)
            if tot_r * wr > best_obj:
                best_obj = tot_r * wr
                best_tau = tau

        # Export Specialist Model
        clean_name = sym.replace("=", "_")
        for folder_name in [sym, clean_name, COMMODITY_MAP.get(sym, {}).get("display", sym)]:
            s_dir = dist_1h_dir / folder_name
            s_dir.mkdir(parents=True, exist_ok=True)
            serialize_lgbm_model(clf_s, s_dir / "model.json")
            meta_s = {
                "model_name": f"distributed_1h_{sym}",
                "symbol": sym,
                "timeframe": "1h",
                "n_samples": n_c,
                "tau_star": round(best_tau, 4),
                "num_trees": 100,
                "feature_names": FEATURE_NAMES,
            }
            with open(s_dir / "metadata.json", "w") as f:
                json.dump(meta_s, f, indent=2)

        # Apply Model to in-sample candidates
        probs = clf_s.predict_proba(np.array([t["features"] for t in candidates]))[:, 1]
        for idx, t in enumerate(candidates):
            if probs[idx] >= best_tau:
                tr = dict(t)
                del tr["entry_dt"]
                tr["probability"] = round(float(probs[idx]), 4)
                tr["id"] = f"dist1h_{tr['symbol']}_{tr['entry_time_ms']}"
                tr["trade_id"] = tr["id"]
                tr["model"] = "Distributed 1H Specialists Engine [7 Dedicated Models]"
                dist_1h_trades.append(tr)

    dist_1h_trades.sort(key=lambda x: x["entry_time_ms"])
    for idx, tr in enumerate(dist_1h_trades):
        tr["pos"] = idx + 1

    with open(SRC_DATA_DIR / "distributed_1h_historical_trades.json", "w", encoding="utf-8") as f:
        json.dump(dist_1h_trades, f, indent=2)

    wins_dist_1h = len([t for t in dist_1h_trades if t["net_r"] > 0])
    wr_dist_1h = wins_dist_1h / len(dist_1h_trades) * 100 if dist_1h_trades else 0
    net_r_dist_1h = sum(t["net_r"] for t in dist_1h_trades)
    avg_r_dist_1h = net_r_dist_1h / len(dist_1h_trades) if dist_1h_trades else 0
    print(f"  ✓ Distributed 1H: {len(dist_1h_trades)} historical trades | Win Rate: {wr_dist_1h:.1f}% | Total Net R: {net_r_dist_1h:+.2f}R | Avg Net R: {avg_r_dist_1h:+.3f}R")

    # --------------------------------------------------------------------------
    # ENGINE 3: UNIFIED 4H SWING ENGINE
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("TRAINING ENGINE 3: UNIFIED 4H SWING ENGINE")
    print("=" * 80)
    all_is_4h = []
    for s in ALL_SYMBOLS:
        all_is_4h.extend(is_setups_4h[s])
    all_is_4h.sort(key=lambda x: x["entry_time_ms"])

    split_4h = int(len(all_is_4h) * 0.75)
    train_4h = all_is_4h[:split_4h]
    calib_4h = all_is_4h[split_4h:]

    clf_uni_4h = lgb.LGBMClassifier(
        n_estimators=100, max_depth=4, learning_rate=0.03,
        subsample=0.8, colsample_bytree=0.8, min_child_samples=15,
        random_state=42, verbosity=-1
    )
    clf_uni_4h.fit(np.array([t["features"] for t in train_4h]), np.array([t["y"] for t in train_4h]))

    calib_probs_4h = clf_uni_4h.predict_proba(np.array([t["features"] for t in calib_4h]))[:, 1]
    best_tau_4h = 0.060
    best_obj_4h = -999.0
    for tau in np.linspace(0.03, 0.25, 45):
        adm = [calib_4h[i] for i, p in enumerate(calib_probs_4h) if p >= tau]
        if len(adm) < 8:
            continue
        tot_r = sum(t["net_r"] for t in adm)
        wr = len([t for t in adm if t["net_r"] > 0]) / len(adm)
        if tot_r * wr > best_obj_4h:
            best_obj_4h = tot_r * wr
            best_tau_4h = tau

    uni_4h_dir = SRC_MODELS_DIR / "unified_4h_7assets"
    serialize_lgbm_model(clf_uni_4h, uni_4h_dir / "model.json")
    meta_uni_4h = {
        "model_name": "lgbm_unified_4h_7assets",
        "timeframe": "4h",
        "universe": [COMMODITY_MAP.get(s, {}).get("display", s) for s in ALL_SYMBOLS],
        "n_samples": len(all_is_4h),
        "target_base_rate": float(np.mean([t["y"] for t in train_4h])),
        "p_cutoff": round(best_tau_4h, 4),
        "tau_star": round(best_tau_4h, 4),
        "num_trees": 100,
        "feature_names": FEATURE_NAMES,
    }
    with open(uni_4h_dir / "metadata.json", "w") as f:
        json.dump(meta_uni_4h, f, indent=2)

    uni_4h_probs = clf_uni_4h.predict_proba(np.array([t["features"] for t in all_is_4h]))[:, 1]
    uni_4h_trades = []
    for idx, t in enumerate(all_is_4h):
        if uni_4h_probs[idx] >= best_tau_4h:
            tr = dict(t)
            del tr["entry_dt"]
            tr["probability"] = round(float(uni_4h_probs[idx]), 4)
            tr["id"] = f"uni4h_{tr['symbol']}_{tr['entry_time_ms']}"
            tr["trade_id"] = tr["id"]
            tr["model"] = "Unified 4H Swing Engine [1 Universal Brain]"
            tr["pos"] = len(uni_4h_trades) + 1
            uni_4h_trades.append(tr)

    with open(SRC_DATA_DIR / "unified_4h_historical_trades.json", "w", encoding="utf-8") as f:
        json.dump(uni_4h_trades, f, indent=2)

    wins_uni_4h = len([t for t in uni_4h_trades if t["net_r"] > 0])
    wr_uni_4h = wins_uni_4h / len(uni_4h_trades) * 100 if uni_4h_trades else 0
    net_r_uni_4h = sum(t["net_r"] for t in uni_4h_trades)
    avg_r_uni_4h = net_r_uni_4h / len(uni_4h_trades) if uni_4h_trades else 0
    print(f"  ✓ Unified 4H: {len(uni_4h_trades)} historical trades | Win Rate: {wr_uni_4h:.1f}% | Total Net R: {net_r_uni_4h:+.2f}R | Avg Net R: {avg_r_uni_4h:+.3f}R (tau*={best_tau_4h:.3f})")

    # --------------------------------------------------------------------------
    # ENGINE 4: DISTRIBUTED 4H SPECIALISTS
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("TRAINING ENGINE 4: DISTRIBUTED 4H SPECIALISTS (7 Dedicated Models)")
    print("=" * 80)
    dist_4h_trades = []
    dist_4h_dir = SRC_MODELS_DIR / "distributed_4h_7assets"

    for sym in ALL_SYMBOLS:
        candidates = is_setups_4h[sym]
        candidates.sort(key=lambda x: x["entry_time_ms"])
        n_c = len(candidates)
        split = int(n_c * 0.75)
        tr_set, cal_set = candidates[:split], candidates[split:]

        clf_s = lgb.LGBMClassifier(
            n_estimators=100, max_depth=4, learning_rate=0.03,
            subsample=0.8, colsample_bytree=0.8, min_child_samples=8,
            random_state=42, verbosity=-1
        )
        clf_s.fit(np.array([t["features"] for t in tr_set]), np.array([t["y"] for t in tr_set]))

        cal_p = clf_s.predict_proba(np.array([t["features"] for t in cal_set]))[:, 1]
        best_tau = 0.07
        best_obj = -999.0
        for tau in np.linspace(0.03, 0.35, 45):
            adm = [cal_set[i] for i, p in enumerate(cal_p) if p >= tau]
            if len(adm) < 3:
                continue
            tot_r = sum(t["net_r"] for t in adm)
            wr = len([t for t in adm if t["net_r"] > 0]) / len(adm)
            if tot_r * wr > best_obj:
                best_obj = tot_r * wr
                best_tau = tau

        clean_name = sym.replace("=", "_")
        for folder_name in [sym, clean_name, COMMODITY_MAP.get(sym, {}).get("display", sym)]:
            s_dir = dist_4h_dir / folder_name
            s_dir.mkdir(parents=True, exist_ok=True)
            serialize_lgbm_model(clf_s, s_dir / "model.json")
            meta_s = {
                "model_name": f"distributed_4h_{sym}",
                "symbol": sym,
                "timeframe": "4h",
                "n_samples": n_c,
                "tau_star": round(best_tau, 4),
                "num_trees": 100,
                "feature_names": FEATURE_NAMES,
            }
            with open(s_dir / "metadata.json", "w") as f:
                json.dump(meta_s, f, indent=2)

        probs = clf_s.predict_proba(np.array([t["features"] for t in candidates]))[:, 1]
        for idx, t in enumerate(candidates):
            if probs[idx] >= best_tau:
                tr = dict(t)
                del tr["entry_dt"]
                tr["probability"] = round(float(probs[idx]), 4)
                tr["id"] = f"dist4h_{tr['symbol']}_{tr['entry_time_ms']}"
                tr["trade_id"] = tr["id"]
                tr["model"] = "Distributed 4H Specialists Engine [7 Dedicated Models]"
                dist_4h_trades.append(tr)

    dist_4h_trades.sort(key=lambda x: x["entry_time_ms"])
    for idx, tr in enumerate(dist_4h_trades):
        tr["pos"] = idx + 1

    with open(SRC_DATA_DIR / "distributed_4h_historical_trades.json", "w", encoding="utf-8") as f:
        json.dump(dist_4h_trades, f, indent=2)

    wins_dist_4h = len([t for t in dist_4h_trades if t["net_r"] > 0])
    wr_dist_4h = wins_dist_4h / len(dist_4h_trades) * 100 if dist_4h_trades else 0
    net_r_dist_4h = sum(t["net_r"] for t in dist_4h_trades)
    avg_r_dist_4h = net_r_dist_4h / len(dist_4h_trades) if dist_4h_trades else 0
    print(f"  ✓ Distributed 4H: {len(dist_4h_trades)} historical trades | Win Rate: {wr_dist_4h:.1f}% | Total Net R: {net_r_dist_4h:+.2f}R | Avg Net R: {avg_r_dist_4h:+.3f}R")

    # --------------------------------------------------------------------------
    # STEP 3: VERIFY LIVE TRADES DATASETS
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("STEP 3: VERIFYING LIVE WINDOW DATASETS (Oct 21 – Nov 7, 2026)")
    print("=" * 80)
    live_1h_p = SRC_DATA_DIR / "live_executed_trades.json"
    dist_live_1h_p = SRC_DATA_DIR / "distributed_1h_live_trades.json"
    live_4h_p = SRC_DATA_DIR / "live_4h_executed_trades.json"
    dist_live_4h_p = SRC_DATA_DIR / "distributed_4h_live_trades.json"

    with open(live_1h_p, "r", encoding="utf-8") as f:
        n_l1 = len(json.load(f))
    with open(dist_live_1h_p, "r", encoding="utf-8") as f:
        n_dl1 = len(json.load(f))
    with open(live_4h_p, "r", encoding="utf-8") as f:
        n_l4 = len(json.load(f))
    with open(dist_live_4h_p, "r", encoding="utf-8") as f:
        n_dl4 = len(json.load(f))

    print(f"  ✓ live_executed_trades.json        : {n_l1} trades (Target: 37)")
    print(f"  ✓ distributed_1h_live_trades.json  : {n_dl1} trades (Target: 33)")
    print(f"  ✓ live_4h_executed_trades.json     : {n_l4} trades (Target: 8)")
    print(f"  ✓ distributed_4h_live_trades.json  : {n_dl4} trades (Target: 13)")

    # --------------------------------------------------------------------------
    # STEP 4: RE-SEED MONGODB ATLAS
    # --------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("STEP 4: PURGING & RE-SEEDING MONGODB ATLAS ('that' DATABASE)")
    print("=" * 80)
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
    db = client["that"]

    collections_to_seed = [
        ("historical_trades_unified_1h", SRC_DATA_DIR / "unified_1h_historical_trades.json"),
        ("historical_trades_distributed_1h", SRC_DATA_DIR / "distributed_1h_historical_trades.json"),
        ("historical_trades_unified_4h", SRC_DATA_DIR / "unified_4h_historical_trades.json"),
        ("historical_trades_distributed_4h", SRC_DATA_DIR / "distributed_4h_historical_trades.json"),
        ("paper_trades_unified_1h", live_1h_p),
        ("paper_trades_distributed_1h", dist_live_1h_p),
        ("paper_trades_unified_4h", live_4h_p),
        ("paper_trades_distributed_4h", dist_live_4h_p),
    ]

    for col_name, file_p in collections_to_seed:
        with open(file_p, "r", encoding="utf-8") as f:
            records = json.load(f)
        col = db[col_name]
        col.drop()
        batch_size = 1000
        for i in range(0, len(records), batch_size):
            col.insert_many(records[i:i+batch_size])
        count = col.count_documents({})
        print(f"  ✓ {col_name:<34} : Seeded {count:>4} docs from {file_p.name}")

    print("\n" + "=" * 80)
    print("MASTER 2.75Y RETRAINING & ATLAS SEEDING COMPLETED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == "__main__":
    main()
