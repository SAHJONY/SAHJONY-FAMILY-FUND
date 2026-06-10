import { NextResponse } from "next/server";
import { listDeals, listBuyers, analyzeDeal } from "@/lib/wholesale";
import { listJV } from "@/lib/crm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Real pipeline KPIs computed from the owner's own deals/buyers/JV. No estimates.
export async function GET() {
  const deals = await listDeals();
  const buyers = await listBuyers();
  const jvs = await listJV();

  const byStatus: Record<string, number> = {};
  for (const d of deals) byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;

  const inFlight = deals.filter((d) => d.status === "under_contract" || d.status === "assigned");
  const projectedFees = inFlight.reduce((s, d) => s + (d.desiredFee || 0), 0);
  const closedFees = deals.filter((d) => d.status === "closed").reduce((s, d) => s + (d.desiredFee || 0), 0);
  const jvCut = jvs.reduce((s, j) => s + Math.round((j.totalFee || 0) * (j.splitPct || 0) / 100), 0);

  const graded = deals.map((d) => analyzeDeal(d).grade);
  const gradeCounts: Record<string, number> = {};
  for (const g of graded) gradeCounts[g] = (gradeCounts[g] ?? 0) + 1;

  const closed = byStatus["closed"] ?? 0;
  const conversion = deals.length ? Math.round((closed / deals.length) * 100) : 0;

  return NextResponse.json(
    {
      totals: { deals: deals.length, buyers: buyers.length, jvs: jvs.length },
      byStatus,
      gradeCounts,
      projectedFees,
      closedFees,
      jvCut,
      conversionPct: conversion,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
