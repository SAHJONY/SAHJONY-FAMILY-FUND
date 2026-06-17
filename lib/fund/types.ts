// SAHJONY FAMILY FUND — shared types for the multi-asset book.
//
// One book holds many asset classes. For OPTIONS, entry_price / target_price /
// stop_price are PER SHARE; each contract is 100 shares, so per-contract dollar
// value is price × 100. For everything else the multiplier is 1.

export type AssetType = "option" | "shares" | "cash" | "bond" | "real_estate" | "alt";
export type OptionType = "call" | "put";

export interface Position {
  id: string;
  asset_type: AssetType;
  ticker: string;            // underlying symbol; "—" for cash / unlisted alts
  label?: string;            // human label (cash account, property, fund name)
  sector?: string;           // optional sector override

  // option-only
  option_type?: OptionType;
  strike?: number;           // per share
  expiry?: string;           // YYYY-MM-DD

  // shared economics (per-share for option/shares/bond; per-unit for alts)
  entry_price: number;       // cost basis per share/unit
  contracts: number;         // contracts (options), shares (shares), dollars (cash), units (alt)
  entry_date?: string;       // YYYY-MM-DD
  target_price?: number;     // per share/unit (the owner's own target)
  stop_price?: number;       // per share/unit

  // illiquid / no-feed assets: owner-supplied current mark per unit
  manual_mark?: number;
}

export type MarkSource = "live" | "manual" | "unavailable";

export interface Greeks {
  delta: number;             // per share
  gamma: number;
  theta: number;             // per share per day (dollar terms below in valuation)
  vega: number;              // per 1.00 vol (i.e. per 100 IV points); scaled in analytics
  iv: number;                // implied vol used (decimal, e.g. 0.45)
}

export interface ValuedPosition {
  pos: Position;
  multiplier: number;        // 100 for options, else 1
  mark: number;              // current price per share/unit
  markSource: MarkSource;
  value: number;             // current dollar value of the holding
  costBasis: number;         // entry_price × contracts × multiplier
  pnl: number;               // unrealized $ P&L
  pnlPct: number;            // unrealized % P&L
  dte: number | null;        // days to expiry (options) else null
  progressToTarget: number | null; // % of the way from entry to target (0..100+)
  progressToStop: number | null;   // % of the way from entry to stop
  greeks: Greeks | null;     // options only
  contractMatched: boolean;  // option chain row located for this contract
  bid: number | null;
  ask: number | null;
  last: number | null;
  volume: number | null;
  openInterest: number | null;
}

// ---- Layer 2 analytics -----------------------------------------------------
export interface AllocationSlice { key: string; value: number; pct: number; overCap: boolean }
export interface PortfolioAnalytics {
  nav: number;
  byTicker: AllocationSlice[];
  bySector: AllocationSlice[];
  byAssetClass: AllocationSlice[];
  netDelta: number;          // share-equivalent across the book
  dailyTheta: number;        // $ the book bleeds per day if nothing moves
  netVega: number;           // $ per 1 IV point
  ivEnvironment: IvEnvironment[];
  dteFlags: { id: string; ticker: string; dte: number }[];
  concentrationFlags: string[];
}
export interface IvEnvironment {
  id: string;
  ticker: string;
  iv: number;
  ivRank: number | null;     // 0..100, null while building history
  status: "rich" | "cheap" | "normal" | "building history";
  historyDays: number;
}

// ---- Layer 3 macro + news --------------------------------------------------
export interface MacroComponent { name: string; raw: number | null; score: number; weight: number; note: string }
export interface MacroGate {
  score: number;             // 0..100, deterministic
  components: MacroComponent[];
  asof: string;
  available: boolean;
}
export interface NewsAnalysis {
  ticker: string;
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  drivers: string[];
  positionFlag: string | null; // anything that specifically affects a held position
  headlines: { title: string; publisher: string; link: string; ts: number }[];
  model: string;             // which model produced the read
  cached: boolean;
  asof: string;
}

// ---- Layer 4 alerts --------------------------------------------------------
export type AlertSeverity = "high" | "warn" | "info";
export type AlertKind =
  | "target_hit" | "stop_hit" | "target_near" | "iv_change"
  | "new_strikes" | "new_expiry" | "dte" | "concentration" | "news";
export interface Alert {
  kind: AlertKind;
  severity: AlertSeverity;
  ticker: string;
  message: string;           // always a FACT — "hit your target level", never "buy"
  driver?: string;           // one-line context
}

// ---- The full daily report (stored to fund-state.json) ---------------------
export interface FundReport {
  asof: string;
  generatedAt: number;
  positions: ValuedPosition[];
  analytics: PortfolioAnalytics;
  macro: MacroGate;
  news: NewsAnalysis[];
  alerts: Alert[];
  newStrikes: { ticker: string; expiry: string; strikes: number[] }[];
  newExpiries: { ticker: string; expiries: string[] }[];
  errors: string[];          // honest record of any feed that failed
}
