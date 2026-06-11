import { NextRequest, NextResponse } from "next/server";
import { propertyIntel } from "@/lib/property-intel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PropStream-style property research for one address — aggregated from Census +
// Regrid + ATTOM (real providers). Each field is source-tagged.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const address = String(body.address ?? "").trim();
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
  return NextResponse.json(await propertyIntel(address), { headers: { "Cache-Control": "no-store" } });
}
