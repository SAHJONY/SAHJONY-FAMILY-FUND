import { NextRequest } from "next/server";
import { endpoint, modelChain, MAX_TOKENS } from "@/lib/brain";
import { logEvent, state, recordInference } from "@/lib/runtime-state";
import { recallBlock } from "@/lib/memory-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Real-time streaming proxy. Opens an upstream SSE stream (stream:true) and
// re-emits just the assistant token deltas as a plain text stream so the client
// can render SAHJONY's reply as it is generated. Rotation happens at connect
// time: if a model returns a non-200 (rate limit / error), the next brain is
// tried before any bytes are sent to the client.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const baseMessages = body.messages ?? [{ role: "user", content: body.prompt ?? "Say hello." }];
  // Inject persistent memory recall so SAHJONY remembers across sessions.
  const recall = body.useMemory === false ? null : await recallBlock();
  const messages = recall
    ? [{ role: "system", content: recall }, ...baseMessages]
    : baseMessages;
  const { baseUrl, apiKey } = endpoint();
  const chain = modelChain();
  const enc = new TextEncoder();

  for (const model of chain) {
    let upstream: Response | null = null;
    try {
      upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ model, messages, max_tokens: MAX_TOKENS, stream: true }),
      });
    } catch {
      continue; // network error — try next brain
    }
    if (!upstream.ok || !upstream.body) {
      if (model === chain[0]) logEvent("warn", `Primary ${model.split("/").pop()} unavailable (HTTP ${upstream.status}); rotating`);
      continue;
    }

    // This model accepted the stream — trust it going forward.
    state.activeModel = model;

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const startMs = Date.now();
    let firstTokenMs = 0;
    let outChars = 0;
    const finalize = () => {
      const dur = (Date.now() - startMs) / 1000;
      const approxTokens = outChars / 4; // ~4 chars/token
      recordInference({
        firstTokenMs: firstTokenMs || Date.now() - startMs,
        tokensPerSec: dur > 0 ? approxTokens / dur : 0,
        outputChars: outChars,
        model,
      });
    };
    const out = new ReadableStream({
      async start(controller) {
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              const t = line.trim();
              if (!t.startsWith("data:")) continue;
              const payload = t.slice(5).trim();
              if (payload === "[DONE]") { finalize(); controller.close(); return; }
              try {
                const j = JSON.parse(payload);
                const delta = j?.choices?.[0]?.delta?.content;
                if (delta) {
                  if (!firstTokenMs) firstTokenMs = Date.now() - startMs;
                  outChars += delta.length;
                  controller.enqueue(enc.encode(delta));
                }
              } catch { /* partial json across chunks — ignore */ }
            }
          }
        } catch {
          controller.enqueue(enc.encode("\n[stream interrupted]"));
        }
        finalize();
        controller.close();
      },
    });

    return new Response(out, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-sahjony-model": model,
        "Cache-Control": "no-store",
      },
    });
  }

  logEvent("fail", "All brains failed to open a stream");
  return new Response("SAHJONY brain offline: no model accepted the stream, sir.", { status: 503 });
}
