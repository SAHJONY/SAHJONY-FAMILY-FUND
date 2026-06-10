import { dataPath } from "./paths";
// Personal task / reminder store for SAHJONY-as-assistant. File-backed (./data).
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface Task {
  id: string;
  text: string;
  due: string;        // ISO date string or ""
  priority: "low" | "med" | "high";
  done: boolean;
  createdAt: number;
}

const FILE = dataPath("tasks.json");
async function read(): Promise<Task[]> {
  try { const r = await fs.readFile(FILE, "utf8"); const p = JSON.parse(r); return Array.isArray(p) ? p : []; } catch { return []; }
}
async function write(items: Task[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function listTasks(): Promise<Task[]> {
  const items = await read();
  return items.sort((a, b) => Number(a.done) - Number(b.done) || (a.due || "9999").localeCompare(b.due || "9999"));
}
export async function addTask(input: Partial<Task>): Promise<Task> {
  const items = await read();
  const t: Task = { id: crypto.randomUUID(), text: "", due: "", priority: "med", done: false, createdAt: Date.now(), ...input } as Task;
  items.push(t); await write(items); return t;
}
export async function updateTask(id: string, patch: Partial<Task>): Promise<boolean> {
  const items = await read(); const i = items.findIndex((t) => t.id === id);
  if (i < 0) return false; items[i] = { ...items[i], ...patch }; await write(items); return true;
}
export async function removeTask(id: string): Promise<boolean> {
  const items = await read(); const n = items.filter((t) => t.id !== id); await write(n); return n.length !== items.length;
}
