import { dataPath } from "./paths";
// Native CRM + Joint Venture store for SAHJONY CAPITAL. File-backed (./data).
// Contacts are the owner's own relationships (sellers who reached out, buyers,
// agents, title, contractors, JV partners) — owner-entered, not harvested.

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type ContactType = "seller" | "buyer" | "agent" | "title" | "contractor" | "lender" | "jv_partner" | "other";
export type ContactStage = "new" | "contacted" | "negotiating" | "under_contract" | "closed" | "dead";

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  stage: ContactStage;
  phone: string;
  email: string;
  company: string;
  notes: string;
  dealAddress: string; // optional linked deal
  createdAt: number;
  updatedAt: number;
}

export type JVStatus = "proposed" | "active" | "assigned" | "closed" | "dead";
export interface JointVenture {
  id: string;
  dealAddress: string;
  partnerName: string;     // other wholesaler/investor
  myRole: string;          // e.g. "dispo" / "acquisition"
  splitPct: number;        // your % of the assignment fee
  totalFee: number;        // expected assignment fee
  status: JVStatus;
  agreementNote: string;
  createdAt: number;
}

function file(name: string) { return dataPath(name); }
async function read<T>(name: string): Promise<T[]> {
  try { const r = await fs.readFile(file(name), "utf8"); const p = JSON.parse(r); return Array.isArray(p) ? p : []; } catch { return []; }
}
async function write<T>(name: string, items: T[]) {
  await fs.mkdir(path.dirname(file(name)), { recursive: true });
  await fs.writeFile(file(name), JSON.stringify(items, null, 2), "utf8");
}

const CONTACTS = "crm-contacts.json";
const JV = "jv-deals.json";

export const listContacts = () => read<Contact>(CONTACTS);
export const listJV = () => read<JointVenture>(JV);

export async function upsertContact(input: Partial<Contact>): Promise<Contact> {
  const items = await read<Contact>(CONTACTS);
  if (input.id) {
    const i = items.findIndex((c) => c.id === input.id);
    if (i >= 0) { items[i] = { ...items[i], ...input, updatedAt: Date.now() } as Contact; await write(CONTACTS, items); return items[i]; }
  }
  const c: Contact = {
    id: crypto.randomUUID(), name: "", type: "seller", stage: "new",
    phone: "", email: "", company: "", notes: "", dealAddress: "",
    createdAt: Date.now(), updatedAt: Date.now(), ...input,
  } as Contact;
  items.push(c); await write(CONTACTS, items); return c;
}
export async function removeContact(id: string) {
  const items = await read<Contact>(CONTACTS); const n = items.filter((c) => c.id !== id); await write(CONTACTS, n); return n.length !== items.length;
}

export async function upsertJV(input: Partial<JointVenture>): Promise<JointVenture> {
  const items = await read<JointVenture>(JV);
  if (input.id) {
    const i = items.findIndex((j) => j.id === input.id);
    if (i >= 0) { items[i] = { ...items[i], ...input } as JointVenture; await write(JV, items); return items[i]; }
  }
  const j: JointVenture = {
    id: crypto.randomUUID(), dealAddress: "", partnerName: "", myRole: "dispo",
    splitPct: 50, totalFee: 0, status: "proposed", agreementNote: "", createdAt: Date.now(), ...input,
  } as JointVenture;
  items.push(j); await write(JV, items); return j;
}
export async function removeJV(id: string) {
  const items = await read<JointVenture>(JV); const n = items.filter((j) => j.id !== id); await write(JV, n); return n.length !== items.length;
}
