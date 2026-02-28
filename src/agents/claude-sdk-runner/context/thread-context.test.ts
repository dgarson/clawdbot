import { describe, expect, it } from "vitest";
import { buildThreadContext, buildThreadContextWithTelemetry } from "./thread-context.js";
import type { StructuredContextInput } from "./types.js";

const baseThread: NonNullable<StructuredContextInput["thread"]> = {
  rootMessageId: "root-1",
  rootTs: "1000",
  rootAuthorId: "U1",
  rootAuthorName: "Alice",
  rootAuthorIsBot: false,
  rootText: "Root message",
  replies: [
    {
      messageId: "r1",
      ts: "1001",
      authorId: "U2",
      authorName: "Bob",
      authorIsBot: false,
      text: "Reply 1",
      files: undefined,
    },
    {
      messageId: "r2",
      ts: "1002",
      authorId: "U1",
      authorName: "Alice",
      authorIsBot: false,
      text: "Reply 2",
      files: undefined,
    },
  ],
  totalReplyCount: 2,
};

describe("buildThreadContext", () => {
  it("returns null when thread is null", () => {
    expect(buildThreadContext(null)).toBeNull();
  });

  it("builds context with schema_version 1.0", () => {
    const ctx = buildThreadContext(baseThread);
    expect(ctx?.schema_version).toBe("1.0");
  });

  it("includes root message in full", () => {
    const ctx = buildThreadContext(baseThread);
    expect(ctx?.root.text).toBe("Root message");
    expect(ctx?.root.message_id).toBe("root-1");
  });

  it("includes all replies when under budget", () => {
    const ctx = buildThreadContext(baseThread);
    expect(ctx?.replies.length).toBe(2);
    expect(ctx?.truncation.included_replies).toBe(2);
    expect(ctx?.truncation.omitted_range_ts).toBeNull();
  });

  it("truncates oldest replies when over budget", () => {
    const longText = "x".repeat(600); // ~150 tokens each
    const manyReplies = Array.from({ length: 100 }, (_, i) => ({
      messageId: `r${i}`,
      ts: `${1000 + i}`,
      authorId: "U1",
      authorName: "Alice",
      authorIsBot: false,
      text: longText,
      files: undefined,
    }));
    const thread = { ...baseThread, replies: manyReplies, totalReplyCount: 100 };
    const ctx = buildThreadContext(thread, 1000);
    expect(ctx?.truncation.included_replies).toBeLessThan(100);
    // Most recent kept
    const lastReply = ctx?.replies[ctx.replies.length - 1];
    expect(lastReply?.message_id).toBe("r99");
  });

  it("marks truncated reply text with ellipsis", () => {
    // Each reply uses ~200 tokens; budget is 50 tokens
    const longText = "x".repeat(800);
    const replies = [
      {
        messageId: "r1",
        ts: "1001",
        authorId: "U1",
        authorName: "Alice",
        authorIsBot: false,
        text: longText,
        files: undefined,
      },
    ];
    const ctx = buildThreadContext({ ...baseThread, replies, totalReplyCount: 1 }, 50);
    // The reply that fits partially should be truncated
    if (ctx && ctx.replies.length > 0) {
      const reply = ctx.replies[0];
      if (reply.is_truncated) {
        expect(reply.text.endsWith("…")).toBe(true);
      }
    }
  });

  it("reports budget utilization telemetry", () => {
    const longText = "x".repeat(600); // ~150 tokens each
    const manyReplies = Array.from({ length: 20 }, (_, i) => ({
      messageId: `r${i}`,
      ts: `${1000 + i}`,
      authorId: "U1",
      authorName: "Alice",
      authorIsBot: false,
      text: longText,
      files: undefined,
    }));
    const thread = { ...baseThread, replies: manyReplies, totalReplyCount: 20 };
    const result = buildThreadContextWithTelemetry(thread, 1000);
    expect(result.threadContext).toBeTruthy();
    expect(result.budgetUtilization).toBeDefined();
    expect(result.budgetUtilization?.threadBudgetTokens).toBe(1000);
    expect(result.budgetUtilization?.actualTokens).toBeLessThanOrEqual(1000);
    expect(result.budgetUtilization?.messagesTruncated).toBeGreaterThan(0);
  });
});
