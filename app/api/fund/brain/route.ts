import { NextRequest, NextResponse } from "next/server";
import { askBrain } from "@/lib/fund/brain";
import { currentUser } from "@/lib/fund/auth";
import { withUserKeys } from "@/lib/fund/ctx";
import { PERSONAS } from "@/lib/fund/personas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// The list of institutional analytical lenses.
export async function GET() {
  return NextResponse.json(
    { personas: PERSONAS.map((p) => ({ id: p.id, name: p.name, firm: p.firm, focus: p.focus })) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// The analyst brain, scoped to the signed-in user's book + their own keys,
// optionally routed through one of the 12 institutional personas.
export async function POST(req: NextRequest) {
  const u = await currentUser(req);
  if (!u) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const question = String(b.question || "").slice(0, 2000).trim();
  if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });
  const lang = b.lang === "es" ? "es" : "en";
  const personaId = typeof b.persona === "string" ? b.persona : undefined;
  const reply = await withUserKeys(u.id, () => askBrain(u.id, question, lang, personaId));
  return NextResponse.json(reply, { headers: { "Cache-Control": "no-store" } });
}
