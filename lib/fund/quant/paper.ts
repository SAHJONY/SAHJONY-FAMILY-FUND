// SAHJONY CAPITAL LLC — per-user paper trading (KV-backed).
//
// A fully-simulated brokerage with real bookkeeping (cash, lots, avg cost,
// realized + unrealized P&L), isolated per user. Zero real money. Live order
// routing is deliberately not implemented — real trades require the user's own
// broker credentials and per-order confirmation, never automated.

import { kv } from "../kv";

const pKey = (u: string) => `u:${u}:paper`;

export interface PaperLot { symbol: string; qty: number; avgCost: number }
export interface PaperFill { ts: number; symbol: string; side: "buy" | "sell"; qty: number; price: number; note?: string }
export interface PaperAccount {
  cash: number; startingCash: number; lots: PaperLot[]; fills: PaperFill[]; realizedPnl: number;
}

function fresh(startingCash = 1_000_000): PaperAccount {
  return { cash: startingCash, startingCash, lots: [], fills: [], realizedPnl: 0 };
}

export async function getAccount(userId: string): Promise<PaperAccount> {
  return (await kv().get<PaperAccount>(pKey(userId))) ?? fresh();
}
async function save(userId: string, a: PaperAccount) { await kv().set(pKey(userId), a); }

export async function resetAccount(userId: string, startingCash = 1_000_000): Promise<PaperAccount> {
  const a = fresh(startingCash);
  await save(userId, a);
  return a;
}

export async function placePaperOrder(
  userId: string, symbol: string, side: "buy" | "sell", qty: number, price: number, note?: string
): Promise<{ ok: boolean; error?: string; account: PaperAccount }> {
  const a = await getAccount(userId);
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
  await save(userId, a);
  return { ok: true, account: a };
}

export interface PaperValuation {
  cash: number; positionsValue: number; equity: number; realizedPnl: number;
  unrealizedPnl: number; totalReturnPct: number;
  positions: (PaperLot & { mark: number; value: number; unrealized: number })[];
}

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
    cash: Math.round(a.cash), positionsValue: Math.round(positionsValue), equity: Math.round(equity),
    realizedPnl: Math.round(a.realizedPnl), unrealizedPnl: Math.round(unrealized),
    totalReturnPct: a.startingCash > 0 ? Math.round((equity / a.startingCash - 1) * 1000) / 10 : 0,
    positions,
  };
}

export function liveEnabled(): { enabled: boolean; reason: string } {
  return {
    enabled: false,
    reason: "Live order routing is not enabled. Real trades require your own broker credentials and per-order confirmation — the system never auto-executes with real money. Paper trading is fully active.",
  };
}
