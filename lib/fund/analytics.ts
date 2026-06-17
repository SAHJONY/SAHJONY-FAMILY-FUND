// SAHJONY FAMILY FUND — Layer 2: portfolio analytics.
//
// You see the book as a whole, not position by position: allocation and
// concentration, aggregate Greeks (net delta in share-equivalent terms, daily
// theta bleed in dollars, net vega per 1 IV point), the IV environment per
// option, and days-to-expiry flags. All informational — it surfaces facts, it
// does not advise rolling or trading.

import type {
  ValuedPosition, PortfolioAnalytics, AllocationSlice, IvEnvironment,
} from "./types";
import { FundConfig, SECTOR_MAP } from "./config";

function sectorOf(vp: ValuedPosition): string {
  if (vp.pos.sector) return vp.pos.sector;
  if (vp.pos.asset_type === "cash") return "Cash";
  if (vp.pos.asset_type === "real_estate") return "Real Estate";
  if (vp.pos.asset_type === "alt") return "Alternatives";
  return SECTOR_MAP[vp.pos.ticker.replace(/[.\-]/g, "_")] ?? "Other";
}

function assetClassOf(vp: ValuedPosition): string {
  switch (vp.pos.asset_type) {
    case "option": return "Options";
    case "shares": return "Equities";
    case "bond": return "Fixed Income";
    case "cash": return "Cash";
    case "real_estate": return "Real Estate";
    case "alt": return "Alternatives";
  }
}

function allocate(
  rows: ValuedPosition[],
  keyOf: (vp: ValuedPosition) => string,
  nav: number,
  capPct: number
): AllocationSlice[] {
  const sums = new Map<string, number>();
  for (const vp of rows) sums.set(keyOf(vp), (sums.get(keyOf(vp)) ?? 0) + vp.value);
  return [...sums.entries()]
    .map(([key, value]) => {
      const pct = nav > 0 ? (value / nav) * 100 : 0;
      return { key, value: Math.round(value), pct: Math.round(pct * 10) / 10, overCap: pct > capPct };
    })
    .sort((a, b) => b.value - a.value);
}

// IV rank: where current IV sits in its own stored history (0..100).
function ivRank(history: number[], current: number): number | null {
  if (history.length < 2) return null;
  const lo = Math.min(...history);
  const hi = Math.max(...history);
  if (hi === lo) return 50;
  return Math.round(((current - lo) / (hi - lo)) * 100);
}

export function analyze(
  positions: ValuedPosition[],
  cfg: FundConfig,
  ivHistByTicker: Record<string, number[]>
): PortfolioAnalytics {
  const nav = positions.reduce((s, vp) => s + vp.value, 0);

  const byTicker = allocate(
    positions.filter((vp) => vp.pos.asset_type !== "cash"),
    (vp) => vp.pos.ticker || vp.pos.label || "—", nav, cfg.tickerCapPct
  );
  const bySector = allocate(positions, sectorOf, nav, cfg.sectorCapPct);
  const byAssetClass = allocate(positions, assetClassOf, nav, cfg.assetClassCapPct);

  // Aggregate Greeks across held options.
  let netDelta = 0, dailyTheta = 0, netVega = 0;
  for (const vp of positions) {
    if (vp.pos.asset_type === "shares" || vp.pos.asset_type === "bond") {
      netDelta += vp.pos.contracts; // shares are pure delta-1
    }
    if (vp.greeks) {
      const qty = vp.pos.contracts * vp.multiplier; // shares-equivalent
      netDelta += vp.greeks.delta * qty;
      dailyTheta += vp.greeks.theta * qty;          // $ per day
      netVega += (vp.greeks.vega / 100) * qty;      // per 1 IV point
    }
  }

  // IV environment per held option.
  const ivEnvironment: IvEnvironment[] = positions
    .filter((vp) => vp.pos.asset_type === "option" && vp.greeks)
    .map((vp) => {
      const hist = ivHistByTicker[vp.pos.ticker] ?? [];
      const historyDays = hist.length;
      const iv = vp.greeks!.iv * 100;
      if (historyDays < cfg.ivMinHistoryDays) {
        return { id: vp.pos.id, ticker: vp.pos.ticker, iv, ivRank: null, status: "building history" as const, historyDays };
      }
      const rank = ivRank(hist.map((x) => x * 100), iv);
      const status =
        rank != null && rank > cfg.ivRichThreshold ? "rich" as const
        : rank != null && rank < cfg.ivCheapThreshold ? "cheap" as const
        : "normal" as const;
      return { id: vp.pos.id, ticker: vp.pos.ticker, iv, ivRank: rank, status, historyDays };
    });

  const dteFlags = positions
    .filter((vp) => vp.dte != null && vp.dte <= cfg.dteFlagDays)
    .map((vp) => ({ id: vp.pos.id, ticker: vp.pos.ticker, dte: vp.dte! }))
    .sort((a, b) => a.dte - b.dte);

  const concentrationFlags: string[] = [];
  for (const s of byTicker) if (s.overCap) concentrationFlags.push(`${s.key} is ${s.pct}% of NAV (cap ${cfg.tickerCapPct}%)`);
  for (const s of bySector) if (s.overCap) concentrationFlags.push(`${s.key} sector is ${s.pct}% of NAV (cap ${cfg.sectorCapPct}%)`);
  for (const s of byAssetClass) if (s.overCap) concentrationFlags.push(`${s.key} is ${s.pct}% of NAV (cap ${cfg.assetClassCapPct}%)`);

  return {
    nav: Math.round(nav),
    byTicker, bySector, byAssetClass,
    netDelta: Math.round(netDelta),
    dailyTheta: Math.round(dailyTheta),
    netVega: Math.round(netVega),
    ivEnvironment,
    dteFlags,
    concentrationFlags,
  };
}
