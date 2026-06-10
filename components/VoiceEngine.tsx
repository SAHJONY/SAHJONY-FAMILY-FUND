"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseIntent, type IntentName } from "@/lib/intent";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

// Minimal typings for the Web Speech API (not in the DOM lib by default).
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

export default function VoiceEngine({
  onIntent,
  onConverse,
}: {
  onIntent: (intent: IntentName, raw: string, confidence: number) => string | void;
  // Called for free-form speech that isn't a dashboard command, so SAHJONY can
  // answer conversationally. It receives the speak() fn to voice its reply.
  onConverse?: (text: string, speak: (t: string) => void) => void;
}) {
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [lastIntent, setLastIntent] = useState<string>("");
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListening = useRef(false);
  // While true, recognition auto-restart is suspended (we're thinking/speaking);
  // speak()'s onend lifts it and re-opens the mic — the continuous loop.
  const suspendRef = useRef(false);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    setState("speaking");
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 1.0;
    u.onend = () => {
      // Reply finished — lift the suspension and re-open the mic for the next turn.
      suspendRef.current = false;
      if (wantListening.current) {
        try {
          recogRef.current?.start();
          setState("listening");
        } catch {
          setState("listening");
        }
      } else {
        setState("idle");
      }
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const r: SpeechRecognitionLike = new Ctor();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = true;

    r.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      if (final) {
        // Suspend auto-restart for this turn; speak()'s onend resumes the loop.
        suspendRef.current = true;
        setState("processing");
        const result = parseIntent(final);
        setLastIntent(`${result.intent} · ${(result.confidence * 100) | 0}%`);
        // Confident command → run it. Otherwise hand to SAHJONY to converse.
        if (result.intent !== "UNKNOWN" && result.confidence >= 0.5) {
          const reply = onIntent(result.intent, result.raw, result.confidence);
          speak(typeof reply === "string" ? reply : result.response);
        } else if (onConverse) {
          onConverse(result.raw, speak);
        } else {
          speak(result.response);
        }
      }
    };
    r.onerror = () => { if (!suspendRef.current) setState("idle"); };
    r.onend = () => {
      // Don't restart while a turn is being processed/spoken — that path resumes
      // the mic itself. Otherwise keep the continuous loop alive.
      if (wantListening.current && !suspendRef.current) {
        try {
          r.start();
        } catch {
          /* already started */
        }
      } else if (!wantListening.current) {
        setState("idle");
      }
    };
    recogRef.current = r;
    return () => {
      wantListening.current = false;
      try {
        r.stop();
      } catch {
        /* noop */
      }
    };
  }, [onIntent, speak]);

  const toggle = () => {
    const r = recogRef.current;
    if (!r) return;
    if (wantListening.current) {
      wantListening.current = false;
      r.stop();
      setState("idle");
    } else {
      wantListening.current = true;
      try {
        r.start();
        setState("listening");
      } catch {
        /* noop */
      }
    }
  };

  if (!supported) {
    return (
      <div className="hud-panel p-4 text-sm">
        <div className="text-[var(--warn)] font-semibold mb-1 label">Voice unavailable</div>
        <p className="text-[var(--muted)] text-xs">
          This browser does not expose the Web Speech API. Use Chrome or Safari for
          hands-free control.
        </p>
      </div>
    );
  }

  const dot =
    state === "listening" ? "var(--good)" :
    state === "processing" ? "var(--warn)" :
    state === "speaking" ? "var(--hud)" : "var(--muted)";

  return (
    <div className="hud-panel p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${state !== "idle" ? "blink" : ""}`}
            style={{ background: dot, boxShadow: `0 0 8px ${dot}` }}
          />
          <span className="label">SAHJONY · VOICE</span>
          <span className="text-[10px] text-[var(--muted)] uppercase tracking-widest">{state}</span>
        </div>
        <button
          onClick={toggle}
          className="text-[11px] tracking-widest uppercase px-3 py-1.5 border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.1)] transition-colors"
        >
          {wantListening.current ? "Stop" : "Listen"}
        </button>
      </div>
      <div className="hud-text text-xs text-[var(--muted)] min-h-[2.5rem] leading-relaxed">
        {transcript || "Say: “Sahjony, evaluate my local processing speed”"}
      </div>
      {lastIntent && (
        <div className="mt-2 text-[10px] tracking-widest uppercase">
          <span className="text-[var(--muted)]">intent </span>
          <span className="text-[var(--hud)] hud-text">{lastIntent}</span>
        </div>
      )}
    </div>
  );
}
