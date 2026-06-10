import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { complete } from "@/lib/infer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Email agent — uses the owner's OWN SMTP credentials (set on /env). It can:
//  - draft an email with SAHJONY (no send)
//  - send a single message ONLY when consent:true is passed (no bulk blasting).
// Reading the inbox lives in /api/email/inbox (IMAP). Nothing is auto-sent.

function smtp() {
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

export async function GET() {
  return NextResponse.json({ connected: !!smtp(), from: process.env.SMTP_USER ?? null });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Draft mode — SAHJONY composes, returns text, sends nothing.
  if (body.action === "draft") {
    const res = await complete([
      { role: "system", content: "You are SAHJONY, the owner's executive assistant. Write a clear, professional email. Return only the email body with a subject line on the first line as 'Subject: ...'. Do not invent facts." },
      { role: "user", content: `Write an email. Context/goal: ${body.prompt ?? ""}${body.to ? `\nRecipient: ${body.to}` : ""}${body.tone ? `\nTone: ${body.tone}` : ""}` },
    ]);
    return NextResponse.json({ draft: res?.content ?? "Brain unreachable." });
  }

  // Send mode — requires real SMTP + explicit consent. Single recipient.
  const t = smtp();
  if (!t) return NextResponse.json({ error: "Email not connected. Set SMTP_HOST/USER/PASS on the env page." }, { status: 400 });
  if (!body.consent) return NextResponse.json({ error: "Set consent:true to send. SAHJONY never sends without your go-ahead." }, { status: 403 });
  const to = String(body.to ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return NextResponse.json({ error: "Valid single recipient required." }, { status: 400 });

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_USER, to,
      subject: String(body.subject ?? "(no subject)"),
      text: String(body.text ?? ""),
      ...(body.inReplyTo ? { inReplyTo: String(body.inReplyTo), references: String(body.inReplyTo) } : {}),
    });
    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    return NextResponse.json({ error: `Send failed: ${(e as Error).message}` }, { status: 502 });
  }
}
