import { NextRequest, NextResponse } from "next/server";
import { act, screenshot, pageText, requireAuth } from "@/lib/browser";
import { isSensitive, sensitiveReason } from "@/lib/control-policy";
import { complete, extractJson } from "@/lib/infer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_STEPS = 6;

interface AgentAction {
  thought?: string;
  action: "goto" | "click" | "type" | "scroll" | "read" | "finish";
  url?: string;
  selector?: string;
  text?: string;
  answer?: string;
}

const SYSTEM = `You are SAHJONY operating the owner's web browser autonomously to accomplish a goal.
Respond with EXACTLY ONE JSON object for the single next action, nothing else.
Schema: {"thought": string, "action": "goto"|"click"|"type"|"scroll"|"read"|"finish", "url"?: string, "selector"?: CSS selector, "text"?: string, "answer"?: string}
Rules:
- "goto" needs url. "click" needs selector or text. "type" needs selector and text. "scroll" text is "up"/"down". "finish" needs answer (the result for the owner).
- Prefer robust CSS selectors. Work step by step from what the page currently shows.
- When the goal is achieved, use action "finish" with a concise answer.`;

// Autonomous browser loop. Pauses for confirmation before any sensitive action.
export async function POST(req: NextRequest) {
  try {
    requireAuth();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const goal = String(body.goal ?? "").trim();
  if (!goal) return NextResponse.json({ error: "goal required" }, { status: 400 });

  const transcript: Array<{ action: AgentAction; ok: boolean; detail: string }> = [];

  // Resume path: the owner approved a previously-paused sensitive action.
  if (body.preApproved) {
    const r = await act(body.preApproved);
    transcript.push({ action: body.preApproved, ok: r.ok, detail: r.detail });
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    const ctx = await pageText().catch(() => ({ url: "about:blank", title: "", text: "" }));
    const history = transcript.map((t, i) => `${i + 1}. ${t.action.action} ${t.action.url || t.action.selector || t.action.text || ""} → ${t.ok ? "ok" : "FAILED"}`).join("\n");

    const res = await complete([
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `GOAL: ${goal}

CURRENT PAGE
url: ${ctx.url}
title: ${ctx.title}
visible text (truncated):
${ctx.text.slice(0, 2500)}

ACTIONS SO FAR:
${history || "(none)"}

Give the next single action as JSON.`,
      },
    ]);

    if (!res) {
      return NextResponse.json({ status: "error", message: "Brain unreachable", transcript, screenshot: await screenshot() });
    }
    const action = extractJson<AgentAction>(res.content);
    if (!action || !action.action) {
      return NextResponse.json({ status: "error", message: "Could not parse an action", raw: res.content, transcript, screenshot: await screenshot() });
    }

    if (action.action === "finish") {
      return NextResponse.json({ status: "done", answer: action.answer ?? "Done.", transcript, url: ctx.url, screenshot: await screenshot() });
    }

    // Confirmation gate.
    if (isSensitive(action.action, action.selector, action.text, action.thought)) {
      return NextResponse.json({
        status: "awaiting_confirmation",
        reason: sensitiveReason(action.action, action.selector, action.text, action.thought),
        proposedAction: action,
        transcript,
        url: ctx.url,
        screenshot: await screenshot(),
      });
    }

    const r = await act(action);
    transcript.push({ action, ok: r.ok, detail: r.detail });
  }

  return NextResponse.json({ status: "max_steps", transcript, screenshot: await screenshot() });
}
