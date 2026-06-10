// Client helper to converse with SAHJONY through the rotation proxy.

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export const SAHJONY_PERSONA: ChatMsg = {
  role: "system",
  content:
    "You are SAHJONY, the owner's personal AI assistant and chief of staff, " +
    "modeled on Tony Stark's JARVIS: composed, precise, with dry British wit and " +
    "unfailing competence. Address the user as 'sir'. You help with anything — " +
    "scheduling and reminders, research, drafting and writing, planning, quick " +
    "answers, and especially running SAHJONY CAPITAL LLC (real estate wholesaling): " +
    "deal analysis, buyer matching, dispositions, CRM and joint ventures. Keep " +
    "replies to one to three sentences unless asked for detail. You can reference " +
    "the dashboard's systems (telemetry, deals, CRM, tasks, integrations) " +
    "conversationally. Never fabricate data; if you don't have a real figure, say so.",
};

// Real-time streaming ask: tokens are delivered to `onToken` as SAHJONY speaks.
// Returns the full text + the model that served it. Falls back to non-stream on
// any failure so the chat never dead-ends.
export async function askSahjonyStream(
  history: ChatMsg[],
  onToken: (chunk: string, soFar: string) => void
): Promise<{ reply: string; model?: string; degraded?: boolean }> {
  try {
    const res = await fetch("/api/llm/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [SAHJONY_PERSONA, ...history] }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      return { reply: data?.message ?? "My brain is offline, sir.", degraded: true };
    }
    const model = res.headers.get("x-sahjony-model") ?? undefined;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      onToken(chunk, full);
    }
    return { reply: full.trim() || "…", model };
  } catch (e) {
    return { reply: `Connection error, sir: ${(e as Error).message}`, degraded: true };
  }
}

// Hermes-powered turn: routes the message through the orchestration brain so a
// conversation can also EXECUTE real actions (create lead, find deals, etc.).
export async function askHermes(command: string): Promise<{ reply: string; action?: string; data?: unknown }> {
  try {
    const res = await fetch("/api/hermes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    const j = await res.json();
    let reply = j.speak ?? "Done, sir.";
    if (j.needsConfirmation) reply += ` (Needs your confirmation — open Tools to proceed.)`;
    return { reply, action: j.action, data: j.data };
  } catch (e) {
    return { reply: `Connection error, sir: ${(e as Error).message}` };
  }
}

export async function askSahjony(history: ChatMsg[]): Promise<{
  reply: string;
  model?: string;
  degraded?: boolean;
}> {
  try {
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [SAHJONY_PERSONA, ...history] }),
    });
    const data = await res.json();
    if (data?.choices?.[0]?.message?.content) {
      return { reply: data.choices[0].message.content.trim(), model: data.model };
    }
    return {
      reply:
        data?.message ??
        "My inference link is down, sir. Check the NVIDIA endpoint or your key.",
      degraded: true,
    };
  } catch (e) {
    return { reply: `Connection error, sir: ${(e as Error).message}`, degraded: true };
  }
}
