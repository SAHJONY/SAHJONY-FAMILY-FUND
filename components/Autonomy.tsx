"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";

interface BrainModule {
  id: string;
  label: string;
  kind: "model" | "agent" | "external";
  status: "active" | "standby" | "needs-key" | "unlinked";
  detail: string;
}
interface HealEvent { t: number; level: "ok" | "warn" | "heal" | "fail"; msg: string; }
interface HealResp {
  healthy: boolean;
  activeModel: string;
  latencyMs: number | null;
  healCount: number;
  events: HealEvent[];
  brains: BrainModule[];
}

const statusColor: Record<BrainModule["status"], string> = {
  active: "var(--good)",
  standby: "var(--hud)",
  "needs-key": "var(--gold)",
  unlinked: "var(--muted)",
};
const levelColor: Record<HealEvent["level"], string> = {
  ok: "var(--good)", warn: "var(--gold)", heal: "var(--hud)", fail: "var(--bad)",
};

export default function Autonomy() {
  const [data, setData] = useState<HealResp | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/agent/heal", { cache: "no-store" });
        const j = await r.json();
        if (alive) setData(j);
      } catch { /* keep last */ }
    };
    tick();
    const id = setInterval(tick, 8000); // supervisor heartbeat
    return () => { alive = false; clearInterval(id); };
  }, []);

  const kindGroups: BrainModule["kind"][] = ["model", "agent", "external"];
  const kindLabel: Record<BrainModule["kind"], string> = {
    model: "Model cortex", agent: "Agent loop", external: "External brains",
  };

  return (
    <Panel
      title="Brain & Autonomy"
      badge={
        <span className="inline-flex items-center gap-1.5 text-[10px] tracking-widest uppercase">
          <span className="w-2 h-2 rounded-full blink"
            style={{ background: data?.healthy ? "var(--good)" : "var(--bad)",
              boxShadow: `0 0 8px ${data?.healthy ? "var(--good)" : "var(--bad)"}` }} />
          <span style={{ color: data?.healthy ? "var(--good)" : "var(--bad)" }}>
            {data?.healthy ? "self-healing" : "degraded"}
          </span>
        </span>
      }
    >
      {!data ? (
        <div className="text-[11px] text-[var(--muted)]">Booting supervisor…</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--muted)] uppercase tracking-wider">Recoveries</span>
            <span className="hud-text text-[var(--hud)]">{data.healCount}</span>
          </div>

          {kindGroups.map((g) => {
            const items = data.brains.filter((b) => b.kind === g);
            if (!items.length) return null;
            return (
              <div key={g}>
                <div className="label mb-1 text-[var(--muted)]">{kindLabel[g]}</div>
                <div className="space-y-1">
                  {items.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="hud-text truncate max-w-[55%]" title={b.detail}>{b.label}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full"
                          style={{ background: statusColor[b.status], boxShadow: `0 0 6px ${statusColor[b.status]}` }} />
                        <span className="uppercase tracking-widest text-[9px]"
                          style={{ color: statusColor[b.status] }}>{b.status}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="border-t border-[rgba(63,224,255,0.15)] pt-2">
            <div className="label mb-1 text-[var(--muted)]">Self-heal log</div>
            <div className="hud-text text-[10px] space-y-1 max-h-28 overflow-y-auto">
              {data.events.length === 0 ? (
                <span className="text-[var(--muted)]">No interventions yet — nominal.</span>
              ) : (
                data.events.map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <span style={{ color: levelColor[e.level] }}>●</span>
                    <span className="text-[var(--muted)]">{e.msg}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
