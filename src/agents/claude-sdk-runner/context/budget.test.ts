import { describe, expect, it } from "vitest";
import { applyThreadBudget, estimateTokens, SNIPPET_MAX_CHARS } from "./budget.js";

describe("estimateTokens", () => {
  it("estimates chars/4 rounded up", () => {
    expect(estimateTokens("hello")).toBe(2); // 5/4 = 1.25 → 2
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a".repeat(100))).toBe(25);
  });
});

describe("SNIPPET_MAX_CHARS", () => {
  it("is 150", () => {
    expect(SNIPPET_MAX_CHARS).toBe(150);
  });
});

describe("applyThreadBudget", () => {
  const makeReply = (text: string, i: number) => ({
    messageId: `msg-${i}`,
    ts: `${i}`,
    authorId: "U1",
    authorName: "Alice",
    authorIsBot: false,
    text,
    files: undefined,
  });

  it("includes all replies when under budget", () => {
    const replies = [makeReply("short", 1), makeReply("also short", 2)];
    const result = applyThreadBudget({ replies, budgetTokens: 8000 });
    expect(result.included.length).toBe(2);
    expect(result.truncation.omitted_range_ts).toBeNull();
  });

  it("trims oldest replies to fit budget", () => {
    const longText = "x".repeat(200); // 50 tokens each
    const replies = Array.from({ length: 200 }, (_, i) => makeReply(longText, i));
    const result = applyThreadBudget({ replies, budgetTokens: 1000 });
    expect(result.included.length).toBeLessThan(200);
    // Most recent replies kept
    const lastIncluded = result.included[result.included.length - 1];
    expect(lastIncluded.messageId).toBe("msg-199");
    expect(result.truncation.omitted_range_ts).not.toBeNull();
  });
});
