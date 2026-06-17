import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/fund/pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Run the full daily pipeline (pull → value → analytics → macro → news →
// alerts → store). GET for the cron; POST to pass { asof, skipNews }.
export async function GET() {
  const report = await runPipeline();
  return NextResponse.json({ ok: true, asof: report.asof, alerts: report.alerts.length, errors: report.errors });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const report = await runPipeline({
    asof: typeof body.asof === "string" ? body.asof : undefined,
    skipNews: body.skipNews === true,
  });
  return NextResponse.json({ ok: true, report });
}
