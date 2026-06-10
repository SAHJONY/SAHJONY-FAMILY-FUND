import { NextRequest, NextResponse } from "next/server";
import { geocode, sourceLinks } from "@/lib/enrich";
import { complete } from "@/lib/infer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// You give an address (and optional APN/parcel "HIN"). SAHJONY autonomously:
//  1) validates + normalizes it against live US Census records (REAL),
//  2) returns the authoritative source deep-links for the licensed/public data,
//  3) if you pass known numbers (arv/repairs/contract), gives a written analysis.
// It will not invent ARV/comps — those come back as "needs_source", confirmed
// by you from PropStream/assessor/MLS.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const address = String(body.address ?? "").trim();
  const apn = String(body.apn ?? body.hin ?? "").trim();
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  const geo = await geocode(address);
  const links = sourceLinks(geo.normalizedAddress || address, geo.state, geo.county);

  // Known numbers the owner already has (optional). Anything absent stays unknown.
  const arv = Number(body.arv) || 0;
  const repairs = Number(body.estRepairs) || 0;
  const contract = Number(body.contractPrice) || 0;
  const fee = Number(body.desiredFee) || 10000;
  const haveNumbers = arv > 0;

  const fields = {
    normalizedAddress: { value: geo.normalizedAddress ?? null, provenance: geo.matched ? "census" : "needs_source" },
    county: { value: geo.county ?? null, provenance: geo.matched ? "census" : "needs_source" },
    state: { value: geo.state ?? null, provenance: geo.matched ? "census" : "needs_source" },
    coordinates: { value: geo.matched ? `${geo.lat}, ${geo.lon}` : null, provenance: geo.matched ? "census" : "needs_source" },
    censusTract: { value: geo.tract ?? null, provenance: geo.matched ? "census" : "needs_source" },
    apn: { value: apn || null, provenance: apn ? "owner" : "needs_source" },
    arv: { value: arv || null, provenance: arv ? "owner" : "needs_source" },
    estRepairs: { value: repairs || null, provenance: repairs ? "owner" : "needs_source" },
  };

  // Written analysis only when we have at least an ARV to reason from — no
  // fabricated comps.
  let analysis: string | null = null;
  if (haveNumbers) {
    const mao = Math.max(0, Math.round(arv * 0.7 - repairs - fee));
    const r = await complete([
      { role: "system", content: "You are SAHJONY, acquisitions analyst for SAHJONY CAPITAL LLC. Be concise and direct (4-5 sentences). Do not invent comps; reason only from the numbers given." },
      { role: "user", content: `Address: ${geo.normalizedAddress || address}${apn ? ` (APN ${apn})` : ""}, ${geo.county ?? ""} ${geo.state ?? ""}.
Given ARV ${arv}, repairs ${repairs}, target fee ${fee}, contract ${contract || "TBD"}. MAO(70%) computes to ${mao}.
Assess the spread, a realistic assignment fee, and the single best next step.` },
    ]);
    analysis = r?.content ?? null;
  }

  return NextResponse.json({
    matched: geo.matched,
    geoDetail: geo.detail,
    fields,
    sources: links,
    analysis,
    note: haveNumbers
      ? "Address verified live. Confirm ARV/repairs against your licensed sources before assigning."
      : "Address verified live. Open the sources to pull ARV/comps (licensed), then re-run for analysis. No values are invented.",
  });
}
