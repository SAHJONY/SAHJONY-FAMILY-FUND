import { NextResponse } from "next/server";
import { endpoint, modelChain, brainRoster } from "@/lib/brain";
import { state, logEvent } from "@/lib/runtime-state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// SAHJONY's self-healing supervisor.
//
// On each poll it: (1) checks the inference endpoint is reachable, and (2) at
// most every 25s, runs a tiny live generation against the trusted model. If
// that model fails, it walks the rotation pool, promotes the first model that
// actually responds, and records the recovery. This is genuine runtime
// self-healing — it repairs the live inference path. It does NOT rewrite source
// or redeploy itself; that boundary is intentional.

async function probeEndpoint(baseUrl: string, apiKey?: string) {
  const start = Date.now();
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 3000);
  try {
    const r = await fetch(`${baseUrl}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: c.signal,
    });
    return { ok: r.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: null as number | null };
  } finally {
    clearTimeout(t);
  }
}

async function testModel(baseUrl: string, apiKey: string | undefined, model: string) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 12000);
  try {
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 256 }),
      signal: c.signal,
    });
    if (!r.ok) return false;
    const j = await r.json();
    return !!j?.choices?.[0]?.message?.content?.trim();
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const { baseUrl, apiKey } = endpoint();
  const chain = modelChain();
  const probe = await probeEndpoint(baseUrl, apiKey);

  let healthy = probe.ok;
  if (!probe.ok) {
    logEvent("warn", "Inference endpoint unreachable; holding last-known model");
  } else if (Date.now() - state.lastTest > 25000) {
    state.lastTest = Date.now();
    const trusted = state.activeModel || chain[0];
    const ok = await testModel(baseUrl, apiKey, trusted);
    if (ok) {
      if (state.activeModel !== trusted) {
        state.activeModel = trusted;
      }
      logEvent("ok", `Self-check passed on ${trusted.split("/").pop()}`);
    } else {
      // Autonomous recovery: promote the first model in the pool that answers.
      let recovered: string | null = null;
      for (const m of chain) {
        if (m === trusted) continue;
        if (await testModel(baseUrl, apiKey, m)) { recovered = m; break; }
      }
      if (recovered) {
        state.activeModel = recovered;
        state.healCount += 1;
        healthy = true;
        logEvent("heal", `Auto-recovered: ${trusted.split("/").pop()} failed → promoted ${recovered.split("/").pop()}`);
      } else {
        healthy = false;
        logEvent("fail", "No model in the pool responded; degraded");
      }
    }
  }

  return NextResponse.json(
    {
      healthy,
      activeModel: state.activeModel || chain[0],
      latencyMs: probe.latencyMs,
      healCount: state.healCount,
      events: state.events,
      brains: brainRoster(),
      metrics: state.metrics,
      timestamp: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
