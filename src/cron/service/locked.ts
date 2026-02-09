import type { CronServiceState } from "./state.js";

const storeLocks = new Map<string, Promise<void>>();

/** Threshold in ms after which lock contention is logged at error level. */
const LOCK_WARN_THRESHOLD_MS = 5_000;

const resolveChain = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    () => undefined,
  );

export async function locked<T>(
  state: CronServiceState,
  fn: () => Promise<T>,
  context?: { action?: string; jobId?: string; agentId?: string },
): Promise<T> {
  const storePath = state.deps.storePath;
  const storeOp = storeLocks.get(storePath) ?? Promise.resolve();

  const waitStartedAtMs = state.deps.nowMs();

  const next = Promise.all([resolveChain(state.op), resolveChain(storeOp)]).then(() => {
    const waitMs = state.deps.nowMs() - waitStartedAtMs;
    if (waitMs >= LOCK_WARN_THRESHOLD_MS) {
      state.deps.log.error(
        {
          waitMs,
          action: context?.action ?? "unknown",
          jobId: context?.jobId,
          agentId: context?.agentId,
          storePath,
        },
        `cron: lock contention — waited ${waitMs}ms to acquire store lock`,
      );
    }
    return fn();
  });

  // Keep the chain alive even when the operation fails.
  const keepAlive = resolveChain(next);
  state.op = keepAlive;
  storeLocks.set(storePath, keepAlive);

  return (await next) as T;
}
