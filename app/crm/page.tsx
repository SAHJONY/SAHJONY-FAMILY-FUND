"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Contact { id: string; name: string; type: string; stage: string; phone: string; email: string; company: string; notes: string; dealAddress: string }
interface JV { id: string; dealAddress: string; partnerName: string; myRole: string; splitPct: number; totalFee: number; status: string; agreementNote: string; myCut: number }

const usd = (n: number) => "$" + (n || 0).toLocaleString();
const F = "bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]";
const stageColor: Record<string, string> = { new: "var(--muted)", contacted: "var(--hud)", negotiating: "var(--gold)", under_contract: "var(--gold)", closed: "var(--good)", dead: "var(--bad)" };

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jvs, setJvs] = useState<JV[]>([]);
  const [c, setC] = useState<Record<string, string>>({ type: "seller", stage: "new" });
  const [j, setJ] = useState<Record<string, string>>({ myRole: "dispo", splitPct: "50", status: "proposed" });

  const loadC = async () => setContacts((await (await fetch("/api/crm", { cache: "no-store" })).json()).contacts ?? []);
  const loadJ = async () => setJvs((await (await fetch("/api/jv", { cache: "no-store" })).json()).jvs ?? []);
  useEffect(() => { loadC(); loadJ(); }, []);

  const addC = async () => {
    if (!c.name) return;
    await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
    setC({ type: "seller", stage: "new" }); loadC();
  };
  const setStage = async (id: string, stage: string) => { await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, stage }) }); loadC(); };
  const delC = async (id: string) => { await fetch(`/api/crm?id=${id}`, { method: "DELETE" }); loadC(); };

  const addJ = async () => {
    if (!j.partnerName) return;
    await fetch("/api/jv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...j, splitPct: Number(j.splitPct) || 0, totalFee: Number(j.totalFee) || 0 }) });
    setJ({ myRole: "dispo", splitPct: "50", status: "proposed" }); loadJ();
  };
  const delJ = async (id: string) => { await fetch(`/api/jv?id=${id}`, { method: "DELETE" }); loadJ(); };

  const jvTotal = jvs.reduce((s, x) => s + (x.myCut || 0), 0);

  return (
    <main className="relative z-10 max-w-6xl mx-auto px-5 py-7">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl tracking-[0.2em] text-[var(--hud)]" style={{ textShadow: "0 0 14px rgba(63,224,255,0.5)" }}>CRM &amp; JOINT VENTURES</h1>
        <div className="flex gap-2">
          <Link href="/deals" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--gold)] text-[var(--gold)]">◫ Deals</Link>
          <Link href="/" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--hud)] text-[var(--hud)]">← Control Plane</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CRM */}
        <section className="hud-panel p-4">
          <h2 className="label mb-3 text-[var(--gold)]">▸ Native CRM · {contacts.length} contacts</h2>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input className={F} placeholder="Name" value={c.name || ""} onChange={(e) => setC({ ...c, name: e.target.value })} />
            <select className={F} value={c.type} onChange={(e) => setC({ ...c, type: e.target.value })}>
              {["seller", "buyer", "agent", "title", "contractor", "lender", "jv_partner", "other"].map((t) => <option key={t} value={t} className="bg-[#040b16]">{t}</option>)}
            </select>
            <input className={F} placeholder="Phone" value={c.phone || ""} onChange={(e) => setC({ ...c, phone: e.target.value })} />
            <input className={F} placeholder="Email" value={c.email || ""} onChange={(e) => setC({ ...c, email: e.target.value })} />
            <input className={F} placeholder="Company" value={c.company || ""} onChange={(e) => setC({ ...c, company: e.target.value })} />
            <input className={F} placeholder="Linked deal address" value={c.dealAddress || ""} onChange={(e) => setC({ ...c, dealAddress: e.target.value })} />
            <input className={`${F} col-span-2`} placeholder="Notes" value={c.notes || ""} onChange={(e) => setC({ ...c, notes: e.target.value })} />
          </div>
          <div className="flex justify-end mb-3"><button onClick={addC} className="px-4 py-1.5 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)]">+ Add contact</button></div>
          <div className="space-y-1.5 max-h-[460px] overflow-y-auto">
            {contacts.length === 0 ? <span className="text-[11px] text-[var(--muted)]">No contacts yet.</span> :
              contacts.map((ct) => (
                <div key={ct.id} className="border border-[rgba(63,224,255,0.15)] px-2 py-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text)]">{ct.name} <span className="text-[9px] text-[var(--gold)] uppercase ml-1">{ct.type.replace("_", " ")}</span></span>
                    <button onClick={() => delC(ct.id)} className="text-[var(--muted)] hover:text-[var(--bad)]">×</button>
                  </div>
                  <div className="text-[10px] text-[var(--muted)] hud-text">{[ct.phone, ct.email, ct.company, ct.dealAddress].filter(Boolean).join(" · ")}</div>
                  {ct.notes && <div className="text-[10px] text-[var(--muted)] mt-0.5">{ct.notes}</div>}
                  <select value={ct.stage} onChange={(e) => setStage(ct.id, e.target.value)} className="mt-1 bg-transparent border text-[9px] uppercase tracking-widest px-1 py-0.5" style={{ borderColor: stageColor[ct.stage], color: stageColor[ct.stage] }}>
                    {["new", "contacted", "negotiating", "under_contract", "closed", "dead"].map((s) => <option key={s} value={s} className="bg-[#040b16]">{s.replace("_", " ")}</option>)}
                  </select>
                </div>
              ))}
          </div>
        </section>

        {/* JV */}
        <section className="hud-panel p-4">
          <h2 className="label mb-3 text-[var(--gold)]">▸ Joint Ventures · your cut {usd(jvTotal)}</h2>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input className={`${F} col-span-2`} placeholder="Deal address" value={j.dealAddress || ""} onChange={(e) => setJ({ ...j, dealAddress: e.target.value })} />
            <input className={F} placeholder="JV partner" value={j.partnerName || ""} onChange={(e) => setJ({ ...j, partnerName: e.target.value })} />
            <select className={F} value={j.myRole} onChange={(e) => setJ({ ...j, myRole: e.target.value })}>
              {["dispo", "acquisition", "funding", "boots", "co-wholesale"].map((r) => <option key={r} value={r} className="bg-[#040b16]">{r}</option>)}
            </select>
            <input className={F} placeholder="Total fee $" value={j.totalFee || ""} onChange={(e) => setJ({ ...j, totalFee: e.target.value })} />
            <input className={F} placeholder="My split %" value={j.splitPct || ""} onChange={(e) => setJ({ ...j, splitPct: e.target.value })} />
            <input className={`${F} col-span-2`} placeholder="Agreement note (terms)" value={j.agreementNote || ""} onChange={(e) => setJ({ ...j, agreementNote: e.target.value })} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-[var(--muted)]">Your cut: <span className="text-[var(--good)] hud-text">{usd(Math.round((Number(j.totalFee) || 0) * (Number(j.splitPct) || 0) / 100))}</span></span>
            <button onClick={addJ} className="px-4 py-1.5 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)]">+ Add JV</button>
          </div>
          <div className="space-y-1.5 max-h-[460px] overflow-y-auto">
            {jvs.length === 0 ? <span className="text-[11px] text-[var(--muted)]">No joint ventures yet.</span> :
              jvs.map((jv) => (
                <div key={jv.id} className="border border-[rgba(63,224,255,0.15)] px-2 py-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text)]">{jv.partnerName} <span className="text-[9px] text-[var(--gold)] uppercase ml-1">{jv.myRole}</span></span>
                    <button onClick={() => delJ(jv.id)} className="text-[var(--muted)] hover:text-[var(--bad)]">×</button>
                  </div>
                  <div className="text-[10px] text-[var(--muted)] hud-text">{jv.dealAddress || "(no address)"}</div>
                  <div className="text-[10px] mt-0.5"><span className="text-[var(--muted)]">fee {usd(jv.totalFee)} · split {jv.splitPct}% → </span><span className="text-[var(--good)]">your cut {usd(jv.myCut)}</span><span className="text-[var(--gold)] ml-2 uppercase text-[9px]">{jv.status}</span></div>
                  {jv.agreementNote && <div className="text-[10px] text-[var(--muted)] mt-0.5">{jv.agreementNote}</div>}
                </div>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}
