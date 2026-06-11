"use client";

import { useState } from "react";

const usd = (n: number | null) => (n ? "$" + n.toLocaleString() : "—");

function Row({ label, value, source }: { label: string; value: any; source: string }) {
  const has = value !== null && value !== undefined && value !== "";
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] py-0.5">
      <span className="text-[var(--muted)] uppercase tracking-wide">{label}</span>
      <span className="hud-text flex items-center gap-1.5">
        <span style={{ color: has ? "var(--text)" : "var(--muted)" }}>{has ? value : "—"}</span>
        {has && <span className="text-[8px] uppercase tracking-widest px-1 border border-[rgba(63,224,255,0.2)] text-[var(--hud)]">{source}</span>}
      </span>
    </div>
  );
}

export default function PropertyIntel() {
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<any>(null);

  const run = async () => {
    if (!addr.trim()) return;
    setBusy(true); setD(null);
    try {
      const r = await fetch("/api/wholesale/intel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: addr }) });
      setD(await r.json());
    } catch (e) { setD({ error: (e as Error).message }); }
    setBusy(false);
  };

  return (
    <div className="hud-panel p-4 mb-4">
      <div className="label mb-2 text-[var(--gold)]">⌖ Property Intelligence — PropStream-style research (real providers)</div>
      <div className="flex gap-2 mb-2">
        <input value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Any US address — aggregates Census + Regrid + ATTOM"
          className="flex-1 bg-transparent border border-[rgba(63,224,255,0.3)] px-3 py-2 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]" />
        <button onClick={run} disabled={busy || !addr.trim()} className="px-4 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)] disabled:opacity-40">{busy ? "…" : "Research"}</button>
      </div>

      {d && !d.error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-1 mt-2">
          <div>
            <div className="text-[9px] text-[var(--hud)] uppercase tracking-widest mb-1 border-b border-[rgba(63,224,255,0.15)]">Location</div>
            <Row label="Address" value={d.location.normalizedAddress.value} source={d.location.normalizedAddress.source} />
            <Row label="County" value={d.location.county.value} source={d.location.county.source} />
            <Row label="Tract" value={d.location.censusTract.value} source={d.location.censusTract.source} />
          </div>
          <div>
            <div className="text-[9px] text-[var(--hud)] uppercase tracking-widest mb-1 border-b border-[rgba(63,224,255,0.15)]">Parcel / building</div>
            <Row label="Owner" value={d.parcel.owner.value} source={d.parcel.owner.source} />
            <Row label="APN" value={d.parcel.apn.value} source={d.parcel.apn.source} />
            <Row label="Beds/Baths" value={d.building.beds.value ? `${d.building.beds.value}/${d.building.baths.value ?? "?"}` : null} source={d.building.beds.source} />
            <Row label="SqFt" value={d.building.sqft.value} source={d.building.sqft.source} />
            <Row label="Year built" value={d.parcel.yearBuilt.value} source={d.parcel.yearBuilt.source} />
          </div>
          <div>
            <div className="text-[9px] text-[var(--hud)] uppercase tracking-widest mb-1 border-b border-[rgba(63,224,255,0.15)]">Valuation</div>
            <Row label="AVM (as-is)" value={usd(d.valuation.avm.value)} source={d.valuation.avm.source} />
            <Row label="AVM range" value={d.valuation.avmRange.value} source={d.valuation.avmRange.source} />
            <Row label="Assessed" value={usd(d.valuation.assessedValue.value)} source={d.valuation.assessedValue.source} />
            <Row label="Last sale" value={d.valuation.lastSalePrice.value ? `${usd(d.valuation.lastSalePrice.value)} (${d.valuation.lastSaleDate.value ?? "?"})` : null} source={d.valuation.lastSalePrice.source} />
          </div>
        </div>
      )}
      {d && !d.error && (d.listings?.length || d.records?.length) && (
        <div className="mt-3 space-y-2">
          <div>
            <div className="text-[9px] text-[var(--hud)] uppercase tracking-widest mb-1">Listings &amp; FSBO (Zillow + others)</div>
            <div className="flex flex-wrap gap-1.5">
              {d.listings.map((s: any) => (
                <a key={s.label} href={s.url} target="_blank" rel="noreferrer"
                  className="text-[10px] px-2 py-1 border border-[rgba(63,224,255,0.3)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)]">{s.label} ↗</a>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-[var(--gold)] uppercase tracking-widest mb-1">Public &amp; county records (nationwide, official portals)</div>
            <div className="flex flex-wrap gap-1.5">
              {d.records.map((s: any) => (
                <a key={s.label} href={s.url} target="_blank" rel="noreferrer" title={s.note}
                  className="text-[10px] px-2 py-1 border border-[rgba(255,194,75,0.3)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.1)]">{s.label} ↗</a>
              ))}
            </div>
          </div>
        </div>
      )}
      {d?.error && <div className="text-[11px] text-[var(--bad)]">{d.error}</div>}
      {d?.notes?.length > 0 && (
        <div className="text-[9px] text-[var(--gold)] mt-2 leading-relaxed">{d.notes.join(" · ")}</div>
      )}
      <div className="text-[9px] text-[var(--muted)] mt-1 uppercase tracking-wide">AVM = real as-is automated valuation (not ARV). No scraping, no skip-tracing.</div>
    </div>
  );
}
