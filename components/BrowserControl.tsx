"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";

interface SessionStatus {
  authorized: boolean;
  running: boolean;
  url: string | null;
  log: { t: number; action: string; detail: string; ok: boolean }[];
  engineError: string | null;
}
interface AgentResult {
  status: string;
  answer?: string;
  message?: string;
  reason?: string;
  proposedAction?: any;
  transcript?: { action: any; ok: boolean; detail: string }[];
  screenshot?: string | null;
  url?: string;
}

export default function BrowserControl() {
  const [s, setS] = useState<SessionStatus | null>(null);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [shot, setShot] = useState<string | null>(null);

  const loadStatus = async () => {
    const r = await fetch("/api/control/session", { cache: "no-store" });
    setS(await r.json());
  };
  useEffect(() => { loadStatus(); const id = setInterval(loadStatus, 5000); return () => clearInterval(id); }, []);

  const setAuth = async (authorize: boolean) => {
    await fetch("/api/control/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorize }),
    });
    loadStatus();
  };

  const runAgent = async (preApproved?: any) => {
    setBusy(true);
    if (!preApproved) setResult(null);
    try {
      const r = await fetch("/api/control/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, ...(preApproved ? { preApproved } : {}) }),
      });
      const j: AgentResult = await r.json();
      setResult(j);
      if (j.screenshot) setShot(j.screenshot);
    } catch (e) {
      setResult({ status: "error", message: (e as Error).message });
    }
    setBusy(false);
    loadStatus();
  };

  const authorized = s?.authorized;

  return (
    <Panel
      title="Device & Browser Control"
      badge={
        <span className="inline-flex items-center gap-1.5 text-[10px] tracking-widest uppercase">
          <span className="w-2 h-2 rounded-full" style={{
            background: authorized ? "var(--good)" : "var(--muted)",
            boxShadow: authorized ? "0 0 8px var(--good)" : "none",
          }} />
          <span style={{ color: authorized ? "var(--good)" : "var(--muted)" }}>
            {authorized ? "authorized" : "locked"}
          </span>
        </span>
      }
    >
      {s?.engineError && (
        <div className="text-[11px] text-[var(--bad)] mb-2">Engine: {s.engineError}</div>
      )}

      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[var(--muted)]">
          {authorized ? "SAHJONY may operate this browser." : "Authorize to let SAHJONY act."}
        </span>
        <button onClick={() => setAuth(!authorized)}
          className={`text-[10px] tracking-widest uppercase px-3 py-1.5 border ${
            authorized ? "border-[var(--bad)] text-[var(--bad)]" : "border-[var(--good)] text-[var(--good)]"
          } hover:opacity-80`}>
          {authorized ? "Revoke" : "Authorize"}
        </button>
      </div>

      <div className="flex gap-2 mb-2">
        <input value={goal} onChange={(e) => setGoal(e.target.value)} disabled={!authorized}
          onKeyDown={(e) => e.key === "Enter" && goal && runAgent()}
          placeholder="Goal, e.g. “open example.com and read the heading”"
          className="flex-1 bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)] disabled:opacity-40" />
        <button onClick={() => runAgent()} disabled={!authorized || busy || !goal}
          className="px-3 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)] disabled:opacity-40">
          {busy ? "…" : "Run"}
        </button>
      </div>

      {shot && (
        <div className="border border-[rgba(63,224,255,0.2)] mb-2 overflow-hidden">
          {/* live view of what SAHJONY sees */}
          <img src={shot} alt="browser view" className="w-full block" />
        </div>
      )}

      {result?.status === "awaiting_confirmation" && (
        <div className="border border-[var(--gold)] p-2 mb-2 gold-glow">
          <div className="text-[11px] text-[var(--gold)] mb-1 tracking-widest uppercase">⚠ Confirmation required</div>
          <div className="text-[11px] text-[var(--muted)] mb-1">{result.reason}</div>
          <div className="hud-text text-[11px] text-[var(--text)] mb-2">
            {result.proposedAction?.action} {result.proposedAction?.selector || result.proposedAction?.text || result.proposedAction?.url}
          </div>
          <div className="flex gap-2">
            <button onClick={() => runAgent(result.proposedAction)}
              className="text-[10px] tracking-widest uppercase px-3 py-1 border border-[var(--gold)] text-[var(--gold)]">Approve</button>
            <button onClick={() => setResult(null)}
              className="text-[10px] tracking-widest uppercase px-3 py-1 border border-[var(--bad)] text-[var(--bad)]">Deny</button>
          </div>
        </div>
      )}

      {result && result.status !== "awaiting_confirmation" && (
        <div className="text-[11px] mb-2">
          <span className="uppercase tracking-widest" style={{
            color: result.status === "done" ? "var(--good)" : result.status === "error" ? "var(--bad)" : "var(--gold)",
          }}>{result.status}</span>
          {result.answer && <span className="text-[var(--text)]"> — {result.answer}</span>}
          {result.message && <span className="text-[var(--muted)]"> — {result.message}</span>}
        </div>
      )}

      {s?.log?.length ? (
        <div className="hud-text text-[10px] space-y-0.5 max-h-24 overflow-y-auto border-t border-[rgba(63,224,255,0.15)] pt-2">
          {s.log.slice(0, 8).map((l, i) => (
            <div key={i} className="flex gap-2">
              <span style={{ color: l.ok ? "var(--good)" : "var(--bad)" }}>●</span>
              <span className="text-[var(--hud)]">{l.action}</span>
              <span className="text-[var(--muted)] truncate">{l.detail}</span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="text-[9px] text-[var(--muted)] mt-2 tracking-wide uppercase leading-relaxed">
        Local device only · explicit authorization · sensitive actions (buy/send/login/delete) always confirm
      </p>
    </Panel>
  );
}
