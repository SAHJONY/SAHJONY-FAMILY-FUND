import { NextRequest, NextResponse } from "next/server";
import { status, authorize, shutdown } from "@/lib/browser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(status(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  authorize(!!body.authorize);
  return NextResponse.json(status());
}

export async function DELETE() {
  authorize(false);
  await shutdown();
  return NextResponse.json(status());
}
