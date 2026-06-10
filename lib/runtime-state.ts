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

interface SahjonyState {
  activeModel: string | null; // the model the supervisor currently trusts
  events: HealEvent[];
  healCount: number;
  lastTest: number;
}

const g = globalThis as unknown as { __sahjony?: SahjonyState };

export const state: SahjonyState =
  g.__sahjony ??
  (g.__sahjony = {
    activeModel: null,
    events: [],
    healCount: 0,
    lastTest: 0,
  });

export function logEvent(level: HealEvent["level"], msg: string) {
  state.events.unshift({ t: Date.now(), level, msg });
  state.events = state.events.slice(0, 12);
}
