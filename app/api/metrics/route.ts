import { NextResponse } from "next/server";
import { state } from "@/lib/runtime-state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Real measured inference metrics only. Zeros until the first real inference.
export async function GET() {
  return NextResponse.json(state.metrics, { headers: { "Cache-Control": "no-store" } });
}
