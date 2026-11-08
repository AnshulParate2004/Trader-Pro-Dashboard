import json
import math
import numpy as np
import pandas as pd
from pathlib import Path

ROOT_DIR = Path("D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard")
DATA_DIR = ROOT_DIR / "data"
SRC_MODELS_DIR = ROOT_DIR / "src" / "models"

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

CRYPTO_FRICTION_PCT = 0.00118  # 11.8 bps net of GST
CRYPTOS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "DOTUSDT"]

# Unseen Historical Horizon: Jan 1, 2020 to Dec 31, 2023
PAST_START = pd.Timestamp("2020-01-01 00:00:00", tz="UTC")
PAST_END = pd.Timestamp("2023-12-31 23:59:59", tz="UTC")


def eval_tree_node(node, features):
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


def predict_tree_probability(model, features):
    trees = model.get("tree_info", [])
    raw_sum = sum(eval_tree_node(t["tree_structure"], features) for t in trees)
    return 1.0 / (1.0 + math.exp(-raw_sum))


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    c, h, l, v = df["close"], df["high"], df["low"], df["volume"]

    prev_c = c.shift(1)
    tr = pd.concat([h - l, (h - prev_c).abs(), (l - prev_c).abs()], axis=1).max(axis=1)
    atr14 = tr.rolling(14, min_periods=14).mean()
    atr7 = tr.rolling(7, min_periods=7).mean()
    atr28 = tr.rolling(28, min_periods=28).mean()
    df["atr_14"] = atr14

    df["feat_atr_pct"] = atr14 / (c + 1e-8)
    v_mean20 = v.rolling(20, min_periods=5).mean()
    v_std20 = v.rolling(20, min_periods=5).std()
    df["feat_vol_zscore"] = (v - v_mean20) / (v_std20 + 1e-8)
    df["feat_volatility_ratio"] = atr7 / (atr28 + 1e-8)

    donch_high20 = h.shift(1).rolling(20, min_periods=20).max()
    donch_low20 = l.shift(1).rolling(20, min_periods=20).min()
    df["donch_high20"] = donch_high20
    df["donch_low20"] = donch_low20
    channel_width = donch_high20 - donch_low20
    df["feat_donchian_pos"] = (c - donch_low20) / (channel_width + 1e-8)

    sma200 = c.rolling(200, min_periods=30).mean()
    df["sma200"] = sma200
    df["feat_trend_dist_200"] = (c - sma200) / (sma200 + 1e-8)

    df["feat_mom_24h"] = (c - c.shift(24)) / (c.shift(24) + 1e-8)
    df["feat_mom_72h"] = (c - c.shift(72)) / (c.shift(72) + 1e-8)

    delta = c.diff()
    gain = delta.clip(lower=0).rolling(14, min_periods=14).mean()
    loss = (-delta.clip(upper=0)).rolling(14, min_periods=14).mean()
    rs = gain / (loss + 1e-8)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    df["feat_rsi_14"] = (rsi - 50.0) / 50.0

    df["feat_dist_ema20"] = (c - c.ewm(span=20, adjust=False).mean()) / (c + 1e-8)
    df["feat_dist_ema50"] = (c - c.ewm(span=50, adjust=False).mean()) / (c + 1e-8)

    for col in FEATURE_NAMES:
        df[col] = df[col].fillna(0.0).clip(-5.0, 5.0)

    return df


def generate_candidate_setups(df: pd.DataFrame, symbol: str, timeframe: str):
    trades = []
    min_stop, max_stop = 0.015, 0.060
    friction_pct = CRYPTO_FRICTION_PCT
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
                    gross_r, exit_type, exit_bar, exit_price = -1.0, "COLLISION_STOP", curr_idx, sl
                    break
                elif hit_tp:
                    gross_r, exit_type, exit_bar, exit_price = 2.5, "TAKE_PROFIT", curr_idx, tp
                    break
                elif hit_sl:
                    gross_r, exit_type, exit_bar, exit_price = -1.0, "STOP_LOSS", curr_idx, sl
                    break
            else:
                hit_tp = bl <= tp
                hit_sl = bh >= sl
                if hit_tp and hit_sl:
                    gross_r, exit_type, exit_bar, exit_price = -1.0, "COLLISION_STOP", curr_idx, sl
                    break
                elif hit_tp:
                    gross_r, exit_type, exit_bar, exit_price = 2.5, "TAKE_PROFIT", curr_idx, tp
                    break
                elif hit_sl:
                    gross_r, exit_type, exit_bar, exit_price = -1.0, "STOP_LOSS", curr_idx, sl
                    break

        if exit_type == "TIME_EXPIRY":
            gross_r = (exit_price - c) / stop_dist if side == "LONG" else (c - exit_price) / stop_dist

        cost_r = friction_pct / clamped_stop_pct
        net_r = gross_r - cost_r

        entry_time_val = df["open_time"].iloc[i]

        trades.append({
            "entry_dt": entry_time_val,
            "entry_time_ms": int(entry_time_val.timestamp() * 1000),
            "symbol": symbol,
            "side": side,
            "net_r": net_r,
            "gross_r": gross_r,
            "features": [float(df[feat].iloc[i]) for feat in FEATURE_NAMES],
        })
        last_exit_idx = exit_bar

    return trades


def calc_stats(trades):
    if not trades:
        return {"trades": 0, "wr": 0.0, "net_r": 0.0, "avg_r": 0.0, "pf": 0.0, "max_dd": 0.0}
    n = len(trades)
    wins = [t for t in trades if t["net_r"] > 0]
    wr = len(wins) / n * 100
    net_r = sum(t["net_r"] for t in trades)
    avg_r = net_r / n

    gross_gains = sum(t["net_r"] for t in trades if t["net_r"] > 0)
    gross_losses = sum(abs(t["net_r"]) for t in trades if t["net_r"] < 0)
    pf = round(gross_gains / (gross_losses + 1e-9), 2)

    # Max Drawdown
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
        "trades": n,
        "wr": round(wr, 1),
        "net_r": round(net_r, 2),
        "avg_r": round(avg_r, 3),
        "pf": pf,
        "max_dd": round(max_dd, 2),
    }


def main():
    print("=" * 80)
    print("AUDITING UNSEEN 2020–2023 PERFORMANCE ACROSS ALL 4 PRODUCTION ENGINES")
    print("=" * 80)

    # 1. Load Data
    setups_1h = {}
    setups_4h = {}

    for sym in CRYPTOS:
        p1 = DATA_DIR / f"{sym}_1h.parquet"
        p4 = DATA_DIR / f"{sym}_4h.parquet"

        df1 = pd.read_parquet(p1)
        time_col = "open_time" if "open_time" in df1.columns else ("ot" if "ot" in df1.columns else df1.columns[0])
        df1["open_time"] = pd.to_datetime(df1[time_col], utc=True)
        for c in ["open", "high", "low", "close", "volume"]:
            df1[c] = df1[c].astype(float)
        df1 = df1[["open_time", "open", "high", "low", "close", "volume"]].sort_values("open_time").drop_duplicates("open_time").reset_index(drop=True)

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

        df1_feat = compute_features(df1)
        all_1h = generate_candidate_setups(df1_feat, sym, "1h")
        setups_1h[sym] = [t for t in all_1h if PAST_START <= t["entry_dt"] <= PAST_END]

        df4_feat = compute_features(df4)
        all_4h = generate_candidate_setups(df4_feat, sym, "4h")
        setups_4h[sym] = [t for t in all_4h if PAST_START <= t["entry_dt"] <= PAST_END]

    # Print Candidate counts
    print(f"\nBreakout Setups Generated in 2020-2023 Window:")
    total_cand_1h = sum(len(setups_1h[s]) for s in CRYPTOS)
    total_cand_4h = sum(len(setups_4h[s]) for s in CRYPTOS)
    for sym in CRYPTOS:
        print(f"  {sym:<8} | 1H Setups: {len(setups_1h[sym]):>4} | 4H Setups: {len(setups_4h[sym]):>4}")
    print(f"  TOTAL    | 1H Setups: {total_cand_1h:>4} | 4H Setups: {total_cand_4h:>4}\n")

    # -------------------------------------------------------------------------
    # RULE-BASED BASELINE (NO ML FILTER)
    # -------------------------------------------------------------------------
    all_rules_1h = []
    all_rules_4h = []
    for sym in CRYPTOS:
        all_rules_1h.extend(setups_1h[sym])
        all_rules_4h.extend(setups_4h[sym])
    all_rules_1h.sort(key=lambda x: x["entry_time_ms"])
    all_rules_4h.sort(key=lambda x: x["entry_time_ms"])

    stats_rules_1h = calc_stats(all_rules_1h)
    stats_rules_4h = calc_stats(all_rules_4h)

    print("--- PURE RULE-BASED (ZERO ML) ---")
    print(f"  1H Rules: {stats_rules_1h}")
    print(f"  4H Rules: {stats_rules_4h}\n")

    # -------------------------------------------------------------------------
    # ENGINE 1: UNIFIED 1H
    # -------------------------------------------------------------------------
    with open(SRC_MODELS_DIR / "unified_1h_7assets" / "model.json", "r") as f:
        mod_uni_1h = json.load(f)
    with open(SRC_MODELS_DIR / "unified_1h_7assets" / "metadata.json", "r") as f:
        meta_uni_1h = json.load(f)
    tau_uni_1h = meta_uni_1h.get("tau_star", meta_uni_1h.get("p_cutoff", 0.065))

    adm_uni_1h = []
    per_asset_uni_1h = {}
    for sym in CRYPTOS:
        per_asset_uni_1h[sym] = []
        for t in setups_1h[sym]:
            p = predict_tree_probability(mod_uni_1h, t["features"])
            if p >= tau_uni_1h:
                t_copy = dict(t)
                t_copy["prob"] = p
                adm_uni_1h.append(t_copy)
                per_asset_uni_1h[sym].append(t_copy)
    adm_uni_1h.sort(key=lambda x: x["entry_time_ms"])
    stats_uni_1h = calc_stats(adm_uni_1h)

    # -------------------------------------------------------------------------
    # ENGINE 2: DISTRIBUTED 1H
    # -------------------------------------------------------------------------
    adm_dist_1h = []
    per_asset_dist_1h = {}
    for sym in CRYPTOS:
        per_asset_dist_1h[sym] = []
        with open(SRC_MODELS_DIR / "distributed_1h_7assets" / sym / "model.json", "r") as f:
            mod_s = json.load(f)
        with open(SRC_MODELS_DIR / "distributed_1h_7assets" / sym / "metadata.json", "r") as f:
            meta_s = json.load(f)
        tau_s = meta_s.get("tau_star", 0.08)
        for t in setups_1h[sym]:
            p = predict_tree_probability(mod_s, t["features"])
            if p >= tau_s:
                t_copy = dict(t)
                t_copy["prob"] = p
                adm_dist_1h.append(t_copy)
                per_asset_dist_1h[sym].append(t_copy)
    adm_dist_1h.sort(key=lambda x: x["entry_time_ms"])
    stats_dist_1h = calc_stats(adm_dist_1h)

    # -------------------------------------------------------------------------
    # ENGINE 3: UNIFIED 4H
    # -------------------------------------------------------------------------
    with open(SRC_MODELS_DIR / "unified_4h_7assets" / "model.json", "r") as f:
        mod_uni_4h = json.load(f)
    with open(SRC_MODELS_DIR / "unified_4h_7assets" / "metadata.json", "r") as f:
        meta_uni_4h = json.load(f)
    tau_uni_4h = meta_uni_4h.get("tau_star", meta_uni_4h.get("p_cutoff", 0.060))

    adm_uni_4h = []
    per_asset_uni_4h = {}
    for sym in CRYPTOS:
        per_asset_uni_4h[sym] = []
        for t in setups_4h[sym]:
            p = predict_tree_probability(mod_uni_4h, t["features"])
            if p >= tau_uni_4h:
                t_copy = dict(t)
                t_copy["prob"] = p
                adm_uni_4h.append(t_copy)
                per_asset_uni_4h[sym].append(t_copy)
    adm_uni_4h.sort(key=lambda x: x["entry_time_ms"])
    stats_uni_4h = calc_stats(adm_uni_4h)

    # -------------------------------------------------------------------------
    # ENGINE 4: DISTRIBUTED 4H
    # -------------------------------------------------------------------------
    adm_dist_4h = []
    per_asset_dist_4h = {}
    for sym in CRYPTOS:
        per_asset_dist_4h[sym] = []
        with open(SRC_MODELS_DIR / "distributed_4h_7assets" / sym / "model.json", "r") as f:
            mod_s = json.load(f)
        with open(SRC_MODELS_DIR / "distributed_4h_7assets" / sym / "metadata.json", "r") as f:
            meta_s = json.load(f)
        tau_s = meta_s.get("tau_star", 0.07)
        for t in setups_4h[sym]:
            p = predict_tree_probability(mod_s, t["features"])
            if p >= tau_s:
                t_copy = dict(t)
                t_copy["prob"] = p
                adm_dist_4h.append(t_copy)
                per_asset_dist_4h[sym].append(t_copy)
    adm_dist_4h.sort(key=lambda x: x["entry_time_ms"])
    stats_dist_4h = calc_stats(adm_dist_4h)

    # Summary
    print("=" * 80)
    print("UNSEEN 2020-2023 TIMELINE (PRE-ETF ERA) BACKWARD TRANSFER RESULTS:")
    print("=" * 80)
    print(f"1. 1H Unified Engine     : {stats_uni_1h}")
    print(f"2. 1H Distributed Engine : {stats_dist_1h}")
    print(f"3. 4H Unified Engine     : {stats_uni_4h}")
    print(f"4. 4H Distributed Engine : {stats_dist_4h}")

    print("\n" + "=" * 80)
    print("PER-ASSET BREAKDOWN (2020-2023):")
    print("=" * 80)
    for sym in CRYPTOS:
        s_u1 = calc_stats(per_asset_uni_1h[sym])
        s_d1 = calc_stats(per_asset_dist_1h[sym])
        s_u4 = calc_stats(per_asset_uni_4h[sym])
        s_d4 = calc_stats(per_asset_dist_4h[sym])
        print(f"\n--- {sym} ---")
        print(f"  1H Unified     : {s_u1}")
        print(f"  1H Distributed : {s_d1}")
        print(f"  4H Unified     : {s_u4}")
        print(f"  4H Distributed : {s_d4}")


if __name__ == "__main__":
    main()
