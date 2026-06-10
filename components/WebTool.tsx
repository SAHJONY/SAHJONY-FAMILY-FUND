"use client";

import { useState } from "react";
import { Panel } from "@/components/ui";

interface ScrapeResult { title?: string; excerpt?: string; length?: number; status?: number; error?: string; url?: string }

export default function WebTool() {
  const [url, setUrl] = useState("");
  const [res, setRes] = useState<ScrapeResult | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!url.trim()) return;
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/tools/scrape", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      setRes(await r.json());
    } catch (e) {
      setRes({ error: (e as Error).message });
    }
    setBusy(false);
  };

  return (
    <Panel
      title="Web Recon · Transparent"
      badge={<span className="hud-text text-[9px] px-1.5 py-0.5 border tracking-widest"
        style={{ color: "var(--muted)", borderColor: "var(--muted)" }}>ROBOTS-AWARE</span>}
    >
      <div className="flex gap-2 mb-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="https://example.com"
          className="flex-1 bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] hud-text text-[var(--text)] placeholder:text-[var(--muted)]" />
        <button onClick={run} disabled={busy}
          className="px-3 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)] disabled:opacity-40">
          {busy ? "…" : "Fetch"}
        </button>
      </div>
      {res && (
        <div className="text-[11px] space-y-1">
          {res.error ? (
            <div className="text-[var(--bad)]">{res.error}</div>
          ) : (
            <>
              <div className="text-[var(--hud)] truncate">{res.title || "(no title)"}</div>
              <div className="text-[var(--muted)] hud-text leading-relaxed max-h-28 overflow-y-auto">
                {res.excerpt?.slice(0, 600)}…
              </div>
              <div className="text-[9px] text-[var(--muted)] uppercase tracking-widest">
                {res.length?.toLocaleString()} chars · HTTP {res.status}
              </div>
            </>
          )}
        </div>
      )}
      <p className="text-[9px] text-[var(--muted)] mt-2 tracking-wide uppercase">
        Honest user-agent · public pages only · no evasion, no people-tracing
      </p>
    </Panel>
  );
}
