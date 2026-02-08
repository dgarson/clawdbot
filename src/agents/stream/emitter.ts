import type { StreamEventListener } from "./types.js";

/**
 * Minimal typed event emitter — single event channel with sync dispatch.
 * Listener errors are swallowed to avoid breaking the event pipeline.
 */
export class TypedEventEmitter<T> {
  #listeners: StreamEventListener<T>[] = [];

  /** Subscribe to events. Returns an unsubscribe function. */
  subscribe(listener: StreamEventListener<T>): () => void {
    this.#listeners.push(listener);
    return () => {
      const idx = this.#listeners.indexOf(listener);
      if (idx !== -1) {
        this.#listeners.splice(idx, 1);
      }
    };
  }

  /** Emit an event to all listeners. Errors are caught and ignored. */
  emit(event: T): void {
    for (const listener of this.#listeners) {
      try {
        void listener(event);
      } catch {
        // swallow — listeners must not break the pipeline
      }
    }
  }

  get listenerCount(): number {
    return this.#listeners.length;
  }

  removeAllListeners(): void {
    this.#listeners = [];
  }
}
