"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Business {
  id: string; name: string; category: string; entityType: string; role: string;
  status: string; website: string; description: string; modules: string[];
}

const F = "bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]";
const statusColor: Record<string, string> = { active: "var(--good)", launching: "var(--hud)", paused: "var(--gold)", winding_down: "var(--bad)" };

export default function BusinessPage() {
  const [list, setList] = useState<Business[]>([]);
  const [b, setB] = useState<Record<string, string>>({ entityType: "LLC", status: "active", role: "Owner" });
  const [adding, setAdding] = useState(false);

  const load = async () => setList((await (await fetch("/api/business", { cache: "no-store" })).json()).businesses ?? []);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!b.name) return;
    // b.id present → backend updates that record; absent → creates a new one.
    await fetch("/api/business", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    setB({ entityType: "LLC", status: "active", role: "Owner" }); setAdding(false); load();
  };
  const editBiz = (biz: Business) => {
    setB({
      id: biz.id, name: biz.name, category: biz.category, entityType: biz.entityType,
      status: biz.status, role: biz.role, website: biz.website, description: biz.description,
    });
    setAdding(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const del = async (id: string) => { await fetch(`/api/business?id=${id}`, { method: "DELETE" }); load(); };

  return (
    <main className="relative z-10 max-w-5xl mx-auto px-5 py-7">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl tracking-[0.2em] text-[var(--hud)]" style={{ textShadow: "0 0 14px rgba(63,224,255,0.5)" }}>OPERATIONS HUB</h1>
        <div className="flex gap-2">
          <button onClick={() => { setB({ entityType: "LLC", status: "active", role: "Owner" }); setAdding(!adding); }} className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--gold)] text-[var(--gold)]">+ Business</button>
          <Link href="/" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--hud)] text-[var(--hud)]">← Control Plane</Link>
        </div>
      </div>
      <p className="text-[10px] text-[var(--muted)] tracking-[0.2em] uppercase mb-5">{list.length} {list.length === 1 ? "operation" : "operations"} under SAHJONY command</p>

      {adding && (
        <div className="hud-panel p-4 mb-5">
          <div className="label mb-3 text-[var(--gold)]">▸ {b.id ? "Edit business / operation" : "Register a business / operation"}</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input className={F} placeholder="Business name" value={b.name || ""} onChange={(e) => setB({ ...b, name: e.target.value })} />
            <input className={F} placeholder="Category (e.g. Consulting, E-commerce)" value={b.category || ""} onChange={(e) => setB({ ...b, category: e.target.value })} />
            <select className={F} value={b.entityType} onChange={(e) => setB({ ...b, entityType: e.target.value })}>
              {["LLC", "S-Corp", "C-Corp", "Sole Prop", "Partnership", "Nonprofit", "Other"].map((t) => <option key={t} className="bg-[#040b16]">{t}</option>)}
            </select>
            <select className={F} value={b.status} onChange={(e) => setB({ ...b, status: e.target.value })}>
              {["active", "launching", "paused", "winding_down"].map((s) => <option key={s} value={s} className="bg-[#040b16]">{s.replace("_", " ")}</option>)}
            </select>
            <input className={F} placeholder="Your role" value={b.role || ""} onChange={(e) => setB({ ...b, role: e.target.value })} />
            <input className={F} placeholder="Website" value={b.website || ""} onChange={(e) => setB({ ...b, website: e.target.value })} />
            <input className={`${F} col-span-2`} placeholder="What it does" value={b.description || ""} onChange={(e) => setB({ ...b, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setB({ entityType: "LLC", status: "active", role: "Owner" }); setAdding(false); }} className="px-4 py-1.5 text-[11px] tracking-widest uppercase border border-[var(--muted)] text-[var(--muted)]">Cancel</button>
            <button onClick={save} className="px-4 py-1.5 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)]">{b.id ? "Update" : "Save"}</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((biz) => (
          <section key={biz.id} className="hud-panel p-4">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-[15px] text-[var(--text)]">{biz.name}</h2>
              <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-widest" style={{ color: statusColor[biz.status] }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor[biz.status] }} />{biz.status.replace("_", " ")}
              </span>
            </div>
            <div className="text-[10px] text-[var(--gold)] uppercase tracking-wide mb-2">{biz.category} · {biz.entityType} · {biz.role}</div>
            {biz.description && <p className="text-[11px] text-[var(--muted)] leading-relaxed mb-2">{biz.description}</p>}
            {biz.website && <a href={biz.website} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--hud)] underline">{biz.website} ↗</a>}
            {biz.modules?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {biz.modules.map((m) => <span key={m} className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 border border-[rgba(63,224,255,0.2)] text-[var(--muted)]">{m}</span>)}
              </div>
            )}
            <div className="flex justify-end gap-1.5 mt-2">
              <button onClick={() => editBiz(biz)} className="text-[9px] uppercase tracking-widest px-2 py-0.5 border border-[var(--hud)] text-[var(--hud)]">edit</button>
              <button onClick={() => del(biz.id)} className="text-[9px] uppercase tracking-widest px-2 py-0.5 border border-[var(--bad)] text-[var(--bad)]">remove</button>
            </div>
          </section>
        ))}
      </div>

      <div className="hud-panel p-3 mt-5 text-[10px] text-[var(--muted)] leading-relaxed">
        Each business is a first-class entity under SAHJONY. Name any operation and I can wire its
        specific tools (its own pipeline, CRM segment, email identity, or workflows). Tell SAHJONY,
        for example: &ldquo;set up the storefront ops for [business]&rdquo;.
      </div>
    </main>
  );
}
