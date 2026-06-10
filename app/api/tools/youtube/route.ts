import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/infer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// YouTube research: pulls a video's REAL title/author (oEmbed) and its actual
// caption transcript, then has SAHJONY summarize/analyze it. If a video has no
// captions, it says so — it does not fabricate a transcript.

const UA = "Mozilla/5.0 (SAHJONY research fetch)";

function videoId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(url) ? url : null);
}

async function oembed(id: string) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function transcript(id: string): Promise<string | null> {
  try {
    const page = await fetch(`https://www.youtube.com/watch?v=${id}`, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en",
        // Bypass the EU consent interstitial that hides the player response.
        Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+000",
      },
    });
    const html = await page.text();
    const m = html.match(/"captionTracks":(\[.*?\])/);
    if (!m) return null; // YouTube often withholds caption data from server IPs
    const tracks = JSON.parse(m[1]);
    const track = tracks.find((t: any) => (t.languageCode || "").startsWith("en")) || tracks[0];
    if (!track?.baseUrl) return null;
    const xml = await (await fetch(track.baseUrl, { headers: { "User-Agent": UA } })).text();
    const text = xml
      .replace(/<text[^>]*>/g, " ")
      .replace(/<\/text>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;#39;/g, "'").replace(/&amp;quot;/g, '"').replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/\s+/g, " ").trim();
    return text || null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = videoId(String(body.url ?? ""));
  if (!id) return NextResponse.json({ error: "Provide a valid YouTube URL or 11-char video id." }, { status: 400 });

  const meta = await oembed(id);
  const tx = await transcript(id);

  if (!tx) {
    return NextResponse.json({
      videoId: id,
      title: meta?.title ?? null,
      author: meta?.author_name ?? null,
      hasTranscript: false,
      detail: "No captions available for this video, so there is no transcript to analyze. (Nothing is fabricated.)",
    });
  }

  const focus = String(body.focus ?? "").trim();
  const res = await complete([
    { role: "system", content: "You are SAHJONY doing research. Summarize the video transcript: 3-5 key takeaways, any concrete numbers/claims, and how it's relevant. Base everything strictly on the transcript; do not add outside facts." },
    { role: "user", content: `Video: ${meta?.title ?? id} by ${meta?.author_name ?? "?"}.${focus ? ` Focus on: ${focus}.` : ""}\n\nTranscript (truncated):\n${tx.slice(0, 9000)}` },
  ]);

  return NextResponse.json({
    videoId: id,
    title: meta?.title ?? null,
    author: meta?.author_name ?? null,
    hasTranscript: true,
    transcriptChars: tx.length,
    analysis: res?.content ?? null,
  });
}
