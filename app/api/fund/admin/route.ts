import { NextRequest, NextResponse } from "next/server";
import { ownerGate, systemStatus } from "@/lib/fund/admin";
import { listUsers, updateUser, deleteUser, type Plan, type Status } from "@/lib/fund/auth";
import { setSecret, deleteSecret, listSecretsMasked } from "@/lib/secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Owner-only control surface. Auth: an owner session or the x-owner-key header.
export async function GET(req: NextRequest) {
  if (!(await ownerGate(req))) return NextResponse.json({ error: "owner only" }, { status: 403 });
  return NextResponse.json(
    { status: await systemStatus(), users: await listUsers(), secrets: listSecretsMasked() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  if (!(await ownerGate(req))) return NextResponse.json({ error: "owner only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");

  switch (action) {
    case "set_plan":
      return NextResponse.json({ ok: true, user: await updateUser(String(b.id), { plan: b.plan as Plan }) });
    case "set_status":
      return NextResponse.json({ ok: true, user: await updateUser(String(b.id), { status: b.status as Status }) });
    case "grant_owner":
      return NextResponse.json({ ok: true, user: await updateUser(String(b.id), { isOwner: !!b.isOwner }) });
    case "delete_user":
      return NextResponse.json({ ok: await deleteUser(String(b.id)) });
    case "set_secret": {
      const key = String(b.key || "").trim();
      const value = String(b.value ?? "");
      if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
      if (value === "") deleteSecret(key); else setSecret(key, value);
      return NextResponse.json({ ok: true, secrets: listSecretsMasked() });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
