import { NextRequest, NextResponse } from "next/server";
import { geocode, sourceLinks, recordsLinks } from "@/lib/enrich";
import { regridByPoint, regridByAddress, regridConnected } from "@/lib/regrid";
import { upsertDeal, analyzeDeal } from "@/lib/wholesale";
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
  const records = recordsLinks(geo.normalizedAddress || address, geo.state, geo.county);

  // Real licensed parcel data via Regrid, if connected. Fills owner/APN/assessed
  // value with REAL records — never invented.
  let regrid = null;
  if (regridConnected()) {
    const r = geo.matched && geo.lat != null && geo.lon != null
      ? await regridByPoint(geo.lat, geo.lon)
      : await regridByAddress(address);
    regrid = r.ok ? { connected: true, ...r.parcel, detail: r.detail } : { connected: true, error: r.detail };
  } else {
    regrid = { connected: false, detail: "Set REGRID_API_TOKEN to auto-pull real parcel data (owner/APN/assessed value)." };
  }

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
    apn: { value: apn || (regrid as any)?.apn || null, provenance: apn ? "owner" : (regrid as any)?.apn ? "regrid" : "needs_source" },
    ownerOfRecord: { value: (regrid as any)?.owner || null, provenance: (regrid as any)?.owner ? "regrid" : "needs_source" },
    assessedValue: { value: (regrid as any)?.assessedValue || null, provenance: (regrid as any)?.assessedValue ? "regrid" : "needs_source" },
    yearBuilt: { value: (regrid as any)?.yearBuilt || null, provenance: (regrid as any)?.yearBuilt ? "regrid" : "needs_source" },
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

  // AUTONOMOUS CREATE: build the deal from every real field we could source and
  // save it as a lead — the owner types only the address. ARV/repairs stay 0
  // (needs_source) until real comps are added; nothing is invented.
  let createdDeal = null;
  if (body.autoCreate) {
    const norm = geo.normalizedAddress || address;
    const parts = norm.split(",").map((s) => s.trim());
    const rg = regrid as any;
    const deal = await upsertDeal({
      address: parts[0] || address,
      city: parts[1] || String(body.city ?? ""),
      state: geo.state || String(body.state ?? "").toUpperCase(),
      propertyType: "SFR",
      sqft: Number(rg?.sqft) || 0,
      arv,
      estRepairs: repairs,
      contractPrice: contract,
      desiredFee: fee,
      source: "off_market",
      status: "lead",
      notes: [
        geo.matched ? `Census-verified (${geo.county ?? ""}, tract ${geo.tract ?? "?"})` : "Address unverified",
        rg?.owner ? `Owner: ${rg.owner}` : "",
        rg?.apn || apn ? `APN: ${rg?.apn || apn}` : "",
        rg?.assessedValue ? `Assessed: $${Number(rg.assessedValue).toLocaleString()}` : "",
        rg?.yearBuilt ? `Built: ${rg.yearBuilt}` : "",
      ].filter(Boolean).join(" · "),
      motivation: "Auto-sourced by Hermes from address",
    });
    createdDeal = { ...deal, analysis: analyzeDeal(deal) };
  }

  const autoFilled = Object.entries(fields).filter(([, v]) => v.value && v.provenance !== "needs_source").map(([k]) => k);
  const needs = Object.entries(fields).filter(([, v]) => !v.value || v.provenance === "needs_source").map(([k]) => k);

  return NextResponse.json({
    matched: geo.matched,
    geoDetail: geo.detail,
    fields,
    regrid,
    sources: links,
    records,
    analysis,
    createdDeal,
    autoFilled,
    needs,
    note: haveNumbers
      ? "Address verified live. Confirm ARV/repairs against your licensed sources before assigning."
      : "Address verified live. Open the sources to pull ARV/comps (licensed), then re-run for analysis. No values are invented.",
  });
}
