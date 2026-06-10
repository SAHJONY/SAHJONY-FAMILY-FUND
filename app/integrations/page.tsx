"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Integrations {
  bland: { connected: boolean; detail: string };
  googleVoice: { number: string | null; detail: string };
  propstream: { url: string; detail: string };
}

const F = "bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]";
const card = "hud-panel p-4";

export default function IntegrationsPage() {
  const [i, setI] = useState<Integrations | null>(null);
  useEffect(() => { fetch("/api/integrations", { cache: "no-store" }).then((r) => r.json()).then(setI); }, []);

  // Driving for dollars
  const [addr, setAddr] = useState({ address: "", city: "", state: "" });
  const [d4dMsg, setD4dMsg] = useState<string | null>(null);
  const mapsUrl = addr.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${addr.address} ${addr.city} ${addr.state}`)}` : "#";
  const logLead = async () => {
    if (!addr.address) return;
    await fetch("/api/wholesale/deals", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addr, state: addr.state.toUpperCase(), source: "off_market", status: "lead", motivation: "Driving for Dollars" }) });
    setD4dMsg(`Logged ${addr.address} as a lead.`); setAddr({ address: "", city: "", state: "" });
    setTimeout(() => setD4dMsg(null), 4000);
  };

  // Bland call
  const [call, setCall] = useState({ phone: "", task: "" });
  const [consent, setConsent] = useState(false);
  const [callMsg, setCallMsg] = useState<string | null>(null);
  const placeCall = async () => {
    setCallMsg("Placing…");
    const r = await fetch("/api/integrations/bland", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...call, consent }) });
    const j = await r.json();
    setCallMsg(r.ok ? `Call queued (id: ${j.data?.call_id ?? "ok"})` : (j.error ?? "Failed"));
  };

  // CSV import
  const [csv, setCsv] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const runImport = async () => {
    setImportMsg("Importing…");
    const r = await fetch("/api/wholesale/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }) });
    const j = await r.json();
    setImportMsg(r.ok ? `Imported ${j.imported} buyers.` : (j.error ?? "Failed"));
  };

  const Dot = ({ on }: { on: boolean }) => (
    <span className="inline-block w-2 h-2 rounded-full" style={{ background: on ? "var(--good)" : "var(--muted)", boxShadow: on ? "0 0 8px var(--good)" : "none" }} />
  );

  return (
    <main className="relative z-10 max-w-5xl mx-auto px-5 py-7">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl tracking-[0.2em] text-[var(--hud)]" style={{ textShadow: "0 0 14px rgba(63,224,255,0.5)" }}>
          INTEGRATIONS & TOOLS
        </h1>
        <div className="flex gap-2">
          <Link href="/deals" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--gold)] text-[var(--gold)]">◫ Deals</Link>
          <Link href="/" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--hud)] text-[var(--hud)]">← Control Plane</Link>
        </div>
      </div>

      <div className="hud-panel p-3 mb-5 text-[10px] text-[var(--muted)] leading-relaxed">
        Real connections only. Keys are set on the <Link href="/env" className="text-[var(--hud)]">env page</Link> and never shown here.
        No cold-list dialing, no harvested data — imports use lists you license and export yourself.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PropStream */}
        <section className={card}>
          <h2 className="label mb-2 text-[var(--gold)]">▸ PropStream</h2>
          <p className="text-[11px] text-[var(--muted)] mb-3">{i?.propstream.detail}</p>
          <a href={i?.propstream.url ?? "#"} target="_blank" rel="noreferrer"
            className="inline-block text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)]">
            Launch PropStream ↗
          </a>
          <p className="text-[9px] text-[var(--muted)] mt-2 uppercase tracking-wide">Pull cash-buyer & seller lists there → export CSV → import below.</p>
        </section>

        {/* Google Voice */}
        <section className={card}>
          <h2 className="label mb-2 text-[var(--gold)] flex items-center gap-2"><Dot on={!!i?.googleVoice.number} /> Google Voice</h2>
          <p className="text-[11px] text-[var(--muted)] mb-3">{i?.googleVoice.detail}</p>
          {i?.googleVoice.number ? (
            <a href={`tel:${i.googleVoice.number}`} className="text-[13px] hud-text text-[var(--hud)]">☎ {i.googleVoice.number}</a>
          ) : (
            <span className="text-[11px] text-[var(--muted)]">Set GOOGLE_VOICE_NUMBER on the env page.</span>
          )}
          <a href="https://voice.google.com" target="_blank" rel="noreferrer" className="block text-[10px] text-[var(--muted)] mt-2 underline">Open Google Voice ↗</a>
        </section>

        {/* Bland.ai */}
        <section className={card}>
          <h2 className="label mb-2 text-[var(--gold)] flex items-center gap-2"><Dot on={!!i?.bland.connected} /> Bland.ai · AI calls</h2>
          <p className="text-[11px] text-[var(--muted)] mb-3">{i?.bland.detail}</p>
          {i?.bland.connected ? (
            <div className="space-y-2">
              <input className={`${F} w-full`} placeholder="Phone (+1...)" value={call.phone} onChange={(e) => setCall({ ...call, phone: e.target.value })} />
              <textarea className={`${F} w-full h-16`} placeholder="What should SAHJONY say? (script/task)" value={call.task} onChange={(e) => setCall({ ...call, task: e.target.value })} />
              <label className="flex items-center gap-2 text-[10px] text-[var(--gold)]">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                I confirm this contact has a prior relationship / consent (no cold-list dialing).
              </label>
              <button onClick={placeCall} disabled={!consent} className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--hud)] text-[var(--hud)] disabled:opacity-40">Place single call</button>
              {callMsg && <div className="text-[11px] text-[var(--text)]">{callMsg}</div>}
            </div>
          ) : (
            <span className="text-[11px] text-[var(--muted)]">Set BLAND_API_KEY on the env page to connect.</span>
          )}
        </section>

        {/* Driving for Dollars */}
        <section className={card}>
          <h2 className="label mb-2 text-[var(--gold)]">▸ Driving for Dollars</h2>
          <p className="text-[11px] text-[var(--muted)] mb-3">Log a distressed property you spotted. Saves as a lead and opens it in Google Maps.</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input className={`${F} col-span-2`} placeholder="Address" value={addr.address} onChange={(e) => setAddr({ ...addr, address: e.target.value })} />
            <input className={F} placeholder="City" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
            <input className={F} placeholder="State" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={logLead} className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--good)] text-[var(--good)]">Log as lead</button>
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--hud)] text-[var(--hud)]">Open in Maps ↗</a>
          </div>
          {d4dMsg && <div className="text-[11px] text-[var(--good)] mt-2">{d4dMsg}</div>}
        </section>

        {/* CSV import */}
        <section className={`${card} md:col-span-2`}>
          <h2 className="label mb-2 text-[var(--gold)]">▸ Import cash buyers (CSV)</h2>
          <p className="text-[11px] text-[var(--muted)] mb-2">
            Header row required. Columns: <span className="hud-text text-[var(--hud)]">name,type,contact,markets,propertyTypes,minPrice,maxPrice,minBeds,maxRepairs,strategy,proofOfFunds</span>.
            Use <span className="hud-text">;</span> inside markets/propertyTypes. This imports lists YOU exported — no harvesting.
          </p>
          <textarea className={`${F} w-full h-28`} placeholder={"name,type,contact,markets,minPrice,maxPrice,proofOfFunds\nLone Star Capital,private_equity,acq@ls.com,Austin TX;Dallas TX,100000,400000,yes"}
            value={csv} onChange={(e) => setCsv(e.target.value)} />
          <div className="flex items-center gap-3 mt-2">
            <button onClick={runImport} className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--hud)] text-[var(--hud)]">Import</button>
            {importMsg && <span className="text-[11px] text-[var(--text)]">{importMsg}</span>}
          </div>
        </section>
      </div>
    </main>
  );
}
