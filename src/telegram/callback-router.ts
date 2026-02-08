/**
 * Telegram Callback Query Response Router
 *
 * Registry for pending callback handlers that matches incoming callback_query
 * events to registered interactive requests (questions, confirmations, etc.).
 *
 * This is the foundational plumbing for Phase 2 blocking tools:
 * - AskTelegramQuestion
 * - AskTelegramConfirmation
 * - AskTelegramForm
 *
 * Supports both one-shot (question/confirmation) and toggle (checklist) callbacks.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("telegram/callback-router");

// ─── Types ───────────────────────────────────────────────────────────────────

export type CallbackMode = "one-shot" | "toggle";

export interface CallbackHandlerRegistration {
  /** Unique ID for this handler (used for cleanup). */
  id: string;
  /** Prefix to match against callback_data (matched with startsWith). */
  prefix: string;
  /** Chat ID this handler is scoped to (optional, for multi-chat safety). */
  chatId?: string;
  /** Callback mode: one-shot auto-deregisters after first match; toggle persists. */
  mode: CallbackMode;
  /** Handler function called when a matching callback_query arrives. */
  handler: (data: CallbackEvent) => void | Promise<void>;
  /** Timeout in ms — handler is auto-cleaned up after this duration. */
  timeoutMs: number;
  /** Internal: timer handle for cleanup. */
  _timer?: ReturnType<typeof setTimeout>;
  /** Timestamp when this handler was registered. */
  registeredAt: number;
}

export interface CallbackEvent {
  /** The full callback_data string from Telegram. */
  callbackData: string;
  /** The parsed action ID (everything after the prefix). */
  actionId: string;
  /** Chat ID where the callback originated. */
  chatId: string;
  /** User ID of the person who clicked. */
  userId: string;
  /** Username of the person who clicked. */
  username?: string;
  /** The original callback query ID (for answerCallbackQuery). */
  callbackQueryId: string;
  /** Message ID of the message containing the inline keyboard. */
  messageId?: number;
}

export type CallbackRouterStats = {
  /** Number of currently registered handlers. */
  activeHandlers: number;
  /** Total handlers registered since creation. */
  totalRegistered: number;
  /** Total handlers that timed out. */
  totalTimedOut: number;
  /** Total callback_query events routed. */
  totalRouted: number;
  /** Total callback_query events with no matching handler. */
  totalUnmatched: number;
};

// ─── Router Implementation ──────────────────────────────────────────────────

export class TelegramCallbackRouter {
  private handlers = new Map<string, CallbackHandlerRegistration>();
  private stats: CallbackRouterStats = {
    activeHandlers: 0,
    totalRegistered: 0,
    totalTimedOut: 0,
    totalRouted: 0,
    totalUnmatched: 0,
  };

  /**
   * Register a callback handler.
   * Returns a cleanup function to manually deregister.
   */
  register(registration: Omit<CallbackHandlerRegistration, "_timer" | "registeredAt">): () => void {
    const existing = this.handlers.get(registration.id);
    if (existing) {
      this.deregister(registration.id);
    }

    const entry: CallbackHandlerRegistration = {
      ...registration,
      registeredAt: Date.now(),
    };

    // Set up auto-cleanup timeout
    entry._timer = setTimeout(() => {
      this.handleTimeout(entry.id);
    }, entry.timeoutMs);

    this.handlers.set(entry.id, entry);
    this.stats.totalRegistered++;
    this.stats.activeHandlers = this.handlers.size;

    log.raw(
      `Registered callback handler: id=${entry.id} prefix="${entry.prefix}" mode=${entry.mode} timeout=${entry.timeoutMs}ms`,
    );

    return () => this.deregister(entry.id);
  }

  /**
   * Deregister a callback handler by ID.
   * Returns true if the handler was found and removed.
   */
  deregister(id: string): boolean {
    const entry = this.handlers.get(id);
    if (!entry) {
      return false;
    }
    if (entry._timer) {
      clearTimeout(entry._timer);
    }
    this.handlers.delete(id);
    this.stats.activeHandlers = this.handlers.size;
    return true;
  }

  /**
   * Route an incoming callback_query to a matching handler.
   * Returns true if a handler was found and invoked.
   */
  async route(event: CallbackEvent): Promise<boolean> {
    const { callbackData, chatId } = event;

    for (const [id, entry] of this.handlers) {
      // Match prefix
      if (!callbackData.startsWith(entry.prefix)) {
        continue;
      }

      // Optionally scope to chat
      if (entry.chatId && entry.chatId !== chatId) {
        continue;
      }

      // Parse the action ID (part after prefix + separator)
      const prefixLen = entry.prefix.length;
      const separator = callbackData[prefixLen] === ":" ? 1 : 0;
      event.actionId = callbackData.slice(prefixLen + separator);

      this.stats.totalRouted++;

      try {
        await entry.handler(event);
      } catch (err) {
        log.raw(
          `Callback handler error: id=${id} error=${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // One-shot: auto-deregister after first match
      if (entry.mode === "one-shot") {
        this.deregister(id);
      }

      return true;
    }

    this.stats.totalUnmatched++;
    return false;
  }

  /**
   * Check if any handler matches the given callback_data.
   * Non-destructive — does not invoke the handler.
   */
  hasHandler(callbackData: string, chatId?: string): boolean {
    for (const entry of this.handlers.values()) {
      if (!callbackData.startsWith(entry.prefix)) {
        continue;
      }
      if (entry.chatId && chatId && entry.chatId !== chatId) {
        continue;
      }
      return true;
    }
    return false;
  }

  /**
   * Get stats for diagnostics.
   */
  getStats(): CallbackRouterStats {
    return { ...this.stats };
  }

  /**
   * Get the number of active handlers.
   */
  get size(): number {
    return this.handlers.size;
  }

  /**
   * Clear all handlers (e.g., on shutdown).
   */
  clear(): void {
    for (const entry of this.handlers.values()) {
      if (entry._timer) {
        clearTimeout(entry._timer);
      }
    }
    this.handlers.clear();
    this.stats.activeHandlers = 0;
  }

  private handleTimeout(id: string): void {
    const entry = this.handlers.get(id);
    if (!entry) {
      return;
    }
    this.handlers.delete(id);
    this.stats.activeHandlers = this.handlers.size;
    this.stats.totalTimedOut++;
    log.raw(
      `Callback handler timed out: id=${id} prefix="${entry.prefix}" after ${entry.timeoutMs}ms`,
    );
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _defaultRouter: TelegramCallbackRouter | null = null;

/**
 * Get the default (singleton) callback router.
 * Use this for production — the singleton ensures all callback_query events
 * are routed through a single registry.
 */
export function getCallbackRouter(): TelegramCallbackRouter {
  if (!_defaultRouter) {
    _defaultRouter = new TelegramCallbackRouter();
  }
  return _defaultRouter;
}

/**
 * Reset the singleton router (for testing).
 */
export function resetCallbackRouter(): void {
  if (_defaultRouter) {
    _defaultRouter.clear();
    _defaultRouter = null;
  }
}
