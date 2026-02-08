import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TelegramCallbackRouter,
  getCallbackRouter,
  resetCallbackRouter,
  type CallbackEvent,
} from "./callback-router.js";

function makeEvent(overrides: Partial<CallbackEvent> = {}): CallbackEvent {
  return {
    callbackData: "test_sel:option_1",
    actionId: "",
    chatId: "12345",
    userId: "67890",
    username: "testuser",
    callbackQueryId: "cq_abc",
    messageId: 100,
    ...overrides,
  };
}

describe("TelegramCallbackRouter", () => {
  let router: TelegramCallbackRouter;

  beforeEach(() => {
    vi.useFakeTimers();
    router = new TelegramCallbackRouter();
  });

  afterEach(() => {
    router.clear();
    vi.useRealTimers();
  });

  // ─── Registration ────────────────────────────────────────────────────────

  describe("register", () => {
    it("registers a handler and increments stats", () => {
      const handler = vi.fn();
      router.register({
        id: "h1",
        prefix: "test_sel",
        mode: "one-shot",
        handler,
        timeoutMs: 5000,
      });

      expect(router.size).toBe(1);
      expect(router.getStats().totalRegistered).toBe(1);
      expect(router.getStats().activeHandlers).toBe(1);
    });

    it("returns a cleanup function", () => {
      const cleanup = router.register({
        id: "h1",
        prefix: "test_sel",
        mode: "one-shot",
        handler: vi.fn(),
        timeoutMs: 5000,
      });

      expect(router.size).toBe(1);
      cleanup();
      expect(router.size).toBe(0);
    });

    it("replaces existing handler with same id", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      router.register({
        id: "h1",
        prefix: "test_sel",
        mode: "one-shot",
        handler: handler1,
        timeoutMs: 5000,
      });

      router.register({
        id: "h1",
        prefix: "test_sel",
        mode: "one-shot",
        handler: handler2,
        timeoutMs: 5000,
      });

      expect(router.size).toBe(1);
    });
  });

  // ─── Deregistration ──────────────────────────────────────────────────────

  describe("deregister", () => {
    it("removes handler by id", () => {
      router.register({
        id: "h1",
        prefix: "test",
        mode: "one-shot",
        handler: vi.fn(),
        timeoutMs: 5000,
      });

      expect(router.deregister("h1")).toBe(true);
      expect(router.size).toBe(0);
    });

    it("returns false for non-existent id", () => {
      expect(router.deregister("nonexistent")).toBe(false);
    });
  });

  // ─── Routing ─────────────────────────────────────────────────────────────

  describe("route", () => {
    it("matches handler by prefix and invokes it", async () => {
      const handler = vi.fn();
      router.register({
        id: "h1",
        prefix: "test_sel",
        mode: "one-shot",
        handler,
        timeoutMs: 5000,
      });

      const event = makeEvent({ callbackData: "test_sel:option_1" });
      const matched = await router.route(event);

      expect(matched).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          callbackData: "test_sel:option_1",
          actionId: "option_1",
        }),
      );
    });

    it("parses actionId from callback_data after prefix", async () => {
      const handler = vi.fn();
      router.register({
        id: "h1",
        prefix: "mc_sel",
        mode: "one-shot",
        handler,
        timeoutMs: 5000,
      });

      const event = makeEvent({ callbackData: "mc_sel:my_value" });
      await router.route(event);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ actionId: "my_value" }));
    });

    it("returns false when no handler matches", async () => {
      const matched = await router.route(makeEvent({ callbackData: "unknown:data" }));
      expect(matched).toBe(false);
      expect(router.getStats().totalUnmatched).toBe(1);
    });

    it("one-shot handler auto-deregisters after first match", async () => {
      const handler = vi.fn();
      router.register({
        id: "h1",
        prefix: "test",
        mode: "one-shot",
        handler,
        timeoutMs: 5000,
      });

      await router.route(makeEvent({ callbackData: "test:a" }));
      expect(router.size).toBe(0);

      // Second call should not match
      const matched = await router.route(makeEvent({ callbackData: "test:b" }));
      expect(matched).toBe(false);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("toggle handler persists after match", async () => {
      const handler = vi.fn();
      router.register({
        id: "h1",
        prefix: "toggle",
        mode: "toggle",
        handler,
        timeoutMs: 10000,
      });

      await router.route(makeEvent({ callbackData: "toggle:item_1" }));
      await router.route(makeEvent({ callbackData: "toggle:item_2" }));
      await router.route(makeEvent({ callbackData: "toggle:item_3" }));

      expect(handler).toHaveBeenCalledTimes(3);
      expect(router.size).toBe(1);
    });

    it("scopes handler to chatId when specified", async () => {
      const handler = vi.fn();
      router.register({
        id: "h1",
        prefix: "scoped",
        chatId: "chat_A",
        mode: "one-shot",
        handler,
        timeoutMs: 5000,
      });

      // Different chat — should not match
      const noMatch = await router.route(
        makeEvent({ callbackData: "scoped:val", chatId: "chat_B" }),
      );
      expect(noMatch).toBe(false);
      expect(handler).not.toHaveBeenCalled();

      // Correct chat — should match
      const match = await router.route(makeEvent({ callbackData: "scoped:val", chatId: "chat_A" }));
      expect(match).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("handles concurrent pending requests independently", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      router.register({
        id: "question1",
        prefix: "q1",
        mode: "one-shot",
        handler: handler1,
        timeoutMs: 5000,
      });
      router.register({
        id: "question2",
        prefix: "q2",
        mode: "one-shot",
        handler: handler2,
        timeoutMs: 5000,
      });

      await router.route(makeEvent({ callbackData: "q2:answer" }));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(router.size).toBe(1); // q1 still registered
    });

    it("handles handler errors gracefully", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("handler boom"));
      router.register({
        id: "h1",
        prefix: "err",
        mode: "one-shot",
        handler,
        timeoutMs: 5000,
      });

      // Should not throw
      const matched = await router.route(makeEvent({ callbackData: "err:data" }));
      expect(matched).toBe(true);
      expect(handler).toHaveBeenCalled();
    });
  });

  // ─── Timeout ─────────────────────────────────────────────────────────────

  describe("timeout", () => {
    it("auto-cleans up handler after timeout", () => {
      router.register({
        id: "h1",
        prefix: "test",
        mode: "one-shot",
        handler: vi.fn(),
        timeoutMs: 3000,
      });

      expect(router.size).toBe(1);
      vi.advanceTimersByTime(3000);
      expect(router.size).toBe(0);
      expect(router.getStats().totalTimedOut).toBe(1);
    });

    it("does not fire timeout if handler was already deregistered", () => {
      const cleanup = router.register({
        id: "h1",
        prefix: "test",
        mode: "one-shot",
        handler: vi.fn(),
        timeoutMs: 3000,
      });

      cleanup();
      vi.advanceTimersByTime(3000);
      expect(router.getStats().totalTimedOut).toBe(0);
    });

    it("does not fire timeout if handler was already matched (one-shot)", async () => {
      router.register({
        id: "h1",
        prefix: "test",
        mode: "one-shot",
        handler: vi.fn(),
        timeoutMs: 3000,
      });

      await router.route(makeEvent({ callbackData: "test:val" }));
      vi.advanceTimersByTime(3000);
      expect(router.getStats().totalTimedOut).toBe(0);
    });
  });

  // ─── hasHandler ──────────────────────────────────────────────────────────

  describe("hasHandler", () => {
    it("returns true when a matching handler exists", () => {
      router.register({
        id: "h1",
        prefix: "mc_sel",
        mode: "one-shot",
        handler: vi.fn(),
        timeoutMs: 5000,
      });

      expect(router.hasHandler("mc_sel:option_1")).toBe(true);
    });

    it("returns false when no handler matches", () => {
      expect(router.hasHandler("unknown:data")).toBe(false);
    });

    it("respects chatId scoping", () => {
      router.register({
        id: "h1",
        prefix: "scoped",
        chatId: "chat_A",
        mode: "one-shot",
        handler: vi.fn(),
        timeoutMs: 5000,
      });

      expect(router.hasHandler("scoped:val", "chat_A")).toBe(true);
      expect(router.hasHandler("scoped:val", "chat_B")).toBe(false);
    });
  });

  // ─── Stats ───────────────────────────────────────────────────────────────

  describe("getStats", () => {
    it("tracks all counters", async () => {
      router.register({
        id: "h1",
        prefix: "test",
        mode: "one-shot",
        handler: vi.fn(),
        timeoutMs: 5000,
      });

      router.register({
        id: "h2",
        prefix: "other",
        mode: "one-shot",
        handler: vi.fn(),
        timeoutMs: 1000,
      });

      await router.route(makeEvent({ callbackData: "test:val" }));
      await router.route(makeEvent({ callbackData: "nope:val" }));
      vi.advanceTimersByTime(1000);

      const stats = router.getStats();
      expect(stats.totalRegistered).toBe(2);
      expect(stats.totalRouted).toBe(1);
      expect(stats.totalUnmatched).toBe(1);
      expect(stats.totalTimedOut).toBe(1);
      expect(stats.activeHandlers).toBe(0);
    });
  });

  // ─── Clear ───────────────────────────────────────────────────────────────

  describe("clear", () => {
    it("removes all handlers", () => {
      router.register({
        id: "h1",
        prefix: "a",
        mode: "one-shot",
        handler: vi.fn(),
        timeoutMs: 5000,
      });
      router.register({
        id: "h2",
        prefix: "b",
        mode: "toggle",
        handler: vi.fn(),
        timeoutMs: 5000,
      });

      router.clear();
      expect(router.size).toBe(0);
      expect(router.getStats().activeHandlers).toBe(0);
    });
  });
});

// ─── Singleton ───────────────────────────────────────────────────────────────

describe("singleton callback router", () => {
  afterEach(() => {
    resetCallbackRouter();
  });

  it("returns the same instance on multiple calls", () => {
    const a = getCallbackRouter();
    const b = getCallbackRouter();
    expect(a).toBe(b);
  });

  it("resetCallbackRouter creates a new instance", () => {
    const a = getCallbackRouter();
    resetCallbackRouter();
    const b = getCallbackRouter();
    expect(a).not.toBe(b);
  });
});
