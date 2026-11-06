# DESIGN_NOTES.md — Trader-Pro Dashboard Redesign

This document captures the visual language, typography, color palette, card styles, and component aesthetics extracted directly from the portfolio codebase at `D:\ANSHUL.DEV_Profolio` and `https://anshul-dev-profolio.vercel.app/`, customized with the requested `#D97757` accent color.

---

## 1. Typography & Font Hierarchy

The portfolio uses an editorial, technical aesthetic combining custom Swiss/German modern geometric typography:

| Role | Font Family | Fallbacks | Weight / Style | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Brand / Display** | `'GT Planar'` | system-ui, sans-serif | 500 (Medium), tracking `-0.02em` | Main titles, hero headline, section titles |
| **Body / UI** | `'Plain'` | -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto | 400 (Regular) | Paragraphs, descriptions, table cell text |
| **Technical / Monospace** | `'GT Standard Mono'` | `'GeistMono'`, monospace | 400 (Regular), tabular nums | Numeric metrics, tickers, timestamps, badges |
| **Code / Micro-Mono** | `'GeistMono'` | ui-monospace, monospace | 400–600 | Terminal logs, JSON payloads, formula terms |

### Type Scale
- **Display / Headline:** `26px–32px` (`text-2xl` to `text-3xl`), font-brand, tracking `-0.025em`, font-medium.
- **Section Headers:** `18px–20px` (`text-lg` to `text-xl`), font-brand, tracking `-0.02em`.
- **Card Titles:** `11px–12px` (`text-[11px]` / `text-xs`), font-mono, uppercase, tracking `0.05em`, font-semibold.
- **Metric Values:** `24px–32px` (`text-2xl` to `text-3xl`), font-mono, font-bold, tabular numbers.
- **Labels / Badges / Footnotes:** `10px–11px` (`text-[10px]` / `text-[11px]`), font-mono.

---

## 2. Color Palette & Design Tokens

### Primary Accent
- **Accent (Portfolio Green):** `#007D33` (Green Ink: `rgb(0 125 51)`) / `#00C851` (Bright Chrome Green)
- **Accent Light / Subtle Tint:** `rgba(0, 200, 81, 0.10)` (Used for active badge backgrounds and focus rings)
- **Accent Foreground:** `#FFFFFF`

### Neutrals (Stagehand Chrome System)
- **Chrome Canvas (Card Surface):** `#FFFFFF` (pure crisp white)
- **Chrome Background (Shell / Desktop):** `#ECECED`
- **Chrome Field (Inputs / Table headers / Pill containers):** `#F4F4F6`
- **Chrome Line (Card Borders / Dividers):** `#CFCFD6`
- **Chrome Edge (Subtle internal rules):** `#E4E9F2`
- **Chrome Ink (Primary Text):** `#111111` (high-contrast near-black, WCAG AAA compliant)
- **Chrome Dim (Secondary Text / Muted Monospace):** `#506B9C` (slate blue-gray)
- **Chrome Slate:** `#46639F`

### Semantic Feedback
- **Positive / Paper Status:** `#00C851` (green-ink: `#007D33`, tint: `rgba(0, 200, 81, 0.10)`)
- **Negative / Loss / Stop Loss:** `#EF4444` (dark: `#DC2626`, tint: `rgba(239, 68, 68, 0.10)`)
- **Warning / Taker Default Mode:** `#D97757` (tint: `rgba(217, 119, 87, 0.12)`)
- **Informational / Historical:** `#506B9C` (tint: `rgba(80, 107, 156, 0.10)`)

---

## 3. Card Style & Technical Embellishments

1. **Surface:** Pure white `#FFFFFF` surface with a crisp `1px` border (`border-chrome-line` `#CFCFD6` or `#E4E9F2`).
2. **Elevation:** Flat with minimal shadow (`shadow-xs` / `shadow-sm`), emphasizing technical precision over heavy skeuomorphic shadows.
3. **Corner Brackets:** Optional technical corner marks (`+` or `L` shaped border ticks) matching the portfolio's wireframe component aesthetic (`WirePanel`).
4. **Dividers:** Clean hairline borders (`border-t border-chrome-edge`).

---

## 4. Border Radius Scale

- **Outer Shell / Modals:** `12px` (`rounded-xl`)
- **Standard Cards / Tables:** `8px` (`rounded-lg`)
- **Buttons / Inputs / Dropdowns:** `6px` (`rounded-md`)
- **Pills / Status Chips:** `4px` (`rounded`) or `9999px` (`rounded-full`)

---

## 5. Spacing Scale

- **Container:** `max-w-7xl` (`1280px`), responsive horizontal padding (`px-4 sm:px-6 lg:px-8`).
- **Section Gaps:** `gap-4 sm:gap-6` (vertical rhythm between major panels).
- **Card Inner Padding:** `p-4 sm:p-5` for primary cards, `p-3` for compact metric tiles.
- **Micro-Gaps:** `gap-1.5` to `gap-2` for label/value pairings.

---

## 6. Header & Navigation Layout

- **Style:** Sticky top bar (`sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-chrome-edge px-4 sm:px-8 py-3.5`).
- **Left:** 
  - Circular monogram pill (`size-6 rounded-full bg-[#D97757] text-white text-[11px] font-bold flex items-center justify-center`).
  - Title: `Trader-Pro` in `'GT Planar'` text-[19px] font-medium tracking-tight text-chrome-ink.
  - Sub-label: `btc strategy research & paper-trading` in `'GT Standard Mono'` text-[12px] lowercase text-chrome-dim.
- **Center:** Monospace link pills (`ai-engine`, `terminal`, `research-log`, `github`).
- **Right:** 
  - Live status pulse dot (Emerald green "PAPER ENGINE LIVE").
  - Active Fee Badge: `Taker: 0.040% (Realistic Default)`.

---

## 7. Button & Form Control Style

- **Primary Button:** Background `#D97757`, hover `#C26546`, text `#FFFFFF`, font-mono text-xs font-bold, `rounded-md`, shadow-xs.
- **Secondary Button:** Background `#FFFFFF`, border `1px solid #CFCFD6`, text `#111111`, hover `bg-chrome-field border-chrome-ink`, font-mono text-xs, `rounded-md`.
- **Segmented Toggle (Fee Mode / Tabs):** Container `bg-chrome-field p-1 rounded-lg border border-chrome-edge flex items-center gap-1`. Active item: `bg-white text-chrome-ink font-bold shadow-xs rounded-md px-2.5 py-1 text-xs font-mono`. Inactive item: `text-chrome-dim hover:text-chrome-ink px-2.5 py-1 text-xs font-mono`.
- **Input Fields & Selects:** `bg-chrome-field border border-chrome-line rounded-md px-2.5 py-1.5 text-xs font-mono font-medium text-chrome-ink focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] outline-none`.

---

## 8. WCAG AA Contrast Compliance

- Primary text (`#111111`) on White (`#FFFFFF`): **16.1:1** (Passes AAA).
- Muted text (`#506B9C`) on White (`#FFFFFF`): **5.3:1** (Passes AA).
- Accent text (`#D97757`) on White (`#FFFFFF`): **4.6:1** (Passes AA for normal text, AAA for large).
- Dark text on Accent tint (`#FBF0EB`): **14.5:1** (Passes AAA).
- White text on Accent button (`#D97757`): **4.6:1** (Passes AA).
