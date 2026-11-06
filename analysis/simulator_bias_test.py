"""
SIMULATOR BIAS AUDIT & STRICT EXECUTION MODEL
==============================================
Institutional audit of simulator mechanics:
1. Synthetic random-walk (GBM & block-bootstrapped returns) with 50/50 random entries (100 seeds).
2. Decomposition of simulator upward bias factors.
3. Strict execution simulator:
   - Next-bar open entry fill (eliminates zero-latency signal close assumption)
   - Ratchet arming on NEXT candle (eliminates same-candle intra-bar ratchet triggers)
   - Pessimistic same-candle resolution (SL first)
   - Gap-aware fill (fills at worse of stop price or candle open)
4. Paired bootstrap 95% CI of (Real - Random) across 15M, 1H, 4H.
5. Donchian-only baseline vs LightGBM evaluation.
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
    
    # Donchian-20 Breakout
    donch_high = h_s.rolling(20).max().shift(1).values
    donch_low = l_s.rolling(20).min().shift(1).values
    
    hours = df["open_time"].dt.hour.values
    valid_atr = atrs[~np.isnan(atrs) & (atrs > 0)]
    atr_quintile_bins = np.percentile(valid_atr, [20, 40, 60, 80])
    atr_quintiles = np.digitize(atrs, atr_quintile_bins)
    
    return df, o, c, h, l, atrs, donch_high, donch_low, hours, atr_quintiles

# ---------------------------------------------------------------------------
# 1. SIMULATORS: ORIGINAL VS STRICT
# ---------------------------------------------------------------------------

def simulate_trades(o, c, h, l, atrs, entry_indices, entry_sides, horizon: int, max_sl_pct: float = 0.05, mode: str = "original"):
    """
    Simulates trades with either 'original' or 'strict' execution semantics.
    
    'original' mode:
      - Entry price: c[i] (signal close)
      - Same-candle TP/SL: optimistic (TP first)
      - Ratchet trigger: arms AND activates in the same candle
      - Breakeven fill: exact +0.05R
      - Gap handling: none (fills at stop price)
      
    'strict' mode:
      - Entry price: o[i+1] (next bar open)
      - Same-candle TP/SL: pessimistic (SL first)
      - Ratchet trigger: armed candle t, active strictly on candle t+1
      - Breakeven fill: 0.00R (or worse of locked SL and open price)
      - Gap handling: if bar opens past SL, fill at bar open
    """
    n = len(c)
    trades = []
    last_exit_idx = -1
    
    for idx, i in enumerate(entry_indices):
        if mode == "strict":
            if i >= n - horizon - 1 or i + 1 <= last_exit_idx:
                continue
            entry_p = o[i + 1] # Next candle open
            entry_bar = i + 1
        else:
            if i >= n - horizon or i <= last_exit_idx:
                continue
            entry_p = c[i] # Signal close
            entry_bar = i
            
        side = entry_sides[idx]
        atr = atrs[i]
        if np.isnan(atr) or atr <= 0:
            continue
            
        sl_dist = min(1.0 * atr, max_sl_pct * entry_p)
        stop_pct = sl_dist / entry_p
        cost_in_r = TAKER_FRICTION / stop_pct
        
        tp_dist = 1.0 * sl_dist
        ratchet_dist = 0.30 * sl_dist
        locked_r = 0.00 if mode == "strict" else 0.05
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
        curr_sl = sl_price
        gross_r = 0.0
        exit_bar = entry_bar + horizon
        
        for step in range(1, horizon + 1):
            curr_idx = entry_bar + step
            if curr_idx >= n:
                break
                
            o_bar = o[curr_idx]
            h_bar = h[curr_idx]
            l_bar = l[curr_idx]
            
            # In strict mode, ratchet only protects from next bar onward
            is_ratchet_live = ratchet_active and (mode != "strict" or curr_idx > ratchet_armed_on_candle)
            effective_sl = locked_sl if is_ratchet_live else sl_price
            
            if side == 1:
                # Gap check on open
                gap_sl = o_bar <= effective_sl
                hit_sl = (l_bar <= effective_sl) or gap_sl
                hit_tp = (h_bar >= tp_price)
                
                if hit_sl and hit_tp:
                    if mode == "strict":
                        # Pessimistic: SL first; fill at worse of SL or Open
                        actual_exit_p = min(effective_sl, o_bar) if gap_sl else effective_sl
                        gross_r = (actual_exit_p - entry_p) / sl_dist
                    else:
                        gross_r = 1.0 # Optimistic: TP first
                    exit_bar = curr_idx
                    break
                elif hit_sl:
                    if mode == "strict":
                        actual_exit_p = min(effective_sl, o_bar) if gap_sl else effective_sl
                        gross_r = (actual_exit_p - entry_p) / sl_dist
                    else:
                        gross_r = locked_r if is_ratchet_live else -1.0
                    exit_bar = curr_idx
                    break
                elif hit_tp:
                    gross_r = 1.0
                    exit_bar = curr_idx
                    break
                else:
                    # Check ratchet trigger
                    if not ratchet_active and h_bar >= ratchet_trig:
                        ratchet_active = True
                        ratchet_armed_on_candle = curr_idx
                        if mode != "strict":
                            curr_sl = locked_sl
            else: # Short
                gap_sl = o_bar >= effective_sl
                hit_sl = (h_bar >= effective_sl) or gap_sl
                hit_tp = (l_bar <= tp_price)
                
                if hit_sl and hit_tp:
                    if mode == "strict":
                        actual_exit_p = max(effective_sl, o_bar) if gap_sl else effective_sl
                        gross_r = (entry_p - actual_exit_p) / sl_dist
                    else:
                        gross_r = 1.0
                    exit_bar = curr_idx
                    break
                elif hit_sl:
                    if mode == "strict":
                        actual_exit_p = max(effective_sl, o_bar) if gap_sl else effective_sl
                        gross_r = (entry_p - actual_exit_p) / sl_dist
                    else:
                        gross_r = locked_r if is_ratchet_live else -1.0
                    exit_bar = curr_idx
                    break
                elif hit_tp:
                    gross_r = 1.0
                    exit_bar = curr_idx
                    break
                else:
                    if not ratchet_active and l_bar <= ratchet_trig:
                        ratchet_active = True
                        ratchet_armed_on_candle = curr_idx
                        if mode != "strict":
                            curr_sl = locked_sl
        else:
            # Time barrier expiry
            exit_p = c[min(entry_bar + horizon, n - 1)]
            gross_r = ((exit_p - entry_p) / sl_dist) if side == 1 else ((entry_p - exit_p) / sl_dist)
            gross_r = float(np.clip(gross_r, -1.0, 1.0))
            exit_bar = entry_bar + horizon
            
        last_exit_idx = exit_bar
        net_r = gross_r - cost_in_r
        trades.append({
            "entry_idx": entry_bar,
            "exit_idx": exit_bar,
            "side": side,
            "gross_r": gross_r,
            "cost_in_r": cost_in_r,
            "net_r": net_r,
        })
        
    return trades

# ---------------------------------------------------------------------------
# 2. SYNTHETIC RANDOM WALK BENCHMARK
# ---------------------------------------------------------------------------

def test_synthetic_random_walk(tf: str, n_bars: int = 50000, n_seeds: int = 100):
    """
    Generates synthetic random walk candles:
    (a) Geometric Brownian Motion with 0 drift and real asset volatility
    (b) Block-bootstrapped real returns (block size 24)
    Runs original simulator with 50/50 random entries.
    """
    df, o, c, h, l, atrs, _, _, _, _ = load_data(tf)
    real_log_ret = np.diff(np.log(c))
    real_sigma = np.std(real_log_ret)
    median_atr_pct = np.median(atrs[~np.isnan(atrs)] / c[~np.isnan(atrs)])
    horizon = 12 if tf == "15M" else (24 if tf == "1H" else 30)
    
    gbm_gross_means = []
    gbm_net_means = []
    boot_gross_means = []
    boot_net_means = []
    
    # Block bootstrap preparation
    block_size = 24
    n_blocks = n_bars // block_size + 1
    
    for seed in range(n_seeds):
        rng = np.random.default_rng(seed + 1000)
        
        # 1. GBM Random Walk
        gbm_ret = rng.normal(0.0, real_sigma, size=n_bars)
        gbm_close = 10000.0 * np.exp(np.cumsum(gbm_ret))
        gbm_open = np.roll(gbm_close, 1)
        gbm_open[0] = 10000.0
        # Realistic High/Low with intra-bar excursion
        intrades = np.abs(rng.normal(0.0, real_sigma * 0.8, size=n_bars))
        gbm_high = np.maximum(gbm_open, gbm_close) * (1.0 + intrades)
        gbm_low = np.minimum(gbm_open, gbm_close) * (1.0 - intrades)
        
        # Approximate ATR
        gbm_tr = np.maximum(gbm_high - gbm_low, np.maximum(np.abs(gbm_high - gbm_open), np.abs(gbm_low - gbm_open)))
        gbm_atrs = pd.Series(gbm_tr).ewm(alpha=1/14, adjust=False).mean().values
        
        # Random entries: sample ~2000 random entry bars with 50/50 direction
        gbm_entries = np.sort(rng.choice(np.arange(50, n_bars - horizon), size=2000, replace=False))
        gbm_sides = np.where(rng.random(size=len(gbm_entries)) < 0.5, 1, -1)
        
        trades_gbm = simulate_trades(gbm_open, gbm_close, gbm_high, gbm_low, gbm_atrs, gbm_entries, gbm_sides, horizon, mode="original")
        if len(trades_gbm) > 0:
            gbm_gross_means.append(np.mean([t["gross_r"] for t in trades_gbm]))
            gbm_net_means.append(np.mean([t["net_r"] for t in trades_gbm]))
            
        # 2. Block-Bootstrapped Real Returns
        block_starts = rng.integers(0, len(real_log_ret) - block_size, size=n_blocks)
        boot_ret = np.concatenate([real_log_ret[start:start+block_size] for start in block_starts])[:n_bars]
        # Invert sign 50% of the time to remove secular BTC drift
        signs = np.where(rng.random(size=n_blocks) < 0.5, 1, -1)
        boot_ret_detrended = np.concatenate([real_log_ret[start:start+block_size] * signs[b_idx] for b_idx, start in enumerate(block_starts)])[:n_bars]
        
        boot_close = 10000.0 * np.exp(np.cumsum(boot_ret_detrended))
        boot_open = np.roll(boot_close, 1)
        boot_open[0] = 10000.0
        boot_high = np.maximum(boot_open, boot_close) * (1.0 + intrades)
        boot_low = np.minimum(boot_open, boot_close) * (1.0 - intrades)
        boot_tr = np.maximum(boot_high - boot_low, np.maximum(np.abs(boot_high - boot_open), np.abs(boot_low - boot_open)))
        boot_atrs = pd.Series(boot_tr).ewm(alpha=1/14, adjust=False).mean().values
        
        boot_entries = np.sort(rng.choice(np.arange(50, n_bars - horizon), size=2000, replace=False))
        boot_sides = np.where(rng.random(size=len(boot_entries)) < 0.5, 1, -1)
        
        trades_boot = simulate_trades(boot_open, boot_close, boot_high, boot_low, boot_atrs, boot_entries, boot_sides, horizon, mode="original")
        if len(trades_boot) > 0:
            boot_gross_means.append(np.mean([t["gross_r"] for t in trades_boot]))
            boot_net_means.append(np.mean([t["net_r"] for t in trades_boot]))
            
    return {
        "gbm_gross": (float(np.mean(gbm_gross_means)), float(np.percentile(gbm_gross_means, 5)), float(np.percentile(gbm_gross_means, 95))),
        "gbm_net": (float(np.mean(gbm_net_means)), float(np.percentile(gbm_net_means, 5)), float(np.percentile(gbm_net_means, 95))),
        "boot_gross": (float(np.mean(boot_gross_means)), float(np.percentile(boot_gross_means, 5)), float(np.percentile(boot_gross_means, 95))),
        "boot_net": (float(np.mean(boot_net_means)), float(np.percentile(boot_net_means, 5)), float(np.percentile(boot_net_means, 95))),
    }

# ---------------------------------------------------------------------------
# 3. FULL TIMEFRAME AUDIT: REAL VS RANDOM IN STRICT MODE
# ---------------------------------------------------------------------------

def run_timeframe_audit(tf: str, horizon: int, max_sl: float = 0.05, n_seeds: int = 100):
    df, o, c, h, l, atrs, donch_high, donch_low, hours, atr_quintiles = load_data(tf)
    n = len(c)
    
    # 1. Pure Donchian Signal Generator
    long_mask = c > donch_high
    short_mask = c < donch_low
    
    donch_entries = []
    donch_sides = []
    last_exit = -1
    for i in range(50, n - horizon - 1):
        if i <= last_exit:
            continue
        if atrs[i] <= 0 or np.isnan(atrs[i]):
            continue
        if long_mask[i]:
            donch_entries.append(i)
            donch_sides.append(1)
            last_exit = i + 1
        elif short_mask[i]:
            donch_entries.append(i)
            donch_sides.append(-1)
            last_exit = i + 1
            
    donch_entries = np.array(donch_entries)
    donch_sides = np.array(donch_sides)
    
    # (A) Original Simulator Runs
    orig_trades = simulate_trades(o, c, h, l, atrs, donch_entries, donch_sides, horizon, max_sl, mode="original")
    orig_gross = np.array([t["gross_r"] for t in orig_trades])
    orig_net = np.array([t["net_r"] for t in orig_trades])
    
    # (B) Strict Simulator Runs
    strict_trades = simulate_trades(o, c, h, l, atrs, donch_entries, donch_sides, horizon, max_sl, mode="strict")
    strict_gross = np.array([t["gross_r"] for t in strict_trades])
    strict_net = np.array([t["net_r"] for t in strict_trades])
    
    # (C) Strict Matched Random Control with 50/50 Direction (100 Seeds)
    regime_map: Dict[Tuple[int, int], List[int]] = {}
    for i in range(50, n - horizon - 1):
        atr = atrs[i]
        if np.isnan(atr) or atr <= 0:
            continue
        key = (hours[i], atr_quintiles[i])
        if key not in regime_map:
            regime_map[key] = []
        regime_map[key].append(i)
    regime_arrays = {k: np.array(v) for k, v in regime_map.items()}
    
    strict_rand_gross_seeds = []
    strict_rand_net_seeds = []
    n_strict = len(strict_trades)
    
    trade_hours = [hours[t["entry_idx"]] for t in strict_trades]
    trade_qs = [atr_quintiles[t["entry_idx"]] for t in strict_trades]
    
    delta_gross_list = []
    delta_net_list = []
    
    for seed in range(n_seeds):
        rng = np.random.default_rng(seed + 8000)
        sample_entries = []
        for idx in range(n_strict):
            key = (trade_hours[idx], trade_qs[idx])
            cands = regime_arrays.get(key)
            if cands is not None and len(cands) > 0:
                sample_entries.append(rng.choice(cands))
            else:
                sample_entries.append(rng.integers(50, n - horizon - 1))
        sample_entries = np.array(sample_entries)
        # Truly random independent 50/50 direction (NOT inherited)
        sample_sides = np.where(rng.random(size=n_strict) < 0.5, 1, -1)
        
        rand_t = simulate_trades(o, c, h, l, atrs, sample_entries, sample_sides, horizon, max_sl, mode="strict")
        if len(rand_t) > 0:
            r_g = np.array([t["gross_r"] for t in rand_t])
            r_n = np.array([t["net_r"] for t in rand_t])
            strict_rand_gross_seeds.append(np.mean(r_g))
            strict_rand_net_seeds.append(np.mean(r_n))
            
            # Paired comparison with real strict trades (matched length)
            min_len = min(len(strict_gross), len(r_g))
            delta_gross_list.append(np.mean(strict_gross[:min_len] - r_g[:min_len]))
            delta_net_list.append(np.mean(strict_net[:min_len] - r_n[:min_len]))
            
    # Paired Bootstrap CI for (Real - Random)
    rng_b = np.random.default_rng(42)
    boot_deltas_g = [np.mean(rng_b.choice(delta_gross_list, size=len(delta_gross_list), replace=True)) for _ in range(5000)]
    boot_deltas_n = [np.mean(rng_b.choice(delta_net_list, size=len(delta_net_list), replace=True)) for _ in range(5000)]
    
    delta_g_ci = (float(np.percentile(boot_deltas_g, 2.5)), float(np.percentile(boot_deltas_g, 97.5)))
    delta_n_ci = (float(np.percentile(boot_deltas_n, 2.5)), float(np.percentile(boot_deltas_n, 97.5)))
    
    # Bootstrap CI for Real Strict Net R
    boot_strict_net = [np.mean(rng_b.choice(strict_net, size=len(strict_net), replace=True)) for _ in range(5000)]
    strict_net_ci = (float(np.percentile(boot_strict_net, 2.5)), float(np.percentile(boot_strict_net, 97.5)))
    
    return {
        "tf": tf,
        "n_orig": len(orig_trades),
        "orig_gross": float(np.mean(orig_gross)),
        "orig_net": float(np.mean(orig_net)),
        "n_strict": len(strict_trades),
        "strict_gross": float(np.mean(strict_gross)),
        "strict_net": float(np.mean(strict_net)),
        "strict_net_ci": strict_net_ci,
        "rand_strict_gross": (float(np.mean(strict_rand_gross_seeds)), float(np.percentile(strict_rand_gross_seeds, 5)), float(np.percentile(strict_rand_gross_seeds, 95))),
        "rand_strict_net": (float(np.mean(strict_rand_net_seeds)), float(np.percentile(strict_rand_net_seeds, 5)), float(np.percentile(strict_rand_net_seeds, 95))),
        "delta_gross_mean": float(np.mean(delta_gross_list)),
        "delta_gross_ci": delta_g_ci,
        "delta_net_mean": float(np.mean(delta_net_list)),
        "delta_net_ci": delta_n_ci,
    }

def main():
    print("=" * 80)
    print("STEP 2: SIMULATOR BIAS AUDIT & STRICT EXECUTION BENCHMARK")
    print("=" * 80)
    
    # Part 1: Synthetic Random Walk Test
    print("\n[PART 1] Running Simulator on Pure Synthetic Random Walk (GBM & Bootstrapped Returns)...")
    res_15m_synth = test_synthetic_random_walk("15M", n_bars=40000, n_seeds=100)
    print(f"  15M GBM Pure Noise (Expected ~0):")
    print(f"    Gross R: {res_15m_synth['gbm_gross'][0]:+.4f}R (5th-95th: [{res_15m_synth['gbm_gross'][1]:+.4f}, {res_15m_synth['gbm_gross'][2]:+.4f}])")
    print(f"    Net R:   {res_15m_synth['gbm_net'][0]:+.4f}R (5th-95th: [{res_15m_synth['gbm_net'][1]:+.4f}, {res_15m_synth['gbm_net'][2]:+.4f}])")
    print(f"  15M Block-Bootstrapped Detrended Returns (Expected ~0):")
    print(f"    Gross R: {res_15m_synth['boot_gross'][0]:+.4f}R (5th-95th: [{res_15m_synth['boot_gross'][1]:+.4f}, {res_15m_synth['boot_gross'][2]:+.4f}])")
    print(f"    Net R:   {res_15m_synth['boot_net'][0]:+.4f}R (5th-95th: [{res_15m_synth['boot_net'][1]:+.4f}, {res_15m_synth['boot_net'][2]:+.4f}])")
    
    res_1h_synth = test_synthetic_random_walk("1H", n_bars=30000, n_seeds=100)
    print(f"  1H GBM Pure Noise (Expected ~0):")
    print(f"    Gross R: {res_1h_synth['gbm_gross'][0]:+.4f}R (5th-95th: [{res_1h_synth['gbm_gross'][1]:+.4f}, {res_1h_synth['gbm_gross'][2]:+.4f}])")
    print(f"    Net R:   {res_1h_synth['gbm_net'][0]:+.4f}R (5th-95th: [{res_1h_synth['gbm_net'][1]:+.4f}, {res_1h_synth['gbm_net'][2]:+.4f}])")
    
    # Part 2: Timeframe Strict Mode Audits
    print("\n[PART 2] Running Strict Mode Audits Across 15M, 1H, 4H...")
    tfs = [("15M", 12, 0.05), ("1H", 24, 0.05), ("4H", 30, 0.05)]
    all_audit_res = []
    for tf, h, max_sl in tfs:
        print(f"\n  Auditing {tf}...")
        audit_res = run_timeframe_audit(tf, h, max_sl, n_seeds=100)
        all_audit_res.append(audit_res)
        print(f"    Original Mode: N={audit_res['n_orig']}, Gross={audit_res['orig_gross']:+.4f}R, Net={audit_res['orig_net']:+.4f}R")
        print(f"    Strict Mode:   N={audit_res['n_strict']}, Gross={audit_res['strict_gross']:+.4f}R, Net={audit_res['strict_net']:+.4f}R (95% CI: [{audit_res['strict_net_ci'][0]:+.4f}, {audit_res['strict_net_ci'][1]:+.4f}])")
        print(f"    Matched Random (Strict 50/50): Gross={audit_res['rand_strict_gross'][0]:+.4f}R, Net={audit_res['rand_strict_net'][0]:+.4f}R")
        print(f"    Paired Delta (Real - Random) Gross: {audit_res['delta_gross_mean']:+.4f}R (95% CI: [{audit_res['delta_gross_ci'][0]:+.4f}, {audit_res['delta_gross_ci'][1]:+.4f}])")
        print(f"    Paired Delta (Real - Random) Net:   {audit_res['delta_net_mean']:+.4f}R (95% CI: [{audit_res['delta_net_ci'][0]:+.4f}, {audit_res['delta_net_ci'][1]:+.4f}])")
        
    return res_15m_synth, all_audit_res

if __name__ == "__main__":
    main()
