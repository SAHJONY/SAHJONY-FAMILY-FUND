import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Environment-variable manager for .env.local.
//
// SAFETY: this writes plaintext secrets to disk and is therefore restricted to
// local development. It refuses to run in production (e.g. on Vercel, where the
// filesystem is read-only anyway). Secret-looking values are masked on read and
// never returned in full to the client.

const FILE = path.join(process.cwd(), ".env.local");
const SECRET_HINT = /(KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|API)/i;

function devOnly(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Env editing is disabled in production for safety." },
      { status: 403 }
    );
  }
  return null;
}

interface EnvLine { key: string; raw: string }

async function parse(): Promise<EnvLine[]> {
  let text = "";
  try { text = await fs.readFile(FILE, "utf8"); } catch { return []; }
  const out: EnvLine[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out.push({ key: t.slice(0, eq).trim(), raw: t.slice(eq + 1).trim() });
  }
  return out;
}

function mask(key: string, value: string): { value: string; masked: boolean } {
  if (SECRET_HINT.test(key) && value.length > 0) {
    const tail = value.slice(-4);
    return { value: `••••••••${tail}`, masked: true };
  }
  return { value, masked: false };
}

export async function GET() {
  const guard = devOnly();
  if (guard) return guard;
  const lines = await parse();
  return NextResponse.json(
    {
      vars: lines.map((l) => ({ key: l.key, ...mask(l.key, l.raw) })),
      file: ".env.local",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const guard = devOnly();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const key = String(body.key ?? "").trim();
  const value = String(body.value ?? "");
  if (!/^[A-Z0-9_]+$/i.test(key)) {
    return NextResponse.json({ error: "Invalid key (use A-Z, 0-9, _)" }, { status: 400 });
  }

  let text = "";
  try { text = await fs.readFile(FILE, "utf8"); } catch { /* new file */ }
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => l.trim().startsWith(`${key}=`));
  const newLine = `${key}=${value}`;
  if (idx >= 0) lines[idx] = newLine;
  else lines.push(newLine);
  await fs.writeFile(FILE, lines.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");

  return NextResponse.json({
    ok: true,
    note: "Saved to .env.local. Restart the dev server for the change to take effect.",
  });
}

export async function DELETE(req: NextRequest) {
  const guard = devOnly();
  if (guard) return guard;
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  let text = "";
  try { text = await fs.readFile(FILE, "utf8"); } catch { return NextResponse.json({ ok: false }, { status: 404 }); }
  const lines = text.split("\n").filter((l) => !l.trim().startsWith(`${key}=`));
  await fs.writeFile(FILE, lines.join("\n"), "utf8");
  return NextResponse.json({ ok: true });
}
