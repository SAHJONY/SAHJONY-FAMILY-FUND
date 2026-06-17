// SAHJONY FAMILY FUND — Layer 1: valuation.
//
// Per position: mark, current value, unrealized P&L ($ and %), DTE for options,
// and progress toward the OWNER's own target and stop. Options are valued off
// the matched chain row (mark = mid when bid+ask exist, else last) with Greeks
// from the contract's IV. Shares/ETFs mark to spot. Cash is par. Illiquid alts
// and real estate use the owner-supplied manual mark — tagged "manual", never
// passed off as a live feed.

import type { Position, ValuedPosition, MarkSource } from "./types";
import type { Quote, OptionChain } from "./market";
import { blackScholes, yearsToExpiry, daysToExpiry } from "./greeks";
import type { FundConfig } from "./config";

export interface TickerData {
  quote: Quote | null;
  // expiry (YYYY-MM-DD) -> chain for that expiry
  chains: Record<string, OptionChain>;
}
export type MarketBook = Record<string, TickerData>;

function multiplierFor(p: Position): number {
  return p.asset_type === "option" ? 100 : 1;
}

// Progress from entry → level, as a percent. 100% = at the level. Phrased as a
// fact ("how close to your target"), not a recommendation.
function progress(entry: number, current: number, level: number | undefined): number | null {
  if (level == null || !isFinite(level) || entry === level) return null;
  return Math.round(((current - entry) / (level - entry)) * 100);
}

export function valuePosition(
  p: Position,
  book: MarketBook,
  cfg: FundConfig,
  asof: string
): ValuedPosition {
  const multiplier = multiplierFor(p);
  const costBasis = p.entry_price * p.contracts * multiplier;

  let mark = 0;
  let markSource: MarkSource = "unavailable";
  let greeks: ValuedPosition["greeks"] = null;
  let dte: number | null = null;
  let contractMatched = false;
  let bid: number | null = null, ask: number | null = null, last: number | null = null;
  let volume: number | null = null, openInterest: number | null = null;

  if (p.asset_type === "cash") {
    mark = 1; markSource = "manual";
  } else if (p.asset_type === "real_estate" || p.asset_type === "alt") {
    if (typeof p.manual_mark === "number") { mark = p.manual_mark; markSource = "manual"; }
  } else if (p.asset_type === "option") {
    dte = p.expiry ? daysToExpiry(p.expiry, asof) : null;
    const chain = p.expiry ? book[p.ticker]?.chains[p.expiry] : undefined;
    const row = chain?.rows.find(
      (r) => r.type === (p.option_type ?? "call") && Math.abs(r.strike - (p.strike ?? -1)) < 1e-6
    );
    if (row) {
      contractMatched = true;
      bid = row.bid; ask = row.ask; last = row.last;
      volume = row.volume; openInterest = row.oi;
      mark = bid != null && ask != null && bid > 0 && ask > 0 ? (bid + ask) / 2 : (last ?? 0);
      markSource = mark > 0 ? "live" : "unavailable";
      const spot = chain?.spot ?? book[p.ticker]?.quote?.price ?? 0;
      const T = p.expiry ? yearsToExpiry(p.expiry, asof) : 0;
      if (spot > 0 && row.iv > 0 && T > 0 && p.strike) {
        greeks = blackScholes(p.option_type ?? "call", spot, p.strike, T, cfg.riskFreeRate, row.iv);
      }
    } else if (typeof p.manual_mark === "number") {
      mark = p.manual_mark; markSource = "manual";
    }
  } else {
    // shares / bond ETF — mark to spot
    const q = book[p.ticker]?.quote;
    if (q) { mark = q.price; markSource = "live"; }
    else if (typeof p.manual_mark === "number") { mark = p.manual_mark; markSource = "manual"; }
  }

  const value = mark * p.contracts * multiplier;
  const pnl = value - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  return {
    pos: p,
    multiplier,
    mark,
    markSource,
    value: Math.round(value * 100) / 100,
    costBasis: Math.round(costBasis * 100) / 100,
    pnl: Math.round(pnl * 100) / 100,
    pnlPct: Math.round(pnlPct * 10) / 10,
    dte,
    progressToTarget: progress(p.entry_price, mark, p.target_price),
    progressToStop: progress(p.entry_price, mark, p.stop_price),
    greeks,
    contractMatched,
    bid, ask, last, volume, openInterest,
  };
}

export function valueBook(
  positions: Position[],
  book: MarketBook,
  cfg: FundConfig,
  asof: string
): ValuedPosition[] {
  return positions.map((p) => valuePosition(p, book, cfg, asof));
}
