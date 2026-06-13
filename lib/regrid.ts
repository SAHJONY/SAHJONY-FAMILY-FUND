// Regrid (regrid.com) parcel data — real, licensed, nationwide parcel records.
//
// Requires the owner's REGRID_API_TOKEN (set on the /env page). Returns REAL
// parcel data (APN, owner of record, assessed value, acreage, etc.) when
// configured; if there is no token it honestly reports "not connected" rather
// than inventing anything. Nothing here is simulated.

import { getSecret } from "./secrets";

export interface RegridParcel {
  apn: string | null;
  owner: string | null;
  mailingAddress: string | null;
  situsAddress: string | null;
  acreage: number | null;
  assessedValue: number | null;
  landValue: number | null;
  improvementValue: number | null;
  yearBuilt: number | null;
  sqft: number | null;
  county: string | null;
  raw?: Record<string, unknown>;
}

export function regridConnected() {
  return !!getSecret("REGRID_API_TOKEN");
}

function pick(f: Record<string, any>, ...keys: string[]) {
  for (const k of keys) if (f[k] !== undefined && f[k] !== null && f[k] !== "") return f[k];
  return null;
}

function mapFields(f: Record<string, any>): RegridParcel {
  return {
    apn: pick(f, "parcelnumb", "parcelnumb_no_formatting", "alt_parcelnumb1"),
    owner: pick(f, "owner", "owner2"),
    mailingAddress: pick(f, "mailadd", "mail_address"),
    situsAddress: pick(f, "address", "saddno") ? pick(f, "address") : null,
    acreage: Number(pick(f, "ll_gisacre", "gisacre", "acreage")) || null,
    assessedValue: Number(pick(f, "parval", "totval", "assessed_value")) || null,
    landValue: Number(pick(f, "landval", "land_value")) || null,
    improvementValue: Number(pick(f, "improvval", "improvement_value")) || null,
    yearBuilt: Number(pick(f, "yearbuilt", "yrbuilt")) || null,
    sqft: Number(pick(f, "ll_bldg_footprint_sqft", "sqft", "gross_sqft")) || null,
    county: pick(f, "county"),
    raw: f,
  };
}

// Query a parcel by point. Real Regrid v2 endpoint.
export async function regridByPoint(lat: number, lon: number): Promise<{ ok: boolean; parcel?: RegridParcel; detail: string }> {
  const token = getSecret("REGRID_API_TOKEN");
  if (!token) return { ok: false, detail: "Regrid not connected. Set REGRID_API_TOKEN on the env page." };
  const url = `https://app.regrid.com/api/v2/parcels/point?lat=${lat}&lon=${lon}&token=${token}&return_geometry=false&limit=1`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 8000);
  try {
    const res = await fetch(url, { signal: c.signal });
    if (!res.ok) return { ok: false, detail: `Regrid HTTP ${res.status}` };
    const j = await res.json();
    const feat = j?.parcels?.features?.[0] ?? j?.features?.[0];
    const fields = feat?.properties?.fields ?? feat?.properties;
    if (!fields) return { ok: false, detail: "No parcel found at that point." };
    return { ok: true, parcel: mapFields(fields), detail: "Live Regrid parcel record." };
  } catch (e) {
    return { ok: false, detail: `Regrid query failed: ${(e as Error).message}` };
  } finally {
    clearTimeout(t);
  }
}

export async function regridByAddress(address: string): Promise<{ ok: boolean; parcel?: RegridParcel; detail: string }> {
  const token = getSecret("REGRID_API_TOKEN");
  if (!token) return { ok: false, detail: "Regrid not connected. Set REGRID_API_TOKEN on the env page." };
  const url = `https://app.regrid.com/api/v2/parcels/address?query=${encodeURIComponent(address)}&token=${token}&return_geometry=false&limit=1`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 8000);
  try {
    const res = await fetch(url, { signal: c.signal });
    if (!res.ok) return { ok: false, detail: `Regrid HTTP ${res.status}` };
    const j = await res.json();
    const feat = j?.parcels?.features?.[0] ?? j?.features?.[0];
    const fields = feat?.properties?.fields ?? feat?.properties;
    if (!fields) return { ok: false, detail: "No parcel found for that address." };
    return { ok: true, parcel: mapFields(fields), detail: "Live Regrid parcel record." };
  } catch (e) {
    return { ok: false, detail: `Regrid query failed: ${(e as Error).message}` };
  } finally {
    clearTimeout(t);
  }
}
