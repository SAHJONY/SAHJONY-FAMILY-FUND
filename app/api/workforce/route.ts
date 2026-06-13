import { NextRequest, NextResponse } from "next/server";
import { listAllWorkers, findWorker, createWorker, removeWorker, listTasks, saveTask, removeTask, newTask } from "@/lib/workforce";
import { complete } from "@/lib/infer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ workers: await listAllWorkers(), tasks: await listTasks() }, { headers: { "Cache-Control": "no-store" } });
}

// POST creates a custom agent (action:"create_agent") OR assigns a task to a worker.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "create_agent") {
    if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
    const w = await createWorker(String(body.name), String(body.role ?? ""), String(body.system ?? ""));
    return NextResponse.json({ ok: true, worker: w });
  }

  const worker = await findWorker(body.workerId);
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

// DELETE removes a task (?id=) or a custom agent (?agent=).
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const agent = url.searchParams.get("agent");
  if (agent) return NextResponse.json({ ok: await removeWorker(agent) });
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id or agent required" }, { status: 400 });
  return NextResponse.json({ ok: await removeTask(id) });
}
