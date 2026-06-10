"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  HostTelemetry,
  LlmBackendHealth,
  DeviceNode,
  VelocityMetrics,
} from "@/lib/types";
import type { IntentName } from "@/lib/intent";
import VoiceEngine from "@/components/VoiceEngine";
import { Panel, SourceTag, StateDot, Metric } from "@/components/ui";

function useJson<T>(url: string, ms: number): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        if (alive) setData(j);
      } catch {
        /* keep last */
      }
    };
    tick();
    const id = setInterval(tick, ms);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, ms]);
  return data;
}

// Velocity is synthesized on the client (no real token stream exists in this
// standalone build) and is explicitly tagged SIMULATED so it is never mistaken
// for measured data. A real deployment would feed these from the inference loop.
function useVelocity(): VelocityMetrics {
  const [v, setV] = useState<VelocityMetrics>({
    inputTokensPerSec: 0,
    outputTokensPerSec: 0,
    firstTokenLatencyMs: 0,
    activeTurns: 0,
    queueDepth: 0,
    source: "simulated",
  });
  const base = useRef(Math.random() * 40 + 60);
  useEffect(() => {
    const id = setInterval(() => {
      base.current += (Math.random() - 0.5) * 18;
      base.current = Math.max(20, Math.min(140, base.current));
      setV({
        inputTokensPerSec: Math.round(base.current * 0.6 + Math.random() * 10),
        outputTokensPerSec: Math.round(base.current + Math.random() * 12),
        firstTokenLatencyMs: Math.round(180 + Math.random() * 220),
        activeTurns: Math.floor(Math.random() * 4),
        queueDepth: Math.floor(Math.random() * 6),
        source: "simulated",
      });
    }, 1200);
    return () => clearInterval(id);
  }, []);
  return v;
}

interface HealthResp {
  backends: LlmBackendHealth[];
  vercelEnv: string;
  primaryModel: string | null;
  rotationCount: number;
}
interface DevicesResp {
  devices: DeviceNode[];
  enrollmentEnabled: boolean;
}

export default function Dashboard() {
  const tel = useJson<HostTelemetry>("/api/telemetry", 2000);
  const health = useJson<HealthResp>("/api/health", 5000);
  const devicesResp = useJson<DevicesResp>("/api/devices", 4000);
  const velocity = useVelocity();
  const [log, setLog] = useState<string[]>([]);
  const [deployState, setDeployState] = useState<"idle" | "armed" | "running" | "done">("idle");
  const focusRef = useRef<HTMLDivElement | null>(null);

  const pushLog = useCallback((m: string) => {
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 8));
  }, []);

  const runDeploy = useCallback(() => {
    setDeployState("running");
    pushLog("DEPLOY POST → building & pushing to production pipeline…");
    setTimeout(() => {
      setDeployState("done");
      pushLog("DEPLOY POST → completed (simulated; wire to Vercel/GitHub to make live).");
      setTimeout(() => setDeployState("idle"), 4000);
    }, 1800);
  }, [pushLog]);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });

  const handleIntent = useCallback(
    (intent: IntentName, raw: string, confidence: number): string => {
      pushLog(`voice: “${raw}” → ${intent} (${(confidence * 100) | 0}%)`);
      switch (intent) {
        case "SHOW_SPEED": scrollTo("speed"); return "Showing operational velocity.";
        case "SHOW_RUNTIME": scrollTo("runtime"); return "Displaying runtime infrastructure.";
        case "SHOW_FLEET": scrollTo("fleet"); return "Bringing up fleet status.";
        case "SHOW_CONSOLIDATION": scrollTo("consolidation"); return "Opening metric consolidation.";
        case "CHECK_HEALTH": scrollTo("runtime"); return "Backend diagnostics are on screen.";
        case "DEPLOY_POST":
          setDeployState("armed");
          pushLog("DEPLOY POST armed by voice — say or click Confirm.");
          return "Deploy Post armed. Confirm to proceed.";
        case "GREETING": return "Online and listening.";
        default: return "I didn't catch a clear command.";
      }
    },
    [pushLog]
  );

  const fmtBytes = (b: number) => `${(b / 1024 ** 3).toFixed(1)} GB`;
  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <main className="max-w-7xl mx-auto px-5 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <span className="text-[var(--accent)]">◆</span> JARVIS
            <span className="text-[var(--muted)] font-normal text-base">
              Executive Control Plane
            </span>
          </h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            Hybrid local / cloud · {tel?.hostname ?? "…"} · {tel?.platform}/{tel?.arch}
            {health ? ` · env:${health.vercelEnv}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {deployState === "armed" ? (
            <button
              onClick={runDeploy}
              className="text-sm px-4 py-2 rounded-md font-semibold border border-[var(--warn)] text-[var(--warn)] glow"
            >
              Confirm Deploy
            </button>
          ) : (
            <button
              onClick={() => { setDeployState("armed"); pushLog("DEPLOY POST armed."); }}
              disabled={deployState === "running"}
              className="text-sm px-4 py-2 rounded-md font-semibold border border-[var(--accent)] text-[var(--accent)] hover:glow disabled:opacity-50"
            >
              {deployState === "running" ? "Deploying…" : deployState === "done" ? "Deployed ✓" : "Deploy Post"}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" ref={focusRef}>
        {/* Voice + log column */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <VoiceEngine onIntent={handleIntent} />
          <Panel title="Command Log">
            <div className="mono text-[11px] space-y-1 min-h-[6rem]">
              {log.length === 0 ? (
                <span className="text-[var(--muted)]">No activity yet.</span>
              ) : (
                log.map((l, i) => <div key={i} className="text-[var(--muted)]">{l}</div>)
              )}
            </div>
          </Panel>
        </div>

        {/* Speed */}
        <div id="speed">
          <Panel title="Operational Velocity" badge={<SourceTag source={velocity.source} />} sweep>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Output tok/s" value={velocity.outputTokensPerSec} bar={velocity.outputTokensPerSec / 1.5} />
              <Metric label="Input tok/s" value={velocity.inputTokensPerSec} bar={velocity.inputTokensPerSec / 1.5} />
              <Metric label="First-token" value={velocity.firstTokenLatencyMs} unit="ms" bar={velocity.firstTokenLatencyMs / 5} />
              <Metric label="Active turns" value={velocity.activeTurns} />
              <Metric label="Queue depth" value={velocity.queueDepth} bar={velocity.queueDepth * 16} />
            </div>
          </Panel>
        </div>

        {/* Consolidation */}
        <div id="consolidation">
          <Panel title="Metric Consolidation" badge={<SourceTag source="measured" />}>
            <div className="space-y-3">
              <Metric label="Telemetry interval" value="2.0" unit="s" />
              <Metric label="Health interval" value="5.0" unit="s" />
              <Metric label="Active model" value={(health?.primaryModel ?? "—").split("/").pop() || "—"} />
              <Metric label="Rotation pool" value={(health?.rotationCount ?? 0) + 1} unit="models" />
              <Metric label="Devices enrolled" value={devicesResp?.devices.filter((d) => d.enrolled).length ?? 0} />
              <Metric label="Deploy target" value={health?.vercelEnv ?? "local"} />
            </div>
          </Panel>
        </div>

        {/* Runtime: CPU/Mem */}
        <div id="runtime">
          <Panel title="Runtime · Host" badge={tel ? <SourceTag source={tel.cpu.source} /> : null}>
            {tel ? (
              <div className="space-y-3">
                <div className="text-[11px] text-[var(--muted)] truncate">{tel.cpu.model}</div>
                <Metric label={`CPU (${tel.cpu.cores} cores)`} value={tel.cpu.utilizationPct} unit="%" bar={tel.cpu.utilizationPct} />
                <Metric label="Load 1m" value={tel.cpu.loadAvg1.toFixed(2)} />
                <Metric label="Memory" value={`${fmtBytes(tel.mem.usedBytes)} / ${fmtBytes(tel.mem.totalBytes)}`} bar={tel.mem.usedPct} />
                <Metric label="Uptime" value={fmtUptime(tel.uptimeSec)} />
              </div>
            ) : (
              <div className="text-xs text-[var(--muted)]">Loading host telemetry…</div>
            )}
          </Panel>
        </div>

        {/* Runtime: GPU */}
        <div>
          <Panel title="Runtime · GPU" badge={tel ? <SourceTag source={tel.gpu.source} /> : null}>
            {tel ? (
              <div className="space-y-3">
                <div className="text-[11px] text-[var(--muted)]">{tel.gpu.vendor} · {tel.gpu.model}</div>
                {tel.gpu.source === "measured" ? (
                  <>
                    <Metric label="VRAM" value={`${tel.gpu.vramUsedMb}/${tel.gpu.vramTotalMb}`} unit="MB" bar={((tel.gpu.vramUsedMb ?? 0) / (tel.gpu.vramTotalMb || 1)) * 100} />
                    <Metric label="Compute" value={tel.gpu.utilizationPct ?? 0} unit="%" bar={tel.gpu.utilizationPct ?? 0} />
                  </>
                ) : (
                  <p className="text-xs text-[var(--warn)] leading-relaxed">{tel.gpu.note}</p>
                )}
              </div>
            ) : (
              <div className="text-xs text-[var(--muted)]">…</div>
            )}
          </Panel>
        </div>

        {/* Runtime: Docker + backends */}
        <div>
          <Panel title="Runtime · Containers & Inference">
            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-[var(--muted)] mb-1">Docker</div>
                {tel?.docker.available ? (
                  tel.docker.containers.length ? (
                    tel.docker.containers.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-xs">
                        <span className="mono truncate max-w-[60%]">{c.name}</span>
                        <span className="text-[var(--good)]">{c.state}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[var(--muted)]">No running containers.</div>
                  )
                ) : (
                  <div className="text-xs text-[var(--warn)]">{tel?.docker.note ?? "…"}</div>
                )}
              </div>
              <div className="border-t border-[var(--border)] pt-2">
                <div className="text-[11px] text-[var(--muted)] mb-1">Inference backends</div>
                {health?.backends.length ? (
                  health.backends.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-xs mb-1">
                      <span className="mono truncate max-w-[55%]" title={b.target}>{b.target.replace(/^https?:\/\//, "")}</span>
                      <StateDot state={b.state} />
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[var(--muted)]">Probing…</div>
                )}
              </div>
            </div>
          </Panel>
        </div>

        {/* Fleet */}
        <div id="fleet" className="lg:col-span-2">
          <Panel
            title="Cross-Device Fleet"
            badge={
              <span className="text-[10px] mono px-1.5 py-0.5 rounded border border-[var(--muted)] text-[var(--muted)]">
                {devicesResp?.enrollmentEnabled ? "ENROLLMENT OPEN" : "ENROLLMENT OFF"}
              </span>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {devicesResp?.devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between border border-[var(--border)] rounded-md px-3 py-2">
                  <div>
                    <div className="text-sm">{d.label}</div>
                    <div className="text-[11px] text-[var(--muted)] mono">{d.os}</div>
                  </div>
                  <StateDot state={d.state} />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-3 leading-relaxed">
              Devices appear here only after explicit, token-gated opt-in enrollment.
              This control plane does not push runtimes onto remote machines.
            </p>
          </Panel>
        </div>

        {/* Deploy status */}
        <div>
          <Panel title="Deployment">
            <div className="space-y-2">
              <StateDot state={deployState === "running" ? "degraded" : deployState === "done" ? "online" : "unknown"} />
              <p className="text-xs text-[var(--muted)]">
                {deployState === "armed"
                  ? "Armed — confirm to ship."
                  : deployState === "running"
                  ? "Pipeline running…"
                  : deployState === "done"
                  ? "Last deploy succeeded."
                  : "Idle. Trigger via button or voice ‘deploy post’."}
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <footer className="text-[11px] text-[var(--muted)] mt-6 text-center">
        Measured values come from this host. Simulated values are flagged and exist
        only for layout until live producers are wired in.
      </footer>
    </main>
  );
}
