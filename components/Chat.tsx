"use client";

import { useEffect, useRef, useState } from "react";
import { askHermes, type ChatMsg } from "@/lib/ask";

export interface ChatHandle {
  ask: (text: string, speak: (t: string) => void) => Promise<string>;
}

export default function Chat({
  registerAsk,
}: {
  // Lets the voice engine push utterances into the same conversation.
  registerAsk?: (fn: ChatHandle["ask"]) => void;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "assistant", content: "Systems online, sir. SAHJONY at your service." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text: string, speak?: (t: string) => void): Promise<string> => {
    const clean = text.trim();
    if (!clean || busy) return "";
    const history: ChatMsg[] = [...msgs, { role: "user", content: clean }];
    // Push the user message + an empty assistant bubble that fills in live.
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    // Route the conversation through the Hermes brain — it answers AND can
    // execute real actions (create lead, run finder, add buyer, etc.).
    const { reply, action } = await askHermes(clean);
    setModel(action ? `hermes · ${action}` : "hermes");
    setMsgs((cur) => {
      const copy = cur.slice();
      copy[copy.length - 1] = { role: "assistant", content: reply };
      return copy;
    });
    setBusy(false);
    speak?.(reply);
    return reply;
  };

  useEffect(() => {
    registerAsk?.((text, speak) => send(text, speak));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs, busy]);

  return (
    <div className="hud-panel p-4 flex flex-col h-full min-h-[320px]">
      <div className="flex items-center justify-between mb-2">
        <span className="label flex items-center gap-2">
          <span className="text-[var(--gold)]">▸</span> SAHJONY · DIRECT LINK
        </span>
        {model && (
          <span className="hud-text text-[9px] text-[var(--muted)]">{model.split("/").pop()}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3 text-sm">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[88%] px-3 py-1.5 text-[13px] leading-relaxed border ${
                m.role === "user"
                  ? "border-[var(--gold-dim)] text-[var(--gold)] bg-[rgba(255,194,75,0.05)]"
                  : "border-[rgba(63,224,255,0.25)] text-[var(--text)] bg-[rgba(63,224,255,0.04)]"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="text-[var(--hud)] text-[12px] tracking-widest blink">SAHJONY IS THINKING…</div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Speak to SAHJONY, sir…"
          className="flex-1 bg-transparent border border-[rgba(63,224,255,0.25)] px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--muted)]"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-2 text-[11px] tracking-widest uppercase border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)] disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
