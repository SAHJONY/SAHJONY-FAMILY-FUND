import { NextResponse } from "next/server";
import { listDeals, listBuyers, matchBuyers, analyzeDeal } from "@/lib/wholesale";
import { listContacts, listJV } from "@/lib/crm";
import { complete } from "@/lib/infer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// SAHJONY's autonomous operations briefing. It reviews the REAL state of the
// business — deals, grades, buyer matches, CRM stages, JV cuts — and returns a
// prioritized next-action plan. This is the autonomy layer: SAHJONY runs the
// analysis and tells you (and itself) what to do next. Irreversible steps
// (sign, call, assign, spend) still require your confirmation elsewhere.
export async function GET() {
  const [deals, buyers, contacts, jvs] = await Promise.all([
    listDeals(), listBuyers(), listContacts(), listJV(),
  ]);

  const usd = (n: number) => "$" + (n || 0).toLocaleString();
  const dealLines = deals.map((d) => {
    const a = analyzeDeal(d);
    const m = matchBuyers(d, buyers).length;
    return `- ${d.address || "(no addr)"} [${d.status}] grade ${a.grade}, ARV ${usd(d.arv)}, MAO ${usd(a.mao)}, fee ${usd(d.desiredFee)}, ${m} buyer match(es)`;
  }).join("\n");

  const crmOpen = contacts.filter((c) => !["closed", "dead"].includes(c.stage));
  const summary = `DEALS (${deals.length}):
${dealLines || "(none)"}

BUYERS: ${buyers.length} in network
OPEN CRM CONTACTS: ${crmOpen.length}
ACTIVE JVs: ${jvs.filter((j) => j.status !== "closed" && j.status !== "dead").length}`;

  const res = await complete([
    { role: "system", content: "You are SAHJONY, COO of SAHJONY CAPITAL LLC. Review the pipeline and produce a crisp, prioritized action plan: the top 3-5 next moves, each one line, most urgent first, referencing specific deals. Flag any deal that fails the 70% rule or has zero buyer matches. End with one sentence on the biggest opportunity. Be direct. Do not invent data." },
    { role: "user", content: summary },
  ]);

  return NextResponse.json({
    generatedAt: Date.now(),
    snapshot: { deals: deals.length, buyers: buyers.length, openContacts: crmOpen.length },
    briefing: res?.content ?? "Brain unreachable — try again.",
  }, { headers: { "Cache-Control": "no-store" } });
}
