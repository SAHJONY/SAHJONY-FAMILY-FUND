// SAHJONY CAPITAL LLC — market data layer.
//
// PRIMARY: Yahoo Finance public endpoints (no key, real quotes/chains/history/
// news). FALLBACK: Alpaca market-data (only when an Alpaca key is present and
// Yahoo returns nothing) — useful on hosts whose datacenter IPs Yahoo rate-
// limits. Every fetch is defensive: on failure we return null / empty and the
// caller tags the mark "unavailable" rather than fabricating a number.

import { key } from "./ctx";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function getJson<T>(url: string, timeoutMs = 8000, headers?: Record<string, string>): Promise<T | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: headers ?? { "User-Agent": UA, Accept: "application/json" },
      signal: c.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export interface Quote { price: number; prevClose: number | null; currency: string; source: "live" }
export interface ChainRow {
  strike: number; type: "call" | "put";
  bid: number | null; ask: number | null; last: number | null;
  iv: number; volume: number | null; oi: number | null;
}
export interface OptionChain {
  spot: number | null;
  expiries: string[];               // all listed expiries, YYYY-MM-DD
  expiry: string | null;            // the expiry these rows belong to
  rows: ChainRow[];
}
export interface Bar { date: string; open: number; high: number; low: number; close: number; volume: number }
export interface Headline { title: string; publisher: string; link: string; ts: number }

const QHOST = "https://query1.finance.yahoo.com";
const ALPACA = "https://data.alpaca.markets";

// Alpaca is the FALLBACK provider — inert unless the owner has added a key.
function alpacaHeaders(): Record<string, string> | null {
  const id = key("ALPACA_API_KEY_ID");
  const sec = key("ALPACA_API_SECRET_KEY");
  if (!id || !sec) return null;
  return { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": sec, Accept: "application/json" };
}
function rangeYears(range: string): number {
  const m = /^(\d+(?:\.\d+)?)(d|mo|y)$/.exec(range);
  if (!m) return 1;
  const n = parseFloat(m[1]);
  return m[2] === "y" ? n : m[2] === "mo" ? n / 12 : n / 365;
}

// ---------- Yahoo (primary) -------------------------------------------------
async function yahooQuote(symbol: string): Promise<Quote | null> {
  const j = await getJson<any>(`${QHOST}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`);
  const meta = j?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;
  return {
    price: meta.regularMarketPrice,
    prevClose: typeof meta.chartPreviousClose === "number" ? meta.chartPreviousClose : null,
    currency: meta.currency || "USD",
    source: "live",
  };
}
async function yahooBars(symbol: string, range: string): Promise<Bar[]> {
  const j = await getJson<any>(`${QHOST}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`);
  const r = j?.chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0];
  if (!ts.length || !q) return [];
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i];
    if ([o, h, l, c].some((x) => typeof x !== "number")) continue;
    bars.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), open: o, high: h, low: l, close: c, volume: v ?? 0 });
  }
  return bars;
}
async function yahooNews(symbol: string, count: number): Promise<Headline[]> {
  const j = await getJson<any>(`${QHOST}/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=${count}&quotesCount=0`);
  const news: any[] = j?.news ?? [];
  return news.map((n) => ({
    title: n.title ?? "", publisher: n.publisher ?? "", link: n.link ?? "",
    ts: typeof n.providerPublishTime === "number" ? n.providerPublishTime : 0,
  }));
}

// ---------- Alpaca (key-gated fallback) -------------------------------------
async function alpacaBars(symbol: string, years: number): Promise<Bar[]> {
  const h = alpacaHeaders();
  if (!h || symbol.startsWith("^")) return []; // Alpaca has no index (^VIX) data
  const start = new Date(Date.now() - Math.max(0.1, years) * 365 * 864e5).toISOString().slice(0, 10);
  const j = await getJson<any>(`${ALPACA}/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=1Day&start=${start}&limit=10000&adjustment=split&feed=iex`, 12000, h);
  const bars: any[] = j?.bars ?? [];
  return bars
    .filter((b) => [b.o, b.h, b.l, b.c].every((x) => typeof x === "number"))
    .map((b) => ({ date: String(b.t).slice(0, 10), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v ?? 0 }));
}
async function alpacaQuote(symbol: string): Promise<Quote | null> {
  const h = alpacaHeaders();
  if (!h || symbol.startsWith("^")) return null;
  const j = await getJson<any>(`${ALPACA}/v2/stocks/${encodeURIComponent(symbol)}/snapshot?feed=iex`, 8000, h);
  const price = typeof j?.latestTrade?.p === "number" ? j.latestTrade.p : (typeof j?.dailyBar?.c === "number" ? j.dailyBar.c : null);
  if (price == null) return null;
  return { price, prevClose: typeof j?.prevDailyBar?.c === "number" ? j.prevDailyBar.c : null, currency: "USD", source: "live" };
}
async function alpacaNews(symbol: string, count: number): Promise<Headline[]> {
  const h = alpacaHeaders();
  if (!h) return [];
  const j = await getJson<any>(`${ALPACA}/v1beta1/news?symbols=${encodeURIComponent(symbol)}&limit=${count}`, 8000, h);
  const news: any[] = j?.news ?? [];
  return news.map((n) => ({
    title: n.headline ?? "", publisher: n.source ?? "", link: n.url ?? "",
    ts: n.created_at ? Math.floor(new Date(n.created_at).getTime() / 1000) : 0,
  }));
}

// ---------- Public API (Yahoo first, Alpaca fallback) -----------------------
export async function getQuote(symbol: string): Promise<Quote | null> {
  return (await yahooQuote(symbol)) ?? (await alpacaQuote(symbol));
}

export async function getDailyBars(symbol: string, range = "5y"): Promise<Bar[]> {
  const y = await yahooBars(symbol, range);
  if (y.length) return y;
  return alpacaBars(symbol, rangeYears(range));
}

// Daily close history (200-day MA / breadth / IV-rank helpers).
export async function getHistory(symbol: string, range = "1y"): Promise<number[]> {
  const bars = await getDailyBars(symbol, range);
  return bars.map((b) => b.close);
}

export async function getNews(symbol: string, count = 10): Promise<Headline[]> {
  const y = await yahooNews(symbol, count);
  if (y.length) return y;
  return alpacaNews(symbol, count);
}

function epochToYmd(sec: number): string {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}
function ymdToEpoch(ymd: string): number {
  return Math.floor(new Date(`${ymd}T00:00:00Z`).getTime() / 1000);
}

// Option chains: Yahoo only (Alpaca options data needs a separate subscription).
// If unavailable from a datacenter IP the monitor degrades to manual marks.
export async function getOptionChain(symbol: string, expiry?: string): Promise<OptionChain | null> {
  const url = expiry
    ? `${QHOST}/v7/finance/options/${encodeURIComponent(symbol)}?date=${ymdToEpoch(expiry)}`
    : `${QHOST}/v7/finance/options/${encodeURIComponent(symbol)}`;
  const j = await getJson<any>(url);
  const r = j?.optionChain?.result?.[0];
  if (!r) return null;
  const expiries: string[] = (r.expirationDates ?? []).map((e: number) => epochToYmd(e));
  const opt = r.options?.[0];
  const rows: ChainRow[] = [];
  const push = (arr: any[], type: "call" | "put") => {
    for (const o of arr ?? []) {
      rows.push({
        strike: o.strike, type,
        bid: typeof o.bid === "number" ? o.bid : null,
        ask: typeof o.ask === "number" ? o.ask : null,
        last: typeof o.lastPrice === "number" ? o.lastPrice : null,
        iv: typeof o.impliedVolatility === "number" ? o.impliedVolatility : 0,
        volume: typeof o.volume === "number" ? o.volume : null,
        oi: typeof o.openInterest === "number" ? o.openInterest : null,
      });
    }
  };
  if (opt) { push(opt.calls, "call"); push(opt.puts, "put"); }
  return {
    spot: typeof r.quote?.regularMarketPrice === "number" ? r.quote.regularMarketPrice : null,
    expiries,
    expiry: opt ? epochToYmd(opt.expirationDate) : expiry ?? null,
    rows,
  };
}
