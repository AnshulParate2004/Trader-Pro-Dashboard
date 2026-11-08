#!/usr/bin/env python3
"""
Master Deterministic Trade Computation for Oct 21 - Nov 7, 2026
Computes exact trade counts bar-by-bar from live candles for:
1. 1H Dedicated Architecture (1H Commodities + 1H Crypto)
2. 4H Dedicated Architecture (4H Commodities + 4H Crypto)
3. 1H Multi-Asset Production Engine (1H Commodities + 4H Crypto)
4. Unified 7-Asset 1H Meta-Model
5. Unified 7-Asset 4H Meta-Model
6. Pure Rules Baseline (No AI)
"""

import os
import sys
import json
import math
import datetime
import urllib.request
from pathlib import Path
from typing import Dict, List, Any, Optional

import numpy as np
import pandas as pd
import yfinance as yf

ROOT_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard")
MODELS_DIR = ROOT_DIR / "src" / "models"

START_DATE_UTC = datetime.datetime(2026, 10, 21, 0, 0, 0, tzinfo=datetime.timezone.utc)
END_DATE_UTC = datetime.datetime(2026, 11, 7, 23, 59, 59, tzinfo=datetime.timezone.utc)


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


# Live data download
def fetch_binance_klines(symbol: str, interval: str = "1h", limit: int = 1000) -> pd.DataFrame:
    url = f"https://fapi.binance.com/fapi/v1/klines?symbol={symbol}&interval={interval}&limit={limit}"
    req = urllib.request.Request(url, headers={"User-Agent": "Trader-Pro-Master/1.0"})
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


def fetch_yahoo_1h_klines(symbol: str) -> pd.DataFrame:
    raw = yf.download(symbol, start="2026-09-01", end="2026-11-08", interval="1h", progress=False)
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = [col[0] for col in raw.columns]
    raw = raw.reset_index()
    time_col = "Datetime" if "Datetime" in raw.columns else "Date"
    df = pd.DataFrame()
    df["open_time"] = pd.to_datetime(raw[time_col], utc=True)
    df["open"] = raw["Open"].astype(float)
    df["high"] = raw["High"].astype(float)
    df["low"] = raw["Low"].astype(float)
    df["close"] = raw["Close"].astype(float)
    df["volume"] = raw["Volume"].astype(float)
    df["ot"] = df["open_time"].astype("int64") // 10**6
    df = df.sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
    return df


def resample_to_4h(df_1h: pd.DataFrame) -> pd.DataFrame:
    df = df_1h.copy().set_index("open_time")
    agg_rules = {
        "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum", "ot": "first"
    }
    df_4h = df.resample("4h").agg(agg_rules).dropna().reset_index()
    return df_4h


# Features: 1H Commodities (8 feats)
def compute_comm_1h_features(df: pd.DataFrame, dxy_df: pd.DataFrame, idx: int) -> List[float]:
    t_1 = idx - 1
    if t_1 < 50:
        return [0.0] * 8
    asset_c = df["close"].iloc[t_1]
    dxy_idx = min(t_1, len(dxy_df) - 1)
    dxy_curr = dxy_df["close"].iloc[dxy_idx]
    dxy_mom_24 = float((dxy_curr - dxy_df["close"].iloc[max(0, dxy_idx - 24)]) / dxy_df["close"].iloc[max(0, dxy_idx - 24)])
    dxy_mom_72 = float((dxy_curr - dxy_df["close"].iloc[max(0, dxy_idx - 72)]) / dxy_df["close"].iloc[max(0, dxy_idx - 72)])

    sub_asset_c = df["close"].iloc[max(0, t_1-60):t_1+1]
    sub_dxy_c = dxy_df["close"].iloc[max(0, dxy_idx-60):dxy_idx+1]
    min_len = min(len(sub_asset_c), len(sub_dxy_c))
    if min_len >= 20:
        ret_a = sub_asset_c.iloc[-min_len:].pct_change().dropna()
        ret_d = sub_dxy_c.iloc[-min_len:].pct_change().dropna()
        corr_series = ret_a.corr(ret_d)
        dxy_corr_60 = float(corr_series) if not math.isnan(corr_series) else -0.20
    else:
        dxy_corr_60 = -0.20

    sub_vol = df["volume"].iloc[max(0, t_1-20):t_1+1]
    v_mean = sub_vol.mean()
    v_std = sub_vol.std() if len(sub_vol) > 1 and sub_vol.std() > 0 else 1.0
    vol_zscore = float((df["volume"].iloc[t_1] - v_mean) / v_std)

    sub_closes = df["close"].iloc[:t_1+1]
    rets = sub_closes.pct_change().dropna()
    if len(rets) >= 20:
        ewma_var = (rets**2).ewm(alpha=0.06, adjust=False).mean().iloc[-1]
        ewma_vol = math.sqrt(max(0.0, ewma_var))
        roll_base = rets.iloc[-min(120, len(rets)):].std()
        vol_ratio = float(ewma_vol / max(1e-6, roll_base))
    else:
        vol_ratio = 1.0

    sub_df = df.iloc[max(0, t_1-14):t_1+1]
    tr_list = []
    for k in range(1, len(sub_df)):
        h = sub_df["high"].iloc[k]
        l = sub_df["low"].iloc[k]
        prev_c = sub_df["close"].iloc[k-1]
        tr_list.append(max(h - l, abs(h - prev_c), abs(l - prev_c)))
    atr = (sum(tr_list) / len(tr_list)) if tr_list else (asset_c * 0.005)
    atr_pct = float(atr / asset_c)

    sub_highs = df["high"].iloc[max(0, t_1-20):t_1]
    sub_lows = df["low"].iloc[max(0, t_1-20):t_1]
    d_h = sub_highs.max() if len(sub_highs) > 0 else asset_c * 1.01
    d_l = sub_lows.min() if len(sub_lows) > 0 else asset_c * 0.99
    donchian_pos = float((asset_c - d_l) / max(1e-5, (d_h - d_l)))

    sma200 = float(sub_closes.iloc[-min(200, len(sub_closes)):].mean())
    trend_dist_200 = float((asset_c - sma200) / asset_c)

    return [dxy_mom_24, dxy_mom_72, dxy_corr_60, vol_zscore, vol_ratio, atr_pct, donchian_pos, trend_dist_200]


# Features: 4H Crypto swing_4h (14 feats)
def compute_crypto_4h_14feats(df: pd.DataFrame, btc_df: pd.DataFrame, idx: int) -> List[float]:
    t_1 = idx - 1
    if t_1 < 50:
        return [0.0] * 14
    asset_c = df["close"].iloc[t_1]
    btc_c = btc_df["close"].iloc[t_1] if t_1 < len(btc_df) else asset_c

    def calc_rs(lookback: int) -> float:
        lb = min(lookback, t_1)
        a_prev = df["close"].iloc[t_1 - lb]
        b_prev = btc_df["close"].iloc[t_1 - lb] if (t_1 - lb) < len(btc_df) else btc_c
        a_ret = (asset_c - a_prev) / a_prev if a_prev > 0 else 0.0
        b_ret = (btc_c - b_prev) / b_prev if b_prev > 0 else 0.0
        return float((1.0 + a_ret) / max(0.01, (1.0 + b_ret)) - 1.0)

    rs_3d = calc_rs(18)
    rs_7d = calc_rs(42)
    rs_30d = calc_rs(180)

    sub_closes = df["close"].iloc[:t_1+1]
    rets = sub_closes.pct_change().dropna()
    if len(rets) >= 20:
        ewma_var = (rets**2).ewm(alpha=0.06, adjust=False).mean().iloc[-1]
        ewma_vol = math.sqrt(max(0.0, ewma_var))
        roll_base = rets.iloc[-min(180, len(rets)):].std()
        vol_ratio_30d = float(ewma_vol / max(1e-6, roll_base))
    else:
        vol_ratio_30d = 1.0

    sub_vol = df["volume"].iloc[max(0, t_1-20):t_1+1]
    v_mean = sub_vol.mean()
    v_std = sub_vol.std() if len(sub_vol) > 1 and sub_vol.std() > 0 else 1.0
    vol_zscore = float((df["volume"].iloc[t_1] - v_mean) / v_std)

    ema20 = float(sub_closes.ewm(span=20, adjust=False).mean().iloc[-1])
    ema50 = float(sub_closes.ewm(span=50, adjust=False).mean().iloc[-1])
    sma200 = float(sub_closes.iloc[-min(200, len(sub_closes)):].mean())

    dist_ema_20 = float((asset_c - ema20) / asset_c)
    dist_ema_50 = float((asset_c - ema50) / asset_c)
    dist_sma_200 = float((asset_c - sma200) / asset_c)
    trend_aligned = 1.0 if asset_c > sma200 else 0.0

    sub_highs = df["high"].iloc[max(0, t_1-20):t_1]
    sub_lows = df["low"].iloc[max(0, t_1-20):t_1]
    d_h = sub_highs.max() if len(sub_highs) > 0 else asset_c * 1.02
    d_l = sub_lows.min() if len(sub_lows) > 0 else asset_c * 0.98
    donchian_pos_20 = float((asset_c - d_l) / max(1e-5, (d_h - d_l)))

    sub_df = df.iloc[max(0, t_1-14):t_1+1]
    tr_list = [max(sub_df["high"].iloc[k] - sub_df["low"].iloc[k], abs(sub_df["high"].iloc[k] - sub_df["close"].iloc[k-1]), abs(sub_df["low"].iloc[k] - sub_df["close"].iloc[k-1])) for k in range(1, len(sub_df))]
    atr = (sum(tr_list) / len(tr_list)) if tr_list else (asset_c * 0.02)
    atr_pct = float(atr / asset_c)

    return [rs_3d, rs_7d, rs_30d, 0.0, 0.0, 0.0, vol_ratio_30d, vol_zscore, dist_ema_20, dist_ema_50, dist_sma_200, trend_aligned, donchian_pos_20, atr_pct]


# Features: 1H / 4H Crypto (9 feats from 01_train)
def compute_crypto_9feats(df: pd.DataFrame, btc_df: pd.DataFrame, idx: int) -> List[float]:
    t_1 = idx - 1
    if t_1 < 50:
        return [0.0] * 9
    c = df["close"]
    h = df["high"]
    l = df["low"]
    v = df["volume"]
    btc_c = btc_df["close"]

    c_s1 = float(c.iloc[t_1])
    b_s1 = float(btc_c.iloc[min(t_1, len(btc_c)-1)])

    rs_24 = float(((c_s1 / c.iloc[max(0, t_1 - 24)]) - 1.0) - ((b_s1 / btc_c.iloc[min(max(0, t_1 - 24), len(btc_c)-1)]) - 1.0))
    rs_72 = float(((c_s1 / c.iloc[max(0, t_1 - 72)]) - 1.0) - ((b_s1 / btc_c.iloc[min(max(0, t_1 - 72), len(btc_c)-1)]) - 1.0))
    rs_7d = float(((c_s1 / c.iloc[max(0, t_1 - 168)]) - 1.0) - ((b_s1 / btc_c.iloc[min(max(0, t_1 - 168), len(btc_c)-1)]) - 1.0))

    sub_v = v.iloc[max(0, t_1-20):t_1+1]
    v_mean = sub_v.mean()
    v_std = sub_v.std() if len(sub_v) > 1 and sub_v.std() > 0 else 1.0
    vol_zscore = float(np.clip((v.iloc[t_1] - v_mean) / v_std, -4.0, 4.0))

    sub_c = c.iloc[:t_1+1]
    rets = np.log(sub_c / sub_c.shift(1)).dropna()
    if len(rets) >= 20:
        ewma_var = (rets**2).ewm(alpha=0.06, adjust=False).mean().iloc[-1]
        ewma_vol = float(np.sqrt(max(0.0, ewma_var)))
        base_vol = rets.iloc[-min(720, len(rets)):].std()
        vol_ratio = float(np.clip(ewma_vol / max(1e-8, base_vol), 0.2, 5.0))
    else:
        vol_ratio = 1.0

    sub_h = h.iloc[max(0, t_1-14):t_1+1]
    sub_l = l.iloc[max(0, t_1-14):t_1+1]
    sub_pc = c.iloc[max(0, t_1-15):t_1]
    tr_list = [max(sub_h.iloc[k] - sub_l.iloc[k], abs(sub_h.iloc[k] - sub_pc.iloc[k-1]), abs(sub_l.iloc[k] - sub_pc.iloc[k-1])) for k in range(1, len(sub_h))]
    atr = (sum(tr_list) / len(tr_list)) if tr_list else (c_s1 * 0.01)
    atr_pct = float(np.clip(atr / c_s1, 0.002, 0.15))

    sub_highs = h.iloc[max(0, t_1-20):t_1]
    sub_lows = l.iloc[max(0, t_1-20):t_1]
    d_h = sub_highs.max() if len(sub_highs) > 0 else c_s1 * 1.01
    d_l = sub_lows.min() if len(sub_lows) > 0 else c_s1 * 0.99
    sma20 = float(c.iloc[max(0, t_1-20):t_1].mean())
    donchian_pos = float(np.clip((c_s1 - sma20) / max(1e-8, d_h - d_l), -2.0, 2.0))

    sma200 = float(sub_c.iloc[-min(200, len(sub_c)):].mean())
    trend_dist_200 = float(np.clip((c_s1 - sma200) / max(1e-8, sma200), -0.5, 0.5))

    return [rs_24, rs_72, rs_7d, 0.0, vol_zscore, vol_ratio, atr_pct, donchian_pos, trend_dist_200]


# Universal 10-feature vector (OHLCV based)
def compute_universal_10feats(df: pd.DataFrame, idx: int) -> List[float]:
    t_1 = idx - 1
    if t_1 < 50:
        return [0.0] * 10
    c = df["close"]
    h = df["high"]
    l = df["low"]
    v = df["volume"]
    c_s1 = float(c.iloc[t_1])

    sub_h = h.iloc[max(0, t_1-14):t_1+1]
    sub_l = l.iloc[max(0, t_1-14):t_1+1]
    sub_pc = c.iloc[max(0, t_1-15):t_1]
    tr_list = [max(sub_h.iloc[k] - sub_l.iloc[k], abs(sub_h.iloc[k] - sub_pc.iloc[k-1]), abs(sub_l.iloc[k] - sub_pc.iloc[k-1])) for k in range(1, len(sub_h))]
    atr = (sum(tr_list) / len(tr_list)) if tr_list else (c_s1 * 0.01)
    feat_atr_pct = float(np.clip(atr / c_s1, 0.001, 0.15))

    sub_v = v.iloc[max(0, t_1-20):t_1+1]
    v_mean = sub_v.mean()
    v_std = sub_v.std() if len(sub_v) > 1 and sub_v.std() > 0 else 1.0
    feat_vol_zscore = float(np.clip((v.iloc[t_1] - v_mean) / v_std, -4.0, 4.0))

    sub_c = c.iloc[:t_1+1]
    rets = np.log(sub_c / sub_c.shift(1)).dropna()
    if len(rets) >= 20:
        ewma_var = (rets**2).ewm(alpha=0.06, adjust=False).mean().iloc[-1]
        ewma_vol = float(np.sqrt(max(0.0, ewma_var)))
        roll_base = rets.iloc[-min(120, len(rets)):].std()
        feat_volatility_ratio = float(np.clip(ewma_vol / max(1e-8, roll_base), 0.2, 5.0))
    else:
        feat_volatility_ratio = 1.0

    sub_highs = h.iloc[max(0, t_1-20):t_1]
    sub_lows = l.iloc[max(0, t_1-20):t_1]
    d_h = sub_highs.max() if len(sub_highs) > 0 else c_s1 * 1.01
    d_l = sub_lows.min() if len(sub_lows) > 0 else c_s1 * 0.99
    sma20 = float(c.iloc[max(0, t_1-20):t_1].mean())
    feat_donchian_pos = float(np.clip((c_s1 - sma20) / max(1e-8, d_h - d_l), -2.0, 2.0))

    sma200 = float(sub_c.iloc[-min(200, len(sub_c)):].mean())
    feat_trend_dist_200 = float(np.clip((c_s1 - sma200) / max(1e-8, sma200), -0.5, 0.5))

    mom_24 = float((c_s1 - c.iloc[max(0, t_1-24)]) / c.iloc[max(0, t_1-24)])
    mom_72 = float((c_s1 - c.iloc[max(0, t_1-72)]) / c.iloc[max(0, t_1-72)])

    ema20 = float(sub_c.ewm(span=20, adjust=False).mean().iloc[-1])
    ema50 = float(sub_c.ewm(span=50, adjust=False).mean().iloc[-1])
    dist_ema_20 = float((c_s1 - ema20) / c_s1)
    dist_ema_50 = float((c_s1 - ema50) / c_s1)
    trend_aligned = 1.0 if c_s1 > sma200 else 0.0

    return [
        feat_atr_pct, feat_vol_zscore, feat_volatility_ratio,
        feat_donchian_pos, feat_trend_dist_200, mom_24, mom_72,
        dist_ema_20, dist_ema_50, trend_aligned
    ]


def run_backtest_on_candles(
    df: pd.DataFrame,
    symbol: str,
    asset_type: str,
    timeframe: str,
    model: Optional[Dict[str, Any]],
    model_type: str, # 'comm_1h', 'comm_4h', 'cryp_4h_14', 'cryp_9', 'unified', 'none'
    p_cutoff: float,
    benchmark_df: Optional[pd.DataFrame] = None
) -> List[Dict[str, Any]]:
    df = df.copy()
    c = df["close"]
    h = df["high"]
    l = df["low"]

    df["sma200"] = c.rolling(200, min_periods=30).mean()
    df["donch_h20"] = h.shift(1).rolling(20, min_periods=5).max()
    df["donch_l20"] = l.shift(1).rolling(20, min_periods=5).min()
    df["stop_l10"] = l.shift(1).rolling(10, min_periods=3).min()
    df["stop_h10"] = h.shift(1).rolling(10, min_periods=3).max()

    active_until = -1
    trades = []

    for i in range(len(df)):
        t = df["open_time"].iloc[i]
        if t < START_DATE_UTC or t > END_DATE_UTC:
            continue

        curr_c = float(c.iloc[i])
        sma200 = float(df["sma200"].iloc[i])
        donch_h = float(df["donch_h20"].iloc[i])
        donch_l = float(df["donch_l20"].iloc[i])

        if math.isnan(sma200) or math.isnan(donch_h) or math.isnan(donch_l):
            continue

        # AI gating
        if model is not None:
            if model_type == "comm_1h":
                feats = compute_comm_1h_features(df, benchmark_df, i)
            elif model_type == "comm_4h":
                feats = compute_comm_1h_features(df, benchmark_df, i)
            elif model_type == "cryp_4h_14":
                feats = compute_crypto_4h_14feats(df, benchmark_df, i)
            elif model_type == "cryp_9":
                feats = compute_crypto_9feats(df, benchmark_df, i)
            elif model_type == "unified":
                feats = compute_universal_10feats(df, i)
            else:
                feats = []
            prob = predict_tree_probability(model, feats)
            passes_gate = prob >= p_cutoff
        else:
            prob = 1.0
            passes_gate = True

        # Signal check
        is_long = curr_c > donch_h and curr_c > sma200
        is_short = curr_c < donch_l and curr_c < sma200 if asset_type == "commodities" else False

        if (is_long or is_short) and passes_gate:
            if i <= active_until:
                continue

            side = "LONG" if is_long else "SHORT"
            if side == "LONG":
                prev_10 = float(df["stop_l10"].iloc[i])
                raw_dist = max(curr_c - prev_10, curr_c * (0.010 if asset_type == "commodities" else 0.015))
                min_stop = 0.010 if asset_type == "commodities" else 0.015
                max_stop = 0.040 if asset_type == "commodities" else 0.060
                clamped_pct = max(min_stop, min(max_stop, raw_dist / curr_c))
                stop_dist = curr_c * clamped_pct
                sl = curr_c - stop_dist
                tp = curr_c + 2.5 * stop_dist
            else:
                prev_10 = float(df["stop_h10"].iloc[i])
                raw_dist = max(prev_10 - curr_c, curr_c * 0.010)
                clamped_pct = max(0.010, min(0.040, raw_dist / curr_c))
                stop_dist = curr_c * clamped_pct
                sl = curr_c + stop_dist
                tp = curr_c - 2.5 * stop_dist

            exit_type = "TIME"
            exit_price = curr_c
            bars_held = 0
            gross_r = 0.0

            for fwd in range(1, 13):
                if i + fwd >= len(df):
                    break
                bars_held = fwd
                bh = float(df["high"].iloc[i + fwd])
                bl = float(df["low"].iloc[i + fwd])
                bc = float(df["close"].iloc[i + fwd])

                if side == "LONG":
                    if bl <= sl and bh >= tp:
                        exit_type = "STOP"; exit_price = sl; gross_r = -1.0; break
                    elif bh >= tp:
                        exit_type = "TARGET"; exit_price = tp; gross_r = 2.5; break
                    elif bl <= sl:
                        exit_type = "STOP"; exit_price = sl; gross_r = -1.0; break
                    else:
                        exit_price = bc; gross_r = (bc - curr_c) / stop_dist
                else:
                    if bh >= sl and bl <= tp:
                        exit_type = "STOP"; exit_price = sl; gross_r = -1.0; break
                    elif bl <= tp:
                        exit_type = "TARGET"; exit_price = tp; gross_r = 2.5; break
                    elif bh >= sl:
                        exit_type = "STOP"; exit_price = sl; gross_r = -1.0; break
                    else:
                        exit_price = bc; gross_r = (curr_c - bc) / stop_dist

            active_until = i + bars_held
            friction = (0.0005 if asset_type == "commodities" else 0.001144) / clamped_pct
            net_r = gross_r - friction
            exit_time = df["open_time"].iloc[min(i + bars_held, len(df)-1)]

            trades.append({
                "symbol": symbol,
                "side": side,
                "timeframe": timeframe,
                "entry_time": t.isoformat(),
                "exit_time": exit_time.isoformat(),
                "entry_price": round(curr_c, 4),
                "exit_price": round(exit_price, 4),
                "exit_type": exit_type,
                "bars_held": bars_held,
                "gross_r": round(gross_r, 3),
                "cost_r": round(friction, 4),
                "net_r": round(net_r, 3),
                "prob": round(prob, 4),
            })

    return trades


def main():
    print("Fetching live feeds...")
    gc_1h = fetch_yahoo_1h_klines("GC=F")
    si_1h = fetch_yahoo_1h_klines("SI=F")
    cl_1h = fetch_yahoo_1h_klines("CL=F")
    dxy_1h = fetch_yahoo_1h_klines("DX-Y.NYB")

    gc_4h = resample_to_4h(gc_1h)
    si_4h = resample_to_4h(si_1h)
    cl_4h = resample_to_4h(cl_1h)
    dxy_4h = resample_to_4h(dxy_1h)

    crypto_syms = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT"]
    c_1h = {s: fetch_binance_klines(s, "1h", 1000) for s in crypto_syms}
    c_4h = {s: fetch_binance_klines(s, "4h", 500) for s in crypto_syms}

    # Load all models
    def load_m(path):
        with open(path / "model.json") as f:
            m = json.load(f)
        with open(path / "metadata.json") as f:
            meta = json.load(f)
        return m, meta

    m_comm_1h, meta_comm_1h = load_m(MODELS_DIR / "swing_1h_commodities")
    m_comm_4h, meta_comm_4h = load_m(MODELS_DIR / "swing_4h_commodities")
    m_cryp_1h, meta_cryp_1h = load_m(MODELS_DIR / "swing_1h_crypto")
    m_cryp_4h, meta_cryp_4h = load_m(MODELS_DIR / "swing_4h_crypto")
    m_cryp_4h_14, meta_cryp_4h_14 = load_m(MODELS_DIR / "swing_4h")
    m_uni_1h, meta_uni_1h = load_m(MODELS_DIR / "unified_1h_7assets")
    m_uni_4h, meta_uni_4h = load_m(MODELS_DIR / "unified_4h_7assets")

    p_comm_1h = meta_comm_1h.get("p_cutoff", 0.0425)
    p_comm_4h = meta_comm_4h.get("p_cutoff", 0.0186)
    p_cryp_1h = meta_cryp_1h.get("p_cutoff", 0.18)
    p_cryp_4h = meta_cryp_4h.get("p_cutoff", 0.05)
    p_cryp_4h_14 = meta_cryp_4h_14.get("p_cutoff", 0.10)
    p_uni_1h = meta_uni_1h.get("p_cutoff", meta_uni_1h.get("calibrated_threshold", 0.075))
    p_uni_4h = meta_uni_4h.get("p_cutoff", meta_uni_4h.get("calibrated_threshold", 0.085))

    print("\n" + "="*70)
    print("CONFIG 1: PRIMARY ACTIVE LIVE HYBRID (1H COMMODITIES + 4H CRYPTO)")
    print("="*70)
    t1_gc = run_backtest_on_candles(gc_1h, "Gold (XAUUSDT)", "commodities", "1h", m_comm_1h, "comm_1h", p_comm_1h, dxy_1h)
    t1_si = run_backtest_on_candles(si_1h, "Silver (XAGUSDT)", "commodities", "1h", m_comm_1h, "comm_1h", p_comm_1h, dxy_1h)
    t1_cl = run_backtest_on_candles(cl_1h, "Crude Oil (CLUSDT)", "commodities", "1h", m_comm_1h, "comm_1h", p_comm_1h, dxy_1h)
    t1_btc = run_backtest_on_candles(c_4h["BTCUSDT"], "BTCUSDT", "crypto", "4h", m_cryp_4h_14, "cryp_4h_14", p_cryp_4h_14, c_4h["BTCUSDT"])
    t1_eth = run_backtest_on_candles(c_4h["ETHUSDT"], "ETHUSDT", "crypto", "4h", m_cryp_4h_14, "cryp_4h_14", p_cryp_4h_14, c_4h["BTCUSDT"])
    t1_sol = run_backtest_on_candles(c_4h["SOLUSDT"], "SOLUSDT", "crypto", "4h", m_cryp_4h_14, "cryp_4h_14", p_cryp_4h_14, c_4h["BTCUSDT"])
    t1_dot = run_backtest_on_candles(c_4h["DOTUSDT"], "DOTUSDT", "crypto", "4h", m_cryp_4h_14, "cryp_4h_14", p_cryp_4h_14, c_4h["BTCUSDT"])

    hybrid_counts = {
        "Gold (XAUUSDT)": len(t1_gc),
        "Silver (XAGUSDT)": len(t1_si),
        "Crude Oil (CLUSDT)": len(t1_cl),
        "BTCUSDT": len(t1_btc),
        "ETHUSDT": len(t1_eth),
        "SOLUSDT": len(t1_sol),
        "DOTUSDT": len(t1_dot),
    }
    for k, v in hybrid_counts.items():
        print(f"  {k:<22}: {v} trades")
    print(f"  TOTAL HYBRID          : {sum(hybrid_counts.values())} trades")

    print("\n" + "="*70)
    print("CONFIG 2: STRICT 1-HOUR (1H) ON ALL 7 ASSETS (DEDICATED 1H MODELS)")
    print("="*70)
    t2_gc = run_backtest_on_candles(gc_1h, "Gold (XAUUSDT)", "commodities", "1h", m_comm_1h, "comm_1h", p_comm_1h, dxy_1h)
    t2_si = run_backtest_on_candles(si_1h, "Silver (XAGUSDT)", "commodities", "1h", m_comm_1h, "comm_1h", p_comm_1h, dxy_1h)
    t2_cl = run_backtest_on_candles(cl_1h, "Crude Oil (CLUSDT)", "commodities", "1h", m_comm_1h, "comm_1h", p_comm_1h, dxy_1h)
    t2_btc = run_backtest_on_candles(c_1h["BTCUSDT"], "BTCUSDT", "crypto", "1h", m_cryp_1h, "cryp_9", p_cryp_1h, c_1h["BTCUSDT"])
    t2_eth = run_backtest_on_candles(c_1h["ETHUSDT"], "ETHUSDT", "crypto", "1h", m_cryp_1h, "cryp_9", p_cryp_1h, c_1h["BTCUSDT"])
    t2_sol = run_backtest_on_candles(c_1h["SOLUSDT"], "SOLUSDT", "crypto", "1h", m_cryp_1h, "cryp_9", p_cryp_1h, c_1h["BTCUSDT"])
    t2_dot = run_backtest_on_candles(c_1h["DOTUSDT"], "DOTUSDT", "crypto", "1h", m_cryp_1h, "cryp_9", p_cryp_1h, c_1h["BTCUSDT"])

    c1h_counts = {
        "Gold (XAUUSDT)": len(t2_gc),
        "Silver (XAGUSDT)": len(t2_si),
        "Crude Oil (CLUSDT)": len(t2_cl),
        "BTCUSDT": len(t2_btc),
        "ETHUSDT": len(t2_eth),
        "SOLUSDT": len(t2_sol),
        "DOTUSDT": len(t2_dot),
    }
    for k, v in c1h_counts.items():
        print(f"  {k:<22}: {v} trades")
    print(f"  TOTAL 1H DEDICATED    : {sum(c1h_counts.values())} trades")

    print("\n" + "="*70)
    print("CONFIG 3: STRICT 4-HOUR (4H) ON ALL 7 ASSETS (DEDICATED 4H MODELS)")
    print("="*70)
    t3_gc = run_backtest_on_candles(gc_4h, "Gold (XAUUSDT)", "commodities", "4h", m_comm_4h, "comm_4h", p_comm_4h, dxy_4h)
    t3_si = run_backtest_on_candles(si_4h, "Silver (XAGUSDT)", "commodities", "4h", m_comm_4h, "comm_4h", p_comm_4h, dxy_4h)
    t3_cl = run_backtest_on_candles(cl_4h, "Crude Oil (CLUSDT)", "commodities", "4h", m_comm_4h, "comm_4h", p_comm_4h, dxy_4h)
    t3_btc = run_backtest_on_candles(c_4h["BTCUSDT"], "BTCUSDT", "crypto", "4h", m_cryp_4h_14, "cryp_4h_14", p_cryp_4h_14, c_4h["BTCUSDT"])
    t3_eth = run_backtest_on_candles(c_4h["ETHUSDT"], "ETHUSDT", "crypto", "4h", m_cryp_4h_14, "cryp_4h_14", p_cryp_4h_14, c_4h["BTCUSDT"])
    t3_sol = run_backtest_on_candles(c_4h["SOLUSDT"], "SOLUSDT", "crypto", "4h", m_cryp_4h_14, "cryp_4h_14", p_cryp_4h_14, c_4h["BTCUSDT"])
    t3_dot = run_backtest_on_candles(c_4h["DOTUSDT"], "DOTUSDT", "crypto", "4h", m_cryp_4h_14, "cryp_4h_14", p_cryp_4h_14, c_4h["BTCUSDT"])

    c4h_counts = {
        "Gold (XAUUSDT)": len(t3_gc),
        "Silver (XAGUSDT)": len(t3_si),
        "Crude Oil (CLUSDT)": len(t3_cl),
        "BTCUSDT": len(t3_btc),
        "ETHUSDT": len(t3_eth),
        "SOLUSDT": len(t3_sol),
        "DOTUSDT": len(t3_dot),
    }
    for k, v in c4h_counts.items():
        print(f"  {k:<22}: {v} trades")
    print(f"  TOTAL 4H DEDICATED    : {sum(c4h_counts.values())} trades")

    print("\n" + "="*70)
    print("CONFIG 4: UNIFIED 7-ASSET META-MODEL (1H TIME-FRAME)")
    print("="*70)
    u1_gc = run_backtest_on_candles(gc_1h, "Gold (XAUUSDT)", "commodities", "1h", m_uni_1h, "unified", p_uni_1h)
    u1_si = run_backtest_on_candles(si_1h, "Silver (XAGUSDT)", "commodities", "1h", m_uni_1h, "unified", p_uni_1h)
    u1_cl = run_backtest_on_candles(cl_1h, "Crude Oil (CLUSDT)", "commodities", "1h", m_uni_1h, "unified", p_uni_1h)
    u1_btc = run_backtest_on_candles(c_1h["BTCUSDT"], "BTCUSDT", "crypto", "1h", m_uni_1h, "unified", p_uni_1h)
    u1_eth = run_backtest_on_candles(c_1h["ETHUSDT"], "ETHUSDT", "crypto", "1h", m_uni_1h, "unified", p_uni_1h)
    u1_sol = run_backtest_on_candles(c_1h["SOLUSDT"], "SOLUSDT", "crypto", "1h", m_uni_1h, "unified", p_uni_1h)
    u1_dot = run_backtest_on_candles(c_1h["DOTUSDT"], "DOTUSDT", "crypto", "1h", m_uni_1h, "unified", p_uni_1h)

    u1_counts = {
        "Gold (XAUUSDT)": len(u1_gc),
        "Silver (XAGUSDT)": len(u1_si),
        "Crude Oil (CLUSDT)": len(u1_cl),
        "BTCUSDT": len(u1_btc),
        "ETHUSDT": len(u1_eth),
        "SOLUSDT": len(u1_sol),
        "DOTUSDT": len(u1_dot),
    }
    for k, v in u1_counts.items():
        print(f"  {k:<22}: {v} trades")
    print(f"  TOTAL UNIFIED 1H      : {sum(u1_counts.values())} trades")

    print("\n" + "="*70)
    print("CONFIG 5: UNIFIED 7-ASSET META-MODEL (4H TIME-FRAME)")
    print("="*70)
    u4_gc = run_backtest_on_candles(gc_4h, "Gold (XAUUSDT)", "commodities", "4h", m_uni_4h, "unified", p_uni_4h)
    u4_si = run_backtest_on_candles(si_4h, "Silver (XAGUSDT)", "commodities", "4h", m_uni_4h, "unified", p_uni_4h)
    u4_cl = run_backtest_on_candles(cl_4h, "Crude Oil (CLUSDT)", "commodities", "4h", m_uni_4h, "unified", p_uni_4h)
    u4_btc = run_backtest_on_candles(c_4h["BTCUSDT"], "BTCUSDT", "crypto", "4h", m_uni_4h, "unified", p_uni_4h)
    u4_eth = run_backtest_on_candles(c_4h["ETHUSDT"], "ETHUSDT", "crypto", "4h", m_uni_4h, "unified", p_uni_4h)
    u4_sol = run_backtest_on_candles(c_4h["SOLUSDT"], "SOLUSDT", "crypto", "4h", m_uni_4h, "unified", p_uni_4h)
    u4_dot = run_backtest_on_candles(c_4h["DOTUSDT"], "DOTUSDT", "crypto", "4h", m_uni_4h, "unified", p_uni_4h)

    u4_counts = {
        "Gold (XAUUSDT)": len(u4_gc),
        "Silver (XAGUSDT)": len(u4_si),
        "Crude Oil (CLUSDT)": len(u4_cl),
        "BTCUSDT": len(u4_btc),
        "ETHUSDT": len(u4_eth),
        "SOLUSDT": len(u4_sol),
        "DOTUSDT": len(u4_dot),
    }
    for k, v in u4_counts.items():
        print(f"  {k:<22}: {v} trades")
    print(f"  TOTAL UNIFIED 4H      : {sum(u4_counts.values())} trades")

    print("\n" + "="*70)
    print("CONFIG 6: PURE RULE-BASED ENGINE (NO AI) 1-HOUR")
    print("="*70)
    r1_gc = run_backtest_on_candles(gc_1h, "Gold (XAUUSDT)", "commodities", "1h", None, "none", 0.0)
    r1_si = run_backtest_on_candles(si_1h, "Silver (XAGUSDT)", "commodities", "1h", None, "none", 0.0)
    r1_cl = run_backtest_on_candles(cl_1h, "Crude Oil (CLUSDT)", "commodities", "1h", None, "none", 0.0)
    r1_btc = run_backtest_on_candles(c_1h["BTCUSDT"], "BTCUSDT", "crypto", "1h", None, "none", 0.0)
    r1_eth = run_backtest_on_candles(c_1h["ETHUSDT"], "ETHUSDT", "crypto", "1h", None, "none", 0.0)
    r1_sol = run_backtest_on_candles(c_1h["SOLUSDT"], "SOLUSDT", "crypto", "1h", None, "none", 0.0)
    r1_dot = run_backtest_on_candles(c_1h["DOTUSDT"], "DOTUSDT", "crypto", "1h", None, "none", 0.0)

    r1_counts = {
        "Gold (XAUUSDT)": len(r1_gc),
        "Silver (XAGUSDT)": len(r1_si),
        "Crude Oil (CLUSDT)": len(r1_cl),
        "BTCUSDT": len(r1_btc),
        "ETHUSDT": len(r1_eth),
        "SOLUSDT": len(r1_sol),
        "DOTUSDT": len(r1_dot),
    }
    for k, v in r1_counts.items():
        print(f"  {k:<22}: {v} trades")
    print(f"  TOTAL RULES 1H        : {sum(r1_counts.values())} trades")

    print("\n" + "="*70)
    print("CONFIG 7: PURE RULE-BASED ENGINE (NO AI) 4-HOUR")
    print("="*70)
    r4_gc = run_backtest_on_candles(gc_4h, "Gold (XAUUSDT)", "commodities", "4h", None, "none", 0.0)
    r4_si = run_backtest_on_candles(si_4h, "Silver (XAGUSDT)", "commodities", "4h", None, "none", 0.0)
    r4_cl = run_backtest_on_candles(cl_4h, "Crude Oil (CLUSDT)", "commodities", "4h", None, "none", 0.0)
    r4_btc = run_backtest_on_candles(c_4h["BTCUSDT"], "BTCUSDT", "crypto", "4h", None, "none", 0.0)
    r4_eth = run_backtest_on_candles(c_4h["ETHUSDT"], "ETHUSDT", "crypto", "4h", None, "none", 0.0)
    r4_sol = run_backtest_on_candles(c_4h["SOLUSDT"], "SOLUSDT", "crypto", "4h", None, "none", 0.0)
    r4_dot = run_backtest_on_candles(c_4h["DOTUSDT"], "DOTUSDT", "crypto", "4h", None, "none", 0.0)

    r4_counts = {
        "Gold (XAUUSDT)": len(r4_gc),
        "Silver (XAGUSDT)": len(r4_si),
        "Crude Oil (CLUSDT)": len(r4_cl),
        "BTCUSDT": len(r4_btc),
        "ETHUSDT": len(r4_eth),
        "SOLUSDT": len(r4_sol),
        "DOTUSDT": len(r4_dot),
    }
    for k, v in r4_counts.items():
        print(f"  {k:<22}: {v} trades")
    print(f"  TOTAL RULES 4H        : {sum(r4_counts.values())} trades")


if __name__ == "__main__":
    main()
