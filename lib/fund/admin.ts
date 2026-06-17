// SAHJONY CAPITAL LLC — owner/admin control layer.
//
// Gives the owner total control: live system status (engine chain, data feeds,
// datastore durability, billing), key/secret management, and user administration
// (plan, suspend, delete, grant owner). Gated to the owner only.

import { hasSecret, getSecret } from "../secrets";
import { kvIsDurable } from "./kv";
import { currentUser, listUsers, countUsers, type PublicUser } from "./auth";

// Owner gate: a signed-in owner user, OR a matching x-owner-key header (the
// bootstrap passcode for before any owner has registered). In local dev with no
// OWNER_KEY set we allow access so the console is reachable; on Vercel access
// requires an owner session or the OWNER_KEY.
export async function ownerGate(req: { headers: { get(n: string): string | null } }): Promise<boolean> {
  const u = await currentUser(req);
  if (u?.isOwner && u.status === "active") return true;
  const ownerKey = getSecret("OWNER_KEY");
  if (ownerKey) return req.headers.get("x-owner-key") === ownerKey;
  return !process.env.VERCEL; // dev fallback only
}

export interface EngineStatus { id: string; label: string; configured: boolean; role: string }
export interface SystemStatus {
  engines: EngineStatus[];
  dataFeeds: { id: string; label: string; configured: boolean; note: string }[];
  datastore: { durable: boolean; backend: string };
  billing: { stripeConfigured: boolean; priceConfigured: boolean; webhookConfigured: boolean };
  security: { sessionSecretSet: boolean; ownerKeySet: boolean };
  users: { total: number; byPlan: Record<string, number>; byStatus: Record<string, number> };
}

export async function systemStatus(): Promise<SystemStatus> {
  const users = await listUsers();
  const byPlan: Record<string, number> = { free: 0, pro: 0 };
  const byStatus: Record<string, number> = { active: 0, suspended: 0 };
  for (const u of users) { byPlan[u.plan] = (byPlan[u.plan] ?? 0) + 1; byStatus[u.status] = (byStatus[u.status] ?? 0) + 1; }

  return {
    engines: [
      { id: "anthropic", label: "Claude (Anthropic)", configured: hasSecret("ANTHROPIC_API_KEY"), role: "Primary brain" },
      { id: "openai", label: "OpenAI", configured: hasSecret("OPENAI_API_KEY"), role: "Fallback 1" },
      { id: "groq", label: "Groq (free)", configured: hasSecret("GROQ_API_KEY"), role: "Fallback 2" },
      { id: "nim", label: "NVIDIA NIM", configured: hasSecret("NIM_API_KEY"), role: "Fallback 3 (in-house)" },
    ],
    dataFeeds: [
      { id: "yahoo", label: "Yahoo Finance", configured: true, note: "Primary · no key · blocked from datacenter IPs" },
      { id: "alpaca", label: "Alpaca", configured: hasSecret("ALPACA_API_KEY_ID") && hasSecret("ALPACA_API_SECRET_KEY"), note: "Fallback · works from cloud" },
    ],
    datastore: { durable: kvIsDurable(), backend: kvIsDurable() ? "Upstash Redis (durable)" : "Local file (ephemeral on Vercel)" },
    billing: {
      stripeConfigured: hasSecret("STRIPE_SECRET_KEY"),
      priceConfigured: hasSecret("STRIPE_PRICE_PRO"),
      webhookConfigured: hasSecret("STRIPE_WEBHOOK_SECRET"),
    },
    security: { sessionSecretSet: hasSecret("SESSION_SECRET"), ownerKeySet: hasSecret("OWNER_KEY") },
    users: { total: await countUsers(), byPlan, byStatus },
  };
}

export type { PublicUser };
