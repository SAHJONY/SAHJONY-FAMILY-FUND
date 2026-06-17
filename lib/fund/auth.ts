// SAHJONY CAPITAL LLC — accounts & sessions (KV-backed).
//
// Self-contained email + password auth for friends & family. Passwords are
// scrypt-hashed with a per-user salt (never stored in clear). Sessions are
// stateless signed tokens (HMAC-SHA256 over userId+expiry) carried in an
// httpOnly cookie. Each user is isolated; their book/keys live under their id.
// Durable in Upstash when configured (see kv.ts); file-backed locally.

import crypto from "node:crypto";
import { kv } from "./kv";
import { getSecret } from "../secrets";

export type Plan = "free" | "pro";
export type Status = "active" | "suspended";

export interface User {
  id: string;
  email: string;
  name: string;
  passHash: string;        // scrypt: "salt:hashHex"
  plan: Plan;
  status: Status;
  isOwner: boolean;
  createdAt: number;
  lastLogin?: number;
}
export type PublicUser = Omit<User, "passHash">;

const SESSION_COOKIE = "sahjony_sid";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days

const uKey = (id: string) => `user:${id}`;
const eKey = (email: string) => `email:${email.trim().toLowerCase()}`;

export function publicUser(u: User): PublicUser {
  const { passHash, ...rest } = u;
  return rest;
}

// ---- password hashing ------------------------------------------------------
function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex"), b = Buffer.from(test, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- user store ------------------------------------------------------------
export async function getUser(id: string): Promise<User | null> {
  return kv().get<User>(uKey(id));
}
export async function getUserByEmail(email: string): Promise<User | null> {
  const id = await kv().get<string>(eKey(email));
  return id ? getUser(id) : null;
}
export async function listUsers(): Promise<PublicUser[]> {
  const k = kv();
  const ids = await k.keys("user:");
  const out: PublicUser[] = [];
  for (const key of ids) {
    const u = await k.get<User>(key);
    if (u) out.push(publicUser(u));
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}
export async function countUsers(): Promise<number> {
  return (await kv().keys("user:")).length;
}

export interface RegisterResult { ok: boolean; error?: string; user?: PublicUser }

export async function registerUser(email: string, name: string, password: string): Promise<RegisterResult> {
  email = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "invalid email" };
  if (password.length < 8) return { ok: false, error: "password must be at least 8 characters" };
  if (await getUserByEmail(email)) return { ok: false, error: "an account with that email already exists" };

  // The very first account becomes the owner.
  const isOwner = (await countUsers()) === 0 || email === (getSecret("OWNER_EMAIL") || "").toLowerCase();
  const user: User = {
    id: crypto.randomUUID(), email, name: name.trim() || email.split("@")[0],
    passHash: hashPassword(password),
    plan: isOwner ? "pro" : "free", status: "active", isOwner, createdAt: Date.now(),
  };
  const k = kv();
  await k.set(uKey(user.id), user);
  await k.set(eKey(email), user.id);
  return { ok: true, user: publicUser(user) };
}

export async function verifyLogin(email: string, password: string): Promise<User | null> {
  const u = await getUserByEmail(email);
  if (!u || u.status === "suspended") return null;
  if (!verifyPassword(password, u.passHash)) return null;
  u.lastLogin = Date.now();
  await kv().set(uKey(u.id), u);
  return u;
}

export async function updateUser(id: string, patch: Partial<Pick<User, "plan" | "status" | "name" | "isOwner">>): Promise<PublicUser | null> {
  const u = await getUser(id);
  if (!u) return null;
  Object.assign(u, patch);
  await kv().set(uKey(id), u);
  return publicUser(u);
}

export async function deleteUser(id: string): Promise<boolean> {
  const u = await getUser(id);
  if (!u) return false;
  const k = kv();
  await k.del(uKey(id));
  await k.del(eKey(u.email));
  return true;
}

// ---- sessions (signed cookie) ---------------------------------------------
function sessionSecret(): string {
  return getSecret("SESSION_SECRET") || "sahjony-dev-secret-change-me";
}
export function signSession(userId: string): { token: string; cookie: string } {
  const exp = Date.now() + SESSION_TTL_MS;
  const body = `${userId}.${exp}`;
  const sig = crypto.createHmac("sha256", sessionSecret()).update(body).digest("hex");
  const token = `${body}.${sig}`;
  const secure = process.env.VERCEL ? "; Secure" : "";
  const cookie = `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
  return { token, cookie };
}
export function clearCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}
export function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(`${userId}.${exp}`).digest("hex");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Date.now() > Number(exp)) return null;
  return userId;
}
export function readCookie(header: string | null, name = SESSION_COOKIE): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

// Resolve the current user from a request's cookies (null if not signed in).
export async function currentUser(req: { headers: { get(name: string): string | null } }): Promise<User | null> {
  const id = verifySession(readCookie(req.headers.get("cookie")));
  return id ? getUser(id) : null;
}
