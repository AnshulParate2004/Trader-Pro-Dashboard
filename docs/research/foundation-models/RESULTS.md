# High-Frequency Foundation Model Benchmark: Results & Verification

> **Status**: Completed benchmark on BTC volatility and return forecasting (Amazon Chronos-Bolt & Google TimesFM 2.5)  
> **Protocol**: Top-to-bottom clean execution, zero promotional claims, strictly computed metrics  
> **Reference Baseline**: EWMA(0.94)  
> **Bonferroni-Adjusted Alpha**: $\alpha = 0.05 / 5 = 0.01$ (Chronos-Small, Chronos-Base, HAR-RV, GARCH, TimesFM)

---

## 1. Discrepancy Reconciliation (Colab vs Local Run)
Numbers between the initial Colab run and the local run differ due to four structural factors:
1. **Data Source & Bar Count:** Colab ingested a fixed historical slice through 2026-10-31 (2,496 bars), whereas the local script ingested live Binance daily data through 2026-11-06 (3,232 bars).
2. **Origins Split:** Both used 2,730 total origins, but Colab partitioned Dev: 2,190 / Holdout: 540 (a 6-origin shift), whereas local used Dev: 2,184 / Holdout: 546 (exact 80/20 split).
3. **Hardware & Dtype:** Colab executed on an Nvidia T4 GPU using `bfloat16`/`float16` PyTorch kernels; local execution was on an x86_64 CPU using `float32`.
4. **Unified Re-Run:** To eliminate all confounding variables, **both Chronos-Bolt Base and Google TimesFM 2.5 were re-evaluated on the exact same local dataset, same origins, same CPU device, and same `float32` precision**.

---

## 2. Models Evaluated (Identical Local Data & CPU)
1. **Google TimesFM 2.5 (200M PyTorch)**:
   * Package: `timesfm-3.0.2` (`google/timesfm-2.5-200m-pytorch`, Apache-2.0).
   * Context: 128 daily bars, Horizon: 1.
2. **Amazon Chronos-Bolt Base (200M PyTorch)**:
   * Package: `chronos-forecasting-2.3.2` (`amazon/chronos-bolt-base`, Apache-2.0).
   * Context: 128 daily bars, Horizon: 1.
3. **Econometric Baselines**:
   * `EWMA_RV(0.94)` (Primary reference baseline).
   * `EWMA_Close(0.94)`.

---

## 3. Directional Forecasting Performance (H=1)

| Model | Split | DA (%) | Binomial $p$-value | IC (Pearson) | Return MAE (bps) | DM vs ZeroReturn $p$ |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Baseline ZeroReturn** | Dev | N/A | N/A | N/A | **230.1** | Reference |
| **Chronos-Bolt-Base** | Dev | 51.65% | 0.1287 | -0.0261 | 246.0 | 0.0000 |
| **Google TimesFM 2.5** | Dev | 50.69% | 0.5349 | +0.0073 | 240.4 | 0.0000 |
| **Baseline ZeroReturn** | Holdout* | N/A | N/A | N/A | **149.8** | Reference |
| **Chronos-Bolt-Base** | Holdout* | 52.56% | 0.2479 | +0.0359 | 157.7 | 0.0017 |
| **Google TimesFM 2.5** | Holdout* | 48.72% | 0.5780 | -0.0523 | 156.9 | 0.0013 |

*\*Holdout window is exploratory / contaminated.*  
*Finding:* In both windows, predicting zero return has statistically significantly lower MAE than both Chronos and TimesFM ($p < 0.002$). Neither foundation model produces directional alpha.

---

## 4. Volatility Forecasting Performance (QLIKE vs Baselines)

### Dev Window (2,184 Origins)
*Reference Baseline: `EWMA_RV(0.94)` (QLIKE = -5.7504)*

| Model | QLIKE Loss | QLIKE Diff vs EWMA_RV | 95% Bootstrap CI (L=20, B=1000) | Paired DM $p$-value | Significant ($\alpha=0.01$)? |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Chronos-Bolt-Base** | -5.7622 | -0.0118 | `[-0.0538, +0.0359]` | 0.5758 | **No** (CI includes 0) |
| **Google TimesFM 2.5** | -5.7676 | -0.0172 | `[-0.0774, +0.0483]` | 0.5401 | **No** (CI includes 0) |
| **EWMA Close-to-Close** | -5.7317 | +0.0187 | `[-0.0201, +0.0567]` | 0.3519 | No |

### Holdout Window (546 Origins, Exploratory / Contaminated)
*Reference Baseline: `EWMA_RV(0.94)` (QLIKE = -6.5979)*

| Model | QLIKE Loss | QLIKE Diff vs EWMA_RV | 95% Bootstrap CI (L=20, B=1000) | Paired DM $p$-value | Significant ($\alpha=0.01$)? |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Google TimesFM 2.5** | -6.5955 | +0.0023 | `[-0.0460, +0.0464]` | 0.9282 | **No** (CI includes 0) |
| **Chronos-Bolt-Base** | -6.5810 | +0.0168 | `[-0.0512, +0.0972]` | 0.6397 | **No** (CI includes 0) |
| **EWMA Close-to-Close** | -6.6119 | -0.0141 | `[-0.0526, +0.0160]` | 0.4276 | No |

### Paired Comparison: Google TimesFM vs Amazon Chronos-Bolt Base
* **Dev Window:** Paired QLIKE difference (TimesFM - Chronos) = **`-0.0054`** (95% CI: `[-0.0582, +0.0533]`, DM $p = 0.8334$).
* **Holdout Window:** Paired QLIKE difference (TimesFM - Chronos) = **`-0.0145`** (95% CI: `[-0.0960, +0.0458]`, DM $p = 0.6693$).
* *Conclusion:* TimesFM and Chronos-Bolt are statistically indistinguishable from each other on QLIKE loss in both Dev and Holdout ($p > 0.66$, CIs include 0).

---

## 5. 80% Central Interval Coverage & Pinball Loss (Honest Comparison)

| Metric | Dev Chronos-Base | Dev TimesFM 2.5 | Holdout Chronos-Base | Holdout TimesFM 2.5 |
| :--- | :---: | :---: | :---: | :---: |
| **Nominal Coverage** | 80.00% | 80.00% | 80.00% | 80.00% |
| **Empirical Coverage** | **82.42%** | 83.38% | **82.42%** | 85.16% |
| **Pinball $q_{10}$** | **57.88 bps** | 59.45 bps | 38.93 bps | **38.80 bps** |
| **Pinball $q_{50}$** | 118.83 bps | **116.43 bps** | 77.04 bps | **76.74 bps** |
| **Pinball $q_{90}$** | **60.49 bps** | 61.44 bps | **37.98 bps** | 40.10 bps |
| **Pinball Mean** | **79.07 bps** | 79.10 bps | **51.32 bps** | 51.88 bps |

*Calibration Finding:* Chronos-Base empirical coverage (82.42%) is closer to the nominal 80.00% target than TimesFM (83.38% Dev, 85.16% Holdout). Chronos-Base also achieves slightly lower mean pinball loss in both Dev (79.07 vs 79.10 bps) and Holdout (51.32 vs 51.88 bps). **The prior claim that TimesFM was better calibrated than Chronos is not supported by the data and is retracted.**

---

## 6. Primary Decision Gate (Bonferroni $\alpha = 0.01$)
**Did TimesFM or Chronos beat EWMA_RV with $p < 0.01$ AND a 95% CI excluding 0 in BOTH Dev and Holdout?**
### Answer: **NO.**
Both foundation models fail the decision gate. Neither demonstrates statistically significant outperformance over classical `EWMA_RV(0.94)`.

---

## 7. Engineering Recommendation
**Use EWMA(0.94) and stop.**
Classical EWMA has zero parameter footprint, executes in microseconds, and avoids all GPU/PyTorch runtime dependencies.
