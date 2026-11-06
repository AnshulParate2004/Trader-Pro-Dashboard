# Quantitative Strategy Edge & Fee Friction Breakdown Report

> **Rigorous Empirical Analysis**: Analysis performed directly on all backtested and live trade logs across `src/models/*/trades_main.csv`.
> Evaluated across 3 realistic round-trip exchange fee tiers with 10,000-resample bootstrap 95% confidence intervals.

---

## Executive Summary of Models

| Model / Timeframe | N Trades | Gross Avg R | TP % | BE % | SL % | True Win Rate | Median Stop% | Break-even Fee% | Net R (0.1144% Taker) | 95% Bootstrap CI |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **15m** | 11,548 | `+0.0940R` | 40.0% | 28.0% | 32.0% | **55.6%** | `0.94%` | `0.0885%` | **`-0.0275R`** | `[-0.0425, -0.0121]R` |
| **1d** | 88 | `+0.0028R` | 35.2% | 28.4% | 36.4% | **49.2%** | `1.00%` | `0.0028%` | **`-0.1116R`** | `[-0.2849, +0.0691]R` |
| **1h** | 2,624 | `+0.1021R` | 39.1% | 30.5% | 30.4% | **56.2%** | `1.00%` | `0.1021%` | **`-0.0123R`** | `[-0.0444, +0.0184]R` |
| **1w** | 7 | `+0.1571R` | 42.9% | 28.6% | 28.6% | **60.0%** | `1.00%` | `0.1571%` | **`+0.0427R`** | `[-0.5430, +0.6142]R` |
| **4h** | 598 | `+0.1525R` | 40.1% | 31.9% | 27.9% | **59.0%** | `1.00%` | `0.1525%` | **`+0.0381R`** | `[-0.0257, +0.1021]R` |
| **multi_model_scalp** | 6,538 | `+0.1622R` | 36.5% | 41.2% | 22.3% | **62.0%** | `0.90%` | `0.1461%` | **`+0.0352R`** | `[+0.0168, +0.0534]R` |
| **multi_model_scalp_5m** | 11,420 | `+0.1007R` | 35.1% | 37.9% | 26.9% | **56.6%** | `0.47%` | `0.0473%` | **`-0.1426R`** | `[-0.1572, -0.1283]R` |

---

## Detailed Analysis: `15m`

- **Sample Size**: 11,548 completed trades
- **Gross Average Expectancy**: `+0.0940R` per trade
- **Trade Exit Split**: TP: 4,616 (40.0%) | BE: 3,239 (28.0%) | SL: 3,693 (32.0%)
- **True Win Rate (TP / (TP + SL))**: **55.55%**
- **Median Stop Distance**: `0.942%` notional
  > [!WARNING]
  > **Stop Distance Discrepancy**: Model stop distance is `0.94%`. Live scalp stops typically operate at `0.35% - 0.45%`. A tighter live stop multiplies the fee friction in R terms (e.g. at 0.40% stop, 0.1144% friction = 0.286R/trade, whereas at 1.00% stop, friction = 0.1144R/trade).
- **Break-even Exchange Cost**: `0.0885%` round trip. Any exchange fee above this threshold turns the model's net expectancy negative.

### Net Expectancy Under Exchange Friction Scenarios

| Scenario | Round-Trip Cost % | Cost in R | Net Avg R / Trade | 10,000-Resample 95% Bootstrap CI | Expectancy Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **0.1144% (Realistic Taker)** | `0.1144%` | `0.1215R` | **`-0.0275R`** | `[-0.0425, -0.0121]R` | `NEGATIVE EXPECTANCY` |
| **0.0800% (Mid Taker)** | `0.0800%` | `0.0849R` | **`+0.0090R`** | `[-0.0060, +0.0244]R` | `INCONCLUSIVE (CI CROSSES ZERO)` |
| **0.0500% (Maker/Optimistic)** | `0.0500%` | `0.0531R` | **`+0.0409R`** | `[+0.0258, +0.0563]R` | `POSITIVE EDGE` |

### Alpha Stability & Decay Test

- **Rolling 100-Trade Net R**: Initial = `-0.0140R` | Min = `-0.2950R` | Max = `+0.2525R` | Current = `-0.1085R`
- **Linear Trend Test (Slope per Trade)**: `-1.366127e-05R` (t-stat: `-5.81`, p-value: `0.0000`)
  > [!CAUTION] **Statistically Significant Alpha Decay Detected ($p < 0.05$, slope < 0)**. Expectancy has systematically declined over the dataset.

### Breakdown by Year, Side, and 6-Hour UTC Block (Taker 0.1144% Friction)

#### Calendar Year Breakdown

| Year | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 2022 | 2,059 | `+0.1646R` | `+0.0431R` | Sufficient |
| 2023 | 2,081 | `+0.1329R` | `+0.0115R` | Sufficient |
| 2024 | 2,625 | `+0.0827R` | `-0.0387R` | Sufficient |
| 2025 | 2,813 | `+0.0631R` | `-0.0583R` | Sufficient |
| 2026 | 1,970 | `+0.0381R` | `-0.0833R` | Sufficient |

#### Side Breakdown (Long vs Short)

| Side | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| LONG | 6,030 | `+0.0907R` | `-0.0307R` | Sufficient |
| SHORT | 5,518 | `+0.0975R` | `-0.0239R` | Sufficient |

#### 6-Hour UTC Session Block Breakdown

| Session Block (UTC) | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 00:00-05:59 UTC (Asia Morn) | 2,501 | `+0.0636R` | `-0.0578R` | Sufficient |
| 06:00-11:59 UTC (London Open) | 2,899 | `+0.1043R` | `-0.0172R` | Sufficient |
| 12:00-17:59 UTC (US Open) | 3,779 | `+0.1201R` | `-0.0014R` | Sufficient |
| 18:00-23:59 UTC (US Close) | 2,369 | `+0.0718R` | `-0.0497R` | Sufficient |

---

## Detailed Analysis: `1d`

- **Sample Size**: 88 completed trades
- **Gross Average Expectancy**: `+0.0028R` per trade
- **Trade Exit Split**: TP: 31 (35.2%) | BE: 25 (28.4%) | SL: 32 (36.4%)
- **True Win Rate (TP / (TP + SL))**: **49.21%**
- **Median Stop Distance**: `1.000%` notional
  > [!WARNING]
  > **Stop Distance Discrepancy**: Model stop distance is `1.00%`. Live scalp stops typically operate at `0.35% - 0.45%`. A tighter live stop multiplies the fee friction in R terms (e.g. at 0.40% stop, 0.1144% friction = 0.286R/trade, whereas at 1.00% stop, friction = 0.1144R/trade).
- **Break-even Exchange Cost**: `0.0028%` round trip. Any exchange fee above this threshold turns the model's net expectancy negative.

### Net Expectancy Under Exchange Friction Scenarios

| Scenario | Round-Trip Cost % | Cost in R | Net Avg R / Trade | 10,000-Resample 95% Bootstrap CI | Expectancy Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **0.1144% (Realistic Taker)** | `0.1144%` | `0.1144R` | **`-0.1116R`** | `[-0.2849, +0.0691]R` | `INCONCLUSIVE (CI CROSSES ZERO)` |
| **0.0800% (Mid Taker)** | `0.0800%` | `0.0800R` | **`-0.0772R`** | `[-0.2505, +0.1035]R` | `INCONCLUSIVE (CI CROSSES ZERO)` |
| **0.0500% (Maker/Optimistic)** | `0.0500%` | `0.0500R` | **`-0.0472R`** | `[-0.2205, +0.1335]R` | `INCONCLUSIVE (CI CROSSES ZERO)` |

### Alpha Stability & Decay Test

- **Rolling 100-Trade Net R**: Initial = `+0.0000R` | Min = `+0.0000R` | Max = `+0.0000R` | Current = `+0.0000R`
- **Linear Trend Test (Slope per Trade)**: `-2.441355e-03R` (t-stat: `-0.68`, p-value: `0.4976`)
  > [!NOTE] Alpha trend is statistically indistinguishable from zero ($p \ge 0.05$); no significant secular decay.

### Breakdown by Year, Side, and 6-Hour UTC Block (Taker 0.1144% Friction)

#### Calendar Year Breakdown

| Year | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 2022 | 16 | `-0.0469R` | `-0.1613R` | Low Sample (<100) |
| 2023 | 16 | `+0.3875R` | `+0.2731R` | Low Sample (<100) |
| 2024 | 25 | `-0.2220R` | `-0.3364R` | Low Sample (<100) |
| 2025 | 18 | `+0.0639R` | `-0.0505R` | Low Sample (<100) |
| 2026 | 13 | `-0.0615R` | `-0.1759R` | Low Sample (<100) |

#### Side Breakdown (Long vs Short)

| Side | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| LONG | 51 | `+0.0578R` | `-0.0566R` | Low Sample (<100) |
| SHORT | 37 | `-0.0730R` | `-0.1874R` | Low Sample (<100) |

#### 6-Hour UTC Session Block Breakdown

| Session Block (UTC) | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 00:00-05:59 UTC (Asia Morn) | 88 | `+0.0028R` | `-0.1116R` | Low Sample (<100) |

---

## Detailed Analysis: `1h`

- **Sample Size**: 2,624 completed trades
- **Gross Average Expectancy**: `+0.1021R` per trade
- **Trade Exit Split**: TP: 1,026 (39.1%) | BE: 800 (30.5%) | SL: 798 (30.4%)
- **True Win Rate (TP / (TP + SL))**: **56.25%**
- **Median Stop Distance**: `1.000%` notional
  > [!WARNING]
  > **Stop Distance Discrepancy**: Model stop distance is `1.00%`. Live scalp stops typically operate at `0.35% - 0.45%`. A tighter live stop multiplies the fee friction in R terms (e.g. at 0.40% stop, 0.1144% friction = 0.286R/trade, whereas at 1.00% stop, friction = 0.1144R/trade).
- **Break-even Exchange Cost**: `0.1021%` round trip. Any exchange fee above this threshold turns the model's net expectancy negative.

### Net Expectancy Under Exchange Friction Scenarios

| Scenario | Round-Trip Cost % | Cost in R | Net Avg R / Trade | 10,000-Resample 95% Bootstrap CI | Expectancy Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **0.1144% (Realistic Taker)** | `0.1144%` | `0.1144R` | **`-0.0123R`** | `[-0.0444, +0.0184]R` | `INCONCLUSIVE (CI CROSSES ZERO)` |
| **0.0800% (Mid Taker)** | `0.0800%` | `0.0800R` | **`+0.0221R`** | `[-0.0100, +0.0528]R` | `INCONCLUSIVE (CI CROSSES ZERO)` |
| **0.0500% (Maker/Optimistic)** | `0.0500%` | `0.0500R` | **`+0.0521R`** | `[+0.0200, +0.0828]R` | `POSITIVE EDGE` |

### Alpha Stability & Decay Test

- **Rolling 100-Trade Net R**: Initial = `+0.0856R` | Min = `-0.2909R` | Max = `+0.1806R` | Current = `-0.0814R`
- **Linear Trend Test (Slope per Trade)**: `-3.752100e-05R` (t-stat: `-1.76`, p-value: `0.0787`)
  > [!NOTE] Alpha trend is statistically indistinguishable from zero ($p \ge 0.05$); no significant secular decay.

### Breakdown by Year, Side, and 6-Hour UTC Block (Taker 0.1144% Friction)

#### Calendar Year Breakdown

| Year | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 2022 | 505 | `+0.1483R` | `+0.0339R` | Sufficient |
| 2023 | 444 | `+0.1708R` | `+0.0564R` | Sufficient |
| 2024 | 597 | `+0.0691R` | `-0.0453R` | Sufficient |
| 2025 | 626 | `+0.0328R` | `-0.0816R` | Sufficient |
| 2026 | 452 | `+0.1227R` | `+0.0083R` | Sufficient |

#### Side Breakdown (Long vs Short)

| Side | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| LONG | 1,378 | `+0.1046R` | `-0.0098R` | Sufficient |
| SHORT | 1,246 | `+0.0994R` | `-0.0150R` | Sufficient |

#### 6-Hour UTC Session Block Breakdown

| Session Block (UTC) | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 00:00-05:59 UTC (Asia Morn) | 509 | `+0.1187R` | `+0.0043R` | Sufficient |
| 06:00-11:59 UTC (London Open) | 461 | `+0.1351R` | `+0.0207R` | Sufficient |
| 12:00-17:59 UTC (US Open) | 1,010 | `+0.1210R` | `+0.0066R` | Sufficient |
| 18:00-23:59 UTC (US Close) | 644 | `+0.0358R` | `-0.0786R` | Sufficient |

---

## Detailed Analysis: `1w`

- **Sample Size**: 7 completed trades
- **Gross Average Expectancy**: `+0.1571R` per trade
- **Trade Exit Split**: TP: 3 (42.9%) | BE: 2 (28.6%) | SL: 2 (28.6%)
- **True Win Rate (TP / (TP + SL))**: **60.00%**
- **Median Stop Distance**: `1.000%` notional
  > [!WARNING]
  > **Stop Distance Discrepancy**: Model stop distance is `1.00%`. Live scalp stops typically operate at `0.35% - 0.45%`. A tighter live stop multiplies the fee friction in R terms (e.g. at 0.40% stop, 0.1144% friction = 0.286R/trade, whereas at 1.00% stop, friction = 0.1144R/trade).
- **Break-even Exchange Cost**: `0.1571%` round trip. Any exchange fee above this threshold turns the model's net expectancy negative.

### Net Expectancy Under Exchange Friction Scenarios

| Scenario | Round-Trip Cost % | Cost in R | Net Avg R / Trade | 10,000-Resample 95% Bootstrap CI | Expectancy Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **0.1144% (Realistic Taker)** | `0.1144%` | `0.1144R` | **`+0.0427R`** | `[-0.5430, +0.6142]R` | `INCONCLUSIVE (CI CROSSES ZERO)` |
| **0.0800% (Mid Taker)** | `0.0800%` | `0.0800R` | **`+0.0771R`** | `[-0.5086, +0.6486]R` | `INCONCLUSIVE (CI CROSSES ZERO)` |
| **0.0500% (Maker/Optimistic)** | `0.0500%` | `0.0500R` | **`+0.1071R`** | `[-0.4786, +0.6786]R` | `INCONCLUSIVE (CI CROSSES ZERO)` |

### Alpha Stability & Decay Test

- **Rolling 100-Trade Net R**: Initial = `+0.0000R` | Min = `+0.0000R` | Max = `+0.0000R` | Current = `+0.0000R`
- **Linear Trend Test (Slope per Trade)**: `0.000000e+00R` (t-stat: `0.00`, p-value: `1.0000`)
  > [!NOTE] Alpha trend is statistically indistinguishable from zero ($p \ge 0.05$); no significant secular decay.

### Breakdown by Year, Side, and 6-Hour UTC Block (Taker 0.1144% Friction)

#### Calendar Year Breakdown

| Year | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 2024 | 5 | `+0.2000R` | `+0.0856R` | Low Sample (<100) |
| 2025 | 1 | `+0.0500R` | `-0.0644R` | Low Sample (<100) |
| 2026 | 1 | `+0.0500R` | `-0.0644R` | Low Sample (<100) |

#### Side Breakdown (Long vs Short)

| Side | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| LONG | 7 | `+0.1571R` | `+0.0427R` | Low Sample (<100) |

#### 6-Hour UTC Session Block Breakdown

| Session Block (UTC) | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 00:00-05:59 UTC (Asia Morn) | 7 | `+0.1571R` | `+0.0427R` | Low Sample (<100) |

---

## Detailed Analysis: `4h`

- **Sample Size**: 598 completed trades
- **Gross Average Expectancy**: `+0.1525R` per trade
- **Trade Exit Split**: TP: 240 (40.1%) | BE: 191 (31.9%) | SL: 167 (27.9%)
- **True Win Rate (TP / (TP + SL))**: **58.97%**
- **Median Stop Distance**: `1.000%` notional
  > [!WARNING]
  > **Stop Distance Discrepancy**: Model stop distance is `1.00%`. Live scalp stops typically operate at `0.35% - 0.45%`. A tighter live stop multiplies the fee friction in R terms (e.g. at 0.40% stop, 0.1144% friction = 0.286R/trade, whereas at 1.00% stop, friction = 0.1144R/trade).
- **Break-even Exchange Cost**: `0.1525%` round trip. Any exchange fee above this threshold turns the model's net expectancy negative.

### Net Expectancy Under Exchange Friction Scenarios

| Scenario | Round-Trip Cost % | Cost in R | Net Avg R / Trade | 10,000-Resample 95% Bootstrap CI | Expectancy Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **0.1144% (Realistic Taker)** | `0.1144%` | `0.1144R` | **`+0.0381R`** | `[-0.0257, +0.1021]R` | `INCONCLUSIVE (CI CROSSES ZERO)` |
| **0.0800% (Mid Taker)** | `0.0800%` | `0.0800R` | **`+0.0725R`** | `[+0.0087, +0.1365]R` | `POSITIVE EDGE` |
| **0.0500% (Maker/Optimistic)** | `0.0500%` | `0.0500R` | **`+0.1025R`** | `[+0.0387, +0.1665]R` | `POSITIVE EDGE` |

### Alpha Stability & Decay Test

- **Rolling 100-Trade Net R**: Initial = `+0.0259R` | Min = `-0.1274R` | Max = `+0.2497R` | Current = `-0.0837R`
- **Linear Trend Test (Slope per Trade)**: `-2.877925e-04R` (t-stat: `-1.52`, p-value: `0.1293`)
  > [!NOTE] Alpha trend is statistically indistinguishable from zero ($p \ge 0.05$); no significant secular decay.

### Breakdown by Year, Side, and 6-Hour UTC Block (Taker 0.1144% Friction)

#### Calendar Year Breakdown

| Year | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 2022 | 96 | `+0.1342R` | `+0.0198R` | Low Sample (<100) |
| 2023 | 126 | `+0.2687R` | `+0.1543R` | Sufficient |
| 2024 | 143 | `+0.1406R` | `+0.0262R` | Sufficient |
| 2025 | 138 | `+0.1479R` | `+0.0335R` | Sufficient |
| 2026 | 95 | `+0.0418R` | `-0.0726R` | Low Sample (<100) |

#### Side Breakdown (Long vs Short)

| Side | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| LONG | 334 | `+0.1327R` | `+0.0183R` | Sufficient |
| SHORT | 264 | `+0.1776R` | `+0.0632R` | Sufficient |

#### 6-Hour UTC Session Block Breakdown

| Session Block (UTC) | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 00:00-05:59 UTC (Asia Morn) | 151 | `+0.2057R` | `+0.0913R` | Sufficient |
| 06:00-11:59 UTC (London Open) | 69 | `+0.2162R` | `+0.1018R` | Low Sample (<100) |
| 12:00-17:59 UTC (US Open) | 274 | `+0.0567R` | `-0.0577R` | Sufficient |
| 18:00-23:59 UTC (US Close) | 104 | `+0.2856R` | `+0.1712R` | Sufficient |

---

## Detailed Analysis: `multi_model_scalp`

- **Sample Size**: 6,538 completed trades
- **Gross Average Expectancy**: `+0.1622R` per trade
- **Trade Exit Split**: TP: 2,386 (36.5%) | BE: 2,692 (41.2%) | SL: 1,460 (22.3%)
- **True Win Rate (TP / (TP + SL))**: **62.04%**
- **Median Stop Distance**: `0.901%` notional
  > [!WARNING]
  > **Stop Distance Discrepancy**: Model stop distance is `0.90%`. Live scalp stops typically operate at `0.35% - 0.45%`. A tighter live stop multiplies the fee friction in R terms (e.g. at 0.40% stop, 0.1144% friction = 0.286R/trade, whereas at 1.00% stop, friction = 0.1144R/trade).
- **Break-even Exchange Cost**: `0.1461%` round trip. Any exchange fee above this threshold turns the model's net expectancy negative.

### Net Expectancy Under Exchange Friction Scenarios

| Scenario | Round-Trip Cost % | Cost in R | Net Avg R / Trade | 10,000-Resample 95% Bootstrap CI | Expectancy Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **0.1144% (Realistic Taker)** | `0.1144%` | `0.1270R` | **`+0.0352R`** | `[+0.0168, +0.0534]R` | `POSITIVE EDGE` |
| **0.0800% (Mid Taker)** | `0.0800%` | `0.0888R` | **`+0.0734R`** | `[+0.0550, +0.0916]R` | `POSITIVE EDGE` |
| **0.0500% (Maker/Optimistic)** | `0.0500%` | `0.0555R` | **`+0.1067R`** | `[+0.0883, +0.1249]R` | `POSITIVE EDGE` |

### Alpha Stability & Decay Test

- **Rolling 100-Trade Net R**: Initial = `+0.0390R` | Min = `-0.2335R` | Max = `+0.2920R` | Current = `-0.0585R`
- **Linear Trend Test (Slope per Trade)**: `-2.503582e-05R` (t-stat: `-5.10`, p-value: `0.0000`)
  > [!CAUTION] **Statistically Significant Alpha Decay Detected ($p < 0.05$, slope < 0)**. Expectancy has systematically declined over the dataset.

### Breakdown by Year, Side, and 6-Hour UTC Block (Taker 0.1144% Friction)

#### Calendar Year Breakdown

| Year | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 2022 | 1,190 | `+0.2261R` | `+0.0990R` | Sufficient |
| 2023 | 1,177 | `+0.2050R` | `+0.0780R` | Sufficient |
| 2024 | 1,402 | `+0.1730R` | `+0.0460R` | Sufficient |
| 2025 | 1,588 | `+0.1176R` | `-0.0094R` | Sufficient |
| 2026 | 1,181 | `+0.1025R` | `-0.0245R` | Sufficient |

#### Side Breakdown (Long vs Short)

| Side | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| LONG | 3,483 | `+0.1573R` | `+0.0303R` | Sufficient |
| SHORT | 3,055 | `+0.1678R` | `+0.0408R` | Sufficient |

#### 6-Hour UTC Session Block Breakdown

| Session Block (UTC) | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 00:00-05:59 UTC (Asia Morn) | 1,449 | `+0.1404R` | `+0.0134R` | Sufficient |
| 06:00-11:59 UTC (London Open) | 1,629 | `+0.1400R` | `+0.0130R` | Sufficient |
| 12:00-17:59 UTC (US Open) | 2,039 | `+0.2073R` | `+0.0803R` | Sufficient |
| 18:00-23:59 UTC (US Close) | 1,421 | `+0.1453R` | `+0.0183R` | Sufficient |

---

## Detailed Analysis: `multi_model_scalp_5m`

- **Sample Size**: 11,420 completed trades
- **Gross Average Expectancy**: `+0.1007R` per trade
- **Trade Exit Split**: TP: 4,010 (35.1%) | BE: 4,333 (37.9%) | SL: 3,077 (26.9%)
- **True Win Rate (TP / (TP + SL))**: **56.58%**
- **Median Stop Distance**: `0.470%` notional
  > [!WARNING]
  > **Stop Distance Discrepancy**: Model stop distance is `0.47%`. Live scalp stops typically operate at `0.35% - 0.45%`. A tighter live stop multiplies the fee friction in R terms (e.g. at 0.40% stop, 0.1144% friction = 0.286R/trade, whereas at 1.00% stop, friction = 0.1144R/trade).
- **Break-even Exchange Cost**: `0.0473%` round trip. Any exchange fee above this threshold turns the model's net expectancy negative.

### Net Expectancy Under Exchange Friction Scenarios

| Scenario | Round-Trip Cost % | Cost in R | Net Avg R / Trade | 10,000-Resample 95% Bootstrap CI | Expectancy Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **0.1144% (Realistic Taker)** | `0.1144%` | `0.2433R` | **`-0.1426R`** | `[-0.1572, -0.1283]R` | `NEGATIVE EXPECTANCY` |
| **0.0800% (Mid Taker)** | `0.0800%` | `0.1701R` | **`-0.0695R`** | `[-0.0840, -0.0551]R` | `NEGATIVE EXPECTANCY` |
| **0.0500% (Maker/Optimistic)** | `0.0500%` | `0.1063R` | **`-0.0057R`** | `[-0.0202, +0.0087]R` | `INCONCLUSIVE (CI CROSSES ZERO)` |

### Alpha Stability & Decay Test

- **Rolling 100-Trade Net R**: Initial = `-0.0803R` | Min = `-0.4178R` | Max = `+0.1337R` | Current = `-0.1423R`
- **Linear Trend Test (Slope per Trade)**: `-1.204554e-06R` (t-stat: `-0.54`, p-value: `0.5874`)
  > [!NOTE] Alpha trend is statistically indistinguishable from zero ($p \ge 0.05$); no significant secular decay.

### Breakdown by Year, Side, and 6-Hour UTC Block (Taker 0.1144% Friction)

#### Calendar Year Breakdown

| Year | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 2022 | 2,028 | `+0.0865R` | `-0.1568R` | Sufficient |
| 2023 | 2,291 | `+0.1231R` | `-0.1202R` | Sufficient |
| 2024 | 2,112 | `+0.1073R` | `-0.1360R` | Sufficient |
| 2025 | 2,881 | `+0.0876R` | `-0.1557R` | Sufficient |
| 2026 | 2,108 | `+0.1013R` | `-0.1420R` | Sufficient |

#### Side Breakdown (Long vs Short)

| Side | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| LONG | 5,703 | `+0.0924R` | `-0.1509R` | Sufficient |
| SHORT | 5,717 | `+0.1089R` | `-0.1344R` | Sufficient |

#### 6-Hour UTC Session Block Breakdown

| Session Block (UTC) | Sample Size (N) | Gross Avg R | Net Avg R (0.1144% Taker) | Sample Status |
| :--- | :---: | :---: | :---: | :---: |
| 00:00-05:59 UTC (Asia Morn) | 2,822 | `+0.1068R` | `-0.1365R` | Sufficient |
| 06:00-11:59 UTC (London Open) | 2,823 | `+0.0750R` | `-0.1683R` | Sufficient |
| 12:00-17:59 UTC (US Open) | 3,012 | `+0.1328R` | `-0.1105R` | Sufficient |
| 18:00-23:59 UTC (US Close) | 2,763 | `+0.0856R` | `-0.1576R` | Sufficient |

---

