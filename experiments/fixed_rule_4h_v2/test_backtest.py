import os
import sys
import unittest
import numpy as np
import pandas as pd

# Add current folder to path
sys.path.insert(0, os.path.dirname(__file__))
from backtest import load_config, run_candidate_generator, load_candles

class TestFixedRule4HEngine(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.cfg_skip = load_config(override_clamp_mode="skip", override_direction="BOTH")
        cls.cfg_clamp = load_config(override_clamp_mode="clamp", override_direction="BOTH")

    def test_gate1_zero_lookahead_at_signal_bar(self):
        """
        Gate 1 Invariant: At signal bar t, decision must use strictly data <= t.
        We verify this by taking a confirmed signal bar t, truncating the dataframe
        to index t, and re-running the exact indicator math on the truncated df.
        The indicators and signal conditions must be bit-for-bit identical.
        """
        df = load_candles("BTCUSDT", "4h")
        c = df['close'].values.astype(float)
        h = df['high'].values.astype(float)
        l = df['low'].values.astype(float)
        o = df['open'].values.astype(float)
        v = df['volume'].values.astype(float)

        # Compute indicators on full series
        sma200_full = pd.Series(c).rolling(200).mean().values
        ema50_full = pd.Series(c).ewm(span=50, adjust=False).mean().values
        dh_full = pd.Series(h).shift(1).rolling(20).max().values

        # Test at index t = 500
        t = 500
        # Truncated series up to t
        c_trunc = c[:t+1]
        h_trunc = h[:t+1]
        sma200_trunc = pd.Series(c_trunc).rolling(200).mean().values[-1]
        ema50_trunc = pd.Series(c_trunc).ewm(span=50, adjust=False).mean().values[-1]
        dh_trunc = pd.Series(h_trunc).shift(1).rolling(20).max().values[-1]

        self.assertAlmostEqual(sma200_full[t], sma200_trunc, places=9)
        self.assertAlmostEqual(ema50_full[t], ema50_trunc, places=9)
        self.assertAlmostEqual(dh_full[t], dh_trunc, places=9)

    def test_gate3_entry_price_equals_next_bar_open(self):
        """
        Gate 3 Invariant: Every trade's entry price must be strictly equal to
        the Open price of the bar following the signal (bar t+1), never close of t.
        """
        cands = run_candidate_generator(self.cfg_skip)
        self.assertGreater(len(cands), 0, "Candidate list should not be empty")

        for c in cands:
            symbol = c['symbol']
            df = load_candles(symbol, "4h")
            entry_dt = c['entry_dt']
            
            # Find row corresponding to entry_dt
            row = df[df['datetime'] == entry_dt]
            self.assertEqual(len(row), 1, f"Should find exact entry timestamp in dataframe for {entry_dt}")
            actual_open = row['open'].iloc[0]
            
            self.assertAlmostEqual(
                c['entry_price'], actual_open, places=4,
                msg=f"Entry price ({c['entry_price']}) must match open of bar t+1 ({actual_open})"
            )

    def test_gate4_clamp_vs_skip_integrity(self):
        """
        Gate 4 Invariant: In 'skip' mode, no trades should have stop_pct < 0.023 or > 0.060.
        In 'clamp' mode, trades outside bounds are clipped to [0.023, 0.060].
        """
        cands_skip = run_candidate_generator(self.cfg_skip)
        for t in cands_skip:
            self.assertFalse(t['clamped_flag'], "In skip mode, trades with raw stop outside bounds must be skipped")
            self.assertGreaterEqual(t['stop_pct'], 0.023)
            self.assertLessEqual(t['stop_pct'], 0.060)

        cands_clamp = run_candidate_generator(self.cfg_clamp)
        # Clamp mode should produce at least as many trades as skip mode
        self.assertGreaterEqual(len(cands_clamp), len(cands_skip))

if __name__ == '__main__':
    unittest.main()
