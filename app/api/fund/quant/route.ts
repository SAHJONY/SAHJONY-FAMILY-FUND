import { NextRequest, NextResponse } from "next/server";
import { getDailyBars } from "@/lib/fund/market";
import { STRATEGIES } from "@/lib/fund/quant/strategies";
import { backtest, DEFAULT_BT_CONFIG } from "@/lib/fund/quant/backtest";
import { signalsForSymbol } from "@/lib/fund/quant/signals";
import { sizePosition } from "@/lib/fund/quant/sizing";
import { getAccount, valuePaper, placePaperOrder, resetAccount, liveEnabled } from "@/lib/fund/quant/paper";
import { currentUser } from "@/lib/fund/auth";
import { withUserKeys } from "@/lib/fund/ctx";
import { isPro } from "@/lib/fund/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const RANGE_FOR = (years: number) => `${Math.max(1, Math.min(10, years))}y`;

export async function GET(req: NextRequest) {
  const u = await currentUser(req);
  if (!u) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const account = await getAccount(u.id);
  return NextResponse.json({
    strategies: STRATEGIES.map((s) => ({ id: s.id, name: s.name, description: s.description, defaults: s.defaults })),
    paper: valuePaper(account, {}),
    live: liveEnabled(),
    plan: u.plan,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const u = await currentUser(req);
  if (!u) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const action = b.action as string;

  return withUserKeys(u.id, async () => {
    try {
      if (action === "backtest") {
        const symbol = String(b.symbol || "").toUpperCase();
        const years = isPro(u) ? Number(b.years) || 5 : Math.min(2, Number(b.years) || 2); // Free tier: ≤2y
        const bars = await getDailyBars(symbol, RANGE_FOR(years));
        if (!bars.length) return NextResponse.json({ error: `no price history for ${symbol} (feed unavailable)` }, { status: 422 });
        const result = backtest(b.strategyId || "ma_cross", symbol, bars, b.params || {}, { ...DEFAULT_BT_CONFIG, ...(b.config || {}) });
        if (!result) return NextResponse.json({ error: "backtest failed" }, { status: 422 });
        return NextResponse.json({ result });
      }

      if (action === "signals") {
        const symbol = String(b.symbol || "").toUpperCase();
        const bars = await getDailyBars(symbol, "2y");
        const sig = signalsForSymbol(symbol, bars, new Date().toISOString().slice(0, 10));
        if (!sig) return NextResponse.json({ error: `no signals for ${symbol} (feed unavailable)` }, { status: 422 });
        return NextResponse.json({ signals: sig });
      }

      if (action === "size") {
        const symbol = String(b.symbol || "").toUpperCase();
        const bars = await getDailyBars(symbol, RANGE_FOR(Number(b.years) || 5));
        if (!bars.length) return NextResponse.json({ error: `no price history for ${symbol}` }, { status: 422 });
        const result = backtest(b.strategyId || "ma_cross", symbol, bars, b.params || {}, DEFAULT_BT_CONFIG);
        if (!result) return NextResponse.json({ error: "could not size" }, { status: 422 });
        return NextResponse.json({ sizing: sizePosition(bars, result.strategy, Number(b.nav) || 1_000_000, Number(b.targetVol) || 0.15) });
      }

      if (action === "paper_order") {
        const symbol = String(b.symbol || "").toUpperCase();
        let price = Number(b.price);
        if (!price || price <= 0) {
          const bars = await getDailyBars(symbol, "1mo");
          price = bars.length ? bars[bars.length - 1].close : 0;
        }
        if (!price) return NextResponse.json({ error: "no price to fill against" }, { status: 422 });
        const r = await placePaperOrder(u.id, symbol, b.side === "sell" ? "sell" : "buy", Math.floor(Number(b.qty) || 0), price, b.note);
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
        const marks: Record<string, number> = {}; for (const l of r.account.lots) marks[l.symbol] = l.symbol === symbol ? price : l.avgCost;
        return NextResponse.json({ ok: true, paper: valuePaper(r.account, marks), filledAt: price });
      }

      if (action === "paper_reset") {
        return NextResponse.json({ ok: true, paper: valuePaper(await resetAccount(u.id, Number(b.startingCash) || 1_000_000), {}) });
      }

      return NextResponse.json({ error: "unknown action" }, { status: 400 });
    } catch (e) {
      return NextResponse.json({ error: `quant error: ${(e as Error).message}` }, { status: 500 });
    }
  });
}
