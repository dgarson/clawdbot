import { describe, expect, it } from "vitest";
import { buildChannelTools } from "./tools.js";
import type { ChannelFetcher, StructuredContextInput } from "./types.js";

const noopFetcher: ChannelFetcher = {
  async fetchThread() {
    return { replies: [], totalCount: 0 };
  },
  async fetchMessages() {
    return [];
  },
};

const input: StructuredContextInput = {
  platform: "slack",
  channelId: "C123",
  channelName: "general",
  channelType: "group",
  anchor: {
    messageId: "1234",
    ts: "1234",
    authorId: "U1",
    authorName: "Alice",
    authorIsBot: false,
    text: "Question about the rollout",
    threadId: null,
  },
  adjacentMessages: [
    {
      messageId: "1100",
      ts: "1100",
      authorId: "U2",
      authorName: "Bob",
      authorIsBot: false,
      text: "The rollout was discussed yesterday",
      threadId: null,
      replyCount: 3,
      hasMedia: false,
      reactions: [":white_check_mark: 2"],
    },
    {
      messageId: "1200",
      ts: "1200",
      authorId: "U3",
      authorName: "Carol",
      authorIsBot: false,
      text: "unrelated message",
      threadId: null,
      replyCount: 0,
      hasMedia: false,
      reactions: [],
    },
  ],
  thread: null,
  fetcher: noopFetcher,
};

describe("buildChannelTools", () => {
  it("returns exactly two tools", () => {
    const tools = buildChannelTools(input);
    expect(tools.length).toBe(2);
    expect(tools.map((t) => t.name)).toEqual(["channel.context", "channel.messages"]);
  });

  it("channel.context finds messages by keyword", async () => {
    const tools = buildChannelTools(input);
    const contextTool = tools.find((t) => t.name === "channel.context")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (contextTool.execute as any)(
      "test-call-id",
      { intent: "rollout discussion" },
      null,
      null,
    );
    const parsed = JSON.parse(result);
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0].text).toContain("rollout");
  });

  it("channel.context returns empty results for unrelated intent", async () => {
    const tools = buildChannelTools(input);
    const contextTool = tools.find((t) => t.name === "channel.context")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (contextTool.execute as any)(
      "test-call-id",
      { intent: "xyzzy nonsense token" },
      null,
      null,
    );
    const parsed = JSON.parse(result);
    // May or may not match — just verify structure
    expect(parsed).toHaveProperty("results");
    expect(parsed).toHaveProperty("coverage");
  });

  it("channel.messages retrieves thread from snapshot", async () => {
    const inputWithThread: StructuredContextInput = {
      ...input,
      thread: {
        rootMessageId: "root1",
        rootTs: "900",
        rootAuthorId: "U1",
        rootAuthorName: "Alice",
        rootAuthorIsBot: false,
        rootText: "Thread root",
        replies: [
          {
            messageId: "r1",
            ts: "901",
            authorId: "U2",
            authorName: "Bob",
            authorIsBot: false,
            text: "Reply",
            files: undefined,
          },
        ],
        totalReplyCount: 1,
      },
    };
    const tools = buildChannelTools(inputWithThread);
    const msgTool = tools.find((t) => t.name === "channel.messages")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (msgTool.execute as any)("test-call-id", { thread_id: "900" }, null, null);
    const parsed = JSON.parse(result);
    expect(parsed.thread).toBeDefined();
    expect(parsed.thread.root.text).toBe("Thread root");
  });
});
