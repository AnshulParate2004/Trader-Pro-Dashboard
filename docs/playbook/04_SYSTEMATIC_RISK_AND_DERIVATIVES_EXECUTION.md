# Institutional Risk Engineering, ATR Volatility Sizing & Derivatives Mechanics

> **Document Path:** `docs/playbook/04_SYSTEMATIC_RISK_AND_DERIVATIVES_EXECUTION.md`  
> **Source Synthesis:** Rayner Teo Systematic Systems, CryptoCred Execution Framework, tastylive Commodity Mechanics  
> **Target Assets:** Standard & Micro Gold Futures (`/GC`, `/MGC`), Standard & Micro Silver Futures (`/SI`, `/SIL`), Crypto Perpetual Futures (`BTCUSDT`, `ETHUSDT`, `SOLUSDT`)  
> **Status:** RATIFIED INSTITUTIONAL PLAYBOOK  

---

## 1. Invalidation-First Philosophy & Fixed Capital Risk ($R$)

Technical analysis, indicators, and machine learning models account for a fraction of trading longevity. The true mathematical determinant of trader survival is **position sizing and risk engineering**.

### 1.1 Invalidation Before Entry
> [!IMPORTANT]
> A trade idea does not exist until the objective price of invalidation is established.
- Never calculate position size or entry triggers based on financial greed (e.g. "How much will I make?").
- The Stop Loss ($SL$) belongs **strictly where the structural market hypothesis is objectively proven false**, never where it feels convenient for account balance.
- If market structure does not provide an objective invalidation floor within risk constraints, **the trade must be aborted**.

### 1.2 The Asymmetric Payoff Mathematics
Trend following and breakout models operate with win rates between **35% and 55%**. Profitability is achieved through strict mathematical asymmetry:

$$\bar{R}_{\text{net}} = (\text{Win Rate} \times \bar{R}_{\text{win}}) - ([1 - \text{Win Rate}] \times 1.0\text{R}) - \text{cost\_R}$$

- Losses are strictly capped at $-1.0\text{R}$ (or less via breakeven fee shielding).
- Winners are allowed to expand to $+2.0\text{R}$, $+2.5\text{R}$, or trailed into multi-$R$ outliers.
- Taking early profits on small winners ($+0.5\text{R}$) destroys the mathematical expectancy required to offset consecutive small losses.

### 1.3 The 1% to 2% Capital Preservation Rule
Losing 50% of account equity requires a **100% gain** just to return to breakeven. Losing 75% requires a **300% gain**. To ensure the risk of ruin is mathematically zero:

$$\text{Maximum Capital Risk per Trade (\$ or ₹)} = \text{Account Equity} \times \text{Risk \%} \quad (\text{where } \text{Risk \%} \in [0.01, 0.02])$$

---

## 2. Volatility-Adjusted ATR Position Sizing (Rayner Teo Framework)

Fixed share or fixed contract sizing introduces dangerous volatility variance into a portfolio. Sizing must be dynamically normalized using the **14-period Average True Range (ATR)**.

$$\text{True Range (TR)} = \max \left( \text{High}_t - \text{Low}_t, \, \vert{}\text{High}_t - \text{Close}_{t-1}\vert{}, \, \vert{}\text{Low}_t - \text{Close}_{t-1}\vert{} \right)$$

$$\text{Stop Distance} = \vert{}\text{Entry Price} - \text{Stop Loss Price}\vert{} = N \times \text{ATR}_{14} \quad (\text{typically } N \in [1.5, 2.5])$$

$$\text{Position Units} = \frac{\text{Maximum Capital Risk}}{\text{Stop Distance}}$$

### 2.1 Multi-Asset Volatility Parity
By scaling position size inversely to ATR, a trade in high-beta Silver (`SI=F`) carries the **exact same rupee/dollar risk** as a trade in lower-volatility Gold (`GC=F`) or Bitcoin (`BTCUSDT`).

---

## 3. Commodity Futures Specifications & SPAN Margin Mechanics (tastylive)

Before executing commodity derivatives, traders must understand notional exposure, tick values, and dynamic margin expansion.

### 3.1 Contract Specifications

| Commodity Contract | Ticker | Exchange | Multiplier | Tick Increment | Tick Value | Notional Value Formula |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Standard Gold** | `/GC` | COMEX | 100 oz | $0.10 / oz | **$10.00** | $\text{Price} \times 100$ |
| **Micro Gold** | `/MGC` | COMEX | 10 oz | $0.10 / oz | **$1.00** | $\text{Price} \times 10$ |
| **Standard Silver** | `/SI` | COMEX | 5,000 oz | $0.005 / oz | **$25.00** | $\text{Price} \times 5,000$ |
| **Micro Silver** | `/SIL` | COMEX | 1,000 oz | $0.005 / oz | **$5.00** | $\text{Price} \times 1,000$ |

- **Notional Exposure Warning:**
  - Gold at $\$2,700/\text{oz} \implies$ One `/GC` contract controls **$\$270,000$** of gold.
  - Silver at $\$32.00/\text{oz} \implies$ One `/SI` contract controls **$\$160,000$** of silver ($a \$1.00 move equals $\$5,000 profit/loss).
  - For small accounts ($<\$50,000$), standard contracts are dangerously oversized. Retail capital must trade micro contracts (`/MGC` or `/SIL`) or micro perpetuals.

### 3.2 SPAN Margin vs. Regulation-T
- **Reg-T (Equities):** Employs fixed, static margin percentages (typically 20% to 50%).
- **SPAN Margin (Futures):** Evaluates risk across a **16-scenario risk array** combining price shocks ($\pm 3 \times \text{daily range}$) and volatility expansions.
- **Dynamic Margin Expansion Invariant:** During rapid commodity breakouts or macroeconomic prints (e.g. CPI/NFP), exchange clearinghouses (CME) increase margin requirements overnight by $30\% \text{ to } 80\%$.
- **The Capital Allocation Buffer Rule:**
  - **Never allocate more than 25% to 50% of account buying power** to active futures margin.
  - Maintain the remaining 50%+ in unencumbered cash/liquid collateral to absorb sudden margin expansions without forced liquidations.

---

## 4. Options Greeks & Implied Volatility Rank (tastylive Framework)

When hedging or taking directional exposure via options on futures:

### 4.1 The Greek Risk Architecture
- **Delta ($\Delta$):** Directional exposure and rough probability of expiring In-The-Money (ITM).
- **Gamma ($\Gamma$):** Acceleration of Delta. Gamma risk escalates exponentially within **21 Days to Expiration (DTE)**.
- **Theta ($\Theta$):** Daily decay of extrinsic premium. The decay curve experiences its steepest inflection between **45 DTE and 21 DTE**.
- **Vega ($\nu$):** Sensitivity to shifts in Implied Volatility (IV).

### 4.2 The Implied Volatility Rank (IVR) Filter
$$\text{IV Rank (IVR)} = \frac{\text{Current IV} - \text{52-Week Low IV}}{\text{52-Week High IV} - \text{52-Week Low IV}} \times 100$$

- **IV Rank $> 35-50\%$:** Premium is rich. Selling volatility (credit spreads, strangles) carries statistical edge.
- **IV Rank $< 25\%$:** Premium is cheap. Selling premium yields inadequate compensation for tail risk. Favor long directional breakouts.
- **Precious Metals Call Skew:** Unlike equities (where put IV exceeds call IV), Gold and Silver frequently exhibit **call skew**, where out-of-the-money calls trade at elevated IV due to inflation/geopolitical flight.

### 4.3 The 45 DTE Entry & 21 DTE Exit Rule
1. **Entry at $\approx 45\text{ DTE}$:** Captures the optimal slope of theta decay while keeping gamma risk minimal.
2. **Manage Winners at 50% Max Profit:** Taking profit at 50% of credit received dramatically improves portfolio win rate and shortens market exposure duration.
3. **Exit / Roll at 21 DTE:** Close or roll positions when 21 DTE is reached, eliminating catastrophic gamma gap risk and delivery notice exposure.

---

## 5. Retail Execution Protocol for Indian Accounts (₹1,000 Capital per Asset)

Our trading bots execute on retail capital under strict Indian statutory and exchange fee realities:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   INDIAN RETAIL CAPITAL ALLOCATION                     │
│                                                                        │
│  Dedicated Capital per Asset: ₹1,000 INR                               │
│  Total Portfolio Allocation (7 Assets): ₹7,000 INR                     │
│  Standard 1R Risk Baseline: ₹50 - ₹100 INR per Trade                   │
│  Friction Shield: Shark Futures (0.018% Maker / 0.040% Taker + 18% GST)│
│  Statutory Indian TDS Defense: Minimum 4H / 1H Cadence (Zero Scalping) │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Account Isolation & Position Sizing
- Each of the 7 assets (`BTC`, `ETH`, `SOL`, `DOT`, `GC=F`, `SI=F`, `CL=F`) is allocated exactly **₹1,000 INR**.
- Position size per trade is strictly capped at **₹1,000.00 INR** ($1.0\text{x}$ leverage baseline).
- Maximum loss per trade is bounded to **₹50.00 to ₹100.00 INR** ($-1.0\text{R}$).

### 5.2 The Fee-Shield Breakeven Trigger
- Exchange friction (brokerage + GST + slippage) totals $\approx 0.05\% \text{ to } 0.1144\%$.
- When a trade advances by **$+0.30\text{R}$ into profit**, the autonomous executor automatically trails the Stop Loss to **$\text{Entry} + \text{round-trip fee}$**, locking in a guaranteed net $0.00\text{R}$ exit if price reverses.
- This shields retail capital from death-by-a-thousand-cuts fee drag while preserving upside for $+2.5\text{R}$ target completions.
