# SAHJONY CAPITAL LLC — Institutional Blueprint

> **Scope & compliance note.** This document is the *design blueprint* for the
> SAHJONY CAPITAL LLC quantitative research stack. The shipped system is a
> **monitor and research/education tool**. It reports structural conditions,
> surfaces facts, tracks user-defined targets, and applies institutional
> analytical *frameworks* to explain what data shows. It does **not** issue
> personalized buy/sell/hold ratings or price targets as advice, and it does
> **not** route, simulate, or execute real orders. Parts of this blueprint that
> describe order execution (FIX/DMA gateways, TWAP/VWAP routers, broker routing)
> are recorded here as reference architecture only and are intentionally **not
> implemented** — execution always stays with the user and their own broker.

This stack is implemented in TypeScript/Next.js (adapting the original Python
blueprint to the deployed Vercel/Next stack). Map of blueprint → code:

| Blueprint layer | Implementation |
|---|---|
| L1 Data & Valuation | `lib/fund/market.ts`, `lib/fund/greeks.ts`, `lib/fund/valuation.ts`, `lib/fund/store.ts` |
| L2 Portfolio Analytics | `lib/fund/analytics.ts` |
| L3 Macro Gate & News | `lib/fund/macro.ts`, `lib/fund/news.ts` |
| L4 Alerts, Dashboard, Notifier | `lib/fund/alerts.ts`, `lib/fund/notify.ts`, `components/FundDashboard.tsx` |
| Quant lab (backtest/signals/sizing/paper) | `lib/fund/quant/*`, `components/StrategyLab.tsx` |
| 12-agent intelligence layer | `lib/fund/personas.ts`, `lib/fund/brain.ts` (Claude→OpenAI→Groq→NIM) |
| Accounts / multi-tenant / billing | `lib/fund/auth.ts`, `lib/fund/kv.ts`, `lib/fund/vault.ts`, `lib/fund/billing.ts`, `app/api/auth`, `app/admin` |

---

## PART I — The Execution Engine (core modules)

**Layer 1 · Data & Valuation.** One book, two+ asset classes (options, shares;
extended to cash/bond/real-estate/alt). Options use per-share entry/target/stop
with a ×100 contract multiplier. Market data (spot, chains, IV/bid/ask/last/
volume/OI) via the data layer; mark = mid when bid+ask valid, else last; equity
mark = spot. Local closed-form Black-Scholes Δ/Γ/Θ/V (no external option lib),
configurable risk-free rate (0.045), actual DTE. Dated snapshots persisted for
diffing and IV history. Per-position valuation: mark, value, P&L $ and %, DTE,
progress to target/stop.

**Layer 2 · Portfolio Analytics.** Allocation by ticker/sector/asset-class with
informational concentration caps (ticker 40%, sector 60%). Book Greeks: net
delta (share-equiv), daily theta bleed ($), net vega ($/IV pt). IV rank /
percentile over a 252-day lookback ("building history" < 20 pts; rich > 70,
cheap < 30). DTE flags (45-day default). Facts only — no roll recommendations.

**Layer 3 · Macro Gate & News.** Deterministic 0–100 macro score from VIX level
+ 1y percentile, VIX term structure (VIX vs VIX3M), breadth (% > 200-day MA),
and credit (HYG vs TLT), weights summing to 1.0. Daily news read per held name
routed through the engine chain (Claude → OpenAI → Groq → NIM), cached per user
per name per day. Summarizes and flags; never a trade trigger.

**Layer 4 · Alerts, Dashboard, Notifier.** Chain diff engine (new strikes within
±30% of held strikes, new expiries). Condition alerts: target_hit/stop_hit
(high), target_near (info, 80%), iv_change (warn, 20%), new_strikes/new_expiry
(info). Bloomberg-style single-page dashboard (status strip, alerts, dense
positions grid, allocation, macro gauge, news). Optional Telegram/iMessage
notifier (off by default). Weekday-close cron runs every active user's book.

---

## PART II — The 12-Agent Institutional Intelligence Layer

Each persona is an **analytical lens** the brain adopts to *explain* what the
data shows, applying a famous institution's framework. The product's hard rule
overrides every persona's traditional output style: **no personalized buy/sell/
hold ratings, no price targets as advice, no order routing.** Implemented in
`lib/fund/personas.ts`; selectable in the Analyst Brain UI.

| # | Persona | Firm | Lens (explanatory) |
|---|---|---|---|
| 1 | Systematic Strategy | Citadel | Inefficiency/regime: which pattern (momentum/mean-reversion/value/vol), universe bounds, rule conditions, regime shifts |
| 2 | Backtest & Verification | Two Sigma | IF/THEN logic, Sharpe/Sortino/max-DD/win-rate, overfitting & survivorship friction |
| 3 | All-Weather Risk | Bridgewater | Vol-aware exposure, hidden correlations, circuit-breaker/drawdown concepts |
| 4 | Pattern Scanner | Renaissance | Seasonal/event dynamics, volume-at-price, gap-fill, ≥2σ mean-reversion |
| 5 | Technical Strategy | Goldman Sachs | Multi-timeframe trend, S/R nodes, MAs (20/50/200), RSI/MACD, Fib zones |
| 6 | Fundamental Research | JPMorgan | Earnings/margin quality, NI vs FCF, balance sheet, valuation multiples (no rating) |
| 7 | Options Architecture | D.E. Shaw | Spread/condor/straddle/LEAP payoff shape, 30–45 DTE, Greeks, breakevens |
| 8 | Factor Investing | AQR | Value/Momentum/Quality/Size/LowVol decomposition, factor crowding |
| 9 | HFT Market Maker | Citadel Securities | Order-flow toxicity (VPIN), spread capture, queue/inventory microstructure |
| 10 | Pod Allocator | Millennium / Point72 | Alpha isolation, beta-neutrality, correlation, hard drawdown stop-outs |
| 11 | Statistical Arbitrage | Renaissance Medallion | Regime (HMM-style) states, multi-asset cointegration, non-linear anomalies |
| 12 | Sovereign Allocation | Sovereign Wealth | Macro-regime alignment, strategic asset allocation, multi-decade purchasing-power |

```
       [ PORTFOLIO INPUTS / RAW MARKET DATA SNAPSHOTS ]
                              │  ▼
   CORE COMPUTATIONAL ENGINES (Black-Scholes / IV / Macro Gate / Diffs)
                              │  ▼
   THE 12-AGENT INSTITUTIONAL INTELLIGENCE LAYER (explanatory lenses)
```

---

## PART III — Global Infrastructure (reference only; NOT implemented)

Recorded as target architecture for scale, **deliberately not built** because it
crosses into order execution, which this system never performs:
multi-venue regulatory routing (Reg SHO, MiFID II/LEI logging), multi-currency
FX sub-ledger, FIX 4.2/4.4 DMA gateway with TWAP/VWAP/Implementation-Shortfall
routers, ultra-low-latency co-location/Redis. If ever pursued, execution and
brokerage remain entirely the user's responsibility through their own broker.

---

## PART IV — Micro-Capital Guardrails (≤ $50 accounts)

Capital-preservation filters for small sub-portfolios: fractional/ETF
divisibility checks (<$50 unit, 8-dp for digital assets); zero-flat-fee routing
(flat fees compound-erode tiny accounts); FINRA/SEC PDT awareness (<$25k →
cash-only, respect T+1/T+2 settlement, no intraday re-entry); options
multiplier collateral block (premium × 100) — pivot to fractional profiles
until balance supports a contract. These are **informational guardrails**, not
execution controls.

---

## PART V — Runner & Interaction Modes

1. **Programmatic runner** — the daily pipeline computes valuation/analytics/
   macro and a per-name news digest, stores it per user, and renders the
   dashboard.
2. **Interactive analysis** — in the Analyst Brain, the user picks one of the 12
   institutional lenses (or General); the brain applies that framework to
   explain their book. Always explanatory, never a trade instruction.
