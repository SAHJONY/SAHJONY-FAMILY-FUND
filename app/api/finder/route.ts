import { NextRequest, NextResponse } from "next/server";
import { getConfig, setConfig, getLog } from "@/lib/finder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    config: await getConfig(),
    log: await getLog(),
    feedConnected: !!(process.env.MLS_RESO_URL && process.env.MLS_RESO_TOKEN),
  }, { headers: { "Cache-Control": "no-store" } });
}

// Update finder criteria / enable.
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const patch: any = {};
  for (const k of ["enabled", "minPrice", "maxPrice", "minBeds", "maxResultsPerRun"]) if (k in body) patch[k] = body[k];
  if (Array.isArray(body.markets)) patch.markets = body.markets;
  return NextResponse.json({ ok: true, config: await setConfig(patch) });
}
