"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LangProvider, LangToggle, useI18n } from "@/components/i18n";
import { Panel } from "@/components/ui";
import FundDashboard from "@/components/FundDashboard";
import FundBrain from "@/components/FundBrain";
import StrategyLab from "@/components/StrategyLab";

export interface SessionUser { id: string; name: string; email: string; plan: "free" | "pro"; isOwner: boolean }

function VaultPanel() {
  const { t } = useI18n();
  const [keys, setKeys] = useState<{ key: string; set: boolean; value: string }[]>([]);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const load = useCallback(async () => { const j = await (await fetch("/api/fund/vault")).json(); setKeys(j.keys || []); }, []);
  useEffect(() => { load(); }, [load]);
  const save = async (key: string) => {
    await fetch("/api/fund/vault", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, value: edit[key] ?? "" }) });
    setEdit((e) => ({ ...e, [key]: "" })); load();
  };
  return (
    <Panel title={t("myKeys")}>
      <div className="text-[10px] text-[var(--muted)] mb-2">{t("vaultNote")}</div>
      <div className="space-y-1.5">
        {keys.map((k) => (
          <div key={k.key} className="flex items-center gap-2">
            <span className="hud-text text-[10px] text-[var(--muted)] w-44 truncate">{k.key}</span>
            <span className="text-[9px] w-20" style={{ color: k.set ? "var(--good)" : "var(--muted)" }}>{k.set ? `✓ ${k.value}` : "—"}</span>
            <input type="password" value={edit[k.key] ?? ""} onChange={(e) => setEdit((s) => ({ ...s, [k.key]: e.target.value }))}
              placeholder={t("set")} className="flex-1 bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.25)] px-2 py-1 text-xs text-[var(--text)]" />
            <button onClick={() => save(k.key)} className="text-[9px] px-2 py-1 border border-[var(--good)] text-[var(--good)]">{t("saveKey")}</button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AccountBar({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const [msg, setMsg] = useState("");
  const [showKeys, setShowKeys] = useState(false);

  const upgrade = async () => {
    const r = await fetch("/api/billing/checkout", { method: "POST" });
    const j = await r.json();
    if (j.url) { window.location.href = j.url; return; }
    setMsg(j.configured === false ? "Billing isn't configured yet (owner: set Stripe keys)." : (j.error || "error"));
  };
  const logout = async () => { await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "logout" }) }); window.location.href = "/login"; };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2 border border-[rgba(63,224,255,0.2)] px-3 py-2 bg-[rgba(63,224,255,0.03)]">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[var(--text)]">{user.name}</span>
          <span className="text-[9px] px-1.5 py-0.5 border tracking-widest" style={{ color: user.plan === "pro" ? "var(--gold)" : "var(--muted)", borderColor: user.plan === "pro" ? "var(--gold)" : "var(--muted)" }}>
            {user.plan === "pro" ? t("planPro") : t("planFree")}
          </span>
          {user.isOwner && <Link href="/admin" className="text-[9px] px-1.5 py-0.5 border border-[rgba(255,194,75,0.4)] text-[var(--gold)] tracking-widest">OWNER ⚙</Link>}
        </div>
        <div className="flex items-center gap-2">
          {user.plan === "free" && (
            <button onClick={upgrade} className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 font-bold border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.08)]">{t("upgrade")}</button>
          )}
          <button onClick={() => setShowKeys((s) => !s)} className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 border border-[rgba(63,224,255,0.3)] text-[var(--hud)]">{t("myKeys")}</button>
          <LangToggle />
          <button onClick={logout} className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 border border-[rgba(255,255,255,0.2)] text-[var(--muted)] hover:text-[var(--text)]">{t("logout")}</button>
        </div>
      </div>
      {msg && <div className="text-[10px] text-[var(--gold)]">{msg} {user.plan === "free" && <span className="text-[var(--muted)]">— {t("upgradeNote")}</span>}</div>}
      {showKeys && <VaultPanel />}
    </div>
  );
}

export default function FundApp({ user }: { user: SessionUser }) {
  return (
    <LangProvider>
      <div className="mb-4 flex items-center gap-4">
        <Link href="/" className="text-[11px] tracking-[0.2em] uppercase text-[var(--muted)] hover:text-[var(--hud)]">‹ Control Plane</Link>
      </div>
      <AccountBar user={user} />
      <div className="my-4" />
      <FundDashboard />
      <div className="my-6 border-t border-[rgba(63,224,255,0.15)]" />
      <FundBrain />
      <div className="my-6 border-t border-[rgba(63,224,255,0.15)]" />
      <StrategyLab />
    </LangProvider>
  );
}
