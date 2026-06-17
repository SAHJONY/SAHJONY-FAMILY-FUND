// SAHJONY FAMILY FUND — Layer 4: diffs and condition alerts.
//
// Every alert surfaces a CONDITION — "hit your target level", "moved 22% in
// IV", "new LEAP expiry listed". Never a buy or sell instruction. New-strike /
// new-expiry detection diffs today's chain snapshot against the prior run.

import type {
  ValuedPosition, PortfolioAnalytics, NewsAnalysis, Alert,
} from "./types";
import type { ChainSnapshot } from "./store";
import { FundConfig } from "./config";

export interface DiffResult {
  newStrikes: { ticker: string; expiry: string; strikes: number[] }[];
  newExpiries: { ticker: string; expiries: string[] }[];
}

// Diff one underlying's snapshot today vs the prior run. New strikes are only
// reported when they fall within a band around the owner's held strikes, so the
// signal is "fresh strikes near me" rather than the whole chain.
export function diffChain(
  ticker: string,
  today: ChainSnapshot,
  prior: ChainSnapshot | null,
  heldStrikes: number[],
  cfg: FundConfig
): DiffResult {
  if (!prior) return { newStrikes: [], newExpiries: [] };

  const newExpiries = today.expiries.filter((e) => !prior.expiries.includes(e));

  const band = cfg.newStrikeBandPct / 100;
  const inBand = (k: number) => heldStrikes.some((h) => Math.abs(k - h) <= h * band);

  const newStrikes: { ticker: string; expiry: string; strikes: number[] }[] = [];
  for (const [expiry, rows] of Object.entries(today.chains)) {
    const priorStrikes = new Set((prior.chains[expiry] ?? []).map((r) => r.strike));
    const fresh = [...new Set(rows.map((r) => r.strike))]
      .filter((k) => !priorStrikes.has(k) && inBand(k))
      .sort((a, b) => a - b);
    if (fresh.length) newStrikes.push({ ticker, expiry, strikes: fresh });
  }

  return {
    newStrikes,
    newExpiries: newExpiries.length ? [{ ticker, expiries: newExpiries }] : [],
  };
}

// IV move per held option vs the prior snapshot, for iv_change alerts.
function priorIv(prior: ChainSnapshot | null, type: "call" | "put", strike: number, expiry: string): number | null {
  const rows = prior?.chains[expiry];
  const row = rows?.find((r) => r.type === type && Math.abs(r.strike - strike) < 1e-6);
  return row && row.iv > 0 ? row.iv : null;
}

export function buildAlerts(
  positions: ValuedPosition[],
  analytics: PortfolioAnalytics,
  news: NewsAnalysis[],
  diffs: DiffResult,
  priorByTicker: Record<string, ChainSnapshot | null>,
  cfg: FundConfig
): Alert[] {
  const alerts: Alert[] = [];

  for (const vp of positions) {
    const t = vp.pos.ticker;
    const tp = vp.pos.target_price, sp = vp.pos.stop_price;

    // target / stop hits — phrased as facts.
    if (tp != null && vp.mark > 0) {
      const hit = vp.pos.entry_price <= tp ? vp.mark >= tp : vp.mark <= tp;
      if (hit) alerts.push({ kind: "target_hit", severity: "high", ticker: t, message: `${t} hit your target level (${tp})`, driver: `mark ${vp.mark}` });
      else if (vp.progressToTarget != null && vp.progressToTarget >= cfg.targetNearPct)
        alerts.push({ kind: "target_near", severity: "info", ticker: t, message: `${t} is within ${100 - vp.progressToTarget}% of your target`, driver: `${vp.progressToTarget}% of the way` });
    }
    if (sp != null && vp.mark > 0) {
      const hit = vp.pos.entry_price >= sp ? vp.mark <= sp : vp.mark >= sp;
      if (hit) alerts.push({ kind: "stop_hit", severity: "high", ticker: t, message: `${t} crossed your stop level (${sp})`, driver: `mark ${vp.mark}` });
    }

    // IV move vs prior snapshot.
    if (vp.pos.asset_type === "option" && vp.greeks && vp.pos.expiry && vp.pos.strike) {
      const prev = priorIv(priorByTicker[t] ?? null, vp.pos.option_type ?? "call", vp.pos.strike, vp.pos.expiry);
      if (prev != null) {
        const movePct = Math.abs(vp.greeks.iv - prev) / prev * 100;
        if (movePct >= cfg.ivChangeAlertPct)
          alerts.push({ kind: "iv_change", severity: "warn", ticker: t, message: `${t} IV moved ${movePct.toFixed(0)}% vs prior run`, driver: `${(prev * 100).toFixed(0)}% → ${(vp.greeks.iv * 100).toFixed(0)}%` });
      }
    }
  }

  // DTE flags.
  for (const f of analytics.dteFlags)
    alerts.push({ kind: "dte", severity: "warn", ticker: f.ticker, message: `${f.ticker} option has ${f.dte} days to expiry`, driver: "time decay / roll window" });

  // Concentration.
  for (const msg of analytics.concentrationFlags)
    alerts.push({ kind: "concentration", severity: "warn", ticker: "BOOK", message: msg });

  // New strikes / expiries (info; the UI gives new-strike a yellow accent).
  for (const ns of diffs.newStrikes)
    alerts.push({ kind: "new_strikes", severity: "info", ticker: ns.ticker, message: `${ns.ticker} ${ns.expiry}: ${ns.strikes.length} new strike(s) near your held strikes`, driver: ns.strikes.join(", ") });
  for (const ne of diffs.newExpiries)
    alerts.push({ kind: "new_expiry", severity: "info", ticker: ne.ticker, message: `${ne.ticker}: new expiry listed`, driver: ne.expiries.join(", ") });

  // Claude position-specific news flags become alerts.
  for (const n of news)
    if (n.positionFlag)
      alerts.push({ kind: "news", severity: "warn", ticker: n.ticker, message: `${n.ticker}: ${n.positionFlag}`, driver: `news · ${n.sentiment}` });

  const rank: Record<Alert["severity"], number> = { high: 0, warn: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
