"""
Analysis: Quantitative Strategy Edge & Fee Friction Breakdown Report
Automated analysis across all models in src/models/*/trades_main.csv.
"""

import os
import glob
from pathlib import Path
import numpy as np
import pandas as pd
from scipy import stats

def compute_stop_pct(df: pd.DataFrame) -> float:
    """
    Computes median stop loss percentage from realized trade returns:
    stop% = median(abs(ret / R)) for trades where R != 0.
    """
    non_zero = df[df['R'].abs() > 1e-5]
    if len(non_zero) == 0:
        return 0.01  # Default 1.0%
    return float((non_zero['ret'].abs() / non_zero['R'].abs()).median())

def compute_cost_in_r(cost_pct: float, stop_pct: float) -> float:
    """
    Computes the friction cost expressed in R units:
    cost_in_R = round_trip_cost_% / stop_loss_%
    """
    if stop_pct <= 0:
        return 0.0
    return float(cost_pct / stop_pct)

def compute_breakeven_cost_pct(gross_avg_r: float, stop_pct: float) -> float:
    """
    Calculates the maximum round-trip exchange friction % that preserves non-negative net R:
    breakeven_cost_% = gross_avg_R * stop_%
    """
    return float(gross_avg_r * stop_pct)

def bootstrap_ci_95(data: np.ndarray, n_resamples: int = 10000, seed: int = 42) -> tuple[float, float]:
    """
    Calculates 95% bootstrap confidence interval for the sample mean using 10,000 resamples.
    """
    if len(data) == 0:
        return (0.0, 0.0)
    rng = np.random.default_rng(seed)
    indices = rng.integers(0, len(data), size=(n_resamples, len(data)))
    sample_means = data[indices].mean(axis=1)
    ci_lower = float(np.percentile(sample_means, 2.5))
    ci_upper = float(np.percentile(sample_means, 97.5))
    return (ci_lower, ci_upper)

def linear_trend_test(r_series: np.ndarray) -> dict:
    """
    Runs linear regression of R against trade sequence index to test for alpha decay.
    """
    if len(r_series) < 10:
        return {
            "slope": 0.0,
            "intercept": 0.0,
            "r_value": 0.0,
            "p_value": 1.0,
            "std_err": 0.0,
            "decay_detected": False,
        }
    x = np.arange(len(r_series))
    res = stats.linregress(x, r_series)
    return {
        "slope": float(res.slope),
        "intercept": float(res.intercept),
        "r_value": float(res.rvalue),
        "p_value": float(res.pvalue),
        "std_err": float(res.stderr),
        "decay_detected": bool(res.slope < 0 and res.pvalue < 0.05),
    }

def analyze_model_trades(csv_path: str) -> dict:
    df = pd.read_csv(csv_path)
    model_name = Path(csv_path).parent.name
    
    n_trades = len(df)
    if n_trades == 0:
        return {"model": model_name, "n_trades": 0}
        
    df['entry_time'] = pd.to_datetime(df['entry_time'], utc=True)
    df['exit_time'] = pd.to_datetime(df['exit_time'], utc=True)
    df = df.sort_values('entry_time').reset_index(drop=True)
    
    gross_avg_r = float(df['R'].mean())
    
    # Classify TP, BE, SL
    tp_mask = df['R'] >= 0.5
    be_mask = (df['R'] > -0.1) & (df['R'] < 0.5)
    sl_mask = df['R'] <= -0.1
    
    n_tp = int(tp_mask.sum())
    n_be = int(be_mask.sum())
    n_sl = int(sl_mask.sum())
    
    tp_pct = (n_tp / n_trades) * 100
    be_pct = (n_be / n_trades) * 100
    sl_pct = (n_sl / n_trades) * 100
    
    # True win rate = TP / (TP + SL)
    tp_sl_sum = n_tp + n_sl
    true_win_rate = (n_tp / tp_sl_sum * 100) if tp_sl_sum > 0 else 0.0
    
    # Stop % calculation
    stop_pct = compute_stop_pct(df)
    is_live_stop_mismatch = bool(stop_pct < 0.0035 or stop_pct > 0.0045)
    
    # Cost scenarios: 0.1144%, 0.08%, 0.05%
    cost_scenarios = {
        "0.1144% (Realistic Taker)": 0.001144,
        "0.0800% (Mid Taker)": 0.000800,
        "0.0500% (Maker/Optimistic)": 0.000500,
    }
    
    cost_metrics = {}
    r_arr = df['R'].to_numpy(dtype=float)
    
    for label, cost_val in cost_scenarios.items():
        cost_in_r = compute_cost_in_r(cost_val, stop_pct)
        net_r_arr = r_arr - cost_in_r
        net_avg_r = float(net_r_arr.mean())
        ci_low, ci_high = bootstrap_ci_95(net_r_arr)
        cost_metrics[label] = {
            "cost_val": cost_val,
            "cost_in_r": cost_in_r,
            "net_avg_r": net_avg_r,
            "ci_95": (ci_low, ci_high),
            "net_r_series": net_r_arr,
        }
        
    be_cost_pct = compute_breakeven_cost_pct(gross_avg_r, stop_pct)
    
    # Time breakdown: Year, Side, 6-Hour Block
    df['year'] = df['entry_time'].dt.year
    df['side_label'] = df['side'].map({1: 'LONG', -1: 'SHORT'})
    df['block_6h'] = df['entry_time'].dt.hour // 6
    block_map = {
        0: "00:00-05:59 UTC (Asia Morn)",
        1: "06:00-11:59 UTC (London Open)",
        2: "12:00-17:59 UTC (US Open)",
        3: "18:00-23:59 UTC (US Close)",
    }
    df['block_label'] = df['block_6h'].map(block_map)
    
    taker_cost_in_r = cost_metrics["0.1144% (Realistic Taker)"]["cost_in_r"]
    
    def get_breakdown(group_col):
        breakdowns = []
        for val, grp in df.groupby(group_col):
            n_sub = len(grp)
            gross_r_sub = float(grp['R'].mean())
            net_r_sub = gross_r_sub - taker_cost_in_r
            low_sample = n_sub < 100
            breakdowns.append({
                "bucket": str(val),
                "n": n_sub,
                "gross_avg_r": gross_r_sub,
                "net_avg_r_01144": net_r_sub,
                "low_sample": low_sample,
            })
        return breakdowns
        
    breakdown_year = get_breakdown('year')
    breakdown_side = get_breakdown('side_label')
    breakdown_block = get_breakdown('block_label')
    
    # Rolling 100-trade net R (under 0.1144% taker)
    net_r_series_taker = pd.Series(cost_metrics["0.1144% (Realistic Taker)"]["net_r_series"])
    rolling_100 = net_r_series_taker.rolling(100).mean().dropna()
    rolling_stats = {
        "n_rolling": len(rolling_100),
        "initial": float(rolling_100.iloc[0]) if len(rolling_100) > 0 else 0.0,
        "min": float(rolling_100.min()) if len(rolling_100) > 0 else 0.0,
        "max": float(rolling_100.max()) if len(rolling_100) > 0 else 0.0,
        "final": float(rolling_100.iloc[-1]) if len(rolling_100) > 0 else 0.0,
    }
    
    trend_result = linear_trend_test(cost_metrics["0.1144% (Realistic Taker)"]["net_r_series"])
    
    return {
        "model": model_name,
        "csv_path": csv_path,
        "n_trades": n_trades,
        "gross_avg_r": gross_avg_r,
        "n_tp": n_tp,
        "n_be": n_be,
        "n_sl": n_sl,
        "tp_pct": tp_pct,
        "be_pct": be_pct,
        "sl_pct": sl_pct,
        "true_win_rate": true_win_rate,
        "stop_pct": stop_pct,
        "is_live_stop_mismatch": is_live_stop_mismatch,
        "cost_metrics": cost_metrics,
        "be_cost_pct": be_cost_pct,
        "breakdown_year": breakdown_year,
        "breakdown_side": breakdown_side,
        "breakdown_block": breakdown_block,
        "rolling_stats": rolling_stats,
        "trend_result": trend_result,
    }

def generate_markdown_report(results: list[dict], output_path: str):
    lines = []
    lines.append("# Quantitative Strategy Edge & Fee Friction Breakdown Report")
    lines.append("")
    lines.append("> **Rigorous Empirical Analysis**: Analysis performed directly on all backtested and live trade logs across `src/models/*/trades_main.csv`.")
    lines.append("> Evaluated across 3 realistic round-trip exchange fee tiers with 10,000-resample bootstrap 95% confidence intervals.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Executive Summary of Models")
    lines.append("")
    lines.append("| Model / Timeframe | N Trades | Gross Avg R | TP % | BE % | SL % | True Win Rate | Median Stop% | Break-even Fee% | Net R (0.1144% Taker) | 95% Bootstrap CI |")
    lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    
    for r in results:
        if r["n_trades"] == 0:
            continue
        taker = r["cost_metrics"]["0.1144% (Realistic Taker)"]
        ci = taker["ci_95"]
        lines.append(
            f"| **{r['model']}** | {r['n_trades']:,} | `{r['gross_avg_r']:+.4f}R` | "
            f"{r['tp_pct']:.1f}% | {r['be_pct']:.1f}% | {r['sl_pct']:.1f}% | "
            f"**{r['true_win_rate']:.1f}%** | `{r['stop_pct']*100:.2f}%` | "
            f"`{r['be_cost_pct']*100:.4f}%` | **`{taker['net_avg_r']:+.4f}R`** | "
            f"`[{ci[0]:+.4f}, {ci[1]:+.4f}]R` |"
        )
    lines.append("")
    lines.append("---")
    lines.append("")

    for r in results:
        if r["n_trades"] == 0:
            continue
        lines.append(f"## Detailed Analysis: `{r['model']}`")
        lines.append("")
        lines.append(f"- **Sample Size**: {r['n_trades']:,} completed trades")
        lines.append(f"- **Gross Average Expectancy**: `{r['gross_avg_r']:+.4f}R` per trade")
        lines.append(f"- **Trade Exit Split**: TP: {r['n_tp']:,} ({r['tp_pct']:.1f}%) | BE: {r['n_be']:,} ({r['be_pct']:.1f}%) | SL: {r['n_sl']:,} ({r['sl_pct']:.1f}%)")
        lines.append(f"- **True Win Rate (TP / (TP + SL))**: **{r['true_win_rate']:.2f}%**")
        lines.append(f"- **Median Stop Distance**: `{r['stop_pct']*100:.3f}%` notional")
        
        if r['is_live_stop_mismatch']:
            lines.append(
                f"  > [!WARNING]\n"
                f"  > **Stop Distance Discrepancy**: Model stop distance is `{r['stop_pct']*100:.2f}%`. "
                f"Live scalp stops typically operate at `0.35% - 0.45%`. "
                f"A tighter live stop multiplies the fee friction in R terms (e.g. at 0.40% stop, 0.1144% friction = 0.286R/trade, "
                f"whereas at 1.00% stop, friction = 0.1144R/trade)."
            )
        else:
            lines.append("  > [!NOTE] Model stop distance matches live stop parameters (~0.35% - 0.45%).")
            
        lines.append(f"- **Break-even Exchange Cost**: `{r['be_cost_pct']*100:.4f}%` round trip. Any exchange fee above this threshold turns the model's net expectancy negative.")
        lines.append("")
        
        # Fee scenario table
        lines.append("### Net Expectancy Under Exchange Friction Scenarios")
        lines.append("")
        lines.append("| Scenario | Round-Trip Cost % | Cost in R | Net Avg R / Trade | 10,000-Resample 95% Bootstrap CI | Expectancy Verdict |")
        lines.append("| :--- | :---: | :---: | :---: | :---: | :---: |")
        for label, scen in r["cost_metrics"].items():
            ci = scen["ci_95"]
            verdict = "POSITIVE EDGE" if ci[0] > 0 else ("NEGATIVE EXPECTANCY" if ci[1] < 0 else "INCONCLUSIVE (CI CROSSES ZERO)")
            lines.append(
                f"| **{label}** | `{scen['cost_val']*100:.4f}%` | `{scen['cost_in_r']:.4f}R` | "
                f"**`{scen['net_avg_r']:+.4f}R`** | `[{ci[0]:+.4f}, {ci[1]:+.4f}]R` | `{verdict}` |"
            )
        lines.append("")

        # Rolling 100 & Trend test
        lines.append("### Alpha Stability & Decay Test")
        lines.append("")
        rol = r["rolling_stats"]
        tr = r["trend_result"]
        lines.append(f"- **Rolling 100-Trade Net R**: Initial = `{rol['initial']:+.4f}R` | Min = `{rol['min']:+.4f}R` | Max = `{rol['max']:+.4f}R` | Current = `{rol['final']:+.4f}R`")
        lines.append(f"- **Linear Trend Test (Slope per Trade)**: `{tr['slope']:.6e}R` (t-stat: `{tr['slope']/tr['std_err'] if tr['std_err']>0 else 0:.2f}`, p-value: `{tr['p_value']:.4f}`)")
        if tr['decay_detected']:
            lines.append("  > [!CAUTION] **Statistically Significant Alpha Decay Detected ($p < 0.05$, slope < 0)**. Expectancy has systematically declined over the dataset.")
        elif tr['p_value'] < 0.05 and tr['slope'] > 0:
            lines.append("  > [!NOTE] Statistically significant positive trend ($p < 0.05$).")
        else:
            lines.append("  > [!NOTE] Alpha trend is statistically indistinguishable from zero ($p \\ge 0.05$); no significant secular decay.")
        lines.append("")

        # Breakdown tables
        lines.append("### Breakdown by Year, Side, and 6-Hour UTC Block (Taker 0.1144% Friction)")
        lines.append("")
        
        # Year
        lines.append("#### Calendar Year Breakdown")
        lines.append("")
        lines.append("| Year | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |")
        lines.append("| :--- | :---: | :---: | :---: | :---: |")
        for b in r["breakdown_year"]:
            status = "Low Sample (<100)" if b["low_sample"] else "Sufficient"
            lines.append(f"| {b['bucket']} | {b['n']:,} | `{b['gross_avg_r']:+.4f}R` | `{b['net_avg_r_01144']:+.4f}R` | {status} |")
        lines.append("")

        # Side
        lines.append("#### Side Breakdown (Long vs Short)")
        lines.append("")
        lines.append("| Side | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |")
        lines.append("| :--- | :---: | :---: | :---: | :---: |")
        for b in r["breakdown_side"]:
            status = "Low Sample (<100)" if b["low_sample"] else "Sufficient"
            lines.append(f"| {b['bucket']} | {b['n']:,} | `{b['gross_avg_r']:+.4f}R` | `{b['net_avg_r_01144']:+.4f}R` | {status} |")
        lines.append("")

        # 6-Hour Block
        lines.append("#### 6-Hour UTC Session Block Breakdown")
        lines.append("")
        lines.append("| Session Block (UTC) | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |")
        lines.append("| :--- | :---: | :---: | :---: | :---: |")
        for b in r["breakdown_block"]:
            status = "Low Sample (<100)" if b["low_sample"] else "Sufficient"
            lines.append(f"| {b['bucket']} | {b['n']:,} | `{b['gross_avg_r']:+.4f}R` | `{b['net_avg_r_01144']:+.4f}R` | {status} |")
        lines.append("")
        lines.append("---")
        lines.append("")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

def main():
    root_dir = Path(__file__).resolve().parent.parent
    models_pattern = str(root_dir / "src" / "models" / "*" / "trades_main.csv")
    csv_files = sorted(glob.glob(models_pattern))
    
    if not csv_files:
        print(f"No trades_main.csv found matching {models_pattern}")
        return
        
    print(f"Found {len(csv_files)} model files to analyze:")
    for f in csv_files:
        print(f"  - {f}")
        
    results = []
    for f in csv_files:
        print(f"Analyzing {f}...")
        res = analyze_model_trades(f)
        results.append(res)
        
    output_dir = root_dir / "analysis"
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = output_dir / "EDGE_REPORT.md"
    
    generate_markdown_report(results, str(report_path))
    print(f"\nReport successfully generated at: {report_path}")

if __name__ == "__main__":
    main()
