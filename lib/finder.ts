import { dataPath } from "./paths";
// SAHJONY autonomous deal finder — the 24/7 engine.
//
// It runs on a schedule (locally via interval; in production via Vercel Cron
// hitting /api/finder/run). On each run it queries the REAL sources the owner
// has connected — primarily their licensed MLS RESO Web API feed — for new
// active listings matching the saved criteria, auto-creates them as leads,
// analyzes each (MAO/grade), and matches them to the cash-buyer network.
//
// HONESTY: it can only find REAL listings from a connected, licensed feed. With
// no feed connected it does nothing and says so — it never fabricates deals.

import { promises as fs } from "node:fs";
import path from "node:path";
import { listDeals, upsertDeal, listBuyers, matchBuyers, analyzeDeal } from "./wholesale";
import { getSecret } from "./secrets";

export interface FinderConfig {
  enabled: boolean;
  markets: { city: string; state: string }[];
  minPrice: number;
  maxPrice: number;
  minBeds: number;
  maxResultsPerRun: number;
  lastRunAt: number;
  runs: number;
  found: number;
}

export interface FinderRun {
  t: number;
  source: string;
  scanned: number;
  added: number;
  topMatch: string | null;
  note: string;
}

const CFG = dataPath("finder-config.json");
const LOG = dataPath("finder-log.json");

const DEFAULT: FinderConfig = {
  enabled: false, markets: [], minPrice: 0, maxPrice: 0, minBeds: 0,
  maxResultsPerRun: 10, lastRunAt: 0, runs: 0, found: 0,
};

export async function getConfig(): Promise<FinderConfig> {
  try { return { ...DEFAULT, ...JSON.parse(await fs.readFile(CFG, "utf8")) }; } catch { return { ...DEFAULT }; }
}
export async function setConfig(patch: Partial<FinderConfig>): Promise<FinderConfig> {
  const cfg = { ...(await getConfig()), ...patch };
  await fs.mkdir(path.dirname(CFG), { recursive: true });
  await fs.writeFile(CFG, JSON.stringify(cfg, null, 2), "utf8");
  return cfg;
}
export async function getLog(): Promise<FinderRun[]> {
  try { const p = JSON.parse(await fs.readFile(LOG, "utf8")); return Array.isArray(p) ? p : []; } catch { return []; }
}
async function pushLog(run: FinderRun) {
  const log = [run, ...(await getLog())].slice(0, 30);
  await fs.mkdir(path.dirname(LOG), { recursive: true });
  await fs.writeFile(LOG, JSON.stringify(log, null, 2), "utf8");
}

// Query the owner's licensed MLS RESO feed for active listings in a market.
async function queryReso(city: string, state: string, cfg: FinderConfig): Promise<any[]> {
  const base = getSecret("MLS_RESO_URL"), token = getSecret("MLS_RESO_TOKEN");
  if (!base || !token) return [];
  const f: string[] = ["StandardStatus eq 'Active'"];
  if (city) f.push(`City eq '${city.replace(/'/g, "''")}'`);
  if (state) f.push(`StateOrProvince eq '${state}'`);
  if (cfg.minPrice) f.push(`ListPrice ge ${cfg.minPrice}`);
  if (cfg.maxPrice) f.push(`ListPrice le ${cfg.maxPrice}`);
  if (cfg.minBeds) f.push(`BedroomsTotal ge ${cfg.minBeds}`);
  const url = `${base.replace(/\/$/, "")}/Property?$filter=${encodeURIComponent(f.join(" and "))}&$top=${cfg.maxResultsPerRun}&$orderby=ListPrice asc`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 12000);
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: c.signal });
    if (!res.ok) return [];
    return (await res.json()).value ?? [];
  } catch { return []; } finally { clearTimeout(t); }
}

// One autonomous pass. Returns the run record.
export async function runFinder(): Promise<FinderRun> {
  const cfg = await getConfig();
  await setConfig({ lastRunAt: Date.now(), runs: cfg.runs + 1 });

  const hasFeed = !!(getSecret("MLS_RESO_URL") && getSecret("MLS_RESO_TOKEN"));
  if (!hasFeed) {
    const run: FinderRun = { t: Date.now(), source: "none", scanned: 0, added: 0, topMatch: null,
      note: "No licensed MLS feed connected — SAHJONY won't fabricate deals. Add MLS_RESO_URL + MLS_RESO_TOKEN to source real listings 24/7." };
    await pushLog(run); return run;
  }

  const existing = new Set((await listDeals()).map((d) => `${d.address}|${d.city}`.toLowerCase()));
  const buyers = await listBuyers();
  let scanned = 0, added = 0; let topMatch: string | null = null; let topScore = -1;

  for (const m of (cfg.markets.length ? cfg.markets : [{ city: "", state: "" }])) {
    const listings = await queryReso(m.city, m.state, cfg);
    scanned += listings.length;
    for (const p of listings) {
      const address = [p.StreetNumber, p.StreetName, p.StreetSuffix].filter(Boolean).join(" ");
      const key = `${address}|${p.City}`.toLowerCase();
      if (!address || existing.has(key)) continue;
      existing.add(key);
      const deal = await upsertDeal({
        address, city: p.City || m.city, state: p.StateOrProvince || m.state,
        propertyType: "SFR", beds: Number(p.BedroomsTotal) || 0, baths: Number(p.BathroomsTotalInteger) || 0,
        sqft: Number(p.LivingArea) || 0, listPrice: Number(p.ListPrice) || 0,
        source: "on_market", status: "lead", motivation: `MLS ${p.ListingId || ""} · ${p.DaysOnMarket ?? "?"} DOM (auto-found)`,
      });
      added++;
      const matches = matchBuyers(deal, buyers);
      if (matches[0] && matches[0].score > topScore) { topScore = matches[0].score; topMatch = `${address} → ${matches[0].buyer.name} (${matches[0].score}%)`; }
    }
  }

  const run: FinderRun = { t: Date.now(), source: "mls-reso", scanned, added, topMatch,
    note: added ? `Added ${added} new lead(s) from ${scanned} active listings.` : `Scanned ${scanned}; no new matches this pass.` };
  await pushLog(run);
  await setConfig({ found: cfg.found + added });
  return run;
}
