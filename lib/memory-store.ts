import { dataPath } from "./paths";
// SAHJONY persistent memory — a durable, file-backed fact store.
//
// Each memory is a small tagged fact that survives restarts (written to
// ./data/sahjony-memory.json). The store is intentionally simple and local;
// it gives SAHJONY continuity across sessions and is auto-recalled into the
// chat context so the model "remembers" without a vector DB.

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface Memory {
  id: string;
  text: string;
  tag: string; // free-form category, e.g. "owner", "preference", "project"
  createdAt: number;
}

const FILE = dataPath("sahjony-memory.json");

async function readAll(): Promise<Memory[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(items: Memory[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function listMemories(): Promise<Memory[]> {
  return (await readAll()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function addMemory(text: string, tag = "general"): Promise<Memory> {
  const items = await readAll();
  const mem: Memory = {
    id: crypto.randomUUID(),
    text: text.trim(),
    tag: tag.trim() || "general",
    createdAt: Date.now(),
  };
  items.push(mem);
  await writeAll(items);
  return mem;
}

export async function removeMemory(id: string): Promise<boolean> {
  const items = await readAll();
  const next = items.filter((m) => m.id !== id);
  if (next.length === items.length) return false;
  await writeAll(next);
  return true;
}

// Compact recall block injected into the model context as a system message.
export async function recallBlock(limit = 40): Promise<string | null> {
  const items = (await listMemories()).slice(0, limit);
  if (!items.length) return null;
  const lines = items.map((m) => `- (${m.tag}) ${m.text}`).join("\n");
  return `Persistent memory you have retained about the owner and this system:\n${lines}`;
}
