import { NextRequest, NextResponse } from "next/server";
import { verifyStripeSignature, applyStripeEvent } from "@/lib/fund/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Stripe webhook: flips a user's plan on subscription create/update/delete.
export async function POST(req: NextRequest) {
  const payload = await req.text();
  const ok = await verifyStripeSignature(payload, req.headers.get("stripe-signature"));
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  try {
    await applyStripeEvent(JSON.parse(payload));
  } catch { /* swallow — return 200 so Stripe doesn't retry forever */ }
  return NextResponse.json({ received: true });
}
