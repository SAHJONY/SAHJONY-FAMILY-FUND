// SAHJONY FAMILY FUND — file-backed persistence.
//
// Same approach as the rest of the control plane: JSON under ./data locally,
// /tmp on Vercel (ephemeral per instance — so on prod, IV-rank history rebuilds
// rather than persisting; the UI labels that honestly as "building history").

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataPath } from "../paths";
import type { Position, FundReport, NewsAnalysis } from "./types";

const POSITIONS = "fund-positions.json";
const STATE = "fund-state.json";
const SNAP_DIR = "fund-snapshots";
const NEWS_DIR = "fund-news";

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(dataPath(file), "utf8")) as T;
  } catch {
    return fallback;
  }
}
async function writeJson(file: string, data: unknown) {
  const p = dataPath(file);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf8");
}

// ---- positions -------------------------------------------------------------
export const listPositions = () => readJson<Position[]>(POSITIONS, []);

// Auto-generate an option id from ticker+strike+expiry when omitted.
function autoId(p: Partial<Position>): string {
  if (p.asset_type === "option" && p.ticker && p.strike && p.expiry) {
    return `${p.ticker}-${p.option_type ?? "call"}-${p.strike}-${p.expiry}`.toUpperCase();
  }
  return crypto.randomUUID();
}

export async function upsertPosition(input: Partial<Position>): Promise<Position> {
  const items = await listPositions();
  if (input.id) {
    const i = items.findIndex((x) => x.id === input.id);
    if (i >= 0) { items[i] = { ...items[i], ...input } as Position; await writeJson(POSITIONS, items); return items[i]; }
  }
  const pos: Position = {
    id: autoId(input),
    asset_type: "shares",
    ticker: "",
    entry_price: 0,
    contracts: 0,
    ...input,
  } as Position;
  items.push(pos);
  await writeJson(POSITIONS, items);
  return pos;
}

export async function removePosition(id: string): Promise<boolean> {
  const items = await listPositions();
  const next = items.filter((x) => x.id !== id);
  await writeJson(POSITIONS, next);
  return next.length !== items.length;
}

export async function replacePositions(items: Position[]): Promise<void> {
  await writeJson(POSITIONS, items);
}

// ---- report state ----------------------------------------------------------
export const readState = () => readJson<FundReport | null>(STATE, null);
export const writeState = (r: FundReport) => writeJson(STATE, r);

// ---- chain snapshots (for diff + IV history) -------------------------------
export interface ChainSnapshot {
  ticker: string;
  asof: string;
  spot: number | null;
  expiries: string[];
  // expiry -> rows
  chains: Record<string, { strike: number; type: "call" | "put"; iv: number; bid: number | null; ask: number | null; last: number | null; volume: number | null; oi: number | null }[]>;
}

export async function saveSnapshot(s: ChainSnapshot) {
  await writeJson(path.join(SNAP_DIR, `${s.ticker}_${s.asof}.json`), s);
}

export async function loadSnapshot(ticker: string, asof: string): Promise<ChainSnapshot | null> {
  return readJson<ChainSnapshot | null>(path.join(SNAP_DIR, `${ticker}_${asof}.json`), null);
}

// Most recent snapshot strictly before `asof`, for new-strike/expiry diffing.
export async function loadPriorSnapshot(ticker: string, asof: string): Promise<ChainSnapshot | null> {
  const dir = dataPath(SNAP_DIR);
  let files: string[] = [];
  try { files = await fs.readdir(dir); } catch { return null; }
  const dates = files
    .filter((f) => f.startsWith(`${ticker}_`) && f.endsWith(".json"))
    .map((f) => f.slice(ticker.length + 1, -5))
    .filter((d) => d < asof)
    .sort();
  const prev = dates.pop();
  if (!prev) return null;
  return loadSnapshot(ticker, prev);
}

// All stored IVs for a ticker over a lookback, for IV rank/percentile.
// Returns the daily ATM-ish mean IV per snapshot date.
export async function ivHistory(ticker: string, lookbackDays: number): Promise<number[]> {
  const dir = dataPath(SNAP_DIR);
  let files: string[] = [];
  try { files = await fs.readdir(dir); } catch { return []; }
  const dates = files
    .filter((f) => f.startsWith(`${ticker}_`) && f.endsWith(".json"))
    .map((f) => f.slice(ticker.length + 1, -5))
    .sort()
    .slice(-lookbackDays);
  const out: number[] = [];
  for (const d of dates) {
    const s = await loadSnapshot(ticker, d);
    if (!s) continue;
    const ivs: number[] = [];
    for (const rows of Object.values(s.chains)) for (const r of rows) if (r.iv > 0) ivs.push(r.iv);
    if (ivs.length) out.push(ivs.reduce((a, b) => a + b, 0) / ivs.length);
  }
  return out;
}

// ---- news cache (per ticker per day, so re-runs don't re-bill) -------------
export async function readNewsCache(ticker: string, asof: string): Promise<NewsAnalysis | null> {
  return readJson<NewsAnalysis | null>(path.join(NEWS_DIR, `${ticker}_${asof}.json`), null);
}
export async function writeNewsCache(n: NewsAnalysis) {
  await writeJson(path.join(NEWS_DIR, `${n.ticker}_${n.asof}.json`), n);
}
