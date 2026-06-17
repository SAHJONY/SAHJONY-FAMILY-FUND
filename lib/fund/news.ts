// SAHJONY FAMILY FUND — Layer 3b: the daily Claude news read.
//
// THIS IS THE ONE PAID PIECE. For each held name we pull recent headlines and
// have a model return, per name: a short summary of what actually happened, a
// sentiment read, the key drivers, and a flag for anything that specifically
// affects a held position. It summarizes and flags — it is NOT a trade trigger
// and never says buy or sell.
//
// Routing: Claude via the Anthropic API when ANTHROPIC_API_KEY is set (the spec
// the blueprint describes); otherwise it falls back to the in-house NVIDIA-cloud
// brain so the layer still works without an Anthropic key. Each name's analysis
// is cached per day so re-runs don't re-bill.

import type { NewsAnalysis } from "./types";
import { getNews } from "./market";
import { readNewsCache, writeNewsCache } from "./store";
import { complete, extractJson } from "../infer";
import { key } from "./ctx";
import { FundConfig } from "./config";

function prompt(ticker: string, headlines: { title: string; publisher: string; ts: number }[], hasPosition: boolean): string {
  const list = headlines.map((h, i) => `${i + 1}. ${h.title} (${h.publisher})`).join("\n");
  return [
    `You are a markets news analyst for a family office that HOLDS ${ticker}.`,
    `Read these recent headlines and report on ${ticker}. Summarize and flag only — never recommend buying or selling.`,
    ``,
    `HEADLINES:`,
    list || "(no recent headlines found)",
    ``,
    `Return ONLY a JSON object with exactly these keys:`,
    `{"summary": "2-3 sentences on what actually happened",`,
    ` "sentiment": "positive" | "neutral" | "negative",`,
    ` "drivers": ["short key driver", ...],`,
    ` "positionFlag": ${hasPosition ? `"one line if anything specifically affects a holder of ${ticker}, else null"` : "null"}}`,
  ].join("\n");
}

async function viaAnthropic(text: string): Promise<{ content: string; model: string } | null> {
  const apiKey = key("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  const model = key("ANTHROPIC_MODEL") || "claude-fable-5";
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 30000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        messages: [{ role: "user", content: text }],
      }),
      signal: c.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    const content = j?.content?.[0]?.text;
    return content ? { content, model } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function newsForTicker(
  userId: string,
  ticker: string,
  hasPosition: boolean,
  cfg: FundConfig,
  asof: string
): Promise<NewsAnalysis> {
  // Cache per user per name per day.
  const cached = await readNewsCache(userId, ticker, asof);
  if (cached) return { ...cached, cached: true };

  const cutoff = Date.now() / 1000 - cfg.newsWindowDays * 86400;
  const headlines = (await getNews(ticker, 12))
    .filter((h) => h.ts === 0 || h.ts >= cutoff)
    .slice(0, 8);

  const text = prompt(ticker, headlines, hasPosition);
  // Prefer Claude; fall back to the in-house brain.
  const out =
    (await viaAnthropic(text)) ??
    (await complete([{ role: "user", content: text }]));

  let summary = "No analysis available (model unreachable).";
  let sentiment: NewsAnalysis["sentiment"] = "neutral";
  let drivers: string[] = [];
  let positionFlag: string | null = null;
  let model = "none";

  if (out) {
    model = out.model;
    const parsed = extractJson<{ summary?: string; sentiment?: string; drivers?: string[]; positionFlag?: string | null }>(out.content);
    if (parsed) {
      summary = parsed.summary?.trim() || (headlines.length ? "Headlines present; model returned no summary." : "No recent headlines.");
      const s = (parsed.sentiment || "").toLowerCase();
      sentiment = s === "positive" || s === "negative" ? (s as NewsAnalysis["sentiment"]) : "neutral";
      drivers = Array.isArray(parsed.drivers) ? parsed.drivers.slice(0, 5).map(String) : [];
      positionFlag = parsed.positionFlag && String(parsed.positionFlag).toLowerCase() !== "null"
        ? String(parsed.positionFlag) : null;
    } else {
      summary = out.content.slice(0, 400);
    }
  } else if (!headlines.length) {
    summary = "No recent headlines in the lookback window.";
  }

  const analysis: NewsAnalysis = {
    ticker, summary, sentiment, drivers, positionFlag,
    headlines: headlines.map((h) => ({ title: h.title, publisher: h.publisher, link: h.link, ts: h.ts })),
    model, cached: false, asof,
  };
  await writeNewsCache(userId, analysis);
  return analysis;
}
