"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface EnvVar { key: string; value: string; masked: boolean }

export default function EnvPage() {
  const [vars, setVars] = useState<EnvVar[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch("/api/env", { cache: "no-store" });
    if (!r.ok) { setErr((await r.json()).error ?? "Unavailable"); return; }
    setErr(null);
    setVars((await r.json()).vars);
  };
  useEffect(() => { load(); }, []);

  const save = async (key: string, value: string) => {
    const r = await fetch("/api/env", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error); return; }
    setNote(j.note); setNewKey(""); setNewVal(""); load();
    setTimeout(() => setNote(null), 5000);
  };

  const del = async (key: string) => {
    await fetch(`/api/env?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    load();
  };

  return (
    <main className="relative z-10 max-w-3xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl tracking-[0.25em] text-[var(--hud)]"
          style={{ textShadow: "0 0 14px rgba(63,224,255,0.5)" }}>
          ENV · VARIABLES
        </h1>
        <Link href="/" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)]">
          ← Control Plane
        </Link>
      </div>

      <div className="hud-panel p-3 mb-5 text-[11px] text-[var(--gold)] leading-relaxed">
        ⚠ Local development only. Values are written as plaintext to <span className="hud-text">.env.local</span>,
        which is gitignored. Secrets are masked here and never sent back in full. Restart the
        dev server after changes. This page is disabled in production.
      </div>

      {err && <div className="hud-panel p-3 mb-5 text-[12px] text-[var(--bad)]">{err}</div>}
      {note && <div className="hud-panel p-3 mb-5 text-[12px] text-[var(--good)]">{note}</div>}

      <div className="hud-panel p-4 mb-5">
        <div className="label mb-3 text-[var(--muted)]">Add / update variable</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value.toUpperCase())}
            placeholder="KEY_NAME"
            className="flex-1 bg-transparent border border-[rgba(63,224,255,0.25)] px-3 py-2 text-[13px] hud-text text-[var(--text)] placeholder:text-[var(--muted)]" />
          <input value={newVal} onChange={(e) => setNewVal(e.target.value)}
            placeholder="value"
            className="flex-1 bg-transparent border border-[rgba(63,224,255,0.25)] px-3 py-2 text-[13px] hud-text text-[var(--text)] placeholder:text-[var(--muted)]" />
          <button onClick={() => newKey && save(newKey, newVal)}
            className="px-4 py-2 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)]">
            Save
          </button>
        </div>
      </div>

      <div className="hud-panel p-4">
        <div className="label mb-3 text-[var(--muted)]">Current ({vars.length})</div>
        {vars.length === 0 ? (
          <div className="text-[12px] text-[var(--muted)]">No variables set.</div>
        ) : (
          <div className="space-y-1.5">
            {vars.map((v) => (
              <div key={v.key} className="flex items-center justify-between gap-3 border border-[rgba(63,224,255,0.14)] px-3 py-2">
                <span className="hud-text text-[12px] text-[var(--hud)] truncate max-w-[40%]">{v.key}</span>
                <span className="hud-text text-[12px] text-[var(--muted)] truncate flex-1">
                  {v.value}{v.masked && <span className="text-[var(--gold)] ml-1">(secret)</span>}
                </span>
                <button onClick={() => del(v.key)}
                  className="text-[10px] tracking-widest uppercase px-2 py-1 border border-[var(--bad)] text-[var(--bad)] hover:bg-[rgba(255,93,93,0.1)]">
                  Del
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
