import { NextRequest, NextResponse } from "next/server";
import os from "node:os";
import type { DeviceNode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Consent-based device registry.
//
// Design note: this control plane does NOT push/insert any runtime onto remote
// machines. A device appears here only after it explicitly enrolls itself by
// POSTing with a valid enrollment token (the owner generates the token and runs
// the agent on the device deliberately). This is in-memory for the demo; a real
// deployment would persist to a database and verify signed tokens.

const registry = new Map<string, DeviceNode>();

// Seed with this host as the always-present control node.
registry.set("control-node", {
  id: "control-node",
  label: `${os.hostname()} (control plane)`,
  os: `${os.platform()} ${os.arch()}`,
  state: "online",
  lastSeen: Date.now(),
  enrolled: true,
});

function tokenOk(req: NextRequest): boolean {
  const expected = process.env.DEVICE_ENROLL_TOKEN;
  if (!expected) return false; // enrollment disabled unless owner sets a token
  return req.headers.get("x-enroll-token") === expected;
}

export async function GET() {
  // Mark stale nodes offline (>30s without heartbeat).
  const now = Date.now();
  for (const d of registry.values()) {
    if (d.id !== "control-node" && now - d.lastSeen > 30_000) d.state = "offline";
  }
  return NextResponse.json(
    { devices: [...registry.values()], enrollmentEnabled: !!process.env.DEVICE_ENROLL_TOKEN },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) {
    return NextResponse.json(
      {
        error: "Enrollment refused.",
        reason: process.env.DEVICE_ENROLL_TOKEN
          ? "Invalid x-enroll-token."
          : "Enrollment is disabled. Owner must set DEVICE_ENROLL_TOKEN to allow opt-in.",
      },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? `dev-${Math.random().toString(36).slice(2, 8)}`);
  const node: DeviceNode = {
    id,
    label: String(body.label ?? id),
    os: String(body.os ?? "unknown"),
    state: "online",
    lastSeen: Date.now(),
    enrolled: true,
  };
  registry.set(id, node);
  return NextResponse.json({ ok: true, device: node });
}
