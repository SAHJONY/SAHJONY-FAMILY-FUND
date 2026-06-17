"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  HostTelemetry,
  LlmBackendHealth,
  DeviceNode,
  VelocityMetrics,
} from "@/lib/types";
import type { IntentName } from "@/lib/intent";
import Link from "next/link";
import VoiceEngine from "@/components/VoiceEngine";
import Chat, { type ChatHandle } from "@/components/Chat";
import Autonomy from "@/components/Autonomy";
import Hermes from "@/components/Hermes";
import Finder from "@/components/Finder";
import Memory from "@/components/Memory";
import Tasks from "@/components/Tasks";
import Research from "@/components/Research";
import Ops from "@/components/Ops";
import WebTool from "@/components/WebTool";
import BrowserControl from "@/components/BrowserControl";
import ArcReactor from "@/components/ArcReactor";
import { Panel, SourceTag, StateDot, Metric, Gauge } from "@/components/ui";

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

// Real, measured inference metrics from the streaming route. No simulation:
// before the first inference these read zero and are tagged accordingly.
interface RealMetrics {
  requests: number;
  lastFirstTokenMs: number;
  lastTokensPerSec: number;
  lastOutputChars: number;
  lastModel: string | null;
  lastAt: number;
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
  const metrics = useJson<RealMetrics>("/api/metrics", 2000);
  const hasInference = !!metrics && metrics.requests > 0;
  const [log, setLog] = useState<string[]>([]);
  const [deployState, setDeployState] = useState<"idle" | "armed" | "running" | "done">("idle");
  const [coreActive, setCoreActive] = useState(false);
  const askRef = useRef<ChatHandle["ask"] | null>(null);

  const pushLog = useCallback((m: string) => {
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 8));
  }, []);

  const flashCore = useCallback(() => {
    setCoreActive(true);
    setTimeout(() => setCoreActive(false), 2200);
  }, []);

  const runDeploy = useCallback(() => {
    setDeployState("running");
    flashCore();
    pushLog("DEPLOY POST → building & pushing to production pipeline…");
    setTimeout(() => {
      setDeployState("done");
      pushLog("DEPLOY POST → completed (simulated; wire Vercel/GitHub to make live).");
      setTimeout(() => setDeployState("idle"), 4000);
    }, 1800);
  }, [pushLog, flashCore]);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });

  const handleIntent = useCallback(
    (intent: IntentName, raw: string, confidence: number): string => {
      pushLog(`voice: “${raw}” → ${intent} (${(confidence * 100) | 0}%)`);
      flashCore();
      switch (intent) {
        case "SHOW_SPEED": scrollTo("speed"); return "Showing operational velocity, sir.";
        case "SHOW_RUNTIME": scrollTo("runtime"); return "Displaying runtime infrastructure.";
        case "SHOW_FLEET": scrollTo("fleet"); return "Bringing up fleet status.";
        case "SHOW_CONSOLIDATION": scrollTo("consolidation"); return "Opening metric consolidation.";
        case "CHECK_HEALTH": scrollTo("runtime"); return "Backend diagnostics are on screen, sir.";
        case "DEPLOY_POST":
          setDeployState("armed");
          pushLog("DEPLOY POST armed by voice — say or click Confirm.");
          return "Deploy Post armed. Confirm to proceed, sir.";
        case "GREETING": return "Online and listening, sir.";
        default: return "I didn't catch a clear command, sir.";
      }
    },
    [pushLog, flashCore]
  );

  // Free-form speech → SAHJONY conversational link (spoken reply).
  const handleConverse = useCallback(
    (text: string, speak: (t: string) => void) => {
      pushLog(`voice → SAHJONY: “${text}”`);
      flashCore();
      askRef.current?.(text, speak);
    },
    [pushLog, flashCore]
  );

  const fmtBytes = (b: number) => `${(b / 1024 ** 3).toFixed(1)} GB`;
  const fmtUptime = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

  return (
    <main className="relative z-10 max-w-7xl mx-auto px-5 py-6">
      <header className="flex items-center justify-between mb-6 flicker-in">
        <div className="flex items-center gap-4">
          <ArcReactor size={70} active={coreActive} />
          <div>
            <h1 className="text-3xl font-bold tracking-[0.35em] text-[var(--hud)]"
              style={{ textShadow: "0 0 18px rgba(63,224,255,0.6)" }}>
              SAHJONY
            </h1>
            <p className="text-[10px] text-[var(--muted)] tracking-[0.25em] uppercase mt-1">
              SAHJONY Holdings · Executive Operations &amp; Intelligence Plane
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/business"
            className="text-[11px] tracking-[0.2em] uppercase px-3 py-2.5 border border-[rgba(255,194,75,0.4)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.08)]">
            ⊟ Ops
          </Link>
          <Link href="/deals"
            className="text-[11px] tracking-[0.2em] uppercase px-3 py-2.5 border border-[rgba(255,194,75,0.4)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.08)]">
            ◫ Capital
          </Link>
          <Link href="/fund"
            className="text-[11px] tracking-[0.2em] uppercase px-3 py-2.5 border border-[rgba(255,194,75,0.4)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.08)]">
            ◈ Fund
          </Link>
          <Link href="/crm"
            className="text-[11px] tracking-[0.2em] uppercase px-3 py-2.5 border border-[rgba(255,194,75,0.4)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.08)]">
            ⊞ CRM
          </Link>
          <Link href="/email"
            className="text-[11px] tracking-[0.2em] uppercase px-3 py-2.5 border border-[rgba(63,224,255,0.3)] text-[var(--muted)] hover:text-[var(--hud)] hover:border-[var(--hud)]">
            ✉ Mail
          </Link>
          <Link href="/workforce"
            className="text-[11px] tracking-[0.2em] uppercase px-3 py-2.5 border border-[rgba(255,194,75,0.4)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.08)]">
            ⚒ Team
          </Link>
          <Link href="/integrations"
            className="text-[11px] tracking-[0.2em] uppercase px-3 py-2.5 border border-[rgba(63,224,255,0.3)] text-[var(--muted)] hover:text-[var(--hud)] hover:border-[var(--hud)]">
            ⚇ Tools
          </Link>
          <Link href="/env"
            className="text-[11px] tracking-[0.2em] uppercase px-3 py-2.5 border border-[rgba(63,224,255,0.3)] text-[var(--muted)] hover:text-[var(--hud)] hover:border-[var(--hud)]">
            ⚙ Env
          </Link>
          {deployState === "armed" ? (
            <button onClick={runDeploy}
              className="text-[11px] tracking-[0.2em] uppercase px-5 py-2.5 font-bold border border-[var(--gold)] text-[var(--gold)] gold-glow">
              ◈ Confirm Deploy
            </button>
          ) : (
            <button
              onClick={() => { setDeployState("armed"); pushLog("DEPLOY POST armed."); }}
              disabled={deployState === "running"}
              className="text-[11px] tracking-[0.2em] uppercase px-5 py-2.5 font-bold border border-[var(--hud)] text-[var(--hud)] hud-glow disabled:opacity-50">
              {deployState === "running" ? "Deploying…" : deployState === "done" ? "Deployed ✓" : "◈ Deploy Post"}
            </button>
          )}
        </div>
      </header>

      <div className="mb-4">
        <Hermes />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: voice + chat + log */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <VoiceEngine onIntent={handleIntent} onConverse={handleConverse} />
          <Chat registerAsk={(fn) => { askRef.current = fn; }} />
          <Tasks />
          <Ops />
          <Research />
          <Memory />
          <Finder />
          <Autonomy />
          <Panel title="Command Log">
            <div className="hud-text text-[10px] space-y-1 min-h-[5rem] leading-relaxed">
              {log.length === 0 ? (
                <span className="text-[var(--muted)]">Awaiting input, sir.</span>
              ) : (
                log.map((l, i) => <div key={i} className="text-[var(--muted)]">{l}</div>)
              )}
            </div>
          </Panel>
        </div>

        {/* Right: telemetry grid */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Velocity — real measured inference metrics */}
          <div id="speed">
            <Panel title="Operational Velocity" badge={<SourceTag source={hasInference ? "measured" : "unavailable"} />} scan>
              {hasInference && metrics ? (
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Output tok/s" value={metrics.lastTokensPerSec} bar={metrics.lastTokensPerSec / 1.5} />
                  <Metric label="First-token" value={metrics.lastFirstTokenMs} unit="ms" bar={metrics.lastFirstTokenMs / 20} />
                  <Metric label="Last output" value={metrics.lastOutputChars} unit="ch" />
                  <Metric label="Inferences" value={metrics.requests} />
                  <Metric label="Model" value={(metrics.lastModel ?? "—").split("/").pop() || "—"} />
                </div>
              ) : (
                <div className="text-[11px] text-[var(--muted)] leading-relaxed">
                  No inference measured yet. Talk to SAHJONY and these populate from
                  real token timing — nothing is simulated.
                </div>
              )}
            </Panel>
          </div>

          {/* Consolidation */}
          <div id="consolidation">
            <Panel title="Metric Consolidation" badge={<SourceTag source="measured" />}>
              <div className="space-y-2.5">
                <Metric label="Telemetry interval" value="2.0" unit="s" />
                <Metric label="Active model" value={(health?.primaryModel ?? "—").split("/").pop() || "—"} />
                <Metric label="Rotation pool" value={(health?.rotationCount ?? 0) + 1} unit="models" />
                <Metric label="Devices enrolled" value={devicesResp?.devices.filter((d) => d.enrolled).length ?? 0} />
                <Metric label="Deploy target" value={health?.vercelEnv ?? "local"} />
              </div>
            </Panel>
          </div>

          {/* Runtime gauges */}
          <div id="runtime" className="md:col-span-2">
            <Panel title="Runtime Infrastructure" badge={tel ? <SourceTag source={tel.cpu.source} /> : null}>
              {tel ? (
                <div className="flex flex-wrap items-start justify-around gap-4">
                  <Gauge label={`CPU · ${tel.cpu.cores}c`} value={tel.cpu.utilizationPct} />
                  <Gauge label="Memory" value={tel.mem.usedPct} accent="var(--gold)" />
                  {tel.gpu.source === "measured" ? (
                    <Gauge label="GPU" value={tel.gpu.utilizationPct ?? 0} />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 w-24">
                      <div className="w-[96px] h-[96px] rounded-full border border-dashed border-[var(--muted)] flex items-center justify-center text-center">
                        <span className="text-[9px] text-[var(--muted)] px-2 leading-tight">GPU<br/>N/A</span>
                      </div>
                      <span className="label">{tel.gpu.vendor}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-[180px] space-y-2.5 self-center">
                    <div className="text-[10px] text-[var(--muted)] truncate">{tel.cpu.model}</div>
                    <Metric label="Load 1m" value={tel.cpu.loadAvg1.toFixed(2)} />
                    <Metric label="Memory" value={`${fmtBytes(tel.mem.usedBytes)} / ${fmtBytes(tel.mem.totalBytes)}`} />
                    <Metric label="GPU" value={tel.gpu.model} />
                    <Metric label="Uptime" value={fmtUptime(tel.uptimeSec)} />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--muted)]">Acquiring host telemetry…</div>
              )}
            </Panel>
          </div>

          {/* Containers + backends */}
          <div>
            <Panel title="Containers & Inference">
              <div className="space-y-3">
                <div>
                  <div className="label mb-1 text-[var(--muted)]">Docker</div>
                  {tel?.docker.available ? (
                    tel.docker.containers.length ? (
                      tel.docker.containers.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-[11px]">
                          <span className="hud-text truncate max-w-[60%]">{c.name}</span>
                          <span className="text-[var(--good)]">{c.state}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-[var(--muted)]">No running containers.</div>
                    )
                  ) : (
                    <div className="text-[11px] text-[var(--warn)]">{tel?.docker.note ?? "…"}</div>
                  )}
                </div>
                <div className="border-t border-[rgba(63,224,255,0.15)] pt-2">
                  <div className="label mb-1 text-[var(--muted)]">Inference backends</div>
                  {health?.backends.length ? (
                    health.backends.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] mb-1">
                        <span className="hud-text truncate max-w-[55%]" title={b.target}>
                          {b.target.replace(/^https?:\/\//, "")}
                        </span>
                        <StateDot state={b.state} />
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-[var(--muted)]">Probing…</div>
                  )}
                </div>
              </div>
            </Panel>
          </div>

          {/* Deployment */}
          <div>
            <Panel title="Deployment">
              <div className="space-y-2">
                <StateDot state={deployState === "running" ? "degraded" : deployState === "done" ? "online" : "unknown"} />
                <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                  {deployState === "armed" ? "Armed — confirm to ship."
                    : deployState === "running" ? "Pipeline running…"
                    : deployState === "done" ? "Last deploy succeeded."
                    : "Idle. Trigger via button or say ‘deploy post’."}
                </p>
              </div>
            </Panel>
          </div>

          {/* Device & browser control */}
          <div className="md:col-span-2">
            <BrowserControl />
          </div>

          {/* Web tool */}
          <div className="md:col-span-2">
            <WebTool />
          </div>

          {/* Fleet */}
          <div id="fleet" className="md:col-span-2">
            <Panel
              title="Cross-Device Fleet"
              badge={
                <span className="hud-text text-[9px] px-1.5 py-0.5 border tracking-widest"
                  style={{ color: "var(--muted)", borderColor: "var(--muted)" }}>
                  {devicesResp?.enrollmentEnabled ? "ENROLLMENT OPEN" : "ENROLLMENT OFF"}
                </span>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {devicesResp?.devices.map((d) => (
                  <div key={d.id} className="flex items-center justify-between border border-[rgba(63,224,255,0.18)] px-3 py-2">
                    <div>
                      <div className="text-[13px] text-[var(--text)]">{d.label}</div>
                      <div className="text-[10px] text-[var(--muted)] hud-text">{d.os}</div>
                    </div>
                    <StateDot state={d.state} />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[var(--muted)] mt-3 leading-relaxed">
                Devices appear only after explicit token-gated opt-in. SAHJONY does not
                push runtimes onto remote machines.
              </p>
            </Panel>
          </div>
        </div>
      </div>

      <footer className="text-[10px] text-[var(--muted)] mt-6 text-center tracking-widest uppercase">
        Live values measured on this host · simulated values flagged SIM · SAHJONY core online
      </footer>
    </main>
  );
}
