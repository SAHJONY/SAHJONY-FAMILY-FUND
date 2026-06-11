// Unified Property Intelligence — the PropStream-style research view, built on
// REAL providers: US Census (location), Regrid (parcel), ATTOM (detail, AVM,
// tax, comps). Each datum carries its source. No scraping, no skip tracing.

import { geocode, listingLinks, recordsLinks } from "./enrich";
import { regridByPoint, regridByAddress, regridConnected } from "./regrid";
import { attomProperty, attomConnected } from "./attom";

export interface IntelField<T> { value: T | null; source: string }
export interface PropertyIntel {
  query: string;
  matched: boolean;
  location: {
    normalizedAddress: IntelField<string>;
    city: IntelField<string>;
    state: IntelField<string>;
    county: IntelField<string>;
    coordinates: IntelField<string>;
    censusTract: IntelField<string>;
  };
  parcel: {
    apn: IntelField<string>;
    owner: IntelField<string>;
    lotSqft: IntelField<number>;
    yearBuilt: IntelField<number>;
  };
  building: {
    beds: IntelField<number>;
    baths: IntelField<number>;
    sqft: IntelField<number>;
    propertyType: IntelField<string>;
  };
  valuation: {
    avm: IntelField<number>;          // as-is estimated value
    avmRange: IntelField<string>;
    assessedValue: IntelField<number>;
    marketValue: IntelField<number>;
    lastSalePrice: IntelField<number>;
    lastSaleDate: IntelField<string>;
  };
  sources: { census: boolean; regrid: boolean; attom: boolean };
  listings: { label: string; url: string }[];
  records: { label: string; url: string; note: string }[];
  notes: string[];
}

const f = <T>(value: T | null | undefined, source: string): IntelField<T> => ({ value: (value ?? null) as T | null, source: value == null ? "needs_source" : source });

export async function propertyIntel(address: string): Promise<PropertyIntel> {
  const geo = await geocode(address);

  const [regridRes, attom] = await Promise.all([
    regridConnected()
      ? (geo.matched && geo.lat != null && geo.lon != null ? regridByPoint(geo.lat, geo.lon) : regridByAddress(address))
      : Promise.resolve(null),
    attomConnected() ? attomProperty(geo.normalizedAddress || address) : Promise.resolve(null),
  ]);
  const parcel = regridRes?.ok ? regridRes.parcel : null;

  const parts = (geo.normalizedAddress || address).split(",").map((s) => s.trim());
  const notes: string[] = [];
  if (!regridConnected()) notes.push("Add REGRID_API_TOKEN for parcel owner/APN.");
  if (!attomConnected()) notes.push("Add ATTOM_API_KEY for building detail, AVM valuation, tax & comps.");
  if (attom?.error) notes.push(`ATTOM: ${attom.error}`);

  return {
    query: address,
    matched: geo.matched,
    location: {
      normalizedAddress: f(geo.normalizedAddress, "census"),
      city: f(parts[1], "census"),
      state: f(geo.state, "census"),
      county: f(geo.county, "census"),
      coordinates: f(geo.matched ? `${geo.lat}, ${geo.lon}` : null, "census"),
      censusTract: f(geo.tract, "census"),
    },
    parcel: {
      apn: f(parcel?.apn ?? null, "regrid"),
      owner: f(parcel?.owner ?? attom?.owner ?? null, parcel?.owner ? "regrid" : "attom"),
      lotSqft: f(attom?.lotSqft ?? parcel?.acreage ? Math.round((parcel?.acreage ?? 0) * 43560) || null : null, attom?.lotSqft ? "attom" : "regrid"),
      yearBuilt: f(attom?.yearBuilt ?? parcel?.yearBuilt ?? null, attom?.yearBuilt ? "attom" : "regrid"),
    },
    building: {
      beds: f(attom?.beds ?? null, "attom"),
      baths: f(attom?.baths ?? null, "attom"),
      sqft: f(attom?.sqft ?? parcel?.sqft ?? null, attom?.sqft ? "attom" : "regrid"),
      propertyType: f(attom?.propertyType ?? null, "attom"),
    },
    valuation: {
      avm: f(attom?.avm ?? null, "attom-avm"),
      avmRange: f(attom?.avmLow && attom?.avmHigh ? `$${attom.avmLow.toLocaleString()}–$${attom.avmHigh.toLocaleString()}` : null, "attom-avm"),
      assessedValue: f(attom?.assessedValue ?? parcel?.assessedValue ?? null, attom?.assessedValue ? "attom" : "regrid"),
      marketValue: f(attom?.marketValue ?? null, "attom"),
      lastSalePrice: f(attom?.lastSalePrice ?? null, "attom"),
      lastSaleDate: f(attom?.lastSaleDate ?? null, "attom"),
    },
    sources: { census: geo.matched, regrid: !!parcel, attom: !!(attom && !attom.error) },
    listings: listingLinks(parts[1] || "", geo.state || ""),
    records: recordsLinks(geo.normalizedAddress || address, geo.state, geo.county),
    notes,
  };
}
