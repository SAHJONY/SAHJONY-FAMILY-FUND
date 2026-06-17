// SAHJONY FAMILY FUND — Layer 4: optional notifier. Off by default.
//
// Pushes the day's alerts to Telegram or iMessage behind config/env flags. When
// disabled it's a no-op. The pipeline calls maybeSend(alerts, asof) at the end.

import type { Alert } from "./types";

function format(alerts: Alert[], asof: string): string {
  if (!alerts.length) return `SAHJONY CAPITAL LLC · ${asof}\nNo active alerts.`;
  const lines = alerts.slice(0, 20).map((a) => {
    const tag = a.severity === "high" ? "‼️" : a.severity === "warn" ? "⚠️" : "ℹ️";
    return `${tag} ${a.message}`;
  });
  return `SAHJONY CAPITAL LLC · ${asof}\n${lines.join("\n")}`;
}

async function telegram(text: string): Promise<boolean> {
  const token = process.env.FUND_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.FUND_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// iMessage via osascript — macOS local only (won't run on Vercel). Best-effort.
async function imessage(text: string): Promise<boolean> {
  const to = process.env.FUND_IMESSAGE_TO;
  if (!to || process.env.VERCEL) return false;
  try {
    const { spawn } = await import("node:child_process");
    const script = `tell application "Messages" to send ${JSON.stringify(text)} to buddy ${JSON.stringify(to)} of (1st service whose service type = iMessage)`;
    await new Promise<void>((resolve) => {
      const p = spawn("osascript", ["-e", script]);
      p.on("close", () => resolve());
      p.on("error", () => resolve());
    });
    return true;
  } catch {
    return false;
  }
}

export async function maybeSend(alerts: Alert[], asof: string): Promise<{ sent: string[] }> {
  if (process.env.FUND_NOTIFY !== "on") return { sent: [] };
  const text = format(alerts, asof);
  const sent: string[] = [];
  if (await telegram(text)) sent.push("telegram");
  if (await imessage(text)) sent.push("imessage");
  return { sent };
}
