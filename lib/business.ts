// Operations Hub — registry of all the owner's businesses / operations, so
// SAHJONY runs as a multi-entity command plane. File-backed, owner-entered.

import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import { dataPath } from "./paths";

export type EntityType = "LLC" | "S-Corp" | "C-Corp" | "Sole Prop" | "Partnership" | "Nonprofit" | "Other";
export type OpStatus = "active" | "launching" | "paused" | "winding_down";

export interface Business {
  id: string;
  name: string;
  category: string;        // e.g. "Real estate wholesaling", "Consulting", "E-commerce"
  entityType: EntityType;
  role: string;            // owner / managing member / operator
  status: OpStatus;
  website: string;
  description: string;
  modules: string[];       // which SAHJONY modules this business uses
  createdAt: number;
}

const FILE = dataPath("businesses.json");

async function read(): Promise<Business[]> {
  try { const r = await fs.readFile(FILE, "utf8"); const p = JSON.parse(r); return Array.isArray(p) ? p : []; } catch { return []; }
}
async function write(items: Business[]) {
  await fs.mkdir(dataPath(), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

// Seed the one business we already run so the hub is never empty.
export async function listBusinesses(): Promise<Business[]> {
  const items = await read();
  if (items.length === 0) {
    const seed: Business = {
      id: crypto.randomUUID(),
      name: "SAHJONY CAPITAL LLC",
      category: "Real estate wholesaling",
      entityType: "LLC",
      role: "Owner / Managing Member",
      status: "active",
      website: "",
      description: "Nationwide real-estate wholesaling: source off-market/FSBO/on-market deals, analyze (ARV/MAO), and assign to a cash-buyer network.",
      modules: ["deals", "buyers", "finder", "crm", "jv", "docusign", "email"],
      createdAt: Date.now(),
    };
    await write([seed]);
    return [seed];
  }
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function upsertBusiness(input: Partial<Business>): Promise<Business> {
  const items = await read();
  if (input.id) {
    const i = items.findIndex((b) => b.id === input.id);
    if (i >= 0) { items[i] = { ...items[i], ...input } as Business; await write(items); return items[i]; }
  }
  const b: Business = {
    id: crypto.randomUUID(), name: "", category: "", entityType: "LLC",
    role: "Owner", status: "active", website: "", description: "", modules: [],
    createdAt: Date.now(), ...input,
  } as Business;
  items.push(b); await write(items); return b;
}

export async function removeBusiness(id: string): Promise<boolean> {
  const items = await read();
  const next = items.filter((b) => b.id !== id);
  await write(next); return next.length !== items.length;
}
