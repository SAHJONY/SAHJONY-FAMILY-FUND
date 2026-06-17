"use client";

import { useCallback, useRef, useState } from "react";
import { Panel } from "@/components/ui";

type Lang = "en" | "es";
interface Msg { role: "user" | "brain"; text: string; model?: string }

const T = {
  en: {
    title: "Analyst Brain", badge: "CLAUDE · OPENAI · GROQ",
    intro: "Ask about your book — positions, P&L, Greeks, the macro gate, a backtest, the news. It explains; it never tells you to trade.",
    placeholder: "e.g. Explain my net delta and theta…",
    send: "Ask", thinking: "Thinking…",
    suggestions: ["Summarize my book", "What is my biggest risk right now?", "Explain the macro gate", "What does my net delta mean?"],
  },
  es: {
    title: "Cerebro Analista", badge: "CLAUDE · OPENAI · GROQ",
    intro: "Pregunta sobre tu cartera — posiciones, P&L, griegas, el termómetro macro, un backtest, las noticias. Explica; nunca te dice que operes.",
    placeholder: "ej. Explica mi delta neto y theta…",
    send: "Preguntar", thinking: "Pensando…",
    suggestions: ["Resume mi cartera", "¿Cuál es mi mayor riesgo ahora?", "Explica el termómetro macro", "¿Qué significa mi delta neto?"],
  },
};

export default function FundBrain() {
  const [lang, setLang] = useState<Lang>("en");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = T[lang];

  const ask = useCallback(async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/fund/brain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, lang }) });
      const j = await r.json();
      setMsgs((m) => [...m, { role: "brain", text: j.answer || j.error || "—", model: j.model }]);
    } catch {
      setMsgs((m) => [...m, { role: "brain", text: "network error", model: "none" }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 50);
    }
  }, [busy, lang]);

  return (
    <Panel
      title={t.title}
      badge={
        <div className="flex items-center gap-2">
          <span className="text-[8px] tracking-widest text-[var(--muted)]">{t.badge}</span>
          <div className="flex border border-[rgba(63,224,255,0.3)]">
            {(["en", "es"] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)}
                className="text-[9px] px-1.5 py-0.5 uppercase tracking-widest"
                style={{ background: lang === l ? "var(--hud)" : "transparent", color: lang === l ? "#000" : "var(--muted)" }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="text-[10px] text-[var(--muted)] mb-2">{t.intro}</div>

      <div ref={scrollRef} className="space-y-2 max-h-72 overflow-auto mb-2">
        {msgs.length === 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {t.suggestions.map((s) => (
              <button key={s} onClick={() => ask(s)}
                className="text-[10px] px-2 py-1 border border-[rgba(63,224,255,0.25)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.08)]">
                {s}
              </button>
            ))}
          </div>
        ) : (
          msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : ""}>
              <div className={`inline-block text-[11px] px-2.5 py-1.5 max-w-[90%] text-left whitespace-pre-wrap ${m.role === "user" ? "border border-[rgba(255,194,75,0.4)] text-[var(--gold)]" : "border-l-2 border-[var(--hud)] bg-[rgba(63,224,255,0.04)] text-[var(--text)]"}`}>
                {m.text}
                {m.role === "brain" && m.model && m.model !== "none" && (
                  <div className="text-[8px] text-[var(--muted)] mt-1 uppercase tracking-widest">{m.model}</div>
                )}
              </div>
            </div>
          ))
        )}
        {busy && <div className="text-[10px] text-[var(--muted)]">{t.thinking}</div>}
      </div>

      <div className="flex gap-2">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(input); }}
          placeholder={t.placeholder} disabled={busy}
          className="flex-1 bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.3)] px-2 py-1.5 text-sm text-[var(--text)]"
        />
        <button onClick={() => ask(input)} disabled={busy}
          className="text-[11px] tracking-[0.15em] uppercase px-4 py-1.5 font-bold border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.08)] disabled:opacity-50">
          {busy ? t.thinking : t.send}
        </button>
      </div>
    </Panel>
  );
}
