// SAHJONY CAPITAL LLC — the app's analyst brain & engine.
//
// Claude is the reasoning engine. It reads the user's CURRENT book context (the
// last computed report + paper account) and explains, in plain language, what
// the numbers mean: positions, P&L, Greeks, the macro gate, backtest metrics,
// signals, news. Bilingual (English / Spanish).
//
// COMPLIANCE: it explains and educates only. It never gives personalized
// investment advice and never tells anyone to buy, sell, hold, or trade — the
// same line the rest of this monitor holds. If asked for a call, it surfaces the
// relevant facts and declines to recommend.

import { readState } from "./store";
import { getAccount, valuePaper } from "./quant/paper";
import { complete, extractJson } from "../infer";
import { key } from "./ctx";
import { getPersona } from "./personas";
import type { FundReport } from "./types";

const ANTHROPIC_MODEL = () => key("ANTHROPIC_MODEL") || "claude-fable-5";
const OPENAI_MODEL = () => key("OPENAI_MODEL") || "gpt-4o";
const GROQ_MODEL = () => key("GROQ_MODEL") || "llama-3.3-70b-versatile";

function systemPrompt(lang: "en" | "es", personaId?: string): string {
  const langLine = lang === "es"
    ? "Responde SIEMPRE en español, claro y conciso."
    : "Always answer in English, clear and concise.";
  const lines = [
    "You are the analyst engine inside SAHJONY CAPITAL LLC — a markets MONITOR and quant lab.",
    "You explain what the user's data shows: positions, unrealized P&L, option Greeks, the deterministic macro gate, IV environment, backtest metrics (CAGR/Sharpe/Sortino/max drawdown), systematic signals, and news.",
    "Hard rules (these OVERRIDE any persona's traditional output style): you EXPLAIN and EDUCATE only. You never give personalized investment advice and never tell the user to buy, sell, hold, or trade. You do not issue ratings or price targets as advice, and you never route or simulate orders. If asked for a recommendation, present the relevant facts and frameworks, note the user's own targets/stops, and say you don't provide trade advice.",
    "Backtest results are measured on history and never a promise of future returns. Be honest about uncertainty.",
  ];
  const persona = getPersona(personaId);
  if (persona) lines.push(`ANALYTICAL LENS — ${persona.firm} · ${persona.name}: ${persona.lens}`);
  lines.push(langLine);
  return lines.join("\n");
}

// A compact, token-bounded snapshot of the user's current state for context.
function buildContext(report: FundReport | null, paper: ReturnType<typeof valuePaper>): string {
  if (!report) {
    return `No portfolio report has been generated yet. Paper account equity: $${paper.equity.toLocaleString()}, cash $${paper.cash.toLocaleString()}, realized P&L $${paper.realizedPnl.toLocaleString()}.`;
  }
  const a = report.analytics;
  const totalPnl = report.positions.reduce((s, p) => s + p.pnl, 0);
  const positions = report.positions.slice(0, 20).map((p) => {
    const o = p.pos;
    const tag = o.asset_type === "option" ? `${o.ticker} ${o.strike}${(o.option_type ?? "c")[0]} ${o.expiry}` : (o.ticker !== "—" ? o.ticker : o.label);
    return `${tag}: mark ${p.mark} (${p.markSource}), value $${p.value}, P&L $${p.pnl} (${p.pnlPct}%)${p.dte != null ? `, DTE ${p.dte}` : ""}${p.greeks ? `, Δ${p.greeks.delta.toFixed(2)} IV ${(p.greeks.iv * 100).toFixed(0)}%` : ""}`;
  }).join("\n");
  const alerts = report.alerts.slice(0, 10).map((x) => `[${x.severity}] ${x.message}`).join("\n") || "none";
  const news = report.news.slice(0, 8).map((n) => `${n.ticker} (${n.sentiment}): ${n.summary}${n.positionFlag ? ` FLAG: ${n.positionFlag}` : ""}`).join("\n") || "none";
  return [
    `AS OF ${report.asof}`,
    `NAV $${a.nav.toLocaleString()} | unrealized P&L $${Math.round(totalPnl).toLocaleString()} | positions ${report.positions.length}`,
    `Aggregate Greeks: net delta ${a.netDelta}, daily theta $${a.dailyTheta}, net vega $${a.netVega}`,
    `Macro gate: ${report.macro.available ? `${report.macro.score}/100` : "unavailable"}`,
    `Concentration flags: ${a.concentrationFlags.join("; ") || "none"}`,
    `Paper account: equity $${paper.equity.toLocaleString()}, realized P&L $${paper.realizedPnl.toLocaleString()}`,
    ``,
    `POSITIONS:\n${positions || "none"}`,
    ``,
    `ALERTS:\n${alerts}`,
    ``,
    `NEWS:\n${news}`,
  ].join("\n");
}

async function viaAnthropic(system: string, userMsg: string): Promise<{ content: string; model: string } | null> {
  const apiKey = key("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  const model = ANTHROPIC_MODEL();
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 40000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 900, system, messages: [{ role: "user", content: userMsg }] }),
      signal: c.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    const content = j?.content?.[0]?.text;
    return content ? { content, model } : null;
  } catch { return null; } finally { clearTimeout(t); }
}

// Second engine: OpenAI (used when Claude is unavailable).
async function viaOpenAI(system: string, userMsg: string): Promise<{ content: string; model: string } | null> {
  const apiKey = key("OPENAI_API_KEY");
  if (!apiKey) return null;
  const model = OPENAI_MODEL();
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 40000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, max_tokens: 900,
        messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
      }),
      signal: c.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    const content = j?.choices?.[0]?.message?.content;
    return content ? { content, model } : null;
  } catch { return null; } finally { clearTimeout(t); }
}

// Third engine: Groq (free, fast — OpenAI-compatible API).
async function viaGroq(system: string, userMsg: string): Promise<{ content: string; model: string } | null> {
  const apiKey = key("GROQ_API_KEY");
  if (!apiKey) return null;
  const model = GROQ_MODEL();
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 40000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, max_tokens: 900,
        messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
      }),
      signal: c.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    const content = j?.choices?.[0]?.message?.content;
    return content ? { content, model: `groq/${model}` } : null;
  } catch { return null; } finally { clearTimeout(t); }
}

export interface BrainReply { answer: string; model: string }

export async function askBrain(userId: string, question: string, lang: "en" | "es" = "en", personaId?: string): Promise<BrainReply> {
  const report = await readState(userId);
  const paper = valuePaper(await getAccount(userId), {});
  const system = systemPrompt(lang, personaId);
  const userMsg = `CURRENT BOOK CONTEXT:\n${buildContext(report, paper)}\n\nUSER QUESTION:\n${question}`;

  // Engine chain: Claude (primary) → OpenAI → Groq (free) → in-house NIM brain.
  const out = (await viaAnthropic(system, userMsg)) ??
    (await viaOpenAI(system, userMsg)) ??
    (await viaGroq(system, userMsg)) ??
    (await complete([{ role: "system", content: system }, { role: "user", content: userMsg }]));

  if (!out) {
    return {
      answer: lang === "es"
        ? "El motor de análisis no está disponible ahora mismo (configura ANTHROPIC_API_KEY para activar a Claude). Mientras tanto, los datos del panel siguen disponibles."
        : "The analyst engine is unreachable right now (set ANTHROPIC_API_KEY to enable Claude). The dashboard data above is still live in the meantime.",
      model: "none",
    };
  }
  // Strip any accidental JSON wrapping.
  const parsed = extractJson<{ answer?: string }>(out.content);
  return { answer: parsed?.answer ?? out.content.trim(), model: out.model };
}
