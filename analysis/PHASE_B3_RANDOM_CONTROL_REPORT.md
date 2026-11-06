# Phase B3: Random-Entry Control & Shuffled-Score Audit

> **Methodology**: Evaluates whether directional predictive models possess genuine entry alpha beyond a random coin toss. Runs the identical production exit logic (live stop rule `min(1.0*ATR, 0.05*price)`, TP +1.0R, Breakeven ratchet +0.30R -> +0.05R lock, vertical time barrier) and realistic 0.1144% taker round-trip friction across 100 random seeds for:
> 1. **Random Entries**: Non-overlapping random entries matching identical trade frequency and long/short ratio.
> 2. **Shuffled Model Timing**: Random permutation of actual signal timings across the multi-year history.

---

## 1. Real Model vs Random-Entry Controls (100 Seeds)

| Timeframe | Trades ($N$) | Metric | Real Model | Random Entries Mean [5th, 95th %ile] | Shuffled Scores Mean [5th, 95th %ile] | Model Alpha vs Random | Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **15M** | 14,654 | **Gross R** | `+0.0944R` | `-0.0431R [-0.0507, -0.0363]R` | `-0.0429R [-0.0510, -0.0325]R` | `+0.1375R` | Marginal |
| | | **Net R (0.1144%)** | **`-0.2956R`** | **`-0.4381R [-0.4459, -0.4305]R`** | **`-0.4374R [-0.4456, -0.4277]R`** | `+0.1426R` | Negative Net Expectancy |
| | | | | | | | |
| **1H** | 3,587 | **Gross R** | `+0.0932R` | `-0.0319R [-0.0459, -0.0144]R` | `-0.0317R [-0.0487, -0.0147]R` | `+0.1251R` | Marginal |
| | | **Net R (0.1144%)** | **`-0.0757R`** | **`-0.2074R [-0.2205, -0.1899]R`** | **`-0.2069R [-0.2235, -0.1905]R`** | `+0.1317R` | Negative Net Expectancy |
| | | | | | | | |
| **4H** | 961 | **Gross R** | `+0.0781R` | `-0.0142R [-0.0415, +0.0115]R` | `-0.0133R [-0.0439, +0.0157]R` | `+0.0923R` | Marginal |
| | | **Net R (0.1144%)** | **`+0.0000R`** | **`-0.0937R [-0.1199, -0.0674]R`** | **`-0.0925R [-0.1243, -0.0636]R`** | `+0.0937R` | Zero / Negative Net Expectancy |

---

## 2. Key Findings & Scientific Verdict

### A. Real Model Alpha vs Random Baseline
1. **Gross Alpha (+0.09R to +0.13R above random)**:
   - Random entries average Gross R of `-0.0431R` (15M), `-0.0319R` (1H), and `-0.0142R` (4H).
   - Shuffled model timings produce identical baseline results (`-0.0429R`, `-0.0317R`, `-0.0133R`).
   - The real model achieves Gross R of `+0.0944R` (15M), `+0.0932R` (1H), and `+0.0781R` (4H), indicating that the trend/momentum signal adds ~`+0.09R` to `+0.13R` gross alpha over random guessing.

### B. The Devastating Impact of Exchange Friction
2. **Gross Alpha is Completely Erased by Fee Drag**:
   - At the observed 15M live stop size (`0.2287%` median, `0.421%` mean), 0.1144% taker round-trip friction imposes a drag of **`-0.3901R`** per trade.
   - Adding `+0.0944R` gross alpha to `-0.3901R` friction leaves **`-0.2956R` Net Expectancy**.
   - On 1H, with an estimated `0.874%` stop, friction is **`-0.1695R`**. Adding `+0.0932R` gross alpha leaves **`-0.0757R` Net Expectancy**.
   - On 4H, with an estimated `1.755%` stop, friction is **`-0.0782R`**. Adding `+0.0781R` gross alpha leaves **`+0.0000R` Net Expectancy** (exactly zero). Under pessimistic same-candle resolution (SL first), 4H Net R drops to **`-0.0297R`**.

### C. Scientific Verdict
> **Scientific Verdict**: While the directional signal has weak positive gross alignment (`+0.09R` to `+0.13R` over random entries), it is mathematically incapable of overcoming realistic exchange friction at live stop sizes. Neither the 15M scalper nor the 1H strategy can survive in live trading. On 4H, net expectancy is non-positive (`0.0000R` standard, `-0.0297R` pessimistic).
