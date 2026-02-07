/**
 * Memory Ops Logger — thin interface injected into backends.
 *
 * Keeps backends free of filesystem concerns. All calls are fire-and-forget.
 */

import type { MemoryOpsEvent } from "./types.js";
import { logMemoryOpsEvent } from "./ops-log.js";

export interface MemoryOpsLogger {
  /** Fire-and-forget log. Never throws. */
  log(params: Omit<MemoryOpsEvent, "id" | "ts">): void;
}

/** Create a MemoryOpsLogger bound to a state directory (e.g. ~/.openclaw). */
export function createMemoryOpsLogger(stateDir: string): MemoryOpsLogger {
  return {
    log(params) {
      logMemoryOpsEvent(stateDir, params).catch(() => {});
    },
  };
}

/** No-op logger for tests or when ops logging is disabled. */
export const noopOpsLogger: MemoryOpsLogger = {
  log() {},
};
