"use client";

import { useState } from "react";
import { Panel } from "@/components/ui";

export default function Research() {
  const [url, setUrl] = useState("");
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);

  const run = async () => {
    if (!url.trim()) return;
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/tools/youtube", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, focus }) });
      setRes(await r.json());
    } catch (e) { setRes({ error: (e as Error).message }); }
    setBusy(false);
  };

  return (
    <Panel title="YouTube Research" badge={<span className="hud-text text-[9px] px-1.5 py-0.5 border tracking-widest" style={{ color: "var(--muted)", borderColor: "var(--muted)" }}>TRANSCRIPT</span>}>
      <div className="space-y-1.5 mb-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube URL…"
          className="w-full bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] hud-text text-[var(--text)] placeholder:text-[var(--muted)]" />
        <div className="flex gap-1.5">
          <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Focus (optional, e.g. 'cold buyer tactics')"
            className="flex-1 bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[11px] text-[var(--text)] placeholder:text-[var(--muted)]" />
          <button onClick={run} disabled={busy} className="px-3 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)] disabled:opacity-40">{busy ? "…" : "Analyze"}</button>
        </div>
      </div>
      {res && (
        <div className="text-[11px] space-y-1">
          {res.error ? <div className="text-[var(--bad)]">{res.error}</div> : (
            <>
              <div className="text-[var(--hud)]">{res.title}{res.author && <span className="text-[var(--muted)]"> · {res.author}</span>}</div>
              {res.hasTranscript ? (
                <div className="text-[var(--text)] leading-relaxed border-l-2 border-[var(--hud-dim)] pl-2 max-h-48 overflow-y-auto whitespace-pre-wrap">{res.analysis}</div>
              ) : (
                <div className="text-[var(--gold)]">{res.detail}</div>
              )}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
