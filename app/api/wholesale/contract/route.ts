import { NextRequest, NextResponse } from "next/server";
import { listDeals, analyzeDeal } from "@/lib/wholesale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Generates a DRAFT Assignment of Real Estate Purchase & Sale Contract from a
// deal, as a printable HTML document. This is a template to be reviewed by a
// licensed attorney and adapted to the deal's jurisdiction — wholesaling and
// assignment rules are state-specific. It is not legal advice.

const esc = (s: string) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
const usd = (n: number) => "$" + (n || 0).toLocaleString();

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const deal = (await listDeals()).find((d) => d.id === body.dealId);
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  const assignor = esc(body.assignor || "SAHJONY CAPITAL LLC");
  const assignee = esc(body.assignee || "________________________ (Assignee)");
  const fee = deal.desiredFee || 0;
  const today = new Date().toLocaleDateString();

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Assignment of Contract — ${esc(deal.address)}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;max-width:760px;margin:40px auto;padding:0 24px;color:#111;line-height:1.6}
  h1{font-size:20px;text-align:center;text-transform:uppercase;letter-spacing:1px}
  .banner{background:#fff3cd;border:1px solid #d8a300;padding:10px 14px;font-size:13px;margin:18px 0}
  .row{margin:10px 0}.sig{margin-top:48px;display:flex;justify-content:space-between;gap:40px}
  .line{border-top:1px solid #333;width:280px;padding-top:4px;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:14px 0}td{border:1px solid #ccc;padding:6px 10px;font-size:14px}
  @media print{.banner{-webkit-print-color-adjust:exact}}
</style></head><body>
<h1>Assignment of Real Estate Purchase &amp; Sale Contract</h1>
<div class="banner"><strong>DRAFT — NOT LEGAL ADVICE.</strong> This is a template. Have a licensed attorney in the property's state review and adapt it before use. Assignment and wholesaling rules vary by jurisdiction.</div>

<div class="row">This Assignment Agreement ("Assignment") is made on <strong>${today}</strong> by and between
<strong>${assignor}</strong> ("Assignor") and <strong>${assignee}</strong> ("Assignee").</div>

<table>
  <tr><td>Subject Property</td><td>${esc(deal.address)}, ${esc(deal.city)} ${esc(deal.state)}</td></tr>
  <tr><td>Property Type</td><td>${esc(deal.propertyType)} — ${deal.beds} bed / ${deal.baths} bath / ${deal.sqft || "—"} sqft</td></tr>
  <tr><td>Original Contract Price</td><td>${usd(deal.contractPrice)}</td></tr>
  <tr><td>Assignment Fee</td><td>${usd(fee)}</td></tr>
</table>

<div class="row"><strong>1. Assignment.</strong> Assignor hereby assigns and transfers to Assignee all of Assignor's rights, title, and interest in that certain Real Estate Purchase &amp; Sale Contract dated ____________ for the Subject Property (the "Purchase Contract").</div>
<div class="row"><strong>2. Assignment Fee.</strong> In consideration of this Assignment, Assignee shall pay Assignor a non-refundable assignment fee of <strong>${usd(fee)}</strong>, due at or before closing of the Purchase Contract.</div>
<div class="row"><strong>3. Assumption.</strong> Assignee assumes all obligations of the buyer under the Purchase Contract and agrees to perform and close in accordance with its terms.</div>
<div class="row"><strong>4. Representations.</strong> Assignor represents the Purchase Contract is valid and in full force, and Assignor has not previously assigned it.</div>
<div class="row"><strong>5. Closing.</strong> This Assignment shall be delivered to the closing agent / title company handling the Purchase Contract.</div>
<div class="row"><strong>6. Governing Law.</strong> This Assignment is governed by the laws of the State of ${esc(deal.state) || "____"}.</div>

<div class="sig">
  <div class="line">Assignor: ${assignor}<br>Date: ____________</div>
  <div class="line">Assignee: ${assignee}<br>Date: ____________</div>
</div>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="assignment-${deal.id}.html"`,
    },
  });
}
