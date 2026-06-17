"use client";

import { useState } from "react";
import { LangProvider, LangToggle, useI18n } from "@/components/i18n";

function LoginInner() {
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: mode === "login" ? "login" : "register", email, name, password }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "failed"); return; }
      window.location.href = "/fund";
    } catch { setErr("network error"); } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm hud-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="hud-text text-lg text-[var(--gold)] tracking-wider">SAHJONY CAPITAL LLC</h1>
            <a href="https://www.sahjonycapital.com" className="text-[10px] text-[var(--hud)] hover:underline">www.sahjonycapital.com</a>
          </div>
          <LangToggle />
        </div>

        <div className="flex border border-[rgba(63,224,255,0.3)]">
          {(["login", "register"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }}
              className="flex-1 text-[11px] py-2 uppercase tracking-widest"
              style={{ background: mode === m ? "var(--hud)" : "transparent", color: mode === m ? "#000" : "var(--muted)" }}>
              {m === "login" ? t("signIn") : t("register")}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {mode === "register" && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name")}
              className="w-full bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.3)] px-3 py-2 text-sm text-[var(--text)]" />
          )}
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("email")} type="email"
            className="w-full bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.3)] px-3 py-2 text-sm text-[var(--text)]" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("password")} type="password"
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            className="w-full bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.3)] px-3 py-2 text-sm text-[var(--text)]" />
        </div>

        {err && <div className="text-[11px] text-[var(--bad)]">{err}</div>}

        <button onClick={submit} disabled={busy}
          className="w-full text-[12px] tracking-[0.2em] uppercase py-2.5 font-bold border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.08)] disabled:opacity-50">
          {busy ? "…" : (mode === "login" ? t("signIn") : t("register"))}
        </button>

        <p className="text-[10px] text-[var(--muted)] text-center">{t("loginCta")}</p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <LangProvider><LoginInner /></LangProvider>;
}
