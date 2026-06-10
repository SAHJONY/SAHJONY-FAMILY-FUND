import { NextRequest, NextResponse } from "next/server";
import { listBusinesses, upsertBusiness, removeBusiness } from "@/lib/business";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ businesses: await listBusinesses() }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, business: await upsertBusiness(body) });
}
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ ok: await removeBusiness(id) });
}
