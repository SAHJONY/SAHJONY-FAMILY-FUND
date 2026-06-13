"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PropertyIntel from "@/components/PropertyIntel";
import CashBuyerFinder from "@/components/CashBuyerFinder";

interface Analysis { mao: number; equitySpread: number; projectedFee: number; buyerAllIn: number; buyerMarginToArv: number; passes70: boolean; grade: string; maoRulePct: number }
interface Deal {
  id: string; address: string; city: string; state: string; propertyType: string;
  beds: number; baths: number; sqft: number; arv: number; estRepairs: number;
  listPrice: number; contractPrice: number; desiredFee: number; source: string;
  status: string; motivation: string; notes: string; analysis: Analysis;
}
interface Buyer {
  id: string; name: string; type: string; contact: string; proofOfFunds: boolean; active: boolean;
  box: { markets: string[]; propertyTypes: string[]; minPrice: number; maxPrice: number; minBeds: number; maxRepairs: number; strategy: string };
}
interface Match { buyer: Buyer; score: number; reasons: string[] }

const usd = (n: number) => "$" + (n || 0).toLocaleString();
const gradeColor: Record<string, string> = { A: "var(--good)", B: "var(--hud)", C: "var(--gold)", D: "var(--bad)" };

function num(v: string) { return Number(v.replace(/[^0-9.-]/g, "")) || 0; }

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [ai, setAi] = useState<string | null>(null);

  const [kpis, setKpis] = useState<any>(null);
  const [dispo, setDispo] = useState<{ id: string; text: string } | null>(null);
  const loadDeals = async () => setDeals((await (await fetch("/api/wholesale/deals", { cache: "no-store" })).json()).deals ?? []);
  const loadBuyers = async () => setBuyers((await (await fetch("/api/wholesale/buyers", { cache: "no-store" })).json()).buyers ?? []);
  const loadKpis = async () => setKpis(await (await fetch("/api/wholesale/kpis", { cache: "no-store" })).json());
  useEffect(() => { loadDeals(); loadBuyers(); loadKpis(); }, []);

  const openContract = async (dealId: string) => {
    const r = await fetch("/api/wholesale/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId }) });
    const html = await r.text();
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };
  const draftDispo = async (dealId: string) => {
    setDispo({ id: dealId, text: "Drafting…" });
    const r = await fetch("/api/wholesale/dispo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId }) });
    const j = await r.json();
    setDispo({ id: dealId, text: j.email ?? j.error ?? "No draft." });
  };

  useEffect(() => {
    if (!sel) { setMatches([]); return; }
    fetch(`/api/wholesale/buyers?matchDeal=${sel}`).then((r) => r.json()).then((j) => setMatches(j.matches ?? []));
  }, [sel, buyers, deals]);

  // ---- add deal form ----
  const [d, setD] = useState<Record<string, string>>({ propertyType: "SFR", source: "off_market", status: "lead", desiredFee: "10000" });
  const setDF = (k: string) => (e: any) => setD({ ...d, [k]: e.target.value });
  const liveMao = useMemo(() => {
    const arv = num(d.arv || "0"), rep = num(d.estRepairs || "0"), fee = num(d.desiredFee || "0");
    return Math.max(0, Math.round(arv * 0.7 - rep - fee));
  }, [d.arv, d.estRepairs, d.desiredFee]);

  const addDeal = async () => {
    if (!d.address) return;
    await fetch("/api/wholesale/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      address: d.address, city: d.city || "", state: (d.state || "").toUpperCase(), propertyType: d.propertyType,
      beds: num(d.beds), baths: num(d.baths), sqft: num(d.sqft), arv: num(d.arv), estRepairs: num(d.estRepairs),
      listPrice: num(d.listPrice), contractPrice: num(d.contractPrice), desiredFee: num(d.desiredFee),
      source: d.source, status: d.status, motivation: d.motivation || "",
    }) });
    setD({ propertyType: "SFR", source: "off_market", status: "lead", desiredFee: "10000" }); loadDeals();
  };
  const delDeal = async (id: string) => { await fetch(`/api/wholesale/deals?id=${id}`, { method: "DELETE" }); if (sel === id) setSel(null); loadDeals(); };
  const setStatus = async (id: string, status: string) => { await fetch("/api/wholesale/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }); loadDeals(); };

  // ---- ONE-FIELD AUTONOMOUS ADD: type only the address, Hermes sources it ----
  const [quickAddr, setQuickAddr] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickMsg, setQuickMsg] = useState<string | null>(null);
  const autonomousAdd = async () => {
    if (!quickAddr.trim() || quickBusy) return;
    setQuickBusy(true); setQuickMsg("Hermes is sourcing the deal…");
    try {
      const r = await fetch("/api/wholesale/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: quickAddr, autoCreate: true }) });
      const j = await r.json();
      if (j.createdDeal) {
        setQuickMsg(`✓ Created ${j.createdDeal.address}, ${j.createdDeal.city} ${j.createdDeal.state} · auto-filled: ${(j.autoFilled || []).join(", ") || "—"}. Still needs: ${(j.needs || []).join(", ") || "nothing"}.`);
        setQuickAddr(""); loadDeals();
      } else {
        setQuickMsg(j.error || j.geoDetail || "Could not source that address.");
      }
    } catch (e) { setQuickMsg((e as Error).message); }
    setQuickBusy(false);
  };

  // ---- autonomous enrichment: you give the address, SAHJONY finds the data ----
  const [enrich, setEnrich] = useState<any>(null);
  const [enrichBusy, setEnrichBusy] = useState(false);
  const autoFind = async () => {
    if (!d.address) return;
    setEnrichBusy(true); setEnrich(null);
    const r = await fetch("/api/wholesale/enrich", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: d.address, apn: d.apn, arv: num(d.arv), estRepairs: num(d.estRepairs), contractPrice: num(d.contractPrice), desiredFee: num(d.desiredFee) }) });
    const j = await r.json();
    setEnrich(j);
    // Auto-fill verified fields from real geocode.
    if (j.matched) {
      const norm = j.fields.normalizedAddress?.value as string | undefined;
      const parts = norm?.split(",").map((s: string) => s.trim()) ?? [];
      setD((prev) => ({ ...prev,
        address: parts[0] || prev.address,
        city: parts[1] || prev.city,
        state: (j.fields.state?.value as string) || prev.state,
      }));
    }
    setEnrichBusy(false);
  };

  // ---- photo → address (reads GPS from a photo you took) ----
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const onPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      setPhotoMsg("Reading photo GPS…");
      const r = await fetch("/api/wholesale/photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: reader.result }) });
      const j = await r.json();
      if (j.located) {
        setD((prev) => ({ ...prev, address: j.address?.split(",")[0] || prev.address, city: j.city || prev.city, state: j.state || prev.state }));
        setPhotoMsg(`Located: ${j.address}`);
        setTimeout(() => autoFind(), 300);
      } else {
        setPhotoMsg(j.detail);
      }
    };
    reader.readAsDataURL(file);
  };

  // ---- add buyer form ----
  const [b, setB] = useState<Record<string, string>>({ type: "individual", strategy: "flip" });
  const setBF = (k: string) => (e: any) => setB({ ...b, [k]: e.target.value });
  const addBuyer = async () => {
    if (!b.name) return;
    await fetch("/api/wholesale/buyers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      name: b.name, type: b.type, contact: b.contact || "", proofOfFunds: b.proofOfFunds === "yes",
      box: {
        markets: (b.markets || "").split(",").map((s) => s.trim()).filter(Boolean),
        propertyTypes: (b.propertyTypes || "").split(",").map((s) => s.trim()).filter(Boolean),
        minPrice: num(b.minPrice), maxPrice: num(b.maxPrice), minBeds: num(b.minBeds), maxRepairs: num(b.maxRepairs), strategy: b.strategy,
      },
    }) });
    setB({ type: "individual", strategy: "flip" }); loadBuyers();
  };
  const delBuyer = async (id: string) => { await fetch(`/api/wholesale/buyers?id=${id}`, { method: "DELETE" }); loadBuyers(); };

  const selectedDeal = deals.find((x) => x.id === sel);

  const analyzeWithAI = async () => {
    if (!selectedDeal) return;
    setAiBusy(true); setAi(null);
    const a = selectedDeal.analysis;
    const prompt = `You are SAHJONY, acquisitions analyst for SAHJONY CAPITAL LLC (real estate wholesaling). Analyze this deal in 4-6 concise sentences: is the spread strong, what assignment fee is realistic, and what is the single best next step? Be direct.
Deal: ${selectedDeal.address}, ${selectedDeal.city} ${selectedDeal.state}. ${selectedDeal.propertyType}, ${selectedDeal.beds}bd/${selectedDeal.baths}ba ${selectedDeal.sqft}sqft.
ARV ${usd(selectedDeal.arv)}, repairs ${usd(selectedDeal.estRepairs)}, list ${usd(selectedDeal.listPrice)}, under contract ${usd(selectedDeal.contractPrice)}.
Computed: MAO(70%) ${usd(a.mao)}, equity spread ${usd(a.equitySpread)}, buyer all-in ${usd(a.buyerAllIn)}, buyer margin to ARV ${usd(a.buyerMarginToArv)}, grade ${a.grade}.
Matched buyers in network: ${matches.length}.`;
    try {
      const r = await fetch("/api/llm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }) });
      const j = await r.json();
      setAi(j?.choices?.[0]?.message?.content ?? j?.message ?? "No response.");
    } catch (e) { setAi((e as Error).message); }
    setAiBusy(false);
  };

  const genContract = async () => {
    if (!selectedDeal) return;
    const res = await fetch("/api/wholesale/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealId: selectedDeal.id }) });
    const html = await res.text();
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const pipeline = useMemo(() => {
    const fees = deals.filter((x) => x.status === "assigned" || x.status === "under_contract").reduce((s, x) => s + (x.desiredFee || 0), 0);
    return { count: deals.length, buyers: buyers.length, projFees: fees };
  }, [deals, buyers]);

  const F = "bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]";

  return (
    <main className="relative z-10 max-w-7xl mx-auto px-5 py-7">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl tracking-[0.2em] text-[var(--hud)]" style={{ textShadow: "0 0 14px rgba(63,224,255,0.5)" }}>
          SAHJONY CAPITAL LLC
        </h1>
        <div className="flex gap-2">
          <Link href="/calc" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[rgba(63,224,255,0.4)] text-[var(--muted)] hover:text-[var(--hud)]">∑ Calc</Link>
          <Link href="/crm" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[rgba(255,194,75,0.4)] text-[var(--gold)]">⊞ CRM</Link>
          <Link href="/integrations" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[rgba(63,224,255,0.4)] text-[var(--muted)] hover:text-[var(--hud)]">⚇ Tools</Link>
          <a href="/api/wholesale/export" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[rgba(63,224,255,0.4)] text-[var(--muted)] hover:text-[var(--hud)]">⬇ Backup</a>
          <Link href="/" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)]">← Control</Link>
        </div>
      </div>
      <p className="text-[10px] text-[var(--muted)] tracking-[0.2em] uppercase mb-5">
        Wholesaling deal desk · {pipeline.count} deals · {pipeline.buyers} buyers · projected fees {usd(pipeline.projFees)}
      </p>

      {kpis && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
          {[
            { l: "Deals", v: kpis.totals?.deals ?? 0 },
            { l: "Buyers", v: kpis.totals?.buyers ?? 0 },
            { l: "Projected fees", v: "$" + (kpis.projectedFees ?? 0).toLocaleString() },
            { l: "Closed fees", v: "$" + (kpis.closedFees ?? 0).toLocaleString() },
            { l: "JV cut", v: "$" + (kpis.jvCut ?? 0).toLocaleString() },
            { l: "Conversion", v: (kpis.conversionPct ?? 0) + "%" },
          ].map((k) => (
            <div key={k.l} className="hud-panel p-2 text-center">
              <div className="hud-text text-[15px] text-[var(--hud)]">{k.v}</div>
              <div className="text-[9px] text-[var(--muted)] uppercase tracking-widest">{k.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* ONE-FIELD AUTONOMOUS ADD */}
      <div className="hud-panel hud-glow p-4 mb-4">
        <div className="label mb-2 text-[var(--gold)]">⚡ Autonomous add — type only the address</div>
        <div className="flex gap-2">
          <input value={quickAddr} onChange={(e) => setQuickAddr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && autonomousAdd()}
            placeholder="e.g. 1100 Congress Ave, Austin, TX — Hermes sources the rest"
            className="flex-1 bg-transparent border border-[rgba(255,194,75,0.4)] px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--muted)]" />
          <button onClick={autonomousAdd} disabled={quickBusy || !quickAddr.trim()}
            className="px-5 text-[11px] tracking-widest uppercase border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.1)] disabled:opacity-40">
            {quickBusy ? "Sourcing…" : "⚡ Source it"}
          </button>
        </div>
        {quickMsg && <div className="text-[11px] text-[var(--muted)] mt-2 leading-relaxed">{quickMsg}</div>}
        <div className="text-[9px] text-[var(--muted)] mt-1 uppercase tracking-wide">Census-verified location + parcel data (Regrid) auto-filled. ARV/repairs need real comps — never invented.</div>
      </div>

      <PropertyIntel />

      <div className="hud-panel p-3 mb-5 text-[10px] text-[var(--muted)] leading-relaxed">
        Contacts are your own CRM data. No skip-tracing or scraped personal info; no automated cold-call/text blasting
        (TCPA/DNC). Confirm wholesaling licensing & contract-assignment rules for each jurisdiction you operate in.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DEALS */}
        <section className="hud-panel p-4">
          <h2 className="label mb-3 text-[var(--gold)]">▸ Deals & analyzer</h2>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input className={`${F} col-span-2`} placeholder="Address — then click Auto-find" value={d.address || ""} onChange={setDF("address")} />
            <input className={F} placeholder="APN / parcel (optional)" value={d.apn || ""} onChange={setDF("apn")} />
            <button type="button" onClick={autoFind} disabled={enrichBusy || !d.address}
              className="text-[11px] tracking-widest uppercase border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.08)] disabled:opacity-40">
              {enrichBusy ? "Finding…" : "⌖ Auto-find data"}
            </button>
            <label className="col-span-2 text-[10px] tracking-widest uppercase border border-[rgba(63,224,255,0.3)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.08)] px-2 py-1.5 cursor-pointer text-center">
              ◎ Photo → address (uses the GPS in your photo)
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
            </label>
            {photoMsg && <div className="col-span-2 text-[10px] text-[var(--muted)]">{photoMsg}</div>}
            <input className={F} placeholder="City" value={d.city || ""} onChange={setDF("city")} />
            <input className={F} placeholder="State (TX)" value={d.state || ""} onChange={setDF("state")} />
            <select className={F} value={d.propertyType} onChange={setDF("propertyType")}>
              {["SFR", "Multi", "Condo", "Townhouse", "Land", "Mobile"].map((t) => <option key={t} className="bg-[#040b16]">{t}</option>)}
            </select>
            <select className={F} value={d.source} onChange={setDF("source")}>
              <option value="off_market" className="bg-[#040b16]">Off-market</option>
              <option value="fsbo" className="bg-[#040b16]">FSBO</option>
              <option value="on_market" className="bg-[#040b16]">On-market</option>
            </select>
            <input className={F} placeholder="Beds" value={d.beds || ""} onChange={setDF("beds")} />
            <input className={F} placeholder="Baths" value={d.baths || ""} onChange={setDF("baths")} />
            <input className={F} placeholder="ARV $" value={d.arv || ""} onChange={setDF("arv")} />
            <input className={F} placeholder="Est. repairs $" value={d.estRepairs || ""} onChange={setDF("estRepairs")} />
            <input className={F} placeholder="List $" value={d.listPrice || ""} onChange={setDF("listPrice")} />
            <input className={F} placeholder="Contract $" value={d.contractPrice || ""} onChange={setDF("contractPrice")} />
            <input className={F} placeholder="Desired fee $" value={d.desiredFee || ""} onChange={setDF("desiredFee")} />
            <input className={`${F} col-span-2`} placeholder="Seller motivation" value={d.motivation || ""} onChange={setDF("motivation")} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-[var(--muted)]">Live MAO (70%): <span className="text-[var(--good)] hud-text">{usd(liveMao)}</span></span>
            <button onClick={addDeal} className="px-4 py-1.5 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)]">+ Add deal</button>
          </div>

          {enrich && (
            <div className="border border-[rgba(255,194,75,0.3)] p-2 mb-3 text-[11px] space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: enrich.matched ? "var(--good)" : "var(--bad)" }} />
                <span className="text-[var(--text)]">{enrich.geoDetail}</span>
              </div>
              {enrich.matched && (
                <div className="hud-text text-[10px] text-[var(--muted)]">
                  {enrich.fields.normalizedAddress?.value} · {enrich.fields.county?.value} · tract {enrich.fields.censusTract?.value}
                  <span className="text-[var(--good)] ml-1">[census-verified]</span>
                </div>
              )}
              {enrich.regrid?.connected && !enrich.regrid.error && (enrich.regrid.owner || enrich.regrid.apn || enrich.regrid.assessedValue) && (
                <div className="border border-[rgba(70,244,176,0.3)] p-1.5">
                  <div className="label text-[var(--good)] mb-1">Regrid parcel [licensed · real]</div>
                  <div className="hud-text text-[10px] text-[var(--text)] grid grid-cols-2 gap-x-3">
                    {enrich.regrid.owner && <span>Owner: {enrich.regrid.owner}</span>}
                    {enrich.regrid.apn && <span>APN: {enrich.regrid.apn}</span>}
                    {enrich.regrid.assessedValue && <span>Assessed: ${Number(enrich.regrid.assessedValue).toLocaleString()}</span>}
                    {enrich.regrid.yearBuilt && <span>Built: {enrich.regrid.yearBuilt}</span>}
                  </div>
                </div>
              )}
              {enrich.regrid && !enrich.regrid.connected && (
                <div className="text-[10px] text-[var(--muted)]">{enrich.regrid.detail}</div>
              )}
              <div>
                <div className="label text-[var(--muted)] mb-1">Authoritative sources (ARV / comps / owner)</div>
                <div className="flex flex-wrap gap-1.5">
                  {enrich.sources?.map((s: any) => (
                    <a key={s.label} href={s.url} target="_blank" rel="noreferrer" title={s.note}
                      className="text-[10px] px-2 py-1 border border-[rgba(63,224,255,0.3)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)]">{s.label} ↗</a>
                  ))}
                </div>
              </div>
              <div>
                <div className="label text-[var(--muted)] mb-1">Public &amp; court records (due diligence)</div>
                <div className="flex flex-wrap gap-1.5">
                  {enrich.records?.map((s: any) => (
                    <a key={s.label} href={s.url} target="_blank" rel="noreferrer" title={s.note}
                      className="text-[10px] px-2 py-1 border border-[rgba(255,194,75,0.3)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.1)]">{s.label} ↗</a>
                  ))}
                </div>
              </div>
              {enrich.analysis && <div className="border-t border-[rgba(255,194,75,0.2)] pt-2 text-[var(--text)] leading-relaxed">{enrich.analysis}</div>}
              <div className="text-[9px] text-[var(--muted)] uppercase tracking-wide">{enrich.note}</div>
            </div>
          )}

          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {deals.length === 0 ? <span className="text-[11px] text-[var(--muted)]">No deals yet.</span> :
              deals.map((dl) => (
                <div key={dl.id} onClick={() => setSel(dl.id)}
                  className={`border p-2 cursor-pointer ${sel === dl.id ? "border-[var(--hud)] hud-glow" : "border-[rgba(63,224,255,0.15)]"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--text)] truncate">{dl.address || "(no address)"}</span>
                    <span className="text-[11px] font-bold px-1.5" style={{ color: gradeColor[dl.analysis.grade] }}>{dl.analysis.grade}</span>
                  </div>
                  <div className="text-[10px] text-[var(--muted)] hud-text">{dl.city} {dl.state} · {dl.propertyType} · {dl.source.replace("_", "-")}</div>
                  <div className="grid grid-cols-3 gap-1 mt-1 text-[10px] hud-text">
                    <span className="text-[var(--muted)]">ARV <span className="text-[var(--text)]">{usd(dl.arv)}</span></span>
                    <span className="text-[var(--muted)]">MAO <span className="text-[var(--hud)]">{usd(dl.analysis.mao)}</span></span>
                    <span className="text-[var(--muted)]">Fee <span className="text-[var(--good)]">{usd(dl.desiredFee)}</span></span>
                    <span className="text-[var(--muted)]">Spread <span className="text-[var(--text)]">{usd(dl.analysis.equitySpread)}</span></span>
                    <span className="text-[var(--muted)]">B.margin <span className="text-[var(--text)]">{usd(dl.analysis.buyerMarginToArv)}</span></span>
                    <span className="text-[var(--muted)]">70% <span style={{ color: dl.analysis.passes70 ? "var(--good)" : "var(--bad)" }}>{dl.analysis.passes70 ? "PASS" : "—"}</span></span>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                    <select value={dl.status} onChange={(e) => setStatus(dl.id, e.target.value)} className="bg-transparent border border-[rgba(63,224,255,0.2)] text-[9px] uppercase tracking-widest text-[var(--muted)] px-1 py-0.5">
                      {["lead", "under_contract", "assigned", "closed", "dead"].map((s) => <option key={s} value={s} className="bg-[#040b16]">{s.replace("_", " ")}</option>)}
                    </select>
                    <button onClick={() => openContract(dl.id)} className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-[var(--hud)] text-[var(--hud)]">contract</button>
                    <button onClick={() => draftDispo(dl.id)} className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-[var(--gold)] text-[var(--gold)]">dispo</button>
                    <button onClick={() => delDeal(dl.id)} className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-[var(--bad)] text-[var(--bad)]">del</button>
                  </div>
                  {dispo?.id === dl.id && (
                    <div className="mt-2 border border-[rgba(255,194,75,0.3)] p-2 text-[11px] text-[var(--text)] whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
                      {dispo.text}
                      <div className="text-[9px] text-[var(--muted)] mt-1 uppercase tracking-wide">Review before sending to your opt-in buyer list.</div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>

        {/* BUYERS */}
        <section className="hud-panel p-4">
          <h2 className="label mb-3 text-[var(--gold)]">▸ Cash buyer network</h2>
          <CashBuyerFinder onImported={loadBuyers} />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input className={F} placeholder="Buyer / firm name" value={b.name || ""} onChange={setBF("name")} />
            <select className={F} value={b.type} onChange={setBF("type")}>
              <option value="individual" className="bg-[#040b16]">Individual</option>
              <option value="hedge_fund" className="bg-[#040b16]">Hedge fund</option>
              <option value="institutional" className="bg-[#040b16]">Institutional</option>
              <option value="private_equity" className="bg-[#040b16]">Private equity</option>
              <option value="ibuyer" className="bg-[#040b16]">iBuyer</option>
            </select>
            <input className={F} placeholder="Contact (your CRM)" value={b.contact || ""} onChange={setBF("contact")} />
            <select className={F} value={b.proofOfFunds || "no"} onChange={setBF("proofOfFunds")}>
              <option value="no" className="bg-[#040b16]">No POF</option>
              <option value="yes" className="bg-[#040b16]">POF verified</option>
            </select>
            <input className={`${F} col-span-2`} placeholder="Markets (Austin TX, Dallas TX)" value={b.markets || ""} onChange={setBF("markets")} />
            <input className={`${F} col-span-2`} placeholder="Property types (SFR, Multi)" value={b.propertyTypes || ""} onChange={setBF("propertyTypes")} />
            <input className={F} placeholder="Min price $" value={b.minPrice || ""} onChange={setBF("minPrice")} />
            <input className={F} placeholder="Max price $" value={b.maxPrice || ""} onChange={setBF("maxPrice")} />
            <input className={F} placeholder="Min beds" value={b.minBeds || ""} onChange={setBF("minBeds")} />
            <input className={F} placeholder="Max repairs $" value={b.maxRepairs || ""} onChange={setBF("maxRepairs")} />
          </div>
          <div className="flex justify-end mb-3">
            <button onClick={addBuyer} className="px-4 py-1.5 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)]">+ Add buyer</button>
          </div>

          <div className="space-y-1.5 max-h-[200px] overflow-y-auto mb-4">
            {buyers.length === 0 ? <span className="text-[11px] text-[var(--muted)]">No buyers yet.</span> :
              buyers.map((bu) => (
                <div key={bu.id} className="flex items-center justify-between border border-[rgba(63,224,255,0.15)] px-2 py-1.5 text-[11px]">
                  <div className="truncate">
                    <span className="text-[var(--text)]">{bu.name}</span>
                    <span className="text-[var(--gold)] ml-1 text-[9px] uppercase">{bu.type.replace("_", " ")}</span>
                    {bu.proofOfFunds && <span className="text-[var(--good)] ml-1 text-[9px]">POF</span>}
                    <div className="text-[9px] text-[var(--muted)] hud-text">{bu.box.markets.join(", ") || "nationwide"} · {usd(bu.box.minPrice)}–{usd(bu.box.maxPrice)}</div>
                  </div>
                  <button onClick={() => delBuyer(bu.id)} className="text-[var(--muted)] hover:text-[var(--bad)]">×</button>
                </div>
              ))}
          </div>

          {/* MATCHES */}
          <div className="border-t border-[rgba(63,224,255,0.15)] pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="label text-[var(--hud)]">▸ Buying-box matches{selectedDeal ? ` — ${selectedDeal.address}` : ""}</span>
              {selectedDeal && (
                <div className="flex gap-1.5">
                  <button onClick={analyzeWithAI} disabled={aiBusy} className="text-[10px] tracking-widest uppercase px-2 py-1 border border-[var(--gold)] text-[var(--gold)] disabled:opacity-40">{aiBusy ? "…" : "Analyze"}</button>
                  <button onClick={() => draftDispo(selectedDeal.id)} disabled={aiBusy} className="text-[10px] tracking-widest uppercase px-2 py-1 border border-[var(--hud)] text-[var(--hud)] disabled:opacity-40">Dispo email</button>
                  <button onClick={genContract} className="text-[10px] tracking-widest uppercase px-2 py-1 border border-[var(--good)] text-[var(--good)]">Contract</button>
                </div>
              )}
            </div>
            {!selectedDeal ? <span className="text-[11px] text-[var(--muted)]">Select a deal to assign it to buyers.</span> :
              matches.length === 0 ? <span className="text-[11px] text-[var(--muted)]">No buyers fit this deal&apos;s box yet.</span> :
              <div className="space-y-1">
                {matches.map((m) => (
                  <div key={m.buyer.id} className="flex items-center justify-between border border-[rgba(63,224,255,0.15)] px-2 py-1.5 text-[11px]">
                    <div>
                      <span className="text-[var(--text)]">{m.buyer.name}</span>
                      <span className="text-[9px] text-[var(--muted)] ml-2">{m.reasons.join(" · ")}</span>
                    </div>
                    <span className="hud-text" style={{ color: m.score >= 80 ? "var(--good)" : m.score >= 50 ? "var(--gold)" : "var(--muted)" }}>{m.score}%</span>
                  </div>
                ))}
              </div>}
            {ai && <div className="mt-3 border border-[rgba(255,194,75,0.3)] p-2 text-[12px] text-[var(--text)] leading-relaxed">{ai}</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
