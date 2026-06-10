// SAHJONY's "brain" registry — the set of reasoning modules wired into the core.
//
// Two real, active classes here:
//   - model brains: OpenAI-compatible models on the NVIDIA endpoint (rotation pool)
//   - the Hermes agent loop: autonomous reasoning mode running on those models
// And key/endpoint-gated ones that activate only when configured:
//   - Claude (Anthropic) — needs ANTHROPIC_API_KEY
//   - OpenClaw / FreeBuff — external agents; placeholder until a real endpoint URL
//     is provided. Deliberately NOT faked as functional.

import { state } from "./runtime-state";

export type BrainKind = "model" | "agent" | "external";
export type BrainStatus = "active" | "standby" | "needs-key" | "unlinked";

export interface BrainModule {
  id: string;
  label: string;
  kind: BrainKind;
  status: BrainStatus;
  detail: string;
}

export function endpoint() {
  return {
    baseUrl: process.env.NIM_BASE_URL || "http://localhost:8000/v1",
    apiKey: process.env.NIM_API_KEY,
  };
}

// Ordered model rotation. The supervisor-promoted activeModel goes first, then
// the env-configured primary, then the fallback pool — de-duplicated.
export function modelChain(): string[] {
  const primary = process.env.NIM_MODEL || "meta/llama-3.1-8b-instruct";
  const fallbacks = (process.env.NIM_FALLBACK_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ordered = [state.activeModel, primary, ...fallbacks].filter(
    (m): m is string => !!m
  );
  return [...new Set(ordered)];
}

export const MAX_TOKENS = Number(process.env.NIM_MAX_TOKENS || 1024);

// Static roster for the Autonomy panel. Live status for models/agent is filled
// by the heal route; the gated ones report their config state here.
export function brainRoster(): BrainModule[] {
  const chain = modelChain();
  const models: BrainModule[] = chain.map((m, i) => ({
    id: m,
    label: m.split("/").pop() || m,
    kind: "model",
    status: i === 0 ? "active" : "standby",
    detail: i === 0 ? "Primary cortex" : "Fallback in rotation",
  }));

  const hermes: BrainModule = {
    id: "hermes-agent",
    label: "Hermes Agent",
    kind: "agent",
    status: "active",
    detail: "Autonomous multi-turn reasoning loop over the model cortex",
  };

  const claude: BrainModule = {
    id: "claude",
    label: "Claude",
    kind: "external",
    status: process.env.ANTHROPIC_API_KEY ? "active" : "needs-key",
    detail: process.env.ANTHROPIC_API_KEY
      ? "Anthropic adapter online"
      : "Set ANTHROPIC_API_KEY to enable",
  };

  const openclaw: BrainModule = {
    id: "openclaw",
    label: "OpenClaw",
    kind: "external",
    status: process.env.OPENCLAW_URL ? "active" : "unlinked",
    detail: process.env.OPENCLAW_URL
      ? "Linked"
      : "Awaiting endpoint URL (OPENCLAW_URL)",
  };

  const freebuff: BrainModule = {
    id: "freebuff",
    label: "FreeBuff",
    kind: "external",
    status: process.env.FREEBUFF_URL ? "active" : "unlinked",
    detail: process.env.FREEBUFF_URL
      ? "Linked"
      : "Awaiting endpoint URL (FREEBUFF_URL)",
  };

  return [...models, hermes, claude, openclaw, freebuff];
}
