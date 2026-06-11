// Autonomous deal sourcing from just an address.
//
// Pulls every REAL field SAHJONY can — census-verified location, and (if the
// owner's Regrid token is set) parcel owner/APN/assessed value/year built/sqft —
// then creates the deal as a lead. ARV/repairs stay 0 (needs real comps from a
// licensed source) and are never invented. Shared by the /enrich route and the
// Hermes brain so "add 123 Main St" behaves identically everywhere.

import { geocode } from "./enrich";
import { regridByPoint, regridByAddress, regridConnected } from "./regrid";
import { attomProperty, attomConnected } from "./attom";
import { upsertDeal, analyzeDeal, type Deal } from "./wholesale";

export interface SourcedDeal {
  deal: Deal;
  analysis: ReturnType<typeof analyzeDeal>;
  matched: boolean;
  autoFilled: string[];
  needs: string[];
  summary: string;
}

export async function sourceDealFromAddress(
  address: string,
  extra: { arv?: number; estRepairs?: number; contractPrice?: number; fee?: number; apn?: string } = {}
): Promise<SourcedDeal> {
  const geo = await geocode(address);

  const norm0 = geo.normalizedAddress || address;
  const [regridRes, attom] = await Promise.all([
    regridConnected()
      ? (geo.matched && geo.lat != null && geo.lon != null ? regridByPoint(geo.lat, geo.lon) : regridByAddress(address))
      : Promise.resolve(null),
    attomConnected() ? attomProperty(norm0) : Promise.resolve(null),
  ]);
  const parcel: any = regridRes?.ok ? regridRes.parcel : null;
  const a: any = attom && !attom.error ? attom : null;

  const parts = norm0.split(",").map((s) => s.trim());
  const apn = extra.apn || parcel?.apn || "";
  const owner = parcel?.owner || a?.owner || "";
  const assessed = a?.assessedValue || parcel?.assessedValue || 0;
  const yearBuilt = a?.yearBuilt || parcel?.yearBuilt || 0;
  const sqft = a?.sqft || parcel?.sqft || 0;
  // ATTOM AVM is a real AS-IS valuation (not ARV). Surfaced as a reference; ARV
  // still needs comp judgment, so we don't silently set arv from it.
  const avm = a?.avm || 0;

  const deal = await upsertDeal({
    address: parts[0] || address,
    city: parts[1] || "",
    state: geo.state || "",
    propertyType: a?.propertyType || "SFR",
    beds: Number(a?.beds) || 0,
    baths: Number(a?.baths) || 0,
    sqft: Number(sqft) || 0,
    arv: Number(extra.arv) || 0,
    estRepairs: Number(extra.estRepairs) || 0,
    contractPrice: Number(extra.contractPrice) || 0,
    desiredFee: Number(extra.fee) || 10000,
    source: "off_market",
    status: "lead",
    notes: [
      geo.matched ? `Census-verified · ${geo.county ?? ""} · tract ${geo.tract ?? "?"}` : "Address unverified",
      owner ? `Owner: ${owner}` : "",
      apn ? `APN: ${apn}` : "",
      avm ? `AVM (as-is): $${Number(avm).toLocaleString()}` : "",
      assessed ? `Assessed: $${Number(assessed).toLocaleString()}` : "",
      yearBuilt ? `Built: ${yearBuilt}` : "",
      a?.lastSalePrice ? `Last sale: $${Number(a.lastSalePrice).toLocaleString()} (${a.lastSaleDate ?? "?"})` : "",
    ].filter(Boolean).join(" · "),
    motivation: "Auto-sourced by Hermes from address",
  });

  const autoFilled = [
    geo.matched && "address", geo.matched && "city", geo.matched && "state", geo.matched && "county/coords",
    owner && "owner", apn && "APN", assessed && "assessedValue", yearBuilt && "yearBuilt", sqft && "sqft",
    a?.beds && "beds", a?.baths && "baths", avm && "AVM(as-is)", a?.lastSalePrice && "lastSale",
  ].filter(Boolean) as string[];
  const needs = [
    !extra.arv && "ARV (real comps)", !extra.estRepairs && "repairs (scope)",
    !parcel && !regridConnected() && "parcel data (add Regrid token)",
    !a && !attomConnected() && "building/AVM/comps (add ATTOM key)",
  ].filter(Boolean) as string[];

  return {
    deal,
    analysis: analyzeDeal(deal),
    matched: geo.matched,
    autoFilled,
    needs,
    summary: geo.matched
      ? `Sourced ${parts[0]}, ${parts[1] ?? ""} ${geo.state ?? ""}. Auto-filled ${autoFilled.length} field(s)${parcel ? " incl. real parcel data" : ""}. Still needs: ${needs.join(", ") || "nothing"}.`
      : `Could not verify that address against Census records — saved as an unverified lead.`,
  };
}
