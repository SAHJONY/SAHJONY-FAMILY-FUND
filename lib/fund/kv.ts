// SAHJONY CAPITAL LLC — durable key-value store.
//
// PRIMARY: Upstash Redis (REST API) when UPSTASH_REDIS_REST_URL + _TOKEN are
// set — durable, serverless-friendly, survives cold starts (required for real
// multi-user accounts, per-user keys, and billing state). FALLBACK: a single
// JSON file under the data dir, so the app runs fully in local dev without any
// external service. Same interface either way.

import { promises as fs } from "node:fs";
import path from "node:path";
import { dataPath } from "../paths";
import { getSecret } from "../secrets";

export interface KV {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, val: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

// ---- Upstash Redis over REST ----------------------------------------------
function upstashCreds(): { url: string; token: string } | null {
  const url = getSecret("UPSTASH_REDIS_REST_URL");
  const token = getSecret("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function upstashCmd(creds: { url: string; token: string }, args: (string | number)[]): Promise<any> {
  const res = await fetch(creds.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const j = await res.json();
  return j.result;
}

function upstashKV(creds: { url: string; token: string }): KV {
  return {
    async get<T>(key: string) {
      const r = await upstashCmd(creds, ["GET", key]);
      if (r == null) return null;
      try { return JSON.parse(r) as T; } catch { return r as T; }
    },
    async set(key, val) { await upstashCmd(creds, ["SET", key, JSON.stringify(val)]); },
    async del(key) { await upstashCmd(creds, ["DEL", key]); },
    async keys(prefix) {
      const out: string[] = [];
      let cursor = "0";
      do {
        const r = await upstashCmd(creds, ["SCAN", cursor, "MATCH", `${prefix}*`, "COUNT", 200]);
        cursor = r?.[0] ?? "0";
        for (const k of r?.[1] ?? []) out.push(k);
      } while (cursor !== "0");
      return out;
    },
  };
}

// ---- File fallback (local dev) --------------------------------------------
const FILE = () => dataPath("fund-kv.json");
async function readAll(): Promise<Record<string, string>> {
  try { return JSON.parse(await fs.readFile(FILE(), "utf8")); } catch { return {}; }
}
async function writeAll(o: Record<string, string>) {
  await fs.mkdir(path.dirname(FILE()), { recursive: true });
  await fs.writeFile(FILE(), JSON.stringify(o, null, 2), "utf8");
}
const fileKV: KV = {
  async get<T>(key: string) {
    const all = await readAll();
    if (all[key] == null) return null;
    try { return JSON.parse(all[key]) as T; } catch { return null; }
  },
  async set(key, val) { const all = await readAll(); all[key] = JSON.stringify(val); await writeAll(all); },
  async del(key) { const all = await readAll(); delete all[key]; await writeAll(all); },
  async keys(prefix) { return Object.keys(await readAll()).filter((k) => k.startsWith(prefix)); },
};

export function kv(): KV {
  const creds = upstashCreds();
  return creds ? upstashKV(creds) : fileKV;
}

// True when durable storage is configured (vs ephemeral local file).
export function kvIsDurable(): boolean {
  return upstashCreds() !== null;
}
