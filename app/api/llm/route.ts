import { NextRequest, NextResponse } from "next/server";
import { endpoint, modelChain, MAX_TOKENS } from "@/lib/brain";
import { recallBlock } from "@/lib/memory-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Non-streaming OpenAI-compatible proxy with autonomous model rotation. The
// model order comes from the brain registry (supervisor-promoted model first).
// Retryable failures (429/5xx/timeout/empty) rotate to the next brain; auth/4xx
// stop early. Used as the fallback path and for one-shot calls.

interface Attempt {
  model: string;
  status?: number;
  detail: string;
}

type TryResult =
  | { ok: true; data: any; model: string }
  | { ok: false; retryable: boolean; status?: number; detail: string };

async function tryModel(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  messages: unknown,
  timeoutMs = 30000
): Promise<TryResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, messages, max_tokens: MAX_TOKENS }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      const body = await res.text().catch(() => "");
      return { ok: false, retryable, status: res.status, detail: `HTTP ${res.status} ${body.slice(0, 120)}` };
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || !content.trim()) return { ok: false, retryable: true, detail: "Empty completion" };
    return { ok: true, data, model };
  } catch (e) {
    const err = e as Error;
    return { ok: false, retryable: err.name === "AbortError" || err.name === "TypeError", detail: `${err.name}: ${err.message}` };
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const baseMessages = body.messages ?? [{ role: "user", content: body.prompt ?? "Say hello." }];
  const recall = body.useMemory === false ? null : await recallBlock();
  const messages = recall ? [{ role: "system", content: recall }, ...baseMessages] : baseMessages;
  const chain: string[] = Array.isArray(body.models) && body.models.length ? body.models : modelChain();
  const { baseUrl, apiKey } = endpoint();
  const attempts: Attempt[] = [];

  for (const model of chain) {
    const r = await tryModel(baseUrl, apiKey, model, messages);
    if (r.ok) {
      return NextResponse.json({
        backend: baseUrl.replace(/^https?:\/\//, ""),
        model: r.model,
        rotatedThrough: attempts.length,
        ...r.data,
      });
    }
    attempts.push({ model, status: r.status, detail: r.detail });
    if (!r.retryable) {
      return NextResponse.json(
        {
          backend: baseUrl.replace(/^https?:\/\//, ""),
          degraded: true,
          message: r.status === 401 || r.status === 403 ? "Authentication failed. Check NIM_API_KEY." : "Request rejected by the backend.",
          attempts,
        },
        { status: r.status && r.status < 500 ? r.status : 502 }
      );
    }
  }

  return NextResponse.json(
    { backend: baseUrl.replace(/^https?:\/\//, ""), degraded: true, message: "All brain models failed (rate-limited/erroring/timeout).", attempts },
    { status: 503 }
  );
}
