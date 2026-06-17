import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/fund/pipeline";
import { currentUser, listUsers } from "@/lib/fund/auth";
import { withUserKeys } from "@/lib/fund/ctx";
import { getSecret } from "@/lib/secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Weekday-close cron: run every active user's pipeline. Authorized by the Vercel
// cron header or a CRON_SECRET query param; open in local dev.
export async function GET(req: NextRequest) {
  const cronSecret = getSecret("CRON_SECRET");
  const authed = req.headers.get("x-vercel-cron") != null
    || (cronSecret && new URL(req.url).searchParams.get("key") === cronSecret)
    || !process.env.VERCEL;
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const users = await listUsers();
  let ran = 0;
  for (const u of users.filter((x) => x.status === "active")) {
    try { await withUserKeys(u.id, () => runPipeline({ userId: u.id })); ran++; } catch { /* continue */ }
  }
  return NextResponse.json({ ok: true, ranForUsers: ran });
}

// Runs the signed-in user's pipeline, using their own provider keys if set.
export async function POST(req: NextRequest) {
  const u = await currentUser(req);
  if (!u) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const report = await withUserKeys(u.id, () =>
    runPipeline({ userId: u.id, asof: typeof body.asof === "string" ? body.asof : undefined, skipNews: body.skipNews === true })
  );
  return NextResponse.json({ ok: true, report });
}
