import { NextRequest, NextResponse } from "next/server";
import { hermes } from "@/lib/hermes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Hermes orchestration endpoint — the backend brain. One natural-language
// command in, one executed (or confirmation-gated) action out.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const command = String(body.command ?? "").trim();
  if (!command) return NextResponse.json({ error: "command required" }, { status: 400 });
  return NextResponse.json(await hermes(command));
}
