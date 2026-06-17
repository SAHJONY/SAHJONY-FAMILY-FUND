// SAHJONY FAMILY FUND — Layer 3a: the macro gate.
//
// A deterministic 0-100 read of the general environment the book sits in. Same
// data in, same score out — no model, no randomness. It blends four signals
// with configurable weights that sum to 1.0:
//   • VIX level (and its 1y percentile)   — fear
//   • VIX term structure (VIX vs VIX3M)   — stress / backwardation
//   • breadth (% of an index basket above its 200-day MA)  — participation
//   • credit (HYG vs TLT 1-month relative) — risk appetite
//
// Higher score = more constructive environment. It is context, not a signal to
// trade. Each component degrades gracefully to null if its feed is unavailable;
// the blend renormalizes over whatever is present and reports availability.

import type { MacroGate, MacroComponent } from "./types";
import { FundConfig } from "./config";
import { getQuote, getHistory } from "./market";

function pctRank(history: number[], current: number): number {
  if (history.length < 2) return 50;
  const below = history.filter((h) => h <= current).length;
  return (below / history.length) * 100;
}

// A representative breadth basket (mega-caps + index ETFs). % above 200-day MA.
const BREADTH_BASKET = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "JPM", "XOM", "UNH", "SPY"];

export async function computeMacroGate(cfg: FundConfig, asof: string): Promise<MacroGate> {
  const w = cfg.macroWeights;
  const components: MacroComponent[] = [];

  // --- VIX level: low VIX is constructive. Map via 1y percentile (inverted).
  const vix = await getQuote("^VIX");
  const vixHist = await getHistory("^VIX", "1y");
  let vixScore: number | null = null;
  if (vix && vixHist.length > 1) {
    const rank = pctRank(vixHist, vix.price); // high rank = high fear
    vixScore = 100 - rank;                      // invert: calm = high score
  }
  components.push({
    name: "VIX level", raw: vix?.price ?? null, score: vixScore ?? 0, weight: w.vixLevel,
    note: vix ? `VIX ${vix.price.toFixed(1)}, ${vixScore!.toFixed(0)}/100 (calm=high)` : "VIX feed unavailable",
  });

  // --- VIX term structure: contango (VIX3M > VIX) is normal/constructive.
  const vix3m = await getQuote("^VIX3M");
  let termScore: number | null = null;
  if (vix && vix3m) {
    const spread = vix3m.price - vix.price; // positive = contango = calm
    // map spread roughly [-10..+10] -> [0..100]
    termScore = Math.max(0, Math.min(100, (spread + 10) * 5));
  }
  components.push({
    name: "VIX term structure", raw: vix && vix3m ? Math.round((vix3m.price - vix.price) * 100) / 100 : null,
    score: termScore ?? 0, weight: w.vixTerm,
    note: vix && vix3m ? `VIX3M-VIX ${(vix3m.price - vix.price).toFixed(2)} (contango=constructive)` : "term feed unavailable",
  });

  // --- Breadth: % of basket above its own 200-day MA.
  let above = 0, counted = 0;
  for (const sym of BREADTH_BASKET) {
    const h = await getHistory(sym, "1y");
    if (h.length < 200) continue;
    const ma200 = h.slice(-200).reduce((a, b) => a + b, 0) / 200;
    counted++;
    if (h[h.length - 1] > ma200) above++;
  }
  const breadthScore = counted > 0 ? (above / counted) * 100 : null;
  components.push({
    name: "Breadth (>200d MA)", raw: counted > 0 ? Math.round((above / counted) * 100) : null,
    score: breadthScore ?? 0, weight: w.breadth,
    note: counted > 0 ? `${above}/${counted} of basket above 200-day MA` : "breadth feed unavailable",
  });

  // --- Credit: HYG vs TLT 1-month relative performance (risk appetite).
  const hyg = await getHistory("HYG", "3mo");
  const tlt = await getHistory("TLT", "3mo");
  let creditScore: number | null = null;
  let creditRaw: number | null = null;
  if (hyg.length > 21 && tlt.length > 21) {
    const hygRet = (hyg[hyg.length - 1] - hyg[hyg.length - 22]) / hyg[hyg.length - 22];
    const tltRet = (tlt[tlt.length - 1] - tlt[tlt.length - 22]) / tlt[tlt.length - 22];
    const rel = (hygRet - tltRet) * 100; // HYG outperforming = risk-on
    creditRaw = Math.round(rel * 100) / 100;
    creditScore = Math.max(0, Math.min(100, 50 + rel * 10));
  }
  components.push({
    name: "Credit (HYG vs TLT)", raw: creditRaw, score: creditScore ?? 0, weight: w.credit,
    note: creditScore != null ? `HYG-TLT 1m rel ${creditRaw}% (HYG lead=risk-on)` : "credit feed unavailable",
  });

  // Blend, renormalizing weights over available components only.
  const present = components.filter((c) => c.raw != null);
  const wsum = present.reduce((s, c) => s + c.weight, 0);
  const score = wsum > 0
    ? Math.round(present.reduce((s, c) => s + c.score * (c.weight / wsum), 0))
    : 0;

  return { score, components, asof, available: present.length > 0 };
}
