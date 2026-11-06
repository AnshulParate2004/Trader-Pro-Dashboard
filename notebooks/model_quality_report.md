# Model Quality, Permutation Importance, and Baseline Comparison Report

> [!CAUTION]
> **AUDIT UPDATE (LEAKAGE DISQUALIFICATION)**:  
> The previous figures reported in this document (`0.8923` LightGBM AUC and `0.3676` Rule Baseline AUC) have been audited and identified as **INVALID DUE TO TARGET LOOKBACK LEAKAGE**.  
> In `notebooks/run_model_quality.py`, the target calculation formula used `l.shift(-1).rolling(6).min()`, which inadvertently aggregated 5 past candles prior to the decision point, inducing an artificial $-0.4157$ correlation between `ret_3` and the target.  
> See the complete audit report: [`notebooks/leakage_audit.md`](file:///D:/Projects_Main/Trade-Pro/Trader-Pro-Dashboard/notebooks/leakage_audit.md).  
> The audited, purged walk-forward metrics below replace the flawed figures.

---

## 1. Audited Purged Walk-Forward Model Quality Benchmark

Evaluated across a **5-Fold Purged Walk-Forward split** with an **embargo of 6 bars** on 14,841 candles (4H BTCUSDT):

| Model Architecture | OOS AUC (Walk-Forward Mean) | 5-Fold Range | Methodology | Verdict |
| :--- | :---: | :---: | :--- | :--- |
| **LightGBM (Purged Forward Horizon)** | **`0.5126`** | `[0.4811, 0.5242]` | Gradient Boosted Decision Trees | Realistic weak learner edge (matches `model_card.json`) |
| **Shuffled-Label Noise Control** | `0.5027` | `[0.4949, 0.5123]` | Permuted Training Labels | Expected zero-information baseline (~0.50) |
| **Lagged-Feature Control** | `0.4987` | `[0.4593, 0.5385]` | 50-Bar Lagged Features | Confirms absence of synthetic leakage (~0.50) |
| **Rule-Based Trend Baseline** | `0.5082` | `[0.4961, 0.5245]` | Dual EMA50 + RSI14 Rule | Standard trend-following benchmark |
| *Flawed Target (Invalid Leakage)* | *`0.8725`* (up to `0.8923`) | *`[0.8518, 0.8974]`* | *Backward Lookback in Target* | **INVALID (DISQUALIFIED)** |

---

## 2. Walk-Forward Fold-by-Fold Breakdown

| Fold | Training Bars | Test Bars | Honest Forward LightGBM AUC | Shuffled Target Control | Lagged Feature Control | Rule Baseline AUC |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | 2,474 | 2,474 | **`0.5217`** | `0.4949` | `0.4903` | `0.4988` |
| 2 | 4,947 | 2,474 | **`0.5127`** | `0.4952` | `0.4942` | `0.5001` |
| 3 | 7,420 | 2,474 | **`0.5242`** | `0.5053` | `0.4593` | `0.4961` |
| 4 | 9,893 | 2,474 | **`0.5231`** | `0.5056` | `0.5385` | `0.5216` |
| 5 | 12,366 | 2,470 | **`0.4811`** | `0.5123` | `0.5113` | `0.5245` |
| **Mean** | — | — | **`0.5126`** | **`0.5027`** | **`0.4987`** | **`0.5082`** |

---

## 3. Incremental Value of Funding Rates & Open Interest

- Evaluated without lookahead using `merge_asof(direction="backward")`.
- When tested under the honest purged walk-forward framework:
  - Base technical features LightGBM AUC: **`0.5126`**
  - Base + Funding Rates + Open Interest AUC: **`0.5118`**
- **Decision**: Adding funding rates and open interest does NOT provide an incremental AUC improvement on 4H candles (AUC change of $-0.0008$). In accordance with strict pre-registration rules, these features are **not retained** in production models.
