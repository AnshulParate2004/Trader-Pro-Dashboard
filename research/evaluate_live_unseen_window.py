#!/usr/bin/env python3
"""
Live Unseen Window Evaluation & Bar-by-Bar Prediction Audit (Oct 21 - Nov 7, 2026)
Trader-Pro Dashboard: Research Pipeline

Invariants:
1. Universe: 4H Crypto (BTCUSDT, ETHUSDT, SOLUSDT, DOTUSDT) & 1H Commodities (GC=F, SI=F, CL=F).
2. Zero lookahead: strictly evaluates completed candles; features use t-1 and earlier.
3. Decision trees evaluated directly in-memory from src/models/swing_4h/ and src/models/swing_1h_commodities/.
4. Generates structured logs into src/data/live_unseen_prediction_logs.json.
5. Upserts into MongoDB collections: live_prediction_logs, paper_trades_4h_swing, paper_trades_1h_commodities.
"""

import os
import sys
import json
import math
import time
import datetime
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

import numpy as np
import pandas as pd

# Fix Windows console UTF-8 output
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Optional MongoDB integration
try:
    import pymongo
    HAVE_PYMONGO = True
except ImportError:
    HAVE_PYMONGO = False

ROOT_DIR = Path(__file__).resolve().parent.parent
SRC_DATA_DIR = ROOT_DIR / "src" / "data"
SRC_MODELS_DIR = ROOT_DIR / "src" / "models"
SRC_DATA_DIR.mkdir(parents=True, exist_ok=True)

START_DATE_UTC = datetime.datetime(2026, 10, 21, 0, 0, 0, tzinfo=datetime.timezone.utc)
END_DATE_UTC = datetime.datetime(2026, 11, 7, 23, 59, 59, tzinfo=datetime.timezone.utc)

# ------------------------------------------------------------------------------
# 1. Tree Inference Helper
# ------------------------------------------------------------------------------
def eval_tree_node(node: Dict[str, Any], features: List[float]) -> float:
    """Recursively evaluates a single decision tree node from LightGBM tree structure."""
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
    """Computes sigmoid probability across all trees in model_info."""
    trees = model.get("tree_info", [])
    raw_sum = sum(eval_tree_node(t["tree_structure"], features) for t in trees)
    return 1.0 / (1.0 + math.exp(-raw_sum))


# ------------------------------------------------------------------------------
# 2. Data Download Helpers
# ------------------------------------------------------------------------------
def fetch_binance_4h_klines(symbol: str, days_history: int = 70) -> pd.DataFrame:
    """Fetches Binance 4H klines with ample warm-up history."""
    now_ms = int(time.time() * 1000)
    start_ms = now_ms - (days_history * 24 * 3600 * 1000)
    url = f"https://fapi.binance.com/fapi/v1/klines?symbol={symbol}&interval=4h&startTime={start_ms}&limit=1000"
    req = urllib.request.Request(url, headers={"User-Agent": "Trader-Pro-Research/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = json.loads(resp.read().decode("utf-8"))
    
    cols = ["ot", "open", "high", "low", "close", "volume", "ct", "qv", "n", "tbv", "tbqv", "i"]
    df = pd.DataFrame(raw, columns=cols)
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = df[c].astype(float)
    df["open_time"] = pd.to_datetime(df["ot"], unit="ms", utc=True)
    df["close_time"] = pd.to_datetime(df["ct"], unit="ms", utc=True)
    df = df.sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
    return df


def fetch_yahoo_1h_klines(symbol: str, range_str: str = "2mo") -> pd.DataFrame:
    """Fetches Yahoo Finance 1H klines for commodities and benchmarks."""
    encoded = urllib.parse.quote(symbol)
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?interval=1h&range={range_str}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = json.loads(resp.read().decode("utf-8"))
    
    res = raw["chart"]["result"][0]
    timestamps = res["timestamp"]
    quote = res["indicators"]["quote"][0]
    
    records = []
    for i in range(len(timestamps)):
        o = quote["open"][i]
        h = quote["high"][i]
        l = quote["low"][i]
        c = quote["close"][i]
        v = quote.get("volume", [0] * len(timestamps))[i] or 1000.0
        if None in (o, h, l, c) or math.isnan(o) or math.isnan(c):
            continue
        ot = timestamps[i] * 1000
        records.append({
            "ot": ot,
            "open": float(o),
            "high": float(h),
            "low": float(l),
            "close": float(c),
            "volume": float(v),
            "open_time": pd.to_datetime(ot, unit="ms", utc=True),
            "close_time": pd.to_datetime(ot + 3599999, unit="ms", utc=True),
        })
    df = pd.DataFrame(records).sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
    return df


# ------------------------------------------------------------------------------
# 3. 4H Crypto Feature Extraction
# ------------------------------------------------------------------------------
def compute_4h_features(
    asset_df: pd.DataFrame,
    btc_df: pd.DataFrame,
    idx: int,
) -> List[float]:
    """
    Computes 14 leak-free features at index idx (using strictly t-1 and earlier):
    1. rs_vs_btc_3d (18 bars)
    2. rs_vs_btc_7d (42 bars)
    3. rs_vs_btc_30d (180 bars)
    4. funding_rate_zscore (0.0 fallback)
    5. oi_delta_1d (0.0 fallback)
    6. oi_delta_3d (0.0 fallback)
    7. vol_ratio_30d
    8. volume_zscore_20
    9. dist_ema_20
    10. dist_ema_50
    11. dist_sma_200
    12. trend_aligned
    13. donchian_pos_20
    14. atr_pct
    """
    t_1 = idx - 1
    if t_1 < 50:
        return [0.0] * 14
    
    asset_c = asset_df["close"].iloc[t_1]
    
    # RS vs BTC
    btc_c = btc_df["close"].iloc[t_1] if t_1 < len(btc_df) else asset_c
    def calc_rs(lookback: int) -> float:
        lb = min(lookback, t_1)
        a_prev = asset_df["close"].iloc[t_1 - lb]
        b_prev = btc_df["close"].iloc[t_1 - lb] if (t_1 - lb) < len(btc_df) else btc_c
        a_ret = (asset_c - a_prev) / a_prev if a_prev > 0 else 0.0
        b_ret = (btc_c - b_prev) / b_prev if b_prev > 0 else 0.0
        return float((1.0 + a_ret) / max(0.01, (1.0 + b_ret)) - 1.0)

    rs_3d = calc_rs(18)
    rs_7d = calc_rs(42)
    rs_30d = calc_rs(180)
    
    # Volatility ratio (EWMA vs 30-day baseline)
    sub_closes = asset_df["close"].iloc[:t_1+1]
    rets = sub_closes.pct_change().dropna()
    if len(rets) >= 20:
        decay = 0.94
        ewma_var = (rets**2).ewm(alpha=(1.0 - decay), adjust=False).mean().iloc[-1]
        ewma_vol = math.sqrt(max(0.0, ewma_var))
        roll_base = rets.iloc[-min(180, len(rets)):].std()
        vol_ratio_30d = float(ewma_vol / max(1e-6, roll_base))
    else:
        vol_ratio_30d = 1.0

    # Volume z-score
    sub_vol = asset_df["volume"].iloc[max(0, t_1-20):t_1+1]
    v_mean = sub_vol.mean()
    v_std = sub_vol.std() if len(sub_vol) > 1 and sub_vol.std() > 0 else 1.0
    vol_zscore = float((asset_df["volume"].iloc[t_1] - v_mean) / v_std)

    # EMAs & SMA
    ema20 = float(sub_closes.ewm(span=20, adjust=False).mean().iloc[-1])
    ema50 = float(sub_closes.ewm(span=50, adjust=False).mean().iloc[-1])
    sma200 = float(sub_closes.iloc[-min(200, len(sub_closes)):].mean())

    dist_ema_20 = float((asset_c - ema20) / asset_c)
    dist_ema_50 = float((asset_c - ema50) / asset_c)
    dist_sma_200 = float((asset_c - sma200) / asset_c)
    trend_aligned = 1.0 if asset_c > sma200 else 0.0

    # Donchian position
    sub_highs = asset_df["high"].iloc[max(0, t_1-20):t_1]
    sub_lows = asset_df["low"].iloc[max(0, t_1-20):t_1]
    d_h = sub_highs.max() if len(sub_highs) > 0 else asset_c * 1.02
    d_l = sub_lows.min() if len(sub_lows) > 0 else asset_c * 0.98
    donchian_pos_20 = float((asset_c - d_l) / max(1e-5, (d_h - d_l)))

    # ATR pct
    sub_df = asset_df.iloc[max(0, t_1-14):t_1+1]
    tr_list = []
    for k in range(1, len(sub_df)):
        h = sub_df["high"].iloc[k]
        l = sub_df["low"].iloc[k]
        prev_c = sub_df["close"].iloc[k-1]
        tr = max(h - l, abs(h - prev_c), abs(l - prev_c))
        tr_list.append(tr)
    atr = (sum(tr_list) / len(tr_list)) if tr_list else (asset_c * 0.02)
    atr_pct = float(atr / asset_c)

    return [
        rs_3d,
        rs_7d,
        rs_30d,
        0.0,  # funding_rate_zscore
        0.0,  # oi_delta_1d
        0.0,  # oi_delta_3d
        vol_ratio_30d,
        vol_zscore,
        dist_ema_20,
        dist_ema_50,
        dist_sma_200,
        trend_aligned,
        donchian_pos_20,
        atr_pct,
    ]


# ------------------------------------------------------------------------------
# 4. 1H Commodities Feature Extraction
# ------------------------------------------------------------------------------
def compute_1h_commodities_features(
    asset_df: pd.DataFrame,
    dxy_df: pd.DataFrame,
    idx: int,
) -> List[float]:
    """
    Computes 8 leak-free features for 1H Macro Commodities (lagged t-1):
    1. feat_dxy_mom_24h
    2. feat_dxy_mom_72h
    3. feat_dxy_corr_60
    4. feat_vol_zscore
    5. feat_volatility_ratio
    6. feat_atr_pct
    7. feat_donchian_pos
    8. feat_trend_dist_200
    """
    t_1 = idx - 1
    if t_1 < 50:
        return [0.0] * 8

    asset_c = asset_df["close"].iloc[t_1]

    # DXY momentums
    dxy_idx = min(t_1, len(dxy_df) - 1)
    dxy_curr = dxy_df["close"].iloc[dxy_idx]
    dxy_24_idx = max(0, dxy_idx - 24)
    dxy_72_idx = max(0, dxy_idx - 72)
    dxy_mom_24 = float((dxy_curr - dxy_df["close"].iloc[dxy_24_idx]) / dxy_df["close"].iloc[dxy_24_idx])
    dxy_mom_72 = float((dxy_curr - dxy_df["close"].iloc[dxy_72_idx]) / dxy_df["close"].iloc[dxy_72_idx])

    # 60-bar correlation with DXY
    sub_asset_c = asset_df["close"].iloc[max(0, t_1-60):t_1+1]
    sub_dxy_c = dxy_df["close"].iloc[max(0, dxy_idx-60):dxy_idx+1]
    min_len = min(len(sub_asset_c), len(sub_dxy_c))
    if min_len >= 20:
        ret_a = sub_asset_c.iloc[-min_len:].pct_change().dropna()
        ret_d = sub_dxy_c.iloc[-min_len:].pct_change().dropna()
        corr_series = ret_a.corr(ret_d)
        dxy_corr_60 = float(corr_series) if not math.isnan(corr_series) else -0.20
    else:
        dxy_corr_60 = -0.20

    # Volume Z-score
    sub_vol = asset_df["volume"].iloc[max(0, t_1-20):t_1+1]
    v_mean = sub_vol.mean()
    v_std = sub_vol.std() if len(sub_vol) > 1 and sub_vol.std() > 0 else 1.0
    vol_zscore = float((asset_df["volume"].iloc[t_1] - v_mean) / v_std)

    # Volatility Ratio
    sub_closes = asset_df["close"].iloc[:t_1+1]
    rets = sub_closes.pct_change().dropna()
    if len(rets) >= 20:
        ewma_var = (rets**2).ewm(alpha=0.06, adjust=False).mean().iloc[-1]
        ewma_vol = math.sqrt(max(0.0, ewma_var))
        roll_base = rets.iloc[-min(120, len(rets)):].std()
        vol_ratio = float(ewma_vol / max(1e-6, roll_base))
    else:
        vol_ratio = 1.0

    # ATR pct
    sub_df = asset_df.iloc[max(0, t_1-14):t_1+1]
    tr_list = []
    for k in range(1, len(sub_df)):
        h = sub_df["high"].iloc[k]
        l = sub_df["low"].iloc[k]
        prev_c = sub_df["close"].iloc[k-1]
        tr_list.append(max(h - l, abs(h - prev_c), abs(l - prev_c)))
    atr = (sum(tr_list) / len(tr_list)) if tr_list else (asset_c * 0.005)
    atr_pct = float(atr / asset_c)

    # Donchian pos
    sub_highs = asset_df["high"].iloc[max(0, t_1-20):t_1]
    sub_lows = asset_df["low"].iloc[max(0, t_1-20):t_1]
    d_h = sub_highs.max() if len(sub_highs) > 0 else asset_c * 1.01
    d_l = sub_lows.min() if len(sub_lows) > 0 else asset_c * 0.99
    donchian_pos = float((asset_c - d_l) / max(1e-5, (d_h - d_l)))

    # Trend dist 200 SMA
    sma200 = float(sub_closes.iloc[-min(200, len(sub_closes)):].mean())
    trend_dist_200 = float((asset_c - sma200) / asset_c)

    return [
        dxy_mom_24,
        dxy_mom_72,
        dxy_corr_60,
        vol_zscore,
        vol_ratio,
        atr_pct,
        donchian_pos,
        trend_dist_200,
    ]


# ------------------------------------------------------------------------------
# 5. Main Evaluation Loop
# ------------------------------------------------------------------------------
def evaluate_live_unseen_window():
    print("=" * 80)
    print("TRADER-PRO: LIVE UNSEEN EVALUATION ENGINE (Oct 21 - Nov 7, 2026)")
    print("=" * 80)

    # 1. Load models & metadata
    with open(SRC_MODELS_DIR / "swing_4h" / "model.json") as f:
        model_4h = json.load(f)
    with open(SRC_MODELS_DIR / "swing_4h" / "metadata.json") as f:
        meta_4h = json.load(f)
    p_cutoff_4h = meta_4h.get("p_cutoff", 0.10)

    with open(SRC_MODELS_DIR / "swing_1h_commodities" / "model.json") as f:
        model_1h_comm = json.load(f)
    with open(SRC_MODELS_DIR / "swing_1h_commodities" / "metadata.json") as f:
        meta_1h_comm = json.load(f)
    p_cutoff_comm = meta_1h_comm.get("p_cutoff", 0.063518)

    print(f"[Loaded Models] 4H Swing: {len(model_4h['tree_info'])} trees (P_cutoff={p_cutoff_4h}) | 1H Comm: {len(model_1h_comm['tree_info'])} trees (P_cutoff={p_cutoff_comm:.4f})")

    # 2. Ingest Market Data
    print("\n[Ingesting 4H Crypto Feeds]...")
    crypto_symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT"]
    crypto_dfs = {}
    for sym in crypto_symbols:
        try:
            df = fetch_binance_4h_klines(sym)
            crypto_dfs[sym] = df
            print(f"  ✓ {sym}: {len(df)} 4H candles ({df['open_time'].min()} to {df['open_time'].max()})")
        except Exception as e:
            print(f"  ✗ {sym} fetch error: {e}")

    print("\n[Ingesting 1H Commodities Feeds]...")
    comm_symbols = ["GC=F", "SI=F", "CL=F"]
    comm_dfs = {}
    dxy_df = fetch_yahoo_1h_klines("DX-Y.NYB")
    print(f"  ✓ Benchmark DX-Y.NYB: {len(dxy_df)} 1H candles")
    for sym in comm_symbols:
        try:
            df = fetch_yahoo_1h_klines(sym)
            comm_dfs[sym] = df
            print(f"  ✓ {sym}: {len(df)} 1H candles ({df['open_time'].min()} to {df['open_time'].max()})")
        except Exception as e:
            print(f"  ✗ {sym} fetch error: {e}")

    # 3. Bar-by-bar Sequential Evaluation
    prediction_logs: List[Dict[str, Any]] = []
    executed_trades: List[Dict[str, Any]] = []

    # A. Evaluate 4H Crypto
    btc_df = crypto_dfs.get("BTCUSDT")
    for sym, df in crypto_dfs.items():
        # Precompute rolling SMA200 and Donchian channels
        df["sma200"] = df["close"].rolling(200, min_periods=30).mean()
        df["donch_h20"] = df["high"].shift(1).rolling(20, min_periods=5).max()
        df["donch_l20"] = df["low"].shift(1).rolling(20, min_periods=5).min()

        # Iterate over unseen window
        for i in range(len(df)):
            t = df["open_time"].iloc[i]
            if t < START_DATE_UTC or t > END_DATE_UTC:
                continue

            c = float(df["close"].iloc[i])
            sma200 = float(df["sma200"].iloc[i])
            donch_h = float(df["donch_h20"].iloc[i])
            donch_l = float(df["donch_l20"].iloc[i])

            feats = compute_4h_features(df, btc_df if btc_df is not None else df, i)
            prob = predict_tree_probability(model_4h, feats)
            passes_gate = prob >= p_cutoff_4h

            decision = "CASH_PROTECTED_CONSOLIDATION"
            reason = f"Inside 20-bar Donchian range [${donch_l:.1f}, ${donch_h:.1f}] · Capital preserved in cash"
            trade_details = None

            is_breakout = c > donch_h and c > sma200
            is_below_200 = c < sma200

            if is_breakout:
                if passes_gate:
                    decision = "EXECUTED_TRADE"
                    reason = f"4H Donchian Breakout above 200 SMA (P={prob*100:.1f}% >= {p_cutoff_4h*100:.1f}%)"
                    
                    # Compute stop & target
                    prev_low10 = float(df["low"].iloc[max(0, i-10):i].min())
                    raw_stop_dist = max(c - prev_low10, c * 0.015)
                    clamped_stop_pct = max(0.015, min(0.060, raw_stop_dist / c))
                    stop_dist = c * clamped_stop_pct
                    sl = c - stop_dist
                    tp = c + 2.5 * stop_dist

                    # Simulate forward over subsequent candles (up to 12 bars = 48h)
                    exit_type = "TIME"
                    exit_price = c
                    bars_held = 0
                    gross_r = 0.0
                    for fwd in range(1, 13):
                        if i + fwd >= len(df):
                            break
                        bars_held = fwd
                        bar_h = float(df["high"].iloc[i + fwd])
                        bar_l = float(df["low"].iloc[i + fwd])
                        bar_c = float(df["close"].iloc[i + fwd])

                        # Collision precedence invariant: touch both -> STOP (-1R)
                        if bar_l <= sl and bar_h >= tp:
                            exit_type = "STOP"
                            exit_price = sl
                            gross_r = -1.0
                            break
                        elif bar_h >= tp:
                            exit_type = "TARGET"
                            exit_price = tp
                            gross_r = 2.5
                            break
                        elif bar_l <= sl:
                            exit_type = "STOP"
                            exit_price = sl
                            gross_r = -1.0
                            break
                        else:
                            exit_price = bar_c
                            gross_r = (bar_c - c) / stop_dist

                    friction_r = 0.0010 / clamped_stop_pct
                    net_r = gross_r - friction_r

                    trade_details = {
                        "id": f"swing4h_{sym}_{int(df['ot'].iloc[i])}",
                        "side": "LONG",
                        "entry_price": round(c, 2),
                        "stop_loss": round(sl, 2),
                        "take_profit": round(tp, 2),
                        "stop_dist_pct": round(clamped_stop_pct, 4),
                        "exit_type": exit_type,
                        "exit_price": round(exit_price, 2),
                        "gross_r": round(gross_r, 3),
                        "cost_r": round(friction_r, 4),
                        "net_r": round(net_r, 3),
                        "bars_held": bars_held,
                        "status": "CLOSED",
                    }
                    executed_trades.append({
                        **trade_details,
                        "symbol": sym,
                        "model_id": "4h-swing-meta-017",
                        "timeframe": "4h",
                        "entry_time": t.isoformat(),
                        "probability": round(prob, 4),
                        "p_cutoff": p_cutoff_4h,
                    })
                else:
                    decision = "CASH_PROTECTED_CONSOLIDATION"
                    reason = f"Breakout candidate rejected by AI meta-classifier: Conviction P ({prob*100:.1f}%) < P_cutoff ({p_cutoff_4h*100:.1f}%)"
            elif is_below_200:
                decision = "CASH_PROTECTED_BEARISH"
                reason = f"Price below 200 SMA trend filter (${c:.1f} < ${sma200:.1f}) · 100% Capital in Cash"

            log_entry = {
                "id": f"{sym}_{int(df['ot'].iloc[i])}",
                "timestamp": t.isoformat(),
                "timestamp_ms": int(df["ot"].iloc[i]),
                "symbol": sym,
                "asset_class": "crypto",
                "timeframe": "4h",
                "price": round(c, 2),
                "sma_200": round(sma200, 2),
                "donchian_high_20": round(donch_h, 2),
                "donchian_low_20": round(donch_l, 2),
                "probability": round(prob, 4),
                "p_cutoff": p_cutoff_4h,
                "passes_gate": passes_gate,
                "decision": decision,
                "decision_reason": reason,
                "trade_details": trade_details,
            }
            prediction_logs.append(log_entry)

    # B. Evaluate 1H Commodities
    for sym, df in comm_dfs.items():
        df["sma200"] = df["close"].rolling(200, min_periods=30).mean()
        df["donch_h20"] = df["high"].shift(1).rolling(20, min_periods=5).max()
        df["donch_l20"] = df["low"].shift(1).rolling(20, min_periods=5).min()

        for i in range(len(df)):
            t = df["open_time"].iloc[i]
            if t < START_DATE_UTC or t > END_DATE_UTC:
                continue

            c = float(df["close"].iloc[i])
            sma200 = float(df["sma200"].iloc[i])
            donch_h = float(df["donch_h20"].iloc[i])
            donch_l = float(df["donch_l20"].iloc[i])

            feats = compute_1h_commodities_features(df, dxy_df, i)
            prob = predict_tree_probability(model_1h_comm, feats)
            passes_gate = prob >= p_cutoff_comm

            decision = "CASH_PROTECTED_CONSOLIDATION"
            reason = f"Inside 20-bar Donchian range [${donch_l:.2f}, ${donch_h:.2f}] · Capital preserved in cash"
            trade_details = None

            is_long_breakout = c > donch_h and c > sma200
            is_short_breakdown = c < donch_l and c < sma200
            is_below_200 = c < sma200

            if is_long_breakout:
                if passes_gate:
                    decision = "EXECUTED_TRADE"
                    reason = f"1H Donchian Breakout above 200 SMA (P={prob*100:.1f}% >= {p_cutoff_comm*100:.2f}%)"
                    prev_low10 = float(df["low"].iloc[max(0, i-10):i].min())
                    raw_stop_dist = max(c - prev_low10, c * 0.010)
                    clamped_stop_pct = max(0.010, min(0.040, raw_stop_dist / c))
                    stop_dist = c * clamped_stop_pct
                    sl = c - stop_dist
                    tp = c + 2.5 * stop_dist

                    exit_type = "TIME"
                    exit_price = c
                    bars_held = 0
                    gross_r = 0.0
                    for fwd in range(1, 25):  # 24 bars time barrier
                        if i + fwd >= len(df):
                            break
                        bars_held = fwd
                        bar_h = float(df["high"].iloc[i + fwd])
                        bar_l = float(df["low"].iloc[i + fwd])
                        bar_c = float(df["close"].iloc[i + fwd])

                        if bar_l <= sl and bar_h >= tp:
                            exit_type = "STOP"
                            exit_price = sl
                            gross_r = -1.0
                            break
                        elif bar_h >= tp:
                            exit_type = "TARGET"
                            exit_price = tp
                            gross_r = 2.5
                            break
                        elif bar_l <= sl:
                            exit_type = "STOP"
                            exit_price = sl
                            gross_r = -1.0
                            break
                        else:
                            exit_price = bar_c
                            gross_r = (bar_c - c) / stop_dist

                    friction_r = 0.0005 / clamped_stop_pct
                    net_r = gross_r - friction_r

                    trade_details = {
                        "id": f"comm1h_{sym.replace('=F', '')}_{int(df['ot'].iloc[i])}",
                        "side": "LONG",
                        "entry_price": round(c, 2),
                        "stop_loss": round(sl, 2),
                        "take_profit": round(tp, 2),
                        "stop_dist_pct": round(clamped_stop_pct, 4),
                        "exit_type": exit_type,
                        "exit_price": round(exit_price, 2),
                        "gross_r": round(gross_r, 3),
                        "cost_r": round(friction_r, 4),
                        "net_r": round(net_r, 3),
                        "bars_held": bars_held,
                        "status": "CLOSED",
                    }
                    executed_trades.append({
                        **trade_details,
                        "symbol": sym,
                        "model_id": "1h-commodities-rf",
                        "timeframe": "1h",
                        "entry_time": t.isoformat(),
                        "probability": round(prob, 4),
                        "p_cutoff": p_cutoff_comm,
                    })
                else:
                    decision = "CASH_PROTECTED_CONSOLIDATION"
                    reason = f"Breakout candidate rejected by AI meta-classifier: Conviction P ({prob*100:.1f}%) < P_cutoff ({p_cutoff_comm*100:.2f}%)"
            elif is_short_breakdown:
                if passes_gate:
                    decision = "EXECUTED_TRADE"
                    reason = f"1H Donchian Breakdown below 200 SMA (P={prob*100:.1f}% >= {p_cutoff_comm*100:.2f}%)"
                    prev_high10 = float(df["high"].iloc[max(0, i-10):i].max())
                    raw_stop_dist = max(prev_high10 - c, c * 0.010)
                    clamped_stop_pct = max(0.010, min(0.040, raw_stop_dist / c))
                    stop_dist = c * clamped_stop_pct
                    sl = c + stop_dist
                    tp = c - 2.5 * stop_dist

                    exit_type = "TIME"
                    exit_price = c
                    bars_held = 0
                    gross_r = 0.0
                    for fwd in range(1, 25):
                        if i + fwd >= len(df):
                            break
                        bars_held = fwd
                        bar_h = float(df["high"].iloc[i + fwd])
                        bar_l = float(df["low"].iloc[i + fwd])
                        bar_c = float(df["close"].iloc[i + fwd])

                        if bar_h >= sl and bar_l <= tp:
                            exit_type = "STOP"
                            exit_price = sl
                            gross_r = -1.0
                            break
                        elif bar_l <= tp:
                            exit_type = "TARGET"
                            exit_price = tp
                            gross_r = 2.5
                            break
                        elif bar_h >= sl:
                            exit_type = "STOP"
                            exit_price = sl
                            gross_r = -1.0
                            break
                        else:
                            exit_price = bar_c
                            gross_r = (c - bar_c) / stop_dist

                    friction_r = 0.0005 / clamped_stop_pct
                    net_r = gross_r - friction_r

                    trade_details = {
                        "id": f"comm1h_{sym.replace('=F', '')}_{int(df['ot'].iloc[i])}",
                        "side": "SHORT",
                        "entry_price": round(c, 2),
                        "stop_loss": round(sl, 2),
                        "take_profit": round(tp, 2),
                        "stop_dist_pct": round(clamped_stop_pct, 4),
                        "exit_type": exit_type,
                        "exit_price": round(exit_price, 2),
                        "gross_r": round(gross_r, 3),
                        "cost_r": round(friction_r, 4),
                        "net_r": round(net_r, 3),
                        "bars_held": bars_held,
                        "status": "CLOSED",
                    }
                    executed_trades.append({
                        **trade_details,
                        "symbol": sym,
                        "model_id": "1h-commodities-rf",
                        "timeframe": "1h",
                        "entry_time": t.isoformat(),
                        "probability": round(prob, 4),
                        "p_cutoff": p_cutoff_comm,
                    })
                else:
                    decision = "CASH_PROTECTED_CONSOLIDATION"
                    reason = f"Breakdown candidate rejected by AI meta-classifier: Conviction P ({prob*100:.1f}%) < P_cutoff ({p_cutoff_comm*100:.2f}%)"
            elif is_below_200:
                decision = "CASH_PROTECTED_BEARISH"
                reason = f"Price below 200 SMA trend filter (${c:.2f} < ${sma200:.2f}) · 100% Capital in Cash"

            log_entry = {
                "id": f"{sym}_{int(df['ot'].iloc[i])}",
                "timestamp": t.isoformat(),
                "timestamp_ms": int(df["ot"].iloc[i]),
                "symbol": sym,
                "asset_class": "commodities",
                "timeframe": "1h",
                "price": round(c, 2),
                "sma_200": round(sma200, 2),
                "donchian_high_20": round(donch_h, 2),
                "donchian_low_20": round(donch_l, 2),
                "probability": round(prob, 4),
                "p_cutoff": p_cutoff_comm,
                "passes_gate": passes_gate,
                "decision": decision,
                "decision_reason": reason,
                "trade_details": trade_details,
            }
            prediction_logs.append(log_entry)

    # Sort logs chronologically (newest first for UI feed display)
    prediction_logs.sort(key=lambda x: x["timestamp_ms"], reverse=True)

    print(f"\n[Evaluation Complete] Total Live Evaluation Bars: {len(prediction_logs)}")
    executed_count = sum(1 for p in prediction_logs if p["decision"] == "EXECUTED_TRADE")
    cash_bear_count = sum(1 for p in prediction_logs if p["decision"] == "CASH_PROTECTED_BEARISH")
    cash_consol_count = sum(1 for p in prediction_logs if p["decision"] == "CASH_PROTECTED_CONSOLIDATION")
    print(f"  • EXECUTED TRADES: {executed_count}")
    print(f"  • CASH PROTECTED (BEARISH): {cash_bear_count}")
    print(f"  • CASH PROTECTED (CONSOLIDATION / FILTERED): {cash_consol_count}")

    # 4. Save JSON Artifacts
    logs_path = SRC_DATA_DIR / "live_unseen_prediction_logs.json"
    with open(logs_path, "w", encoding="utf-8") as f:
        json.dump(prediction_logs, f, indent=2)
    print(f"  ✓ Saved {len(prediction_logs)} prediction logs to {logs_path}")

    trades_path = SRC_DATA_DIR / "live_executed_trades.json"
    with open(trades_path, "w", encoding="utf-8") as f:
        json.dump(executed_trades, f, indent=2)
    print(f"  ✓ Saved {len(executed_trades)} executed trades to {trades_path}")

    # 5. MongoDB Upsert
    env_file = ROOT_DIR / ".env.local"
    mongo_uri = ""
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("MONGODB_URI="):
                mongo_uri = line.split("=", 1)[1].strip()

    if HAVE_PYMONGO and mongo_uri and "<db_" not in mongo_uri:
        try:
            print("\n[MongoDB Integration] Connecting to database...")
            client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
            db = client.get_database("that")

            # Upsert into live_prediction_logs
            col_logs = db["live_prediction_logs"]
            col_logs.delete_many({})  # Refresh with full unseen evaluation
            if prediction_logs:
                col_logs.insert_many(prediction_logs)
            print(f"  ✓ Upserted {len(prediction_logs)} records into MongoDB collection 'live_prediction_logs'")

            # Upsert into paper_trades_4h_swing and paper_trades_1h_commodities
            trades_4h = [t for t in executed_trades if t.get("timeframe") == "4h"]
            trades_comm = [t for t in executed_trades if t.get("timeframe") == "1h"]

            if trades_4h:
                col_4h = db["paper_trades_4h_swing"]
                for t in trades_4h:
                    col_4h.update_one({"id": t["id"]}, {"$set": t}, upsert=True)
                print(f"  ✓ Upserted {len(trades_4h)} trades into 'paper_trades_4h_swing'")

            if trades_comm:
                col_comm = db["paper_trades_1h_commodities"]
                for t in trades_comm:
                    col_comm.update_one({"id": t["id"]}, {"$set": t}, upsert=True)
                print(f"  ✓ Upserted {len(trades_comm)} trades into 'paper_trades_1h_commodities'")

        except Exception as e:
            print(f"  ✗ MongoDB update warning: {e}")
    else:
        print("\n[MongoDB Integration] Skipped (URI not configured or pymongo unavailable). Local JSON fallback is fully active.")

    print("\n[SUCCESS] Live unseen window evaluation completed successfully!")


if __name__ == "__main__":
    evaluate_live_unseen_window()
