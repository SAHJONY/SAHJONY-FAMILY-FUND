import { NextRequest, NextResponse } from "next/server";
import { listJV, upsertJV, removeJV } from "@/lib/crm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const jvs = await listJV();
  // Compute your cut per JV (real math from entered split + fee).
  const withCut = jvs.map((j) => ({ ...j, myCut: Math.round((j.totalFee || 0) * (j.splitPct || 0) / 100) }));
  return NextResponse.json({ jvs: withCut }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, jv: await upsertJV(body) });
}
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ ok: await removeJV(id) });
}
