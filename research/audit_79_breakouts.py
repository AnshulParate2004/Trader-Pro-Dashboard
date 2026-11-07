import json
import pandas as pd
from pathlib import Path

with open('D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/src/data/live_unseen_prediction_logs.json', 'r') as f:
    logs = json.load(f)

breakouts = [e for e in logs if e.get('decision') == 'EXECUTED_TRADE' or 'rejected by AI meta-classifier' in e.get('decision_reason', '')]

ROOT_DIR = Path('D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard')
import sys
sys.path.append(str(ROOT_DIR / 'research'))
from evaluate_live_unseen_window import fetch_binance_4h_klines, fetch_yahoo_1h_klines

dfs = {
    'BTCUSDT': fetch_binance_4h_klines('BTCUSDT'),
    'GC=F': fetch_yahoo_1h_klines('GC=F'),
    'SI=F': fetch_yahoo_1h_klines('SI=F'),
    'CL=F': fetch_yahoo_1h_klines('CL=F'),
}

all_results = []
for bo in breakouts:
    sym = bo['symbol']
    df = dfs[sym]
    ts_ms = bo['timestamp_ms']
    
    idx_matches = df.index[df['ot'] == ts_ms].tolist()
    if not idx_matches:
        continue
    i = idx_matches[0]
    c = float(df['close'].iloc[i])
    is_comm = '=F' in sym
    tb = 24 if is_comm else 12
    min_s = 0.010 if is_comm else 0.015
    max_s = 0.040 if is_comm else 0.060
    fric = 0.00059 if is_comm else 0.00118
    
    side = 'LONG'
    if is_comm and c < float(df['close'].rolling(200, min_periods=30).mean().iloc[i]):
        side = 'SHORT'
        
    if side == 'LONG':
        prev_l = float(df['low'].iloc[max(0, i-10):i].min())
        raw_dist = max(c - prev_l, c * min_s)
        clamped_stop = max(min_s, min(max_s, raw_dist / c))
        stop_dist = c * clamped_stop
        sl = c - stop_dist
        tp = c + 2.5 * stop_dist
    else:
        prev_h = float(df['high'].iloc[max(0, i-10):i].max())
        raw_dist = max(prev_h - c, c * min_s)
        clamped_stop = max(min_s, min(max_s, raw_dist / c))
        stop_dist = c * clamped_stop
        sl = c + stop_dist
        tp = c - 2.5 * stop_dist
        
    cost_r = fric / clamped_stop
    gross_r = 0.0
    exit_type = 'TIME'
    for fwd in range(1, tb + 1):
        if i + fwd >= len(df):
            break
        bh = float(df['high'].iloc[i + fwd])
        bl = float(df['low'].iloc[i + fwd])
        bc = float(df['close'].iloc[i + fwd])
        if side == 'LONG':
            if bl <= sl and bh >= tp:
                exit_type = 'STOP'; gross_r = -1.0; break
            elif bh >= tp:
                exit_type = 'TARGET'; gross_r = 2.5; break
            elif bl <= sl:
                exit_type = 'STOP'; gross_r = -1.0; break
            else:
                gross_r = (bc - c) / stop_dist
        else:
            if bh >= sl and bl <= tp:
                exit_type = 'STOP'; gross_r = -1.0; break
            elif bl <= tp:
                exit_type = 'TARGET'; gross_r = 2.5; break
            elif bh >= sl:
                exit_type = 'STOP'; gross_r = -1.0; break
            else:
                gross_r = (c - bc) / stop_dist
                
    net_r = gross_r - cost_r
    all_results.append({
        'symbol': sym,
        'passes_gate': bo['passes_gate'],
        'net_r': net_r,
        'gross_r': gross_r,
        'exit_type': exit_type,
        'cost_r': cost_r
    })

res_df = pd.DataFrame(all_results)
accepted = res_df[res_df['passes_gate'] == True]
rejected = res_df[res_df['passes_gate'] == False]

print(f"Total Evaluated Breakouts: {len(res_df)}")
print(f"\n--- ACCEPTED BY ML (26 trades) ---")
print(f"Count: {len(accepted)} | Wins: {len(accepted[accepted['net_r'] > 0])} | Losses: {len(accepted[accepted['net_r'] < 0])}")
print(f"Net Return R: {accepted['net_r'].sum():.2f}R | Gross R: {accepted['gross_r'].sum():.2f}R")
print(f"Win Rate: {len(accepted[accepted['net_r'] > 0]) / len(accepted) * 100:.1f}%")

print(f"\n--- REJECTED / BLOCKED BY ML (53 candidate signals) ---")
print(f"Count: {len(rejected)} | Wins: {len(rejected[rejected['net_r'] > 0])} | Losses: {len(rejected[rejected['net_r'] < 0])}")
print(f"Net Return R: {rejected['net_r'].sum():.2f}R | Gross R: {rejected['gross_r'].sum():.2f}R")
print(f"Win Rate: {len(rejected[rejected['net_r'] > 0]) / len(rejected) * 100:.1f}%")

print(f"\n--- IF PURE RULES WERE APPLIED (ALL 79 BREAKOUTS) ---")
print(f"Count: {len(res_df)} | Wins: {len(res_df[res_df['net_r'] > 0])} | Losses: {len(res_df[res_df['net_r'] < 0])}")
print(f"Net Return R: {res_df['net_r'].sum():.2f}R | Gross R: {res_df['gross_r'].sum():.2f}R")
print(f"Win Rate: {len(res_df[res_df['net_r'] > 0]) / len(res_df) * 100:.1f}%")
