#!/usr/bin/env python3
"""
Distributed 7-Specialist Meta-Model Architecture (1H & 4H)
Training, Calibration, Live Forward Simulation & Side-by-Side Benchmark Scorecard

Universe:
  Commodities: GC=F (Gold / XAUUSDT), SI=F (Silver / XAGUSDT), CL=F (Crude Oil / CLUSDT)
  Crypto: BTCUSDT, ETHUSDT, SOLUSDT, DOTUSDT

Models:
  14 Specialist LightGBM Models:
    - 7 models for 1H: src/models/distributed_1h_7assets/{symbol}/
    - 7 models for 4H: src/models/distributed_4h_7assets/{symbol}/

Data Outputs:
  - src/data/distributed_1h_historical_trades.json (2020 to Oct 20, 2026 in-sample)
  - src/data/distributed_4h_historical_trades.json (2020 to Oct 20, 2026 in-sample)
  - src/data/distributed_1h_live_trades.json (Oct 21 to Nov 7, 2026 live unseen)
  - src/data/distributed_4h_live_trades.json (Oct 21 to Nov 7, 2026 live unseen)
  - research/scorecard_unified_vs_distributed.json
"""

import os
import sys
import json
import math
import time
import shutil
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

import numpy as np
import pandas as pd
import lightgbm as lgb

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

IN_SAMPLE_CUTOFF = pd.Timestamp("2026-10-21 00:00:00", tz="UTC")
LIVE_END_CUTOFF = pd.Timestamp("2026-11-08 00:00:00", tz="UTC")


# ==============================================================================
# 1. Tree Inference (LightGBM JSON Tree Traversal)
# ==============================================================================
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


# ==============================================================================
# 2. Market Data Ingestion & Resampling
# ==============================================================================
def load_all_candles() -> Tuple[Dict[str, pd.DataFrame], Dict[str, pd.DataFrame]]:
    dfs_1h = {}
    dfs_4h = {}
    print("\n[Data Ingestion] Loading 1H and 4H candles for all 7 assets...")

    for comm in COMMODITIES:
        clean = comm.replace("=", "_")
        p = LOCAL_DATA_DIR / f"{clean}_1h.parquet"
        if not p.exists():
            raise FileNotFoundError(f"Missing parquet: {p}")
        df = pd.read_parquet(p)
        dt_col = "open_time" if "open_time" in df.columns else ("Datetime" if "Datetime" in df.columns else df.columns[0])
        df["open_time"] = pd.to_datetime(df[dt_col], utc=True)
        for c in ["open", "high", "low", "close", "volume"]:
            df[c] = df[c].astype(float)
        df = df[["open_time", "open", "high", "low", "close", "volume"]].copy()
        df = df.sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
        dfs_1h[comm] = df

        # Resample to 4H
        df1 = df.copy().set_index("open_time")
        df4 = df1.resample("4h").agg({
            "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"
        }).dropna().reset_index()
        dfs_4h[comm] = df4
        print(f"  Loaded {comm:<8} | 1H: {len(df):>5} bars ({df['open_time'].min().strftime('%Y-%m-%d')} to {df['open_time'].max().strftime('%Y-%m-%d')}) | 4H: {len(df4):>5} bars")

    for crypto in CRYPTOS:
        p1 = LOCAL_DATA_DIR / f"{crypto}_1h.parquet"
        p4 = LOCAL_DATA_DIR / f"{crypto}_4h.parquet"
        if not p1.exists():
            raise FileNotFoundError(f"Missing crypto 1H parquet: {p1}")
        df1 = pd.read_parquet(p1)
        df1["open_time"] = pd.to_datetime(df1["open_time"], utc=True)
        for c in ["open", "high", "low", "close", "volume"]:
            df1[c] = df1[c].astype(float)
        df1 = df1[["open_time", "open", "high", "low", "close", "volume"]].copy()
        df1 = df1.sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
        dfs_1h[crypto] = df1

        if p4.exists():
            df4 = pd.read_parquet(p4)
            df4["open_time"] = pd.to_datetime(df4["open_time"], utc=True)
            for c in ["open", "high", "low", "close", "volume"]:
                df4[c] = df4[c].astype(float)
            df4 = df4[["open_time", "open", "high", "low", "close", "volume"]].copy()
            df4 = df4.sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
        else:
            df_idx = df1.copy().set_index("open_time")
            df4 = df_idx.resample("4h").agg({
                "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"
            }).dropna().reset_index()
        dfs_4h[crypto] = df4
        print(f"  Loaded {crypto:<8} | 1H: {len(df1):>5} bars ({df1['open_time'].min().strftime('%Y-%m-%d')} to {df1['open_time'].max().strftime('%Y-%m-%d')}) | 4H: {len(df4):>5} bars")

    return dfs_1h, dfs_4h


# ==============================================================================
# 3. Universal 10-Feature Computation
# ==============================================================================
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

    for col in FEATURE_NAMES:
        df[col] = df[col].fillna(0.0).clip(-5.0, 5.0)

    return df


# ==============================================================================
# 4. Candidate Generation & Triple-Barrier Forward Simulation
# ==============================================================================
def extract_candidate_breakouts(
    df: pd.DataFrame,
    symbol: str,
    timeframe: str,
    max_hold_bars: int
) -> List[Dict[str, Any]]:
    candidates = []
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

        entry_dt = df["open_time"].iloc[i]
        exit_dt = df["open_time"].iloc[min(exit_bar, len(df) - 1)]

        features = [float(df[feat].iloc[i]) for feat in FEATURE_NAMES]
        target_y = 1 if exit_type == "TAKE_PROFIT" or gross_r >= 1.5 else 0

        candidates.append({
            "symbol": display_sym,
            "rawSymbol": raw_sym,
            "displaySymbol": display_sym,
            "side": side,
            "direction": side,
            "entry_time": entry_dt.isoformat(),
            "entry_time_ms": int(entry_dt.timestamp() * 1000),
            "entry_dt": entry_dt,
            "exit_time": exit_dt.isoformat(),
            "exit_time_ms": int(exit_dt.timestamp() * 1000),
            "exit_dt": exit_dt,
            "entry_idx": i,
            "exit_idx": exit_bar,
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
            "y": target_y,
            "features": features,
        })
        last_exit_idx = exit_bar

    return candidates


# ==============================================================================
# 5. Specialist Training & Threshold Calibration
# ==============================================================================
def train_and_calibrate_specialist(
    candidates: List[Dict[str, Any]],
    symbol: str,
    timeframe: str,
    output_dir: Path
) -> Tuple[Dict[str, Any], float, Dict[str, Any]]:
    # In-Sample Candidates strictly before 2026-10-21
    is_candidates = [c for c in candidates if c["entry_dt"] < IN_SAMPLE_CUTOFF]
    is_candidates.sort(key=lambda x: x["entry_time_ms"])

    n_samples = len(is_candidates)
    if n_samples < 20:
        raise ValueError(f"Not enough in-sample candidate trades for {symbol} ({n_samples} found)")

    # 75% Train / 25% Calibration Split
    split_idx = int(n_samples * 0.75)
    train_set = is_candidates[:split_idx]
    cal_set = is_candidates[split_idx:]

    X_train = np.array([c["features"] for c in train_set])
    y_train = np.array([c["y"] for c in train_set])
    X_cal = np.array([c["features"] for c in cal_set])
    y_cal = np.array([c["y"] for c in cal_set])

    # LightGBM binary classifier (hyperparameters per specification)
    clf = lgb.LGBMClassifier(
        n_estimators=100,
        learning_rate=0.03,
        max_depth=5,
        min_child_samples=15,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbosity=-1,
    )
    clf.fit(X_train, y_train)

    train_probs = clf.predict_proba(X_train)[:, 1]
    cal_probs = clf.predict_proba(X_cal)[:, 1]

    for idx, c in enumerate(train_set):
        c["probability"] = float(train_probs[idx])
    for idx, c in enumerate(cal_set):
        c["probability"] = float(cal_probs[idx])

    # Calibrate optimal probability threshold tau_S*
    # Sweep across candidate thresholds
    min_prob = float(np.min(cal_probs)) if len(cal_probs) > 0 else 0.05
    max_prob = float(np.max(cal_probs)) if len(cal_probs) > 0 else 0.40
    threshold_grid = np.linspace(max(0.02, min_prob), min(0.45, max_prob), 50)

    best_tau = float(np.median(cal_probs))
    best_score = -9999.0
    best_stats = {}

    min_required_trades = 5 if timeframe == "4h" else 8

    for tau in threshold_grid:
        admitted = [c for c in cal_set if c["probability"] >= tau]
        if len(admitted) < min_required_trades:
            continue
        net_r_total = sum(c["net_r"] for c in admitted)
        wins = [c for c in admitted if c["net_r"] > 0]
        losses = [c for c in admitted if c["net_r"] <= 0]
        wr = len(wins) / len(admitted) * 100.0

        cum = np.cumsum([c["net_r"] for c in admitted])
        peak = np.maximum.accumulate(cum)
        dd = cum - peak
        max_dd = abs(float(np.min(dd))) if len(dd) > 0 else 0.0

        gross_win = sum(c["net_r"] for c in wins)
        gross_loss = abs(sum(c["net_r"] for c in losses))
        pf = gross_win / gross_loss if gross_loss > 0 else 2.5

        # Objective: Net R with Max Drawdown penalty & Profit Factor booster
        score = net_r_total - 0.25 * max_dd + 1.5 * min(pf, 3.0)

        if score > best_score:
            best_score = score
            best_tau = float(tau)
            best_stats = {
                "admitted": len(admitted),
                "wr": wr,
                "net_r": net_r_total,
                "pf": pf,
                "max_dd": max_dd,
                "score": score,
            }

    # Fallback if no threshold met min_required_trades
    if best_score == -9999.0:
        best_tau = float(np.percentile(cal_probs, 65))
        admitted = [c for c in cal_set if c["probability"] >= best_tau]
        best_stats = {
            "admitted": len(admitted),
            "wr": (len([c for c in admitted if c["net_r"] > 0]) / max(len(admitted), 1)) * 100.0,
            "net_r": sum(c["net_r"] for c in admitted),
            "pf": 1.0,
            "max_dd": 0.0,
            "score": 0.0,
        }

    # Save Model JSON & Metadata JSON
    output_dir.mkdir(parents=True, exist_ok=True)
    model_json = clf.booster_.dump_model()
    with open(output_dir / "model.json", "w", encoding="utf-8") as f:
        json.dump(model_json, f, indent=2)

    # Feature statistics
    feature_stats = {}
    for idx, fname in enumerate(FEATURE_NAMES):
        vals = X_train[:, idx]
        feature_stats[fname] = {
            "mean": round(float(np.mean(vals)), 5),
            "std": round(float(np.std(vals)), 5),
            "min": round(float(np.min(vals)), 5),
            "max": round(float(np.max(vals)), 5),
        }

    # Verification sample
    verification_samples = []
    for s_idx in [0, min(5, len(X_cal)-1), min(10, len(X_cal)-1)]:
        verification_samples.append({
            "features": [round(float(x), 5) for x in X_cal[s_idx]],
            "expected_prob": round(float(cal_probs[s_idx]), 5),
        })

    metadata = {
        "model_name": f"distributed_{timeframe}_{symbol}",
        "timeframe": timeframe,
        "symbol": symbol,
        "n_samples": n_samples,
        "train_samples": len(train_set),
        "calibration_samples": len(cal_set),
        "target_base_rate": round(float(y_train.mean()), 4),
        "p_cutoff": round(best_tau, 4),
        "tau_star": round(best_tau, 4),
        "percentile_50": round(float(np.percentile(train_probs, 50)), 4),
        "percentile_75": round(float(np.percentile(train_probs, 75)), 4),
        "percentile_90": round(float(np.percentile(train_probs, 90)), 4),
        "calibration_stats": {
            "admitted_trades": best_stats.get("admitted", 0),
            "win_rate_pct": round(best_stats.get("wr", 0.0), 2),
            "net_r": round(best_stats.get("net_r", 0.0), 2),
            "profit_factor": round(best_stats.get("pf", 0.0), 2),
        },
        "num_trees": 100,
        "feature_names": FEATURE_NAMES,
        "feature_stats": feature_stats,
        "verification_samples": verification_samples,
    }

    with open(output_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    # Populate commodity aliases (e.g., GC_F, XAUUSDT)
    if symbol in COMMODITY_MAP:
        for alias in COMMODITY_MAP[symbol]["aliases"]:
            if alias != symbol:
                alias_dir = output_dir.parent / alias
                alias_dir.mkdir(parents=True, exist_ok=True)
                with open(alias_dir / "model.json", "w", encoding="utf-8") as f:
                    json.dump(model_json, f, indent=2)
                with open(alias_dir / "metadata.json", "w", encoding="utf-8") as f:
                    json.dump(metadata, f, indent=2)

    print(f"  [{timeframe.upper()} Specialist {symbol:<8}] tau* = {best_tau:.4f} | IS Samples: {n_samples:>4} | Cal Net R: {best_stats.get('net_r', 0):>+6.2f}R | Cal WR: {best_stats.get('wr', 0):>5.1f}%")
    return model_json, round(best_tau, 4), metadata


# ==============================================================================
# 6. Bar-by-Bar Deterministic Simulation (Historical & Live)
# ==============================================================================
def simulate_specialist_trading(
    df: pd.DataFrame,
    symbol: str,
    timeframe: str,
    model: Dict[str, Any],
    p_cutoff: float,
    max_hold_bars: int,
    start_dt: pd.Timestamp,
    end_dt: pd.Timestamp,
    engine_id: str,
    engine_name: str
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

        bar_dt = df["open_time"].iloc[i]
        if bar_dt < start_dt or bar_dt >= end_dt:
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

        entry_iso = bar_dt.isoformat()
        exit_time_val = df["open_time"].iloc[min(exit_bar, len(df) - 1)]
        exit_iso = exit_time_val.isoformat()
        entry_ms = int(bar_dt.timestamp() * 1000)
        exit_ms = int(exit_time_val.timestamp() * 1000)

        trade_id = f"dist_{timeframe}_{display_sym}_{entry_ms}"

        trades.append({
            "id": trade_id,
            "trade_id": trade_id,
            "pos": 0,
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
            "probability": round(prob, 4),
            "p_cutoff": p_cutoff,
            "status": "CLOSED",
        })
        last_exit_idx = exit_bar

    return trades


# ==============================================================================
# 7. Metrics & Scorecard Utilities
# ==============================================================================
def compute_metrics(trades: List[Dict[str, Any]], start_capital: float = 7000.0, r_risk_inr: float = 100.0) -> Dict[str, Any]:
    n = len(trades)
    if n == 0:
        return {
            "total_trades": 0,
            "win_rate_pct": 0.0,
            "net_realized_r": 0.0,
            "profit_factor": 0.0,
            "max_drawdown_r": 0.0,
            "pnl_inr": 0.0,
            "final_capital_inr": start_capital,
        }

    wins = [t for t in trades if t["net_r"] > 0]
    losses = [t for t in trades if t["net_r"] <= 0]
    wr = (len(wins) / n) * 100.0

    net_r = sum(t["net_r"] for t in trades)
    gross_win = sum(t["net_r"] for t in wins)
    gross_loss = abs(sum(t["net_r"] for t in losses))
    pf = (gross_win / gross_loss) if gross_loss > 0 else (999.0 if gross_win > 0 else 0.0)

    cum = np.cumsum([t["net_r"] for t in trades])
    peak = np.maximum.accumulate(cum)
    dd = cum - peak
    max_dd = abs(float(np.min(dd))) if len(dd) > 0 else 0.0

    pnl_inr = net_r * r_risk_inr
    final_capital = start_capital + pnl_inr

    return {
        "total_trades": n,
        "win_rate_pct": round(wr, 2),
        "net_realized_r": round(net_r, 2),
        "profit_factor": round(pf, 2),
        "max_drawdown_r": round(max_dd, 2),
        "pnl_inr": round(pnl_inr, 2),
        "final_capital_inr": round(final_capital, 2),
    }


# ==============================================================================
# 8. Main Execution Function
# ==============================================================================
def main():
    print("=" * 90)
    print("DISTRIBUTED 7-SPECIALIST META-MODEL ARCHITECTURE (1H & 4H)")
    print("Universe: Gold, Silver, Crude Oil, BTC, ETH, SOL, DOT")
    print("=" * 90)

    # 1. Ingest Data & Compute Features
    dfs_1h, dfs_4h = load_all_candles()

    print("\n[Feature Engineering] Computing Universal 10-Feature matrices for all assets...")
    feat_1h = {}
    feat_4h = {}
    for sym in ALL_SYMBOLS:
        feat_1h[sym] = compute_universal_features(dfs_1h[sym])
        feat_4h[sym] = compute_universal_features(dfs_4h[sym])
        print(f"  Features computed for {sym:<8} | 1H: {len(feat_1h[sym]):>5} | 4H: {len(feat_4h[sym]):>5}")

    # 2. Extract Candidate Breakouts
    print("\n[Candidate Generation] Extracting Donchian-20 Breakouts & Forward Triple Barrier Outcomes...")
    cand_1h = {}
    cand_4h = {}
    for sym in ALL_SYMBOLS:
        c1 = extract_candidate_breakouts(feat_1h[sym], sym, "1h", max_hold_bars=16)
        c4 = extract_candidate_breakouts(feat_4h[sym], sym, "4h", max_hold_bars=12)
        cand_1h[sym] = c1
        cand_4h[sym] = c4
        print(f"  {sym:<8} -> 1H Total Candidates: {len(c1):>4} | 4H Total Candidates: {len(c4):>4}")

    # 3. Train & Calibrate 14 Specialist Models
    print("\n[Specialist Model Training] Training 14 Dedicated LightGBM Models (< 2026-10-21)...")
    dir_dist_1h = SRC_MODELS_DIR / "distributed_1h_7assets"
    dir_dist_4h = SRC_MODELS_DIR / "distributed_4h_7assets"

    models_1h = {}
    cutoffs_1h = {}
    models_4h = {}
    cutoffs_4h = {}

    print("\n--- Training 7 Specialist Models for 1H Timeframe ---")
    for sym in ALL_SYMBOLS:
        m, tau, meta = train_and_calibrate_specialist(
            candidates=cand_1h[sym],
            symbol=sym,
            timeframe="1h",
            output_dir=dir_dist_1h / sym
        )
        models_1h[sym] = m
        cutoffs_1h[sym] = tau

    print("\n--- Training 7 Specialist Models for 4H Timeframe ---")
    for sym in ALL_SYMBOLS:
        m, tau, meta = train_and_calibrate_specialist(
            candidates=cand_4h[sym],
            symbol=sym,
            timeframe="4h",
            output_dir=dir_dist_4h / sym
        )
        models_4h[sym] = m
        cutoffs_4h[sym] = tau

    # 4. In-Sample Historical Backtest (2020 to Oct 20, 2026)
    print("\n[Historical Backtest] Simulating In-Sample Historical Trading (2020 to Oct 20, 2026)...")
    hist_1h_all = []
    hist_4h_all = []

    for sym in ALL_SYMBOLS:
        t1 = simulate_specialist_trading(
            df=feat_1h[sym],
            symbol=sym,
            timeframe="1h",
            model=models_1h[sym],
            p_cutoff=cutoffs_1h[sym],
            max_hold_bars=16,
            start_dt=pd.Timestamp("2020-01-01", tz="UTC"),
            end_dt=IN_SAMPLE_CUTOFF,
            engine_id="distributed-1h-engine",
            engine_name="Distributed 1H Specialist Engine"
        )
        hist_1h_all.extend(t1)

        t4 = simulate_specialist_trading(
            df=feat_4h[sym],
            symbol=sym,
            timeframe="4h",
            model=models_4h[sym],
            p_cutoff=cutoffs_4h[sym],
            max_hold_bars=12,
            start_dt=pd.Timestamp("2020-01-01", tz="UTC"),
            end_dt=IN_SAMPLE_CUTOFF,
            engine_id="distributed-4h-engine",
            engine_name="Distributed 4H Specialist Swing Engine"
        )
        hist_4h_all.extend(t4)
        print(f"  {sym:<8} In-Sample Admitted -> 1H: {len(t1):>4} trades | 4H: {len(t4):>4} trades")

    hist_1h_all.sort(key=lambda x: x["entry_time_ms"])
    for idx, t in enumerate(hist_1h_all, 1):
        t["pos"] = idx

    hist_4h_all.sort(key=lambda x: x["entry_time_ms"])
    for idx, t in enumerate(hist_4h_all, 1):
        t["pos"] = idx

    p_hist_1h = SRC_DATA_DIR / "distributed_1h_historical_trades.json"
    p_hist_4h = SRC_DATA_DIR / "distributed_4h_historical_trades.json"

    with open(p_hist_1h, "w", encoding="utf-8") as f:
        json.dump(hist_1h_all, f, indent=2)
    with open(p_hist_4h, "w", encoding="utf-8") as f:
        json.dump(hist_4h_all, f, indent=2)

    print(f"  --> Saved {len(hist_1h_all)} trades to {p_hist_1h.name}")
    print(f"  --> Saved {len(hist_4h_all)} trades to {p_hist_4h.name}")

    # 5. Live Forward Simulation (Oct 21 to Nov 7, 2026 - 17 Days)
    print("\n[Live Simulation] Running Forward Inference across 17-Day Unseen Window (Oct 21 to Nov 7, 2026)...")
    live_1h_all = []
    live_4h_all = []

    for sym in ALL_SYMBOLS:
        l1 = simulate_specialist_trading(
            df=feat_1h[sym],
            symbol=sym,
            timeframe="1h",
            model=models_1h[sym],
            p_cutoff=cutoffs_1h[sym],
            max_hold_bars=16,
            start_dt=IN_SAMPLE_CUTOFF,
            end_dt=LIVE_END_CUTOFF,
            engine_id="distributed-1h-engine",
            engine_name="Distributed 1H Specialist Engine"
        )
        live_1h_all.extend(l1)

        l4 = simulate_specialist_trading(
            df=feat_4h[sym],
            symbol=sym,
            timeframe="4h",
            model=models_4h[sym],
            p_cutoff=cutoffs_4h[sym],
            max_hold_bars=12,
            start_dt=IN_SAMPLE_CUTOFF,
            end_dt=LIVE_END_CUTOFF,
            engine_id="distributed-4h-engine",
            engine_name="Distributed 4H Specialist Swing Engine"
        )
        live_4h_all.extend(l4)
        print(f"  {sym:<8} Live Executed -> 1H: {len(l1):>3} trades | 4H: {len(l4):>3} trades")

    live_1h_all.sort(key=lambda x: x["entry_time_ms"])
    for idx, t in enumerate(live_1h_all, 1):
        t["pos"] = idx

    live_4h_all.sort(key=lambda x: x["entry_time_ms"])
    for idx, t in enumerate(live_4h_all, 1):
        t["pos"] = idx

    p_live_1h = SRC_DATA_DIR / "distributed_1h_live_trades.json"
    p_live_4h = SRC_DATA_DIR / "distributed_4h_live_trades.json"

    with open(p_live_1h, "w", encoding="utf-8") as f:
        json.dump(live_1h_all, f, indent=2)
    with open(p_live_4h, "w", encoding="utf-8") as f:
        json.dump(live_4h_all, f, indent=2)

    print(f"  --> Saved {len(live_1h_all)} trades to {p_live_1h.name}")
    print(f"  --> Saved {len(live_4h_all)} trades to {p_live_4h.name}")

    # 6. Load Unified Baseline Data for Side-by-Side Comparison
    print("\n[Benchmark Comparison] Loading Unified Model Data...")
    with open(SRC_DATA_DIR / "unified_1h_historical_trades.json") as f:
        u_hist_1h_raw = json.load(f)
    with open(SRC_DATA_DIR / "unified_4h_historical_trades.json") as f:
        u_hist_4h_raw = json.load(f)
    with open(SRC_DATA_DIR / "live_executed_trades.json") as f:
        u_live_1h = json.load(f)
    with open(SRC_DATA_DIR / "live_4h_executed_trades.json") as f:
        u_live_4h = json.load(f)

    # Historical In-Sample filter for Unified (< 2026-10-21)
    u_hist_1h = [t for t in u_hist_1h_raw if t.get("entry_time", "") < "2026-10-21"]
    u_hist_4h = [t for t in u_hist_4h_raw if t.get("entry_time", "") < "2026-10-21"]

    # Compute Metrics
    m_u_hist_1h = compute_metrics(u_hist_1h)
    m_d_hist_1h = compute_metrics(hist_1h_all)
    m_u_hist_4h = compute_metrics(u_hist_4h)
    m_d_hist_4h = compute_metrics(hist_4h_all)

    m_u_live_1h = compute_metrics(u_live_1h)
    m_d_live_1h = compute_metrics(live_1h_all)
    m_u_live_4h = compute_metrics(u_live_4h)
    m_d_live_4h = compute_metrics(live_4h_all)

    # Determine Alpha Verdicts
    # In 1H live:
    v_1h_u = "WINNER" if m_u_live_1h["net_realized_r"] >= m_d_live_1h["net_realized_r"] else "LOSER"
    v_1h_d = "WINNER" if m_d_live_1h["net_realized_r"] > m_u_live_1h["net_realized_r"] else "LOSER"
    # In 4H live:
    v_4h_u = "WINNER" if m_u_live_4h["net_realized_r"] >= m_d_live_4h["net_realized_r"] else "LOSER"
    v_4h_d = "WINNER" if m_d_live_4h["net_realized_r"] > m_u_live_4h["net_realized_r"] else "LOSER"

    scorecard_data = {
        "portfolio_config": {
            "initial_capital_inr": 7000.0,
            "capital_per_asset_inr": 1000.0,
            "risk_per_trade_inr": 100.0,
            "friction_deducted": True,
            "commodity_friction_bps": 5.9,
            "crypto_friction_bps": 11.8,
        },
        "historical_performance": {
            "1h_unified": m_u_hist_1h,
            "1h_distributed": m_d_hist_1h,
            "4h_unified": m_u_hist_4h,
            "4h_distributed": m_d_hist_4h,
        },
        "live_unseen_window": {
            "1h_unified": {**m_u_live_1h, "verdict": v_1h_u},
            "1h_distributed": {**m_d_live_1h, "verdict": v_1h_d},
            "4h_unified": {**m_u_live_4h, "verdict": v_4h_u},
            "4h_distributed": {**m_d_live_4h, "verdict": v_4h_d},
        },
        "specialist_cutoffs": {
            "1h": cutoffs_1h,
            "4h": cutoffs_4h,
        }
    }

    scorecard_path = RESEARCH_DIR / "scorecard_unified_vs_distributed.json"
    with open(scorecard_path, "w", encoding="utf-8") as f:
        json.dump(scorecard_data, f, indent=2)
    print(f"\n[Scorecard] Successfully saved scorecard to {scorecard_path.name}")

    # Output formatted report
    print("\n" + "=" * 94)
    print("HEAD-TO-HEAD COMPARISON: UNIFIED (1 UNIVERSAL MODEL) vs DISTRIBUTED (7 SPECIALISTS)")
    print("Portfolio Capital: ₹7,000 INR (₹1,000 / asset) | Risk: 1R = ₹100.00 | Net of Friction")
    print("=" * 94)

    print("\n--- 1. HISTORICAL PERFORMANCE (2020 to Oct 20, 2026) ---")
    headers_hist = f"{'Metric':<25} | {'1H Unified (1 Model)':<20} | {'1H Distributed (7 Models)':<26} | {'4H Unified (1 Model)':<20} | {'4H Distributed (7 Models)':<26}"
    print(headers_hist)
    print("-" * len(headers_hist))

    u1_tr, d1_tr = m_u_hist_1h['total_trades'], m_d_hist_1h['total_trades']
    u4_tr, d4_tr = m_u_hist_4h['total_trades'], m_d_hist_4h['total_trades']
    print(f"{'Total Trades (N)':<25} | {u1_tr:<20} | {d1_tr:<26} | {u4_tr:<20} | {d4_tr:<26}")

    u1_wr = f"{m_u_hist_1h['win_rate_pct']:.1f}%"
    d1_wr = f"{m_d_hist_1h['win_rate_pct']:.1f}%"
    u4_wr = f"{m_u_hist_4h['win_rate_pct']:.1f}%"
    d4_wr = f"{m_d_hist_4h['win_rate_pct']:.1f}%"
    print(f"{'Win Rate (%)':<25} | {u1_wr:<20} | {d1_wr:<26} | {u4_wr:<20} | {d4_wr:<26}")

    u1_nr = f"{m_u_hist_1h['net_realized_r']:+.2f}R"
    d1_nr = f"{m_d_hist_1h['net_realized_r']:+.2f}R"
    u4_nr = f"{m_u_hist_4h['net_realized_r']:+.2f}R"
    d4_nr = f"{m_d_hist_4h['net_realized_r']:+.2f}R"
    print(f"{'Net Realized Return (R)':<25} | {u1_nr:<20} | {d1_nr:<26} | {u4_nr:<20} | {d4_nr:<26}")

    u1_pf = f"{m_u_hist_1h['profit_factor']:.2f}"
    d1_pf = f"{m_d_hist_1h['profit_factor']:.2f}"
    u4_pf = f"{m_u_hist_4h['profit_factor']:.2f}"
    d4_pf = f"{m_d_hist_4h['profit_factor']:.2f}"
    print(f"{'Profit Factor':<25} | {u1_pf:<20} | {d1_pf:<26} | {u4_pf:<20} | {d4_pf:<26}")

    u1_dd = f"{m_u_hist_1h['max_drawdown_r']:.2f}R"
    d1_dd = f"{m_d_hist_1h['max_drawdown_r']:.2f}R"
    u4_dd = f"{m_u_hist_4h['max_drawdown_r']:.2f}R"
    d4_dd = f"{m_d_hist_4h['max_drawdown_r']:.2f}R"
    print(f"{'Max Drawdown (R)':<25} | {u1_dd:<20} | {d1_dd:<26} | {u4_dd:<20} | {d4_dd:<26}")

    u1_cap = f"₹{m_u_hist_1h['final_capital_inr']:,.2f}"
    d1_cap = f"₹{m_d_hist_1h['final_capital_inr']:,.2f}"
    u4_cap = f"₹{m_u_hist_4h['final_capital_inr']:,.2f}"
    d4_cap = f"₹{m_d_hist_4h['final_capital_inr']:,.2f}"
    print(f"{'Capital (₹7,000 Start)':<25} | {u1_cap:<20} | {d1_cap:<26} | {u4_cap:<20} | {d4_cap:<26}")

    print("\n--- 2. LIVE UNSEEN WINDOW (Oct 21 to Nov 7, 2026 - 17 Days) ---")
    headers_live = f"{'Metric':<25} | {'1H Unified (1 Model)':<20} | {'1H Distributed (7 Models)':<26} | {'4H Unified (1 Model)':<20} | {'4H Distributed (7 Models)':<26}"
    print(headers_live)
    print("-" * len(headers_live))

    u1_ltr, d1_ltr = m_u_live_1h['total_trades'], m_d_live_1h['total_trades']
    u4_ltr, d4_ltr = m_u_live_4h['total_trades'], m_d_live_4h['total_trades']
    print(f"{'Live Trades Executed':<25} | {u1_ltr:<20} | {d1_ltr:<26} | {u4_ltr:<20} | {d4_ltr:<26}")

    u1_lwr = f"{m_u_live_1h['win_rate_pct']:.1f}%"
    d1_lwr = f"{m_d_live_1h['win_rate_pct']:.1f}%"
    u4_lwr = f"{m_u_live_4h['win_rate_pct']:.1f}%"
    d4_lwr = f"{m_d_live_4h['win_rate_pct']:.1f}%"
    print(f"{'Live Win Rate (%)':<25} | {u1_lwr:<20} | {d1_lwr:<26} | {u4_lwr:<20} | {d4_lwr:<26}")

    u1_lnr = f"{m_u_live_1h['net_realized_r']:+.2f}R"
    d1_lnr = f"{m_d_live_1h['net_realized_r']:+.2f}R"
    u4_lnr = f"{m_u_live_4h['net_realized_r']:+.2f}R"
    d4_lnr = f"{m_d_live_4h['net_realized_r']:+.2f}R"
    print(f"{'Live Realized Return (R)':<25} | {u1_lnr:<20} | {d1_lnr:<26} | {u4_lnr:<20} | {d4_lnr:<26}")

    u1_lpf = f"{m_u_live_1h['profit_factor']:.2f}"
    d1_lpf = f"{m_d_live_1h['profit_factor']:.2f}"
    u4_lpf = f"{m_u_live_4h['profit_factor']:.2f}"
    d4_lpf = f"{m_d_live_4h['profit_factor']:.2f}"
    print(f"{'Live Profit Factor':<25} | {u1_lpf:<20} | {d1_lpf:<26} | {u4_lpf:<20} | {d4_lpf:<26}")

    u1_lpnl = f"₹{m_u_live_1h['pnl_inr']:,.2f}"
    d1_lpnl = f"₹{m_d_live_1h['pnl_inr']:,.2f}"
    u4_lpnl = f"₹{m_u_live_4h['pnl_inr']:,.2f}"
    d4_lpnl = f"₹{m_d_live_4h['pnl_inr']:,.2f}"
    print(f"{'Live PnL (INR)':<25} | {u1_lpnl:<20} | {d1_lpnl:<26} | {u4_lpnl:<20} | {d4_lpnl:<26}")

    print(f"{'Alpha Verdict':<25} | {f'[{v_1h_u}]':<20} | {f'[{v_1h_d}]':<26} | {f'[{v_4h_u}]':<20} | {f'[{v_4h_d}]':<26}")
    print("=" * 94)


if __name__ == "__main__":
    main()
