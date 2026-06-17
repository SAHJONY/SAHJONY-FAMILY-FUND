import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/fund/auth";
import { maskedVault, setUserVaultKey, VAULT_KEYS } from "@/lib/fund/vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The signed-in user's own provider keys (BYO env). Values are write-only;
// reads are masked. These override the app-global keys for this user only.
export async function GET(req: NextRequest) {
  const u = await currentUser(req);
  if (!u) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  return NextResponse.json({ keys: await maskedVault(u.id), allowed: VAULT_KEYS }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const u = await currentUser(req);
  if (!u) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.key || "");
  if (!VAULT_KEYS.includes(name)) return NextResponse.json({ error: "key not allowed" }, { status: 400 });
  try {
    await setUserVaultKey(u.id, name, String(b.value ?? ""));
    return NextResponse.json({ ok: true, keys: await maskedVault(u.id) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
