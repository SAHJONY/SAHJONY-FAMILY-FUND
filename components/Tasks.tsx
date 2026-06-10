"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";

interface Task { id: string; text: string; due: string; priority: string; done: boolean }
const pc: Record<string, string> = { low: "var(--muted)", med: "var(--hud)", high: "var(--bad)" };

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [pri, setPri] = useState("med");

  const load = async () => setTasks((await (await fetch("/api/tasks", { cache: "no-store" })).json()).tasks ?? []);
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!text.trim()) return;
    await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, due, priority: pri }) });
    setText(""); setDue(""); load();
  };
  const toggle = async (t: Task) => { await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, done: !t.done }) }); load(); };
  const del = async (id: string) => { await fetch(`/api/tasks?id=${id}`, { method: "DELETE" }); load(); };

  const open = tasks.filter((t) => !t.done).length;
  return (
    <Panel title="Personal Tasks" badge={<span className="hud-text text-[9px] px-1.5 py-0.5 border tracking-widest" style={{ color: "var(--hud)", borderColor: "var(--hud)" }}>{open} OPEN</span>}>
      <div className="flex gap-1.5 mb-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Remind me to…" className="flex-1 bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="bg-transparent border border-[rgba(63,224,255,0.25)] px-1 py-1.5 text-[10px] text-[var(--muted)]" />
        <select value={pri} onChange={(e) => setPri(e.target.value)} className="bg-transparent border border-[rgba(63,224,255,0.25)] text-[10px] uppercase text-[var(--muted)] px-1">
          {["low", "med", "high"].map((p) => <option key={p} value={p} className="bg-[#040b16]">{p}</option>)}
        </select>
        <button onClick={add} className="px-2 text-[11px] border border-[var(--hud)] text-[var(--hud)]">+</button>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {tasks.length === 0 ? <span className="text-[11px] text-[var(--muted)]">Nothing scheduled, sir.</span> :
          tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-[11px]">
              <button onClick={() => toggle(t)} className="w-3 h-3 border flex-shrink-0" style={{ borderColor: pc[t.priority], background: t.done ? pc[t.priority] : "transparent" }} />
              <span className={`flex-1 ${t.done ? "line-through text-[var(--muted)]" : "text-[var(--text)]"}`}>{t.text}{t.due && <span className="text-[9px] text-[var(--gold)] ml-1">{t.due}</span>}</span>
              <button onClick={() => del(t.id)} className="text-[var(--muted)] hover:text-[var(--bad)]">×</button>
            </div>
          ))}
      </div>
    </Panel>
  );
}
