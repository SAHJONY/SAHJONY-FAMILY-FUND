import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function creds() {
  return {
    host: process.env.IMAP_HOST,
    user: process.env.IMAP_USER || process.env.SMTP_USER,
    pass: process.env.IMAP_PASS || process.env.SMTP_PASS,
    port: Number(process.env.IMAP_PORT || 993),
  };
}

// Lists the latest inbox messages (headers + flags) via IMAP, newest first.
export async function GET() {
  const { host, user, pass, port } = creds();
  if (!host || !user || !pass) {
    return NextResponse.json({ connected: false, detail: "Set IMAP_HOST/USER/PASS on the env page to read mail." });
  }
  const client = new ImapFlow({ host, port, secure: true, auth: { user, pass }, logger: false });
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    const out: any[] = [];
    try {
      const total = (client.mailbox as any).exists as number;
      const start = Math.max(1, total - 24);
      for await (const msg of client.fetch(`${start}:*`, { uid: true, envelope: true, flags: true })) {
        out.push({
          uid: msg.uid,
          from: msg.envelope?.from?.[0]?.address ?? "",
          fromName: msg.envelope?.from?.[0]?.name ?? "",
          subject: msg.envelope?.subject ?? "(no subject)",
          date: msg.envelope?.date ?? null,
          seen: msg.flags ? msg.flags.has("\\Seen") : true,
        });
      }
    } finally { lock.release(); }
    await client.logout();
    return NextResponse.json({ connected: true, mailbox: user, messages: out.reverse() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    try { await client.logout(); } catch { /* noop */ }
    return NextResponse.json({ connected: true, error: `IMAP failed: ${(e as Error).message}` }, { status: 502 });
  }
}
