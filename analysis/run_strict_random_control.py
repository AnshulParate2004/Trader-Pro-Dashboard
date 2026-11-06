"""
STRICT REGIME-MATCHED RANDOM-ENTRY CONTROL & B2/B3 RECONCILIATION
================================================================
Reconciles trade counts between Phase B2 and Phase B3 on an identical unified chronological stateful simulator.
Implements a strict random-entry control matching:
1. Volatility Regime (ATR14 Quintile: Q1-Q5)
2. Time of Day (UTC Hour: 0-23)
Across 100 random seeds for 15M, 1H, and 4H timeframes.
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
    
    # Hours and ATR quintiles
    hours = df["open_time"].dt.hour.values
    # Compute ATR percentiles
    valid_atr = atrs[~np.isnan(atrs) & (atrs > 0)]
    atr_quintile_bins = np.percentile(valid_atr, [20, 40, 60, 80])
    atr_quintiles = np.digitize(atrs, atr_quintile_bins) # 0 to 4
    
    return df, c, h, l, atrs, donch_high, donch_low, hours, atr_quintiles

def simulate_chronological_trades(c, h, l, atrs, donch_high, donch_low, horizon: int, max_sl_pct: float = 0.05, pessimistic: bool = False):
    """
    Unified chronological stateful simulator:
    Evaluates trades bar-by-bar. While a trade is open, all intermediate signals are skipped.
    """
    n = len(c)
    trades = []
    last_exit_idx = -1
    
    for i in range(50, n - horizon):
        if i <= last_exit_idx:
            continue
        
        atr = atrs[i]
        if np.isnan(atr) or atr <= 0:
            continue
        
        is_long = c[i] > donch_high[i]
        is_short = c[i] < donch_low[i]
        
        if not is_long and not is_short:
            continue
        
        side = 1 if is_long else -1
        entry_p = c[i]
        sl_dist = min(1.0 * atr, max_sl_pct * entry_p)
        stop_pct = sl_dist / entry_p
        cost_in_r = TAKER_FRICTION / stop_pct
        
        tp_dist = 1.0 * sl_dist
        ratchet_dist = 0.30 * sl_dist
        locked_dist = 0.05 * sl_dist
        
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
        curr_sl = sl_price
        gross_r = 0.0
        exit_bar = i + horizon
        
        for step in range(1, horizon + 1):
            curr_idx = i + step
            h_bar = h[curr_idx]
            l_bar = l[curr_idx]
            
            if side == 1:
                hit_sl = (l_bar <= curr_sl)
                hit_tp = (h_bar >= tp_price)
                if hit_sl and hit_tp:
                    gross_r = (0.05 if ratchet_active else -1.0) if pessimistic else 1.0
                    exit_bar = curr_idx
                    break
                elif hit_sl:
                    gross_r = 0.05 if ratchet_active else -1.0
                    exit_bar = curr_idx
                    break
                elif hit_tp:
                    gross_r = 1.0
                    exit_bar = curr_idx
                    break
                else:
                    if not ratchet_active and h_bar >= ratchet_trig:
                        ratchet_active = True
                        curr_sl = locked_sl
            else:
                hit_sl = (h_bar >= curr_sl)
                hit_tp = (l_bar <= tp_price)
                if hit_sl and hit_tp:
                    gross_r = (0.05 if ratchet_active else -1.0) if pessimistic else 1.0
                    exit_bar = curr_idx
                    break
                elif hit_sl:
                    gross_r = 0.05 if ratchet_active else -1.0
                    exit_bar = curr_idx
                    break
                elif hit_tp:
                    gross_r = 1.0
                    exit_bar = curr_idx
                    break
                else:
                    if not ratchet_active and l_bar <= ratchet_trig:
                        ratchet_active = True
                        curr_sl = locked_sl
        else:
            exit_p = c[i + horizon]
            gross_r = ((exit_p - entry_p) / sl_dist) if side == 1 else ((entry_p - exit_p) / sl_dist)
            gross_r = float(np.clip(gross_r, -1.0, 1.0))
            exit_bar = i + horizon
            
        last_exit_idx = exit_bar
        net_r = gross_r - cost_in_r
        trades.append({
            "entry_idx": i,
            "exit_idx": exit_bar,
            "side": side,
            "gross_r": gross_r,
            "cost_in_r": cost_in_r,
            "net_r": net_r,
        })
        
    return trades

def evaluate_matched_random_control(c, h, l, atrs, hours, atr_quintiles, real_trades: List[Dict], horizon: int, max_sl_pct: float = 0.05, n_seeds: int = 100, pessimistic: bool = False):
    """
    Strict Regime-Matched Random Entry Control:
    For each trade in real_trades:
      Find candidate bars in the valid range [50, len(c) - horizon] that match:
      - identical time-of-day (hour)
      - identical volatility regime (ATR quintile)
    Across 100 seeds, sample matching entry bars and evaluate the identical exit logic.
    """
    n = len(c)
    n_trades = len(real_trades)
    
    # Pre-index candidate bars by (hour, quintile)
    regime_map: Dict[Tuple[int, int], List[int]] = {}
    for i in range(50, n - horizon):
        atr = atrs[i]
        if np.isnan(atr) or atr <= 0:
            continue
        hr = hours[i]
        q = atr_quintiles[i]
        key = (hr, q)
        if key not in regime_map:
            regime_map[key] = []
        regime_map[key].append(i)
        
    # Convert lists to numpy arrays for fast choice
    regime_arrays = {k: np.array(v) for k, v in regime_map.items()}
    
    # Real trade characteristics
    real_sides = [t["side"] for t in real_trades]
    real_hours = [hours[t["entry_idx"]] for t in real_trades]
    real_quintiles = [atr_quintiles[t["entry_idx"]] for t in real_trades]
    
    rand_gross_means = []
    rand_net_means = []
    
    for seed in range(n_seeds):
        rng = np.random.default_rng(seed + 42000)
        
        # Sample matched entries
        sample_indices = []
        for idx in range(n_trades):
            hr = real_hours[idx]
            q = real_quintiles[idx]
            candidates = regime_arrays.get((hr, q))
            if candidates is not None and len(candidates) > 0:
                chosen = rng.choice(candidates)
            else:
                chosen = rng.integers(50, n - horizon)
            sample_indices.append(chosen)
            
        sample_indices = np.array(sample_indices)
        
        # Evaluate exits for the sample
        gross_list = []
        net_list = []
        
        for k in range(n_trades):
            i = sample_indices[k]
            side = real_sides[k]
            entry_p = c[i]
            atr = atrs[i]
            sl_dist = min(1.0 * atr, max_sl_pct * entry_p)
            stop_pct = sl_dist / entry_p
            cost_in_r = TAKER_FRICTION / stop_pct
            
            tp_dist = 1.0 * sl_dist
            ratchet_dist = 0.30 * sl_dist
            locked_dist = 0.05 * sl_dist
            
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
            curr_sl = sl_price
            gross_r = 0.0
            
            for step in range(1, horizon + 1):
                curr_idx = i + step
                h_bar = h[curr_idx]
                l_bar = l[curr_idx]
                
                if side == 1:
                    hit_sl = (l_bar <= curr_sl)
                    hit_tp = (h_bar >= tp_price)
                    if hit_sl and hit_tp:
                        gross_r = (0.05 if ratchet_active else -1.0) if pessimistic else 1.0
                        break
                    elif hit_sl:
                        gross_r = 0.05 if ratchet_active else -1.0
                        break
                    elif hit_tp:
                        gross_r = 1.0
                        break
                    else:
                        if not ratchet_active and h_bar >= ratchet_trig:
                            ratchet_active = True
                            curr_sl = locked_sl
                else:
                    hit_sl = (h_bar >= curr_sl)
                    hit_tp = (l_bar <= tp_price)
                    if hit_sl and hit_tp:
                        gross_r = (0.05 if ratchet_active else -1.0) if pessimistic else 1.0
                        break
                    elif hit_sl:
                        gross_r = 0.05 if ratchet_active else -1.0
                        break
                    elif hit_tp:
                        gross_r = 1.0
                        break
                    else:
                        if not ratchet_active and l_bar <= ratchet_trig:
                            ratchet_active = True
                            curr_sl = locked_sl
            else:
                exit_p = c[i + horizon]
                gross_r = ((exit_p - entry_p) / sl_dist) if side == 1 else ((entry_p - exit_p) / sl_dist)
                gross_r = float(np.clip(gross_r, -1.0, 1.0))
                
            gross_list.append(gross_r)
            net_list.append(gross_r - cost_in_r)
            
        rand_gross_means.append(np.mean(gross_list))
        rand_net_means.append(np.mean(net_list))
        
    return np.array(rand_gross_means), np.array(rand_net_means)

def run_all():
    print("=" * 80)
    print("PHASE F: UNIFIED TRADE SET RECONCILIATION & STRICT MATCHED RANDOM CONTROL")
    print("=" * 80)
    
    tfs = [
        ("15M", 12, 0.05),
        ("1H", 24, 0.05),
        ("4H", 30, 0.05),
    ]
    
    results = []
    
    for tf, horizon, max_sl in tfs:
        print(f"\nProcessing {tf} (Horizon = {horizon} bars)...")
        df, c, h, l, atrs, donch_high, donch_low, hours, atr_quintiles = load_data(tf)
        
        # 1. Real Model on Unified Simulator
        real_trades = simulate_chronological_trades(c, h, l, atrs, donch_high, donch_low, horizon, max_sl, pessimistic=False)
        n_trades = len(real_trades)
        
        real_gross = np.array([t["gross_r"] for t in real_trades])
        real_net = np.array([t["net_r"] for t in real_trades])
        
        real_gross_mean = float(real_gross.mean())
        real_net_mean = float(real_net.mean())
        
        # Bootstrap 95% CI for Real Net R
        rng = np.random.default_rng(42)
        boot_means = [np.mean(rng.choice(real_net, size=n_trades, replace=True)) for _ in range(5000)]
        ci_lower = float(np.percentile(boot_means, 2.5))
        ci_upper = float(np.percentile(boot_means, 97.5))
        
        # 2. Strict Regime-Matched Random Control (100 Seeds)
        print(f"  Running 100-seed strict regime-matched control (matched on hour & ATR quintile)...")
        rand_gross, rand_net = evaluate_matched_random_control(
            c, h, l, atrs, hours, atr_quintiles, real_trades, horizon, max_sl, n_seeds=100, pessimistic=False
        )
        
        rg_mean = float(rand_gross.mean())
        rg_p5 = float(np.percentile(rand_gross, 5))
        rg_p95 = float(np.percentile(rand_gross, 95))
        
        rn_mean = float(rand_net.mean())
        rn_p5 = float(np.percentile(rand_net, 5))
        rn_p95 = float(np.percentile(rand_net, 95))
        
        gross_edge = real_gross_mean - rg_mean
        p_val_gross = float((rand_gross >= real_gross_mean).mean())
        
        print(f"  N Trades: {n_trades}")
        print(f"  Real Gross R: {real_gross_mean:+.4f}R | Real Net R: {real_net_mean:+.4f}R (95% CI: [{ci_lower:+.4f}, {ci_upper:+.4f}])")
        print(f"  Matched Random Gross R: {rg_mean:+.4f}R (5th-95th: [{rg_p5:+.4f}, {rg_p95:+.4f}])")
        print(f"  Matched Random Net R:   {rn_mean:+.4f}R (5th-95th: [{rn_p5:+.4f}, {rn_p95:+.4f}])")
        print(f"  Gross Edge over Matched Random: {gross_edge:+.4f}R (p-val = {p_val_gross:.4f})")
        
        results.append({
            "tf": tf,
            "n_trades": n_trades,
            "real_gross": real_gross_mean,
            "real_net": real_net_mean,
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "rand_gross_mean": rg_mean,
            "rand_gross_p5": rg_p5,
            "rand_gross_p95": rg_p95,
            "rand_net_mean": rn_mean,
            "rand_net_p5": rn_p5,
            "rand_net_p95": rn_p95,
            "gross_edge": gross_edge,
            "p_val_gross": p_val_gross,
        })
        
    return results

if __name__ == "__main__":
    run_all()
