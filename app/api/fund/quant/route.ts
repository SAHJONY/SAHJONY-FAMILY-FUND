import { NextRequest, NextResponse } from "next/server";
import { getDailyBars } from "@/lib/fund/market";
import { STRATEGIES, getStrategy } from "@/lib/fund/quant/strategies";
import { backtest, DEFAULT_BT_CONFIG } from "@/lib/fund/quant/backtest";
import { signalsForSymbol } from "@/lib/fund/quant/signals";
import { sizePosition } from "@/lib/fund/quant/sizing";
import {
  getAccount, valuePaper, placePaperOrder, resetAccount, liveEnabled,
} from "@/lib/fund/quant/paper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const RANGE_FOR = (years: number) => `${Math.max(1, Math.min(10, years))}y`;

// GET — list available strategies + the paper account + the live-execution gate.
export async function GET() {
  const account = await getAccount();
  return NextResponse.json({
    strategies: STRATEGIES.map((s) => ({ id: s.id, name: s.name, description: s.description, defaults: s.defaults })),
    paper: valuePaper(account, {}),
    live: liveEnabled(),
  }, { headers: { "Cache-Control": "no-store" } });
}

// POST — actions: backtest | signals | size | paper_order | paper_reset
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const action = b.action as string;

  try {
    if (action === "backtest") {
      const symbol = String(b.symbol || "").toUpperCase();
      const years = Number(b.years) || 5;
      const bars = await getDailyBars(symbol, RANGE_FOR(years));
      if (!bars.length) return NextResponse.json({ error: `no price history for ${symbol} (feed unavailable)` }, { status: 422 });
      const result = backtest(b.strategyId || "ma_cross", symbol, bars, b.params || {}, { ...DEFAULT_BT_CONFIG, ...(b.config || {}) });
      if (!result) return NextResponse.json({ error: "backtest failed (unknown strategy or insufficient data)" }, { status: 422 });
      return NextResponse.json({ result });
    }

    if (action === "signals") {
      const symbol = String(b.symbol || "").toUpperCase();
      const bars = await getDailyBars(symbol, "2y");
      const asof = new Date().toISOString().slice(0, 10);
      const sig = signalsForSymbol(symbol, bars, asof);
      if (!sig) return NextResponse.json({ error: `no signals for ${symbol} (feed unavailable)` }, { status: 422 });
      return NextResponse.json({ signals: sig });
    }

    if (action === "size") {
      const symbol = String(b.symbol || "").toUpperCase();
      const bars = await getDailyBars(symbol, RANGE_FOR(Number(b.years) || 5));
      if (!bars.length) return NextResponse.json({ error: `no price history for ${symbol}` }, { status: 422 });
      const strat = getStrategy(b.strategyId || "ma_cross");
      const result = backtest(b.strategyId || "ma_cross", symbol, bars, b.params || {}, DEFAULT_BT_CONFIG);
      if (!result || !strat) return NextResponse.json({ error: "could not size (no backtest)" }, { status: 422 });
      const sizing = sizePosition(bars, result.strategy, Number(b.nav) || 1_000_000, Number(b.targetVol) || 0.15);
      return NextResponse.json({ sizing });
    }

    if (action === "paper_order") {
      const symbol = String(b.symbol || "").toUpperCase();
      let price = Number(b.price);
      if (!price || price <= 0) {
        const bars = await getDailyBars(symbol, "1mo");
        price = bars.length ? bars[bars.length - 1].close : 0;
      }
      if (!price) return NextResponse.json({ error: "no price to fill against" }, { status: 422 });
      const r = await placePaperOrder(symbol, b.side === "sell" ? "sell" : "buy", Math.floor(Number(b.qty) || 0), price, b.note);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
      // value against the fill marks we just used
      const marks: Record<string, number> = {}; for (const l of r.account.lots) marks[l.symbol] = price === 0 ? l.avgCost : (l.symbol === symbol ? price : l.avgCost);
      return NextResponse.json({ ok: true, paper: valuePaper(r.account, marks), filledAt: price });
    }

    if (action === "paper_reset") {
      const account = await resetAccount(Number(b.startingCash) || 1_000_000);
      return NextResponse.json({ ok: true, paper: valuePaper(account, {}) });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: `quant error: ${(e as Error).message}` }, { status: 500 });
  }
}
