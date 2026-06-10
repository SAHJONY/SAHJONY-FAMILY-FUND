import { NextRequest, NextResponse } from "next/server";
import { listBuyers, upsertBuyer, removeBuyer, listDeals, matchBuyers } from "@/lib/wholesale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const matchDealId = new URL(req.url).searchParams.get("matchDeal");
  const buyers = await listBuyers();
  if (matchDealId) {
    const deal = (await listDeals()).find((d) => d.id === matchDealId);
    if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });
    return NextResponse.json({ matches: matchBuyers(deal, buyers) }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ buyers }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const buyer = await upsertBuyer(body);
  return NextResponse.json({ ok: true, buyer });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ ok: await removeBuyer(id) });
}
