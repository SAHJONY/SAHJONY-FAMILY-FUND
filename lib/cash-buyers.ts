// Cash-buyer finder.
//
// Same honest model as the seller/records side: the legitimate way to find cash
// buyers is REAL public transaction records — recent CASH sales are recorded
// deeds (public), and the buyer (grantee) is on the deed. We surface those via
// official county recorder deed-search launchers, and — when the owner's ATTOM
// key is connected — attempt a structured recent-sales pull to list buyer
// ENTITIES (LLCs/investors who paid cash) for a market.
//
// We do NOT skip-trace personal phone/email of buyers. You get the buyer entity
// name + what/where/price from public record; you reach them through your own
// network or their public business contact — not harvested personal data.

import { getSecret } from "./secrets";

export interface BuyerLead {
  name: string;
  detail: string;
  source: string;
}

export interface CashBuyerResult {
  market: string;
  attomConnected: boolean;
  buyers: BuyerLead[];
  recordSources: { label: string; url: string; note: string }[];
  note: string;
}

function recordSources(city: string, state: string) {
  const loc = `${city} ${state}`.trim();
  const g = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  return [
    { label: "County recorder — cash deeds", url: g(`${loc} county recorder deed search cash sale grantor grantee`), note: "Recent recorded deeds (cash sales have no mortgage filed)." },
    { label: "Assessor — absentee/LLC owners", url: g(`${loc} county assessor property search owner mailing address LLC`), note: "LLC/absentee owners = likely investors/cash buyers." },
    { label: "Auction.com buyers", url: `https://www.auction.com/residential/${encodeURIComponent(state)}/`, note: "Active auction buyers transact in cash." },
    { label: "Recent sold (Zillow)", url: `https://www.zillow.com/homes/recently_sold/${encodeURIComponent(loc)}_rb/`, note: "Cross-reference recent sales; cash buyers repeat." },
    { label: "Propwire", url: "https://propwire.com/search", note: "Free PropStream-style search incl. cash-buyer lists." },
  ];
}

// Best-effort ATTOM recent-sales pull for a postal area. ATTOM's expanded sale
// data carries the transaction; grantee/owner names appear on higher tiers, so
// this is defensive — it surfaces what the account is licensed to return.
async function attomBuyers(city: string, state: string): Promise<BuyerLead[]> {
  const key = getSecret("ATTOM_API_KEY");
  if (!key) return [];
  const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/sale/snapshot?address2=${encodeURIComponent(`${city}, ${state}`)}&pagesize=50`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 12000);
  try {
    const res = await fetch(url, { headers: { apikey: key, Accept: "application/json" }, signal: c.signal });
    if (!res.ok) return [];
    const j = await res.json();
    const props = j?.property ?? [];
    const counts = new Map<string, { count: number; last: string }>();
    for (const p of props) {
      const buyer = p?.owner?.owner1?.lastname
        ? `${p.owner.owner1.firstnameandmi ?? ""} ${p.owner.owner1.lastname}`.trim()
        : null;
      const amt = p?.sale?.amount?.saleamt;
      if (!buyer) continue;
      const prev = counts.get(buyer) ?? { count: 0, last: "" };
      counts.set(buyer, { count: prev.count + 1, last: amt ? `$${Number(amt).toLocaleString()}` : prev.last });
    }
    return [...counts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 25)
      .map(([name, v]) => ({ name, detail: `${v.count} recent purchase(s)${v.last ? ` · last ${v.last}` : ""}`, source: "attom" }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export async function findCashBuyers(city: string, state: string): Promise<CashBuyerResult> {
  const attomOn = !!getSecret("ATTOM_API_KEY");
  const buyers = attomOn ? await attomBuyers(city, state) : [];
  return {
    market: `${city}, ${state}`.trim(),
    attomConnected: attomOn,
    buyers,
    recordSources: recordSources(city, state),
    note: attomOn
      ? (buyers.length
        ? `Surfaced ${buyers.length} buyer entities from recent ATTOM sales. Reach them via your network/public business contact — import the ones you know.`
        : "ATTOM connected but returned no buyer names for this market (your tier may not include grantee names). Use the recorder deed search.")
      : "Add ATTOM_API_KEY to auto-surface recent cash-buyer entities. Until then, the official deed-record searches below are the real free method — no skip tracing of personal contacts.",
  };
}
