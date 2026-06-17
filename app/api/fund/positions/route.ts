import { NextRequest, NextResponse } from "next/server";
import { listPositions, upsertPosition, removePosition } from "@/lib/fund/store";
import { currentUser } from "@/lib/fund/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const u = await currentUser(req);
  if (!u) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  return NextResponse.json({ positions: await listPositions(u.id) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const u = await currentUser(req);
  if (!u) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, pos: await upsertPosition(u.id, body) });
}

export async function DELETE(req: NextRequest) {
  const u = await currentUser(req);
  if (!u) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ ok: await removePosition(u.id, id) });
}
