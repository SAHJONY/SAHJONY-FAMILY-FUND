import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/fund/auth";
import { createCheckout, stripeConfigured } from "@/lib/fund/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Start a Stripe Checkout for the Pro plan. Returns the hosted checkout URL.
export async function POST(req: NextRequest) {
  const u = await currentUser(req);
  if (!u) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  if (!stripeConfigured()) return NextResponse.json({ error: "billing not configured", configured: false }, { status: 503 });
  try {
    const origin = req.headers.get("origin") || new URL(req.url).origin;
    return NextResponse.json({ url: await createCheckout(u, origin) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
