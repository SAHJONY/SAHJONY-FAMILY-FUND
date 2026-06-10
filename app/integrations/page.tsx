"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Integrations {
  bland: { connected: boolean; detail: string };
  googleVoice: { number: string | null; detail: string };
  propstream: { url: string; detail: string };
  regrid?: { connected: boolean; detail: string };
  docusign?: { connected: boolean; detail: string };
  whatsapp?: { connected: boolean; detail: string };
}

const F = "bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]";
const card = "hud-panel p-4";

export default function IntegrationsPage() {
  const [i, setI] = useState<Integrations | null>(null);
  useEffect(() => { fetch("/api/integrations", { cache: "no-store" }).then((r) => r.json()).then(setI); }, []);

  // Email agent
  const [email, setEmail] = useState<any>(null);
  const [emTo, setEmTo] = useState(""); const [emPrompt, setEmPrompt] = useState("");
  const [emDraft, setEmDraft] = useState(""); const [emConsent, setEmConsent] = useState(false);
  const [emMsg, setEmMsg] = useState<string | null>(null);
  const [inbox, setInbox] = useState<any>(null);
  useEffect(() => { fetch("/api/email").then((r) => r.json()).then(setEmail); }, []);
  const draftEmail = async () => {
    setEmMsg("Drafting…");
    const j = await (await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "draft", to: emTo, prompt: emPrompt }) })).json();
    setEmDraft(j.draft ?? j.error ?? ""); setEmMsg(null);
  };
  const sendEmail = async () => {
    const lines = emDraft.split("\n");
    const subject = (lines[0].match(/^subject:\s*(.*)/i)?.[1]) ?? "(no subject)";
    const text = lines.slice(1).join("\n").trim() || emDraft;
    setEmMsg("Sending…");
    const j = await (await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: emTo, subject, text, consent: emConsent }) })).json();
    setEmMsg(j.ok ? "Sent ✓" : (j.error ?? "Failed"));
  };
  const loadInbox = async () => { setInbox({ loading: true }); setInbox(await (await fetch("/api/email/inbox", { cache: "no-store" })).json()); };

  // MLS
  const [mls, setMls] = useState<any>(null);
  const [mq, setMq] = useState<Record<string, string>>({});
  const [mlsRes, setMlsRes] = useState<any>(null);
  useEffect(() => { fetch("/api/mls").then((r) => r.json()).then(setMls); }, []);
  const searchMls = async () => {
    setMlsRes({ loading: true });
    setMlsRes(await (await fetch("/api/mls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ city: mq.city, state: mq.state, minPrice: Number(mq.minPrice) || 0, maxPrice: Number(mq.maxPrice) || 0, minBeds: Number(mq.minBeds) || 0 }) })).json());
  };

  // DocuSign + WhatsApp
  const [ds, setDs] = useState({ signerName: "", signerEmail: "", documentTitle: "" });
  const [dsMsg, setDsMsg] = useState<string | null>(null);
  const sendDs = async (mode: "email" | "embedded") => {
    setDsMsg("Sending…");
    const j = await (await fetch("/api/integrations/docusign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...ds, mode, consent: true }) })).json();
    setDsMsg(j.ok ? (j.signingUrl ? `Online signing: ${j.signingUrl}` : `Sent by email (envelope ${j.envelopeId})`) : (j.error ?? "Failed"));
  };
  const [wa, setWa] = useState({ to: "", text: "" });
  const [waMsg, setWaMsg] = useState<string | null>(null);
  const sendWa = async () => {
    setWaMsg("Sending…");
    const j = await (await fetch("/api/integrations/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...wa, consent: true }) })).json();
    setWaMsg(j.ok ? "Sent ✓" : (j.error ?? "Failed"));
  };

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
        {/* Email agent */}
        <section className={card}>
          <h2 className="label mb-2 text-[var(--gold)] flex items-center gap-2"><Dot on={!!email?.connected} /> Email agent</h2>
          <p className="text-[11px] text-[var(--muted)] mb-2">{email?.connected ? `Connected as ${email.from}` : "Set SMTP_HOST/USER/PASS (+ IMAP_* to read) on the env page."}</p>
          <input className={`${F} w-full mb-1.5`} placeholder="To" value={emTo} onChange={(e) => setEmTo(e.target.value)} />
          <input className={`${F} w-full mb-1.5`} placeholder="What's the email about? (SAHJONY drafts it)" value={emPrompt} onChange={(e) => setEmPrompt(e.target.value)} />
          <div className="flex gap-2 mb-2">
            <button onClick={draftEmail} className="text-[10px] tracking-widest uppercase px-3 py-1 border border-[var(--hud)] text-[var(--hud)]">Draft</button>
            <button onClick={loadInbox} className="text-[10px] tracking-widest uppercase px-3 py-1 border border-[rgba(63,224,255,0.3)] text-[var(--muted)]">Read inbox</button>
          </div>
          {emDraft && <textarea className={`${F} w-full h-24 mb-1`} value={emDraft} onChange={(e) => setEmDraft(e.target.value)} />}
          {emDraft && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] text-[var(--gold)]"><input type="checkbox" checked={emConsent} onChange={(e) => setEmConsent(e.target.checked)} /> Confirm send</label>
              <button onClick={sendEmail} disabled={!emConsent} className="text-[10px] tracking-widest uppercase px-3 py-1 border border-[var(--good)] text-[var(--good)] disabled:opacity-40">Send</button>
              {emMsg && <span className="text-[10px] text-[var(--text)]">{emMsg}</span>}
            </div>
          )}
          {inbox?.messages && (
            <div className="mt-2 space-y-0.5 max-h-32 overflow-y-auto text-[10px]">
              {inbox.messages.map((m: any, k: number) => <div key={k} className="text-[var(--muted)] truncate"><span className="text-[var(--hud)]">{m.fromName || m.from}</span> — {m.subject}</div>)}
            </div>
          )}
          {inbox?.detail && <div className="text-[10px] text-[var(--muted)] mt-1">{inbox.detail}</div>}
        </section>

        {/* MLS */}
        <section className={card}>
          <h2 className="label mb-2 text-[var(--gold)] flex items-center gap-2"><Dot on={!!mls?.connected} /> MLS (RESO Web API)</h2>
          <p className="text-[11px] text-[var(--muted)] mb-2">{mls?.connected ? "Licensed MLS feed connected." : "No free MLS API exists. Add your licensed MLS_RESO_URL + MLS_RESO_TOKEN on the env page; until then, public on-market searches below."}</p>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <input className={F} placeholder="City" value={mq.city || ""} onChange={(e) => setMq({ ...mq, city: e.target.value })} />
            <input className={F} placeholder="State" value={mq.state || ""} onChange={(e) => setMq({ ...mq, state: e.target.value })} />
            <input className={F} placeholder="Min beds" value={mq.minBeds || ""} onChange={(e) => setMq({ ...mq, minBeds: e.target.value })} />
            <input className={F} placeholder="Min $" value={mq.minPrice || ""} onChange={(e) => setMq({ ...mq, minPrice: e.target.value })} />
            <input className={F} placeholder="Max $" value={mq.maxPrice || ""} onChange={(e) => setMq({ ...mq, maxPrice: e.target.value })} />
            <button onClick={searchMls} className="text-[10px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)]">Find</button>
          </div>
          {mlsRes?.listings && (
            <div className="space-y-0.5 max-h-40 overflow-y-auto text-[10px]">
              {mlsRes.listings.length === 0 ? <span className="text-[var(--muted)]">No active listings.</span> :
                mlsRes.listings.map((l: any, k: number) => <div key={k} className="flex justify-between hud-text"><span className="text-[var(--text)] truncate">{l.address}, {l.city}</span><span className="text-[var(--good)]">${(l.price || 0).toLocaleString()}</span></div>)}
            </div>
          )}
          {mlsRes?.publicSearches && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {mlsRes.publicSearches.map((s: any) => <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="text-[10px] px-2 py-1 border border-[rgba(63,224,255,0.3)] text-[var(--hud)]">{s.label} ↗</a>)}
            </div>
          )}
          {mlsRes?.detail && <div className="text-[10px] text-[var(--muted)] mt-1">{mlsRes.detail}</div>}
        </section>

        {/* DocuSign */}
        <section className={card}>
          <h2 className="label mb-2 text-[var(--gold)] flex items-center gap-2"><Dot on={!!i?.docusign?.connected} /> DocuSign · e-sign</h2>
          <p className="text-[11px] text-[var(--muted)] mb-2">{i?.docusign?.detail}</p>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <input className={F} placeholder="Signer name" value={ds.signerName} onChange={(e) => setDs({ ...ds, signerName: e.target.value })} />
            <input className={F} placeholder="Signer email" value={ds.signerEmail} onChange={(e) => setDs({ ...ds, signerEmail: e.target.value })} />
            <input className={`${F} col-span-2`} placeholder="Document title / deal address" value={ds.documentTitle} onChange={(e) => setDs({ ...ds, documentTitle: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => sendDs("email")} className="text-[10px] tracking-widest uppercase px-3 py-1 border border-[var(--good)] text-[var(--good)]">Send by email</button>
            <button onClick={() => sendDs("embedded")} className="text-[10px] tracking-widest uppercase px-3 py-1 border border-[var(--hud)] text-[var(--hud)]">Sign online</button>
          </div>
          {dsMsg && <div className="text-[10px] text-[var(--text)] mt-2 break-all">{dsMsg}</div>}
        </section>

        {/* WhatsApp */}
        <section className={card}>
          <h2 className="label mb-2 text-[var(--gold)] flex items-center gap-2"><Dot on={!!i?.whatsapp?.connected} /> WhatsApp</h2>
          <p className="text-[11px] text-[var(--muted)] mb-2">{i?.whatsapp?.detail}</p>
          <input className={`${F} w-full mb-1.5`} placeholder="To (phone, digits)" value={wa.to} onChange={(e) => setWa({ ...wa, to: e.target.value })} />
          <textarea className={`${F} w-full h-16 mb-2`} placeholder="Message (opt-in contacts only)" value={wa.text} onChange={(e) => setWa({ ...wa, text: e.target.value })} />
          <button onClick={sendWa} className="text-[10px] tracking-widest uppercase px-3 py-1 border border-[var(--good)] text-[var(--good)]">Send</button>
          {waMsg && <span className="text-[10px] text-[var(--text)] ml-2">{waMsg}</span>}
        </section>

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
