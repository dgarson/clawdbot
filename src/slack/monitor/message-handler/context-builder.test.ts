import { describe, expect, it, vi } from "vitest";
import type { SlackMessageEvent } from "../../types.js";
import type { SlackThreadMessage, SlackThreadStarter } from "../media.js";
import type { SlackContextBuildData } from "./context-builder.js";
import { buildSlackStructuredContext } from "./context-builder.js";

function makeClient(repliesMock?: ReturnType<typeof vi.fn>) {
  return {
    conversations: {
      replies:
        repliesMock ??
        vi.fn().mockResolvedValue({
          messages: [],
          response_metadata: { next_cursor: "" },
        }),
    },
  } as unknown as Parameters<typeof buildSlackStructuredContext>[0]["client"];
}

function baseDmParams(overrides: Partial<SlackContextBuildData> = {}): SlackContextBuildData & {
  channelId: string;
} {
  const message: SlackMessageEvent = {
    channel: "D123",
    channel_type: "im",
    user: "U1",
    text: "hello there",
    ts: "1700000000.000",
  } as SlackMessageEvent;

  return {
    channelId: "D123",
    message,
    roomLabel: "#dm",
    senderId: "U1",
    senderName: "Alice",
    isBotMessage: false,
    rawBody: "hello there",
    isThreadReply: false,
    threadTs: null,
    threadHistory: [],
    threadStarter: null,
    threadUserMap: new Map(),
    client: makeClient(),
    adjacentMessages: [],
    channelType: "direct" as const,
    ...overrides,
  };
}

describe("buildSlackStructuredContext", () => {
  it("builds correct context for a simple DM", () => {
    const sc = buildSlackStructuredContext(baseDmParams());

    expect(sc.platform).toBe("slack");
    expect(sc.channelId).toBe("D123");
    expect(sc.anchor.text).toBe("hello there");
    expect(sc.anchor.ts).toBe("1700000000.000");
    expect(sc.anchor.authorId).toBe("U1");
    expect(sc.anchor.authorName).toBe("Alice");
    expect(sc.anchor.authorIsBot).toBe(false);
    expect(sc.anchor.threadId).toBeNull();
    expect(sc.thread).toBeNull();
    expect(sc.adjacentMessages).toEqual([]);
    expect(sc.fetcher).toBeDefined();
  });

  it("sets channelName from roomLabel", () => {
    const sc = buildSlackStructuredContext(baseDmParams({ roomLabel: "#general" }));
    expect(sc.channelName).toBe("#general");
  });

  it("marks bot messages correctly", () => {
    const sc = buildSlackStructuredContext(baseDmParams({ isBotMessage: true, senderId: "B1" }));
    expect(sc.anchor.authorIsBot).toBe(true);
    expect(sc.anchor.authorId).toBe("B1");
  });

  it("sets threadId on anchor for thread replies", () => {
    const sc = buildSlackStructuredContext(
      baseDmParams({ isThreadReply: true, threadTs: "100.000" }),
    );
    expect(sc.anchor.threadId).toBe("100.000");
  });

  it("builds thread data for thread replies with starter and history", () => {
    const threadStarter: SlackThreadStarter = {
      text: "root question",
      userId: "U2",
      ts: "100.000",
    };
    const threadHistory: SlackThreadMessage[] = [
      { text: "root question", userId: "U2", ts: "100.000" },
      { text: "first reply", userId: "U1", ts: "100.500" },
    ];
    const threadUserMap = new Map([
      ["U1", { name: "Alice" }],
      ["U2", { name: "Bob" }],
    ]);

    const sc = buildSlackStructuredContext(
      baseDmParams({
        isThreadReply: true,
        threadTs: "100.000",
        threadStarter,
        threadHistory,
        threadUserMap,
      }),
    );

    expect(sc.thread).toBeDefined();
    expect(sc.thread!.rootTs).toBe("100.000");
    expect(sc.thread!.rootText).toBe("root question");
    expect(sc.thread!.rootAuthorId).toBe("U2");
    expect(sc.thread!.rootAuthorName).toBe("Bob");
    expect(sc.thread!.rootAuthorIsBot).toBe(false);
    // Root message (ts === threadTs) must be excluded from replies
    expect(sc.thread!.replies.every((r) => r.ts !== "100.000")).toBe(true);
    expect(sc.thread!.replies.some((r) => r.text === "first reply")).toBe(true);
    expect(sc.thread!.totalReplyCount).toBe(1);
  });

  it("resolves reply author names via threadUserMap", () => {
    const threadStarter: SlackThreadStarter = {
      text: "start",
      userId: "U1",
      ts: "200.000",
    };
    const threadHistory: SlackThreadMessage[] = [
      { text: "start", userId: "U1", ts: "200.000" },
      { text: "bot reply", botId: "B2", ts: "200.100" },
      { text: "user reply", userId: "U3", ts: "200.200" },
    ];
    const threadUserMap = new Map([["U1", { name: "Alice" }]]);

    const sc = buildSlackStructuredContext(
      baseDmParams({
        isThreadReply: true,
        threadTs: "200.000",
        threadStarter,
        threadHistory,
        threadUserMap,
      }),
    );

    const botReply = sc.thread!.replies.find((r) => r.ts === "200.100");
    expect(botReply?.authorName).toBe("Bot (B2)");
    expect(botReply?.authorIsBot).toBe(true);

    const userReply = sc.thread!.replies.find((r) => r.ts === "200.200");
    // U3 not in userMap → falls back to userId
    expect(userReply?.authorName).toBe("U3");
  });

  it("returns null thread when threadStarter is null even if isThreadReply=true", () => {
    const sc = buildSlackStructuredContext(
      baseDmParams({ isThreadReply: true, threadTs: "100.000", threadStarter: null }),
    );
    expect(sc.thread).toBeNull();
  });

  it("maps adjacentMessages from HistoryEntry array", () => {
    const sc = buildSlackStructuredContext(
      baseDmParams({
        adjacentMessages: [
          { sender: "Alice", body: "earlier msg", messageId: "99.000" },
          { sender: "Bob", body: "another msg", messageId: "99.500" },
        ],
      }),
    );

    expect(sc.adjacentMessages).toHaveLength(2);
    expect(sc.adjacentMessages[0].authorName).toBe("Alice");
    expect(sc.adjacentMessages[0].text).toBe("earlier msg");
    expect(sc.adjacentMessages[0].authorIsBot).toBe(false);
    expect(sc.adjacentMessages[0].threadId).toBeNull();
  });

  it("fetcher.fetchThread delegates to resolveSlackThreadHistory and excludes root", async () => {
    const replies = vi.fn().mockResolvedValue({
      messages: [
        { text: "root", user: "U1", ts: "300.000" },
        { text: "reply one", user: "U2", ts: "300.100" },
      ],
      response_metadata: { next_cursor: "" },
    });

    const sc = buildSlackStructuredContext(baseDmParams({ client: makeClient(replies) }));
    const result = await sc.fetcher.fetchThread("300.000", 20);

    expect(replies).toHaveBeenCalled();
    expect(result.replies).toHaveLength(1);
    expect(result.replies[0].text).toBe("reply one");
    // Root (ts === threadId) must be excluded
    expect(result.replies.every((r) => r.ts !== "300.000")).toBe(true);
    // Root info should be returned separately
    expect(result.root).toBeDefined();
    expect(result.root!.text).toBe("root");
    expect(result.root!.authorId).toBe("U1");
  });

  it("fetcher.fetchMessages returns empty array (no Slack batch API)", async () => {
    const sc = buildSlackStructuredContext(baseDmParams());
    const result = await sc.fetcher.fetchMessages(["M1", "M2"]);
    expect(result).toEqual([]);
  });

  it("fetcher.fetchNewReplies fetches messages and filters by sinceTs", async () => {
    const replies = vi.fn().mockResolvedValue({
      messages: [
        { text: "old root", user: "U1", ts: "300.000" },
        { text: "old reply", user: "U2", ts: "300.100" },
        { text: "new reply", user: "U3", ts: "300.200" },
      ],
      response_metadata: { next_cursor: "" },
    });

    const sc = buildSlackStructuredContext(baseDmParams({ client: makeClient(replies) }));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const newReplies = await sc.fetcher.fetchNewReplies!("300.000", "300.100");

    expect(replies).toHaveBeenCalled();
    expect(newReplies).toHaveLength(1);
    expect(newReplies[0].text).toBe("new reply");
    expect(newReplies[0].authorId).toBe("U3");
  });

  it("fetcher.fetchMedia throws when no token is available", async () => {
    const clientWithoutToken = makeClient();
    clientWithoutToken.token = undefined;
    const sc = buildSlackStructuredContext(baseDmParams({ client: clientWithoutToken }));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await expect(sc.fetcher.fetchMedia!("F123")).rejects.toThrow(
      "No client token available to fetch media.",
    );
  });

  it("fetcher.fetchMedia throws when file is not found", async () => {
    const clientWithToken = makeClient();
    clientWithToken.token = "xoxb-test";
    clientWithToken.files = {
      info: vi.fn().mockResolvedValue({ ok: true, file: null }),
    } as unknown as Parameters<typeof buildSlackStructuredContext>[0]["client"]["files"];

    const sc = buildSlackStructuredContext(baseDmParams({ client: clientWithToken }));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await expect(sc.fetcher.fetchMedia!("F123")).rejects.toThrow(
      "File not found or not downloadable.",
    );
  });
});
