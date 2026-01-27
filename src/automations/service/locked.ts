/**
 * Concurrency control for AutomationService.
 *
 * Implements a lock mechanism to serialize operations on the store,
 * preventing race conditions when multiple operations access/modify state.
 *
 * Follows the same pattern as CronService's locked() function.
 */

import type { AutomationServiceState } from "./state.js";

/** Store-level locks keyed by store path */
const storeLocks = new Map<string, Promise<void>>();

/**
 * Resolve a promise regardless of its result (success or failure).
 * Used to keep the operation chain alive even when operations fail.
 */
const resolveChain = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    () => undefined,
  );

/**
 * Execute a function while holding the store lock.
 *
 * This ensures that operations that modify the store are serialized,
 * preventing race conditions. The lock is per-store-path, so different
 * store paths can operate concurrently.
 *
 * @param state - Service state containing the store path and op chain
 * @param fn - Async function to execute while holding the lock
 * @returns Promise that resolves with the function's result
 *
 * @example
 * ```ts
 * const result = await locked(state, async () => {
 *   await ensureLoaded(state);
 *   // ... modify store ...
 *   await persist(state);
 *   return result;
 * });
 * ```
 */
export async function locked<T>(state: AutomationServiceState, fn: () => Promise<T>): Promise<T> {
  const storePath = state.deps.storePath;
  const storeOp = storeLocks.get(storePath) ?? Promise.resolve();

  // Wait for both the service op chain and the store lock to clear
  const next = Promise.all([resolveChain(state.op), resolveChain(storeOp)]).then(fn);

  // Keep the chain alive even when the operation fails.
  // This ensures subsequent operations wait for this one to complete.
  const keepAlive = resolveChain(next);
  state.op = keepAlive;
  storeLocks.set(storePath, keepAlive);

  // Cast through 'any' because the chain can produce unknown.
  // The actual result comes from 'next'.
  return (await next) as T;
}
