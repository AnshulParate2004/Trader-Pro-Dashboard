import json
import pandas as pd
from pathlib import Path

with open('D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/src/data/live_unseen_prediction_logs.json', 'r') as f:
    logs = json.load(f)

breakouts = [e for e in logs if e.get('decision') == 'EXECUTED_TRADE' or 'rejected by AI meta-classifier' in e.get('decision_reason', '')]

df_logs = pd.DataFrame(breakouts)
print("=== LIVE BREAKOUT PROBABILITIES BY ASSET ===")
print(df_logs.groupby('symbol')['probability'].agg(['count', 'min', 'mean', 'max']))

import sys
sys.path.append('D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/research')
import audit_79_breakouts as ab

res = pd.DataFrame(ab.all_results)
res['prob'] = df_logs['probability'].values[:len(res)]

print("\n=== EXPECTANCY SWEEP ACROSS CUTOFF THRESHOLDS (ALL 79 BREAKOUTS) ===")
print("| Cutoff tau | Trades Taken | Trades Blocked | Win Rate (%) | Gross R | Net Return (R) | Avg Net R | Gold (GC=F) Trades |")
print("| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")

for tau in [0.035, 0.040, 0.045, 0.050, 0.055, 0.060, 0.0635, 0.070, 0.080, 0.090, 0.100]:
    sub = res[res['prob'] >= tau]
    n_trades = len(sub)
    n_blocked = len(res) - n_trades
    wins = len(sub[sub['net_r'] > 0])
    wr = (wins / n_trades * 100.0) if n_trades > 0 else 0.0
    gross_r = sub['gross_r'].sum() if n_trades > 0 else 0.0
    net_r = sub['net_r'].sum() if n_trades > 0 else 0.0
    avg_r = (net_r / n_trades) if n_trades > 0 else 0.0
    gold_trades = len(sub[sub['symbol'] == 'GC=F'])
    print(f"| **{tau:.4f}** | **{n_trades}** | {n_blocked} | {wr:.1f}% | {gross_r:+.2f}R | **{net_r:+.2f}R** | {avg_r:+.3f}R | {gold_trades} |")
