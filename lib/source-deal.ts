// Autonomous deal sourcing from just an address.
//
// Pulls every REAL field SAHJONY can — census-verified location, and (if the
// owner's Regrid token is set) parcel owner/APN/assessed value/year built/sqft —
// then creates the deal as a lead. ARV/repairs stay 0 (needs real comps from a
// licensed source) and are never invented. Shared by the /enrich route and the
// Hermes brain so "add 123 Main St" behaves identically everywhere.

import { geocode } from "./enrich";
import { regridByPoint, regridByAddress, regridConnected } from "./regrid";
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

  let parcel: any = null;
  if (regridConnected()) {
    const r = geo.matched && geo.lat != null && geo.lon != null
      ? await regridByPoint(geo.lat, geo.lon)
      : await regridByAddress(address);
    if (r.ok) parcel = r.parcel;
  }

  const norm = geo.normalizedAddress || address;
  const parts = norm.split(",").map((s) => s.trim());
  const apn = extra.apn || parcel?.apn || "";

  const deal = await upsertDeal({
    address: parts[0] || address,
    city: parts[1] || "",
    state: geo.state || "",
    propertyType: "SFR",
    sqft: Number(parcel?.sqft) || 0,
    arv: Number(extra.arv) || 0,
    estRepairs: Number(extra.estRepairs) || 0,
    contractPrice: Number(extra.contractPrice) || 0,
    desiredFee: Number(extra.fee) || 10000,
    source: "off_market",
    status: "lead",
    notes: [
      geo.matched ? `Census-verified · ${geo.county ?? ""} · tract ${geo.tract ?? "?"}` : "Address unverified",
      parcel?.owner ? `Owner: ${parcel.owner}` : "",
      apn ? `APN: ${apn}` : "",
      parcel?.assessedValue ? `Assessed: $${Number(parcel.assessedValue).toLocaleString()}` : "",
      parcel?.yearBuilt ? `Built: ${parcel.yearBuilt}` : "",
    ].filter(Boolean).join(" · "),
    motivation: "Auto-sourced by Hermes from address",
  });

  const autoFilled = [
    geo.matched && "address", geo.matched && "city", geo.matched && "state", geo.matched && "county/coords",
    parcel?.owner && "owner", apn && "APN", parcel?.assessedValue && "assessedValue", parcel?.yearBuilt && "yearBuilt", parcel?.sqft && "sqft",
  ].filter(Boolean) as string[];
  const needs = [!extra.arv && "ARV (real comps)", !extra.estRepairs && "repairs (scope)", !parcel && regridConnected() === false && "parcel data (add Regrid token)"].filter(Boolean) as string[];

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
