import { NextRequest, NextResponse } from "next/server";
import { readState } from "@/lib/fund/store";
import { currentUser } from "@/lib/fund/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The signed-in user's last computed report (null until they run the pipeline).
export async function GET(req: NextRequest) {
  const u = await currentUser(req);
  if (!u) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  return NextResponse.json({ report: await readState(u.id) }, { headers: { "Cache-Control": "no-store" } });
}
