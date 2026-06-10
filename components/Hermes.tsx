"use client";

import { useState } from "react";

interface HermesResp {
  action: string; ok: boolean; speak: string; data?: any;
  needsConfirmation?: { kind: string; reason: string; params: any };
}

// Hermes command bar — type one instruction, Hermes routes it to a real action.
export default function Hermes() {
  const [cmd, setCmd] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<HermesResp | null>(null);

  const run = async () => {
    if (!cmd.trim() || busy) return;
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/hermes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: cmd }) });
      const j: HermesResp = await r.json();
      setRes(j);
      if (j.speak && typeof window !== "undefined" && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(j.speak); u.rate = 1.03;
        window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
      }
    } catch (e) { setRes({ action: "error", ok: false, speak: (e as Error).message }); }
    setBusy(false); setCmd("");
  };

  return (
    <section className="hud-panel hud-glow p-4 flicker-in scanbar">
      <div className="flex items-center justify-between mb-2">
        <h2 className="label flex items-center gap-2"><span className="text-[var(--gold)]">◆</span> Hermes · Orchestration Brain</h2>
        <span className="text-[9px] text-[var(--muted)] tracking-widest uppercase">frontend ⇄ backend</span>
      </div>
      <div className="flex gap-2">
        <input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Command Hermes — e.g. “add a lead at 123 Main St Austin TX”, “run the deal finder”, “what's my pipeline?”"
          className="flex-1 bg-transparent border border-[rgba(63,224,255,0.3)] px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--muted)]" />
        <button onClick={run} disabled={busy} className="px-4 text-[11px] tracking-widest uppercase border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.08)] disabled:opacity-40">
          {busy ? "…" : "Execute"}
        </button>
      </div>
      {res && (
        <div className="mt-3 text-[12px] space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border" style={{ color: res.ok ? "var(--good)" : "var(--bad)", borderColor: res.ok ? "var(--good)" : "var(--bad)" }}>{res.action}</span>
            <span className="text-[var(--text)]">{res.speak}</span>
          </div>
          {res.needsConfirmation && (
            <div className="text-[11px] text-[var(--gold)] border border-[rgba(255,194,75,0.3)] p-2">⚠ {res.needsConfirmation.reason} — use the Tools page to send with consent.</div>
          )}
          {res.data && (
            <pre className="text-[10px] text-[var(--muted)] hud-text whitespace-pre-wrap max-h-32 overflow-y-auto border-t border-[rgba(63,224,255,0.15)] pt-1">{JSON.stringify(res.data, null, 1).slice(0, 800)}</pre>
          )}
        </div>
      )}
    </section>
  );
}
