import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMocks = vi.hoisted(() => ({
  getGlobalHookRunner: vi.fn<() => unknown>(() => null),
}));

const dispatchFromConfigMocks = vi.hoisted(() => ({
  dispatchReplyFromConfig: vi.fn(async () => ({
    queuedFinal: true,
    counts: { tool: 0, block: 0, final: 1 },
  })),
}));

vi.mock("../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: hookMocks.getGlobalHookRunner,
}));

vi.mock("./reply/dispatch-from-config.js", () => ({
  dispatchReplyFromConfig: dispatchFromConfigMocks.dispatchReplyFromConfig,
}));

import type { OpenClawConfig } from "../config/config.js";
import { dispatchInboundMessage, withReplyDispatcher } from "./dispatch.js";
import type { ReplyDispatcher } from "./reply/reply-dispatcher.js";
import { buildTestCtx } from "./reply/test-ctx.js";

function createDispatcher(record: string[]): ReplyDispatcher {
  return {
    sendToolResult: () => true,
    sendBlockReply: () => true,
    sendFinalReply: () => true,
    getQueuedCounts: () => ({ tool: 0, block: 0, final: 0 }),
    markComplete: () => {
      record.push("markComplete");
    },
    waitForIdle: async () => {
      record.push("waitForIdle");
    },
  };
}

describe("withReplyDispatcher", () => {
  it("always marks complete and waits for idle after success", async () => {
    const order: string[] = [];
    const dispatcher = createDispatcher(order);

    const result = await withReplyDispatcher({
      dispatcher,
      run: async () => {
        order.push("run");
        return "ok";
      },
      onSettled: () => {
        order.push("onSettled");
      },
    });

    expect(result).toBe("ok");
    expect(order).toEqual(["run", "markComplete", "waitForIdle", "onSettled"]);
  });

  it("still drains dispatcher after run throws", async () => {
    const order: string[] = [];
    const dispatcher = createDispatcher(order);
    const onSettled = vi.fn(() => {
      order.push("onSettled");
    });

    await expect(
      withReplyDispatcher({
        dispatcher,
        run: async () => {
          order.push("run");
          throw new Error("boom");
        },
        onSettled,
      }),
    ).rejects.toThrow("boom");

    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["run", "markComplete", "waitForIdle", "onSettled"]);
  });

  it("dispatchInboundMessage owns dispatcher lifecycle", async () => {
    const order: string[] = [];
    const dispatcher = {
      sendToolResult: () => true,
      sendBlockReply: () => true,
      sendFinalReply: () => {
        order.push("sendFinalReply");
        return true;
      },
      getQueuedCounts: () => ({ tool: 0, block: 0, final: 0 }),
      markComplete: () => {
        order.push("markComplete");
      },
      waitForIdle: async () => {
        order.push("waitForIdle");
      },
    } satisfies ReplyDispatcher;

    // Make the mock invoke sendFinalReply so the existing lifecycle assertion holds.
    dispatchFromConfigMocks.dispatchReplyFromConfig.mockImplementationOnce(
      async (...args: unknown[]) => {
        const params = args[0] as { dispatcher: ReplyDispatcher };
        params.dispatcher.sendFinalReply({ text: "ok" });
        return { queuedFinal: true, counts: { tool: 0, block: 0, final: 1 } };
      },
    );

    await dispatchInboundMessage({
      ctx: buildTestCtx(),
      cfg: {} as OpenClawConfig,
      dispatcher,
      replyResolver: async () => ({ text: "ok" }),
    });

    expect(order).toEqual(["sendFinalReply", "markComplete", "waitForIdle"]);
  });
});

describe("dispatchInboundMessage — before_message_route hook", () => {
  function makeRunner(hookResult?: { skip?: boolean; sessionKey?: string }) {
    return {
      hasHooks: vi.fn((name: string) => name === "before_message_route"),
      runBeforeMessageRoute: vi.fn(async () => hookResult),
    };
  }

  beforeEach(() => {
    hookMocks.getGlobalHookRunner.mockReturnValue(null);
    dispatchFromConfigMocks.dispatchReplyFromConfig.mockClear();
  });

  it("returns zero counts when hook returns skip=true", async () => {
    const runner = makeRunner({ skip: true });
    hookMocks.getGlobalHookRunner.mockReturnValue(runner);

    const order: string[] = [];
    const dispatcher = createDispatcher(order);

    const result = await dispatchInboundMessage({
      ctx: buildTestCtx({ Body: "hello" }),
      cfg: {} as OpenClawConfig,
      dispatcher,
    });

    expect(result.counts).toEqual({ tool: 0, block: 0, final: 0 });
    expect(result.queuedFinal).toBe(false);
    // dispatchReplyFromConfig should not have been called.
    expect(dispatchFromConfigMocks.dispatchReplyFromConfig).not.toHaveBeenCalled();
    // Dispatcher markComplete is called directly in the skip path.
    expect(order).toContain("markComplete");
  });

  it("overrides SessionKey when hook returns sessionKey", async () => {
    const runner = makeRunner({ sessionKey: "custom:session" });
    hookMocks.getGlobalHookRunner.mockReturnValue(runner);

    const order: string[] = [];
    const dispatcher = createDispatcher(order);

    await dispatchInboundMessage({
      ctx: buildTestCtx({ Body: "hello" }),
      cfg: {} as OpenClawConfig,
      dispatcher,
    });

    // dispatchReplyFromConfig should have been called with the overridden SessionKey.
    expect(dispatchFromConfigMocks.dispatchReplyFromConfig).toHaveBeenCalledOnce();
    const passedCtx = (
      dispatchFromConfigMocks.dispatchReplyFromConfig.mock.calls[0] as unknown as [
        { ctx: { SessionKey?: string } },
      ]
    )[0].ctx;
    expect(passedCtx.SessionKey).toBe("custom:session");
  });

  it("proceeds normally when getGlobalHookRunner returns null", async () => {
    const order: string[] = [];
    const dispatcher = createDispatcher(order);

    await dispatchInboundMessage({
      ctx: buildTestCtx({ Body: "hello" }),
      cfg: {} as OpenClawConfig,
      dispatcher,
    });

    // Should still call dispatchReplyFromConfig since no hook intercepted.
    expect(dispatchFromConfigMocks.dispatchReplyFromConfig).toHaveBeenCalledOnce();
  });

  it("proceeds normally when hook returns undefined", async () => {
    const runner = makeRunner(undefined);
    hookMocks.getGlobalHookRunner.mockReturnValue(runner);

    const order: string[] = [];
    const dispatcher = createDispatcher(order);

    await dispatchInboundMessage({
      ctx: buildTestCtx({ Body: "hello" }),
      cfg: {} as OpenClawConfig,
      dispatcher,
    });

    expect(dispatchFromConfigMocks.dispatchReplyFromConfig).toHaveBeenCalledOnce();
  });

  it("proceeds normally when hook throws (error swallowed)", async () => {
    const runner = {
      hasHooks: vi.fn((name: string) => name === "before_message_route"),
      runBeforeMessageRoute: vi.fn(async () => {
        throw new Error("hook exploded");
      }),
    };
    hookMocks.getGlobalHookRunner.mockReturnValue(runner);

    const order: string[] = [];
    const dispatcher = createDispatcher(order);

    // Should not throw — error is swallowed.
    await dispatchInboundMessage({
      ctx: buildTestCtx({ Body: "hello" }),
      cfg: {} as OpenClawConfig,
      dispatcher,
    });

    expect(dispatchFromConfigMocks.dispatchReplyFromConfig).toHaveBeenCalledOnce();
  });
});
