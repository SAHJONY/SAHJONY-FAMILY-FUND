"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Worker { id: string; name: string; role: string }
interface WTask { id: string; workerId: string; task: string; status: string; result: string }

const F = "bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]";

export default function WorkforcePage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [tasks, setTasks] = useState<WTask[]>([]);
  const [sel, setSel] = useState("acquisitions");
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);

  // dev builder
  const [spec, setSpec] = useState("");
  const [devOut, setDevOut] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);
  const [files, setFiles] = useState<string[]>([]);

  const load = async () => {
    const j = await (await fetch("/api/workforce", { cache: "no-store" })).json();
    setWorkers(j.workers ?? []); setTasks(j.tasks ?? []);
  };
  const loadFiles = async () => setFiles((await (await fetch("/api/dev", { cache: "no-store" })).json()).files ?? []);
  useEffect(() => { load(); loadFiles(); }, []);

  const assign = async () => {
    if (!task.trim()) return;
    setBusy(true);
    await fetch("/api/workforce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workerId: sel, task }) });
    setTask(""); setBusy(false); load();
  };
  const delTask = async (id: string) => { await fetch(`/api/workforce?id=${id}`, { method: "DELETE" }); load(); };

  const build = async () => {
    if (!spec.trim()) return;
    setDevBusy(true); setDevOut(null);
    const j = await (await fetch("/api/dev", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: spec }) })).json();
    setDevOut(j.output ?? j.error); setDevBusy(false);
  };

  const wname = (id: string) => workers.find((w) => w.id === id)?.name ?? id;

  return (
    <main className="relative z-10 max-w-6xl mx-auto px-5 py-7">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl tracking-[0.2em] text-[var(--hud)]" style={{ textShadow: "0 0 14px rgba(63,224,255,0.5)" }}>AI WORKFORCE &amp; BUILDER</h1>
        <Link href="/" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--hud)] text-[var(--hud)]">← Control Plane</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Workforce */}
        <section className="hud-panel p-4">
          <h2 className="label mb-3 text-[var(--gold)]">▸ Workforce — {workers.length} specialists</h2>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {workers.map((w) => (
              <button key={w.id} onClick={() => setSel(w.id)}
                className={`text-left px-2 py-1.5 border text-[11px] ${sel === w.id ? "border-[var(--hud)] hud-glow" : "border-[rgba(63,224,255,0.15)]"}`}>
                <div className="text-[var(--text)]">{w.name}</div>
                <div className="text-[9px] text-[var(--muted)] uppercase tracking-wide">{w.role}</div>
              </button>
            ))}
          </div>
          <textarea value={task} onChange={(e) => setTask(e.target.value)} placeholder={`Assign a task to ${wname(sel)}…`}
            className={`${F} w-full h-16 mb-2`} />
          <div className="flex justify-end mb-3"><button onClick={assign} disabled={busy} className="px-4 py-1.5 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)] disabled:opacity-40">{busy ? "Working…" : "Assign task"}</button></div>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {tasks.length === 0 ? <span className="text-[11px] text-[var(--muted)]">No tasks yet.</span> :
              tasks.map((t) => (
                <div key={t.id} className="border border-[rgba(63,224,255,0.15)] p-2 text-[11px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[var(--gold)]">{wname(t.workerId)} <span className="text-[9px] text-[var(--muted)]">· {t.task.slice(0, 40)}</span></span>
                    <button onClick={() => delTask(t.id)} className="text-[var(--muted)] hover:text-[var(--bad)]">×</button>
                  </div>
                  <div className="text-[var(--text)] whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto">{t.result}</div>
                </div>
              ))}
          </div>
        </section>

        {/* Builder */}
        <section className="hud-panel p-4">
          <h2 className="label mb-3 text-[var(--gold)]">▸ Full-Stack Builder (Ada)</h2>
          <textarea value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="Describe what to build (component, API, script, feature)…"
            className={`${F} w-full h-20 mb-2`} />
          <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] text-[var(--muted)] uppercase tracking-wide">Workspace: {files.length} files</span>
            <button onClick={build} disabled={devBusy} className="px-4 py-1.5 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)] disabled:opacity-40">{devBusy ? "Building…" : "Generate"}</button>
          </div>
          {devOut && <pre className="text-[10px] text-[var(--text)] whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-y-auto border border-[rgba(63,224,255,0.15)] p-2">{devOut}</pre>}
          {files.length > 0 && (
            <div className="mt-2 text-[10px] text-[var(--muted)] hud-text">{files.join(" · ")}</div>
          )}
        </section>
      </div>
    </main>
  );
}
