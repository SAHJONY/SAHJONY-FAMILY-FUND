// SAHJONY FAMILY FUND · QUANT ENGINE — paper trading.
//
// A fully-simulated brokerage: real bookkeeping (cash, positions, average cost,
// realized + unrealized P&L), zero real money. This is where strategies and
// signals get pressure-tested before any real capital is involved.
//
// LIVE EXECUTION IS DELIBERATELY NOT IMPLEMENTED HERE. Routing real orders would
// require the owner's own broker credentials and, per this project's policy,
// per-order human confirmation — it is never automated. `liveEnabled()` reports
// the gate so the UI can show it honestly; the seam is left for the owner to
// wire their own broker with their own authorization.

import { promises as fs } from "node:fs";
import path from "node:path";
import { dataPath } from "../../paths";

const PAPER = "fund-paper.json";

export interface PaperLot { symbol: string; qty: number; avgCost: number }
export interface PaperFill {
  ts: number; symbol: string; side: "buy" | "sell"; qty: number; price: number; note?: string;
}
export interface PaperAccount {
  cash: number;
  startingCash: number;
  lots: PaperLot[];
  fills: PaperFill[];
  realizedPnl: number;
}

const FRESH: PaperAccount = { cash: 1_000_000, startingCash: 1_000_000, lots: [], fills: [], realizedPnl: 0 };

export async function getAccount(): Promise<PaperAccount> {
  try { return JSON.parse(await fs.readFile(dataPath(PAPER), "utf8")) as PaperAccount; }
  catch { return { ...FRESH, lots: [], fills: [] }; }
}
async function save(a: PaperAccount) {
  await fs.mkdir(path.dirname(dataPath(PAPER)), { recursive: true });
  await fs.writeFile(dataPath(PAPER), JSON.stringify(a, null, 2), "utf8");
}

export async function resetAccount(startingCash = 1_000_000): Promise<PaperAccount> {
  const a: PaperAccount = { cash: startingCash, startingCash, lots: [], fills: [], realizedPnl: 0 };
  await save(a);
  return a;
}

// Simulated market order, filled at `price` (the caller passes the latest mark).
export async function placePaperOrder(
  symbol: string, side: "buy" | "sell", qty: number, price: number, note?: string
): Promise<{ ok: boolean; error?: string; account: PaperAccount }> {
  const a = await getAccount();
  if (qty <= 0 || price <= 0) return { ok: false, error: "qty and price must be positive", account: a };

  const lot = a.lots.find((l) => l.symbol === symbol);
  if (side === "buy") {
    const cost = qty * price;
    if (cost > a.cash) return { ok: false, error: "insufficient paper cash", account: a };
    a.cash -= cost;
    if (lot) { lot.avgCost = (lot.avgCost * lot.qty + cost) / (lot.qty + qty); lot.qty += qty; }
    else a.lots.push({ symbol, qty, avgCost: price });
  } else {
    if (!lot || lot.qty < qty) return { ok: false, error: "not enough shares to sell", account: a };
    a.cash += qty * price;
    a.realizedPnl += (price - lot.avgCost) * qty;
    lot.qty -= qty;
    if (lot.qty === 0) a.lots = a.lots.filter((l) => l.symbol !== symbol);
  }
  a.fills.unshift({ ts: Date.now(), symbol, side, qty, price, note });
  a.fills = a.fills.slice(0, 200);
  await save(a);
  return { ok: true, account: a };
}

export interface PaperValuation {
  cash: number;
  positionsValue: number;
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalReturnPct: number;
  positions: (PaperLot & { mark: number; value: number; unrealized: number })[];
}

// Value the paper book against a map of latest marks.
export function valuePaper(a: PaperAccount, marks: Record<string, number>): PaperValuation {
  let positionsValue = 0, unrealized = 0;
  const positions = a.lots.map((l) => {
    const mark = marks[l.symbol] ?? l.avgCost;
    const value = mark * l.qty;
    const u = (mark - l.avgCost) * l.qty;
    positionsValue += value; unrealized += u;
    return { ...l, mark, value: Math.round(value), unrealized: Math.round(u) };
  });
  const equity = a.cash + positionsValue;
  return {
    cash: Math.round(a.cash),
    positionsValue: Math.round(positionsValue),
    equity: Math.round(equity),
    realizedPnl: Math.round(a.realizedPnl),
    unrealizedPnl: Math.round(unrealized),
    totalReturnPct: a.startingCash > 0 ? Math.round((equity / a.startingCash - 1) * 1000) / 10 : 0,
    positions,
  };
}

// Honest report of the live-execution gate (always off until the owner wires a
// broker with their own credentials and explicit per-order confirmation).
export function liveEnabled(): { enabled: boolean; reason: string } {
  return {
    enabled: false,
    reason:
      "Live order routing is not enabled. By design, real trades require your own broker credentials and per-order confirmation — the system never auto-executes with real money. Paper trading is fully active.",
  };
}
