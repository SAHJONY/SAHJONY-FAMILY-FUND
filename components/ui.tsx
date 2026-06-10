"use client";

import type { Source, ServiceState } from "@/lib/types";

export function Panel({
  title,
  badge,
  children,
  scan,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  scan?: boolean;
}) {
  return (
    <section className={`hud-panel p-4 flicker-in ${scan ? "scanbar" : ""}`}>
      <header className="flex items-center justify-between mb-3">
        <h2 className="label flex items-center gap-2">
          <span className="text-[var(--gold)]">▸</span>
          {title}
        </h2>
        {badge}
      </header>
      {children}
    </section>
  );
}

export function SourceTag({ source }: { source: Source }) {
  const map: Record<Source, { label: string; color: string }> = {
    measured: { label: "LIVE", color: "var(--good)" },
    simulated: { label: "SIM", color: "var(--gold)" },
    unavailable: { label: "N/A", color: "var(--muted)" },
  };
  const { label, color } = map[source];
  return (
    <span className="hud-text text-[9px] px-1.5 py-0.5 border tracking-widest"
      style={{ color, borderColor: color }}>
      {label}
    </span>
  );
}

export function StateDot({ state }: { state: ServiceState }) {
  const color =
    state === "online" ? "var(--good)" :
    state === "degraded" ? "var(--warn)" :
    state === "offline" ? "var(--bad)" : "var(--muted)";
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] tracking-widest uppercase">
      <span className={`w-2 h-2 rounded-full ${state === "online" ? "blink" : ""}`}
        style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      <span style={{ color }}>{state}</span>
    </span>
  );
}

export function Metric({
  label, value, unit, bar,
}: {
  label: string; value: string | number; unit?: string; bar?: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-[var(--muted)] uppercase tracking-wider truncate">{label}</span>
        <span className="hud-text text-sm text-[var(--text)] whitespace-nowrap">
          {value}
          {unit ? <span className="text-[var(--muted)] text-[10px] ml-0.5">{unit}</span> : null}
        </span>
      </div>
      {typeof bar === "number" && (
        <div className="h-1 mt-1.5 bg-[var(--hud-deep)] overflow-hidden">
          <div className="h-full"
            style={{
              width: `${Math.max(2, Math.min(100, bar))}%`,
              background: bar > 85 ? "var(--bad)" : bar > 60 ? "var(--gold)" : "var(--hud)",
              boxShadow: `0 0 8px ${bar > 85 ? "var(--bad)" : bar > 60 ? "var(--gold)" : "var(--hud)"}`,
            }} />
        </div>
      )}
    </div>
  );
}

// Circular HUD gauge for a single 0..100 value.
export function Gauge({
  value, label, unit = "%", size = 96, accent,
}: {
  value: number; label: string; unit?: string; size?: number; accent?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = 40;
  const c = 2 * Math.PI * r;
  const col = accent ?? (v > 85 ? "var(--bad)" : v > 60 ? "var(--gold)" : "var(--hud)");
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--hud-deep)" strokeWidth="6" />
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
          return (
            <line key={i}
              x1={50 + Math.cos(a) * 46} y1={50 + Math.sin(a) * 46}
              x2={50 + Math.cos(a) * 49} y2={50 + Math.sin(a) * 49}
              stroke="var(--hud)" strokeOpacity="0.35" strokeWidth="1" />
          );
        })}
        <circle cx="50" cy="50" r={r} fill="none" stroke={col} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          transform="rotate(-90 50 50)"
          style={{ filter: `drop-shadow(0 0 4px ${col})`, transition: "stroke-dashoffset 0.6s ease" }} />
        <text x="50" y="48" textAnchor="middle" fill="var(--text)"
          fontSize="22" fontFamily="ui-monospace, monospace">{Math.round(v)}</text>
        <text x="50" y="62" textAnchor="middle" fill="var(--muted)" fontSize="9">{unit}</text>
      </svg>
      <span className="label">{label}</span>
    </div>
  );
}
