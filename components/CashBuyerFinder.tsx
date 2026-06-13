"use client";

import { useState } from "react";

export default function CashBuyerFinder({ onImported }: { onImported?: () => void }) {
  const [m, setM] = useState({ city: "", state: "" });
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);

  const find = async () => {
    if (!m.city && !m.state) return;
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/wholesale/cash-buyers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(m) });
      setRes(await r.json());
    } catch (e) { setRes({ error: (e as Error).message }); }
    setBusy(false);
  };
  const importBuyer = async (name: string) => {
    await fetch("/api/wholesale/cash-buyers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import", name, market: `${m.city} ${m.state}`.trim() }) });
    onImported?.();
  };

  const F = "bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]";

  return (
    <div className="border border-[rgba(255,194,75,0.3)] p-3 mt-3">
      <div className="label text-[var(--gold)] mb-2">⌖ Find cash buyers (real deed records)</div>
      <div className="flex gap-1.5 mb-2">
        <input className={`${F} flex-1`} placeholder="City" value={m.city} onChange={(e) => setM({ ...m, city: e.target.value })} />
        <input className={`${F} w-16`} placeholder="ST" value={m.state} onChange={(e) => setM({ ...m, state: e.target.value })} />
        <button onClick={find} disabled={busy} className="px-3 text-[11px] tracking-widest uppercase border border-[var(--gold)] text-[var(--gold)] disabled:opacity-40">{busy ? "…" : "Find"}</button>
      </div>

      {res && !res.error && (
        <>
          {res.buyers?.length > 0 && (
            <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
              {res.buyers.map((b: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-[11px] border border-[rgba(63,224,255,0.15)] px-2 py-1">
                  <span><span className="text-[var(--text)]">{b.name}</span> <span className="text-[9px] text-[var(--muted)]">{b.detail}</span></span>
                  <button onClick={() => importBuyer(b.name)} className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-[var(--good)] text-[var(--good)]">+ add</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mb-1">
            {res.recordSources?.map((s: any) => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer" title={s.note}
                className="text-[10px] px-2 py-1 border border-[rgba(255,194,75,0.3)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.1)]">{s.label} ↗</a>
            ))}
          </div>
          <div className="text-[9px] text-[var(--muted)] leading-relaxed">{res.note}</div>
        </>
      )}
      {res?.error && <div className="text-[11px] text-[var(--bad)]">{res.error}</div>}
    </div>
  );
}
