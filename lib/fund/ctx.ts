// SAHJONY CAPITAL LLC — per-request key context.
//
// Carries the current user's resolved provider keys through a request via
// AsyncLocalStorage (concurrency-safe: each request gets its own store, unlike
// a module global). market/news/brain read keys with key(name); it returns the
// user's own key when set, otherwise the app-global key. Wrap a request handler
// in withUserKeys(userId, fn) and everything underneath sees that user's env.

import { AsyncLocalStorage } from "node:async_hooks";
import { getSecret } from "../secrets";
import { getUserVault } from "./vault";

const store = new AsyncLocalStorage<Record<string, string>>();

export function key(name: string): string | undefined {
  const v = store.getStore()?.[name];
  return v !== undefined && v !== "" ? v : getSecret(name);
}

export async function withUserKeys<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
  const keys = userId ? await getUserVault(userId) : {};
  return store.run(keys, fn);
}
