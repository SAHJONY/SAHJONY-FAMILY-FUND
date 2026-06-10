// Real deal-math helpers. Every output is computed from numbers the owner
// enters (real comps, real repair scope) — nothing is estimated by a model and
// passed off as fact.

export interface Comp { address: string; sqft: number; salePrice: number }

export interface ArvResult {
  perSqft: number;
  subjectSqft: number;
  arv: number;
  compsUsed: number;
}

// ARV from real comparable sales: average $/sqft of the comps × subject sqft.
export function arvFromComps(comps: Comp[], subjectSqft: number): ArvResult {
  const valid = comps.filter((c) => c.sqft > 0 && c.salePrice > 0);
  if (!valid.length || subjectSqft <= 0) {
    return { perSqft: 0, subjectSqft, arv: 0, compsUsed: 0 };
  }
  const perSqftAvg = valid.reduce((s, c) => s + c.salePrice / c.sqft, 0) / valid.length;
  return {
    perSqft: Math.round(perSqftAvg),
    subjectSqft,
    arv: Math.round(perSqftAvg * subjectSqft),
    compsUsed: valid.length,
  };
}

export interface RepairLine { label: string; amount: number }

// Repair total from the owner's line-item scope.
export function repairTotal(lines: RepairLine[], contingencyPct = 10): { subtotal: number; contingency: number; total: number } {
  const subtotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const contingency = Math.round(subtotal * (contingencyPct / 100));
  return { subtotal, contingency, total: subtotal + contingency };
}

// Default rehab categories so the worksheet starts useful (amounts are the
// owner's to set — zeros until entered).
export const REPAIR_CATEGORIES = [
  "Roof", "HVAC", "Plumbing", "Electrical", "Kitchen", "Bathrooms",
  "Flooring", "Paint (int/ext)", "Windows", "Foundation", "Landscaping",
  "Permits/misc",
];
