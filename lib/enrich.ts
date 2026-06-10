// Address enrichment for SAHJONY CAPITAL deals.
//
// Honesty model: every returned field carries a `provenance`:
//   - "census"    : fetched live from the free US Census geocoder (REAL)
//   - "owner"     : the owner supplied it
//   - "needs_source": must be confirmed from a licensed/authoritative source
//                     (PropStream, county assessor, MLS comps) — NOT invented.
// We never fabricate ARV/repairs/comps. Estimates from the model are returned
// separately and explicitly labeled as estimates, not as measured data.

export interface GeoResult {
  matched: boolean;
  normalizedAddress?: string;
  lat?: number;
  lon?: number;
  state?: string;
  county?: string;
  tract?: string;
  detail: string;
}

// Free, keyless, real: US Census Bureau geocoder.
export async function geocode(address: string): Promise<GeoResult> {
  const base = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
  const url = `${base}?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 8000);
  try {
    const res = await fetch(url, { signal: c.signal });
    if (!res.ok) return { matched: false, detail: `Census geocoder HTTP ${res.status}` };
    const j = await res.json();
    const m = j?.result?.addressMatches?.[0];
    if (!m) return { matched: false, detail: "No match in Census records for that address." };
    const geo = m.geographies ?? {};
    const county = geo?.Counties?.[0]?.NAME;
    const stateAbbr = m.addressComponents?.state;
    const tract = geo?.["Census Tracts"]?.[0]?.NAME;
    return {
      matched: true,
      normalizedAddress: m.matchedAddress,
      lat: m.coordinates?.y,
      lon: m.coordinates?.x,
      state: stateAbbr,
      county,
      tract,
      detail: "Matched against live US Census public records.",
    };
  } catch (e) {
    return { matched: false, detail: `Geocode failed: ${(e as Error).message}` };
  }
}

// Authoritative source deep-links, pre-filled with the address. These are where
// the real ARV/comps/owner/tax data lives. The owner (or the authorized browser
// agent) opens these; nothing is scraped in violation of ToS.
export function sourceLinks(address: string, state?: string, county?: string) {
  const q = encodeURIComponent(address);
  return [
    { label: "PropStream (comps, owner, ARV)", url: process.env.PROPSTREAM_URL || "https://login.propstream.com", note: "Pull ARV + cash-buyer/comp data under your license, then confirm fields." },
    { label: "Zillow", url: `https://www.zillow.com/homes/${q}_rb/`, note: "Public listing / Zestimate context." },
    { label: "Redfin", url: `https://www.redfin.com/stingray/do/location-autocomplete?location=${q}`, note: "Public listing / comps context." },
    { label: "County assessor / records", url: `https://www.google.com/search?q=${encodeURIComponent(`${county ?? ""} ${state ?? ""} county assessor property search`)}`, note: "Public tax-assessed value, owner of record, parcel/APN." },
    { label: "Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${q}`, note: "Street view / condition / neighborhood." },
  ];
}
