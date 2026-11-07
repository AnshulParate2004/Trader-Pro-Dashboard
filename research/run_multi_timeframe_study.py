#!/usr/bin/env python3
"""
Multi-Timeframe Quantitative Comparative Study: BTCUSDT (2020-2026)
Evaluating the Ratified Stage 1 Strict Confluence Rule Engine across Timeframes:
1W, 1D, 4H, 1H, 30m, 15m, 10m, 5m
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import Dict, List, Any

import numpy as np
import pandas as pd

# Windows UTF-8
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard")
sys.path.append(str(ROOT_DIR / "research"))

from run_stage1_strict_rules import (
    compute_indicators,
    check_confluence_setup,
    execute_triple_barrier_trade,
    CRYPTO_ROUND_TRIP_FRICTION,
)

NOTEBOOKS_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro/notebooks/data")

TIMEFRAME_CONFIGS = [
    {"name": "1 Week (1W)",   "key": "1w",  "min_stop": 0.040, "max_stop": 0.150},
    {"name": "1 Day (1D)",    "key": "1d",  "min_stop": 0.020, "max_stop": 0.080},
    {"name": "4 Hour (4H)",   "key": "4h",  "min_stop": 0.015, "max_stop": 0.060},
    {"name": "1 Hour (1H)",   "key": "1h",  "min_stop": 0.0075, "max_stop": 0.040},
    {"name": "30 Min (30m)",  "key": "30m", "min_stop": 0.0050, "max_stop": 0.030},
    {"name": "15 Min (15m)",  "key": "15m", "min_stop": 0.0035, "max_stop": 0.025},
    {"name": "10 Min (10m)",  "key": "10m", "min_stop": 0.0025, "max_stop": 0.020},
    {"name": "5 Min (5m)",    "key": "5m",  "min_stop": 0.0018, "max_stop": 0.015},
]


def load_btc_timeframe(tf_key: str) -> pd.DataFrame:
    """Loads or resamples BTC dataset for given timeframe from 2020-2026."""
    if tf_key == "1w":
        p = NOTEBOOKS_DIR / "1w" / "BTCUSDT_1w.parquet"
        df = pd.read_parquet(p)
    elif tf_key == "1d":
        p = NOTEBOOKS_DIR / "1d" / "BTCUSDT_1d.parquet"
        df = pd.read_parquet(p)
    elif tf_key == "4h":
        p = NOTEBOOKS_DIR / "4h" / "BTCUSDT_4h.parquet"
        df = pd.read_parquet(p)
    elif tf_key == "1h":
        p = NOTEBOOKS_DIR / "1h" / "BTCUSDT_1h.parquet"
        df = pd.read_parquet(p)
    elif tf_key == "15m":
        p = NOTEBOOKS_DIR / "15m" / "BTCUSDT_15m.parquet"
        df = pd.read_parquet(p)
    elif tf_key == "30m":
        p = NOTEBOOKS_DIR / "15m" / "BTCUSDT_15m.parquet"
        raw = pd.read_parquet(p)
        dt_col = "open_time" if "open_time" in raw.columns else "datetime"
        raw[dt_col] = pd.to_datetime(raw[dt_col], utc=True)
        raw = raw.set_index(dt_col).sort_index()
        res = raw.resample("30min").agg({
            "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"
        }).dropna().reset_index()
        return res
    elif tf_key == "5m":
        p = NOTEBOOKS_DIR / "5m" / "BTCUSDT_5m.parquet"
        df = pd.read_parquet(p)
    elif tf_key == "10m":
        p = NOTEBOOKS_DIR / "5m" / "BTCUSDT_5m.parquet"
        raw = pd.read_parquet(p)
        dt_col = "open_time" if "open_time" in raw.columns else "datetime"
        raw[dt_col] = pd.to_datetime(raw[dt_col], utc=True)
        raw = raw.set_index(dt_col).sort_index()
        res = raw.resample("10min").agg({
            "open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"
        }).dropna().reset_index()
        return res
    else:
        raise ValueError(f"Unknown timeframe: {tf_key}")

    dt_col = "open_time" if "open_time" in df.columns else "datetime"
    df["open_time"] = pd.to_datetime(df[dt_col], utc=True)
    df.columns = [c.lower() for c in df.columns]
    return df.sort_values("open_time").reset_index(drop=True)


def run_timeframe_backtest(df: pd.DataFrame, cfg: Dict[str, Any]) -> Dict[str, Any]:
    df = compute_indicators(df)
    n = len(df)
    min_stop = cfg["min_stop"]
    max_stop = cfg["max_stop"]
    time_barrier = 12

    trades = []
    t = 200
    while t < n - time_barrier:
        is_long, setup_long = check_confluence_setup(df, t, direction=1, is_commodity=False)
        if is_long:
            trade = execute_triple_barrier_trade(
                df, t, setup_long, "BTCUSDT", CRYPTO_ROUND_TRIP_FRICTION, min_stop, max_stop, time_barrier
            )
            trades.append(trade)
            t += max(1, trade["bars_held"])
            continue
        t += 1

    total_trades = len(trades)
    if total_trades == 0:
        return {
            "timeframe": cfg["name"],
            "total_bars": n,
            "total_trades": 0,
            "win_rate": 0.0,
            "gross_r": 0.0,
            "net_r": 0.0,
            "avg_net_r": 0.0,
            "avg_cost_r": 0.0,
            "avg_stop_pct": 0.0,
            "profit_factor": 0.0,
            "max_dd_r": 0.0,
            "pnl_inr": 0.0,
        }

    tr_df = pd.DataFrame(trades)
    wins = tr_df[tr_df["net_r"] > 0]
    win_rate = (len(wins) / total_trades) * 100.0
    gross_sum = float(tr_df["gross_r"].sum())
    net_sum = float(tr_df["net_r"].sum())
    avg_net_r = net_sum / total_trades
    avg_cost_r = float(tr_df["cost_r"].mean())
    avg_stop_pct = float(tr_df["stop_distance_pct"].mean()) * 100.0

    gross_wins = tr_df[tr_df["net_r"] > 0]["net_r"].sum()
    gross_losses = abs(tr_df[tr_df["net_r"] < 0]["net_r"].sum())
    profit_factor = float(gross_wins / gross_losses) if gross_losses > 0 else 99.0

    cum_r = tr_df["net_r"].cumsum()
    peak = cum_r.cummax()
    dd = cum_r - peak
    max_dd = float(dd.min())
    pnl_inr = net_sum * 100.0

    return {
        "timeframe": cfg["name"],
        "total_bars": n,
        "total_trades": total_trades,
        "win_rate": round(win_rate, 1),
        "gross_r": round(gross_sum, 2),
        "net_r": round(net_sum, 2),
        "avg_net_r": round(avg_net_r, 4),
        "avg_cost_r": round(avg_cost_r, 4),
        "avg_stop_pct": round(avg_stop_pct, 2),
        "profit_factor": round(profit_factor, 2),
        "max_dd_r": round(max_dd, 2),
        "pnl_inr": round(pnl_inr, 2),
    }


def main():
    print("=" * 80)
    print("MULTI-TIMEFRAME QUANTITATIVE COMPARATIVE STUDY: BTCUSDT (2020-2026)")
    print("Testing Stage 1 Confluence Engine across 8 Timeframes (1W down to 5m)")
    print("Full Taker Friction Deducted: 10 bps + 18% GST (0.118%)")
    print("=" * 80)

    results = []
    for cfg in TIMEFRAME_CONFIGS:
        t0 = time.time()
        print(f"Running {cfg['name']}...", end="", flush=True)
        df = load_btc_timeframe(cfg["key"])
        res = run_timeframe_backtest(df, cfg)
        elapsed = time.time() - t0
        print(f" Done ({res['total_bars']:,} bars, {res['total_trades']} trades in {elapsed:.2f}s)")
        results.append(res)

    print("\n" + "=" * 80)
    print("MULTI-TIMEFRAME PERFORMANCE SCORECARD (BTCUSDT: 2020 - 2026)")
    print("=" * 80 + "\n")

    cols = ["Timeframe", "Bars Scanned", "Total Trades", "Avg Stop %", "Friction Cost (R)", "Win Rate (%)", "Gross Return", "Net Return (R)", "Avg Net R", "Profit Factor", "Max DD (R)", "Net PnL (₹1k)"]
    print(f"| {' | '.join(cols)} |")
    print(f"| {' | '.join([':---' if i==0 else ':---:' for i in range(len(cols))])} |")

    for r in results:
        print(f"| **{r['timeframe']}** | {r['total_bars']:,} | **{r['total_trades']}** | {r['avg_stop_pct']}% | **{r['avg_cost_r']}R** | {r['win_rate']}% | {r['gross_r']}R | **{r['net_r']}R** | **{r['avg_net_r']}R** | **{r['profit_factor']}** | {r['max_dd_r']}R | **₹{r['pnl_inr']:.2f}** |")

    out_file = ROOT_DIR / "research" / "multi_timeframe_btc_study.json"
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved results to {out_file}")


if __name__ == "__main__":
    main()
