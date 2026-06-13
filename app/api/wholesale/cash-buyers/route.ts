import { NextRequest, NextResponse } from "next/server";
import { findCashBuyers } from "@/lib/cash-buyers";
import { upsertBuyer } from "@/lib/wholesale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Find cash buyers for a market (real deed records + ATTOM when keyed), or
// import a discovered buyer into the network.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "import" && body.name) {
    const buyer = await upsertBuyer({
      name: String(body.name), type: "institutional",
      contact: String(body.contact ?? ""), active: true,
      box: { markets: body.market ? [String(body.market)] : [], propertyTypes: [], minPrice: 0, maxPrice: 0, minBeds: 0, maxRepairs: 0, strategy: "any" },
    });
    return NextResponse.json({ ok: true, buyer });
  }

  const city = String(body.city ?? "").trim();
  const state = String(body.state ?? "").trim().toUpperCase();
  if (!city && !state) return NextResponse.json({ error: "city/state required" }, { status: 400 });
  return NextResponse.json(await findCashBuyers(city, state), { headers: { "Cache-Control": "no-store" } });
}
