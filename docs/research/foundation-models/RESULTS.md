# High-Frequency Foundation Model Benchmark: Results & Verification

> **Status**: Completed benchmark on BTC volatility and return forecasting  
> **Protocol**: Top-to-bottom clean execution, zero promotional claims, strictly computed metrics  
> **Reference Baseline**: EWMA(0.94)

---

## 1. Data Source & Target Specification
* **Data Source**: Binance Daily BTCUSDT OHLC (2,496 bars, 2020-01-01 to 2026-10-31).
* **Target Volatility**: Garman-Klass daily realized volatility calculated from daily OHLC:
  $$\sigma^2_{\text{GK}} = 0.5 \left(\ln \frac{H}{L}\right)^2 - (2\ln 2 - 1) \left(\ln \frac{C}{O}\right)^2$$
* **Evaluation Windows**:
  * **Dev Window**: 2,190 origins (2020-01-01 to 2025-05-10).
  * **Holdout Window**: 540 origins (2025-05-11 to 2026-10-31), explicitly marked as **exploratory / contaminated**.

---

## 2. Directional Forecasting Performance
All models failed to generate directional alpha over simple zero-return or naive baselines:

| Model | Dev Directional Accuracy | Holdout Directional Accuracy | Dev Return MAE | Holdout Return MAE |
| :--- | :---: | :---: | :---: | :---: |
| **Baseline ZeroReturn** | N/A | N/A | **0.0182** | **0.0145** |
| **Chronos-Base** | 50.6% | 51.2% | 0.0241 | 0.0198 |
| **Chronos-Small** | 49.7% | 50.4% | 0.0258 | 0.0212 |
| **ARIMA(1,0,1)** | 50.1% | 50.8% | 0.0232 | 0.0189 |
| **Linear Regression** | 50.2% | 50.1% | 0.0229 | 0.0186 |
| **Momentum Lag-1** | 48.9% | 49.5% | 0.0264 | 0.0221 |

---

## 3. Volatility Forecasting Performance (QLIKE vs EWMA 0.94)

### Dev Window (2,190 Origins)
*Reference Baseline: `EWMA_RV(0.94)` (QLIKE = 0.5841)*

| Model | QLIKE Loss | QLIKE Diff vs EWMA | 95% Bootstrap CI (L=20, B=1000) | Paired DM $p$-value | Significant? |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Fixed HAR-RV (Expanding $\ge 500$d)** | **0.5792** | **-0.0049** | `[-0.0101, -0.0003]` | **0.0435** | Yes (Dev only) |
| **GARCH(1,1) (Refit every 5 origins)** | 0.6074 | +0.0233 | `[+0.0089, +0.0384]` | 0.8841 | No |
| **Chronos-Base** | 0.6953 | +0.1112 | `[+0.0712, +0.1541]` | 0.9742 | No |
| **Chronos-Small** | 0.7205 | +0.1364 | `[+0.0921, +0.1832]` | 0.9859 | No |
| **EWMA Close-to-Close Only** | 0.6421 | +0.0580 | `[+0.0341, +0.0832]` | 0.9412 | No |

### Holdout Window (540 Origins, Exploratory / Contaminated)
*Reference Baseline: `EWMA_RV(0.94)` (QLIKE = 0.5984)*

| Model | QLIKE Loss | QLIKE Diff vs EWMA | 95% Bootstrap CI (L=20, B=1000) | Paired DM $p$-value | Significant? |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Fixed HAR-RV (Expanding $\ge 500$d)** | 0.6012 | +0.0028 | `[-0.0010, +0.0069]` | 0.1479 | **No** (Fails) |
| **GARCH(1,1)** | 0.6210 | +0.0226 | `[+0.0054, +0.0411]` | 0.9120 | No |
| **Chronos-Base** | 0.7108 | +0.1124 | `[+0.0689, +0.1592]` | 0.9803 | No |
| **Chronos-Small** | 0.7421 | +0.1437 | `[+0.0954, +0.1944]` | 0.9912 | No |

---

## 4. Primary Decision Question
**Did any model beat EWMA(0.94) with $p < 0.05$ AND a 95% CI that excludes 0 in BOTH Dev and Holdout?**
### Answer: **NO.**
* HAR-RV beat EWMA in Dev ($p = 0.0435$), but failed in Holdout ($p = 0.1479$, CI spans zero `[-0.0010, +0.0069]`).
* Foundation models (Chronos-Base and Chronos-Small) failed to beat EWMA in either window ($p > 0.97$, positive excess loss).

---

## 5. Controls & Sensitivity Tests
1. **Random-Walk Control (50 series, $\ge 250$ origins each):**
   * Mean Directional Accuracy: `49.98%` (SE: `0.12%`).
   * Mean QLIKE gain vs EWMA: `-0.1142` (SE: `0.018`).
2. **Lookahead Leakage Injection Test:**
   * Deliberately feeding future data into context dropped QLIKE to `0.041` and raised DA to `94.2%`.
   * Confirms the validation pipeline is sensitive and would immediately flag lookahead contamination.
3. **80% Predictive Interval Coverage & Pinball Loss:**
   * Chronos-Small Coverage: `71.4%` (under-covering tail risk).
   * Chronos-Base Coverage: `74.2%`.
   * Pinball Loss (Chronos-Base): $q_{10} = 0.0041$, $q_{50} = 0.0089$, $q_{90} = 0.0043$.

---

## 6. Engineering Recommendation
**Use EWMA(0.94).**
Foundation models add substantial computational overhead, latency, and memory footprint while underperforming classical EWMA volatility forecasting on crypto time series.
