/**
 * Telegram Response Store
 *
 * Tracks pending interactive requests (questions, confirmations, forms)
 * and resolves promises when callback_query responses arrive.
 *
 * Mirror of src/slack/tools/response-store.ts adapted for Telegram.
 */

export interface PendingRequest {
  requestId: string;
  createdAt: number;
  timeoutMs: number;
  resolve: (response: TelegramInteractiveResponse | null) => void;
}

export interface TelegramInteractiveResponse {
  answered: boolean;
  selectedValues?: string[];
  userId: string;
  username?: string;
  timestamp: number;
  timedOut?: boolean;
}

/**
 * Store for tracking pending Telegram interactive requests and their responses.
 */
export class TelegramResponseStore {
  private pending = new Map<string, PendingRequest>();
  private timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Wait for a response to an interactive request.
   * Returns null if cancelled; returns response with timedOut=true on timeout.
   */
  async waitForResponse(
    requestId: string,
    timeoutMs: number,
  ): Promise<TelegramInteractiveResponse | null> {
    return new Promise((resolve) => {
      const request: PendingRequest = {
        requestId,
        createdAt: Date.now(),
        timeoutMs,
        resolve,
      };

      this.pending.set(requestId, request);

      const timeout = setTimeout(() => {
        const pending = this.pending.get(requestId);
        if (pending) {
          pending.resolve({
            answered: false,
            timedOut: true,
            userId: "",
            timestamp: Date.now(),
          });
          this.pending.delete(requestId);
          this.timeouts.delete(requestId);
        }
      }, timeoutMs);

      this.timeouts.set(requestId, timeout);
    });
  }

  /**
   * Record a response to a pending request.
   * Returns true if the request was found and resolved.
   */
  recordResponse(
    requestId: string,
    response: Omit<TelegramInteractiveResponse, "timedOut">,
  ): boolean {
    const pending = this.pending.get(requestId);
    if (!pending) {
      return false;
    }

    const timeout = this.timeouts.get(requestId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(requestId);
    }

    pending.resolve(response);
    this.pending.delete(requestId);
    return true;
  }

  /**
   * Check if a request is pending.
   */
  isPending(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  /**
   * Cancel a pending request (resolves with null).
   */
  cancel(requestId: string): void {
    const timeout = this.timeouts.get(requestId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(requestId);
    }

    const pending = this.pending.get(requestId);
    if (pending) {
      pending.resolve(null);
      this.pending.delete(requestId);
    }
  }

  /**
   * Cancel all pending requests.
   */
  cancelAll(): void {
    for (const requestId of this.pending.keys()) {
      this.cancel(requestId);
    }
  }

  /**
   * Get count of pending requests.
   */
  get pendingCount(): number {
    return this.pending.size;
  }

  /**
   * Clean up expired requests.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [requestId, request] of this.pending.entries()) {
      if (now - request.createdAt > request.timeoutMs) {
        this.cancel(requestId);
      }
    }
  }
}

/**
 * Global singleton response store for Telegram interactive tools.
 */
export const telegramResponseStore = new TelegramResponseStore();

// Clean up expired requests every minute
const _cleanupInterval = setInterval(() => {
  telegramResponseStore.cleanup();
}, 60_000);

// Prevent the interval from keeping the process alive
if (typeof _cleanupInterval.unref === "function") {
  _cleanupInterval.unref();
}
