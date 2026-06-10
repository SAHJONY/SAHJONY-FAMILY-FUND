import { NextResponse } from "next/server";
import type { LlmBackendHealth, ServiceState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function probe(baseUrl: string, apiKey?: string): Promise<LlmBackendHealth> {
  const start = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: controller.signal,
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return {
        target: baseUrl,
        state: "degraded" as ServiceState,
        latencyMs,
        detail: `HTTP ${res.status} from /models`,
      };
    }
    const data = await res.json().catch(() => ({}));
    const model = data?.data?.[0]?.id;
    return {
      target: baseUrl,
      state: "online",
      latencyMs,
      model,
      detail: "Reachable, OpenAI-compatible /models responded.",
    };
  } catch (e) {
    return {
      target: baseUrl,
      state: "offline",
      latencyMs: null,
      detail: (e as Error).name === "AbortError" ? "Timed out (3s)" : (e as Error).message,
    };
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const nimBase = process.env.NIM_BASE_URL || "http://localhost:8000/v1";
  const checks: LlmBackendHealth[] = [];
  checks.push(await probe(nimBase, process.env.NIM_API_KEY));
  if (process.env.CLOUD_LLM_BASE_URL) {
    checks.push(
      await probe(process.env.CLOUD_LLM_BASE_URL, process.env.CLOUD_LLM_API_KEY)
    );
  }
  const vercel = process.env.VERCEL_ENV ?? "local";
  const primaryModel = process.env.NIM_MODEL ?? null;
  const rotationCount =
    (process.env.NIM_FALLBACK_MODELS || "").split(",").filter(Boolean).length;
  return NextResponse.json(
    {
      backends: checks,
      vercelEnv: vercel,
      primaryModel,
      rotationCount,
      timestamp: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
