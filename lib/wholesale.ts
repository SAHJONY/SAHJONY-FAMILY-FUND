import { dataPath } from "./paths";
// SAHJONY wholesaling engine — deal pipeline, buyer network, deal math, and
// buying-box matching. File-backed (./data), like the memory store.
//
// Contacts here are the OWNER's own CRM data (entered or imported by the owner),
// not scraped or skip-traced. The matcher assigns deals to buyers the owner
// already has a relationship with, based on each buyer's stated buying box.

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type DealStatus = "lead" | "under_contract" | "assigned" | "closed" | "dead";
export type DealSource = "off_market" | "fsbo" | "on_market";
export type BuyerType =
  | "individual" | "hedge_fund" | "institutional" | "private_equity" | "ibuyer";
export type Strategy = "flip" | "buy_hold" | "brrrr" | "new_build" | "any";

export interface Deal {
  id: string;
  address: string;
  city: string;
  state: string;
  propertyType: string; // SFR, multi, condo, land...
  beds: number;
  baths: number;
  sqft: number;
  arv: number;            // after-repair value
  estRepairs: number;
  listPrice: number;      // seller ask / list
  contractPrice: number;  // what you got it under contract for (0 if not yet)
  desiredFee: number;     // target assignment fee
  source: DealSource;
  status: DealStatus;
  motivation: string;     // seller motivation notes
  notes: string;
  createdAt: number;
}

export interface BuyingBox {
  markets: string[];       // "Austin, TX" or "TX" — matched loosely
  propertyTypes: string[]; // SFR, multi...
  minPrice: number;
  maxPrice: number;
  minBeds: number;
  maxRepairs: number;      // 0 = no cap
  strategy: Strategy;
}

export interface Buyer {
  id: string;
  name: string;
  type: BuyerType;
  contact: string;         // owner-provided label/email/phone from their CRM
  proofOfFunds: boolean;
  active: boolean;
  box: BuyingBox;
  createdAt: number;
}

function file(name: string) {
  return dataPath(name);
}
async function read<T>(name: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file(name), "utf8");
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}
async function write<T>(name: string, items: T[]) {
  await fs.mkdir(path.dirname(file(name)), { recursive: true });
  await fs.writeFile(file(name), JSON.stringify(items, null, 2), "utf8");
}

const DEALS = "wholesale-deals.json";
const BUYERS = "wholesale-buyers.json";

export const listDeals = () => read<Deal>(DEALS);
export const listBuyers = () => read<Buyer>(BUYERS);

export async function upsertDeal(input: Partial<Deal>): Promise<Deal> {
  const items = await read<Deal>(DEALS);
  if (input.id) {
    const i = items.findIndex((d) => d.id === input.id);
    if (i >= 0) { items[i] = { ...items[i], ...input } as Deal; await write(DEALS, items); return items[i]; }
  }
  const deal: Deal = {
    id: crypto.randomUUID(),
    address: "", city: "", state: "", propertyType: "SFR",
    beds: 0, baths: 0, sqft: 0, arv: 0, estRepairs: 0, listPrice: 0,
    contractPrice: 0, desiredFee: 10000, source: "off_market",
    status: "lead", motivation: "", notes: "", createdAt: Date.now(),
    ...input,
  } as Deal;
  items.push(deal); await write(DEALS, items); return deal;
}

export async function upsertBuyer(input: Partial<Buyer>): Promise<Buyer> {
  const items = await read<Buyer>(BUYERS);
  if (input.id) {
    const i = items.findIndex((b) => b.id === input.id);
    if (i >= 0) { items[i] = { ...items[i], ...input } as Buyer; await write(BUYERS, items); return items[i]; }
  }
  const buyer: Buyer = {
    id: crypto.randomUUID(),
    name: "", type: "individual", contact: "", proofOfFunds: false, active: true,
    box: { markets: [], propertyTypes: [], minPrice: 0, maxPrice: 0, minBeds: 0, maxRepairs: 0, strategy: "any" },
    createdAt: Date.now(), ...input,
  } as Buyer;
  items.push(buyer); await write(BUYERS, items); return buyer;
}

export async function removeDeal(id: string) {
  const items = await read<Deal>(DEALS);
  const next = items.filter((d) => d.id !== id);
  await write(DEALS, next); return next.length !== items.length;
}
export async function removeBuyer(id: string) {
  const items = await read<Buyer>(BUYERS);
  const next = items.filter((b) => b.id !== id);
  await write(BUYERS, next); return next.length !== items.length;
}

// --- Deal math ---------------------------------------------------------------

export interface DealAnalysis {
  mao: number;            // max allowable offer (70% rule by default)
  maoRulePct: number;
  equitySpread: number;   // arv - contractPrice - estRepairs
  projectedFee: number;   // your assignment fee
  buyerAllIn: number;     // contractPrice + estRepairs (what buyer pays in)
  buyerMarginToArv: number; // arv - buyerAllIn - fee
  passes70: boolean;
  grade: "A" | "B" | "C" | "D";
}

export function analyzeDeal(d: Deal, rulePct = 70): DealAnalysis {
  const mao = Math.max(0, Math.round(d.arv * (rulePct / 100) - d.estRepairs - d.desiredFee));
  const equitySpread = Math.round(d.arv - d.contractPrice - d.estRepairs);
  const projectedFee = d.desiredFee;
  const buyerAllIn = Math.round(d.contractPrice + d.estRepairs);
  const buyerMarginToArv = Math.round(d.arv - buyerAllIn - projectedFee);
  const passes70 = d.contractPrice > 0 ? d.contractPrice <= mao : false;
  const marginPct = d.arv > 0 ? buyerMarginToArv / d.arv : 0;
  const grade: DealAnalysis["grade"] =
    marginPct >= 0.25 ? "A" : marginPct >= 0.15 ? "B" : marginPct >= 0.08 ? "C" : "D";
  return { mao, maoRulePct: rulePct, equitySpread, projectedFee, buyerAllIn, buyerMarginToArv, passes70, grade };
}

// --- Buying-box matching -----------------------------------------------------

export interface BuyerMatch {
  buyer: Buyer;
  score: number;       // 0..100
  reasons: string[];
}

function marketMatch(markets: string[], city: string, state: string): boolean {
  const hay = `${city} ${state}`.toLowerCase();
  if (!markets.length) return true; // no markets set = nationwide
  return markets.some((m) => {
    const t = m.trim().toLowerCase();
    return t && (hay.includes(t) || t.includes(state.toLowerCase()) || t.includes(city.toLowerCase()));
  });
}

export function matchBuyers(deal: Deal, buyers: Buyer[]): BuyerMatch[] {
  const price = deal.contractPrice || deal.listPrice || deal.arv;
  const out: BuyerMatch[] = [];
  for (const b of buyers) {
    if (!b.active) continue;
    const reasons: string[] = [];
    let score = 0;

    if (marketMatch(b.box.markets, deal.city, deal.state)) { score += 40; reasons.push("market fit"); }
    else continue; // wrong market = not a match

    const within = (!b.box.minPrice || price >= b.box.minPrice) && (!b.box.maxPrice || price <= b.box.maxPrice);
    if (within) { score += 30; reasons.push("in price box"); }

    if (!b.box.propertyTypes.length || b.box.propertyTypes.map((t) => t.toLowerCase()).includes(deal.propertyType.toLowerCase())) {
      score += 15; reasons.push("property type");
    }
    if (!b.box.minBeds || deal.beds >= b.box.minBeds) { score += 8; reasons.push("beds ok"); }
    if (!b.box.maxRepairs || deal.estRepairs <= b.box.maxRepairs) { score += 7; reasons.push("repairs in range"); }
    if (b.proofOfFunds) { score += 0; reasons.push("POF ✓"); }

    out.push({ buyer: b, score: Math.min(100, score), reasons });
  }
  return out.sort((a, b) => b.score - a.score);
}
