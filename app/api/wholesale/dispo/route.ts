import { NextRequest, NextResponse } from "next/server";
import { listDeals, listBuyers, matchBuyers, analyzeDeal } from "@/lib/wholesale";
import { complete } from "@/lib/infer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Drafts a disposition (buyer-blast) email for a deal, from REAL deal data, to
// send to the owner's OWN opt-in buyer list. Does not send anything and does
// not cold-contact — it composes copy the owner reviews and sends.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const deal = (await listDeals()).find((d) => d.id === body.dealId);
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  const a = analyzeDeal(deal);
  const matches = matchBuyers(deal, await listBuyers());
  const usd = (n: number) => "$" + (n || 0).toLocaleString();

  const res = await complete([
    { role: "system", content: "You are SAHJONY, dispositions manager for SAHJONY CAPITAL LLC. Write a tight, professional wholesale deal blast email to a cash-buyer list. Include a subject line, the key numbers, and a clear call to action. Do not invent data not provided. 150-200 words." },
    { role: "user", content: `Write the buyer-blast email for this deal.
Address: ${deal.address}, ${deal.city} ${deal.state}
Type: ${deal.propertyType}, ${deal.beds}bd/${deal.baths}ba ${deal.sqft || "?"}sqft
ARV: ${usd(deal.arv)} | Est. repairs: ${usd(deal.estRepairs)} | Contract/asking: ${usd(deal.contractPrice || deal.listPrice)}
Buyer all-in (contract+repairs): ${usd(a.buyerAllIn)} | Margin to ARV: ${usd(a.buyerMarginToArv)} | Deal grade: ${a.grade}
This is going to ${matches.length} matched cash buyers in our network. Use a placeholder [YOUR PHONE] for contact.` },
  ]);

  return NextResponse.json({
    email: res?.content ?? null,
    matchedBuyers: matches.length,
    note: "Review before sending to your opt-in buyer list. SAHJONY does not auto-send or cold-contact.",
  });
}
