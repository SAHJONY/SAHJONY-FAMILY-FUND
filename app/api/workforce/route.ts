import { NextRequest, NextResponse } from "next/server";
import { WORKERS, listTasks, saveTask, removeTask, newTask } from "@/lib/workforce";
import { complete } from "@/lib/infer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ workers: WORKERS, tasks: await listTasks() }, { headers: { "Cache-Control": "no-store" } });
}

// Assign a task to a worker — it runs immediately on the brain and stores the result.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const worker = WORKERS.find((w) => w.id === body.workerId);
  if (!worker) return NextResponse.json({ error: "unknown worker" }, { status: 400 });
  const task = String(body.task ?? "").trim();
  if (!task) return NextResponse.json({ error: "task required" }, { status: 400 });

  const t = newTask(worker.id, task);
  const res = await complete([
    { role: "system", content: worker.system },
    { role: "user", content: task },
  ]);
  t.result = res?.content ?? "Brain unreachable.";
  t.status = res ? "done" : "error";
  await saveTask(t);
  return NextResponse.json({ ok: true, task: t });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ ok: await removeTask(id) });
}
