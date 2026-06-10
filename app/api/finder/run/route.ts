import { NextResponse } from "next/server";
import { runFinder, getConfig } from "@/lib/finder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The autonomous pass. Triggered by:
//  - the user (manual "Run now")
//  - a local interval (dev)
//  - Vercel Cron in production (see vercel.json — runs hourly, 24/7/365)
// Runs only when the finder is enabled; always honest about real-data sourcing.
export async function GET() {
  const cfg = await getConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ skipped: true, reason: "Finder is disabled. Enable it in the dashboard." });
  }
  const run = await runFinder();
  return NextResponse.json({ ok: true, run }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  // Manual run ignores the enabled flag so the owner can test on demand.
  const { runFinder } = await import("@/lib/finder");
  return NextResponse.json({ ok: true, run: await runFinder() });
}
