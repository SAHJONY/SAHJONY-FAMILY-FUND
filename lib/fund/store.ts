// SAHJONY CAPITAL LLC — per-user fund storage (KV-backed).
//
// Every record is namespaced by userId, so each account's book, snapshots, news
// cache and report are fully isolated. Durable in Upstash when configured;
// file-backed locally (see kv.ts).

import crypto from "node:crypto";
import { kv } from "./kv";
import type { Position, FundReport, NewsAnalysis } from "./types";

const posKey = (u: string) => `u:${u}:positions`;
const stateKey = (u: string) => `u:${u}:state`;
const snapKey = (u: string, t: string, d: string) => `u:${u}:snap:${t}:${d}`;
const newsKey = (u: string, t: string, d: string) => `u:${u}:news:${t}:${d}`;

// ---- positions -------------------------------------------------------------
export async function listPositions(userId: string): Promise<Position[]> {
  return (await kv().get<Position[]>(posKey(userId))) ?? [];
}

function autoId(p: Partial<Position>): string {
  if (p.asset_type === "option" && p.ticker && p.strike && p.expiry) {
    return `${p.ticker}-${p.option_type ?? "call"}-${p.strike}-${p.expiry}`.toUpperCase();
  }
  return crypto.randomUUID();
}

export async function upsertPosition(userId: string, input: Partial<Position>): Promise<Position> {
  const items = await listPositions(userId);
  if (input.id) {
    const i = items.findIndex((x) => x.id === input.id);
    if (i >= 0) { items[i] = { ...items[i], ...input } as Position; await kv().set(posKey(userId), items); return items[i]; }
  }
  const pos: Position = {
    id: autoId(input), asset_type: "shares", ticker: "", entry_price: 0, contracts: 0, ...input,
  } as Position;
  items.push(pos);
  await kv().set(posKey(userId), items);
  return pos;
}

export async function removePosition(userId: string, id: string): Promise<boolean> {
  const items = await listPositions(userId);
  const next = items.filter((x) => x.id !== id);
  await kv().set(posKey(userId), next);
  return next.length !== items.length;
}

export async function replacePositions(userId: string, items: Position[]): Promise<void> {
  await kv().set(posKey(userId), items);
}

// ---- report state ----------------------------------------------------------
export const readState = (userId: string) => kv().get<FundReport>(stateKey(userId));
export const writeState = (userId: string, r: FundReport) => kv().set(stateKey(userId), r);

// ---- chain snapshots -------------------------------------------------------
export interface ChainSnapshot {
  ticker: string;
  asof: string;
  spot: number | null;
  expiries: string[];
  chains: Record<string, { strike: number; type: "call" | "put"; iv: number; bid: number | null; ask: number | null; last: number | null; volume: number | null; oi: number | null }[]>;
}

export async function saveSnapshot(userId: string, s: ChainSnapshot) {
  await kv().set(snapKey(userId, s.ticker, s.asof), s);
}
export async function loadSnapshot(userId: string, ticker: string, asof: string): Promise<ChainSnapshot | null> {
  return kv().get<ChainSnapshot>(snapKey(userId, ticker, asof));
}

async function snapDates(userId: string, ticker: string): Promise<string[]> {
  const prefix = `u:${userId}:snap:${ticker}:`;
  const keys = await kv().keys(prefix);
  return keys.map((k) => k.slice(prefix.length)).sort();
}

export async function loadPriorSnapshot(userId: string, ticker: string, asof: string): Promise<ChainSnapshot | null> {
  const prev = (await snapDates(userId, ticker)).filter((d) => d < asof).pop();
  return prev ? loadSnapshot(userId, ticker, prev) : null;
}

export async function ivHistory(userId: string, ticker: string, lookbackDays: number): Promise<number[]> {
  const dates = (await snapDates(userId, ticker)).slice(-lookbackDays);
  const out: number[] = [];
  for (const d of dates) {
    const s = await loadSnapshot(userId, ticker, d);
    if (!s) continue;
    const ivs: number[] = [];
    for (const rows of Object.values(s.chains)) for (const r of rows) if (r.iv > 0) ivs.push(r.iv);
    if (ivs.length) out.push(ivs.reduce((a, b) => a + b, 0) / ivs.length);
  }
  return out;
}

// ---- news cache (per user per name per day) --------------------------------
export async function readNewsCache(userId: string, ticker: string, asof: string): Promise<NewsAnalysis | null> {
  return kv().get<NewsAnalysis>(newsKey(userId, ticker, asof));
}
export async function writeNewsCache(userId: string, n: NewsAnalysis) {
  await kv().set(newsKey(userId, n.ticker, n.asof), n);
}

// Seed a small example book for a brand-new account, so the dashboard isn't
// empty on first run. The user can edit or clear it.
export async function seedExampleBook(userId: string): Promise<void> {
  if ((await listPositions(userId)).length) return;
  const examples: Position[] = [
    { id: "MSFT-shares", asset_type: "shares", ticker: "MSFT", entry_price: 410, contracts: 100, target_price: 520, stop_price: 360 } as Position,
    { id: "SPY-shares", asset_type: "shares", ticker: "SPY", entry_price: 540, contracts: 200 } as Position,
    { id: "cash", asset_type: "cash", ticker: "—", label: "Cash", entry_price: 1, contracts: 250000 } as Position,
  ];
  await replacePositions(userId, examples);
}
