"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Worker { id: string; name: string; role: string; custom?: boolean }
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

  // Create / delete custom agents.
  const [na, setNa] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const createAgent = async () => {
    if (!na.name?.trim() || creating) return;
    setCreating(true);
    await fetch("/api/workforce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_agent", name: na.name, role: na.role, system: na.system }) });
    setNa({}); setCreating(false); load();
  };
  const delAgent = async (id: string) => { await fetch(`/api/workforce?agent=${id}`, { method: "DELETE" }); load(); };

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
                className={`relative text-left px-2 py-1.5 border text-[11px] ${sel === w.id ? "border-[var(--hud)] hud-glow" : "border-[rgba(63,224,255,0.15)]"}`}>
                <div className="text-[var(--text)]">{w.name}{w.custom && <span className="text-[8px] text-[var(--gold)] ml-1 uppercase">★</span>}</div>
                <div className="text-[9px] text-[var(--muted)] uppercase tracking-wide">{w.role}</div>
                {w.custom && <span onClick={(e) => { e.stopPropagation(); delAgent(w.id); }} className="absolute top-1 right-1 text-[var(--muted)] hover:text-[var(--bad)] text-[10px]">×</span>}
              </button>
            ))}
          </div>

          {/* Create your own agent */}
          <div className="border border-[rgba(255,194,75,0.3)] p-2 mb-3">
            <div className="label text-[var(--gold)] mb-1.5">＋ Create an agent</div>
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              <input className={F} placeholder="Name (e.g. Cleo)" value={na.name || ""} onChange={(e) => setNa({ ...na, name: e.target.value })} />
              <input className={F} placeholder="Role (e.g. SEO Specialist)" value={na.role || ""} onChange={(e) => setNa({ ...na, role: e.target.value })} />
            </div>
            <textarea className={`${F} w-full h-14 mb-1.5`} placeholder="Instructions / system prompt — what this agent does and how it behaves" value={na.system || ""} onChange={(e) => setNa({ ...na, system: e.target.value })} />
            <div className="flex justify-end"><button onClick={createAgent} disabled={creating || !na.name?.trim()} className="px-3 py-1 text-[10px] tracking-widest uppercase border border-[var(--gold)] text-[var(--gold)] disabled:opacity-40">{creating ? "Creating…" : "Create agent"}</button></div>
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
