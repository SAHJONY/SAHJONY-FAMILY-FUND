import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// OpenAI-compatible proxy with AUTONOMOUS MODEL ROTATION.
//
// One endpoint (NVIDIA NIM by default), many models. The primary model is tried
// first; on a retryable failure — rate limit (429), server error (5xx), timeout,
// or an empty completion — it rotates to the next free model automatically. Auth
// failures (401/403) and bad requests (400) are NOT retried across models, since
// rotating wouldn't help. An optional separate cloud mirror is the last resort.

function endpoint() {
  return {
    baseUrl: process.env.NIM_BASE_URL || "http://localhost:8000/v1",
    apiKey: process.env.NIM_API_KEY,
  };
}

function modelChain(): string[] {
  const primary = process.env.NIM_MODEL || "meta/llama-3.1-8b-instruct";
  const fallbacks = (process.env.NIM_FALLBACK_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // De-dupe while preserving order.
  return [...new Set([primary, ...fallbacks])];
}

const MAX_TOKENS = Number(process.env.NIM_MAX_TOKENS || 1024);

interface Attempt {
  model: string;
  ok: boolean;
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
      // 429 / 5xx are worth rotating models for; 4xx (auth/bad request) are not.
      const retryable = res.status === 429 || res.status >= 500;
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        retryable,
        status: res.status,
        detail: `HTTP ${res.status} ${body.slice(0, 140)}`,
      };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || !content.trim()) {
      // Empty completion (e.g. reasoning model exhausted budget) — rotate.
      return { ok: false, retryable: true, detail: "Empty completion" };
    }
    return { ok: true, data, model };
  } catch (e) {
    const err = e as Error;
    const retryable = err.name === "AbortError" || err.name === "TypeError";
    return { ok: false, retryable, detail: `${err.name}: ${err.message}` };
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages = body.messages ?? [
    { role: "user", content: body.prompt ?? "Say hello." },
  ];
  // Caller may override the chain (e.g. force a specific model).
  const chain: string[] = Array.isArray(body.models) && body.models.length
    ? body.models
    : modelChain();

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
    attempts.push({ model, ok: false, status: r.status, detail: r.detail });
    // Non-retryable failure (auth/bad request): stop — rotation won't help.
    if (!r.retryable) {
      return NextResponse.json(
        {
          backend: baseUrl.replace(/^https?:\/\//, ""),
          degraded: true,
          message:
            r.status === 401 || r.status === 403
              ? "Authentication failed. Check NIM_API_KEY."
              : "Request rejected by the backend.",
          attempts,
        },
        { status: r.status && r.status < 500 ? r.status : 502 }
      );
    }
  }

  return NextResponse.json(
    {
      backend: baseUrl.replace(/^https?:\/\//, ""),
      degraded: true,
      message:
        "All models in the rotation failed (rate-limited, erroring, or timing out). Try again shortly.",
      attempts,
    },
    { status: 503 }
  );
}
