# Residual Edge Analysis

**Status:** RESIDUAL_FRAGILE
**Decision eligibility:** REVIEW_REQUIRED
**Period:** 2020-01-26 to 2026-10-26 (2466 observations)
**Primary model:** eth_market

## Primary Model

| Metric | Value |
|---|---:|
| R² | 0.4152 |
| Adjusted R² | 0.4150 |
| Annualized alpha | 13.6037% |
| Alpha HAC t-stat | 0.894 |
| Annualized residual volatility | 39.8726% |
| Residual edge ratio | 0.341 |

## Baseline Loadings

| Baseline | Loading | HAC t-stat | VIF |
|---|---:|---:|---:|
| market_return | 0.4157 | 8.837 | 1.000 |

## Model Sensitivity

| Model | Role | R² | Annualized alpha | Residual edge ratio | Status |
|---|---|---:|---:|---:|---|
| eth_market | primary | 0.4152 | 13.6037% | 0.341 | RESIDUAL_FRAGILE |
| eth_and_btc | sensitivity | 0.4249 | 14.7176% | 0.372 | RESIDUAL_FRAGILE |

## Evidence Warnings

- **HIGH — NOT_OUT_OF_SAMPLE:** Treat in-sample residual edge as exploratory until confirmed out of sample.
- **HIGH — ROLLING_ANALYSIS_INCOMPLETE:** Model eth_market could not estimate 110 rolling windows.
- **HIGH — ROLLING_ANALYSIS_INCOMPLETE:** Model eth_and_btc could not estimate 110 rolling windows.

## Regime Breakdown

### volatility_regime

| Regime | N | Evidence | Annualized active return | Active Sharpe |
|---|---:|---|---:|---:|
| high_vol | 840 | ADEQUATE | 26.1353% | 0.513 |
| low_vol | 816 | ADEQUATE | -7.4923% | -0.272 |
| normal_vol | 810 | ADEQUATE | 21.8604% | 0.587 |

## Interpretation

- 110 rolling windows could not be estimated.
- This report does not authorize a trade or an automatic exposure change.
- Confirm exploratory findings on untouched out-of-sample or live data.
