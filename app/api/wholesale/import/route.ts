import { NextRequest, NextResponse } from "next/server";
import { upsertBuyer, type BuyerType, type Strategy } from "@/lib/wholesale";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Import cash buyers from a CSV you exported from a service you license
// (PropStream, list providers, your own CRM). This imports YOUR data — it does
// not fetch or harvest anyone. Header row required. Recognized columns:
//   name,type,contact,markets,propertyTypes,minPrice,maxPrice,minBeds,maxRepairs,strategy,proofOfFunds
// markets/propertyTypes use ';' as the inner separator (e.g. "Austin TX;Dallas TX").

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const split = (line: string): string[] => {
    const out: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === "," && !q) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

const TYPES: BuyerType[] = ["individual", "hedge_fund", "institutional", "private_equity", "ibuyer"];
const STRATS: Strategy[] = ["flip", "buy_hold", "brrrr", "new_build", "any"];
const num = (s?: string) => Number((s ?? "").replace(/[^0-9.-]/g, "")) || 0;
const multi = (s?: string) => (s ?? "").split(/[;|]/).map((x) => x.trim()).filter(Boolean);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const csv = String(body.csv ?? "");
  const rows = parseCsv(csv);
  if (!rows.length) return NextResponse.json({ error: "No data rows found. Include a header row." }, { status: 400 });

  let imported = 0;
  const errors: string[] = [];
  for (const r of rows) {
    if (!r.name) { errors.push("row missing name"); continue; }
    const type = (TYPES.includes(r.type as BuyerType) ? r.type : "individual") as BuyerType;
    const strategy = (STRATS.includes(r.strategy as Strategy) ? r.strategy : "any") as Strategy;
    await upsertBuyer({
      name: r.name,
      type,
      contact: r.contact || "",
      proofOfFunds: /^(y|yes|true|1)$/i.test(r.proofoffunds || ""),
      active: true,
      box: {
        markets: multi(r.markets),
        propertyTypes: multi(r.propertytypes),
        minPrice: num(r.minprice),
        maxPrice: num(r.maxprice),
        minBeds: num(r.minbeds),
        maxRepairs: num(r.maxrepairs),
        strategy,
      },
    });
    imported++;
  }
  return NextResponse.json({ ok: true, imported, errors: errors.slice(0, 10) });
}
