import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<true>();

/** Returns true when called from within an agent error cleanup hook scope. */
export function isInCleanupHookScope(): boolean {
  return storage.getStore() === true;
}

/** Runs `fn` inside the cleanup hook scope. Spawn is blocked within this scope. */
export async function runInCleanupHookScope<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run(true, fn);
}
