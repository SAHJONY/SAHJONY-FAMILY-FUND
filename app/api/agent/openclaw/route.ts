import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// OpenClaw adapter slot.
//
// "OpenClaw" is not a package this app installs or bundles. This route is a
// generic passthrough: if you point OPENCLAW_URL at a real OpenClaw-compatible
// agent endpoint (and optionally OPENCLAW_KEY), SAHJONY will relay requests to
// it. Until then it reports as unlinked. Nothing is installed or executed
// locally — it is a clean integration seam you control.

export async function GET() {
  const url = process.env.OPENCLAW_URL;
  return NextResponse.json({
    linked: !!url,
    target: url ?? null,
    detail: url ? "OpenClaw endpoint configured." : "Unlinked. Set OPENCLAW_URL to connect a real endpoint.",
  });
}

export async function POST(req: NextRequest) {
  const url = process.env.OPENCLAW_URL;
  if (!url) {
    return NextResponse.json(
      { error: "OpenClaw is unlinked.", detail: "Set OPENCLAW_URL in the env page to connect a real endpoint." },
      { status: 503 }
    );
  }
  const body = await req.json().catch(() => ({}));
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OPENCLAW_KEY ? { Authorization: `Bearer ${process.env.OPENCLAW_KEY}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, status: res.status, data });
  } catch (e) {
    return NextResponse.json({ error: `OpenClaw relay failed: ${(e as Error).message}` }, { status: 502 });
  }
}
