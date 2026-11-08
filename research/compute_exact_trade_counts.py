#!/usr/bin/env python3
"""
Deterministic Live Bar-by-Bar Computation: 1H vs 4H on all 7 assets
Window: 2026-10-21 00:00:00 UTC to 2026-11-07 23:59:59 UTC
Strict Rules:
- Zero lookahead bias
- 1-position-per-asset lock
- Real raw candle feeds
- Tree inference evaluated directly from JSON tree structures
"""

import os
import sys
import json
import math
import time
import datetime
import urllib.request
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional

import numpy as np
import pandas as pd
import yfinance as yf

# Windows UTF-8 fix
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

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


def fetch_binance_klines(symbol: str, interval: str = "1h", limit: int = 1000) -> pd.DataFrame:
    url = f"https://fapi.binance.com/fapi/v1/klines?symbol={symbol}&interval={interval}&limit={limit}"
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


def fetch_yahoo_1h_klines(symbol: str) -> pd.DataFrame:
    raw = yf.download(symbol, start="2026-09-01", end="2026-11-08", interval="1h", progress=False)
    if raw.empty:
        raise ValueError(f"No data for {symbol}")
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


def resample_1h_to_4h(df_1h: pd.DataFrame) -> pd.DataFrame:
    df = df_1h.copy().set_index("open_time")
    agg_rules = {
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum",
        "ot": "first"
    }
    df_4h = df.resample("4h").agg(agg_rules).dropna().reset_index()
    return df_4h


# Feature computation for commodities (1H and 4H)
def compute_comm_features(df: pd.DataFrame, dxy_df: pd.DataFrame, idx: int) -> List[float]:
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

    return [
        dxy_mom_24, dxy_mom_72, dxy_corr_60, vol_zscore,
        vol_ratio, atr_pct, donchian_pos, trend_dist_200
    ]


# Feature computation for crypto (1H and 4H)
def compute_crypto_features(df: pd.DataFrame, btc_df: pd.DataFrame, idx: int) -> List[float]:
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

    i_24 = max(0, t_1 - 24)
    i_72 = max(0, t_1 - 72)
    i_168 = max(0, t_1 - 168)

    rs_24 = float(((c_s1 / c.iloc[i_24]) - 1.0) - ((b_s1 / btc_c.iloc[min(i_24, len(btc_c)-1)]) - 1.0))
    rs_72 = float(((c_s1 / c.iloc[i_72]) - 1.0) - ((b_s1 / btc_c.iloc[min(i_72, len(btc_c)-1)]) - 1.0))
    rs_7d = float(((c_s1 / c.iloc[i_168]) - 1.0) - ((b_s1 / btc_c.iloc[min(i_168, len(btc_c)-1)]) - 1.0))

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

    return [
        rs_24, rs_72, rs_7d, 0.0, vol_zscore,
        vol_ratio, atr_pct, donchian_pos, trend_dist_200
    ]


def simulate_asset(
    df: pd.DataFrame,
    symbol: str,
    asset_type: str,
    timeframe: str,
    model: Optional[Dict[str, Any]],
    p_cutoff: float,
    benchmark_df: pd.DataFrame
) -> List[Dict[str, Any]]:
    # Indicators
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

        # AI gating or rule-based
        if model is not None:
            if asset_type == "commodities":
                feats = compute_comm_features(df, benchmark_df, i)
            else:
                feats = compute_crypto_features(df, benchmark_df, i)
            prob = predict_tree_probability(model, feats)
            passes_gate = prob >= p_cutoff
        else:
            prob = 1.0
            passes_gate = True

        # Signals:
        # Commodities allow Long (Breakout > 200 SMA) and Short (Breakdown < 200 SMA)
        # Crypto allows Long (Breakout > 200 SMA)
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

            # Forward hold up to 12 bars
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
    print("=" * 80)
    print("DETERMINISTIC BAR-BY-BAR COMPUTATION (OCT 21 - NOV 7, 2026)")
    print("Universe: 7 Assets (Gold, Silver, Crude Oil, BTC, ETH, SOL, DOT)")
    print("Zero JSON Reading — 100% Calculated From Live Candles")
    print("=" * 80)

    # 1. Download live market data
    print("\n[1] Fetching live 1H and 4H market feeds...")
    # Commodities 1H
    gc_1h = fetch_yahoo_1h_klines("GC=F")
    si_1h = fetch_yahoo_1h_klines("SI=F")
    cl_1h = fetch_yahoo_1h_klines("CL=F")
    dxy_1h = fetch_yahoo_1h_klines("DX-Y.NYB")

    # Commodities 4H (resampled)
    gc_4h = resample_1h_to_4h(gc_1h)
    si_4h = resample_1h_to_4h(si_1h)
    cl_4h = resample_1h_to_4h(cl_1h)
    dxy_4h = resample_1h_to_4h(dxy_1h)

    # Crypto 1H & 4H
    crypto_symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT"]
    c_1h = {s: fetch_binance_klines(s, "1h", 1000) for s in crypto_symbols}
    c_4h = {s: fetch_binance_klines(s, "4h", 500) for s in crypto_symbols}

    print("Data download complete.")

    # 2. Load models
    with open(MODELS_DIR / "swing_1h_commodities" / "model.json") as f:
        m_comm_1h = json.load(f)
    with open(MODELS_DIR / "swing_1h_commodities" / "metadata.json") as f:
        meta_comm_1h = json.load(f)

    with open(MODELS_DIR / "swing_4h_commodities" / "model.json") as f:
        m_comm_4h = json.load(f)
    with open(MODELS_DIR / "swing_4h_commodities" / "metadata.json") as f:
        meta_comm_4h = json.load(f)

    with open(MODELS_DIR / "swing_1h_crypto" / "model.json") as f:
        m_cryp_1h = json.load(f)
    with open(MODELS_DIR / "swing_1h_crypto" / "metadata.json") as f:
        meta_cryp_1h = json.load(f)

    with open(MODELS_DIR / "swing_4h_crypto" / "model.json") as f:
        m_cryp_4h = json.load(f)
    with open(MODELS_DIR / "swing_4h_crypto" / "metadata.json") as f:
        meta_cryp_4h = json.load(f)

    # 3. COMPUTE 1-HOUR MODEL ACROSS ALL 7 ASSETS
    print("\n" + "=" * 80)
    print("COMPUTING 1-HOUR (1H) TRADES FOR ALL 7 ASSETS (OCT 21 - NOV 7)")
    print("=" * 80)
    t_gc_1h = simulate_asset(gc_1h, "Gold (XAUUSDT / GC=F)", "commodities", "1H", m_comm_1h, meta_comm_1h["p_cutoff"], dxy_1h)
    t_si_1h = simulate_asset(si_1h, "Silver (XAGUSDT / SI=F)", "commodities", "1H", m_comm_1h, meta_comm_1h["p_cutoff"], dxy_1h)
    t_cl_1h = simulate_asset(cl_1h, "Crude Oil (CLUSDT / CL=F)", "commodities", "1H", m_comm_1h, meta_comm_1h["p_cutoff"], dxy_1h)
    t_btc_1h = simulate_asset(c_1h["BTCUSDT"], "BTCUSDT", "crypto", "1H", m_cryp_1h, meta_cryp_1h.get("p_cutoff", 0.18), c_1h["BTCUSDT"])
    t_eth_1h = simulate_asset(c_1h["ETHUSDT"], "ETHUSDT", "crypto", "1H", m_cryp_1h, meta_cryp_1h.get("p_cutoff", 0.18), c_1h["BTCUSDT"])
    t_sol_1h = simulate_asset(c_1h["SOLUSDT"], "SOLUSDT", "crypto", "1H", m_cryp_1h, meta_cryp_1h.get("p_cutoff", 0.18), c_1h["BTCUSDT"])
    t_dot_1h = simulate_asset(c_1h["DOTUSDT"], "DOTUSDT", "crypto", "1H", m_cryp_1h, meta_cryp_1h.get("p_cutoff", 0.18), c_1h["BTCUSDT"])

    all_1h = {
        "Gold (XAUUSDT)": t_gc_1h,
        "Silver (XAGUSDT)": t_si_1h,
        "Crude Oil (CLUSDT)": t_cl_1h,
        "BTCUSDT": t_btc_1h,
        "ETHUSDT": t_eth_1h,
        "SOLUSDT": t_sol_1h,
        "DOTUSDT": t_dot_1h,
    }

    tot_1h = 0
    for sym, trs in all_1h.items():
        wins = sum(1 for t in trs if t["net_r"] > 0)
        losses = sum(1 for t in trs if t["net_r"] <= 0)
        net_r = sum(t["net_r"] for t in trs)
        print(f"  {sym:<25} : {len(trs):>2} Trades ({wins}W / {losses}L, Net: {net_r:+.2f}R)")
        tot_1h += len(trs)
    print(f"  {'TOTAL 1H TRADES':<25} : {tot_1h:>2} Trades")

    # 4. COMPUTE 4-HOUR MODEL ACROSS ALL 7 ASSETS
    print("\n" + "=" * 80)
    print("COMPUTING 4-HOUR (4H) TRADES FOR ALL 7 ASSETS (OCT 21 - NOV 7)")
    print("=" * 80)
    t_gc_4h = simulate_asset(gc_4h, "Gold (XAUUSDT / GC=F)", "commodities", "4H", m_comm_4h, meta_comm_4h["p_cutoff"], dxy_4h)
    t_si_4h = simulate_asset(si_4h, "Silver (XAGUSDT / SI=F)", "commodities", "4H", m_comm_4h, meta_comm_4h["p_cutoff"], dxy_4h)
    t_cl_4h = simulate_asset(cl_4h, "Crude Oil (CLUSDT / CL=F)", "commodities", "4H", m_comm_4h, meta_comm_4h["p_cutoff"], dxy_4h)
    t_btc_4h = simulate_asset(c_4h["BTCUSDT"], "BTCUSDT", "crypto", "4H", m_cryp_4h, meta_cryp_4h.get("p_cutoff", 0.05), c_4h["BTCUSDT"])
    t_eth_4h = simulate_asset(c_4h["ETHUSDT"], "ETHUSDT", "crypto", "4H", m_cryp_4h, meta_cryp_4h.get("p_cutoff", 0.05), c_4h["BTCUSDT"])
    t_sol_4h = simulate_asset(c_4h["SOLUSDT"], "SOLUSDT", "crypto", "4H", m_cryp_4h, meta_cryp_4h.get("p_cutoff", 0.05), c_4h["BTCUSDT"])
    t_dot_4h = simulate_asset(c_4h["DOTUSDT"], "DOTUSDT", "crypto", "4H", m_cryp_4h, meta_cryp_4h.get("p_cutoff", 0.05), c_4h["BTCUSDT"])

    all_4h = {
        "Gold (XAUUSDT)": t_gc_4h,
        "Silver (XAGUSDT)": t_si_4h,
        "Crude Oil (CLUSDT)": t_cl_4h,
        "BTCUSDT": t_btc_4h,
        "ETHUSDT": t_eth_4h,
        "SOLUSDT": t_sol_4h,
        "DOTUSDT": t_dot_4h,
    }

    tot_4h = 0
    for sym, trs in all_4h.items():
        wins = sum(1 for t in trs if t["net_r"] > 0)
        losses = sum(1 for t in trs if t["net_r"] <= 0)
        net_r = sum(t["net_r"] for t in trs)
        print(f"  {sym:<25} : {len(trs):>2} Trades ({wins}W / {losses}L, Net: {net_r:+.2f}R)")
        tot_4h += len(trs)
    print(f"  {'TOTAL 4H TRADES':<25} : {tot_4h:>2} Trades")

    # 5. PURE RULES BASELINE (NO AI) ACROSS ALL 7 ASSETS
    print("\n" + "=" * 80)
    print("COMPUTING PURE RULES BASELINE (NO AI) ON 1H FOR ALL 7 ASSETS")
    print("=" * 80)
    r_gc = simulate_asset(gc_1h, "Gold (XAUUSDT)", "commodities", "1H", None, 0.0, dxy_1h)
    r_si = simulate_asset(si_1h, "Silver (XAGUSDT)", "commodities", "1H", None, 0.0, dxy_1h)
    r_cl = simulate_asset(cl_1h, "Crude Oil (CLUSDT)", "commodities", "1H", None, 0.0, dxy_1h)
    r_btc = simulate_asset(c_1h["BTCUSDT"], "BTCUSDT", "crypto", "1H", None, 0.0, c_1h["BTCUSDT"])
    r_eth = simulate_asset(c_1h["ETHUSDT"], "ETHUSDT", "crypto", "1H", None, 0.0, c_1h["BTCUSDT"])
    r_sol = simulate_asset(c_1h["SOLUSDT"], "SOLUSDT", "crypto", "1H", None, 0.0, c_1h["BTCUSDT"])
    r_dot = simulate_asset(c_1h["DOTUSDT"], "DOTUSDT", "crypto", "1H", None, 0.0, c_1h["BTCUSDT"])

    all_rules = {
        "Gold (XAUUSDT)": r_gc,
        "Silver (XAGUSDT)": r_si,
        "Crude Oil (CLUSDT)": r_cl,
        "BTCUSDT": r_btc,
        "ETHUSDT": r_eth,
        "SOLUSDT": r_sol,
        "DOTUSDT": r_dot,
    }
    tot_rules = 0
    for sym, trs in all_rules.items():
        wins = sum(1 for t in trs if t["net_r"] > 0)
        losses = sum(1 for t in trs if t["net_r"] <= 0)
        net_r = sum(t["net_r"] for t in trs)
        print(f"  {sym:<25} : {len(trs):>2} Trades ({wins}W / {losses}L, Net: {net_r:+.2f}R)")
        tot_rules += len(trs)
    print(f"  {'TOTAL RULES TRADES':<25} : {tot_rules:>2} Trades")

    # Save detailed trade execution logs for verification
    output_summary = {
        "calculated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "window": "2026-10-21 to 2026-11-07",
        "counts_1h": {sym: len(trs) for sym, trs in all_1h.items()},
        "total_1h": tot_1h,
        "counts_4h": {sym: len(trs) for sym, trs in all_4h.items()},
        "total_4h": tot_4h,
        "counts_rules_1h": {sym: len(trs) for sym, trs in all_rules.items()},
        "total_rules_1h": tot_rules,
        "detailed_trades_1h": all_1h,
        "detailed_trades_4h": all_4h,
    }
    with open("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/research/computed_live_window_trades.json", "w") as f:
        json.dump(output_summary, f, indent=2)
    print("\nSaved detailed execution log to research/computed_live_window_trades.json")

if __name__ == "__main__":
    main()
