# Residual Edge Analysis Test: BTC Daily Donchian Trend

> **Status**: IN-SAMPLE TEST OF TOOL (Not a claim of edge)  
> **Mandatory Disclosure**: **in-sample, 34 trades, not evidence of alpha**

---

## 1. Provenance & Environment
- **Skill Repository**: [claude-trading-skills](https://github.com/tradermonty/claude-trading-skills)
- **Commit Hash**: `e739008aeb6d29a1d911d1085f26b20bd0d27a27` (branch `main`)
- **Data Source**: `BTCUSDT_1d.parquet` (2,496 daily candles, 2020-01-01 to 2026-10-31)
- **Sample Window**: 2020-01-26 to 2026-10-26 (2,466 active daily observations)

---

## 2. Strategy Specification
- **Rule**: Simple Donchian 20/10 Trend
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
    "name": "btc_market",
    "baseline_columns": ["market_return"]
  },
  "sensitivity_models": [
    {
      "name": "btc_and_eth",
      "baseline_columns": ["market_return", "eth_return"]
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

| Metric | BTC Buy-and-Hold Benchmark | Donchian 20/10 Strategy (Strict Fills) | Comparison / Notes |
|---|---:|---:|---|
| **Total Return** | +831.80% *(+980.30% full)* | +638.35% | Strategy lagged nominal return by ~193% |
| **CAGR (365d basis)** | +39.25% | +34.50% | Lower return due to ~48% cash allocation |
| **Sharpe Ratio (365d)** | 0.8859 | 0.9398 | Modest Sharpe improvement via risk reduction |
| **Sharpe Ratio (252d)** | 0.7361 | 0.7809 | Equity calendar equivalent |
| **Max Drawdown** | -76.67% | -53.86% | Avoided 22.8% of the buy-and-hold crash |
| **Time in Market (Exposure)** | 100.0% | 52.1% | In cash 47.9% of active trading days |
| **Trade Count** | 1 (buy & hold) | 34 completed trades | Win rate: 44.1%, Avg return: +13.18% |

---

## 5. Residual Edge Econometric Results (`residual-edge-analyzer`)

| Parameter / Diagnostic | Value (365d Annualization) | Value (252d Equity Default) | Standard / Threshold | Interpretation |
|---|---:|---:|---|---|
| **Analyzer Verdict** | **`RESIDUAL_FRAGILE`** | **`RESIDUAL_FRAGILE`** | Must pass $\alpha$ t-stat $\ge 2.0$ | **Failed falsification gate** |
| **Decision Eligibility** | `REVIEW_REQUIRED` | `REVIEW_REQUIRED` | Cleared for review only | Not trade authorized |
| **Primary Market $\beta$** | **0.4374** | **0.4374** | HAC $t$-stat: 8.459 | Driven entirely by 52% market exposure |
| **Model $R^2$** | **0.4369** | **0.4369** | Adj $R^2$: 0.4367 | 43.7% of variance is systematic BTC beta |
| **Annualized Alpha ($\alpha$)** | **+14.72%** | **+10.17%** | Intercept $\times$ annualization | Equity default understates by ~31% |
| **Alpha HAC $t$-statistic** | **1.245** | **1.245** | $\ge 2.0$ required | **Statistically indistinguishable from zero** |
| **Annualized Residual Vol** | **29.88%** | **24.83%** | Non-market volatility | Substantial idiosyncratic variance |
| **Residual Edge Ratio** | **0.493** | **0.409** | $\alpha$ / Residual Vol | Below robust edge hurdle |
| **Rolling Alpha Stability** | **33.0%** positive | **33.0%** positive | Fraction of 90d windows with $\alpha > 0$ | Median residual edge ratio: -0.825 |
| **ETH Sensitivity Model $R^2$** | **0.4436** | **0.4436** | Two-factor loading | Alpha: +15.82%, HAC $t$-stat: 1.258 |

---

## 6. Regime Breakdown (20-day ATR Percentile)

| Regime Bucket | Sample Size ($N$) | Annualized Active Return | Active Sharpe | Economic Context |
|---|---:|---:|---:|---|
| **Low Volatility** | 816 days | **+26.79%** | **1.289** | Smooth persistent trends, minimal whipsaws |
| **Normal Volatility** | 810 days | **+3.80%** | **0.150** | Range-bound choppy consolidation, fee drag |
| **High Volatility** | 840 days | **+13.54%** | **0.340** | Explosive momentum but larger stop drawdowns |

---

## 7. Key Takeaways
1. **No True Independent Alpha**: While nominal performance (+638%) and lower max drawdown (-53.9% vs -76.7%) appear strong, residual edge analysis shows this is almost entirely a levered market beta effect ($\beta = 0.44$) combined with cash allocation. The alpha $t$-statistic of 1.245 falls far short of statistical significance ($t \ge 2.0$).
2. **Calendar Scaling Sensitivity**: Equity-first tooling assumes 252 trading days. Crypto runs 365 days/year. Using the 252 default reduces annualized alpha from +14.72% to +10.17% without affecting the HAC $t$-stat.
3. **Formal Disclosure**: **in-sample, 34 trades, not evidence of alpha**.
