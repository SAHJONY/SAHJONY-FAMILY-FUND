import { NextRequest, NextResponse } from "next/server";
import { listTasks, addTask, updateTask, removeTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ tasks: await listTasks() }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.id) { await updateTask(body.id, body); return NextResponse.json({ ok: true }); }
  return NextResponse.json({ ok: true, task: await addTask(body) });
}
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ ok: await removeTask(id) });
}
