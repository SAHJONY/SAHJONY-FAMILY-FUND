// SAHJONY CAPITAL LLC — freemium billing (Stripe).
//
// Model: BYO-key flat subscription. Users bring their own data/LLM keys (so COGS
// ≈ $0); the platform charges for Pro. FREE: paper trading, end-of-day data,
// 1 portfolio, ≤2y backtests, the analyst brain. PRO: real-time/Alpaca feed,
// Claude news + alerts, unlimited backtest history, notifications.
//
// Stripe is key-gated: Checkout + Customer Portal + webhook. Until STRIPE_SECRET_KEY
// and STRIPE_PRICE_PRO are set, upgrade is inert and everyone stays on Free
// (the owner can still grant Pro from the console). Plan state lives on the user.

import { getSecret } from "../secrets";
import { getUser, updateUser, type User } from "./auth";

export const PLAN_FEATURES = {
  free: { label: "Free", backtestYears: 2, realtimeData: false, news: false, alerts: false, portfolios: 1 },
  pro: { label: "Pro", backtestYears: 10, realtimeData: true, news: true, alerts: true, portfolios: 10 },
} as const;

export function isPro(u: { plan: string }): boolean {
  return u.plan === "pro";
}

export function stripeConfigured(): boolean {
  return !!getSecret("STRIPE_SECRET_KEY") && !!getSecret("STRIPE_PRICE_PRO");
}

async function stripe(path: string, params: Record<string, string>): Promise<any> {
  const key = getSecret("STRIPE_SECRET_KEY");
  if (!key) throw new Error("stripe not configured");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error?.message || `stripe ${res.status}`);
  return j;
}

// Create a Checkout Session for the Pro subscription; returns the hosted URL.
export async function createCheckout(user: User, origin: string): Promise<string> {
  const price = getSecret("STRIPE_PRICE_PRO")!;
  const session = await stripe("checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    customer_email: user.email,
    client_reference_id: user.id,
    "metadata[userId]": user.id,
    success_url: `${origin}/fund?upgraded=1`,
    cancel_url: `${origin}/fund?canceled=1`,
  });
  return session.url;
}

// Verify a Stripe webhook signature (HMAC-SHA256 over `${t}.${payload}`).
export async function verifyStripeSignature(payload: string, sigHeader: string | null): Promise<boolean> {
  const secret = getSecret("STRIPE_WEBHOOK_SECRET");
  if (!secret || !sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=")));
  const t = parts["t"], v1 = parts["v1"];
  if (!t || !v1) return false;
  const crypto = await import("node:crypto");
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(v1), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Apply a subscription state change from a webhook event.
export async function applyStripeEvent(event: any): Promise<void> {
  const type = event?.type as string;
  const obj = event?.data?.object ?? {};
  const userId = obj?.metadata?.userId || obj?.client_reference_id;
  if (!userId) return;
  const u = await getUser(userId);
  if (!u) return;
  if (type === "checkout.session.completed" || type === "customer.subscription.created" || type === "customer.subscription.updated") {
    const active = type.startsWith("checkout") || obj?.status === "active" || obj?.status === "trialing";
    await updateUser(userId, { plan: active ? "pro" : "free" });
  } else if (type === "customer.subscription.deleted") {
    await updateUser(userId, { plan: "free" });
  }
}
