/**
 * Memory ops event emitter — pub/sub for real-time consumers.
 *
 * Mirrors src/infra/audit/audit-events.ts pattern.
 */

import type { MemoryOpsEvent } from "./types.js";

const listeners = new Set<(evt: MemoryOpsEvent) => void>();

/** Emit a memory ops event to all listeners. */
export function emitMemoryOpsEvent(event: MemoryOpsEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* ignore listener errors */
    }
  }
}

/** Subscribe to memory ops events. Returns an unsubscribe function. */
export function onMemoryOpsEvent(listener: (evt: MemoryOpsEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Get the number of active listeners. */
export function getMemoryOpsListenerCount(): number {
  return listeners.size;
}

/** Clear all listeners (for testing). */
export function clearMemoryOpsListeners(): void {
  listeners.clear();
}
