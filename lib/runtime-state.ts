// Process-wide runtime state for SAHJONY's autonomy layer.
//
// Stored on globalThis so it survives dev hot-reloads and is shared across API
// routes in the same server process. This is the memory the self-healing
// supervisor writes to and the inference routes read from.

export interface HealEvent {
  t: number;
  level: "ok" | "warn" | "heal" | "fail";
  msg: string;
}

export interface InferenceMetrics {
  requests: number;          // real count of completed inferences
  lastFirstTokenMs: number;  // measured time-to-first-token
  lastTokensPerSec: number;  // measured output rate
  lastOutputChars: number;
  lastModel: string | null;
  lastAt: number;            // timestamp of last inference (0 = none yet)
}

interface SahjonyState {
  activeModel: string | null; // the model the supervisor currently trusts
  events: HealEvent[];
  healCount: number;
  lastTest: number;
  metrics: InferenceMetrics;
}

const g = globalThis as unknown as { __sahjony?: SahjonyState };

export const state: SahjonyState =
  g.__sahjony ??
  (g.__sahjony = {
    activeModel: null,
    events: [],
    healCount: 0,
    lastTest: 0,
    metrics: {
      requests: 0,
      lastFirstTokenMs: 0,
      lastTokensPerSec: 0,
      lastOutputChars: 0,
      lastModel: null,
      lastAt: 0,
    },
  });

// Record a real, measured inference (called from the streaming route).
export function recordInference(m: {
  firstTokenMs: number;
  tokensPerSec: number;
  outputChars: number;
  model: string;
}) {
  state.metrics = {
    requests: state.metrics.requests + 1,
    lastFirstTokenMs: Math.round(m.firstTokenMs),
    lastTokensPerSec: Math.round(m.tokensPerSec * 10) / 10,
    lastOutputChars: m.outputChars,
    lastModel: m.model,
    lastAt: Date.now(),
  };
}

export function logEvent(level: HealEvent["level"], msg: string) {
  state.events.unshift({ t: Date.now(), level, msg });
  state.events = state.events.slice(0, 12);
}
