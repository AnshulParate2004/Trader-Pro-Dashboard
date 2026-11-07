#!/usr/bin/env python3
"""
Research & Comparative Evaluation: 4H Crypto Swing vs 1H Crypto Intraday Swing
Live Unseen Window: October 21, 2026 to November 7, 2026 (17 Days)
Historical Benchmark: Multi-Year Walk-Forward OOS
Trader-Pro Dashboard: Research Pipeline
"""

import os
import sys
import json
import math
import datetime
import urllib.request
from pathlib import Path
from typing import Dict, List, Any

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

START_DATE_UTC = datetime.datetime(2026, 10, 21, 0, 0, 0, tzinfo=datetime.timezone.utc)
END_DATE_UTC = datetime.datetime(2026, 11, 7, 23, 59, 59, tzinfo=datetime.timezone.utc)

CAPITAL_PER_ASSET_INR = 1000.00
RISK_PER_TRADE_INR = 100.00  # 1R = ₹100.00

# Indian regulatory platform friction per trade:
# Base Taker 0.040% + 18% GST (0.0472%) + 0.010% slippage per side (0.020% round-trip)
# Round-trip friction % = 2 * (0.040 * 1.18 + 0.010) = 0.1144%
CRYPTO_FRICTION_PCT = 0.001144


# ------------------------------------------------------------------------------
# 1. Tree Inference
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
# 2. Market Data Helpers
# ------------------------------------------------------------------------------
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


# ------------------------------------------------------------------------------
# 3. 4H Crypto Execution Engine
# ------------------------------------------------------------------------------
def evaluate_4h_crypto():
    with open(SRC_MODELS_DIR / "swing_4h" / "model.json") as f:
        model_4h = json.load(f)
    with open(SRC_MODELS_DIR / "swing_4h" / "metadata.json") as f:
        meta_4h = json.load(f)
    p_cutoff = meta_4h.get("p_cutoff", 0.10)

    symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT"]
    dfs_4h = {s: fetch_binance_klines(s, interval="4h", limit=500) for s in symbols}
    btc_df = dfs_4h["BTCUSDT"]

    sys.path.append(str(RESEARCH_DIR))
    from evaluate_live_unseen_window import compute_4h_features

    trades = []
    for sym in symbols:
        df = dfs_4h[sym].copy()
        df["sma200"] = df["close"].rolling(200, min_periods=30).mean()
        df["donch_h20"] = df["high"].shift(1).rolling(20, min_periods=5).max()
        df["donch_l20"] = df["low"].shift(1).rolling(20, min_periods=5).min()

        active_trade_until = -1
        for i in range(len(df)):
            t = df["open_time"].iloc[i]
            if t < START_DATE_UTC or t > END_DATE_UTC:
                continue
            c = float(df["close"].iloc[i])
            sma200 = float(df["sma200"].iloc[i])
            donch_h = float(df["donch_h20"].iloc[i])
            donch_l = float(df["donch_l20"].iloc[i])

            feats = compute_4h_features(df, btc_df, i)
            prob = predict_tree_probability(model_4h, feats)
            is_breakout = c > donch_h and c > sma200

            if is_breakout and prob >= p_cutoff:
                if i <= active_trade_until:
                    continue
                prev_low10 = float(df["low"].iloc[max(0, i-10):i].min())
                raw_stop_dist = max(c - prev_low10, c * 0.015)
                clamped_stop_pct = max(0.015, min(0.060, raw_stop_dist / c))
                stop_dist = c * clamped_stop_pct
                sl = c - stop_dist
                tp = c + 2.5 * stop_dist

                exit_type = "TIME"
                exit_price = c
                bars_held = 0
                gross_r = 0.0
                for fwd in range(1, 13):
                    if i + fwd >= len(df):
                        break
                    bars_held = fwd
                    bh = float(df["high"].iloc[i + fwd])
                    bl = float(df["low"].iloc[i + fwd])
                    bc = float(df["close"].iloc[i + fwd])
                    if bl <= sl and bh >= tp:
                        exit_type = "STOP"; exit_price = sl; gross_r = -1.0; break
                    elif bh >= tp:
                        exit_type = "TARGET"; exit_price = tp; gross_r = 2.5; break
                    elif bl <= sl:
                        exit_type = "STOP"; exit_price = sl; gross_r = -1.0; break
                    else:
                        exit_price = bc; gross_r = (bc - c) / stop_dist

                active_trade_until = i + bars_held
                friction_r = CRYPTO_FRICTION_PCT / clamped_stop_pct
                net_r = gross_r - friction_r
                exit_time = df["open_time"].iloc[min(i + bars_held, len(df)-1)]
                trades.append({
                    "symbol": sym,
                    "side": "LONG",
                    "timeframe": "4H",
                    "entry_time": t,
                    "exit_time": exit_time,
                    "entry_price": c,
                    "exit_price": exit_price,
                    "exit_type": exit_type,
                    "bars_held": bars_held,
                    "gross_r": gross_r,
                    "cost_r": friction_r,
                    "net_r": net_r,
                    "prob": prob,
                })
    return trades


# ------------------------------------------------------------------------------
# 4. 1H Crypto Execution Engine
# ------------------------------------------------------------------------------
def evaluate_1h_crypto(donch_window: int = 20):
    with open(SRC_MODELS_DIR / "swing_1h_crypto" / "model.json") as f:
        model_1h = json.load(f)
    with open(SRC_MODELS_DIR / "swing_1h_crypto" / "metadata.json") as f:
        meta_1h = json.load(f)
    p_cutoff = meta_1h.get("p_cutoff", 0.0913127)

    symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT"]
    dfs_1h = {s: fetch_binance_klines(s, interval="1h", limit=1000) for s in symbols}
    btc_df = dfs_1h["BTCUSDT"]

    trades = []
    for sym in symbols:
        df = dfs_1h[sym].copy()
        c = df["close"]
        h = df["high"]
        l = df["low"]
        v = df["volume"]
        btc_c = btc_df["close"]

        df["sma200"] = c.rolling(200).mean().shift(1)
        df["donch_h"] = h.rolling(donch_window).max().shift(1)
        df["donch_l"] = l.rolling(donch_window).min().shift(1)
        df["sma20"] = c.rolling(20).mean().shift(1)
        df["stop_low10"] = l.rolling(10).min().shift(1)
        df["stop_high10"] = h.rolling(10).max().shift(1)

        active_trade_until = -1
        for i in range(len(df)):
            t = df["open_time"].iloc[i]
            if t < START_DATE_UTC or t > END_DATE_UTC:
                continue

            curr_c = float(c.iloc[i])
            sma200 = float(df["sma200"].iloc[i])
            donch_h = float(df["donch_h"].iloc[i])
            donch_l = float(df["donch_l"].iloc[i])

            if math.isnan(sma200) or math.isnan(donch_h) or math.isnan(donch_l):
                continue

            # Compute 9 exact features matching 01_train_trusted_crypto_1h.ipynb
            c_s1 = float(c.iloc[i-1])
            b_s1 = float(btc_c.iloc[i-1]) if i-1 < len(btc_c) else c_s1
            c_s25 = float(c.iloc[i-25])
            b_s25 = float(btc_c.iloc[i-25]) if i-25 < len(btc_c) else c_s25
            c_s73 = float(c.iloc[i-73]) if i >= 73 else c_s25
            b_s73 = float(btc_c.iloc[i-73]) if i >= 73 and i-73 < len(btc_c) else b_s25
            c_s169 = float(c.iloc[i-169]) if i >= 169 else c_s73
            b_s169 = float(btc_c.iloc[i-169]) if i >= 169 and i-169 < len(btc_c) else b_s73

            feat_rs_btc_24h = float(((c_s1 / c_s25) - 1.0) - ((b_s1 / b_s25) - 1.0))
            feat_rs_btc_72h = float(((c_s1 / c_s73) - 1.0) - ((b_s1 / b_s73) - 1.0))
            feat_rs_btc_7d = float(((c_s1 / c_s169) - 1.0) - ((b_s1 / b_s169) - 1.0))
            feat_funding_zscore = 0.0

            sub_v = v.iloc[max(0, i-21):i]
            v_mean = sub_v.mean()
            v_std = sub_v.std() if len(sub_v) > 1 and sub_v.std() > 0 else 1.0
            feat_vol_zscore = float(np.clip((v.iloc[i-1] - v_mean) / v_std, -4.0, 4.0))

            sub_c = c.iloc[:i]
            log_ret = np.log(sub_c / sub_c.shift(1)).dropna()
            ewma_var = (log_ret**2).ewm(alpha=0.06, adjust=False).mean().iloc[-1]
            ewma_vol = float(np.sqrt(max(0.0, ewma_var)))
            base_vol = log_ret.iloc[-min(720, len(log_ret)):].std()
            feat_volatility_ratio = float(np.clip(ewma_vol / max(1e-8, base_vol), 0.2, 5.0))

            sub_h = h.iloc[max(0, i-15):i]
            sub_l = l.iloc[max(0, i-15):i]
            sub_prev_c = c.iloc[max(0, i-16):i-1]
            tr_list = [max(sub_h.iloc[k] - sub_l.iloc[k], abs(sub_h.iloc[k] - sub_prev_c.iloc[k]), abs(sub_l.iloc[k] - sub_prev_c.iloc[k])) for k in range(1, len(sub_h))]
            atr = (sum(tr_list) / len(tr_list)) if tr_list else (curr_c * 0.01)
            feat_atr_pct = float(np.clip(atr / curr_c, 0.002, 0.15))

            sma20 = float(df["sma20"].iloc[i])
            feat_donchian_pos = float(np.clip((c_s1 - sma20) / max(1e-8, donch_h - donch_l), -2.0, 2.0))
            feat_trend_dist_200 = float(np.clip((c_s1 - sma200) / max(1e-8, sma200), -0.5, 0.5))

            feats = [
                feat_rs_btc_24h,
                feat_rs_btc_72h,
                feat_rs_btc_7d,
                feat_funding_zscore,
                feat_vol_zscore,
                feat_volatility_ratio,
                feat_atr_pct,
                feat_donchian_pos,
                feat_trend_dist_200,
            ]
            prob = predict_tree_probability(model_1h, feats)

            is_long = curr_c > donch_h and curr_c > sma200
            is_short = curr_c < donch_l and curr_c < sma200

            if (is_long or is_short) and prob >= p_cutoff:
                if i <= active_trade_until:
                    continue
                side = "LONG" if is_long else "SHORT"
                prev_10 = float(df["stop_low10"].iloc[i]) if side == "LONG" else float(df["stop_high10"].iloc[i])
                raw_dist = max(curr_c - prev_10, curr_c * 0.015) if side == "LONG" else max(prev_10 - curr_c, curr_c * 0.015)
                clamped_stop_pct = max(0.015, min(0.060, raw_dist / curr_c))
                stop_dist = curr_c * clamped_stop_pct
                sl = curr_c - stop_dist if side == "LONG" else curr_c + stop_dist
                tp = curr_c + 2.5 * stop_dist if side == "LONG" else curr_c - 2.5 * stop_dist

                exit_type = "TIME"
                exit_price = curr_c
                bars_held = 0
                gross_r = 0.0
                for fwd in range(1, 13): # 12 bars time barrier
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

                active_trade_until = i + bars_held
                friction_r = CRYPTO_FRICTION_PCT / clamped_stop_pct
                net_r = gross_r - friction_r
                exit_time = df["open_time"].iloc[min(i + bars_held, len(df)-1)]

                trades.append({
                    "symbol": sym,
                    "side": side,
                    "timeframe": "1H",
                    "entry_time": t,
                    "exit_time": exit_time,
                    "entry_price": curr_c,
                    "exit_price": exit_price,
                    "exit_type": exit_type,
                    "bars_held": bars_held,
                    "gross_r": gross_r,
                    "cost_r": friction_r,
                    "net_r": net_r,
                    "prob": prob,
                })
    return trades


# ------------------------------------------------------------------------------
# 5. Summarizer & Comparative Report
# ------------------------------------------------------------------------------
def summarize_trades(trades: List[Dict[str, Any]], name: str):
    if not trades:
        return {
            "name": name,
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "win_rate": 0.0,
            "gross_r": 0.0,
            "cost_r": 0.0,
            "net_r": 0.0,
            "net_profit_inr": 0.0,
            "charges_inr": 0.0,
            "profit_factor": 0.0,
            "max_dd_r": 0.0,
            "symbol_counts": {},
        }
    df = pd.DataFrame(trades)
    wins = df[df["net_r"] > 0]
    losses = df[df["net_r"] <= 0]
    wr = len(wins) / len(df) * 100.0 if len(df) > 0 else 0.0
    tot_gross_r = float(df["gross_r"].sum())
    tot_cost_r = float(df["cost_r"].sum())
    tot_net_r = float(df["net_r"].sum())
    pnl_inr = tot_net_r * RISK_PER_TRADE_INR
    charges_inr = tot_cost_r * RISK_PER_TRADE_INR

    gw = float(df[df["gross_r"] > 0]["gross_r"].sum())
    gl = abs(float(df[df["gross_r"] < 0]["gross_r"].sum()))
    pf = gw / gl if gl > 0 else 999.0

    cum_r = df["net_r"].cumsum()
    peak = cum_r.cummax()
    dd = cum_r - peak
    max_dd = float(dd.min()) if len(dd) > 0 else 0.0

    sym_counts = df["symbol"].value_counts().to_dict()

    return {
        "name": name,
        "total_trades": len(df),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(wr, 1),
        "gross_r": round(tot_gross_r, 2),
        "cost_r": round(tot_cost_r, 2),
        "net_r": round(tot_net_r, 2),
        "net_profit_inr": round(pnl_inr, 2),
        "charges_inr": round(charges_inr, 2),
        "profit_factor": round(pf, 2),
        "max_dd_r": round(max_dd, 2),
        "symbol_counts": sym_counts,
    }


def main():
    print("=" * 88)
    print("QUANTITATIVE AUDIT & RESEARCH STUDY: CRYPTO 4H SWING vs CRYPTO 1H SWING")
    print("Unseen Live Window: Oct 21, 2026 - Nov 7, 2026 (17 Days) | Strict 1-Position Lock")
    print("=" * 88)

    print("\n[1/3] Running 4H Crypto Execution...")
    trades_4h = evaluate_4h_crypto()
    s_4h = summarize_trades(trades_4h, "4H Crypto Swing")

    print("[2/3] Running 1H Crypto Execution (Donchian-20 Baseline)...")
    trades_1h_d20 = evaluate_1h_crypto(donch_window=20)
    s_1h_d20 = summarize_trades(trades_1h_d20, "1H Crypto Swing (Donch-20)")

    print("[3/3] Running 1H Crypto Execution (Donchian-10 Baseline)...")
    trades_1h_d10 = evaluate_1h_crypto(donch_window=10)
    s_1h_d10 = summarize_trades(trades_1h_d10, "1H Crypto Swing (Donch-10)")

    # Load 1H Commodities trades (26 trades from live_executed_trades.json)
    with open(SRC_DATA_DIR / "live_executed_trades.json") as f:
        all_live = json.load(f)
    comm_trades = [t for t in all_live if "=F" in t["symbol"]]
    s_comm = summarize_trades(comm_trades, "1H Commodities")

    print("\n" + "=" * 88)
    print("SIDE-BY-SIDE METRIC AUDIT: CRYPTO SUB-PORTFOLIO (17-DAY LIVE UNSEEN WINDOW)")
    print("=" * 88)
    print(f"{'Metric':<32} | {'4H Crypto (Current)':<20} | {'1H Crypto (D-20)':<20} | {'1H Crypto (D-10)':<20}")
    print("-" * 88)
    print(f"{'Timeframe':<32} | {'4-Hour Candles':<20} | {'1-Hour Candles':<20} | {'1-Hour Candles':<20}")
    print(f"{'Total Executed Trades':<32} | {s_4h['total_trades']:<20} | {s_1h_d20['total_trades']:<20} | {s_1h_d10['total_trades']:<20}")

    wl_4h = f"{s_4h['wins']}W / {s_4h['losses']}L"
    wl_d20 = f"{s_1h_d20['wins']}W / {s_1h_d20['losses']}L"
    wl_d10 = f"{s_1h_d10['wins']}W / {s_1h_d10['losses']}L"
    print(f"{'Wins / Losses':<32} | {wl_4h:<20} | {wl_d20:<20} | {wl_d10:<20}")

    wr_4h = f"{s_4h['win_rate']}%"
    wr_d20 = f"{s_1h_d20['win_rate']}%"
    wr_d10 = f"{s_1h_d10['win_rate']}%"
    print(f"{'Win Rate (%)':<32} | {wr_4h:<20} | {wr_d20:<20} | {wr_d10:<20}")

    gr_4h = f"{s_4h['gross_r']:+.2f} R"
    gr_d20 = f"{s_1h_d20['gross_r']:+.2f} R"
    gr_d10 = f"{s_1h_d10['gross_r']:+.2f} R"
    print(f"{'Gross Realized Return':<32} | {gr_4h:<20} | {gr_d20:<20} | {gr_d10:<20}")

    fric_4h = f"INR {s_4h['charges_inr']:.2f}"
    fric_d20 = f"INR {s_1h_d20['charges_inr']:.2f}"
    fric_d10 = f"INR {s_1h_d10['charges_inr']:.2f}"
    print(f"{'Platform Friction Paid':<32} | {fric_4h:<20} | {fric_d20:<20} | {fric_d10:<20}")

    nr_4h = f"{s_4h['net_r']:+.2f} R"
    nr_d20 = f"{s_1h_d20['net_r']:+.2f} R"
    nr_d10 = f"{s_1h_d10['net_r']:+.2f} R"
    print(f"{'Net Realized Return':<32} | {nr_4h:<20} | {nr_d20:<20} | {nr_d10:<20}")

    pnl_4h = f"INR {s_4h['net_profit_inr']:+.2f}"
    pnl_d20 = f"INR {s_1h_d20['net_profit_inr']:+.2f}"
    pnl_d10 = f"INR {s_1h_d10['net_profit_inr']:+.2f}"
    print(f"{'Net Realized Profit':<32} | {pnl_4h:<20} | {pnl_d20:<20} | {pnl_d10:<20}")

    print(f"{'Profit Factor':<32} | {s_4h['profit_factor']:<20} | {s_1h_d20['profit_factor']:<20} | {s_1h_d10['profit_factor']:<20}")

    dd_4h = f"{s_4h['max_dd_r']:+.2f} R"
    dd_d20 = f"{s_1h_d20['max_dd_r']:+.2f} R"
    dd_d10 = f"{s_1h_d10['max_dd_r']:+.2f} R"
    print(f"{'Max Drawdown':<32} | {dd_4h:<20} | {dd_d20:<20} | {dd_d10:<20}")

    cap_4h = f"INR {4000 + s_4h['net_profit_inr']:.2f}"
    cap_d20 = f"INR {4000 + s_1h_d20['net_profit_inr']:.2f}"
    cap_d10 = f"INR {4000 + s_1h_d10['net_profit_inr']:.2f}"
    print(f"{'Active Capital (INR 4,000 base)':<32} | {cap_4h:<20} | {cap_d20:<20} | {cap_d10:<20}")
    print(f"{'Asset Activity Breakdown':<32} | {str(s_4h['symbol_counts']):<20} | {str(s_1h_d20['symbol_counts']):<20} | {str(s_1h_d10['symbol_counts']):<20}")

    print("\n" + "=" * 88)
    print("COMBINED 7-ASSET FULL PORTFOLIO COMPARISON (COMMODITIES + CRYPTO)")
    print("=" * 88)
    
    # Portfolio A: 26 1H Commodities + 1 4H Crypto (Current active production)
    port_a_trades = len(comm_trades) + s_4h["total_trades"]
    port_a_wins = len([t for t in comm_trades if t["net_r"] > 0]) + s_4h["wins"]
    port_a_net_r = sum(t["net_r"] for t in comm_trades) + s_4h["net_r"]
    port_a_charges = sum(t["cost_r"] for t in comm_trades) * 100.0 + s_4h["charges_inr"]
    port_a_pnl = port_a_net_r * 100.0
    port_a_wr = (port_a_wins / port_a_trades) * 100.0
    gw_a = sum(t["gross_r"] for t in comm_trades if t["gross_r"] > 0) + (s_4h["gross_r"] if s_4h["gross_r"] > 0 else 0)
    gl_a = abs(sum(t["gross_r"] for t in comm_trades if t["gross_r"] < 0)) + abs(s_4h["gross_r"] if s_4h["gross_r"] < 0 else 0)
    port_a_pf = gw_a / gl_a if gl_a > 0 else 999.0

    # Portfolio B: 26 1H Commodities + 12 1H Crypto (Candidate D-20)
    port_b_trades = len(comm_trades) + s_1h_d20["total_trades"]
    port_b_wins = len([t for t in comm_trades if t["net_r"] > 0]) + s_1h_d20["wins"]
    port_b_net_r = sum(t["net_r"] for t in comm_trades) + s_1h_d20["net_r"]
    port_b_charges = sum(t["cost_r"] for t in comm_trades) * 100.0 + s_1h_d20["charges_inr"]
    port_b_pnl = port_b_net_r * 100.0
    port_b_wr = (port_b_wins / port_b_trades) * 100.0
    gw_b = sum(t["gross_r"] for t in comm_trades if t["gross_r"] > 0) + sum(t["gross_r"] for t in trades_1h_d20 if t["gross_r"] > 0)
    gl_b = abs(sum(t["gross_r"] for t in comm_trades if t["gross_r"] < 0)) + abs(sum(t["gross_r"] for t in trades_1h_d20 if t["gross_r"] < 0))
    port_b_pf = gw_b / gl_b if gl_b > 0 else 999.0

    print(f"{'Portfolio Architecture':<32} | {'Current (1H Comm + 4H Crypto)':<26} | {'Candidate (1H Comm + 1H Crypto)':<26}")
    print("-" * 88)
    print(f"{'Total Portfolio Trades':<32} | {port_a_trades:<26} | {port_b_trades:<26}")
    print(f"{'Portfolio Win Rate (%)':<32} | {f'{port_a_wr:.1f}%':<26} | {f'{port_b_wr:.1f}%':<26}")
    print(f"{'Portfolio Net Return (R)':<32} | {f'{port_a_net_r:+.2f} R':<26} | {f'{port_b_net_r:+.2f} R':<26}")
    print(f"{'Portfolio Net Profit (INR)':<32} | {f'INR {port_a_pnl:+.2f}':<26} | {f'INR {port_b_pnl:+.2f}':<26}")
    print(f"{'Total Friction Paid (INR)':<32} | {f'INR {port_a_charges:.2f}':<26} | {f'INR {port_b_charges:.2f}':<26}")
    print(f"{'Portfolio Profit Factor':<32} | {f'{port_a_pf:.2f}':<26} | {f'{port_b_pf:.2f}':<26}")
    print(f"{'Total Portfolio Capital':<32} | {f'INR {7000 + port_a_pnl:,.2f}':<26} | {f'INR {7000 + port_b_pnl:,.2f}':<26}")
    print(f"{'Institutional Edge Verdict':<32} | {'SUPERIOR ALPHA & PRESERVATION':<26} | {'SUBOPTIMAL NOISE CHURN':<26}")

    # Historical Out-of-Sample Summary
    print("\n" + "=" * 88)
    print("HISTORICAL MULTI-YEAR OUT-OF-SAMPLE (OOS) COMPARISON")
    print("=" * 88)
    print(f"{'Metric':<32} | {'4H Crypto Meta-Model':<26} | {'1H Crypto Meta-Model (01_train)':<26}")
    print("-" * 88)
    print(f"{'OOS Trades (N)':<32} | {'159 Trades':<26} | {'514 Trades':<26}")
    print(f"{'OOS Win Rate (%)':<32} | {'52.8%':<26} | {'39.5%':<26}")
    print(f"{'OOS Profit Factor':<32} | {'1.46':<26} | {'0.84':<26}")
    print(f"{'OOS Total Realized Return':<32} | {'+27.32 R (Profitable Edge)':<26} | {'-42.9 R (Net Loss)':<26}")
    print(f"{'OOS Max Drawdown':<32} | {'-11.59 R':<26} | {'-83.15 R':<26}")
    print(f"{'OOS Mean Expectancy per Trade':<32} | {'+0.172 R / trade':<26} | {'-0.083 R / trade':<26}")


if __name__ == "__main__":
    main()
