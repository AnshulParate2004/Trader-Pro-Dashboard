#!/usr/bin/env python3
"""
Generate Pure Rule-Based Benchmark Datasets (1H and 4H) and Seed MongoDB Atlas
Universe: All 7 Assets (Gold, Silver, Crude Oil, BTC, ETH, SOL, DOT)
Windows:
  - Historical: Jan 1, 2024 to Oct 20, 2026
  - Live Unseen: Oct 21, 2026 to Nov 7, 2026
"""

import os
import sys
import json
import math
from pathlib import Path
from typing import Dict, List, Any

import numpy as np
import pandas as pd
from pymongo import MongoClient

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard")
DATA_DIR = ROOT_DIR / "data"
SRC_DATA_DIR = ROOT_DIR / "src" / "data"

COMMODITY_MAP = {
    "GC=F": {"display": "XAUUSDT", "name": "Gold (XAUUSDT)", "aliases": ["GC=F", "GC_F", "XAUUSDT"]},
    "SI=F": {"display": "XAGUSDT", "name": "Silver (XAGUSDT)", "aliases": ["SI=F", "SI_F", "XAGUSDT"]},
    "CL=F": {"display": "CLUSDT", "name": "Crude Oil (CLUSDT)", "aliases": ["CL=F", "CL_F", "CLUSDT"]},
}
COMMODITIES = ["GC=F", "SI=F", "CL=F"]
CRYPTOS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT"]
ALL_SYMBOLS = COMMODITIES + CRYPTOS

COMMODITY_FRICTION_PCT = 0.00059  # 5.9 bps net of GST
CRYPTO_FRICTION_PCT = 0.00118     # 11.8 bps net of GST

START_CUTOFF = pd.Timestamp("2024-01-01 00:00:00", tz="UTC")
IN_SAMPLE_CUTOFF = pd.Timestamp("2026-10-21 00:00:00", tz="UTC")
LIVE_END_CUTOFF = pd.Timestamp("2026-11-08 00:00:00", tz="UTC")

MONGO_URI = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority"


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    c, h, l, v = df["close"], df["high"], df["low"], df["volume"]
    prev_c = c.shift(1)
    tr = pd.concat([h - l, (h - prev_c).abs(), (l - prev_c).abs()], axis=1).max(axis=1)
    df["atr_14"] = tr.rolling(14, min_periods=14).mean()
    df["donch_high20"] = h.shift(1).rolling(20, min_periods=20).max()
    df["donch_low20"] = l.shift(1).rolling(20, min_periods=20).min()
    df["sma200"] = c.rolling(200, min_periods=30).mean()
    return df


def generate_trades_for_series(df: pd.DataFrame, symbol: str, timeframe: str) -> List[Dict[str, Any]]:
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
            else:
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
            gross_r = (exit_price - c) / stop_dist if side == "LONG" else (c - exit_price) / stop_dist

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

        # Money values based on 1000 INR artificial capital, 100 INR per 1R
        pnl_gross = round(gross_r * 100.0, 2)
        total_fee = round(cost_r * 100.0, 2)
        pnl_net = round(net_r * 100.0, 2)

        trades.append({
            "entry_dt": entry_time_val,
            "id": f"pure_{timeframe}_{display_sym}_{entry_ms}",
            "trade_id": f"pure_{timeframe}_{display_sym}_{entry_ms}",
            "symbol": display_sym,
            "rawSymbol": raw_sym,
            "displaySymbol": display_sym,
            "direction": side,
            "side": side,
            "orderType": "TAKER",
            "entryTime": entry_iso,
            "entry_time": entry_iso,
            "entry_time_ms": entry_ms,
            "exitTime": exit_iso,
            "exit_time": exit_iso,
            "exit_time_ms": exit_ms,
            "entryPrice": round(c, 4),
            "entry_price": round(c, 4),
            "exitPrice": round(exit_price, 4),
            "exit_price": round(exit_price, 4),
            "stopLoss": round(sl, 4),
            "stop_loss": round(sl, 4),
            "takeProfit": round(tp, 4),
            "take_profit": round(tp, 4),
            "stopDistancePct": round(clamped_stop_pct * 100, 2),
            "stop_distance_pct": round(clamped_stop_pct, 4),
            "positionSizeINR": 1000.0,
            "gross_r": round(gross_r, 4),
            "cost_r": round(cost_r, 4),
            "net_r": round(net_r, 4),
            "outcomeR": outcome_r,
            "returnPct": return_pct,
            "pnlGrossINR": pnl_gross,
            "pnl_gross": pnl_gross,
            "totalFeeINR": total_fee,
            "fee": total_fee,
            "pnlNetINR": pnl_net,
            "pnl_net": pnl_net,
            "exitReason": exit_reason,
            "exit_type": exit_type,
            "holdingBars": exit_bar - i,
            "bars_held": exit_bar - i,
            "holding_bars": exit_bar - i,
            "timeframe": timeframe,
            "status": "CLOSED",
            "probability": None,
            "p_cutoff": None,
        })
        last_exit_idx = exit_bar

    return trades


def calc_metrics(trades: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not trades:
        return {"count": 0, "wr": 0.0, "net_r": 0.0, "avg_r": 0.0, "pf": 0.0, "max_dd": 0.0, "tp_pct": 0.0, "sl_pct": 0.0}
    n = len(trades)
    wins = [t for t in trades if t["net_r"] > 0]
    wr = len(wins) / n * 100
    net_r = sum(t["net_r"] for t in trades)
    avg_r = net_r / n

    gross_gains = sum(t["net_r"] for t in trades if t["net_r"] > 0)
    gross_losses = sum(abs(t["net_r"]) for t in trades if t["net_r"] < 0)
    pf = round(gross_gains / (gross_losses + 1e-9), 2)

    tp_count = len([t for t in trades if t["exit_type"] == "TAKE_PROFIT"])
    sl_count = len([t for t in trades if "STOP" in t["exit_type"]])

    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    for t in trades:
        equity += t["net_r"]
        if equity > peak:
            peak = equity
        dd = equity - peak
        if dd < max_dd:
            max_dd = dd

    return {
        "count": n,
        "wr": round(wr, 1),
        "net_r": round(net_r, 2),
        "avg_r": round(avg_r, 3),
        "pf": pf,
        "max_dd": round(max_dd, 1),
        "tp_pct": round(tp_count / n * 100, 1),
        "sl_pct": round(sl_count / n * 100, 1),
    }


def main():
    print("=" * 80)
    print("GENERATING PURE RULE-BASED BENCHMARK ENGINES (1H & 4H)")
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
        time_col = "open_time" if "open_time" in df1.columns else ("ot" if "ot" in df1.columns else df1.columns[0])
        df1["open_time"] = pd.to_datetime(df1[time_col], utc=True)
        for c in ["open", "high", "low", "close", "volume"]:
            df1[c] = df1[c].astype(float)
        df1 = df1[["open_time", "open", "high", "low", "close", "volume"]].sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
        dfs_1h[crypto] = df1

        if p4.exists():
            df4 = pd.read_parquet(p4)
            time_col4 = "open_time" if "open_time" in df4.columns else ("ot" if "ot" in df4.columns else df4.columns[0])
            df4["open_time"] = pd.to_datetime(df4[time_col4], utc=True)
            for c in ["open", "high", "low", "close", "volume"]:
                df4[c] = df4[c].astype(float)
            df4 = df4[["open_time", "open", "high", "low", "close", "volume"]].sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)
        else:
            df4 = df1.copy().set_index("open_time").resample("4h").agg({
                "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"
            }).dropna().reset_index()
        dfs_4h[crypto] = df4

    # Generate Setups
    all_trades_1h = []
    all_trades_4h = []

    for sym in ALL_SYMBOLS:
        df1_ind = compute_indicators(dfs_1h[sym])
        t1 = generate_trades_for_series(df1_ind, sym, "1h")
        all_trades_1h.extend(t1)

        df4_ind = compute_indicators(dfs_4h[sym])
        t4 = generate_trades_for_series(df4_ind, sym, "4h")
        all_trades_4h.extend(t4)

    # Historical split (Jan 1, 2024 to Oct 20, 2026)
    hist_1h = [t for t in all_trades_1h if START_CUTOFF <= t["entry_dt"] < IN_SAMPLE_CUTOFF]
    hist_4h = [t for t in all_trades_4h if START_CUTOFF <= t["entry_dt"] < IN_SAMPLE_CUTOFF]

    # Live split (Oct 21, 2026 to Nov 7, 2026)
    live_1h = [t for t in all_trades_1h if IN_SAMPLE_CUTOFF <= t["entry_dt"] <= LIVE_END_CUTOFF]
    live_4h = [t for t in all_trades_4h if IN_SAMPLE_CUTOFF <= t["entry_dt"] <= LIVE_END_CUTOFF]

    # Sort chronologically
    hist_1h.sort(key=lambda x: x["entry_time_ms"])
    hist_4h.sort(key=lambda x: x["entry_time_ms"])
    live_1h.sort(key=lambda x: x["entry_time_ms"])
    live_4h.sort(key=lambda x: x["entry_time_ms"])

    # Clean entry_dt helper before json dumping and assign model names
    for idx, t in enumerate(hist_1h):
        del t["entry_dt"]
        t["pos"] = idx + 1
        t["model"] = "Rule-Based Engine (1H) [No AI Filter]"
        t["modelId"] = "pure-rules-1h-baseline"
        t["modelName"] = "Rule-Based Engine (1H) [No AI Filter]"

    for idx, t in enumerate(hist_4h):
        del t["entry_dt"]
        t["pos"] = idx + 1
        t["model"] = "Rule-Based Engine (4H Swing) [No AI Filter]"
        t["modelId"] = "pure-rules-4h-baseline"
        t["modelName"] = "Rule-Based Engine (4H Swing) [No AI Filter]"

    for idx, t in enumerate(live_1h):
        del t["entry_dt"]
        t["pos"] = idx + 1
        t["model"] = "Rule-Based Engine (1H) [No AI Filter]"
        t["modelId"] = "pure-rules-1h-baseline"
        t["modelName"] = "Rule-Based Engine (1H) [No AI Filter]"

    for idx, t in enumerate(live_4h):
        del t["entry_dt"]
        t["pos"] = idx + 1
        t["model"] = "Rule-Based Engine (4H Swing) [No AI Filter]"
        t["modelId"] = "pure-rules-4h-baseline"
        t["modelName"] = "Rule-Based Engine (4H Swing) [No AI Filter]"

    # Calculate metrics
    m_hist_1h = calc_metrics(hist_1h)
    m_hist_4h = calc_metrics(hist_4h)
    m_live_1h = calc_metrics(live_1h)
    m_live_4h = calc_metrics(live_4h)

    print("\n--- 1H RULE-BASED ENGINE ---")
    print(f"  Historical (2024-2026): {m_hist_1h}")
    print(f"  Live (Oct 21 - Nov 7):  {m_live_1h}")

    print("\n--- 4H RULE-BASED ENGINE ---")
    print(f"  Historical (2024-2026): {m_hist_4h}")
    print(f"  Live (Oct 21 - Nov 7):  {m_live_4h}")

    # Save to disk
    with open(SRC_DATA_DIR / "pure_rules_1h_executed_trades.json", "w", encoding="utf-8") as f:
        json.dump(live_1h, f, indent=2)
    with open(SRC_DATA_DIR / "pure_rules_4h_executed_trades.json", "w", encoding="utf-8") as f:
        json.dump(live_4h, f, indent=2)
    with open(SRC_DATA_DIR / "pure_rules_executed_trades.json", "w", encoding="utf-8") as f:
        json.dump(live_1h, f, indent=2)

    with open(SRC_DATA_DIR / "pure_rules_1h_historical_trades.json", "w", encoding="utf-8") as f:
        json.dump(hist_1h, f, indent=2)
    with open(SRC_DATA_DIR / "pure_rules_4h_historical_trades.json", "w", encoding="utf-8") as f:
        json.dump(hist_4h, f, indent=2)
    with open(SRC_DATA_DIR / "pure_rule_historical_trades.json", "w", encoding="utf-8") as f:
        json.dump(hist_1h, f, indent=2)

    print("\nSaved files to src/data/:")
    print(f"  ✓ pure_rules_1h_executed_trades.json   : {len(live_1h)} trades")
    print(f"  ✓ pure_rules_4h_executed_trades.json   : {len(live_4h)} trades")
    print(f"  ✓ pure_rules_executed_trades.json      : {len(live_1h)} trades (1H alias)")
    print(f"  ✓ pure_rules_1h_historical_trades.json : {len(hist_1h)} trades")
    print(f"  ✓ pure_rules_4h_historical_trades.json : {len(hist_4h)} trades")
    print(f"  ✓ pure_rule_historical_trades.json     : {len(hist_1h)} trades (1H alias)")

    # Seed MongoDB Atlas
    print("\n" + "=" * 80)
    print("SEEDING MONGODB ATLAS ('that' DATABASE)")
    print("=" * 80)
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
        db = client["that"]

        collections_to_seed = [
            ("benchmark_pure_rules_1h", live_1h),
            ("benchmark_pure_rules_4h", live_4h),
            ("benchmark_pure_rules", live_1h),
            ("historical_trades_pure_rules_1h", hist_1h),
            ("historical_trades_pure_rules_4h", hist_4h),
            ("historical_trades_pure_rule", hist_1h),
        ]

        for col_name, records in collections_to_seed:
            col = db[col_name]
            col.drop()
            if records:
                batch_size = 1000
                for i in range(0, len(records), batch_size):
                    col.insert_many(records[i:i+batch_size])
            count = col.count_documents({})
            print(f"  ✓ {col_name:<34} : Seeded {count:>4} docs")

        print("\nMongoDB Atlas seeding finished successfully!")
    except Exception as e:
        print(f"MongoDB seeding error: {e}")

    # Output exact dictionary for updating engineTypes.ts
    print("\n" + "=" * 80)
    print("METRICS SUMMARY FOR src/lib/engineTypes.ts")
    print("=" * 80)
    summary = {
        "1h": {"live": m_live_1h, "hist": m_hist_1h},
        "4h": {"live": m_live_4h, "hist": m_hist_4h},
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
