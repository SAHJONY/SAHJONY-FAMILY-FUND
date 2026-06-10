"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const REPAIR_CATEGORIES = ["Roof", "HVAC", "Plumbing", "Electrical", "Kitchen", "Bathrooms", "Flooring", "Paint (int/ext)", "Windows", "Foundation", "Landscaping", "Permits/misc"];
const usd = (n: number) => "$" + Math.round(n || 0).toLocaleString();
const F = "bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]";

export default function CalcPage() {
  // Comps → ARV (real comps the user pulled from a licensed source)
  const [subjectSqft, setSubjectSqft] = useState("");
  const [comps, setComps] = useState([{ address: "", sqft: "", price: "" }]);
  const arv = useMemo(() => {
    const valid = comps.filter((c) => Number(c.sqft) > 0 && Number(c.price) > 0);
    if (!valid.length || !Number(subjectSqft)) return { perSqft: 0, arv: 0, used: 0 };
    const per = valid.reduce((s, c) => s + Number(c.price) / Number(c.sqft), 0) / valid.length;
    return { perSqft: Math.round(per), arv: Math.round(per * Number(subjectSqft)), used: valid.length };
  }, [comps, subjectSqft]);

  // Repair worksheet
  const [rep, setRep] = useState<Record<string, string>>({});
  const [contingency, setContingency] = useState("10");
  const repair = useMemo(() => {
    const subtotal = REPAIR_CATEGORIES.reduce((s, c) => s + (Number(rep[c]) || 0), 0);
    const cont = Math.round(subtotal * (Number(contingency) || 0) / 100);
    return { subtotal, cont, total: subtotal + cont };
  }, [rep, contingency]);

  const mao = Math.max(0, Math.round(arv.arv * 0.7 - repair.total));

  return (
    <main className="relative z-10 max-w-5xl mx-auto px-5 py-7">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl tracking-[0.2em] text-[var(--hud)]" style={{ textShadow: "0 0 14px rgba(63,224,255,0.5)" }}>DEAL CALCULATORS</h1>
        <Link href="/deals" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--gold)] text-[var(--gold)]">◫ Deals</Link>
      </div>
      <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide mb-5">Enter real comps and real repair scope — SAHJONY does the math. Nothing is estimated for you.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ARV */}
        <section className="hud-panel p-4">
          <h2 className="label mb-3 text-[var(--gold)]">▸ ARV from comps</h2>
          <input className={`${F} w-full mb-2`} placeholder="Subject square footage" value={subjectSqft} onChange={(e) => setSubjectSqft(e.target.value)} />
          {comps.map((c, i) => (
            <div key={i} className="grid grid-cols-6 gap-1.5 mb-1.5">
              <input className={`${F} col-span-3`} placeholder="Comp address" value={c.address} onChange={(e) => setComps(comps.map((x, j) => j === i ? { ...x, address: e.target.value } : x))} />
              <input className={`${F} col-span-1`} placeholder="sqft" value={c.sqft} onChange={(e) => setComps(comps.map((x, j) => j === i ? { ...x, sqft: e.target.value } : x))} />
              <input className={`${F} col-span-2`} placeholder="sale price" value={c.price} onChange={(e) => setComps(comps.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
            </div>
          ))}
          <button onClick={() => setComps([...comps, { address: "", sqft: "", price: "" }])} className="text-[10px] tracking-widest uppercase px-2 py-1 border border-[rgba(63,224,255,0.3)] text-[var(--hud)] mb-3">+ Add comp</button>
          <div className="border-t border-[rgba(63,224,255,0.15)] pt-2 text-[12px] space-y-1">
            <div className="flex justify-between"><span className="text-[var(--muted)]">Avg $/sqft ({arv.used} comps)</span><span className="hud-text">{usd(arv.perSqft)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--muted)]">Computed ARV</span><span className="hud-text text-[var(--good)] text-base">{usd(arv.arv)}</span></div>
          </div>
        </section>

        {/* Repairs */}
        <section className="hud-panel p-4">
          <h2 className="label mb-3 text-[var(--gold)]">▸ Repair estimate</h2>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {REPAIR_CATEGORIES.map((cat) => (
              <div key={cat} className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--muted)] w-24 truncate">{cat}</span>
                <input className={`${F} flex-1`} placeholder="$" value={rep[cat] || ""} onChange={(e) => setRep({ ...rep, [cat]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-[var(--muted)]">Contingency %</span>
            <input className={`${F} w-16`} value={contingency} onChange={(e) => setContingency(e.target.value)} />
          </div>
          <div className="border-t border-[rgba(63,224,255,0.15)] pt-2 text-[12px] space-y-1">
            <div className="flex justify-between"><span className="text-[var(--muted)]">Subtotal</span><span className="hud-text">{usd(repair.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--muted)]">+ Contingency</span><span className="hud-text">{usd(repair.cont)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--muted)]">Total repairs</span><span className="hud-text text-[var(--gold)] text-base">{usd(repair.total)}</span></div>
          </div>
        </section>
      </div>

      <div className="hud-panel p-4 mt-4 flex items-center justify-between">
        <span className="label text-[var(--muted)]">Max Allowable Offer (70% rule) = ARV×0.70 − repairs</span>
        <span className="hud-text text-2xl text-[var(--hud)]" style={{ textShadow: "0 0 10px rgba(63,224,255,0.5)" }}>{usd(mao)}</span>
      </div>
    </main>
  );
}
