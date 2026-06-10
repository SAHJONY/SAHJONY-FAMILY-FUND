import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Transparent web fetch + text extraction.
//
// This deliberately is NOT a stealth/evasion scraper. It identifies itself with
// an honest User-Agent, checks robots.txt, fetches public pages, and returns
// readable text. It does not spoof fingerprints, rotate identities, or attempt
// to defeat bot protection — and it is not for locating or profiling people.

const UA = "SAHJONY-ControlPlane/1.0 (+transparent fetch; respects robots.txt)";

async function robotsAllows(target: URL): Promise<boolean> {
  try {
    const robotsUrl = `${target.origin}/robots.txt`;
    const res = await fetch(robotsUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) return true; // no robots = allowed
    const txt = await res.text();
    // Minimal check: honor a global "User-agent: *" Disallow that matches path.
    const lines = txt.split("\n").map((l) => l.trim());
    let appliesToAll = false;
    for (const line of lines) {
      const [k, v] = line.split(":").map((s) => s?.trim());
      if (/^user-agent$/i.test(k)) appliesToAll = v === "*";
      if (appliesToAll && /^disallow$/i.test(k) && v && target.pathname.startsWith(v)) {
        return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

function extractText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title, text };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  let target: URL;
  try {
    target = new URL(String(body.url));
    if (!/^https?:$/.test(target.protocol)) throw new Error("scheme");
  } catch {
    return NextResponse.json({ error: "Provide a valid http(s) url." }, { status: 400 });
  }

  if (!(await robotsAllows(target))) {
    return NextResponse.json(
      { error: "Blocked by robots.txt", url: target.href, detail: "This path disallows automated fetching." },
      { status: 451 }
    );
  }

  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 10000);
  try {
    const res = await fetch(target.href, { headers: { "User-Agent": UA }, signal: c.signal });
    const html = await res.text();
    const { title, text } = extractText(html);
    return NextResponse.json({
      url: target.href,
      status: res.status,
      title,
      excerpt: text.slice(0, 4000),
      length: text.length,
      userAgent: UA,
    });
  } catch (e) {
    return NextResponse.json({ error: `Fetch failed: ${(e as Error).message}` }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
