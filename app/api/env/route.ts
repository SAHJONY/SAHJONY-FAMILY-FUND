import { NextRequest, NextResponse } from "next/server";
import { listSecretsMasked, setSecret, deleteSecret } from "@/lib/secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Env / API-key manager backed by the runtime secrets store (lib/secrets).
// Works in BOTH dev and production: keys are written to the writable data dir
// and overlay process.env immediately (no redeploy). Secret-looking values are
// masked on read and never returned in full.

export async function GET() {
  return NextResponse.json(
    { vars: listSecretsMasked(), runtime: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const key = String(body.key ?? "").trim();
  const value = String(body.value ?? "");
  if (!/^[A-Z0-9_]+$/i.test(key)) {
    return NextResponse.json({ error: "Invalid key (use A-Z, 0-9, _)" }, { status: 400 });
  }
  try {
    setSecret(key, value);
    return NextResponse.json({ ok: true, note: "Saved. Takes effect immediately (overlays process.env)." });
  } catch (e) {
    return NextResponse.json({ error: `Save failed: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  deleteSecret(key);
  return NextResponse.json({ ok: true });
}
