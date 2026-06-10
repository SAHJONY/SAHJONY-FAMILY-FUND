import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// MLS via the RESO Web API (the industry-standard OData feed). Works with the
// owner's OWN licensed MLS credentials (MLS_RESO_URL + MLS_RESO_TOKEN, set on
// /env) — obtained through their brokerage/MLS membership. There is NO free
// public MLS API and scraping portals violates their ToS, so when no licensed
// feed is configured this returns honest public on-market SEARCH links instead
// of fabricated listings.

function publicLinks(city: string, state: string, minP: number, maxP: number) {
  const q = encodeURIComponent(`${city} ${state}`.trim());
  return [
    { label: "Realtor.com", url: `https://www.realtor.com/realestateandhomes-search/${encodeURIComponent(`${city}_${state}`)}` },
    { label: "Zillow", url: `https://www.zillow.com/homes/${q}_rb/` },
    { label: "Redfin", url: `https://www.redfin.com/city/search?location=${q}` },
    { label: "FSBO.com", url: `https://fsbo.com/listings/?location=${q}` },
  ];
}

export async function GET() {
  return NextResponse.json({ connected: !!(process.env.MLS_RESO_URL && process.env.MLS_RESO_TOKEN) });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const city = String(b.city ?? "").trim();
  const state = String(b.state ?? "").trim().toUpperCase();
  const minP = Number(b.minPrice) || 0;
  const maxP = Number(b.maxPrice) || 0;
  const minBeds = Number(b.minBeds) || 0;

  const base = process.env.MLS_RESO_URL, token = process.env.MLS_RESO_TOKEN;
  if (!base || !token) {
    return NextResponse.json({
      connected: false,
      detail: "No licensed MLS feed connected. Add MLS_RESO_URL + MLS_RESO_TOKEN (from your brokerage/MLS) on the env page. Until then, use these official public on-market searches:",
      publicSearches: publicLinks(city, state, minP, maxP),
    });
  }

  // Build a RESO OData query (standard field names).
  const filters: string[] = ["StandardStatus eq 'Active'"];
  if (city) filters.push(`City eq '${city.replace(/'/g, "''")}'`);
  if (state) filters.push(`StateOrProvince eq '${state}'`);
  if (minP) filters.push(`ListPrice ge ${minP}`);
  if (maxP) filters.push(`ListPrice le ${maxP}`);
  if (minBeds) filters.push(`BedroomsTotal ge ${minBeds}`);
  const url = `${base.replace(/\/$/, "")}/Property?$filter=${encodeURIComponent(filters.join(" and "))}&$top=25&$orderby=ListPrice asc`;

  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 12000);
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: c.signal });
    if (!res.ok) return NextResponse.json({ connected: true, error: `MLS HTTP ${res.status}` }, { status: 502 });
    const j = await res.json();
    const listings = (j.value ?? []).map((p: any) => ({
      address: [p.StreetNumber, p.StreetName, p.StreetSuffix].filter(Boolean).join(" "),
      city: p.City, state: p.StateOrProvince, price: p.ListPrice,
      beds: p.BedroomsTotal, baths: p.BathroomsTotalInteger, sqft: p.LivingArea,
      status: p.StandardStatus, mlsId: p.ListingId, dom: p.DaysOnMarket,
    }));
    return NextResponse.json({ connected: true, count: listings.length, listings });
  } catch (e) {
    return NextResponse.json({ connected: true, error: `MLS query failed: ${(e as Error).message}` }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
