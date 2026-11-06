# Sealed Hold-Out Integrity Log: Setup 4H-B

## 1. Protocol Violation & Hold-Out Audit Record

> **Status**: **NOT A VALID STATISTICAL PASS**  
> **Integrity Level**: **BURNED / CONTAMINATED**  
> **Action**: 4H-B is permanently rejected from production deployment. The sealed hold-out window is burned and locked against all future 4H development.

---

## 2. Chronology of Events

1. **Pre-Registration**:
   - `prereg_4H-B.md` pre-registered 108 candidate parameter variants.
   - Pre-registered development gate: **Minimum 150 closed trades on development data** ($N_{DEV} \ge 150$), **Net R > +0.03R**, and **95% Bootstrap CI lower bound > 0.00R**.
2. **Development Gate Failure**:
   - Across all 108 variants, **ZERO (0/108) variants passed the development gate**.
   - The top candidate (Variant #1: Donchian-20 Breakout + 18-bar Horizon + 14-ATR Stop) produced only **38 closed trades** on development data ($38 < 150$).
3. **Improper Hold-Out Evaluation**:
   - Despite failing dev gates ($0/108$ passed), the sealed hold-out was opened.
   - Hold-out produced **65 closed trades** with an apparent return of `+0.2814R` (95% CI: `[+0.0483, +0.5069]R`).
4. **Invalidation**:
   - Because $N_{HOLDOUT} = 65 < 150$, the test has inadequate statistical power and is vulnerable to small-sample regime clustering.
   - Opening the hold-out on a candidate that failed dev gates violates quantitative pre-registration protocol.
   - The result of `+0.2814R` is **NOT evidence of a genuine edge**.

---

## 3. Burned Time Windows for 4H Timeframe

| Time Window | Date Span | Candles ($N$) | Trades Evaluated | Status |
| :--- | :--- | :---: | :---: | :--- |
| **Development Window** | `2020-01-01 00:00:00` to `2024-04-30 20:00:00` | 9,486 | 38 trades | Exhausted (0/108 passed dev gates) |
| **Sealed Hold-Out Window** | `2024-05-01 00:00:00` to `2026-10-27 20:00:00` | 5,461 | 65 trades | **BURNED (Opened once, invalid pass)** |

---

## 4. Operational Injunctions

1. **Sealed Hold-Out is Locked**: The hold-out window (`2024-05-01` to `2026-10-27`) must **NEVER be reopened** for 4H tuning, variant selection, or retraining.
2. **Setup 4H-B Locked Out**: Setup 4H-B is strictly barred from live execution and cron scheduling.
3. **Public Disclosure**: All dashboard components (`ResearchResultsTable.tsx`, `README.md`) must display the explicit label: *"Not tested properly: dev gates failed (38 trades), hold-out has 65 trades; not evidence of an edge"*.
4. **Re-simulation Disclaimer**: Any historical 4H "+0.07R at live stop" metric must be labeled as *"estimated, unvalidated; negative under pessimistic same-candle assumption"*.
