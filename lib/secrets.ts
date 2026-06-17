// Runtime secrets overlay.
//
// Lets the owner add API keys from the dashboard /env page in ANY environment
// (including Vercel production, where the filesystem is read-only except /tmp
// and process.env can't be edited at runtime). Keys are written to a JSON store
// under the writable data dir and read synchronously, overlaying process.env.
//
// getSecret(name) order: runtime store → process.env. So a key added in the UI
// takes effect immediately, and build-time env vars still work as a fallback.
//
// CAVEAT: on serverless the store lives in /tmp (ephemeral per instance) — keys
// added in the UI may reset on a cold start. For permanent production secrets,
// set them in the Vercel project env (durable). This overlay is the convenient,
// immediate path.

import fs from "node:fs";
import { dataPath } from "./paths";

const FILE = () => dataPath("secrets.json");

function readStore(): Record<string, string> {
  try {
    const raw = fs.readFileSync(FILE(), "utf8");
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

export function getSecret(name: string): string | undefined {
  const store = readStore();
  if (store[name] != null && store[name] !== "") return store[name];
  return process.env[name];
}

export function hasSecret(name: string): boolean {
  const v = getSecret(name);
  return !!(v && v.length);
}

export function setSecret(name: string, value: string): void {
  const store = readStore();
  store[name] = value;
  fs.mkdirSync(dataPath(), { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(store, null, 2), "utf8");
}

export function deleteSecret(name: string): void {
  const store = readStore();
  delete store[name];
  fs.mkdirSync(dataPath(), { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(store, null, 2), "utf8");
}

// Combined view of every known key (store + the env vars the app uses), masked.
const KNOWN_ENV = [
  "NIM_BASE_URL", "NIM_API_KEY", "NIM_MODEL", "NIM_FALLBACK_MODELS", "NIM_MAX_TOKENS",
  "ATTOM_API_KEY", "REGRID_API_TOKEN", "MLS_RESO_URL", "MLS_RESO_TOKEN",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_SECURE",
  "IMAP_HOST", "IMAP_PORT", "IMAP_USER", "IMAP_PASS",
  "DOCUSIGN_BASE_URI", "DOCUSIGN_ACCOUNT_ID", "DOCUSIGN_TOKEN",
  "BLAND_API_KEY", "GOOGLE_VOICE_NUMBER", "PROPSTREAM_URL",
  "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "ANTHROPIC_API_KEY",
  "ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY",
  // Fund engine chain (brain) + datastore + billing
  "OPENAI_API_KEY", "OPENAI_MODEL", "GROQ_API_KEY", "GROQ_MODEL", "ANTHROPIC_MODEL",
  "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "SESSION_SECRET",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PRO",
  "OWNER_KEY", "OWNER_EMAIL", "CRON_SECRET",
];
const SECRETISH = /(KEY|TOKEN|SECRET|PASS|PASSWORD|CREDENTIAL)/i;

export function listSecretsMasked(): { key: string; value: string; masked: boolean; set: boolean }[] {
  const store = readStore();
  const keys = new Set<string>([...KNOWN_ENV, ...Object.keys(store)]);
  return [...keys].sort().map((key) => {
    const raw = store[key] ?? process.env[key] ?? "";
    const set = !!raw;
    if (SECRETISH.test(key) && raw) {
      return { key, value: `••••••••${raw.slice(-4)}`, masked: true, set };
    }
    return { key, value: raw, masked: false, set };
  });
}
