"use client";

import type { Source, ServiceState } from "@/lib/types";

export function Panel({
  title,
  badge,
  children,
  sweep,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  sweep?: boolean;
}) {
  return (
    <section className={`panel p-4 relative overflow-hidden ${sweep ? "sweep" : ""}`}>
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
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
    measured: { label: "MEASURED", color: "var(--good)" },
    simulated: { label: "SIMULATED", color: "var(--warn)" },
    unavailable: { label: "N/A", color: "var(--muted)" },
  };
  const { label, color } = map[source];
  return (
    <span
      className="text-[10px] mono px-1.5 py-0.5 rounded border"
      style={{ color, borderColor: color }}
    >
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
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={`w-2 h-2 rounded-full ${state === "online" ? "pulse" : ""}`}
        style={{ background: color }}
      />
      <span style={{ color }} className="uppercase">{state}</span>
    </span>
  );
}

export function Metric({
  label,
  value,
  unit,
  bar,
}: {
  label: string;
  value: string | number;
  unit?: string;
  bar?: number; // 0..100
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-[var(--muted)]">{label}</span>
        <span className="mono text-sm">
          {value}
          {unit ? <span className="text-[var(--muted)] text-xs ml-0.5">{unit}</span> : null}
        </span>
      </div>
      {typeof bar === "number" && (
        <div className="h-1.5 mt-1 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(2, Math.min(100, bar))}%`,
              background:
                bar > 85 ? "var(--bad)" : bar > 60 ? "var(--warn)" : "var(--accent)",
            }}
          />
        </div>
      )}
    </div>
  );
}
