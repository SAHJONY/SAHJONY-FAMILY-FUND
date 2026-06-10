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
}: {
  onIntent: (intent: IntentName, raw: string, confidence: number) => string | void;
}) {
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [lastIntent, setLastIntent] = useState<string>("");
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListening = useRef(false);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    setState("speaking");
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 1.0;
    u.onend = () => setState(wantListening.current ? "listening" : "idle");
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
        setState("processing");
        const result = parseIntent(final);
        setLastIntent(`${result.intent} · ${(result.confidence * 100) | 0}%`);
        const reply = onIntent(result.intent, result.raw, result.confidence);
        speak(typeof reply === "string" ? reply : result.response);
      }
    };
    r.onerror = () => setState("idle");
    r.onend = () => {
      if (wantListening.current) {
        try {
          r.start();
        } catch {
          /* already started */
        }
      } else {
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
      <div className="panel p-4 text-sm">
        <div className="text-[var(--warn)] font-semibold mb-1">Voice unavailable</div>
        <p className="text-[var(--muted)]">
          This browser does not expose the Web Speech API. Use Chrome or Safari for
          hands-free control.
        </p>
      </div>
    );
  }

  const dot =
    state === "listening" ? "var(--good)" :
    state === "processing" ? "var(--warn)" :
    state === "speaking" ? "var(--accent)" : "var(--muted)";

  return (
    <div className="panel p-4 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${state !== "idle" ? "pulse" : ""}`}
            style={{ background: dot }}
          />
          <span className="text-sm font-semibold tracking-wide">VOICE ENGINE</span>
          <span className="text-xs text-[var(--muted)] uppercase">{state}</span>
        </div>
        <button
          onClick={toggle}
          className="text-xs px-3 py-1.5 rounded-md border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
        >
          {wantListening.current ? "Stop" : "Listen"}
        </button>
      </div>
      <div className="mono text-xs text-[var(--muted)] min-h-[2.5rem]">
        {transcript || "Say: “Jarvis, evaluate my local processing speed”"}
      </div>
      {lastIntent && (
        <div className="mt-2 text-xs">
          <span className="text-[var(--muted)]">intent </span>
          <span className="text-[var(--accent-2)] mono">{lastIntent}</span>
        </div>
      )}
    </div>
  );
}
