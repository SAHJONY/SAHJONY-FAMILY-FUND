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
];

export interface WorkforceTask {
  id: string;
  workerId: string;
  task: string;
  status: "queued" | "done" | "error";
  result: string;
  createdAt: number;
}

const FILE = path.join(process.cwd(), "data", "workforce-tasks.json");
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
