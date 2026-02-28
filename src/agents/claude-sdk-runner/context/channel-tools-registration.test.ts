/**
 * Unit tests for the built-in channel tools factory.
 *
 * Verifies that channelToolsFactory returns the two channel tools when
 * structuredContextInput is present, and an empty array otherwise.
 */

import { describe, expect, it } from "vitest";
import type { OpenClawPluginToolContext } from "../../../plugins/types.js";
import { channelToolsFactory } from "./channel-tools-registration.js";
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
      text: "Hello",
      threadId: null,
    },
    adjacentMessages: [],
    thread: null,
    fetcher: noopFetcher,
    ...overrides,
  };
}

describe("channelToolsFactory", () => {
  it("returns two tools when structuredContextInput is provided", () => {
    const ctx: OpenClawPluginToolContext = {
      structuredContextInput: makeInput(),
    };
    const result = channelToolsFactory(ctx);
    const list = Array.isArray(result) ? result : result ? [result] : [];
    const names = list.map((t) => t.name);
    expect(names).toContain("channel.context");
    expect(names).toContain("channel.messages");
    expect(list).toHaveLength(2);
  });

  it("returns empty array when structuredContextInput is absent", () => {
    const ctx: OpenClawPluginToolContext = {};
    const result = channelToolsFactory(ctx);
    const list = Array.isArray(result) ? result : result ? [result] : [];
    expect(list).toHaveLength(0);
  });

  it("channel.context tool has expected name and description", () => {
    const ctx: OpenClawPluginToolContext = {
      structuredContextInput: makeInput(),
    };
    const result = channelToolsFactory(ctx);
    const list = Array.isArray(result) ? result : result ? [result] : [];
    const tool = list.find((t) => t.name === "channel.context");
    expect(tool).toBeDefined();
    expect(typeof tool?.description).toBe("string");
    expect(tool?.description.length).toBeGreaterThan(0);
  });

  it("channel.messages tool has expected name and description", () => {
    const ctx: OpenClawPluginToolContext = {
      structuredContextInput: makeInput(),
    };
    const result = channelToolsFactory(ctx);
    const list = Array.isArray(result) ? result : result ? [result] : [];
    const tool = list.find((t) => t.name === "channel.messages");
    expect(tool).toBeDefined();
    expect(typeof tool?.description).toBe("string");
    expect(tool?.description.length).toBeGreaterThan(0);
  });

  it("returns tools for DM channelType (progressive discovery)", () => {
    const ctx: OpenClawPluginToolContext = {
      structuredContextInput: makeInput({ channelType: "direct" }),
    };
    const result = channelToolsFactory(ctx);
    const list = Array.isArray(result) ? result : result ? [result] : [];
    expect(list).toHaveLength(2);
    const names = list.map((t) => t.name);
    expect(names).toContain("channel.context");
    expect(names).toContain("channel.messages");
  });
});
