#!/usr/bin/env python3
"""
Generate OM (Optimal Model) Live & Unseen Trade Ledgers
Matches the exact schema of v1 and new suites:
- Live Window: Oct 21, 2026 to Nov 07, 2026
- Unseen Window: Jan 01, 2025 to Oct 20, 2026

Models:
- om_unified_1h
- om_unified_4h
- om_distributed_1h
- om_distributed_4h
- om_consensus_1h
- om_stacking_1h
"""

import os
import sys
import json
import math
from datetime import datetime, timezone
import pandas as pd
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = r"D:\Projects_Main\Trade-Pro\Trader-Pro-Dashboard"
SRC_DATA_DIR = os.path.join(ROOT_DIR, "src", "data")
MODELS_OM_DIR = os.path.join(ROOT_DIR, "src", "models_om")
DATA_DIR = r"D:\Projects_Main\Trade-Pro\Trader-Pro\notebooks\data"

SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOTUSDT', 'XAUUSDT', 'XAGUSDT', 'CLUSDT']
ROUND_TRIP_FRICTION = 0.001144  # 11.44 bps net friction

FEATURE_COLS = [
    'feat_donchian_pos', 'feat_sma200_dist', 'feat_atr_pct', 'feat_vol_zscore',
    'feat_stop_pct', 'feat_cost_r', 'feat_return_1d', 'feat_return_3d',
    'feat_high_low_ratio', 'feat_trend_slope'
]

# Tree Evaluation
def eval_node(n, f):
    if "leaf_value" in n:
        return float(n["leaf_value"])
    feat_idx = n["split_feature"]
    threshold = n["threshold"]
    val = f[feat_idx] if feat_idx < len(f) else None
    if val is None or math.isnan(val):
        child = n["left_child"] if n.get("default_left", True) else n["right_child"]
        return eval_node(child, f)
    if val <= threshold:
        return eval_node(n["left_child"], f)
    else:
        return eval_node(n["right_child"], f)

def predict_proba(model_dict, features_matrix):
    trees = model_dict.get("tree_info", [])
    if not trees:
        return np.full(len(features_matrix), 0.50)
    
    # Vectorized / batch over rows
    probs = []
    for row in features_matrix:
        raw_sum = sum(eval_node(t["tree_structure"], row) for t in trees)
        p = 1.0 / (1.0 + math.exp(-raw_sum))
        probs.append(p)
    return np.array(probs)

def compute_causal_features(df, timeframe='1h'):
    df = df.copy().sort_values('open_time').reset_index(drop=True)
    c, h, l, v = df['close'], df['high'], df['low'], df['volume']

    dh = h.shift(1).rolling(20).max()
    dl = l.shift(1).rolling(20).min()
    d_mid = (dh + dl) / 2.0
    d_width = (dh - dl).replace(0, np.nan)
    df['feat_donchian_pos'] = ((c - d_mid) / (d_width / 2.0)).clip(-2.5, 2.5).fillna(0.0)

    sma200 = c.rolling(200).mean()
    df['feat_sma200_dist'] = ((c - sma200) / sma200).clip(-0.5, 0.5).fillna(0.0)

    tr = np.maximum(h - l, np.maximum(np.abs(h - c.shift(1)), np.abs(l - c.shift(1))))
    atr14 = tr.rolling(14).mean()
    df['feat_atr_pct'] = (atr14 / c).clip(0.001, 0.15).fillna(0.02)

    v_mean = v.rolling(50).mean()
    v_std = v.rolling(50).std().replace(0, np.nan)
    df['feat_vol_zscore'] = ((v - v_mean) / v_std).clip(-3.0, 5.0).fillna(0.0)

    stop_dist_long = ((c - dl) / c).clip(0.005, 0.10)
    min_clamp = 0.010 if timeframe == '1h' else 0.015
    max_clamp = 0.040 if timeframe == '1h' else 0.060
    clamped_stop = stop_dist_long.clip(min_clamp, max_clamp).fillna(min_clamp)
    df['feat_stop_pct'] = clamped_stop
    df['feat_cost_r'] = (ROUND_TRIP_FRICTION / clamped_stop).clip(0.0, 0.20)

    lb_1d = 24 if timeframe == '1h' else 6
    lb_3d = 72 if timeframe == '1h' else 18
    df['feat_return_1d'] = c.pct_change(lb_1d).clip(-0.3, 0.3).fillna(0.0)
    df['feat_return_3d'] = c.pct_change(lb_3d).clip(-0.5, 0.5).fillna(0.0)

    mean_range = (h - l).rolling(14).mean().replace(0, np.nan)
    df['feat_high_low_ratio'] = ((h - l) / mean_range).clip(0.1, 5.0).fillna(1.0)

    ema50 = c.ewm(span=50, adjust=False).mean()
    df['feat_trend_slope'] = ((ema50 - ema50.shift(10)) / ema50.shift(10)).clip(-0.1, 0.1).fillna(0.0)

    for col in FEATURE_COLS:
        df[col] = df[col].fillna(0.0)
    return df

def label_single_asset_trades(df_asset, timeframe='1h'):
    df = df_asset.copy().sort_values('open_time').reset_index(drop=True)
    close = df['close'].values
    high = df['high'].values
    low = df['low'].values
    open_time = df['open_time'].values
    sma200 = df['close'].rolling(200).mean().values

    donch_high = df['high'].shift(1).rolling(20).max().values
    donch_low = df['low'].shift(1).rolling(20).min().values

    n = len(df)
    horizon = 24 if timeframe == '1h' else 12
    min_stop = 0.010 if timeframe == '1h' else 0.015
    max_stop = 0.040 if timeframe == '1h' else 0.060

    candidates = []
    last_exit_idx = -1

    for i in range(200, n - horizon):
        if i <= last_exit_idx:
            continue

        entry_price = close[i]
        is_long = (entry_price > sma200[i]) and (entry_price > donch_high[i])
        is_short = (entry_price < sma200[i]) and (entry_price < donch_low[i])

        if not (is_long or is_short):
            continue

        direction = "LONG" if is_long else "SHORT"

        if is_long:
            raw_stop_dist = (entry_price - donch_low[i]) / entry_price
        else:
            raw_stop_dist = (donch_high[i] - entry_price) / entry_price

        stop_dist = np.clip(raw_stop_dist, min_stop, max_stop)

        if is_long:
            sl_price = entry_price * (1.0 - stop_dist)
            tp_price = entry_price * (1.0 + 2.5 * stop_dist)
        else:
            sl_price = entry_price * (1.0 + stop_dist)
            tp_price = entry_price * (1.0 - 2.5 * stop_dist)

        outcome_r = 0.0
        exit_bar = horizon
        exit_reason = 'TIME_EXPIRY'
        exit_price = close[i + horizon]

        for h in range(1, horizon + 1):
            bar_idx = i + h
            b_high = high[bar_idx]
            b_low = low[bar_idx]
            b_close = close[bar_idx]

            if is_long:
                sl_hit = b_low <= sl_price
                tp_hit = b_high >= tp_price
            else:
                sl_hit = b_high >= sl_price
                tp_hit = b_low <= tp_price

            if sl_hit and tp_hit:
                outcome_r = -1.0
                exit_reason = 'STOP_LOSS'
                exit_price = sl_price
                exit_bar = h
                break
            elif sl_hit:
                outcome_r = -1.0
                exit_reason = 'STOP_LOSS'
                exit_price = sl_price
                exit_bar = h
                break
            elif tp_hit:
                outcome_r = 2.5
                exit_reason = 'TAKE_PROFIT'
                exit_price = tp_price
                exit_bar = h
                break
            elif h == horizon:
                if is_long:
                    pnl_pct = (b_close - entry_price) / entry_price
                else:
                    pnl_pct = (entry_price - b_close) / entry_price
                outcome_r = pnl_pct / stop_dist
                exit_reason = 'TIME_EXPIRY'
                exit_price = b_close
                exit_bar = h

        friction_r = ROUND_TRIP_FRICTION / stop_dist
        net_r = outcome_r - friction_r
        label = 1 if net_r > 0 else 0

        exit_time_val = open_time[i + exit_bar]

        row_dict = {col: df[col].iloc[i] for col in FEATURE_COLS}
        row_dict['entry_time'] = pd.to_datetime(open_time[i], utc=True)
        row_dict['exit_time'] = pd.to_datetime(exit_time_val, utc=True)
        row_dict['symbol'] = df['symbol'].iloc[i]
        row_dict['direction'] = direction
        row_dict['entry_price'] = entry_price
        row_dict['exit_price'] = exit_price
        row_dict['sl_price'] = sl_price
        row_dict['tp_price'] = tp_price
        row_dict['stop_dist'] = stop_dist
        row_dict['outcome_r'] = outcome_r
        row_dict['friction_r'] = friction_r
        row_dict['net_r'] = net_r
        row_dict['exit_reason'] = exit_reason
        row_dict['exit_bar'] = exit_bar
        row_dict['label'] = label
        candidates.append(row_dict)
        last_exit_idx = i + exit_bar

    return pd.DataFrame(candidates)

print("Ingesting candle parquets and computing features...")
dfs_1h = []
dfs_4h = []

for s in SYMBOLS:
    df_sym = pd.read_parquet(os.path.join(DATA_DIR, f"{s}_1h.parquet"))
    df_sym['open_time'] = pd.to_datetime(df_sym['open_time'], utc=True)
    df_sym['symbol'] = s
    df_sym['timeframe'] = '1h'
    dfs_1h.append(compute_causal_features(df_sym, '1h'))

    df_sym_4h = pd.read_parquet(os.path.join(DATA_DIR, f"{s}_4h.parquet"))
    df_sym_4h['open_time'] = pd.to_datetime(df_sym_4h['open_time'], utc=True)
    df_sym_4h['symbol'] = s
    df_sym_4h['timeframe'] = '4h'
    dfs_4h.append(compute_causal_features(df_sym_4h, '4h'))

cand_1h = pd.concat([label_single_asset_trades(g, '1h') for g in dfs_1h], ignore_index=True)
cand_4h = pd.concat([label_single_asset_trades(g, '4h') for g in dfs_4h], ignore_index=True)

print(f"Generated 1H candidates: {len(cand_1h):,}")
print(f"Generated 4H candidates: {len(cand_4h):,}")

# Load OM Models
print("Loading OM Decision Tree Models...")
om_uni_1h = json.load(open(os.path.join(MODELS_OM_DIR, "unified_1h_7assets", "model.json")))
om_uni_4h = json.load(open(os.path.join(MODELS_OM_DIR, "unified_4h_7assets", "model.json")))
om_dist_1h = {s: json.load(open(os.path.join(MODELS_OM_DIR, "distributed_1h", s, "model.json"))) for s in SYMBOLS}
om_dist_4h = {s: json.load(open(os.path.join(MODELS_OM_DIR, "distributed_4h", s, "model.json"))) for s in SYMBOLS}
om_meta = json.load(open(os.path.join(MODELS_OM_DIR, "ensemble_meta.json")))

w_uni = om_meta["stacking_weights"]["w_unified"]
w_spec = om_meta["stacking_weights"]["w_specialist"]
b_0 = om_meta["stacking_weights"]["intercept"]

# Score 1H Candidates
feat_mat_1h = cand_1h[FEATURE_COLS].values
p_uni_1h = predict_proba(om_uni_1h, feat_mat_1h)
p_spec_1h = np.zeros(len(cand_1h))
for s in SYMBOLS:
    m = cand_1h['symbol'] == s
    if m.sum() > 0:
        p_spec_1h[m] = predict_proba(om_dist_1h[s], cand_1h.loc[m, FEATURE_COLS].values)

# Stacking proba
logits_1h = w_uni * p_uni_1h + w_spec * p_spec_1h + b_0
p_stack_1h = 1.0 / (1.0 + np.exp(-logits_1h))

cand_1h['p_unified'] = p_uni_1h
cand_1h['p_specialist'] = p_spec_1h
cand_1h['p_stacking'] = p_stack_1h

# Score 4H Candidates
feat_mat_4h = cand_4h[FEATURE_COLS].values
p_uni_4h = predict_proba(om_uni_4h, feat_mat_4h)
p_spec_4h = np.zeros(len(cand_4h))
for s in SYMBOLS:
    m = cand_4h['symbol'] == s
    if m.sum() > 0:
        p_spec_4h[m] = predict_proba(om_dist_4h[s], cand_4h.loc[m, FEATURE_COLS].values)

cand_4h['p_unified'] = p_uni_4h
cand_4h['p_specialist'] = p_spec_4h

# Split into Unseen (2025-01-01 to 2026-10-20) and Live (2026-10-21 to 2026-11-07)
UNSEEN_START = pd.to_datetime('2025-01-01 00:00:00', utc=True)
UNSEEN_END   = pd.to_datetime('2026-10-20 23:59:59', utc=True)
LIVE_START   = pd.to_datetime('2026-10-21 00:00:00', utc=True)
LIVE_END     = pd.to_datetime('2026-11-07 23:59:59', utc=True)

unseen_cand_1h = cand_1h[(cand_1h['entry_time'] >= UNSEEN_START) & (cand_1h['entry_time'] <= UNSEEN_END)].copy()
live_cand_1h   = cand_1h[(cand_1h['entry_time'] >= LIVE_START) & (cand_1h['entry_time'] <= LIVE_END)].copy()

unseen_cand_4h = cand_4h[(cand_4h['entry_time'] >= UNSEEN_START) & (cand_4h['entry_time'] <= UNSEEN_END)].copy()
live_cand_4h   = cand_4h[(cand_4h['entry_time'] >= LIVE_START) & (cand_4h['entry_time'] <= LIVE_END)].copy()

def build_trade_object(row, model_id, model_name, timeframe, prob, p_cutoff, pos_idx, base_capital=7000.0, current_capital=7000.0):
    entry_ms = int(row['entry_time'].timestamp() * 1000)
    exit_ms = int(row['exit_time'].timestamp() * 1000)
    entry_iso = row['entry_time'].isoformat()
    exit_iso = row['exit_time'].isoformat()

    symbol = row['symbol']
    direction = row['direction']
    entry_price = float(row['entry_price'])
    exit_price = float(row['exit_price'])
    sl_price = float(row['sl_price'])
    tp_price = float(row['tp_price'])
    stop_dist = float(row['stop_dist'])
    outcome_r = float(row['outcome_r'])
    net_r = float(row['net_r'])
    exit_reason = str(row['exit_reason'])
    exit_bar = int(row['exit_bar'])

    # 1% risk per trade on ₹7,000 capital -> ₹70 risk per R
    risk_inr = 70.0
    pnl_gross = round(outcome_r * risk_inr, 2)
    friction_cost = round(row['friction_r'] * risk_inr, 2)
    pnl_net = round(net_r * risk_inr, 2)
    new_capital = round(current_capital + pnl_net, 2)

    return {
        "id": f"om_{model_id[:6]}_{symbol}_{entry_ms}",
        "trade_id": f"om_{model_id[:6]}_{symbol}_{entry_ms}",
        "pos": pos_idx,
        "entryTime": entry_iso,
        "entry_time": entry_iso,
        "entry_time_ms": entry_ms,
        "exitTime": exit_iso,
        "exit_time": exit_iso,
        "exit_time_ms": exit_ms,
        "direction": direction,
        "side": direction,
        "symbol": symbol,
        "rawSymbol": symbol,
        "displaySymbol": symbol,
        "entryPrice": entry_price,
        "entry_price": entry_price,
        "exitPrice": exit_price,
        "exit_price": exit_price,
        "stopLoss": sl_price,
        "stop_loss": sl_price,
        "takeProfit": tp_price,
        "take_profit": tp_price,
        "stopDistancePct": round(stop_dist * 100.0, 2),
        "stop_distance_pct": round(stop_dist, 4),
        "positionSizeINR": 1000.0,
        "gross_r": round(outcome_r, 4),
        "cost_r": round(row['friction_r'], 4),
        "net_r": round(net_r, 4),
        "outcomeR": round(net_r, 4),
        "returnPct": round(net_r * stop_dist * 100.0, 2),
        "pnlGrossINR": pnl_gross,
        "totalFeeINR": friction_cost,
        "pnlNetINR": pnl_net,
        "capital": new_capital,
        "exitReason": exit_reason,
        "exit_type": exit_reason,
        "bars_held": exit_bar,
        "holdingBars": exit_bar,
        "timeframe": timeframe,
        "model": model_name,
        "modelId": model_id,
        "model_id": model_id,
        "probability": round(float(prob), 4),
        "p_cutoff": p_cutoff,
        "status": "CLOSED"
    }, new_capital

# Define 6 OM Model Configurations
OM_ENGINES = [
    {
        "id": "om-distributed-4h-engine",
        "name": "[OM] Distributed 4H Specialists [7 Dedicated Models]",
        "timeframe": "4h",
        "df_unseen": unseen_cand_4h,
        "df_live": live_cand_4h,
        "prob_col": "p_specialist",
        "cutoff": 0.50,
        "mask_fn": lambda df: df['p_specialist'] >= 0.50,
        "live_file": "om_distributed_4h_live_trades.json",
        "unseen_file": "om_distributed_4h_unseen_trades.json",
        "col_live": "paper_trades_om_distributed_4h",
        "col_unseen": "historical_trades_om_distributed_4h"
    },
    {
        "id": "om-stacking-meta-engine",
        "name": "[OM] Stacking Meta-Learner (Logistic Meta-Ensemble)",
        "timeframe": "1h",
        "df_unseen": unseen_cand_1h,
        "df_live": live_cand_1h,
        "prob_col": "p_stacking",
        "cutoff": 0.48,
        "mask_fn": lambda df: df['p_stacking'] >= 0.48,
        "live_file": "om_stacking_1h_live_trades.json",
        "unseen_file": "om_stacking_1h_unseen_trades.json",
        "col_live": "paper_trades_om_stacking_1h",
        "col_unseen": "historical_trades_om_stacking_1h"
    },
    {
        "id": "om-distributed-1h-engine",
        "name": "[OM] Distributed 1H Specialists [7 Dedicated Models]",
        "timeframe": "1h",
        "df_unseen": unseen_cand_1h,
        "df_live": live_cand_1h,
        "prob_col": "p_specialist",
        "cutoff": 0.45,
        "mask_fn": lambda df: df['p_specialist'] >= 0.45,
        "live_file": "om_distributed_1h_live_trades.json",
        "unseen_file": "om_distributed_1h_unseen_trades.json",
        "col_live": "paper_trades_om_distributed_1h",
        "col_unseen": "historical_trades_om_distributed_1h"
    },
    {
        "id": "om-unified-1h-engine",
        "name": "[OM] Unified 1H Multi-Asset Engine [1 Universal Brain]",
        "timeframe": "1h",
        "df_unseen": unseen_cand_1h,
        "df_live": live_cand_1h,
        "prob_col": "p_unified",
        "cutoff": 0.45,
        "mask_fn": lambda df: df['p_unified'] >= 0.45,
        "live_file": "om_unified_1h_live_trades.json",
        "unseen_file": "om_unified_1h_unseen_trades.json",
        "col_live": "paper_trades_om_unified_1h",
        "col_unseen": "historical_trades_om_unified_1h"
    },
    {
        "id": "om-consensus-committee-engine",
        "name": "[OM] Dual-Gating Consensus Committee [1H Unified + Specialists]",
        "timeframe": "1h",
        "df_unseen": unseen_cand_1h,
        "df_live": live_cand_1h,
        "prob_col": "p_specialist",
        "cutoff": 0.45,
        "mask_fn": lambda df: (df['p_unified'] >= 0.45) & (df['p_specialist'] >= 0.45),
        "live_file": "om_consensus_1h_live_trades.json",
        "unseen_file": "om_consensus_1h_unseen_trades.json",
        "col_live": "paper_trades_om_consensus_1h",
        "col_unseen": "historical_trades_om_consensus_1h"
    },
    {
        "id": "om-unified-4h-engine",
        "name": "[OM] Unified 4H Swing Engine [1 Universal Brain]",
        "timeframe": "4h",
        "df_unseen": unseen_cand_4h,
        "df_live": live_cand_4h,
        "prob_col": "p_unified",
        "cutoff": 0.50,
        "mask_fn": lambda df: df['p_unified'] >= 0.50,
        "live_file": "om_unified_4h_live_trades.json",
        "unseen_file": "om_unified_4h_unseen_trades.json",
        "col_live": "paper_trades_om_unified_4h",
        "col_unseen": "historical_trades_om_unified_4h"
    }
]

print("\n" + "=" * 80)
print("GENERATING OM TRADE LEDGERS FOR UNSEEN & LIVE WINDOWS")
print("=" * 80)

summary_rows = []

for eng in OM_ENGINES:
    # 1. Generate Unseen Trades
    df_u = eng["df_unseen"]
    mask_u = eng["mask_fn"](df_u)
    admitted_u = df_u[mask_u].sort_values('entry_time').reset_index(drop=True)

    unseen_trades = []
    cap = 7000.0
    for idx, row in admitted_u.iterrows():
        t_obj, cap = build_trade_object(
            row, eng["id"], eng["name"], eng["timeframe"],
            row[eng["prob_col"]], eng["cutoff"], idx + 1,
            base_capital=7000.0, current_capital=cap
        )
        unseen_trades.append(t_obj)

    u_path = os.path.join(SRC_DATA_DIR, eng["unseen_file"])
    with open(u_path, "w", encoding="utf-8") as f:
        json.dump(unseen_trades, f, indent=2)

    # 2. Generate Live Trades
    df_l = eng["df_live"]
    mask_l = eng["mask_fn"](df_l)
    admitted_l = df_l[mask_l].sort_values('entry_time').reset_index(drop=True)

    live_trades = []
    cap = 7000.0
    for idx, row in admitted_l.iterrows():
        t_obj, cap = build_trade_object(
            row, eng["id"], eng["name"], eng["timeframe"],
            row[eng["prob_col"]], eng["cutoff"], idx + 1,
            base_capital=7000.0, current_capital=cap
        )
        live_trades.append(t_obj)

    l_path = os.path.join(SRC_DATA_DIR, eng["live_file"])
    with open(l_path, "w", encoding="utf-8") as f:
        json.dump(live_trades, f, indent=2)

    u_net_r = round(sum(t['net_r'] for t in unseen_trades), 2)
    l_net_r = round(sum(t['net_r'] for t in live_trades), 2)
    l_wr = round(sum(1 for t in live_trades if t['net_r'] > 0) / len(live_trades) * 100.0, 1) if live_trades else 0.0

    summary_rows.append({
        "Model": eng["name"],
        "Unseen Trades": len(unseen_trades),
        "Unseen Net R": u_net_r,
        "Live Trades": len(live_trades),
        "Live Net R": l_net_r,
        "Live Win%": l_wr,
        "Ending Live Capital": cap
    })

df_summary = pd.DataFrame(summary_rows)
print(df_summary.to_string(index=False))
print("\n✅ All 12 OM trade ledger files generated successfully in src/data/")
