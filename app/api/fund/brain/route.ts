import { NextRequest, NextResponse } from "next/server";
import { askBrain } from "@/lib/fund/brain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// The app's Claude-powered analyst brain. POST { question, lang } — it reads the
// current book context server-side and returns an explanation. Explains only;
// never trade advice.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const question = String(b.question || "").slice(0, 2000).trim();
  if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });
  const lang = b.lang === "es" ? "es" : "en";
  const reply = await askBrain(question, lang);
  return NextResponse.json(reply, { headers: { "Cache-Control": "no-store" } });
}
