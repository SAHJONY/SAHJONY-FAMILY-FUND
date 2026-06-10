import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Fetches and parses a single message body by UID, and marks it seen.
export async function GET(req: NextRequest) {
  const uid = new URL(req.url).searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const host = process.env.IMAP_HOST;
  const user = process.env.IMAP_USER || process.env.SMTP_USER;
  const pass = process.env.IMAP_PASS || process.env.SMTP_PASS;
  if (!host || !user || !pass) return NextResponse.json({ error: "IMAP not connected." }, { status: 400 });

  const client = new ImapFlow({ host, port: Number(process.env.IMAP_PORT || 993), secure: true, auth: { user, pass }, logger: false });
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
      if (!msg || !msg.source) return NextResponse.json({ error: "message not found" }, { status: 404 });
      const parsed = await simpleParser(msg.source as Buffer);
      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true }).catch(() => {});
      return NextResponse.json({
        uid: Number(uid),
        from: parsed.from?.text ?? "",
        to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map((t) => t.text).join(", ") : parsed.to.text) : "",
        subject: parsed.subject ?? "(no subject)",
        date: parsed.date ?? null,
        text: parsed.text ?? "",
        html: typeof parsed.html === "string" ? parsed.html : null,
        messageId: parsed.messageId ?? "",
      }, { headers: { "Cache-Control": "no-store" } });
    } finally { lock.release(); }
  } catch (e) {
    return NextResponse.json({ error: `Read failed: ${(e as Error).message}` }, { status: 502 });
  } finally {
    try { await client.logout(); } catch { /* noop */ }
  }
}
