// SAHJONY browser-control engine.
//
// Drives a real Chromium on the owner's own machine, at the owner's command.
// A session must be explicitly AUTHORIZED before any action runs. Everything is
// logged. Sensitive/irreversible actions are gated by the caller (see
// control-policy). This controls the LOCAL device only — remote devices would
// require the consent-based per-device agent, not a push from here.

import type { Browser, Page } from "playwright";

export interface ActionRecord {
  t: number;
  action: string;
  detail: string;
  ok: boolean;
}

interface BrowserSession {
  browser: Browser | null;
  page: Page | null;
  authorized: boolean;
  log: ActionRecord[];
  engineError: string | null;
}

const g = globalThis as unknown as { __sahjonyBrowser?: BrowserSession };
const session: BrowserSession =
  g.__sahjonyBrowser ??
  (g.__sahjonyBrowser = {
    browser: null,
    page: null,
    authorized: false,
    log: [],
    engineError: null,
  });

function record(action: string, detail: string, ok: boolean) {
  session.log.unshift({ t: Date.now(), action, detail, ok });
  session.log = session.log.slice(0, 30);
}

export function status() {
  return {
    authorized: session.authorized,
    running: !!session.browser,
    url: session.page?.url() ?? null,
    log: session.log,
    engineError: session.engineError,
  };
}

export function authorize(on: boolean) {
  session.authorized = on;
  record("authorize", on ? "Session authorized by owner" : "Session revoked", true);
}

export function requireAuth() {
  if (!session.authorized) throw new Error("Browser session not authorized by owner.");
}

async function ensurePage(): Promise<Page> {
  requireAuth();
  if (session.page && session.browser) return session.page;
  try {
    const { chromium } = await import("playwright");
    const headless = process.env.BROWSER_HEADLESS !== "false"; // default headless
    session.browser = await chromium.launch({ headless });
    const ctx = await session.browser.newContext({ viewport: { width: 1280, height: 800 } });
    session.page = await ctx.newPage();
    session.engineError = null;
    record("launch", `Chromium launched (headless=${headless})`, true);
    return session.page;
  } catch (e) {
    session.engineError = (e as Error).message;
    record("launch", `Engine failed: ${session.engineError}`, false);
    throw e;
  }
}

export async function pageText(): Promise<{ url: string; title: string; text: string }> {
  const p = await ensurePage();
  const title = await p.title().catch(() => "");
  const text = await p
    .evaluate(() => document.body?.innerText ?? "")
    .catch(() => "");
  return { url: p.url(), title, text: text.slice(0, 6000) };
}

export async function screenshot(): Promise<string | null> {
  if (!session.page) return null;
  try {
    const buf = await session.page.screenshot({ type: "jpeg", quality: 55 });
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function act(a: {
  action: string;
  url?: string;
  selector?: string;
  text?: string;
}): Promise<{ ok: boolean; detail: string }> {
  const p = await ensurePage();
  try {
    switch (a.action) {
      case "goto": {
        if (!a.url) throw new Error("url required");
        await p.goto(a.url, { timeout: 20000, waitUntil: "domcontentloaded" });
        record("goto", a.url, true);
        return { ok: true, detail: `Navigated to ${a.url}` };
      }
      case "click": {
        const target = a.selector
          ? p.locator(a.selector).first()
          : p.getByText(a.text ?? "", { exact: false }).first();
        await target.click({ timeout: 10000 });
        record("click", a.selector || a.text || "", true);
        return { ok: true, detail: `Clicked ${a.selector || a.text}` };
      }
      case "type": {
        if (!a.selector) throw new Error("selector required");
        await p.locator(a.selector).first().fill(a.text ?? "", { timeout: 10000 });
        record("type", `${a.selector} ← "${a.text}"`, true);
        return { ok: true, detail: `Typed into ${a.selector}` };
      }
      case "scroll": {
        await p.mouse.wheel(0, a.text === "up" ? -800 : 800);
        record("scroll", a.text ?? "down", true);
        return { ok: true, detail: `Scrolled ${a.text ?? "down"}` };
      }
      case "read": {
        record("read", "re-read page", true);
        return { ok: true, detail: "Read page" };
      }
      default:
        throw new Error(`Unknown action: ${a.action}`);
    }
  } catch (e) {
    record(a.action, (e as Error).message, false);
    return { ok: false, detail: (e as Error).message };
  }
}

export async function shutdown() {
  try { await session.browser?.close(); } catch { /* noop */ }
  session.browser = null;
  session.page = null;
  record("shutdown", "Browser closed", true);
}
