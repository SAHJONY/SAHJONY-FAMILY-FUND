"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "@/components/ui";

export default function Finder() {
  const [data, setData] = useState<any>(null);
  const [m, setM] = useState({ city: "", state: "", minPrice: "", maxPrice: "", minBeds: "" });
  const [running, setRunning] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => setData(await (await fetch("/api/finder", { cache: "no-store" })).json());
  useEffect(() => { load(); }, []);

  const save = async (patch: any) => {
    await fetch("/api/finder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    load();
  };
  const addMarket = async () => {
    if (!m.city) return;
    const markets = [...(data?.config?.markets ?? []), { city: m.city, state: m.state.toUpperCase() }];
    await save({ markets, minPrice: Number(m.minPrice) || 0, maxPrice: Number(m.maxPrice) || 0, minBeds: Number(m.minBeds) || 0 });
    setM({ city: "", state: "", minPrice: "", maxPrice: "", minBeds: "" });
  };
  const runNow = async () => { setRunning(true); await fetch("/api/finder/run", { method: "POST" }); setRunning(false); load(); };

  const enabled = data?.config?.enabled;
  // While enabled and this dashboard is open, poll a pass every 10 min (local
  // convenience). True 24/7 is the Vercel Cron once deployed.
  useEffect(() => {
    if (tick.current) clearInterval(tick.current);
    if (enabled) tick.current = setInterval(() => fetch("/api/finder/run").then(load), 600000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [enabled]);

  const F = "bg-transparent border border-[rgba(63,224,255,0.25)] px-1.5 py-1 text-[11px] text-[var(--text)] placeholder:text-[var(--muted)]";

  return (
    <Panel
      title="Autonomous Deal Finder · 24/7"
      badge={
        <button onClick={() => save({ enabled: !enabled })}
          className="text-[10px] tracking-widest uppercase px-2 py-1 border"
          style={{ color: enabled ? "var(--good)" : "var(--muted)", borderColor: enabled ? "var(--good)" : "var(--muted)" }}>
          {enabled ? "● Hunting" : "○ Off"}
        </button>
      }
    >
      {!data ? <div className="text-[11px] text-[var(--muted)]">…</div> : (
        <div className="space-y-2">
          {!data.feedConnected && (
            <div className="text-[10px] text-[var(--gold)] leading-relaxed border border-[rgba(255,194,75,0.3)] p-1.5">
              No licensed MLS feed connected. SAHJONY will run but can only find REAL listings once you add
              MLS_RESO_URL + MLS_RESO_TOKEN on the env page. It will not invent deals.
            </div>
          )}
          <div className="grid grid-cols-5 gap-1">
            <input className={F} placeholder="City" value={m.city} onChange={(e) => setM({ ...m, city: e.target.value })} />
            <input className={F} placeholder="ST" value={m.state} onChange={(e) => setM({ ...m, state: e.target.value })} />
            <input className={F} placeholder="min$" value={m.minPrice} onChange={(e) => setM({ ...m, minPrice: e.target.value })} />
            <input className={F} placeholder="max$" value={m.maxPrice} onChange={(e) => setM({ ...m, maxPrice: e.target.value })} />
            <input className={F} placeholder="beds" value={m.minBeds} onChange={(e) => setM({ ...m, minBeds: e.target.value })} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--muted)]">
              Markets: {(data.config.markets ?? []).map((x: any) => `${x.city} ${x.state}`).join(", ") || "none"}
            </span>
            <div className="flex gap-1.5">
              <button onClick={addMarket} className="text-[10px] tracking-widest uppercase px-2 py-1 border border-[var(--hud)] text-[var(--hud)]">+ Market</button>
              <button onClick={runNow} disabled={running} className="text-[10px] tracking-widest uppercase px-2 py-1 border border-[var(--gold)] text-[var(--gold)] disabled:opacity-40">{running ? "…" : "Run now"}</button>
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-[var(--muted)]">
            <span>Runs: <span className="text-[var(--hud)] hud-text">{data.config.runs}</span></span>
            <span>Deals found: <span className="text-[var(--good)] hud-text">{data.config.found}</span></span>
          </div>
          <div className="hud-text text-[10px] space-y-0.5 max-h-24 overflow-y-auto border-t border-[rgba(63,224,255,0.15)] pt-1">
            {(data.log ?? []).length === 0 ? <span className="text-[var(--muted)]">No runs yet.</span> :
              data.log.map((r: any, k: number) => (
                <div key={k} className="text-[var(--muted)]">
                  <span style={{ color: r.added ? "var(--good)" : "var(--muted)" }}>●</span> {new Date(r.t).toLocaleTimeString()} — {r.note}{r.topMatch ? ` · top: ${r.topMatch}` : ""}
                </div>
              ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
