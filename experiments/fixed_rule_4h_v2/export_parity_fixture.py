import os
import sys
import json
import pandas as pd
import numpy as np

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from experiments.fixed_rule_4h_v2.backtest import load_candles, load_config, run_candidate_generator, apply_portfolio_constraints

def main():
    cfg = load_config()
    btc_df = load_candles("BTCUSDT", "4h")
    
    # We want a slice containing bar 651 (the first signal) and surrounding bars.
    # Bars 400 to 670 give 271 bars, enough for 200-SMA warmup and the trade completion.
    t_sig = 651
    start_idx = t_sig - 205
    end_idx = t_sig + 25
    slice_df = btc_df.iloc[start_idx:end_idx].copy().reset_index(drop=True)
    
    # Generate candidates on the full backtest to get exact Trade 0
    all_cands = run_candidate_generator(cfg)
    trades = apply_portfolio_constraints(all_cands)
    trade_0 = trades[0]
    
    # Compute indicators at bar 651 relative to slice
    # In slice_df, signal bar is at index: 205
    sig_idx_in_slice = 205
    
    candles_export = []
    for idx, row in slice_df.iterrows():
        dt = pd.to_datetime(row['datetime'])
        open_time = int(dt.timestamp() * 1000)
        close_time = open_time + 4 * 3600 * 1000 - 1
        candles_export.append({
            "openTime": open_time,
            "open": float(row['open']),
            "high": float(row['high']),
            "low": float(row['low']),
            "close": float(row['close']),
            "volume": float(row['volume']),
            "closeTime": close_time,
            "datetime": dt.strftime('%Y-%m-%d %H:%M:%S')
        })

    fixture = {
        "symbol": "BTCUSDT",
        "description": "4H Fixed Rule Parity Fixture: 230 candles covering BTC Trade 0 (signal 2020-04-18 12:00:00)",
        "signal_candle_datetime": "2020-04-18 12:00:00",
        "signal_candle_index": sig_idx_in_slice,
        "entry_candle_datetime": "2020-04-18 16:00:00",
        "entry_candle_index": sig_idx_in_slice + 1,
        "expected_trade": {
            "symbol": trade_0["symbol"],
            "direction": trade_0["direction"],
            "signal_time": trade_0["signal_time"],
            "entry_time": trade_0["entry_time"],
            "exit_time": trade_0["exit_time"],
            "entry_price": float(trade_0["entry_price"]),
            "stop_pct": float(trade_0["stop_pct"]),
            "risk_inr": float(trade_0["risk_inr"]),
            "exit_type": trade_0["exit_type"],
            "gross_r": float(trade_0["gross_r"]),
            "fee_r": float(trade_0["fee_r"]),
            "funding_r": float(trade_0["funding_r"]),
            "net_r": float(trade_0["net_r"]),
            "clamped_flag": bool(trade_0["clamped_flag"])
        },
        "candles": candles_export
    }

    # Save to Trader-Pro-Dashboard/tests/fixtures/fixed_rule_4h_fixture.json
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../Trader-Pro-Dashboard/tests/fixtures"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "fixed_rule_4h_fixture.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(fixture, f, indent=2)

    # Also save to src/lib/__tests__/fixtures
    alt_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../Trader-Pro-Dashboard/src/lib/__tests__/fixtures"))
    os.makedirs(alt_dir, exist_ok=True)
    with open(os.path.join(alt_dir, "fixed_rule_4h_fixture.json"), "w", encoding="utf-8") as f:
        json.dump(fixture, f, indent=2)

    print(f"Fixture exported successfully to {out_path} ({len(candles_export)} candles).")

if __name__ == "__main__":
    main()
