import { describe, it, expect } from "vitest";
import {
  searchConversationHistory,
  formatMatchesForContext,
  createRecallConversationExecutor,
  type AgentMessage,
} from "./recall-conversation.js";

describe("searchConversationHistory", () => {
  const mockHistory: AgentMessage[] = [
    { role: "user", content: "My account number is 12345" },
    { role: "assistant", content: "Got it, account 12345" },
    { role: "user", content: "I need to update my address" },
    { role: "assistant", content: "What is your new address?" },
    { role: "user", content: "123 Main Street, New York" },
    { role: "assistant", content: "Address updated to 123 Main Street" },
    { role: "user", content: "Can you check my balance?" },
    { role: "assistant", content: "Your balance is $500" },
  ];

  it("finds messages matching a single keyword", () => {
    const matches = searchConversationHistory(mockHistory, "account");
    expect(matches.length).toBe(2);
    expect(matches[0].content).toContain("account");
  });

  it("finds messages matching multiple keywords", () => {
    const matches = searchConversationHistory(mockHistory, "address update");
    expect(matches.length).toBeGreaterThan(0);
    // Should find messages mentioning both address and update
    const contents = matches.map((m) => String(m.content).toLowerCase());
    const hasAddress = contents.some((c) => c.includes("address"));
    expect(hasAddress).toBe(true);
  });

  it("returns empty array when no matches", () => {
    const matches = searchConversationHistory(mockHistory, "xyz123nonsense");
    expect(matches).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const matches = searchConversationHistory(mockHistory, "the", 2);
    expect(matches.length).toBeLessThanOrEqual(2);
  });

  it("handles empty history", () => {
    const matches = searchConversationHistory([], "test");
    expect(matches).toEqual([]);
  });

  it("handles empty query", () => {
    const matches = searchConversationHistory(mockHistory, "");
    expect(matches).toEqual([]);
  });

  it("handles whitespace-only query", () => {
    const matches = searchConversationHistory(mockHistory, "   ");
    expect(matches).toEqual([]);
  });

  it("is case insensitive", () => {
    const matches = searchConversationHistory(mockHistory, "ACCOUNT");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("handles non-string content (JSON objects)", () => {
    const historyWithObject: AgentMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: { key: "value with account info" } },
    ];
    const matches = searchConversationHistory(historyWithObject, "account");
    expect(matches.length).toBe(1);
    expect(matches[0].role).toBe("assistant");
  });

  it("sorts by score (most matches first)", () => {
    const history: AgentMessage[] = [
      { role: "user", content: "account" },
      { role: "assistant", content: "account number is 12345 for the account" },
    ];
    const matches = searchConversationHistory(history, "account number");
    // The assistant message should come first since it has more keyword matches
    expect(matches[0].content).toContain("number");
  });
});

describe("formatMatchesForContext", () => {
  it("formats matches with role and content", () => {
    const matches: AgentMessage[] = [{ role: "user", content: "Hello world" }];
    const result = formatMatchesForContext(matches);
    expect(result).toContain("user:");
    expect(result).toContain("Hello world");
    expect(result).toContain("Found 1 relevant turn");
  });

  it("returns no-match message for empty array", () => {
    const result = formatMatchesForContext([]);
    expect(result).toBe("No relevant information found in earlier conversation.");
  });

  it("truncates long content", () => {
    const longContent = "x".repeat(600);
    const matches: AgentMessage[] = [{ role: "user", content: longContent }];
    const result = formatMatchesForContext(matches);
    expect(result.length).toBeLessThan(longContent.length + 200);
    expect(result).toContain("...");
  });

  it("numbers multiple matches", () => {
    const matches: AgentMessage[] = [
      { role: "user", content: "First message" },
      { role: "assistant", content: "Second message" },
    ];
    const result = formatMatchesForContext(matches);
    expect(result).toContain("[1]");
    expect(result).toContain("[2]");
    expect(result).toContain("Found 2 relevant turn");
  });

  it("handles non-string content", () => {
    const matches: AgentMessage[] = [{ role: "assistant", content: { data: "some value" } }];
    const result = formatMatchesForContext(matches);
    expect(result).toContain("assistant:");
    expect(result).toContain("some value");
  });
});

describe("createRecallConversationExecutor", () => {
  it("returns formatted search results", async () => {
    const executor = createRecallConversationExecutor({
      fullHistory: [
        { role: "user", content: "My name is John" },
        { role: "assistant", content: "Hello John!" },
      ],
    });

    const result = await executor({ query: "name John" });
    expect(result).toContain("John");
    expect(result).toContain("Found");
  });

  it("returns no-match message when nothing found", async () => {
    const executor = createRecallConversationExecutor({
      fullHistory: [{ role: "user", content: "Hello" }],
    });

    const result = await executor({ query: "xyz123" });
    expect(result).toBe("No relevant information found in earlier conversation.");
  });

  it("returns error message when query is empty", async () => {
    const executor = createRecallConversationExecutor({
      fullHistory: [{ role: "user", content: "Hello" }],
    });

    const result = await executor({ query: "" });
    expect(result).toContain("No query provided");
  });

  it("handles missing query property gracefully", async () => {
    const executor = createRecallConversationExecutor({
      fullHistory: [{ role: "user", content: "Hello" }],
    });

    const result = await executor({});
    expect(result).toContain("No query provided");
  });

  it("respects custom limit parameter", async () => {
    const executor = createRecallConversationExecutor({
      fullHistory: [
        { role: "user", content: "test message one" },
        { role: "assistant", content: "test response one" },
        { role: "user", content: "test message two" },
        { role: "assistant", content: "test response two" },
        { role: "user", content: "test message three" },
      ],
    });

    const result = await executor({ query: "test", limit: 2 });
    // Should only have 2 results in the output
    const matchCount = (result.match(/\[\d+\]/g) || []).length;
    expect(matchCount).toBe(2);
  });

  it("uses default limit of 5", async () => {
    const history: AgentMessage[] = [];
    for (let i = 0; i < 10; i++) {
      history.push({ role: "user", content: `test message ${i}` });
    }

    const executor = createRecallConversationExecutor({ fullHistory: history });
    const result = await executor({ query: "test" });

    // Should have at most 5 results
    const matchCount = (result.match(/\[\d+\]/g) || []).length;
    expect(matchCount).toBeLessThanOrEqual(5);
  });
});
