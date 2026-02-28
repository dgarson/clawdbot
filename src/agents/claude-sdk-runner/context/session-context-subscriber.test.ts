/**
 * Unit tests for the built-in core before_session_create subscriber.
 *
 * Tests verify the subscriber in isolation — that it correctly builds channel/thread
 * context sections and channel tools from StructuredContextInput, following the same
 * pattern as context/tools.test.ts.
 */

import { describe, expect, it } from "vitest";
import type { PluginHookBeforeSessionCreateEvent } from "../../../plugins/types.js";
import { coreSessionContextSubscriber } from "./session-context-subscriber.js";
import type { ChannelFetcher, StructuredContextInput } from "./types.js";

const noopFetcher: ChannelFetcher = {
  async fetchThread() {
    return { replies: [], totalCount: 0 };
  },
  async fetchMessages() {
    return [];
  },
};

function makeInput(overrides?: Partial<StructuredContextInput>): StructuredContextInput {
  return {
    platform: "slack",
    channelId: "C123",
    channelName: "general",
    channelType: "group",
    anchor: {
      messageId: "M001",
      ts: "1700000000.000000",
      authorId: "U001",
      authorName: "Alice",
      authorIsBot: false,
      text: "What is the status of the project?",
      threadId: null,
    },
    adjacentMessages: [],
    thread: null,
    fetcher: noopFetcher,
    ...overrides,
  };
}

describe("coreSessionContextSubscriber", () => {
  it("returns empty result when structuredContextInput is absent", () => {
    const event: PluginHookBeforeSessionCreateEvent = {
      systemPrompt: "Base prompt.",
    };
    const result = coreSessionContextSubscriber(event);
    expect(result.systemPromptSections ?? []).toHaveLength(0);
  });

  it("returns one section containing Channel Context JSON when input is present", () => {
    const event: PluginHookBeforeSessionCreateEvent = {
      systemPrompt: "Base prompt.",
      structuredContextInput: makeInput(),
    };
    const result = coreSessionContextSubscriber(event);
    expect(result.systemPromptSections).toHaveLength(1);
    const section = result.systemPromptSections![0];
    expect(section).toContain("Channel Context");
    expect(section).toContain('"schema_version"');
    expect(section).toContain('"channel"');
  });

  it("includes Channel Tools guidance in the section", () => {
    const event: PluginHookBeforeSessionCreateEvent = {
      systemPrompt: "Base prompt.",
      structuredContextInput: makeInput(),
    };
    const result = coreSessionContextSubscriber(event);
    const section = result.systemPromptSections![0];
    expect(section).toContain("Channel Tools");
    expect(section).toContain("channel.context");
    expect(section).toContain("channel.messages");
    expect(section).toContain("compacted");
  });

  it("includes Thread Context when input has a thread", () => {
    const event: PluginHookBeforeSessionCreateEvent = {
      systemPrompt: "Base prompt.",
      structuredContextInput: makeInput({
        thread: {
          rootMessageId: "M001",
          rootTs: "1700000000.000000",
          rootAuthorId: "U001",
          rootAuthorName: "Alice",
          rootAuthorIsBot: false,
          rootText: "Root message text",
          replies: [],
          totalReplyCount: 0,
        },
      }),
    };
    const result = coreSessionContextSubscriber(event);
    const section = result.systemPromptSections![0];
    expect(section).toContain("Thread Context");
    expect(section).toContain('"thread_id"');
  });

  it("does NOT include Thread Context when thread is null", () => {
    const event: PluginHookBeforeSessionCreateEvent = {
      systemPrompt: "Base prompt.",
      structuredContextInput: makeInput({ thread: null }),
    };
    const result = coreSessionContextSubscriber(event);
    const section = result.systemPromptSections![0];
    expect(section).not.toContain("Thread Context");
  });

  it("does not return tools (channel tools now come via channelToolsFactory)", () => {
    // Channel tools are registered via the plugin tool factory (channel-tools-registration.ts)
    // and arrive through params.customTools, not through the hook subscriber.
    const event: PluginHookBeforeSessionCreateEvent = {
      systemPrompt: "Base prompt.",
      structuredContextInput: makeInput(),
    };
    const result = coreSessionContextSubscriber(event);
    expect(result.tools ?? []).toHaveLength(0);
  });

  it("includes DM-specific Channel Tools guidance for DMs", () => {
    const event: PluginHookBeforeSessionCreateEvent = {
      systemPrompt: "Base prompt.",
      structuredContextInput: makeInput({ channelType: "direct" }),
    };
    const result = coreSessionContextSubscriber(event);
    const section = result.systemPromptSections![0];
    // Channel Context JSON should still be present
    expect(section).toContain("Channel Context");
    // DM-specific guidance should be present
    expect(section).toContain("Channel Tools");
    expect(section).toContain("channel.messages");
    // DM guidance should note that channel.context returns empty
    expect(section).toContain("returns empty results in DMs");
  });
});
