import { NextResponse } from "next/server";
import { listDeals, listBuyers } from "@/lib/wholesale";
import { listContacts, listJV } from "@/lib/crm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One-click backup of the whole business: real data, exportable so it's never
// locked in or lost.
export async function GET() {
  const [deals, buyers, contacts, jvs] = await Promise.all([
    listDeals(), listBuyers(), listContacts(), listJV(),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    business: "SAHJONY CAPITAL LLC",
    deals, buyers, contacts, jointVentures: jvs,
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="sahjony-capital-backup-${Date.now()}.json"`,
    },
  });
}
