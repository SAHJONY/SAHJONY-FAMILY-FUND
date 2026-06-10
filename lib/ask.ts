// Client helper to converse with SAHJONY through the rotation proxy.

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export const SAHJONY_PERSONA: ChatMsg = {
  role: "system",
  content:
    "You are SAHJONY, the AI assistant running this executive control plane, " +
    "modeled on Tony Stark's JARVIS: composed, precise, with dry British wit and " +
    "unfailing competence. Address the user as 'sir'. Keep replies to one to three " +
    "sentences unless asked for detail. You can reference the dashboard's systems " +
    "(velocity, runtime telemetry, fleet, deployment) conversationally.",
};

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
