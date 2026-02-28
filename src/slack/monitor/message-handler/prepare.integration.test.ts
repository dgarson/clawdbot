/**
 * Integration test: Slack context builder registration + dispatch via hook system.
 *
 * Verifies the pattern used by provider.ts to register a message_context_build
 * subscriber for Slack, and that the hook runner dispatches it correctly.
 *
 * Since registerSlackContextBuilder() is not exported from provider.ts, we
 * recreate the same handler registration pattern and verify dispatch.
 */

import type { WebClient as SlackWebClient } from "@slack/web-api";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  initializeGlobalHookRunner,
  resetGlobalHookRunner,
} from "../../../plugins/hook-runner-global.js";
import { createHookRunner } from "../../../plugins/hooks.js";
import { createEmptyPluginRegistry } from "../../../plugins/registry.js";
import type {
  PluginHookHandlerMap,
  PluginHookMessageContextBuildEvent,
  PluginHookRegistration,
} from "../../../plugins/types.js";
import type { SlackMessageEvent } from "../../types.js";
import { buildSlackStructuredContext, type SlackContextBuildData } from "./context-builder.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlackClient() {
  return {
    conversations: {
      replies: vi.fn().mockResolvedValue({
        messages: [],
        response_metadata: { next_cursor: "" },
      }),
    },
  } as unknown as SlackWebClient;
}

function makeSlackResolvedData(overrides?: Partial<SlackContextBuildData>): SlackContextBuildData {
  const message: SlackMessageEvent = {
    type: "message",
    channel: "C123",
    channel_type: "channel",
    user: "U1",
    text: "test message",
    ts: "1700000000.000",
  };

  return {
    message,
    roomLabel: "#general",
    senderId: "U1",
    senderName: "Alice",
    isBotMessage: false,
    rawBody: "test message",
    isThreadReply: false,
    threadTs: null,
    threadHistory: [],
    threadStarter: null,
    threadUserMap: new Map(),
    client: makeSlackClient(),
    adjacentMessages: [],
    channelType: "group" as const,
    ...overrides,
  };
}

function makeSlackEvent(
  overrides?: Partial<PluginHookMessageContextBuildEvent>,
): PluginHookMessageContextBuildEvent {
  return {
    platform: "slack",
    channelId: "C123",
    channelType: "group",
    anchorTs: "1700000000.000",
    threadTs: null,
    resolvedData: makeSlackResolvedData(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Slack context builder hook integration", () => {
  afterEach(() => {
    resetGlobalHookRunner();
    vi.clearAllMocks();
  });

  /**
   * Recreate the exact handler pattern from provider.ts and register it in a
   * test registry — then dispatch via the hook runner and verify the result.
   */
  it("Slack subscriber returns structuredContext for platform=slack via hook runner", async () => {
    const registry = createEmptyPluginRegistry();

    // Register the same handler that provider.ts registers internally
    const handler: PluginHookHandlerMap["message_context_build"] = (event, _ctx) => {
      if (event.platform !== "slack") {
        return;
      }
      const data = event.resolvedData;
      if (!data || typeof data !== "object" || !("message" in data)) {
        return;
      }
      return {
        structuredContext: buildSlackStructuredContext({
          ...(data as SlackContextBuildData),
          channelId: event.channelId,
        }),
      };
    };

    registry.typedHooks.push({
      pluginId: "builtin:slack",
      hookName: "message_context_build",
      handler,
      source: "slack-monitor",
    } as PluginHookRegistration<"message_context_build">);

    // Initialize runner
    initializeGlobalHookRunner(registry);

    // Also create a local runner for direct invocation (the global runner is
    // the production path, but createHookRunner gives us direct access to
    // runMessageContextBuild without importing the global helpers)
    const runner = createHookRunner(registry);

    // Dispatch
    const result = await runner.runMessageContextBuild(makeSlackEvent());

    // Verify the result
    expect(result).toBeDefined();
    expect(result!.structuredContext).toBeDefined();
    expect(result!.structuredContext!.platform).toBe("slack");
    expect(result!.structuredContext!.channelId).toBe("C123");
    expect(result!.structuredContext!.channelName).toBe("#general");
    expect(result!.structuredContext!.anchor.text).toBe("test message");
    expect(result!.structuredContext!.anchor.authorId).toBe("U1");
    expect(result!.structuredContext!.anchor.authorName).toBe("Alice");
  });

  it("Slack subscriber ignores non-slack platforms", async () => {
    const registry = createEmptyPluginRegistry();

    const handler: PluginHookHandlerMap["message_context_build"] = (event, _ctx) => {
      if (event.platform !== "slack") {
        return;
      }
      const data = event.resolvedData;
      if (!data || typeof data !== "object" || !("message" in data)) {
        return;
      }
      return {
        structuredContext: buildSlackStructuredContext({
          ...(data as SlackContextBuildData),
          channelId: event.channelId,
        }),
      };
    };

    registry.typedHooks.push({
      pluginId: "builtin:slack",
      hookName: "message_context_build",
      handler,
      source: "slack-monitor",
    } as PluginHookRegistration<"message_context_build">);

    const runner = createHookRunner(registry);

    // Dispatch with platform=discord — Slack handler should not handle it
    const result = await runner.runMessageContextBuild(makeSlackEvent({ platform: "discord" }));

    // The Slack handler returned undefined, so the runner returns undefined
    expect(result).toBeUndefined();
  });

  it("passes channelId from hook event to buildSlackStructuredContext", async () => {
    const registry = createEmptyPluginRegistry();

    const handler: PluginHookHandlerMap["message_context_build"] = (event, _ctx) => {
      if (event.platform !== "slack") {
        return;
      }
      const data = event.resolvedData;
      if (!data || typeof data !== "object" || !("message" in data)) {
        return;
      }
      return {
        structuredContext: buildSlackStructuredContext({
          ...(data as SlackContextBuildData),
          channelId: event.channelId,
        }),
      };
    };

    registry.typedHooks.push({
      pluginId: "builtin:slack",
      hookName: "message_context_build",
      handler,
      source: "slack-monitor",
    } as PluginHookRegistration<"message_context_build">);

    const runner = createHookRunner(registry);

    // Use a different channelId in the event (simulating the hook event having
    // the canonical channel ID, possibly different from what's in resolvedData)
    const result = await runner.runMessageContextBuild(makeSlackEvent({ channelId: "C_OVERRIDE" }));

    expect(result).toBeDefined();
    expect(result!.structuredContext!.channelId).toBe("C_OVERRIDE");
  });

  it("first subscriber to claim wins (claim semantics)", async () => {
    const registry = createEmptyPluginRegistry();

    // First subscriber: Slack handler (higher priority)
    const slackHandler: PluginHookHandlerMap["message_context_build"] = (event, _ctx) => {
      if (event.platform !== "slack") {
        return;
      }
      const data = event.resolvedData;
      if (!data || typeof data !== "object" || !("message" in data)) {
        return;
      }
      return {
        structuredContext: buildSlackStructuredContext({
          ...(data as SlackContextBuildData),
          channelId: event.channelId,
        }),
      };
    };

    registry.typedHooks.push({
      pluginId: "builtin:slack",
      hookName: "message_context_build",
      handler: slackHandler,
      priority: 100,
      source: "slack-monitor",
    } as PluginHookRegistration<"message_context_build">);

    // Second subscriber: a custom handler that also claims (lower priority)
    const customHandler = vi.fn().mockReturnValue({
      structuredContext: {
        platform: "custom",
        channelId: "CUSTOM",
        channelName: "custom",
        anchor: {
          messageId: "X",
          ts: "X",
          authorId: "X",
          authorName: "X",
          authorIsBot: false,
          text: "X",
          threadId: null,
        },
        adjacentMessages: [],
        thread: null,
      },
    });

    registry.typedHooks.push({
      pluginId: "test:custom",
      hookName: "message_context_build",
      handler: customHandler,
      priority: 0,
      source: "test",
    } as PluginHookRegistration<"message_context_build">);

    const runner = createHookRunner(registry);
    const result = await runner.runMessageContextBuild(makeSlackEvent());

    // First subscriber (Slack) claimed the event; custom handler still ran but
    // the merge function uses "first wins" semantics (acc ?? _next).
    expect(result).toBeDefined();
    expect(result!.structuredContext!.platform).toBe("slack");
  });

  it("subscriber handles thread context correctly", async () => {
    const registry = createEmptyPluginRegistry();

    const handler: PluginHookHandlerMap["message_context_build"] = (event, _ctx) => {
      if (event.platform !== "slack") {
        return;
      }
      const data = event.resolvedData;
      if (!data || typeof data !== "object" || !("message" in data)) {
        return;
      }
      return {
        structuredContext: buildSlackStructuredContext({
          ...(data as SlackContextBuildData),
          channelId: event.channelId,
        }),
      };
    };

    registry.typedHooks.push({
      pluginId: "builtin:slack",
      hookName: "message_context_build",
      handler,
      source: "slack-monitor",
    } as PluginHookRegistration<"message_context_build">);

    const runner = createHookRunner(registry);

    // Provide thread data in the resolved data
    const resolvedData = makeSlackResolvedData({
      isThreadReply: true,
      threadTs: "1700000000.000",
      threadStarter: { text: "root question", userId: "U2", ts: "1700000000.000" },
      threadHistory: [
        { text: "root question", userId: "U2", ts: "1700000000.000" },
        { text: "a reply", userId: "U1", ts: "1700000001.000" },
      ],
      threadUserMap: new Map([
        ["U1", { name: "Alice" }],
        ["U2", { name: "Bob" }],
      ]),
    });

    const result = await runner.runMessageContextBuild(
      makeSlackEvent({
        threadTs: "1700000000.000",
        resolvedData,
      }),
    );

    expect(result).toBeDefined();
    const ctx = result!.structuredContext!;
    expect(ctx.thread).toBeDefined();
    expect(ctx.thread!.rootText).toBe("root question");
    expect(ctx.thread!.rootAuthorName).toBe("Bob");
    expect(ctx.thread!.replies).toHaveLength(1);
    expect(ctx.thread!.replies[0].text).toBe("a reply");
  });
});
