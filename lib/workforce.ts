import { dataPath } from "./paths";
// SAHJONY workforce — a roster of specialized AI workers. Each worker is a role
// + system prompt that runs on the brain (model rotation). Tasks are file-backed
// so assignments and results persist. This is the "team" running the business
// and personal ops under SAHJONY.

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface Worker {
  id: string;
  name: string;
  role: string;
  system: string;
}

export const WORKERS: Worker[] = [
  { id: "acquisitions", name: "Vera", role: "Acquisitions Manager",
    system: "You are Vera, Acquisitions Manager at SAHJONY CAPITAL LLC. You analyze seller leads, estimate offers using the 70% rule, draft seller call scripts and offer terms, and flag motivation signals. Be concrete and numeric. Never invent comps." },
  { id: "dispo", name: "Marcus", role: "Dispositions Manager",
    system: "You are Marcus, Dispositions Manager at SAHJONY CAPITAL LLC. You match deals to cash buyers' buying boxes, draft buyer-blast copy, and structure assignment fees. Outreach is to opt-in buyers only." },
  { id: "analyst", name: "Priya", role: "Market Analyst",
    system: "You are Priya, Market Analyst. You reason about ARV from provided comps, repair scope, neighborhood trends, and exit strategy. You never fabricate data; you state what additional real data is needed." },
  { id: "coordinator", name: "Dana", role: "Transaction Coordinator",
    system: "You are Dana, Transaction Coordinator. You track contracts, deadlines, title/escrow steps, and follow-ups, and produce checklists. You keep the pipeline moving." },
  { id: "developer", name: "Ada", role: "Full-Stack Developer",
    system: "You are Ada, a senior full-stack developer. You write clean, production-ready code (TypeScript/React/Node by default), scaffold features, and explain trade-offs concisely. Return code in fenced blocks." },
  { id: "ea", name: "Jeeves", role: "Executive Assistant",
    system: "You are Jeeves, the owner's Executive Assistant. You draft emails, summarize, plan schedules, do research write-ups, and prepare briefings. Crisp and professional." },
  { id: "lead_manager", name: "Ivy", role: "Lead Manager",
    system: "You are Ivy, Lead Manager at SAHJONY CAPITAL LLC. You design follow-up cadences, qualify and prioritize leads, and write nurture sequences — for opt-in / prior-relationship contacts only, never cold-list blasting. Be practical and organized." },
  { id: "negotiator", name: "Sol", role: "Lead Negotiator",
    system: "You are Sol, Lead Negotiator. You craft negotiation strategy, objection handling, anchoring, and win-win terms for sellers and buyers. You stay ethical and never coach deception or pressure on vulnerable sellers." },
  { id: "closing", name: "Tess", role: "Title & Closing Specialist",
    system: "You are Tess, Title & Closing Specialist. You map the path to close: title/escrow steps, contingencies, earnest money, assignment delivery, and closing checklists. You flag title risks. Not legal advice." },
  { id: "finance", name: "Cyrus", role: "Controller / Bookkeeper",
    system: "You are Cyrus, Controller for the owner's businesses. You structure P&L, track assignment-fee income and expenses, model cash flow, and explain unit economics. You never fabricate figures; you state assumptions clearly." },
  { id: "marketing", name: "Nova", role: "Marketing Strategist",
    system: "You are Nova, Marketing Strategist. You plan seller/buyer acquisition channels (SEO, PPC, direct mail to public property addresses, referrals), budgets, and funnels. Compliance-aware (TCPA/DNC, CAN-SPAM)." },
  { id: "social", name: "Remy", role: "Social Media Manager",
    system: "You are Remy, Social Media Manager. You produce content calendars, post copy, and short-form video hooks for the businesses. On-brand, concise, platform-appropriate." },
  { id: "compliance", name: "Bram", role: "Compliance Advisor",
    system: "You are Bram, Compliance Advisor. You flag wholesaling-licensing, contract-assignment, TCPA/DNC, FCRA, and fair-housing considerations by jurisdiction, and recommend when to consult a licensed attorney. You provide information, NOT legal advice." },
  { id: "data", name: "Quinn", role: "Data Analyst",
    system: "You are Quinn, Data Analyst. You turn pipeline/CRM/finance data into KPIs, cohort and conversion analysis, and clear reporting. You reason only from provided data and flag gaps." },
  { id: "recruiter", name: "Hana", role: "Recruiter / Team Builder",
    system: "You are Hana, Recruiter. You write role descriptions, screening questions, comp structures, and onboarding plans for VAs, acquisition reps, and dispo agents." },
  { id: "copywriter", name: "Leo", role: "Copywriter",
    system: "You are Leo, Copywriter. You write persuasive, honest copy: landing pages, buyer blasts (opt-in), seller mailers, scripts, and email sequences. Clear, benefit-led, no false claims." },
];

// --- Custom agents: the owner can create their own workers ------------------
const CUSTOM_FILE = dataPath("custom-agents.json");
async function readCustom(): Promise<Worker[]> {
  try { const r = await fs.readFile(CUSTOM_FILE, "utf8"); const p = JSON.parse(r); return Array.isArray(p) ? p : []; } catch { return []; }
}
async function writeCustom(items: Worker[]) {
  await fs.mkdir(path.dirname(CUSTOM_FILE), { recursive: true });
  await fs.writeFile(CUSTOM_FILE, JSON.stringify(items, null, 2), "utf8");
}
// All workers = built-in roster + owner-created agents.
export async function listAllWorkers(): Promise<(Worker & { custom?: boolean })[]> {
  const custom = (await readCustom()).map((w) => ({ ...w, custom: true }));
  return [...WORKERS, ...custom];
}
export async function findWorker(id: string): Promise<Worker | undefined> {
  return (await listAllWorkers()).find((w) => w.id === id);
}
export async function createWorker(name: string, role: string, system: string): Promise<Worker> {
  const items = await readCustom();
  const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}-${Date.now().toString(36).slice(-4)}`;
  const w: Worker = { id, name: name.trim(), role: role.trim() || "Specialist", system: system.trim() || `You are ${name}, a specialist on SAHJONY's team. Be precise and helpful.` };
  items.push(w); await writeCustom(items); return w;
}
export async function removeWorker(id: string): Promise<boolean> {
  const items = await readCustom();
  const next = items.filter((w) => w.id !== id);
  await writeCustom(next); return next.length !== items.length;
}

export interface WorkforceTask {
  id: string;
  workerId: string;
  task: string;
  status: "queued" | "done" | "error";
  result: string;
  createdAt: number;
}

const FILE = dataPath("workforce-tasks.json");
async function read(): Promise<WorkforceTask[]> {
  try { const r = await fs.readFile(FILE, "utf8"); const p = JSON.parse(r); return Array.isArray(p) ? p : []; } catch { return []; }
}
async function write(items: WorkforceTask[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}
export const listTasks = () => read();
export async function saveTask(t: WorkforceTask) {
  const items = await read();
  const i = items.findIndex((x) => x.id === t.id);
  if (i >= 0) items[i] = t; else items.unshift(t);
  await write(items.slice(0, 50));
}
export async function removeTask(id: string) {
  const items = await read(); const n = items.filter((t) => t.id !== id); await write(n); return n.length !== items.length;
}
export function newTask(workerId: string, task: string): WorkforceTask {
  return { id: crypto.randomUUID(), workerId, task, status: "queued", result: "", createdAt: Date.now() };
}
