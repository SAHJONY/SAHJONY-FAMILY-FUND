"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Msg { uid: number; from: string; fromName: string; subject: string; date: string | null; seen: boolean }
interface FullMsg { uid: number; from: string; to: string; subject: string; date: string | null; text: string; html: string | null; messageId: string }

const F = "bg-transparent border border-[rgba(63,224,255,0.25)] px-2 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]";

export default function EmailPage() {
  const [status, setStatus] = useState<{ connected: boolean; from?: string } | null>(null);
  const [inbox, setInbox] = useState<{ connected: boolean; mailbox?: string; messages?: Msg[]; error?: string; detail?: string } | null>(null);
  const [open, setOpen] = useState<FullMsg | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(false);

  // compose
  const [to, setTo] = useState(""); const [subject, setSubject] = useState(""); const [text, setText] = useState("");
  const [inReplyTo, setInReplyTo] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(""); const [drafting, setDrafting] = useState(false);

  const loadStatus = async () => setStatus(await (await fetch("/api/email")).json());
  const loadInbox = async () => { setInbox({ connected: true, messages: undefined }); setInbox(await (await fetch("/api/email/inbox", { cache: "no-store" })).json()); };
  useEffect(() => { loadStatus(); loadInbox(); }, []);

  const openMsg = async (uid: number) => {
    setLoadingMsg(true); setOpen(null);
    const j = await (await fetch(`/api/email/message?uid=${uid}`)).json();
    setOpen(j.error ? null : j); setLoadingMsg(false);
    if (!j.error) setInbox((cur) => cur ? { ...cur, messages: cur.messages?.map((m) => m.uid === uid ? { ...m, seen: true } : m) } : cur);
  };

  const startReply = (m: FullMsg) => {
    setComposing(true); setTo(m.from.replace(/.*<(.+)>.*/, "$1")); setSubject(m.subject.startsWith("Re:") ? m.subject : `Re: ${m.subject}`);
    setText(`\n\n--- On ${m.date ? new Date(m.date).toLocaleString() : ""}, ${m.from} wrote: ---\n${(m.text || "").split("\n").map((l) => "> " + l).join("\n")}`);
    setInReplyTo(m.messageId || null);
  };
  const newEmail = () => { setComposing(true); setTo(""); setSubject(""); setText(""); setInReplyTo(null); setSendMsg(null); };

  const aiDraft = async () => {
    setDrafting(true);
    const j = await (await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "draft", to, prompt: aiPrompt }) })).json();
    const d = j.draft ?? "";
    const lines = d.split("\n");
    const subj = lines[0].match(/^subject:\s*(.*)/i)?.[1];
    if (subj) { setSubject(subj); setText(lines.slice(1).join("\n").trim()); } else setText(d);
    setDrafting(false);
  };

  const send = async () => {
    setSendMsg("Sending…");
    const j = await (await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, subject, text, consent, inReplyTo }) })).json();
    setSendMsg(j.ok ? "Sent ✓" : (j.error ?? "Failed"));
    if (j.ok) setTimeout(() => { setComposing(false); setSendMsg(null); }, 1200);
  };

  return (
    <main className="relative z-10 max-w-6xl mx-auto px-5 py-7">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl tracking-[0.2em] text-[var(--hud)]" style={{ textShadow: "0 0 14px rgba(63,224,255,0.5)" }}>SAHJONY MAIL</h1>
        <div className="flex gap-2 items-center">
          <span className="text-[10px] text-[var(--muted)] uppercase tracking-widest">{status?.connected ? `out: ${status.from}` : "smtp off"}{inbox?.mailbox ? ` · in: ${inbox.mailbox}` : ""}</span>
          <button onClick={newEmail} className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--gold)] text-[var(--gold)]">✎ Compose</button>
          <Link href="/" className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--hud)] text-[var(--hud)]">← Control Plane</Link>
        </div>
      </div>

      {(inbox && !inbox.connected) && (
        <div className="hud-panel p-3 mb-4 text-[11px] text-[var(--gold)]">
          {inbox.detail ?? "Email not connected."} Set SMTP_HOST/USER/PASS and IMAP_HOST/USER/PASS on the <Link href="/env" className="text-[var(--hud)]">env page</Link>.
          (Gmail: use an App Password, host smtp.gmail.com / imap.gmail.com.)
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inbox */}
        <section className="hud-panel p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="label text-[var(--gold)]">▸ Inbox</h2>
            <button onClick={loadInbox} className="text-[10px] tracking-widest uppercase text-[var(--hud)]">↻ Refresh</button>
          </div>
          {inbox?.error && <div className="text-[11px] text-[var(--bad)]">{inbox.error}</div>}
          <div className="space-y-1 max-h-[520px] overflow-y-auto">
            {!inbox?.messages ? <span className="text-[11px] text-[var(--muted)]">Loading…</span> :
              inbox.messages.length === 0 ? <span className="text-[11px] text-[var(--muted)]">Inbox empty.</span> :
              inbox.messages.map((m) => (
                <button key={m.uid} onClick={() => openMsg(m.uid)}
                  className={`w-full text-left px-2 py-1.5 border ${open?.uid === m.uid ? "border-[var(--hud)] hud-glow" : "border-[rgba(63,224,255,0.12)]"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[12px] truncate ${m.seen ? "text-[var(--muted)]" : "text-[var(--text)]"}`}>{m.fromName || m.from}</span>
                    {!m.seen && <span className="w-1.5 h-1.5 rounded-full bg-[var(--hud)]" />}
                  </div>
                  <div className={`text-[11px] truncate ${m.seen ? "text-[var(--muted)]" : "text-[var(--text)]"}`}>{m.subject}</div>
                  <div className="text-[9px] text-[var(--muted)]">{m.date ? new Date(m.date).toLocaleString() : ""}</div>
                </button>
              ))}
          </div>
        </section>

        {/* Reader / Composer */}
        <section className="hud-panel p-3">
          {composing ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <h2 className="label text-[var(--gold)]">▸ {inReplyTo ? "Reply" : "Compose"}</h2>
                <button onClick={() => setComposing(false)} className="text-[10px] text-[var(--muted)]">✕ close</button>
              </div>
              <input className={`${F} w-full mb-2`} placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
              <input className={`${F} w-full mb-2`} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <div className="flex gap-2 mb-2">
                <input className={`${F} flex-1`} placeholder="Ask SAHJONY to draft it…" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
                <button onClick={aiDraft} disabled={drafting} className="text-[10px] tracking-widest uppercase px-2 border border-[var(--hud)] text-[var(--hud)] disabled:opacity-40">{drafting ? "…" : "Draft"}</button>
              </div>
              <textarea className={`${F} w-full h-56 mb-2`} placeholder="Message…" value={text} onChange={(e) => setText(e.target.value)} />
              <label className="flex items-center gap-2 text-[10px] text-[var(--gold)] mb-2">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> Confirm send (SAHJONY never sends without your go-ahead).
              </label>
              <div className="flex items-center gap-3">
                <button onClick={send} disabled={!consent || !to} className="text-[11px] tracking-widest uppercase px-4 py-1.5 border border-[var(--good)] text-[var(--good)] disabled:opacity-40">Send</button>
                {sendMsg && <span className="text-[11px] text-[var(--text)]">{sendMsg}</span>}
              </div>
            </>
          ) : loadingMsg ? <span className="text-[11px] text-[var(--muted)]">Opening…</span> :
            open ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[14px] text-[var(--text)] truncate pr-2">{open.subject}</h2>
                  <button onClick={() => startReply(open)} className="text-[10px] tracking-widest uppercase px-2 py-1 border border-[var(--gold)] text-[var(--gold)] whitespace-nowrap">↩ Reply</button>
                </div>
                <div className="text-[10px] text-[var(--muted)] mb-2 hud-text">From: {open.from}<br />Date: {open.date ? new Date(open.date).toLocaleString() : ""}</div>
                <div className="text-[12px] text-[var(--text)] whitespace-pre-wrap leading-relaxed max-h-[460px] overflow-y-auto border-t border-[rgba(63,224,255,0.15)] pt-2">{open.text || "(no text body)"}</div>
              </>
            ) : <span className="text-[11px] text-[var(--muted)]">Select a message, or hit Compose.</span>}
        </section>
      </div>
    </main>
  );
}
