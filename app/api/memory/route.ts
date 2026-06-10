import { NextRequest, NextResponse } from "next/server";
import { listMemories, addMemory, removeMemory } from "@/lib/memory-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { memories: await listMemories() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  const mem = await addMemory(text, String(body.tag ?? "general"));
  return NextResponse.json({ ok: true, memory: mem });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await removeMemory(id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
