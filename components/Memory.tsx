"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";

interface Memory { id: string; text: string; tag: string; createdAt: number }

export default function Memory() {
  const [mems, setMems] = useState<Memory[]>([]);
  const [text, setText] = useState("");
  const [tag, setTag] = useState("owner");

  const load = async () => {
    const r = await fetch("/api/memory", { cache: "no-store" });
    setMems((await r.json()).memories ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!text.trim()) return;
    await fetch("/api/memory", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tag }),
    });
    setText(""); load();
  };
  const del = async (id: string) => {
    await fetch(`/api/memory?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <Panel
      title="Persistent Memory"
      badge={<span className="hud-text text-[9px] px-1.5 py-0.5 border tracking-widest"
        style={{ color: "var(--good)", borderColor: "var(--good)" }}>{mems.length} RETAINED</span>}
    >
      <div className="flex gap-2 mb-2">
        <input value={tag} onChange={(e) => setTag(e.target.value)}
          className="w-20 bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[11px] hud-text text-[var(--gold)]" />
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Teach SAHJONY a fact to remember…"
          className="flex-1 bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]" />
        <button onClick={add}
          className="px-3 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)]">+</button>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {mems.length === 0 ? (
          <span className="text-[11px] text-[var(--muted)]">Nothing retained yet, sir.</span>
        ) : (
          mems.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-2 text-[11px] border-l-2 border-[var(--hud-dim)] pl-2 py-0.5">
              <span>
                <span className="text-[var(--gold)] mr-1">[{m.tag}]</span>
                <span className="text-[var(--text)]">{m.text}</span>
              </span>
              <button onClick={() => del(m.id)} className="text-[var(--muted)] hover:text-[var(--bad)]">×</button>
            </div>
          ))
        )}
      </div>
      <p className="text-[9px] text-[var(--muted)] mt-2 tracking-wide uppercase">
        Auto-recalled into every conversation · persists across restarts
      </p>
    </Panel>
  );
}
