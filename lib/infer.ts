// Server-side one-shot completion with model rotation, for internal agent use
// (the autonomous control loop). Reuses the brain registry's model chain.

import { endpoint, modelChain, MAX_TOKENS } from "./brain";

export async function complete(
  messages: { role: string; content: string }[]
): Promise<{ content: string; model: string } | null> {
  const { baseUrl, apiKey } = endpoint();
  for (const model of modelChain()) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 30000);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ model, messages, max_tokens: MAX_TOKENS, temperature: 0.2 }),
        signal: c.signal,
      });
      if (!res.ok) continue;
      const j = await res.json();
      const content = j?.choices?.[0]?.message?.content;
      if (content?.trim()) return { content: content.trim(), model };
    } catch {
      /* try next */
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

// Pull the first JSON object out of a model response (handles code fences and
// reasoning preamble).
export function extractJson<T = unknown>(s: string): T | null {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : s;
  const start = body.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < body.length; i++) {
    if (body[i] === "{") depth++;
    else if (body[i] === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(body.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}
