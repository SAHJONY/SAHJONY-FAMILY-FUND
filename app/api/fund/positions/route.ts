import { NextRequest, NextResponse } from "next/server";
import { listPositions, upsertPosition, removePosition } from "@/lib/fund/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const positions = await listPositions();
  return NextResponse.json({ positions }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const pos = await upsertPosition(body);
  return NextResponse.json({ ok: true, pos });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ ok: await removePosition(id) });
}
