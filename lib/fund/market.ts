// SAHJONY FAMILY FUND — market data layer.
//
// This is the yfinance equivalent for our TypeScript/Vercel stack: real quotes,
// option chains, daily history and headlines from Yahoo Finance's public
// endpoints. No key required. Every fetch is defensive — on failure we return
// null / empty and the caller tags the mark "unavailable" rather than faking a
// number. Nothing here is simulated.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function getJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
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

const QHOST = "https://query1.finance.yahoo.com";

// Spot quote (and previous close for a day move).
export async function getQuote(symbol: string): Promise<Quote | null> {
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

// Daily close history (for 200-day MA / breadth / IV-rank backfill helpers).
export async function getHistory(symbol: string, range = "1y"): Promise<number[]> {
  const j = await getJson<any>(`${QHOST}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`);
  const closes: (number | null)[] = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  return closes.filter((c): c is number => typeof c === "number");
}

function epochToYmd(sec: number): string {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}
function ymdToEpoch(ymd: string): number {
  return Math.floor(new Date(`${ymd}T00:00:00Z`).getTime() / 1000);
}

// Full option chain for one expiry (nearest if none given).
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
        strike: o.strike,
        type,
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

export interface Headline { title: string; publisher: string; link: string; ts: number }

// Recent headlines for a symbol (Yahoo search endpoint), newest first.
export async function getNews(symbol: string, count = 10): Promise<Headline[]> {
  const j = await getJson<any>(
    `${QHOST}/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=${count}&quotesCount=0`
  );
  const news: any[] = j?.news ?? [];
  return news.map((n) => ({
    title: n.title ?? "",
    publisher: n.publisher ?? "",
    link: n.link ?? "",
    ts: typeof n.providerPublishTime === "number" ? n.providerPublishTime : 0,
  }));
}
