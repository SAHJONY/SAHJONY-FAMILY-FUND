// ATTOM Data connector — the real, licensed property-data API that underlies
// PropStream-style research. Gated by the owner's ATTOM_API_KEY (set on /env).
// Returns REAL data: property detail, AVM valuation, tax/assessment, and area
// sales comps. Nothing is invented; with no key it reports "not connected".
//
// Note: an AVM is an Automated Valuation Model (an as-is estimated value, like a
// Zestimate) — a real licensed data product, NOT a fabricated number. It is the
// AS-IS value; after-repair value (ARV) still needs comp judgment.

import { getSecret } from "./secrets";

const BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";

export function attomConnected() {
  return !!getSecret("ATTOM_API_KEY");
}

async function attomGet(path: string): Promise<any | null> {
  const key = getSecret("ATTOM_API_KEY");
  if (!key) return null;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 12000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { apikey: key, Accept: "application/json" },
      signal: c.signal,
    });
    if (!res.ok) return { __error: `ATTOM HTTP ${res.status}` };
    return await res.json();
  } catch (e) {
    return { __error: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}

// Split "123 Main St, Austin, TX 78701" into ATTOM's address1 / address2.
function splitAddress(full: string): { a1: string; a2: string } {
  const parts = full.split(",").map((s) => s.trim());
  const a1 = parts[0] || full;
  const a2 = parts.slice(1).join(", ");
  return { a1, a2 };
}

export interface AttomProperty {
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  owner: string | null;
  assessedValue: number | null;
  marketValue: number | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
  avm: number | null;          // as-is estimated value
  avmHigh: number | null;
  avmLow: number | null;
  error?: string;
}

function n(v: any): number | null {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : null;
}

export async function attomProperty(address: string): Promise<AttomProperty | null> {
  if (!attomConnected()) return null;
  const { a1, a2 } = splitAddress(address);
  const q = `?address1=${encodeURIComponent(a1)}&address2=${encodeURIComponent(a2)}`;

  // Run detail + AVM together.
  const [detail, avm] = await Promise.all([
    attomGet(`/property/detail${q}`),
    attomGet(`/avm/detail${q}`),
  ]);

  const dErr = detail?.__error, aErr = avm?.__error;
  const prop = detail?.property?.[0];
  const avmProp = avm?.property?.[0]?.avm?.amount;

  if (!prop && !avmProp) {
    return {
      beds: null, baths: null, sqft: null, lotSqft: null, yearBuilt: null,
      propertyType: null, owner: null, assessedValue: null, marketValue: null,
      lastSalePrice: null, lastSaleDate: null, avm: null, avmHigh: null, avmLow: null,
      error: dErr || aErr || "No ATTOM match for that address.",
    };
  }

  return {
    beds: n(prop?.building?.rooms?.beds),
    baths: n(prop?.building?.rooms?.bathstotal),
    sqft: n(prop?.building?.size?.livingsize ?? prop?.building?.size?.universalsize),
    lotSqft: n(prop?.lot?.lotsize2 ?? prop?.lot?.lotSize1),
    yearBuilt: n(prop?.summary?.yearbuilt),
    propertyType: prop?.summary?.proptype ?? prop?.summary?.propclass ?? null,
    owner: prop?.owner?.owner1?.lastname
      ? `${prop.owner.owner1.firstnameandmi ?? ""} ${prop.owner.owner1.lastname}`.trim()
      : null,
    assessedValue: n(prop?.assessment?.assessed?.assdttlvalue),
    marketValue: n(prop?.assessment?.market?.mktttlvalue),
    lastSalePrice: n(prop?.sale?.amount?.saleamt),
    lastSaleDate: prop?.sale?.salesearchdate ?? null,
    avm: n(avmProp?.value),
    avmHigh: n(avmProp?.high),
    avmLow: n(avmProp?.low),
  };
}
