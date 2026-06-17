import { NextResponse } from "next/server";
import { readState } from "@/lib/fund/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Fast read of the last computed daily report. Returns null state if the
// pipeline hasn't run yet (the dashboard prompts to run it).
export async function GET() {
  const report = await readState();
  return NextResponse.json({ report }, { headers: { "Cache-Control": "no-store" } });
}
