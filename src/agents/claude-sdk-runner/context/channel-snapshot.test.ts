import { describe, expect, it } from "vitest";
import { buildChannelSnapshot } from "./channel-snapshot.js";
import type { StructuredContextInput } from "./types.js";

const baseInput: StructuredContextInput = {
  platform: "slack",
  channelId: "C123",
  channelName: "general",
  anchor: {
    messageId: "1234.5678",
    ts: "1234.5678",
    authorId: "U1",
    authorName: "Alice",
    authorIsBot: false,
    text: "Hello world",
    threadId: null,
  },
  adjacentMessages: [],
  thread: null,
};

describe("buildChannelSnapshot", () => {
  it("builds snapshot with correct schema_version", () => {
    const snap = buildChannelSnapshot(baseInput);
    expect(snap.schema_version).toBe("1.0");
  });

  it("includes channel info", () => {
    const snap = buildChannelSnapshot(baseInput);
    expect(snap.channel.id).toBe("C123");
    expect(snap.channel.platform).toBe("slack");
  });

  it("includes full anchor text (never truncated)", () => {
    const longText = "x".repeat(5000);
    const snap = buildChannelSnapshot({
      ...baseInput,
      anchor: { ...baseInput.anchor, text: longText },
    });
    expect(snap.anchor.text).toBe(longText);
  });

  it("truncates adjacent message snippets to 150 chars", () => {
    const input: StructuredContextInput = {
      ...baseInput,
      adjacentMessages: [
        {
          messageId: "msg1",
          ts: "999",
          authorId: "U2",
          authorName: "Bob",
          authorIsBot: false,
          text: "a".repeat(200),
          threadId: null,
          replyCount: 0,
          hasMedia: false,
          reactions: [],
        },
      ],
    };
    const snap = buildChannelSnapshot(input);
    expect(snap.adjacent[0].snippet.length).toBeLessThanOrEqual(151); // 150 + ellipsis
  });

  it("excludes anchor message from adjacent list", () => {
    const input: StructuredContextInput = {
      ...baseInput,
      adjacentMessages: [
        {
          messageId: baseInput.anchor.messageId, // same as anchor
          ts: baseInput.anchor.ts,
          authorId: "U1",
          authorName: "Alice",
          authorIsBot: false,
          text: "Hello world",
          threadId: null,
          replyCount: 0,
          hasMedia: false,
          reactions: [],
        },
        {
          messageId: "other",
          ts: "1000",
          authorId: "U2",
          authorName: "Bob",
          authorIsBot: false,
          text: "Other",
          threadId: null,
          replyCount: 0,
          hasMedia: false,
          reactions: [],
        },
      ],
    };
    const snap = buildChannelSnapshot(input);
    expect(snap.adjacent.length).toBe(1);
    expect(snap.adjacent[0].message_id).toBe("other");
  });
});
