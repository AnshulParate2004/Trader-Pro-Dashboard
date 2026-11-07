"""
EVALUATION OF COST-AWARE 1H ENGINE VARIANT ("SLOW, SMALL")
Pre-registered protocol from docs/prereg/cost_aware_1h.md
"""

import os
import json
import urllib.request
import numpy as np
import pandas as pd

DATA_PATH = r"D:\Projects_Main\Trade-Pro\Trader-Pro\notebooks\data\1h\BTCUSDT_1h.parquet"

def load_full_1h_data():
    df_hist = pd.read_parquet(DATA_PATH)
    df_hist['open_time'] = pd.to_datetime(df_hist['open_time'], utc=True)
    df_hist = df_hist.sort_values('open_time').reset_index(drop=True)
    
    # Fetch recent candles to cover through 2026-11-07
    url = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=500"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
    
    df_recent = pd.DataFrame(data, columns=[
        'open_time', 'open', 'high', 'low', 'close', 'volume',
        'close_time', 'quote_volume', 'trades', 'taker_buy_base', 'taker_buy_quote', 'ignore'
    ])
    df_recent['open_time'] = pd.to_datetime(df_recent['open_time'], unit='ms', utc=True)
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df_recent[col] = df_recent[col].astype(float)
    
    last_hist_time = df_hist['open_time'].max()
    df_recent_new = df_recent[df_recent['open_time'] > last_hist_time]
    
    combined = pd.concat([df_hist[['open_time', 'open', 'high', 'low', 'close', 'volume']],
                          df_recent_new[['open_time', 'open', 'high', 'low', 'close', 'volume']]],
                         ignore_index=True)
    combined = combined.sort_values('open_time').reset_index(drop=True)
    return combined

def block_bootstrap_ci(data, L=20, B=1000, alpha=0.05):
    if len(data) == 0:
        return (0.0, 0.0)
    arr = np.array(data)
    n = len(arr)
    if n < L:
        L = max(1, n // 2)
    n_blocks = int(np.ceil(n / L))
    means = []
    for _ in range(B):
        idx = np.random.randint(0, max(1, n - L + 1), size=n_blocks)
        sample = np.concatenate([arr[i:i+L] for i in idx])[:n]
        means.append(np.mean(sample))
    low = np.percentile(means, 100 * (alpha / 2))
    high = np.percentile(means, 100 * (1 - alpha / 2))
    return (float(low), float(high))

def run_simulation(df, mode='A', friction=0.001144, apply_gate=True, max_cost_r=0.08, horizon=24, maker_expiry=2):
    o = df['open'].values
    c = df['close'].values
    h = df['high'].values
    l = df['low'].values
    t = df['open_time'].values
    
    c_s = pd.Series(c)
    h_s = pd.Series(h)
    l_s = pd.Series(l)
    prev_c = c_s.shift(1)
    tr = np.maximum(h_s - l_s, np.maximum((h_s - prev_c).abs(), (l_s - prev_c).abs()))
    atrs = tr.ewm(alpha=1/14, adjust=False, min_periods=14).mean().values
    
    donch_high = h_s.rolling(20).max().shift(1).values
    donch_low = l_s.rolling(20).min().shift(1).values
    
    n = len(c)
    long_mask = (c > donch_high) & (atrs > 0)
    short_mask = (c < donch_low) & (atrs > 0)
    
    signals = []
    trades = []
    last_exit_idx = -1
    
    for i in range(50, n - horizon - maker_expiry):
        if i <= last_exit_idx:
            continue
        is_long = long_mask[i]
        is_short = short_mask[i]
        if not is_long and not is_short:
            continue
            
        atr = atrs[i]
        if np.isnan(atr) or atr <= 0:
            continue
            
        side = 1 if is_long else -1
        signal_p = c[i]
        sl_dist = min(1.0 * atr, 0.05 * signal_p)
        stop_pct = sl_dist / signal_p
        cost_r = friction / stop_pct
        sig_time = pd.to_datetime(t[i], utc=True)
        
        sig_record = {
            'bar_idx': i,
            'time': sig_time,
            'side': side,
            'signal_price': signal_p,
            'stop_pct': stop_pct,
            'cost_r': cost_r,
            'skipped_gate': False,
            'filled': False,
            'net_r': 0.0,
            'gross_r': 0.0,
        }
        
        # Check gate
        if apply_gate and cost_r > max_cost_r:
            sig_record['skipped_gate'] = True
            signals.append(sig_record)
            continue
            
        # Entry execution
        if mode == 'A':
            # Mode A: Next-bar open fill
            entry_idx = i + 1
            entry_p = o[entry_idx]
            sig_record['filled'] = True
            sig_record['entry_price'] = entry_p
            sig_record['entry_time'] = pd.to_datetime(t[entry_idx], utc=True)
        elif mode == 'B':
            # Mode B: Maker limit at signal price, valid for maker_expiry bars
            filled = False
            fill_idx = -1
            for step in range(1, maker_expiry + 1):
                cur_idx = i + step
                if side == 1:
                    if l[cur_idx] <= signal_p:
                        filled = True
                        fill_idx = cur_idx
                        break
                else:
                    if h[cur_idx] >= signal_p:
                        filled = True
                        fill_idx = cur_idx
                        break
            if not filled:
                sig_record['filled'] = False
                sig_record['missed_maker'] = True
                signals.append(sig_record)
                continue
            entry_idx = fill_idx
            entry_p = signal_p
            sig_record['filled'] = True
            sig_record['entry_price'] = entry_p
            sig_record['entry_time'] = pd.to_datetime(t[entry_idx], utc=True)
            
        # Bracket simulation from entry_idx
        sl_price = entry_p - sl_dist if side == 1 else entry_p + sl_dist
        tp_price = entry_p + sl_dist if side == 1 else entry_p - sl_dist
        ratchet_trig = entry_p + 0.30 * sl_dist if side == 1 else entry_p - 0.30 * sl_dist
        locked_sl = entry_p
        
        ratchet_active = False
        curr_sl = sl_price
        gross_r = 0.0
        exit_bar = entry_idx + horizon
        
        for step in range(1, horizon + 1):
            cur_idx = entry_idx + step
            if cur_idx >= n:
                break
            h_bar = h[cur_idx]
            l_bar = l[cur_idx]
            
            if side == 1:
                hit_sl = (l_bar <= curr_sl)
                hit_tp = (h_bar >= tp_price)
                # STRICT FILL: SL evaluated before TP
                if hit_sl:
                    gross_r = 0.0 if ratchet_active else -1.0
                    exit_bar = cur_idx
                    break
                elif hit_tp:
                    gross_r = 1.0
                    exit_bar = cur_idx
                    break
                elif not ratchet_active and h_bar >= ratchet_trig:
                    ratchet_active = True
                    curr_sl = locked_sl
            else:
                hit_sl = (h_bar >= curr_sl)
                hit_tp = (l_bar <= tp_price)
                if hit_sl:
                    gross_r = 0.0 if ratchet_active else -1.0
                    exit_bar = cur_idx
                    break
                elif hit_tp:
                    gross_r = 1.0
                    exit_bar = cur_idx
                    break
                elif not ratchet_active and l_bar <= ratchet_trig:
                    ratchet_active = True
                    curr_sl = locked_sl
                    
            if step == horizon:
                exit_bar = cur_idx
                p_exit = c[cur_idx]
                p_ratio = (p_exit - entry_p) / entry_p
                gross_r = (side * p_ratio) / stop_pct
                
        net_r = gross_r - cost_r
        sig_record['gross_r'] = gross_r
        sig_record['net_r'] = net_r
        sig_record['exit_bar'] = exit_bar
        sig_record['exit_time'] = pd.to_datetime(t[exit_bar], utc=True)
        last_exit_idx = exit_bar
        
        signals.append(sig_record)
        trades.append(sig_record)
        
    return signals, trades

def evaluate_cohort(signals, trades, start_date=None, end_date=None):
    if start_date:
        sub_sigs = [s for s in signals if s['time'] >= pd.to_datetime(start_date, utc=True)]
    else:
        sub_sigs = signals
    if end_date:
        sub_sigs = [s for s in sub_sigs if s['time'] < pd.to_datetime(end_date, utc=True)]
        
    total_signals = len(sub_sigs)
    skipped_count = len([s for s in sub_sigs if s['skipped_gate']])
    skipped_share = skipped_count / total_signals if total_signals > 0 else 0.0
    
    filled_trades = [s for s in sub_sigs if s.get('filled', False)]
    trade_count = len(filled_trades)
    fill_rate = trade_count / (total_signals - skipped_count) if (total_signals - skipped_count) > 0 else 0.0
    
    if trade_count > 0:
        net_rs = [t['net_r'] for t in filled_trades]
        gross_rs = [t['gross_r'] for t in filled_trades]
        cost_rs = [t['cost_r'] for t in filled_trades]
        
        mean_net_r = float(np.mean(net_rs))
        mean_gross_r = float(np.mean(gross_rs))
        ci_net_r = block_bootstrap_ci(net_rs, L=20, B=1000)
        
        # Cumulative equity in R & Max Drawdown
        cum_r = np.cumsum(net_rs)
        peak = np.maximum.accumulate(cum_r)
        dd = peak - cum_r
        max_dd_r = float(np.max(dd)) if len(dd) > 0 else 0.0
        
        cost_dist = {
            'mean': float(np.mean(cost_rs)),
            'median': float(np.median(cost_rs)),
            'p10': float(np.percentile(cost_rs, 10)),
            'p90': float(np.percentile(cost_rs, 90)),
        }
    else:
        mean_net_r = 0.0
        mean_gross_r = 0.0
        ci_net_r = (0.0, 0.0)
        max_dd_r = 0.0
        cost_dist = {'mean': 0.0, 'median': 0.0, 'p10': 0.0, 'p90': 0.0}
        
    # Net R per signal (denominator = total signals)
    net_r_per_signal = float(np.sum([s['net_r'] for s in sub_sigs]) / total_signals) if total_signals > 0 else 0.0
    
    return {
        'total_signals': total_signals,
        'skipped_count': skipped_count,
        'skipped_share': skipped_share,
        'trade_count': trade_count,
        'fill_rate': fill_rate,
        'mean_gross_r': mean_gross_r,
        'mean_net_r': mean_net_r,
        'ci_net_r': ci_net_r,
        'net_r_per_signal': net_r_per_signal,
        'max_dd_r': max_dd_r,
        'cost_dist': cost_dist,
    }

def run_noise_null(df, n_walks=50, mode='A', friction=0.0050, apply_gate=True):
    # Fit zero-drift geometric Brownian motion matching historical BTC 1H
    log_ret = np.log(df['close'] / df['close'].shift(1)).dropna().values
    sigma = np.std(log_ret)
    n = len(df)
    
    null_means = []
    np.random.seed(42)
    for w in range(n_walks):
        sim_rets = np.random.normal(0.0, sigma, size=n)
        sim_prices = 10000.0 * np.exp(np.cumsum(sim_rets))
        
        # Build synthetic dataframe with same high/low spread
        spread = np.mean((df['high'] - df['low']) / df['close'])
        sim_h = sim_prices * (1.0 + spread / 2.0)
        sim_l = sim_prices * (1.0 - spread / 2.0)
        sim_o = pd.Series(sim_prices).shift(1).fillna(sim_prices[0]).values
        
        df_sim = pd.DataFrame({
            'open_time': df['open_time'],
            'open': sim_o,
            'high': sim_h,
            'low': sim_l,
            'close': sim_prices,
            'volume': df['volume'],
        })
        
        sigs, trs = run_simulation(df_sim, mode=mode, friction=friction, apply_gate=apply_gate)
        # Evaluate exploratory cohort
        res = evaluate_cohort(sigs, trs, end_date="2026-10-31")
        null_means.append(res['mean_net_r'])
        
    return {
        'n_walks': n_walks,
        'mean': float(np.mean(null_means)),
        'std': float(np.std(null_means)),
        'p5': float(np.percentile(null_means, 5)),
        'p50': float(np.percentile(null_means, 50)),
        'p95': float(np.percentile(null_means, 95)),
        'all_means': null_means,
    }

print("Loading full 1H dataset...")
df = load_full_1h_data()
print(f"Dataset range: {df['open_time'].min()} to {df['open_time'].max()}, N={len(df)}")

results = {}

# 1. Mode A at 14 bps (Without Gate vs With Gate)
print("\nRunning Mode A @ 14 bps (Ungated)...")
sigs_a14_ungated, trs_a14_ungated = run_simulation(df, mode='A', friction=0.001144, apply_gate=False)
results['mode_a_14_ungated_exp'] = evaluate_cohort(sigs_a14_ungated, trs_a14_ungated, end_date="2026-10-31")

print("Running Mode A @ 14 bps (Gated: cost_R <= 0.08)...")
sigs_a14_gated, trs_a14_gated = run_simulation(df, mode='A', friction=0.001144, apply_gate=True)
results['mode_a_14_gated_exp'] = evaluate_cohort(sigs_a14_gated, trs_a14_gated, end_date="2026-10-31")
results['mode_a_14_gated_oos'] = evaluate_cohort(sigs_a14_gated, trs_a14_gated, start_date="2026-10-31")

# 2. Mode A at 50 bps (Ungated vs Gated)
print("Running Mode A @ 50 bps (Ungated)...")
sigs_a50_ungated, trs_a50_ungated = run_simulation(df, mode='A', friction=0.005000, apply_gate=False)
results['mode_a_50_ungated_exp'] = evaluate_cohort(sigs_a50_ungated, trs_a50_ungated, end_date="2026-10-31")

print("Running Mode A @ 50 bps (Gated)...")
sigs_a50_gated, trs_a50_gated = run_simulation(df, mode='A', friction=0.005000, apply_gate=True)
results['mode_a_50_gated_exp'] = evaluate_cohort(sigs_a50_gated, trs_a50_gated, end_date="2026-10-31")
results['mode_a_50_gated_oos'] = evaluate_cohort(sigs_a50_gated, trs_a50_gated, start_date="2026-10-31")

# 3. Mode B at 14 bps (Gated)
print("Running Mode B @ 14 bps (Gated, Maker Limit)...")
sigs_b14_gated, trs_b14_gated = run_simulation(df, mode='B', friction=0.000525, apply_gate=True)
results['mode_b_14_gated_exp'] = evaluate_cohort(sigs_b14_gated, trs_b14_gated, end_date="2026-10-31")
results['mode_b_14_gated_oos'] = evaluate_cohort(sigs_b14_gated, trs_b14_gated, start_date="2026-10-31")

# 4. Mode B at 50 bps (Gated)
print("Running Mode B @ 50 bps (Gated, Maker Limit)...")
sigs_b50_gated, trs_b50_gated = run_simulation(df, mode='B', friction=0.005000, apply_gate=True)
results['mode_b_50_gated_exp'] = evaluate_cohort(sigs_b50_gated, trs_b50_gated, end_date="2026-10-31")
results['mode_b_50_gated_oos'] = evaluate_cohort(sigs_b50_gated, trs_b50_gated, start_date="2026-10-31")

# 5. Noise-Null Benchmark on 50 zero-drift walks
print("Running 50-series Noise-Null benchmark (Mode A @ 50 bps)...")
noise_null_50 = run_noise_null(df, n_walks=50, mode='A', friction=0.0050, apply_gate=True)
results['noise_null_50'] = {k: v for k, v in noise_null_50.items() if k != 'all_means'}

# Compute percentile of real result in noise null
real_net_r = results['mode_a_50_gated_exp']['mean_net_r']
percentile = float(np.mean(np.array(noise_null_50['all_means']) <= real_net_r) * 100.0)
results['real_percentile_vs_noise_null'] = percentile

# Save results
out_path = r"D:\Projects_Main\Trade-Pro\Trader-Pro-Dashboard\analysis\cost_aware_1h_results.json"
with open(out_path, 'w') as f:
    json.dump(results, f, indent=2)

print("\nSaved evaluation results to:", out_path)
print(json.dumps(results, indent=2))
