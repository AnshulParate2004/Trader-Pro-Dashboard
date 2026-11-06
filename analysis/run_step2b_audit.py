"""
STEP 2b: RIGOROUS SIMULATOR BIAS AUDIT, PAIRED RECONCILIATION, & THREE-MODE BENCHMARK
======================================================================================
1. Recomputes per-trade paired arithmetic (identical stop distance & cost-in-R).
2. Benchmarks three modes: OLD, MIDDLE, STRICT across synthetic noise & real data.
3. Donchian-only vs Real model with 10,000 bootstrap CIs.
"""

import os
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple

DATA_DIR = r"D:\Projects_Main\Trade-Pro\Trader-Pro\notebooks\data"
TAKER_FRICTION = 0.001144 # 0.1144% round-trip taker friction

def load_data(tf: str):
    p_path = os.path.join(DATA_DIR, tf, f"BTCUSDT_{tf}.parquet")
    df = pd.read_parquet(p_path)
    df["open_time"] = pd.to_datetime(df["open_time"], utc=True)
    df = df.sort_values("open_time").reset_index(drop=True)
    
    o = df["open"].values
    c = df["close"].values
    h = df["high"].values
    l = df["low"].values
    
    c_s = pd.Series(c)
    h_s = pd.Series(h)
    l_s = pd.Series(l)
    prev_c = c_s.shift(1)
    tr = np.maximum(h_s - l_s, np.maximum((h_s - prev_c).abs(), (l_s - prev_c).abs()))
    atrs = tr.ewm(alpha=1/14, adjust=False, min_periods=14).mean().values
    
    donch_high = h_s.rolling(20).max().shift(1).values
    donch_low = l_s.rolling(20).min().shift(1).values
    
    hours = df["open_time"].dt.hour.values
    valid_atr = atrs[~np.isnan(atrs) & (atrs > 0)]
    atr_quintile_bins = np.percentile(valid_atr, [20, 40, 60, 80])
    atr_quintiles = np.digitize(atrs, atr_quintile_bins)
    
    return df, o, c, h, l, atrs, donch_high, donch_low, hours, atr_quintiles

# ---------------------------------------------------------------------------
# SINGLE TRADE SIMULATION FUNCTION
# ---------------------------------------------------------------------------

def simulate_trade_path(o, c, h, l, entry_bar: int, entry_p: float, side: int, sl_dist: float, horizon: int, mode: str, rng: np.random.Generator = None) -> float:
    """
    Evaluates the trade outcome starting from entry_bar.
    Modes:
      - 'old': optimistic same-candle (TP first), same-candle ratchet arming, exact +0.05R BE credit.
      - 'middle': 50/50 same-candle resolution, ratchet arms for next bar, true 0.00R BE fill.
      - 'strict': pessimistic same-candle (SL first), ratchet arms for next bar, true 0.00R BE fill, gap fill at open.
    """
    n = len(c)
    tp_dist = 1.0 * sl_dist
    ratchet_dist = 0.30 * sl_dist
    locked_r = 0.05 if mode == "old" else 0.00
    locked_dist = locked_r * sl_dist
    
    if side == 1:
        sl_price = entry_p - sl_dist
        tp_price = entry_p + tp_dist
        ratchet_trig = entry_p + ratchet_dist
        locked_sl = entry_p + locked_dist
    else:
        sl_price = entry_p + sl_dist
        tp_price = entry_p - tp_dist
        ratchet_trig = entry_p - ratchet_dist
        locked_sl = entry_p - locked_dist
        
    ratchet_active = False
    ratchet_armed_on_candle = -1
    
    for step in range(1, horizon + 1):
        curr_idx = entry_bar + step
        if curr_idx >= n:
            break
            
        o_bar = o[curr_idx]
        h_bar = h[curr_idx]
        l_bar = l[curr_idx]
        
        # Ratchet is active only from subsequent bar in middle and strict modes
        if mode == "old":
            is_ratchet_live = ratchet_active
        else:
            is_ratchet_live = ratchet_active and (curr_idx > ratchet_armed_on_candle)
            
        effective_sl = locked_sl if is_ratchet_live else sl_price
        
        if side == 1:
            hit_sl = l_bar <= effective_sl
            hit_tp = h_bar >= tp_price
            gap_sl = (mode == "strict") and (o_bar <= effective_sl)
            
            if hit_sl and hit_tp:
                if mode == "old":
                    return 1.0 # Optimistic: TP first
                elif mode == "strict":
                    actual_exit_p = min(effective_sl, o_bar) if gap_sl else effective_sl
                    return (actual_exit_p - entry_p) / sl_dist
                else: # middle: 50/50 resolution
                    tp_first = rng.random() < 0.5 if rng else True
                    if tp_first:
                        return 1.0
                    else:
                        return (effective_sl - entry_p) / sl_dist
            elif hit_sl:
                if mode == "strict":
                    actual_exit_p = min(effective_sl, o_bar) if gap_sl else effective_sl
                    return (actual_exit_p - entry_p) / sl_dist
                else:
                    return (effective_sl - entry_p) / sl_dist
            elif hit_tp:
                return 1.0
            else:
                if not ratchet_active and h_bar >= ratchet_trig:
                    ratchet_active = True
                    ratchet_armed_on_candle = curr_idx
                    if mode == "old":
                        effective_sl = locked_sl
        else: # Short
            hit_sl = h_bar >= effective_sl
            hit_tp = l_bar <= tp_price
            gap_sl = (mode == "strict") and (o_bar >= effective_sl)
            
            if hit_sl and hit_tp:
                if mode == "old":
                    return 1.0
                elif mode == "strict":
                    actual_exit_p = max(effective_sl, o_bar) if gap_sl else effective_sl
                    return (entry_p - actual_exit_p) / sl_dist
                else: # middle
                    tp_first = rng.random() < 0.5 if rng else True
                    if tp_first:
                        return 1.0
                    else:
                        return (entry_p - effective_sl) / sl_dist
            elif hit_sl:
                if mode == "strict":
                    actual_exit_p = max(effective_sl, o_bar) if gap_sl else effective_sl
                    return (entry_p - actual_exit_p) / sl_dist
                else:
                    return (entry_p - effective_sl) / sl_dist
            elif hit_tp:
                return 1.0
            else:
                if not ratchet_active and l_bar <= ratchet_trig:
                    ratchet_active = True
                    ratchet_armed_on_candle = curr_idx
                    if mode == "old":
                        effective_sl = locked_sl
    else:
        # Horizon expiry
        exit_p = c[min(entry_bar + horizon, n - 1)]
        gross_r = ((exit_p - entry_p) / sl_dist) if side == 1 else ((entry_p - exit_p) / sl_dist)
        return float(np.clip(gross_r, -1.0, 1.0))

# ---------------------------------------------------------------------------
# DATASET SIMULATION EXTRACTOR
# ---------------------------------------------------------------------------

def extract_chronological_trades(df, o, c, h, l, atrs, donch_high, donch_low, horizon: int, max_sl: float = 0.05, mode: str = "strict", seed: int = 42):
    n = len(c)
    rng = np.random.default_rng(seed)
    trades = []
    last_exit = -1
    
    long_mask = c > donch_high
    short_mask = c < donch_low
    
    for i in range(50, n - horizon - 1):
        # Entry bar check: in strict/middle, entry is open[i+1], so bar i+1 must be free
        entry_bar = i if mode == "old" else i + 1
        if entry_bar <= last_exit:
            continue
            
        atr = atrs[i]
        if np.isnan(atr) or atr <= 0:
            continue
            
        is_l = long_mask[i]
        is_s = short_mask[i]
        if not is_l and not is_s:
            continue
            
        side = 1 if is_l else -1
        entry_p = c[i] if mode == "old" else o[i + 1]
        sl_dist = min(1.0 * atr, max_sl * entry_p)
        stop_pct = sl_dist / entry_p
        cost_in_r = TAKER_FRICTION / stop_pct
        
        gross_r = simulate_trade_path(o, c, h, l, entry_bar, entry_p, side, sl_dist, horizon, mode, rng)
        net_r = gross_r - cost_in_r
        
        # Advance last_exit to prevent concurrent overlaps
        last_exit = entry_bar + horizon
        
        trades.append({
            "signal_bar": i,
            "entry_bar": entry_bar,
            "side": side,
            "entry_p": entry_p,
            "sl_dist": sl_dist,
            "stop_pct": stop_pct,
            "cost_in_r": cost_in_r,
            "gross_r": gross_r,
            "net_r": net_r,
        })
        
    return trades

# ---------------------------------------------------------------------------
# 1. SYNTHETIC NOISE BENCHMARK: OLD VS MIDDLE VS STRICT
# ---------------------------------------------------------------------------

def run_synthetic_noise_three_modes(tf: str, n_bars: int = 40000, n_seeds: int = 100):
    df, o, c, h, l, atrs, _, _, _, _ = load_data(tf)
    real_log_ret = np.diff(np.log(c))
    real_sigma = np.std(real_log_ret)
    horizon = 12 if tf == "15M" else (24 if tf == "1H" else 30)
    
    results = {"old_gbm": [], "middle_gbm": [], "strict_gbm": [],
               "old_boot": [], "middle_boot": [], "strict_boot": []}
               
    block_size = 24
    n_blocks = n_bars // block_size + 1
    
    for seed in range(n_seeds):
        rng = np.random.default_rng(seed + 1000)
        
        # (a) GBM
        gbm_ret = rng.normal(0.0, real_sigma, size=n_bars)
        gbm_close = 10000.0 * np.exp(np.cumsum(gbm_ret))
        gbm_open = np.roll(gbm_close, 1)
        gbm_open[0] = 10000.0
        intra = np.abs(rng.normal(0.0, real_sigma * 0.8, size=n_bars))
        gbm_high = np.maximum(gbm_open, gbm_close) * (1.0 + intra)
        gbm_low = np.minimum(gbm_open, gbm_close) * (1.0 - intra)
        gbm_tr = np.maximum(gbm_high - gbm_low, np.maximum(np.abs(gbm_high - gbm_open), np.abs(gbm_low - gbm_open)))
        gbm_atrs = pd.Series(gbm_tr).ewm(alpha=1/14, adjust=False).mean().values
        
        # (b) Block-Bootstrapped Detrended
        block_starts = rng.integers(0, len(real_log_ret) - block_size, size=n_blocks)
        signs = np.where(rng.random(size=n_blocks) < 0.5, 1, -1)
        boot_ret = np.concatenate([real_log_ret[s:s+block_size] * signs[b] for b, s in enumerate(block_starts)])[:n_bars]
        boot_close = 10000.0 * np.exp(np.cumsum(boot_ret))
        boot_open = np.roll(boot_close, 1)
        boot_open[0] = 10000.0
        boot_high = np.maximum(boot_open, boot_close) * (1.0 + intra)
        boot_low = np.minimum(boot_open, boot_close) * (1.0 - intra)
        boot_tr = np.maximum(boot_high - boot_low, np.maximum(np.abs(boot_high - boot_open), np.abs(boot_low - boot_open)))
        boot_atrs = pd.Series(boot_tr).ewm(alpha=1/14, adjust=False).mean().values
        
        # Test 1000 random entries on GBM & Boot
        entries = np.arange(50, n_bars - horizon - 2, horizon + 1)[:1000]
        sides = np.where(rng.random(size=len(entries)) < 0.5, 1, -1)
        
        for m in ["old", "middle", "strict"]:
            # GBM
            g_gbm = [simulate_trade_path(gbm_open, gbm_close, gbm_high, gbm_low, e if m=="old" else e+1,
                                         gbm_close[e] if m=="old" else gbm_open[e+1], s,
                                         min(1.0 * gbm_atrs[e], 0.05 * gbm_close[e]), horizon, m, rng)
                     for e, s in zip(entries, sides)]
            results[f"{m}_gbm"].append(np.mean(g_gbm))
            
            # Boot
            g_boot = [simulate_trade_path(boot_open, boot_close, boot_high, boot_low, e if m=="old" else e+1,
                                          boot_close[e] if m=="old" else boot_open[e+1], s,
                                          min(1.0 * boot_atrs[e], 0.05 * boot_close[e]), horizon, m, rng)
                      for e, s in zip(entries, sides)]
            results[f"{m}_boot"].append(np.mean(g_boot))
            
    summary = {}
    for k, v in results.items():
        summary[k] = (float(np.mean(v)), float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5)))
    return summary

# ---------------------------------------------------------------------------
# 2. EXACT PAIRED COMPARISON & THREE MODES ON REAL DATA
# ---------------------------------------------------------------------------

def run_real_three_modes_and_paired(tf: str, horizon: int, max_sl: float = 0.05, n_seeds: int = 100):
    df, o, c, h, l, atrs, donch_high, donch_low, hours, atr_quintiles = load_data(tf)
    
    # Extract Real Trades in All 3 Modes
    real_old = extract_chronological_trades(df, o, c, h, l, atrs, donch_high, donch_low, horizon, max_sl, mode="old")
    real_mid = extract_chronological_trades(df, o, c, h, l, atrs, donch_high, donch_low, horizon, max_sl, mode="middle")
    real_str = extract_chronological_trades(df, o, c, h, l, atrs, donch_high, donch_low, horizon, max_sl, mode="strict")
    
    # Evaluate PAIRED Random Control on EXACT SAME real trade instances:
    # Same entry bar, same stop distance, same cost in R, but INDEPENDENT 50/50 direction
    # This guarantees per-trade identity: Delta_Net = Delta_Gross!
    
    paired_data = {}
    for mode_name, trade_list in [("old", real_old), ("middle", real_mid), ("strict", real_str)]:
        n_trades = len(trade_list)
        real_gross = np.array([t["gross_r"] for t in trade_list])
        real_cost = np.array([t["cost_in_r"] for t in trade_list])
        real_net = real_gross - real_cost
        
        rand_gross_seeds = []
        rand_net_seeds = []
        delta_gross_seeds = []
        delta_net_seeds = []
        
        for seed in range(n_seeds):
            rng = np.random.default_rng(seed + 9000)
            # Randomized direction at the EXACT SAME trades
            rand_sides = np.where(rng.random(size=n_trades) < 0.5, 1, -1)
            
            rg_list = []
            for idx, t in enumerate(trade_list):
                g = simulate_trade_path(o, c, h, l, t["entry_bar"], t["entry_p"], rand_sides[idx], t["sl_dist"], horizon, mode_name, rng)
                rg_list.append(g)
                
            rg = np.array(rg_list)
            rn = rg - real_cost # EXACT SAME cost in R
            
            d_gross = real_gross - rg
            d_net = real_net - rn # Note: d_net == d_gross identically!
            
            rand_gross_seeds.append(np.mean(rg))
            rand_net_seeds.append(np.mean(rn))
            delta_gross_seeds.append(np.mean(d_gross))
            delta_net_seeds.append(np.mean(d_net))
            
        # Bootstrap CI for Real Net R (10,000 resamples)
        rng_b = np.random.default_rng(42)
        boot_net = [np.mean(rng_b.choice(real_net, size=n_trades, replace=True)) for _ in range(10000)]
        boot_delta = [np.mean(rng_b.choice(delta_gross_seeds, size=len(delta_gross_seeds), replace=True)) for _ in range(10000)]
        
        paired_data[mode_name] = {
            "n_trades": n_trades,
            "real_gross_mean": float(np.mean(real_gross)),
            "real_net_mean": float(np.mean(real_net)),
            "real_net_ci": (float(np.percentile(boot_net, 2.5)), float(np.percentile(boot_net, 97.5))),
            "rand_gross_mean": float(np.mean(rand_gross_seeds)),
            "rand_net_mean": float(np.mean(rand_net_seeds)),
            "delta_gross_mean": float(np.mean(delta_gross_seeds)),
            "delta_net_mean": float(np.mean(delta_net_seeds)),
            "delta_ci": (float(np.percentile(boot_delta, 2.5)), float(np.percentile(boot_delta, 97.5))),
            "arithmetic_proof_delta_gross": float(np.mean(real_gross) - np.mean(rand_gross_seeds)),
            "arithmetic_proof_delta_net": float(np.mean(real_net) - np.mean(rand_net_seeds)),
        }
        
    return paired_data

def main():
    print("=" * 80)
    print("STEP 2b: SIMULATOR BIAS AUDIT, PAIRED RECONCILIATION, & THREE-MODE BENCHMARK")
    print("=" * 80)
    
    # 1. Noise Benchmark
    print("\n[PART 1] Running 100-Seed Noise Benchmark on 15M and 1H across OLD / MIDDLE / STRICT...")
    noise_15m = run_synthetic_noise_three_modes("15M", n_bars=40000, n_seeds=100)
    noise_1h = run_synthetic_noise_three_modes("1H", n_bars=30000, n_seeds=100)
    
    print("\n--- NOISE BENCHMARK RESULTS (EXPECTED GROSS ~ 0.0000R) ---")
    print(f"15M Synthetic GBM:")
    print(f"  OLD Mode:    {noise_15m['old_gbm'][0]:+.4f}R (95% CI: [{noise_15m['old_gbm'][1]:+.4f}, {noise_15m['old_gbm'][2]:+.4f}])")
    print(f"  MIDDLE Mode: {noise_15m['middle_gbm'][0]:+.4f}R (95% CI: [{noise_15m['middle_gbm'][1]:+.4f}, {noise_15m['middle_gbm'][2]:+.4f}])")
    print(f"  STRICT Mode: {noise_15m['strict_gbm'][0]:+.4f}R (95% CI: [{noise_15m['strict_gbm'][1]:+.4f}, {noise_15m['strict_gbm'][2]:+.4f}])")
    
    print(f"15M Block-Bootstrapped Detrended:")
    print(f"  OLD Mode:    {noise_15m['old_boot'][0]:+.4f}R (95% CI: [{noise_15m['old_boot'][1]:+.4f}, {noise_15m['old_boot'][2]:+.4f}])")
    print(f"  MIDDLE Mode: {noise_15m['middle_boot'][0]:+.4f}R (95% CI: [{noise_15m['middle_boot'][1]:+.4f}, {noise_15m['middle_boot'][2]:+.4f}])")
    print(f"  STRICT Mode: {noise_15m['strict_boot'][0]:+.4f}R (95% CI: [{noise_15m['strict_boot'][1]:+.4f}, {noise_15m['strict_boot'][2]:+.4f}])")

    print(f"1H Synthetic GBM:")
    print(f"  OLD Mode:    {noise_1h['old_gbm'][0]:+.4f}R (95% CI: [{noise_1h['old_gbm'][1]:+.4f}, {noise_1h['old_gbm'][2]:+.4f}])")
    print(f"  MIDDLE Mode: {noise_1h['middle_gbm'][0]:+.4f}R (95% CI: [{noise_1h['middle_gbm'][1]:+.4f}, {noise_1h['middle_gbm'][2]:+.4f}])")
    print(f"  STRICT Mode: {noise_1h['strict_gbm'][0]:+.4f}R (95% CI: [{noise_1h['strict_gbm'][1]:+.4f}, {noise_1h['strict_gbm'][2]:+.4f}])")

    # 2. Real Data Benchmark
    print("\n[PART 2] Running Real Data Benchmark Across 15M, 1H, 4H in Three Modes...")
    tfs = [("15M", 12, 0.05), ("1H", 24, 0.05), ("4H", 30, 0.05)]
    all_real_res = {}
    
    for tf, h, max_sl in tfs:
        print(f"\nProcessing {tf}...")
        res = run_real_three_modes_and_paired(tf, h, max_sl, n_seeds=100)
        all_real_res[tf] = res
        for m in ["old", "middle", "strict"]:
            d = res[m]
            print(f"  [{m.upper():6s}] N={d['n_trades']:5d} | Real Gross={d['real_gross_mean']:+.4f}R | Real Net={d['real_net_mean']:+.4f}R [{d['real_net_ci'][0]:+.4f}, {d['real_net_ci'][1]:+.4f}]")
            print(f"           Rand Gross={d['rand_gross_mean']:+.4f}R | Rand Net={d['rand_net_mean']:+.4f}R | Paired Delta={d['delta_gross_mean']:+.4f}R [{d['delta_ci'][0]:+.4f}, {d['delta_ci'][1]:+.4f}]")
            print(f"           Arithmetic Check: Real_G - Rand_G = {d['arithmetic_proof_delta_gross']:+.4f}R | Delta_Gross = {d['delta_gross_mean']:+.4f}R [DIFF: {abs(d['arithmetic_proof_delta_gross'] - d['delta_gross_mean']):.6f}]")
            print(f"           Arithmetic Check: Real_N - Rand_N = {d['arithmetic_proof_delta_net']:+.4f}R | Delta_Net   = {d['delta_net_mean']:+.4f}R [DIFF: {abs(d['arithmetic_proof_delta_net'] - d['delta_net_mean']):.6f}]")

    return noise_15m, noise_1h, all_real_res

if __name__ == "__main__":
    main()
