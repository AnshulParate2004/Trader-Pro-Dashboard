# Residual Edge Analysis Test: ETH Daily Donchian Trend

> **Status**: IN-SAMPLE TEST OF TOOL (Not a claim of edge)  
> **Mandatory Disclosure**: **in-sample, 37 trades, not evidence of alpha**

---

## 1. Provenance & Environment
- **Skill Repository**: [claude-trading-skills](https://github.com/tradermonty/claude-trading-skills)
- **Commit Hash**: `e739008aeb6d29a1d911d1085f26b20bd0d27a27` (branch `main`)
- **Data Source**: `ETHUSDT_1d.parquet` (2,491 daily candles, 2020-01-01 to 2026-10-26)
- **Sample Window**: 2020-01-26 to 2026-10-26 (2,466 active daily observations)

---

## 2. Strategy Specification
- **Rule**: Simple Donchian 20/10 Trend (Identical parameters to BTC rule, zero tuning)
  - **Long Entry**: Yesterday's close > 20-day high of preceding closed bars ($t-21$ to $t-2$)
  - **Long Exit**: Yesterday's close < 10-day low of preceding closed bars ($t-11$ to $t-2$)
- **Execution**: Strict next-bar open fill ($open[t]$). Zero signal-close fill optimism.
- **Friction**: 14 bps round-turn taker fee + slippage (7 bps per side).
- **Position Sizing**: Flat (0.0) or Long (1.0).

---

## 3. Analyzer Configuration
```json
{
  "schema_version": "1.0",
  "date_column": "date",
  "strategy_column": "strategy_return",
  "return_unit": "decimal",
  "frequency": "daily",
  "annualization_factor": 365,
  "primary_model": {
    "name": "eth_market",
    "baseline_columns": ["market_return"]
  },
  "sensitivity_models": [
    {
      "name": "eth_and_btc",
      "baseline_columns": ["market_return", "btc_return"]
    }
  ],
  "regime_columns": ["volatility_regime"],
  "rolling_window": 90,
  "minimum_observations": 60,
  "minimum_regime_observations": 20,
  "minimum_rolling_windows": 12,
  "hac_lags": "auto",
  "include_series": true,
  "data_declarations": {
    "baseline_selection": "predeclared",
    "strategy_return_basis": "net",
    "baseline_return_basis": "net",
    "analysis_scope": "in_sample",
    "universe_data": "point_in_time"
  }
}
```

---

## 4. Benchmark vs Strategy Performance Table

| Metric | ETH Buy-and-Hold Benchmark | Donchian 20/10 Strategy (Strict Fills) | Comparison / Notes |
|---|---:|---:|---|
| **Total Return** | +1347.45% *(+1678.79% full)* | +678.92% | Strategy captured ~50% of nominal market upside |
| **CAGR (365d basis)** | +48.24% | +35.79% | Lower return due to 55.1% cash allocation |
| **Sharpe Ratio (365d)** | 0.9003 *(0.9327 full)* | 0.8410 | Modest Sharpe decline vs passive buy-and-hold |
| **Sharpe Ratio (252d)** | 0.7480 | 0.6988 | Equity calendar equivalent |
| **Max Drawdown** | -79.35% | -65.64% | Avoided 13.7% of the buy-and-hold crash |
| **Time in Market (Exposure)** | 100.0% | 44.9% | In cash 55.1% of active trading days |
| **Trade Count** | 1 (buy & hold) | 37 completed trades | Win rate: 51.4%, Avg return: +11.85% |

---

## 5. Residual Edge Econometric Results (`residual-edge-analyzer`)

| Parameter / Diagnostic | Value (365d Annualization) | Standard / Threshold | Interpretation |
|---|---:|---|---|
| **Analyzer Verdict** | **`RESIDUAL_FRAGILE`** | Must pass $\alpha$ t-stat $\ge 2.0$ | **Failed falsification gate** |
| **Decision Eligibility** | `REVIEW_REQUIRED` | Cleared for review only | Not trade authorized |
| **Primary Market $\beta$** | **0.4157** | HAC $t$-stat: 8.837 | Driven entirely by 45% market exposure |
| **Model $R^2$** | **0.4152** | Adj $R^2$: 0.4150 | 41.5% of variance is systematic ETH beta |
| **Annualized Alpha ($\alpha$)** | **+13.60%** | Intercept $\times$ annualization | Equity default (252d) yields +9.39% |
| **Alpha HAC $t$-statistic** | **`0.894`** | $\ge 2.0$ required | **Statistically indistinguishable from zero ($p > 0.35$)** |
| **Annualized Residual Vol** | **39.87%** | Non-market volatility | Substantial idiosyncratic variance |
| **Residual Edge Ratio** | **0.341** | $\alpha$ / Residual Vol | Below robust edge hurdle |
| **BTC Sensitivity Model $R^2$** | **0.4249** | Two-factor loading | Alpha: +14.72%, HAC $t$-stat: 0.923 |

---

## 6. Regime Breakdown (20-day ATR Percentile)

| Regime Bucket | Sample Size ($N$) | Annualized Active Return | Active Sharpe | Economic Context |
|---|---:|---:|---|---|
| **Low Volatility** | 816 days | **-7.49%** | **-0.272** | Whipsaws and slow grinds without follow-through |
| **Normal Volatility** | 810 days | **+21.86%** | **0.587** | Steady intermediate trends |
| **High Volatility** | 840 days | **+26.14%** | **0.513** | Strong bull momentum surges |

---

## 7. Key Takeaways
1. **Falsification of Alpha**: Just as with BTC, running the exact same Donchian trend rule on ETH demonstrates that nominal returns (+678.9%) and drawdown reduction (-65.6% vs -79.4%) are simply the mechanical consequence of an asset beta of $\beta = 0.42$ ($t = 8.84$) and ~55% cash holding.
2. **Weaker Statistical Significance**: The alpha HAC $t$-statistic is only **0.894**, meaning there is zero statistically significant evidence of independent edge over passive asset exposure.
3. **Formal Disclosure**: **in-sample, 37 trades, not evidence of alpha**.
