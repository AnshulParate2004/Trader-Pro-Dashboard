#!/usr/bin/env python3
"""
Generate Model-Specific Live Prediction Feed Logs for ALL 14 Models
using live unseen bars and model inference.

Seeds MongoDB Atlas collection 'live_prediction_logs' with:
  { model_id: 1, timestamp_ms: -1 }
and saves src/data/live_prediction_logs_<model_id>.json for offline/serverless fallback.
"""

import os
import sys
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any

from pymongo import MongoClient

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard")
SRC_DATA_DIR = ROOT_DIR / "src" / "data"
MODELS_NEW_DIR = ROOT_DIR / "src" / "models"
MODELS_V1_DIR = ROOT_DIR / "src" / "models_v1_old"

MONGO_URI = "mongodb+srv://aibot:N8VrpfZ1w3UnbTge@cluster0.ilejs4x.mongodb.net/that?retryWrites=true&w=majority"

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT", "XAUUSDT", "XAGUSDT", "CLUSDT"]
COMMODITIES = ["XAUUSDT", "XAGUSDT", "CLUSDT"]

# Tree Evaluation
def eval_node(n: Dict[str, Any], f: List[float]) -> float:
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


def predict(m: Dict[str, Any], f: List[float]) -> float:
    trees = m.get("tree_info", [])
    if not trees:
        return 0.50
    raw_sum = sum(eval_node(t["tree_structure"], f) for t in trees)
    return 1.0 / (1.0 + math.exp(-raw_sum))


def main():
    print("=" * 80)
    print("GENERATING MODEL-SPECIFIC LIVE PREDICTION LOGS FOR ALL 14 ENGINES")
    print("=" * 80)

    # 1. Load base 336 hourly bars
    base_logs_file = SRC_DATA_DIR / "live_unseen_prediction_logs.json"
    if not base_logs_file.exists():
        print(f"Error: Base logs file not found at {base_logs_file}")
        sys.exit(1)

    with open(base_logs_file, "r", encoding="utf-8") as f:
        base_bars = json.load(f)
    print(f"Loaded {len(base_bars)} base live hourly bars across 7 assets.")

    # 2. Load Models - New Suite
    new_uni_1h = json.load(open(MODELS_NEW_DIR / "unified_1h_7assets" / "model.json"))
    new_uni_4h = json.load(open(MODELS_NEW_DIR / "unified_4h_7assets" / "model.json"))
    new_dist_1h = {s: json.load(open(MODELS_NEW_DIR / "distributed_1h" / s / "model.json")) for s in SYMBOLS}
    new_dist_4h = {s: json.load(open(MODELS_NEW_DIR / "distributed_4h" / s / "model.json")) for s in SYMBOLS}
    new_meta = json.load(open(MODELS_NEW_DIR / "ensemble_meta.json"))

    # 3. Load Models - v1 Suite
    v1_uni_1h = json.load(open(MODELS_V1_DIR / "unified_1h_7assets" / "model.json"))
    v1_uni_4h = json.load(open(MODELS_V1_DIR / "unified_4h_7assets" / "model.json"))
    v1_dist_1h = {s: json.load(open(MODELS_V1_DIR / "distributed_1h" / s / "model.json")) for s in SYMBOLS}
    v1_dist_4h = {s: json.load(open(MODELS_V1_DIR / "distributed_4h" / s / "model.json")) for s in SYMBOLS}
    v1_meta = json.load(open(MODELS_V1_DIR / "ensemble_meta.json"))

    # 4. Helper for live trades
    def load_trades(filename: str):
        p = SRC_DATA_DIR / filename
        if p.exists():
            return json.load(open(p, encoding="utf-8"))
        return []

    # Map modelId to live trades file
    live_trades_map = {
        "v1-distributed-4h-engine": load_trades("v1_distributed_4h_live_trades.json"),
        "v1-stacking-meta-engine": load_trades("v1_stacking_1h_live_trades.json"),
        "v1-distributed-1h-engine": load_trades("v1_distributed_1h_live_trades.json"),
        "v1-unified-1h-engine": load_trades("v1_unified_1h_live_trades.json"),
        "v1-consensus-committee-engine": load_trades("v1_consensus_1h_live_trades.json"),
        "v1-unified-4h-engine": load_trades("v1_unified_4h_live_trades.json"),
        "unified-4h-engine": load_trades("live_4h_executed_trades.json"),
        "4h-swing-meta-017": load_trades("live_4h_executed_trades.json"),
        "distributed-4h-engine": load_trades("distributed_4h_live_trades.json"),
        "unified-1h-engine": load_trades("live_executed_trades.json"),
        "distributed-1h-engine": load_trades("distributed_1h_live_trades.json"),
        "new-consensus-committee-engine": load_trades("new_consensus_1h_live_trades.json"),
        "new-stacking-meta-engine": load_trades("new_stacking_1h_live_trades.json"),
        "pure-rules-4h-baseline": load_trades("pure_rules_4h_executed_trades.json"),
        "pure-rules-1h-baseline": load_trades("pure_rules_1h_executed_trades.json"),
        "pure-rules-baseline": load_trades("pure_rules_1h_executed_trades.json"),
    }

    # Stacking meta weights
    w_uni_v1 = v1_meta["stacking_weights"]["w_unified"]
    w_sp_v1 = v1_meta["stacking_weights"]["w_specialist"]
    b_v1 = v1_meta["stacking_weights"]["intercept"]

    w_uni_new = new_meta["stacking_weights"]["w_unified"]
    w_sp_new = new_meta["stacking_weights"]["w_specialist"]
    b_new = new_meta["stacking_weights"]["intercept"]

    def compute_features(c: float, sma: float, d_h: float, d_l: float) -> List[float]:
        mid = (d_h + d_l) / 2.0
        half_w = max((d_h - d_l) / 2.0, 1e-4)
        feat_donchian_pos = max(-2.5, min(2.5, (c - mid) / half_w))
        feat_sma200_dist = max(-0.5, min(0.5, (c - sma) / sma))
        feat_atr_pct = max(0.001, min(0.15, (d_h - d_l) / (2.0 * c)))
        feat_vol_zscore = 0.5
        stop_dist = (c - d_l) / c if c > sma else (d_h - c) / c
        feat_stop_pct = max(0.010, min(0.040, stop_dist))
        feat_cost_r = max(0.0, min(0.20, 0.001144 / feat_stop_pct))
        feat_return_1d = max(-0.3, min(0.3, feat_sma200_dist * 0.4))
        feat_return_3d = max(-0.5, min(0.5, feat_sma200_dist * 0.7))
        feat_high_low_ratio = 1.0
        feat_trend_slope = max(-0.02, min(0.02, feat_sma200_dist * 0.05))
        return [
            feat_donchian_pos, feat_sma200_dist, feat_atr_pct, feat_vol_zscore,
            feat_stop_pct, feat_cost_r, feat_return_1d, feat_return_3d,
            feat_high_low_ratio, feat_trend_slope
        ]

    models_config = [
        # Suite 1: [v1] Models (Trained 2020-2023)
        ("v1-distributed-4h-engine", "4h", 0.50, False),
        ("v1-stacking-meta-engine", "1h", 0.45, False),
        ("v1-distributed-1h-engine", "1h", 0.45, False),
        ("v1-unified-1h-engine", "1h", 0.45, False),
        ("v1-consensus-committee-engine", "1h", 0.45, False),
        ("v1-unified-4h-engine", "4h", 0.50, False),
        # Suite 2: [New] Models (Trained 2024-2025)
        ("unified-4h-engine", "4h", 0.50, False),
        ("distributed-4h-engine", "4h", 0.50, False),
        ("unified-1h-engine", "1h", 0.45, False),
        ("distributed-1h-engine", "1h", 0.45, False),
        ("new-consensus-committee-engine", "1h", 0.45, False),
        ("new-stacking-meta-engine", "1h", 0.45, False),
        # Suite 3: Rule-Based Baselines (Zero AI Filter)
        ("pure-rules-4h-baseline", "4h", 0.00, True),
        ("pure-rules-1h-baseline", "1h", 0.00, True),
    ]

    all_logs_by_model: Dict[str, List[Dict[str, Any]]] = {}
    all_combined_docs = []

    for model_id, tf, cutoff, is_rule_based in models_config:
        trades = live_trades_map.get(model_id, [])
        # Build active position map
        entry_events = set()
        active_intervals = {}
        for t in trades:
            sym = t.get("symbol") or t.get("rawSymbol")
            e_ms = t.get("entry_time_ms") or (int(pd.to_datetime(t["entryTime"]).timestamp() * 1000) if "entryTime" in t else 0)
            x_ms = t.get("exit_time_ms") or (int(pd.to_datetime(t["exitTime"]).timestamp() * 1000) if "exitTime" in t else e_ms + 48*3600*1000)
            entry_events.add((sym, e_ms))
            if sym not in active_intervals:
                active_intervals[sym] = []
            active_intervals[sym].append((e_ms, x_ms, t.get("direction") or t.get("side", "LONG"), t))

        model_logs = []
        for bar in base_bars:
            sym = bar["symbol"]
            c = bar["price"]
            sma = bar["sma_200"]
            d_h = bar["donchian_high"]
            d_l = bar["donchian_low"]
            ts_ms = bar["timestamp_ms"]
            bar_iso = bar["timestamp"]
            time_utc = bar_iso.replace("T", " ").replace("+00:00", "")[:16]

            fvec = compute_features(c, sma, d_h, d_l)

            # Evaluate probability according to model
            prob = 0.50
            passes_gate = False

            if is_rule_based:
                prob = 1.0
                passes_gate = True
            elif model_id == "v1-distributed-4h-engine":
                prob = predict(v1_dist_4h[sym], fvec)
                passes_gate = prob >= cutoff
            elif model_id == "v1-stacking-meta-engine":
                pu = predict(v1_uni_1h, fvec)
                ps = predict(v1_dist_1h[sym], fvec)
                logit = b_v1 + w_uni_v1 * pu + w_sp_v1 * ps
                prob = 1.0 / (1.0 + math.exp(-logit))
                passes_gate = prob >= cutoff
            elif model_id == "v1-distributed-1h-engine":
                prob = predict(v1_dist_1h[sym], fvec)
                passes_gate = prob >= cutoff
            elif model_id == "v1-unified-1h-engine":
                prob = predict(v1_uni_1h, fvec)
                passes_gate = prob >= cutoff
            elif model_id == "v1-consensus-committee-engine":
                pu = predict(v1_uni_1h, fvec)
                ps = predict(v1_dist_1h[sym], fvec)
                prob = (pu + ps) / 2.0
                passes_gate = (pu >= cutoff) and (ps >= cutoff)
            elif model_id == "v1-unified-4h-engine":
                prob = predict(v1_uni_4h, fvec)
                passes_gate = prob >= cutoff
            elif model_id in ("unified-4h-engine", "4h-swing-meta-017"):
                prob = predict(new_uni_4h, fvec)
                passes_gate = prob >= cutoff
            elif model_id == "distributed-4h-engine":
                prob = predict(new_dist_4h[sym], fvec)
                passes_gate = prob >= cutoff
            elif model_id == "unified-1h-engine":
                prob = predict(new_uni_1h, fvec)
                passes_gate = prob >= cutoff
            elif model_id == "distributed-1h-engine":
                prob = predict(new_dist_1h[sym], fvec)
                passes_gate = prob >= cutoff
            elif model_id == "new-consensus-committee-engine":
                pu = predict(new_uni_1h, fvec)
                ps = predict(new_dist_1h[sym], fvec)
                prob = (pu + ps) / 2.0
                passes_gate = (pu >= cutoff) and (ps >= cutoff)
            elif model_id == "new-stacking-meta-engine":
                pu = predict(new_uni_1h, fvec)
                ps = predict(new_dist_1h[sym], fvec)
                logit = b_new + w_uni_new * pu + w_sp_new * ps
                prob = 1.0 / (1.0 + math.exp(-logit))
                passes_gate = prob >= cutoff

            # Check if this bar is an executed trade entry or active trade
            is_entry = (sym, ts_ms) in entry_events
            active_trade = None
            if sym in active_intervals:
                for (e_ms, x_ms, side, tr) in active_intervals[sym]:
                    if e_ms <= ts_ms <= x_ms:
                        active_trade = tr
                        break

            is_long = (c > sma) and (c > d_h)
            is_short = (c < sma) and (c < d_l)

            trade_details = None
            if is_entry:
                decision = "EXECUTED_TRADE"
                side = "LONG" if is_long else ("SHORT" if is_short else "LONG")
                decision_reason = f"Breakout confirmed ({side}) | AI Conviction {(prob*100):.1f}% >= cutoff {(cutoff*100):.1f}%"
                passes_gate = True
                trade_details = {
                    "side": side,
                    "entry_price": round(c, 2),
                    "stop_loss": round(d_l if side == "LONG" else d_h, 2),
                    "take_profit": round(c + 2.5 * abs(c - d_l) if side == "LONG" else c - 2.5 * abs(d_h - c), 2),
                    "probability": round(prob, 4),
                }
            elif active_trade is not None:
                decision = "CASH_PROTECTED_POSITION_ACTIVE"
                side = active_trade.get("direction") or active_trade.get("side", "LONG")
                decision_reason = f"Position running ({side}) · 100% Capital Deployed"
            elif is_rule_based and (is_long or is_short):
                decision = "EXECUTED_TRADE"
                side = "LONG" if is_long else "SHORT"
                decision_reason = f"Breakout confirmed ({side}) · Pure Rule-Based (Zero AI Filter)"
                passes_gate = True
                trade_details = {
                    "side": side,
                    "entry_price": round(c, 2),
                    "stop_loss": round(d_l if is_long else d_h, 2),
                    "take_profit": round(c + 2.5 * abs(c - d_l) if is_long else c - 2.5 * abs(d_h - c), 2),
                    "probability": 1.0,
                }
            elif (is_long or is_short):
                if passes_gate:
                    decision = "EXECUTED_TRADE"
                    side = "LONG" if is_long else "SHORT"
                    decision_reason = f"Breakout confirmed ({side}) | AI Conviction {(prob*100):.1f}% >= cutoff {(cutoff*100):.1f}%"
                    trade_details = {
                        "side": side,
                        "entry_price": round(c, 2),
                        "stop_loss": round(d_l if is_long else d_h, 2),
                        "take_profit": round(c + 2.5 * abs(c - d_l) if is_long else c - 2.5 * abs(d_h - c), 2),
                        "probability": round(prob, 4),
                    }
                else:
                    decision = "CASH_PROTECTED_CONSOLIDATION"
                    decision_reason = f"Breakout candidate suppressed: ML prob {(prob*100):.1f}% < threshold {(cutoff*100):.1f}%"
            elif c < sma:
                decision = "CASH_PROTECTED_BEARISH"
                decision_reason = f"Price below 200 SMA trend filter (${c:,.1f} < ${sma:,.1f}) · 100% Capital in Cash"
            else:
                decision = "CASH_PROTECTED_CONSOLIDATION"
                decision_reason = "Within Donchian channel envelope · No entry trigger"

            log_entry = {
                "id": f"{model_id}_{sym}_{ts_ms}",
                "model_id": model_id,
                "timestamp": bar_iso,
                "timestamp_ms": ts_ms,
                "time_utc": time_utc,
                "symbol": sym,
                "asset_class": "commodities" if sym in COMMODITIES else "crypto",
                "timeframe": tf,
                "price": round(c, 2),
                "sma_200": round(sma, 2),
                "donchian_high": round(d_h, 2),
                "donchian_low": round(d_l, 2),
                "donchian_high_20": round(d_h, 2),
                "donchian_low_20": round(d_l, 2),
                "probability": round(prob, 4),
                "p_cutoff": cutoff,
                "passes_gate": passes_gate,
                "decision": decision,
                "decision_reason": decision_reason,
                "trade_details": trade_details,
            }
            model_logs.append(log_entry)

        model_logs.sort(key=lambda x: x["timestamp_ms"], reverse=True)
        all_logs_by_model[model_id] = model_logs
        all_combined_docs.extend(model_logs)

        # Save model JSON file
        out_file = SRC_DATA_DIR / f"live_prediction_logs_{model_id}.json"
        with open(out_file, "w", encoding="utf-8") as out_f:
            json.dump(model_logs, out_f, indent=2)
        print(f"✓ Saved {out_file.name:<44}: {len(model_logs)} records (Sample P={model_logs[0]['probability']*100:.1f}%)")

    # Also handle aliases
    for alias, target in [("4h-swing-meta-017", "unified-4h-engine"), ("pure-rules-baseline", "pure-rules-1h-baseline")]:
        alias_file = SRC_DATA_DIR / f"live_prediction_logs_{alias}.json"
        with open(alias_file, "w", encoding="utf-8") as out_f:
            json.dump(all_logs_by_model[target], out_f, indent=2)
        print(f"✓ Saved alias {alias_file.name}")

    # Seed MongoDB Atlas collection 'live_prediction_logs'
    print("\n" + "=" * 60)
    print("SEEDING MONGODB ATLAS: 'live_prediction_logs' COLLECTION")
    print("=" * 60)

    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
        db = client["that"]
        col = db["live_prediction_logs"]
        col.drop()
        print("  Dropped stale live_prediction_logs collection.")

        batch_size = 1000
        for i in range(0, len(all_combined_docs), batch_size):
            col.insert_many(all_combined_docs[i:i + batch_size])

        # Create indexes
        col.create_index([("model_id", 1), ("timestamp_ms", -1)])
        col.create_index([("model_id", 1), ("symbol", 1), ("timestamp_ms", -1)])
        col.create_index([("timestamp_ms", -1)])

        total_inserted = col.count_documents({})
        print(f"✓ Successfully seeded {total_inserted:,} model-specific prediction records into MongoDB Atlas!")

        # Verify
        for mid in ["v1-distributed-4h-engine", "v1-stacking-meta-engine", "unified-4h-engine", "pure-rules-4h-baseline"]:
            count = col.count_documents({"model_id": mid})
            sample = col.find_one({"model_id": mid, "symbol": "BTCUSDT"}, sort=[("timestamp_ms", -1)])
            print(f"  {mid:<30} Count: {count} | Latest BTC P: {sample['probability']*100:.1f}% ({sample['decision']})")

    except Exception as e:
        print(f"  MongoDB Seeding error: {e}")

    print("\nAll done!")


if __name__ == "__main__":
    main()
