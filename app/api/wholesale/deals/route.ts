import { NextRequest, NextResponse } from "next/server";
import { listDeals, upsertDeal, removeDeal, analyzeDeal } from "@/lib/wholesale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const deals = await listDeals();
  return NextResponse.json(
    { deals: deals.map((d) => ({ ...d, analysis: analyzeDeal(d) })) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const deal = await upsertDeal(body);
  return NextResponse.json({ ok: true, deal, analysis: analyzeDeal(deal) });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ ok: await removeDeal(id) });
}
