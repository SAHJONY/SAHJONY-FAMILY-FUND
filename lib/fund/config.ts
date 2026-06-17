// SAHJONY FAMILY FUND — system configuration.
//
// This whole system is a MONITOR. It reports conditions, values the book off
// real feeds, computes risk deterministically, and tracks the OWNER's own
// targets and stops. It never recommends a trade or routes an order. The only
// non-deterministic piece is the daily news read (Layer 3), and even that only
// summarizes and flags — it does not say buy or sell.
//
// Every knob the blueprint calls "configurable" lives here so the behaviour is
// reproducible: same config + same data in → same numbers out.

export interface FundConfig {
  riskFreeRate: number;        // annual, for Black-Scholes (default 0.045)
  // Layer 2 — concentration caps (informational flags only)
  tickerCapPct: number;        // warn if any ticker exceeds this % of NAV
  sectorCapPct: number;        // warn if any sector exceeds this %
  assetClassCapPct: number;    // warn if any asset class exceeds this %
  // Layer 2 — IV environment
  ivLookbackDays: number;      // history window for IV rank/percentile (252)
  ivMinHistoryDays: number;    // below this, label "building history" (20)
  ivRichThreshold: number;     // IV rank > this = rich (70)
  ivCheapThreshold: number;    // IV rank < this = cheap (30)
  dteFlagDays: number;         // flag options with DTE <= this (45)
  // Layer 3 — macro gate weights (must sum to 1.0)
  macroWeights: {
    vixLevel: number;
    vixTerm: number;
    breadth: number;
    credit: number;
  };
  newsWindowDays: number;      // headline lookback (3)
  // Layer 4 — alert thresholds
  targetNearPct: number;       // within this % of target fires target_near (80)
  ivChangeAlertPct: number;    // IV move vs prior snapshot to alert (20)
  newStrikeBandPct: number;    // new strikes within ±this % of held strikes (30)
}

export const DEFAULT_CONFIG: FundConfig = {
  riskFreeRate: 0.045,
  tickerCapPct: 40,
  sectorCapPct: 60,
  assetClassCapPct: 70,
  ivLookbackDays: 252,
  ivMinHistoryDays: 20,
  ivRichThreshold: 70,
  ivCheapThreshold: 30,
  dteFlagDays: 45,
  macroWeights: { vixLevel: 0.35, vixTerm: 0.2, breadth: 0.3, credit: 0.15 },
  newsWindowDays: 3,
  targetNearPct: 80,
  ivChangeAlertPct: 20,
  newStrikeBandPct: 30,
};

// Ticker → sector lookup. yfinance/quote info is used as a fallback at runtime
// when a symbol isn't here; this table just makes the common holdings stable.
export const SECTOR_MAP: Record<string, string> = {
  AAPL: "Technology", MSFT: "Technology", NVDA: "Technology", GOOGL: "Technology",
  GOOG: "Technology", META: "Technology", AMZN: "Consumer Discretionary",
  TSLA: "Consumer Discretionary", NOK: "Technology", AMD: "Technology",
  JPM: "Financials", BAC: "Financials", BRK_B: "Financials",
  XOM: "Energy", CVX: "Energy", JNJ: "Healthcare", UNH: "Healthcare",
  SPY: "Index", QQQ: "Index", IWM: "Index",
  TLT: "Fixed Income", HYG: "Fixed Income", AGG: "Fixed Income",
  GLD: "Commodities", SLV: "Commodities",
};
