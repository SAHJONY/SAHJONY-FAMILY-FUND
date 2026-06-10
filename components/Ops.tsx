"use client";

import { useState } from "react";
import { Panel } from "@/components/ui";

export default function Ops() {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/agent/ops", { cache: "no-store" });
      setData(await r.json());
    } catch (e) { setData({ briefing: (e as Error).message }); }
    setBusy(false);
  };

  return (
    <Panel
      title="Autonomous Ops Briefing"
      badge={
        <button onClick={run} disabled={busy} className="text-[9px] tracking-widest uppercase px-2 py-1 border border-[var(--gold)] text-[var(--gold)] disabled:opacity-40">
          {busy ? "Reviewing…" : "Run review"}
        </button>
      }
    >
      {!data ? (
        <div className="text-[11px] text-[var(--muted)] leading-relaxed">
          SAHJONY reviews your live pipeline (deals, grades, buyer matches, CRM) and
          returns the prioritized next moves. Real data only.
        </div>
      ) : (
        <div className="text-[12px] text-[var(--text)] leading-relaxed whitespace-pre-wrap">
          {data.briefing}
          {data.snapshot && (
            <div className="text-[9px] text-[var(--muted)] mt-2 uppercase tracking-wide">
              {data.snapshot.deals} deals · {data.snapshot.buyers} buyers · {data.snapshot.openContacts} open contacts
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
