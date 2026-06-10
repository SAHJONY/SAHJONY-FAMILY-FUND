import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Bland.ai integration — places ONE consented AI call against the owner's real
// account. Intentionally single-call only: no list upload, no campaign blasting.
// The caller must affirm a prior relationship / consent, and Bland's own
// terms + TCPA/DNC still apply. Uses the real Bland API; no mock calls.

export async function GET() {
  return NextResponse.json({
    connected: !!process.env.BLAND_API_KEY,
    detail: process.env.BLAND_API_KEY ? "Connected." : "Set BLAND_API_KEY on the env page.",
  });
}

export async function POST(req: NextRequest) {
  const key = process.env.BLAND_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Bland not connected. Set BLAND_API_KEY." }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const phone = String(body.phone ?? "").trim();
  const task = String(body.task ?? "").trim();

  if (!body.consent) {
    return NextResponse.json(
      { error: "Consent affirmation required.", detail: "Confirm this contact has a prior relationship/consent. No cold-list dialing." },
      { status: 403 }
    );
  }
  if (!/^\+?[0-9\s\-()]{7,}$/.test(phone) || !task) {
    return NextResponse.json({ error: "Valid single phone number and a task/script are required." }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.bland.ai/v1/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: key },
      body: JSON.stringify({
        phone_number: phone,
        task,
        ...(body.voice ? { voice: body.voice } : {}),
        ...(process.env.GOOGLE_VOICE_NUMBER ? { from: process.env.GOOGLE_VOICE_NUMBER } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, status: res.status, data });
  } catch (e) {
    return NextResponse.json({ error: `Bland call failed: ${(e as Error).message}` }, { status: 502 });
  }
}
