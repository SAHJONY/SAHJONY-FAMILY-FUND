import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { dataPath } from "@/lib/paths";
import { complete } from "@/lib/infer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// SAHJONY as full-stack developer. Generates code, and writes/reads files in a
// SANDBOXED workspace (data/workspace) only — path traversal is blocked so it
// can never touch the rest of the system. Real builds, contained.

const ROOT = dataPath("workspace");

function safePath(rel: string): string | null {
  const clean = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(ROOT, clean);
  if (!full.startsWith(ROOT)) return null; // traversal blocked
  return full;
}

async function listFiles(dir = ROOT, base = ""): Promise<string[]> {
  const out: string[] = [];
  try {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) out.push(...(await listFiles(path.join(dir, e.name), rel)));
      else out.push(rel);
    }
  } catch { /* empty */ }
  return out;
}

export async function GET(req: NextRequest) {
  const file = new URL(req.url).searchParams.get("file");
  if (file) {
    const p = safePath(file);
    if (!p) return NextResponse.json({ error: "invalid path" }, { status: 400 });
    try { return NextResponse.json({ file, content: await fs.readFile(p, "utf8") }); }
    catch { return NextResponse.json({ error: "not found" }, { status: 404 }); }
  }
  return NextResponse.json({ files: await listFiles() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "write") {
    const p = safePath(String(body.path ?? ""));
    if (!p) return NextResponse.json({ error: "invalid path" }, { status: 400 });
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, String(body.content ?? ""), "utf8");
    return NextResponse.json({ ok: true, path: body.path });
  }

  // generate: SAHJONY (developer) produces code/plan from a spec.
  const res = await complete([
    { role: "system", content: "You are Ada, a senior full-stack developer on SAHJONY's team. Given a spec, produce a concise build plan and the code, with each file in its own fenced block labeled with its path as a comment on the first line. Default stack: TypeScript/React/Node. Be production-minded." },
    { role: "user", content: String(body.prompt ?? "Scaffold a small TypeScript utility.") },
  ]);
  return NextResponse.json({ output: res?.content ?? "Brain unreachable.", model: res?.model });
}
