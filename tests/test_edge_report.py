import unittest
import numpy as np
import pandas as pd
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analysis.edge_report import (
    compute_stop_pct,
    compute_cost_in_r,
    compute_breakeven_cost_pct,
    bootstrap_ci_95,
    linear_trend_test,
)

class TestEdgeReportFunctions(unittest.TestCase):
    def test_compute_cost_in_r(self):
        # 0.1144% cost with 1.0% stop = 0.1144 R
        self.assertAlmostEqual(compute_cost_in_r(0.001144, 0.01), 0.1144, places=6)
        
        # 0.1144% cost with 0.40% stop = 0.286 R
        self.assertAlmostEqual(compute_cost_in_r(0.001144, 0.0040), 0.2860, places=4)
        
        # Zero stop safeguard
        self.assertEqual(compute_cost_in_r(0.001144, 0.0), 0.0)

    def test_compute_breakeven_cost_pct(self):
        # Gross avg R = +0.10, Stop% = 1.0% -> Break-even fee = 0.10% (0.001)
        be = compute_breakeven_cost_pct(0.10, 0.01)
        self.assertAlmostEqual(be, 0.001, places=6)
        
        # Gross avg R = 0 -> Break-even fee = 0
        self.assertEqual(compute_breakeven_cost_pct(0.0, 0.01), 0.0)

    def test_compute_stop_pct(self):
        df = pd.DataFrame({
            'R': [1.0, -1.0, 0.05],
            'ret': [0.01, -0.01, 0.0005],
        })
        stop = compute_stop_pct(df)
        self.assertAlmostEqual(stop, 0.01, places=6)

    def test_bootstrap_ci_95_properties(self):
        # Seeded synthetic normal distribution with mean 0.50
        np.random.seed(123)
        data = np.random.normal(loc=0.50, scale=0.10, size=500)
        
        ci_low, ci_high = bootstrap_ci_95(data, n_resamples=5000, seed=42)
        sample_mean = float(data.mean())
        
        self.assertTrue(ci_low < sample_mean < ci_high, f"CI [{ci_low}, {ci_high}] must bracket mean {sample_mean}")
        self.assertTrue(0.48 < ci_low < 0.51)
        self.assertTrue(0.49 < ci_high < 0.53)

    def test_linear_trend_test(self):
        # Artificially decaying series: 1.0 down to -1.0
        data = np.linspace(1.0, -1.0, 100)
        res = linear_trend_test(data)
        self.assertTrue(res['slope'] < 0)
        self.assertTrue(res['p_value'] < 0.001)
        self.assertTrue(res['decay_detected'])

if __name__ == '__main__':
    unittest.main()
