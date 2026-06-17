import { NextRequest, NextResponse } from "next/server";
import { registerUser, verifyLogin, signSession, clearCookie, currentUser, publicUser } from "@/lib/fund/auth";
import { seedExampleBook } from "@/lib/fund/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Self-contained auth for friends & family: register | login | logout | me.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");

  if (action === "register") {
    const r = await registerUser(String(b.email || ""), String(b.name || ""), String(b.password || ""));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
    await seedExampleBook(r.user!.id);
    const { cookie } = signSession(r.user!.id);
    return NextResponse.json({ ok: true, user: r.user }, { headers: { "Set-Cookie": cookie } });
  }

  if (action === "login") {
    const u = await verifyLogin(String(b.email || ""), String(b.password || ""));
    if (!u) return NextResponse.json({ error: "invalid email or password (or account suspended)" }, { status: 401 });
    const { cookie } = signSession(u.id);
    return NextResponse.json({ ok: true, user: publicUser(u) }, { headers: { "Set-Cookie": cookie } });
  }

  if (action === "logout") {
    return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

// Current signed-in user (for guards / header display).
export async function GET(req: NextRequest) {
  const u = await currentUser(req);
  return NextResponse.json({ user: u ? publicUser(u) : null }, { headers: { "Cache-Control": "no-store" } });
}
