"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import type { SystemStatus, PublicUser } from "@/lib/fund/admin";

interface SecretRow { key: string; value: string; masked: boolean; set: boolean }
interface AdminData { status: SystemStatus; users: PublicUser[]; secrets: SecretRow[] }

const dot = (ok: boolean) => (ok ? "var(--good)" : "var(--muted)");

export default function OwnerConsole() {
  const [ownerKey, setOwnerKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [data, setData] = useState<AdminData | null>(null);
  const [err, setErr] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editVal, setEditVal] = useState("");

  const headers = useCallback(() => ({ "content-type": "application/json", "x-owner-key": ownerKey }), [ownerKey]);

  const load = useCallback(async () => {
    setErr("");
    const r = await fetch("/api/fund/admin", { headers: { "x-owner-key": ownerKey }, cache: "no-store" });
    if (r.status === 403) { setErr("Access denied — owner key required."); setUnlocked(false); return; }
    const j = await r.json();
    setData(j); setUnlocked(true);
  }, [ownerKey]);

  useEffect(() => { load(); /* try dev-open access once on mount */ }, []); // eslint-disable-line

  const act = useCallback(async (body: object) => {
    const r = await fetch("/api/fund/admin", { method: "POST", headers: headers(), body: JSON.stringify(body) });
    if (r.status === 403) { setErr("Access denied."); return; }
    await load();
  }, [headers, load]);

  if (!unlocked) {
    return (
      <Panel title="Owner Console · Locked">
        <div className="text-[11px] text-[var(--muted)] mb-2">Enter the owner key to take control. (Set <code className="text-[var(--hud)]">OWNER_KEY</code> in env; in local dev the console opens without one.)</div>
        <div className="flex gap-2">
          <input type="password" value={ownerKey} onChange={(e) => setOwnerKey(e.target.value)} placeholder="OWNER_KEY"
            className="flex-1 bg-[var(--hud-deep)] border border-[rgba(255,194,75,0.4)] px-2 py-1.5 text-sm text-[var(--text)]" />
          <button onClick={load} className="text-[11px] tracking-[0.2em] uppercase px-4 py-1.5 font-bold border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.08)]">Unlock</button>
        </div>
        {err && <div className="text-[10px] text-[var(--bad)] mt-2">{err}</div>}
      </Panel>
    );
  }

  const s = data!.status;
  return (
    <div className="space-y-4">
      <div className="border border-[rgba(255,194,75,0.4)] bg-[rgba(255,194,75,0.05)] px-3 py-2">
        <div className="text-[var(--gold)] text-xs font-bold tracking-wider">OWNER CONSOLE · TOTAL CONTROL</div>
        <div className="text-[10px] text-[var(--muted)]">SAHJONY CAPITAL LLC · engines, data feeds, datastore, billing, and every user account.</div>
      </div>

      {/* System status */}
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Engine Chain (Brain)">
          {s.engines.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-1 border-t border-[rgba(63,224,255,0.08)] first:border-0">
              <span className="text-[11px] text-[var(--text)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: dot(e.configured), boxShadow: `0 0 6px ${dot(e.configured)}` }} />
                {e.label}
              </span>
              <span className="text-[9px] text-[var(--muted)] uppercase tracking-wider">{e.role} · {e.configured ? "ready" : "no key"}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Infrastructure">
          {[
            { l: "Data: Yahoo", ok: s.dataFeeds[0].configured, note: "primary" },
            { l: "Data: Alpaca", ok: s.dataFeeds[1].configured, note: s.dataFeeds[1].configured ? "ready" : "no key" },
            { l: `Datastore: ${s.datastore.backend}`, ok: s.datastore.durable, note: s.datastore.durable ? "durable" : "ephemeral" },
            { l: "Stripe billing", ok: s.billing.stripeConfigured, note: s.billing.stripeConfigured ? "ready" : "no key" },
            { l: "Pro price ID", ok: s.billing.priceConfigured, note: s.billing.priceConfigured ? "set" : "unset" },
            { l: "Session secret", ok: s.security.sessionSecretSet, note: s.security.sessionSecretSet ? "set" : "DEV default" },
            { l: "Owner key", ok: s.security.ownerKeySet, note: s.security.ownerKeySet ? "set" : "open (dev)" },
          ].map((r) => (
            <div key={r.l} className="flex items-center justify-between py-1 border-t border-[rgba(63,224,255,0.08)] first:border-0">
              <span className="text-[11px] text-[var(--text)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: dot(r.ok), boxShadow: `0 0 6px ${dot(r.ok)}` }} />{r.l}
              </span>
              <span className="text-[9px] text-[var(--muted)] uppercase tracking-wider">{r.note}</span>
            </div>
          ))}
        </Panel>
      </div>

      {/* Users */}
      <Panel title="Users" badge={<span className="text-[10px] text-[var(--muted)]">{s.users.total} total · {s.users.byPlan.pro || 0} pro · {s.users.byStatus.suspended || 0} suspended</span>}>
        {data!.users.length === 0 ? (
          <div className="text-[11px] text-[var(--muted)]">No accounts yet. The first person to register becomes an owner automatically.</div>
        ) : (
          <table className="w-full text-[11px]">
            <thead><tr className="text-[9px] uppercase text-[var(--muted)] text-left"><th className="py-1">User</th><th>Plan</th><th>Status</th><th>Role</th><th className="text-right">Controls</th></tr></thead>
            <tbody>
              {data!.users.map((u) => (
                <tr key={u.id} className="border-t border-[rgba(63,224,255,0.08)]">
                  <td className="py-1.5 text-[var(--text)]">{u.name}<div className="text-[9px] text-[var(--muted)]">{u.email}</div></td>
                  <td><span style={{ color: u.plan === "pro" ? "var(--gold)" : "var(--muted)" }}>{u.plan.toUpperCase()}</span></td>
                  <td><span style={{ color: u.status === "active" ? "var(--good)" : "var(--bad)" }}>{u.status}</span></td>
                  <td className="text-[var(--muted)]">{u.isOwner ? "OWNER" : "member"}</td>
                  <td className="text-right space-x-1">
                    <button onClick={() => act({ action: "set_plan", id: u.id, plan: u.plan === "pro" ? "free" : "pro" })} className="text-[9px] px-1.5 py-0.5 border border-[rgba(255,194,75,0.4)] text-[var(--gold)]">{u.plan === "pro" ? "→Free" : "→Pro"}</button>
                    <button onClick={() => act({ action: "set_status", id: u.id, status: u.status === "active" ? "suspended" : "active" })} className="text-[9px] px-1.5 py-0.5 border border-[rgba(63,224,255,0.3)] text-[var(--hud)]">{u.status === "active" ? "Suspend" : "Activate"}</button>
                    <button onClick={() => { if (confirm(`Delete ${u.email}?`)) act({ action: "delete_user", id: u.id }); }} className="text-[9px] px-1.5 py-0.5 border border-[rgba(255,80,80,0.4)] text-[var(--bad)]">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Secret / key management */}
      <Panel title="Keys & Environment" badge={<span className="text-[9px] text-[var(--muted)]">runtime overlay · prod durable keys go in Vercel env</span>}>
        <div className="flex flex-wrap items-end gap-2 mb-3">
          <input list="known-keys" value={editKey} onChange={(e) => setEditKey(e.target.value)} placeholder="KEY_NAME"
            className="w-56 bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.3)] px-2 py-1.5 text-sm text-[var(--text)] hud-text" />
          <datalist id="known-keys">{data!.secrets.map((r) => <option key={r.key} value={r.key} />)}</datalist>
          <input type="password" value={editVal} onChange={(e) => setEditVal(e.target.value)} placeholder="value (blank = delete)"
            className="flex-1 min-w-[180px] bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.3)] px-2 py-1.5 text-sm text-[var(--text)]" />
          <button onClick={() => { act({ action: "set_secret", key: editKey, value: editVal }); setEditVal(""); }}
            className="text-[11px] tracking-[0.15em] uppercase px-4 py-1.5 font-bold border border-[var(--good)] text-[var(--good)] hover:bg-[rgba(80,255,160,0.08)]">Save key</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 max-h-64 overflow-auto">
          {data!.secrets.map((r) => (
            <div key={r.key} className="flex items-center justify-between text-[10px] border-b border-[rgba(63,224,255,0.06)] py-0.5">
              <span className="hud-text text-[var(--muted)]">{r.key}</span>
              <span style={{ color: r.set ? "var(--good)" : "var(--muted)" }}>{r.set ? (r.masked ? r.value : "set") : "—"}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
