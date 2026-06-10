// Decides whether a proposed browser action is irreversible or outward-facing
// and therefore must pause for explicit owner confirmation — even in autonomous
// mode. This gate is intentional and not configurable away: an agent driving a
// logged-in browser must not silently spend money, message people, change
// credentials, or delete things.

const SENSITIVE = [
  // money
  "buy", "purchase", "checkout", "pay", "payment", "order now", "place order",
  "add to cart", "subscribe", "donate", "transfer", "withdraw", "send money",
  // identity / auth
  "log in", "login", "sign in", "sign up", "password", "verify", "2fa", "otp",
  "authenticate", "connect account",
  // outward communication / publishing
  "send", "post", "publish", "tweet", "comment", "submit", "reply", "share",
  "email", "message", "dm ",
  // destructive
  "delete", "remove", "deactivate", "cancel account", "uninstall", "wipe",
  "format", "drop ",
];

export function isSensitive(...parts: (string | undefined)[]): boolean {
  const hay = parts.filter(Boolean).join(" ").toLowerCase();
  return SENSITIVE.some((kw) => hay.includes(kw));
}

export function sensitiveReason(...parts: (string | undefined)[]): string | null {
  const hay = parts.filter(Boolean).join(" ").toLowerCase();
  const hit = SENSITIVE.find((kw) => hay.includes(kw));
  return hit ? `Matched protected action keyword: "${hit.trim()}"` : null;
}
