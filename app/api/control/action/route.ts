import { NextRequest, NextResponse } from "next/server";
import { act, screenshot, pageText, requireAuth } from "@/lib/browser";
import { isSensitive, sensitiveReason } from "@/lib/control-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Single manual action. Sensitive actions require { confirmed: true }.
export async function POST(req: NextRequest) {
  try {
    requireAuth();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const a = await req.json().catch(() => ({}));

  if (!a.confirmed && isSensitive(a.action, a.selector, a.text)) {
    return NextResponse.json({
      status: "needs_confirmation",
      reason: sensitiveReason(a.action, a.selector, a.text),
      proposedAction: a,
    });
  }

  const result = await act(a);
  const ctx = await pageText().catch(() => null);
  return NextResponse.json({
    status: result.ok ? "ok" : "error",
    result,
    url: ctx?.url,
    title: ctx?.title,
    screenshot: await screenshot(),
  });
}
