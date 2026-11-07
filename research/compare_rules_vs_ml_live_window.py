#!/usr/bin/env python3
"""
Comparative Audit: Pure Rule Engine vs ML Meta-Classifier in the Live Unseen Window
Window: October 21, 2026 to November 7, 2026
Universe: 4H Crypto (BTC, ETH, SOL, DOT) & 1H Commodities (Gold, Silver, Crude Oil)
"""

import os
import sys
import json
import math
import time
import datetime
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

sys.path.append(str(RESEARCH_DIR))
from evaluate_live_unseen_window import (
    START_DATE_UTC,
    END_DATE_UTC,
    fetch_binance_4h_klines,
    fetch_yahoo_1h_klines,
    compute_4h_features,
    compute_1h_commodities_features,
    predict_tree_probability,
)

# Capital & Friction Configuration
CAPITAL_PER_ASSET_INR = 1000.00
RISK_PER_TRADE_INR = 100.00  # 1R = ₹100.00
CRYPTO_FRICTION = 0.00118     # 10 bps + 18% GST = 0.118%
COMMODITY_FRICTION = 0.00059  # 5 bps + 18% GST = 0.059%


def run_comparison():
    print("=" * 80)
    print("COMPARATIVE STUDY: PURE RULES VS ML MODEL (OCT 21 - NOV 7, 2026)")
    print("Evaluating 4H Crypto & 1H Commodities Live Window")
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

    # Ingest Crypto
    crypto_symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT"]
    crypto_dfs = {}
    for sym in crypto_symbols:
        crypto_dfs[sym] = fetch_binance_4h_klines(sym)

    # Ingest Commodities
    comm_symbols = ["GC=F", "SI=F", "CL=F"]
    comm_dfs = {}
    dxy_df = fetch_yahoo_1h_klines("DX-Y.NYB")
    for sym in comm_symbols:
        comm_dfs[sym] = fetch_yahoo_1h_klines(sym)

    # Containers for trades
    ml_trades = []
    pure_rules_trades = []

    # --------------------------------------------------------------------------
    # A. 4H Crypto Evaluation
    # --------------------------------------------------------------------------
    btc_df = crypto_dfs["BTCUSDT"]
    for sym, df in crypto_dfs.items():
        df = df.copy()
        df["sma200"] = df["close"].rolling(200, min_periods=30).mean()
        df["donch_h20"] = df["high"].shift(1).rolling(20, min_periods=5).max()
        df["donch_l20"] = df["low"].shift(1).rolling(20, min_periods=5).min()

        # We will track active trade index to enforce sequential single-position execution
        ml_in_trade_until = -1
        rule_in_trade_until = -1

        for i in range(len(df)):
            t = df["open_time"].iloc[i]
            if t < START_DATE_UTC or t > END_DATE_UTC:
                continue

            c = float(df["close"].iloc[i])
            sma200 = float(df["sma200"].iloc[i])
            donch_h = float(df["donch_h20"].iloc[i])

            feats = compute_4h_features(df, btc_df, i)
            prob = predict_tree_probability(model_4h, feats)
            passes_gate = prob >= p_cutoff_4h

            is_breakout = (c > donch_h) and (c > sma200)

            if is_breakout:
                # Common stop / target calculation
                prev_low10 = float(df["low"].iloc[max(0, i-10):i].min())
                raw_stop_dist = max(c - prev_low10, c * 0.015)
                clamped_stop_pct = max(0.015, min(0.060, raw_stop_dist / c))
                stop_dist = c * clamped_stop_pct
                sl = c - stop_dist
                tp = c + 2.5 * stop_dist

                # Simulate forward (12 bars = 48h)
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

                cost_r = CRYPTO_FRICTION / clamped_stop_pct
                net_r = gross_r - cost_r
                trade_record = {
                    "symbol": sym,
                    "timeframe": "4H",
                    "entry_time": t.isoformat(),
                    "side": "LONG",
                    "entry_price": c,
                    "exit_price": exit_price,
                    "exit_type": exit_type,
                    "bars_held": bars_held,
                    "gross_r": gross_r,
                    "cost_r": cost_r,
                    "net_r": net_r,
                    "probability": prob,
                    "p_cutoff": p_cutoff_4h,
                    "pnl_inr": round(net_r * RISK_PER_TRADE_INR, 2),
                }

                # Pure Rules Engine: Takes every breakout (respecting position lock)
                if i > rule_in_trade_until:
                    pure_rules_trades.append(trade_record)
                    rule_in_trade_until = i + bars_held

                # ML Meta-Classifier: Takes only when passes gate
                if passes_gate and i > ml_in_trade_until:
                    ml_trades.append(trade_record)
                    ml_in_trade_until = i + bars_held

    # --------------------------------------------------------------------------
    # B. 1H Commodities Evaluation
    # --------------------------------------------------------------------------
    for sym, df in comm_dfs.items():
        df = df.copy()
        df["sma200"] = df["close"].rolling(200, min_periods=30).mean()
        df["donch_h20"] = df["high"].shift(1).rolling(20, min_periods=5).max()
        df["donch_l20"] = df["low"].shift(1).rolling(20, min_periods=5).min()

        ml_in_trade_until = -1
        rule_in_trade_until = -1

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

            is_long_breakout = (c > donch_h) and (c > sma200)
            is_short_breakdown = (c < donch_l) and (c < sma200)

            if is_long_breakout or is_short_breakdown:
                side = "LONG" if is_long_breakout else "SHORT"
                if side == "LONG":
                    prev_low10 = float(df["low"].iloc[max(0, i-10):i].min())
                    raw_stop_dist = max(c - prev_low10, c * 0.010)
                    clamped_stop_pct = max(0.010, min(0.040, raw_stop_dist / c))
                    stop_dist = c * clamped_stop_pct
                    sl = c - stop_dist
                    tp = c + 2.5 * stop_dist
                else:
                    prev_high10 = float(df["high"].iloc[max(0, i-10):i].max())
                    raw_stop_dist = max(prev_high10 - c, c * 0.010)
                    clamped_stop_pct = max(0.010, min(0.040, raw_stop_dist / c))
                    stop_dist = c * clamped_stop_pct
                    sl = c + stop_dist
                    tp = c - 2.5 * stop_dist

                # Simulate forward (24 bars = 24h)
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

                    if side == "LONG":
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
                    else:  # SHORT
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

                cost_r = COMMODITY_FRICTION / clamped_stop_pct
                net_r = gross_r - cost_r
                trade_record = {
                    "symbol": sym,
                    "timeframe": "1H",
                    "entry_time": t.isoformat(),
                    "side": side,
                    "entry_price": c,
                    "exit_price": exit_price,
                    "exit_type": exit_type,
                    "bars_held": bars_held,
                    "gross_r": gross_r,
                    "cost_r": cost_r,
                    "net_r": net_r,
                    "probability": prob,
                    "p_cutoff": p_cutoff_comm,
                    "pnl_inr": round(net_r * RISK_PER_TRADE_INR, 2),
                }

                if i > rule_in_trade_until:
                    pure_rules_trades.append(trade_record)
                    rule_in_trade_until = i + bars_held

                if passes_gate and i > ml_in_trade_until:
                    ml_trades.append(trade_record)
                    ml_in_trade_until = i + bars_held

    # --------------------------------------------------------------------------
    # Output Comparison
    # --------------------------------------------------------------------------
    def summarize(trades_list, name):
        if not trades_list:
            return {"name": name, "count": 0}
        df_tr = pd.DataFrame(trades_list)
        wins = df_tr[df_tr["net_r"] > 0]
        losses = df_tr[df_tr["net_r"] < 0]
        targets = df_tr[df_tr["exit_type"] == "TARGET"]
        stops = df_tr[df_tr["exit_type"] == "STOP"]
        times = df_tr[df_tr["exit_type"] == "TIME"]

        tot_gross_r = float(df_tr["gross_r"].sum())
        tot_net_r = float(df_tr["net_r"].sum())
        pnl = float(df_tr["pnl_inr"].sum())
        fees = float(df_tr["cost_r"].sum()) * RISK_PER_TRADE_INR

        gross_wins = df_tr[df_tr["net_r"] > 0]["net_r"].sum()
        gross_losses = abs(df_tr[df_tr["net_r"] < 0]["net_r"].sum())
        pf = float(gross_wins / gross_losses) if gross_losses > 0 else 99.0

        return {
            "name": name,
            "total_trades": len(df_tr),
            "crypto_trades": len(df_tr[df_tr["timeframe"] == "4H"]),
            "comm_trades": len(df_tr[df_tr["timeframe"] == "1H"]),
            "wins": len(wins),
            "losses": len(losses),
            "targets": len(targets),
            "stops": len(stops),
            "times": len(times),
            "win_rate": round(len(wins) / len(df_tr) * 100, 1),
            "gross_r": round(tot_gross_r, 2),
            "net_r": round(tot_net_r, 2),
            "avg_net_r": round(tot_net_r / len(df_tr), 3),
            "profit_factor": round(pf, 2),
            "net_pnl_inr": round(pnl, 2),
            "fees_inr": round(fees, 2),
        }

    s_rules = summarize(pure_rules_trades, "Stage 1 Pure Rule Engine (No ML)")
    s_ml = summarize(ml_trades, "Stage 2 Active ML Meta-Gated Engine")

    print("\n" + "=" * 80)
    print("COMPARATIVE SUMMARY SCORECARD (OCT 21 - NOV 7, 2026)")
    print("=" * 80)
    print(json.dumps({"Pure_Rules": s_rules, "ML_Gated": s_ml}, indent=2))

    # Also save comparison to json
    with open(RESEARCH_DIR / "live_window_rules_vs_ml_comparison.json", "w") as f:
        json.dump({"pure_rules": s_rules, "ml_gated": s_ml, "rule_trades": pure_rules_trades, "ml_trades": ml_trades}, f, indent=2)

if __name__ == "__main__":
    run_comparison()
