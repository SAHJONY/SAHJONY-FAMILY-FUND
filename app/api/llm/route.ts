import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Ordered list of OpenAI-compatible backends. The first that responds wins.
// Local NIM (or Ollama) first, then an optional cloud mirror. Configure via
// env; nothing is hardcoded to a private host.
interface Backend {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
}

function backends(): Backend[] {
  const list: Backend[] = [];
  const localBase = process.env.NIM_BASE_URL || "http://localhost:8000/v1";
  list.push({
    name: "local-nim",
    baseUrl: localBase,
    apiKey: process.env.NIM_API_KEY,
    model: process.env.NIM_MODEL || "meta/llama-3.1-8b-instruct",
  });
  if (process.env.CLOUD_LLM_BASE_URL && process.env.CLOUD_LLM_API_KEY) {
    list.push({
      name: "cloud-mirror",
      baseUrl: process.env.CLOUD_LLM_BASE_URL,
      apiKey: process.env.CLOUD_LLM_API_KEY,
      model: process.env.CLOUD_LLM_MODEL || "gpt-4o-mini",
    });
  }
  return list;
}

async function tryBackend(
  b: Backend,
  messages: unknown,
  timeoutMs = 8000
): Promise<{ ok: true; data: unknown; backend: string } | { ok: false; error: string }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${b.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(b.apiKey ? { Authorization: `Bearer ${b.apiKey}` } : {}),
      },
      body: JSON.stringify({ model: b.model, messages, max_tokens: 512 }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `${b.name} HTTP ${res.status}` };
    return { ok: true, data: await res.json(), backend: b.name };
  } catch (e) {
    return { ok: false, error: `${b.name}: ${(e as Error).message}` };
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages = body.messages ?? [
    { role: "user", content: body.prompt ?? "Say hello." },
  ];

  const errors: string[] = [];
  for (const b of backends()) {
    const r = await tryBackend(b, messages);
    if (r.ok) {
      return NextResponse.json({ backend: r.backend, ...(r.data as object) });
    }
    errors.push(r.error);
  }

  // Graceful, actionable degradation — no silent failure.
  return NextResponse.json(
    {
      backend: "none",
      degraded: true,
      message:
        "No inference backend reachable. Start a local NIM/Ollama on NIM_BASE_URL or set CLOUD_LLM_* env vars.",
      attempts: errors,
    },
    { status: 503 }
  );
}
