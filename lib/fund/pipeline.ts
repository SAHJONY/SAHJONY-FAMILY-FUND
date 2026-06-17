// SAHJONY FAMILY FUND — the daily pipeline. Ties Layers 1-4 together:
// pull → value → snapshot/diff → analytics → macro → Claude news → alerts →
// notify → store. One screen, every morning. It reports conditions and tracks
// the owner's own targets; nothing here recommends a trade or routes an order.

import type { FundReport, Position } from "./types";
import { DEFAULT_CONFIG, FundConfig } from "./config";
import {
  listPositions, writeState, saveSnapshot, loadPriorSnapshot, ivHistory,
  type ChainSnapshot,
} from "./store";
import { getQuote, getOptionChain, type OptionChain, type Quote } from "./market";
import { valueBook, type MarketBook } from "./valuation";
import { analyze } from "./analytics";
import { computeMacroGate } from "./macro";
import { newsForTicker } from "./news";
import { diffChain, buildAlerts, type DiffResult } from "./alerts";
import { maybeSend } from "./notify";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface RunOptions {
  userId: string;         // whose book to run (per-user isolation)
  asof?: string;          // stamp the run date for storage/diffing
  skipNews?: boolean;     // skip the one paid layer (e.g. cheap intraday refresh)
  config?: Partial<FundConfig>;
}

export async function runPipeline(opts: RunOptions): Promise<FundReport> {
  const userId = opts.userId;
  const cfg: FundConfig = { ...DEFAULT_CONFIG, ...(opts.config ?? {}) };
  const asof = opts.asof ?? today();
  const errors: string[] = [];
  const positions = await listPositions(userId);

  // Which underlyings need a feed (skip cash / unlisted alts).
  const fedTickers = [...new Set(
    positions
      .filter((p) => ["option", "shares", "bond"].includes(p.asset_type) && p.ticker && p.ticker !== "—")
      .map((p) => p.ticker)
  )];

  // Held option expiries per ticker (so we only pull the chains we need).
  const expiriesByTicker: Record<string, Set<string>> = {};
  for (const p of positions)
    if (p.asset_type === "option" && p.ticker && p.expiry) {
      (expiriesByTicker[p.ticker] ??= new Set()).add(p.expiry);
    }

  // ---- Layer 1: gather market data -----------------------------------------
  const book: MarketBook = {};
  const snapshots: ChainSnapshot[] = [];
  const priorByTicker: Record<string, ChainSnapshot | null> = {};

  for (const ticker of fedTickers) {
    let quote: Quote | null = null;
    try { quote = await getQuote(ticker); } catch { /* tagged below */ }
    if (!quote) errors.push(`quote unavailable: ${ticker}`);

    const chains: Record<string, OptionChain> = {};
    const expiries = [...(expiriesByTicker[ticker] ?? [])];
    for (const exp of expiries) {
      try {
        const ch = await getOptionChain(ticker, exp);
        if (ch) chains[exp] = ch;
        else errors.push(`chain unavailable: ${ticker} ${exp}`);
      } catch { errors.push(`chain error: ${ticker} ${exp}`); }
    }
    book[ticker] = { quote, chains };

    // Snapshot today's chains for diffing + IV history.
    if (expiries.length) {
      const snap: ChainSnapshot = {
        ticker, asof, spot: quote?.price ?? null,
        expiries: Object.values(chains)[0]?.expiries ?? expiries,
        chains: Object.fromEntries(
          Object.entries(chains).map(([e, ch]) => [
            e, ch.rows.map((r) => ({ strike: r.strike, type: r.type, iv: r.iv, bid: r.bid, ask: r.ask, last: r.last, volume: r.volume, oi: r.oi })),
          ])
        ),
      };
      snapshots.push(snap);
      await saveSnapshot(userId, snap);
      priorByTicker[ticker] = await loadPriorSnapshot(userId, ticker, asof);
    }
  }

  // ---- Layer 1: value the book ---------------------------------------------
  const valued = valueBook(positions, book, cfg, asof);

  // ---- Layer 2: analytics (with IV history from stored snapshots) ----------
  const ivHistByTicker: Record<string, number[]> = {};
  for (const ticker of fedTickers) ivHistByTicker[ticker] = await ivHistory(userId, ticker, cfg.ivLookbackDays);
  const analytics = analyze(valued, cfg, ivHistByTicker);

  // ---- Layer 3a: deterministic macro gate ----------------------------------
  let macro;
  try { macro = await computeMacroGate(cfg, asof); }
  catch { macro = { score: 0, components: [], asof, available: false }; errors.push("macro gate unavailable"); }

  // ---- Layer 3b: Claude news (the one paid piece), cached per day ----------
  const news = [];
  if (!opts.skipNews) {
    const heldTickers = new Set(positions.map((p) => p.ticker));
    for (const ticker of fedTickers) {
      try { news.push(await newsForTicker(userId, ticker, heldTickers.has(ticker), cfg, asof)); }
      catch { errors.push(`news unavailable: ${ticker}`); }
    }
  }

  // ---- Layer 4: diffs + alerts ---------------------------------------------
  const diffs: DiffResult = { newStrikes: [], newExpiries: [] };
  for (const snap of snapshots) {
    const held = positions
      .filter((p) => p.asset_type === "option" && p.ticker === snap.ticker && p.strike)
      .map((p) => p.strike!);
    const d = diffChain(snap.ticker, snap, priorByTicker[snap.ticker] ?? null, held, cfg);
    diffs.newStrikes.push(...d.newStrikes);
    diffs.newExpiries.push(...d.newExpiries);
  }
  const alerts = buildAlerts(valued, analytics, news, diffs, priorByTicker, cfg);

  const report: FundReport = {
    asof, generatedAt: Date.now(),
    positions: valued, analytics, macro, news, alerts,
    newStrikes: diffs.newStrikes, newExpiries: diffs.newExpiries, errors,
  };

  await writeState(userId, report);
  await maybeSend(alerts, asof);
  return report;
}
