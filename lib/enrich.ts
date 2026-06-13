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

// Listing & FSBO sites for a market — official public-facing search pages
// (launchers, not scrapers). Use to eyeball on-market/FSBO comps and condition.
export function listingLinks(city: string, state: string) {
  const q = encodeURIComponent(`${city} ${state}`.trim());
  const cs = encodeURIComponent(`${city}_${state}`);
  return [
    { label: "Propwire", url: `https://propwire.com/search` },
    { label: "Zillow", url: `https://www.zillow.com/homes/${q}_rb/` },
    { label: "Zillow FSBO", url: `https://www.zillow.com/homes/fsbo/${q}_rb/` },
    { label: "Redfin", url: `https://www.redfin.com/city/search?location=${q}` },
    { label: "Realtor.com", url: `https://www.realtor.com/realestateandhomes-search/${cs}` },
    { label: "Trulia", url: `https://www.trulia.com/for_sale/${q}/` },
    { label: "Homes.com", url: `https://www.homes.com/${q}/` },
    { label: "FSBO.com", url: `https://fsbo.com/listings/?location=${q}` },
    { label: "Auction.com", url: `https://www.auction.com/residential/${encodeURIComponent(state)}/` },
    { label: "HUD Homes", url: `https://www.hudhomestore.gov/Listing/PropertySearch.aspx` },
  ];
}

// Official public-record & court portals for property-level due diligence
// (liens, pre-foreclosure/lis pendens, probate, tax sale, code enforcement,
// bankruptcy). These are official channels for PROPERTY due diligence — not
// person investigations, and not scraped.
export function recordsLinks(address: string, state?: string, county?: string) {
  const loc = `${county ?? ""} ${state ?? ""}`.trim();
  const g = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  return [
    { label: "County recorder / deeds", url: g(`${loc} county recorder of deeds official records search`), note: "Deeds, mortgages, liens, lis pendens." },
    { label: "Tax assessor / collector", url: g(`${loc} county tax assessor collector property search delinquent`), note: "Assessed value, delinquent taxes, tax sale." },
    { label: "Clerk of court records", url: g(`${loc} clerk of court official public records search`), note: "Civil/probate/foreclosure case search." },
    { label: "Probate court", url: g(`${loc} probate court case search`), note: "Estates — common motivated-seller situation." },
    { label: "Code enforcement", url: g(`${loc} city code enforcement violation property search`), note: "Violations indicating distress." },
    { label: "County GIS / parcel viewer", url: g(`${loc} county GIS parcel viewer map`), note: "Official parcel maps, dimensions, zoning." },
    { label: "PACER (federal/bankruptcy)", url: "https://pacer.uscourts.gov/", note: "Federal court & bankruptcy records (official)." },
  ];
}
