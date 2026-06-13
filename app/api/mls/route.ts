import { NextRequest, NextResponse } from "next/server";
import { getSecret } from "@/lib/secrets";

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
  const cs = encodeURIComponent(`${city}_${state}`);
  return [
    { label: "Zillow (FSBO)", url: `https://www.zillow.com/homes/fsbo/${q}_rb/`, kind: "fsbo" },
    { label: "Zillow (all)", url: `https://www.zillow.com/homes/${q}_rb/`, kind: "mls" },
    { label: "Realtor.com", url: `https://www.realtor.com/realestateandhomes-search/${cs}`, kind: "mls" },
    { label: "Redfin", url: `https://www.redfin.com/city/search?location=${q}`, kind: "mls" },
    { label: "Homes.com", url: `https://www.homes.com/${q}/`, kind: "mls" },
    { label: "Trulia", url: `https://www.trulia.com/for_sale/${q}/`, kind: "mls" },
    { label: "FSBO.com", url: `https://fsbo.com/listings/?location=${q}`, kind: "fsbo" },
    { label: "ForSaleByOwner", url: `https://www.forsalebyowner.com/search/list/?q=${q}`, kind: "fsbo" },
    { label: "Craigslist (FSBO)", url: `https://www.craigslist.org/search/rea?query=${q}`, kind: "fsbo" },
    { label: "Auction.com", url: `https://www.auction.com/residential/${state}/`, kind: "distressed" },
    { label: "HUD Homes", url: `https://www.hudhomestore.gov/Listing/PropertySearch.aspx`, kind: "distressed" },
    { label: "Foreclosure.com", url: `https://www.foreclosure.com/${encodeURIComponent(state.toLowerCase())}`, kind: "distressed" },
  ];
}

export async function GET() {
  return NextResponse.json({ connected: !!(getSecret("MLS_RESO_URL") && getSecret("MLS_RESO_TOKEN")) });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const city = String(b.city ?? "").trim();
  const state = String(b.state ?? "").trim().toUpperCase();
  const minP = Number(b.minPrice) || 0;
  const maxP = Number(b.maxPrice) || 0;
  const minBeds = Number(b.minBeds) || 0;

  const base = getSecret("MLS_RESO_URL"), token = getSecret("MLS_RESO_TOKEN");
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
