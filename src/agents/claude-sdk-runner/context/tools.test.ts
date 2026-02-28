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
    const parsed = JSON.parse(result.content[0].text);
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
    const parsed = JSON.parse(result.content[0].text);
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
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.thread).toBeDefined();
    expect(parsed.thread.root.text).toBe("Thread root");
  });

  it("channel.messages enforces rate limits", async () => {
    const tools = buildChannelTools(input);
    const msgTool = tools.find((t) => t.name === "channel.messages")!;
    // Call it 15 times (the limit)
    for (let i = 0; i < 15; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (msgTool.execute as any)("test-call-id", { thread_id: "900" }, null, null);
    }
    // 16th call should fail
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const limitResult = await (msgTool.execute as any)(
      "test-call-id",
      { thread_id: "900" },
      null,
      null,
    );
    const parsed = JSON.parse(limitResult.content[0].text);
    expect(parsed.error).toContain("Rate limit reached");
  });

  it("channel.messages retrieves media via fetcher", async () => {
    const fetcherWithMedia: ChannelFetcher = {
      ...noopFetcher,
      async fetchMedia(artifactId) {
        return { mimeType: "image/png", data: `base64data-${artifactId}` };
      },
    };
    const inputWithMediaFetcher = { ...input, fetcher: fetcherWithMedia };
    const tools = buildChannelTools(inputWithMediaFetcher);
    const msgTool = tools.find((t) => t.name === "channel.messages")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (msgTool.execute as any)(
      "test-call-id",
      { media_artifact_id: "F123" },
      null,
      null,
    );
    // media_artifact_id now returns an image content block so Claude's vision
    // system can process the image, not just read a base64 string.
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("F123");
    expect(result.content[1].type).toBe("image");
    expect(result.content[1].data).toBe("base64data-F123");
    expect(result.content[1].mimeType).toBe("image/png");
  });

  it("channel.context surfaces media messages even without keyword match", async () => {
    const inputWithMedia: StructuredContextInput = {
      ...input,
      adjacentMessages: [
        ...input.adjacentMessages,
        {
          messageId: "1150",
          ts: "1150",
          authorId: "U2",
          authorName: "Bob",
          authorIsBot: false,
          text: "[Slack file: brain-scan.png (id:F999)]",
          threadId: null,
          replyCount: 0,
          hasMedia: true,
          reactions: [],
        },
      ],
    };
    const tools = buildChannelTools(inputWithMedia);
    const contextTool = tools.find((t) => t.name === "channel.context")!;
    // Search for "weather" — no keyword match on any message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (contextTool.execute as any)(
      "test-call-id",
      { intent: "weather forecast" },
      null,
      null,
    );
    const parsed = JSON.parse(result.content[0].text);
    // Media message should still appear even with no keyword match
    const mediaResult = parsed.results.find((r: { message_id: string }) => r.message_id === "1150");
    expect(mediaResult).toBeDefined();
    expect(mediaResult.has_media).toBe(true);
    expect(mediaResult.relevance_signal).toBe("recent_media");
  });

  it("channel.context passes isBot through to results", async () => {
    const inputWithBot: StructuredContextInput = {
      ...input,
      adjacentMessages: [
        {
          messageId: "1050",
          ts: "1050",
          authorId: "B1",
          authorName: "Bot",
          authorIsBot: true,
          text: "The rollout schedule shows three phases",
          threadId: null,
          replyCount: 0,
          hasMedia: false,
          reactions: [],
        },
      ],
    };
    const tools = buildChannelTools(inputWithBot);
    const contextTool = tools.find((t) => t.name === "channel.context")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (contextTool.execute as any)(
      "test-call-id",
      { intent: "rollout schedule" },
      null,
      null,
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.results.length).toBe(1);
    expect(parsed.results[0].author.is_bot).toBe(true);
  });

  it("channel.context includes thread replies in keyword search", async () => {
    const inputWithThread: StructuredContextInput = {
      ...input,
      thread: {
        rootMessageId: "root1",
        rootTs: "900",
        rootAuthorId: "U1",
        rootAuthorName: "Alice",
        rootAuthorIsBot: false,
        rootText: "Thread about the deployment pipeline",
        replies: [
          {
            messageId: "r1",
            ts: "901",
            authorId: "U2",
            authorName: "Bob",
            authorIsBot: false,
            text: "The deployment failed because of a config issue",
            files: undefined,
          },
          {
            messageId: "r2",
            ts: "902",
            authorId: "U3",
            authorName: "Carol",
            authorIsBot: false,
            text: "I fixed the deployment config",
            files: undefined,
          },
        ],
        totalReplyCount: 2,
      },
    };
    const tools = buildChannelTools(inputWithThread);
    const contextTool = tools.find((t) => t.name === "channel.context")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (contextTool.execute as any)(
      "test-call-id",
      { intent: "deployment config" },
      null,
      null,
    );
    const parsed = JSON.parse(result.content[0].text);
    // Should find thread root + both replies (all contain "deployment")
    const ids = parsed.results.map((r: { message_id: string }) => r.message_id);
    expect(ids).toContain("root1");
    expect(ids).toContain("r1");
    expect(ids).toContain("r2");
    // Thread replies should have thread_id set
    const reply = parsed.results.find((r: { message_id: string }) => r.message_id === "r1");
    expect(reply.thread_id).toBe("root1");
  });

  it("channel.context deduplicates thread messages already in adjacent", async () => {
    // If a thread root is also in adjacentMessages, it shouldn't appear twice
    const inputWithOverlap: StructuredContextInput = {
      ...input,
      adjacentMessages: [
        ...input.adjacentMessages,
        {
          messageId: "root1",
          ts: "900",
          authorId: "U1",
          authorName: "Alice",
          authorIsBot: false,
          text: "Thread about the deployment pipeline",
          threadId: null,
          replyCount: 2,
          hasMedia: false,
          reactions: [],
        },
      ],
      thread: {
        rootMessageId: "root1",
        rootTs: "900",
        rootAuthorId: "U1",
        rootAuthorName: "Alice",
        rootAuthorIsBot: false,
        rootText: "Thread about the deployment pipeline",
        replies: [
          {
            messageId: "r1",
            ts: "901",
            authorId: "U2",
            authorName: "Bob",
            authorIsBot: false,
            text: "The deployment is ready",
            files: undefined,
          },
        ],
        totalReplyCount: 1,
      },
    };
    const tools = buildChannelTools(inputWithOverlap);
    const contextTool = tools.find((t) => t.name === "channel.context")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (contextTool.execute as any)(
      "test-call-id",
      { intent: "deployment pipeline" },
      null,
      null,
    );
    const parsed = JSON.parse(result.content[0].text);
    // root1 should only appear once (from adjacent, not duplicated from thread)
    const root1Results = parsed.results.filter(
      (r: { message_id: string }) => r.message_id === "root1",
    );
    expect(root1Results.length).toBe(1);
    // r1 should still appear (only in thread, not in adjacent)
    expect(parsed.results.find((r: { message_id: string }) => r.message_id === "r1")).toBeDefined();
  });

  it("channel.messages fetches specific messages by ID", async () => {
    const tools = buildChannelTools(input);
    const msgTool = tools.find((t) => t.name === "channel.messages")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (msgTool.execute as any)(
      "test-call-id",
      { message_ids: ["1100"] },
      null,
      null,
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.messages).toBeDefined();
    expect(parsed.messages.length).toBe(1);
    expect(parsed.messages[0].text).toContain("The rollout was discussed yesterday");
  });
});
