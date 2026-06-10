import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// WhatsApp via the official WhatsApp Business Cloud API (Meta). Uses the owner's
// own credentials: WHATSAPP_TOKEN + WHATSAPP_PHONE_ID (set on /env). Sends a
// single consented message to a contact with a prior relationship — not bulk
// blasting. Real Meta Graph API; nothing simulated.

function cfg() {
  return { token: process.env.WHATSAPP_TOKEN, phoneId: process.env.WHATSAPP_PHONE_ID };
}

export async function GET() {
  const { token, phoneId } = cfg();
  return NextResponse.json({ connected: !!(token && phoneId) });
}

export async function POST(req: NextRequest) {
  const { token, phoneId } = cfg();
  if (!token || !phoneId) {
    return NextResponse.json({ error: "WhatsApp not connected. Set WHATSAPP_TOKEN + WHATSAPP_PHONE_ID on the env page." }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body.consent) return NextResponse.json({ error: "Set consent:true. WhatsApp messaging requires opt-in; no cold blasting." }, { status: 403 });
  const to = String(body.to ?? "").replace(/[^\d]/g, "");
  const text = String(body.text ?? "").trim();
  if (to.length < 7 || !text) return NextResponse.json({ error: "Valid phone (digits) and message text required." }, { status: 400 });

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
    const data = await res.json();
    return NextResponse.json({ ok: res.ok, status: res.status, data });
  } catch (e) {
    return NextResponse.json({ error: `WhatsApp send failed: ${(e as Error).message}` }, { status: 502 });
  }
}
