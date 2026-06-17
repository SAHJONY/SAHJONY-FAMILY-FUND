// SAHJONY CAPITAL LLC — per-user key vault ("bring your own env").
//
// Each user can store their OWN provider keys (data feed + LLM engines). They
// live under that user's namespace in KV and override the app-global keys for
// that user only — so a family member can plug in their own Alpaca / Claude /
// OpenAI / Groq keys and run on their own quota. Falls back to the app keys when
// a user hasn't set their own.

import { kv } from "./kv";

const vKey = (userId: string) => `u:${userId}:vault`;

// The keys a user is allowed to bring. (Infra keys like the datastore/session
// stay app-global and are NOT user-overridable.)
export const VAULT_KEYS = [
  "ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY",
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY",
];

export async function getUserVault(userId: string): Promise<Record<string, string>> {
  return (await kv().get<Record<string, string>>(vKey(userId))) ?? {};
}

export async function setUserVaultKey(userId: string, name: string, value: string): Promise<Record<string, string>> {
  if (!VAULT_KEYS.includes(name)) throw new Error("key not allowed in user vault");
  const v = await getUserVault(userId);
  if (value === "") delete v[name]; else v[name] = value;
  await kv().set(vKey(userId), v);
  return v;
}

export async function maskedVault(userId: string): Promise<{ key: string; set: boolean; value: string }[]> {
  const v = await getUserVault(userId);
  return VAULT_KEYS.map((k) => ({ key: k, set: !!v[k], value: v[k] ? `••••••${v[k].slice(-4)}` : "" }));
}
