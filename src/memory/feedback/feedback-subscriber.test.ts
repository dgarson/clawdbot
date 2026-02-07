import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractMemorySearches,
  handleAgentEnd,
  configureMemoryFeedback,
  stopMemoryFeedbackSubscriber,
} from "./feedback-subscriber.js";

// ─── extractMemorySearches tests ────────────────────────────────────────────

describe("extractMemorySearches", () => {
  it("extracts a single memory_search from messages", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "What do you know about X?" }] },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tu-1", name: "memory_search", input: { query: "X context" } },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tu-1",
            content: JSON.stringify([
              {
                path: "memory/facts.md",
                startLine: 1,
                endLine: 5,
                score: 0.9,
                snippet: "X is...",
                source: "memory",
                sourceBackend: "builtin",
              },
            ]),
          },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Based on my memories, X is..." }],
      },
    ];

    const searches = extractMemorySearches(messages);
    expect(searches).toHaveLength(1);
    expect(searches[0].query).toBe("X context");
    expect(searches[0].results).toHaveLength(1);
    expect(searches[0].results[0].path).toBe("memory/facts.md");
    expect(searches[0].userPrompt).toBe("What do you know about X?");
    expect(searches[0].agentResponse).toContain("Based on my memories");
    expect(searches[0].backendAttribution).toEqual({ builtin: ["memory/facts.md"] });
  });

  it("extracts multiple memory_search calls", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "Tell me about A and B" }] },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tu-1", name: "memory_search", input: { query: "A" } },
          { type: "tool_use", id: "tu-2", name: "memory_search", input: { query: "B" } },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tu-1",
            content: JSON.stringify([
              {
                path: "memory/a.md",
                startLine: 1,
                endLine: 3,
                score: 0.8,
                snippet: "A...",
                source: "memory",
                sourceBackend: "graphiti",
              },
            ]),
          },
          {
            type: "tool_result",
            tool_use_id: "tu-2",
            content: JSON.stringify([
              {
                path: "memory/b.md",
                startLine: 1,
                endLine: 3,
                score: 0.7,
                snippet: "B...",
                source: "memory",
                sourceBackend: "progressive",
              },
            ]),
          },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "A is X and B is Y." }],
      },
    ];

    const searches = extractMemorySearches(messages);
    expect(searches).toHaveLength(2);
    expect(searches[0].query).toBe("A");
    expect(searches[1].query).toBe("B");
    expect(searches[0].backendAttribution).toEqual({ graphiti: ["memory/a.md"] });
    expect(searches[1].backendAttribution).toEqual({ progressive: ["memory/b.md"] });
  });

  it("skips non-memory_search tool_use blocks", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "Run code" }] },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "tu-1", name: "code_runner", input: { code: "1+1" } }],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "tu-1", content: "2" }],
      },
    ];

    const searches = extractMemorySearches(messages);
    expect(searches).toHaveLength(0);
  });

  it("skips memory_search with empty results", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "query" }] },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tu-1", name: "memory_search", input: { query: "nothing" } },
        ],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "tu-1", content: "[]" }],
      },
    ];

    const searches = extractMemorySearches(messages);
    expect(searches).toHaveLength(0);
  });

  it("handles results without sourceBackend (defaults to unknown)", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "query" }] },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tu-1", name: "memory_search", input: { query: "test" } },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tu-1",
            content: JSON.stringify([
              {
                path: "memory/x.md",
                startLine: 1,
                endLine: 2,
                score: 0.5,
                snippet: "...",
                source: "memory",
              },
            ]),
          },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "response" }],
      },
    ];

    const searches = extractMemorySearches(messages);
    expect(searches).toHaveLength(1);
    expect(searches[0].backendAttribution).toEqual({ unknown: ["memory/x.md"] });
  });

  it("handles tool result content as array of text blocks", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "query" }] },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "tu-1", name: "memory_search", input: { query: "test" } },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tu-1",
            content: [
              {
                type: "text",
                text: JSON.stringify([
                  {
                    path: "memory/y.md",
                    startLine: 1,
                    endLine: 2,
                    score: 0.6,
                    snippet: "...",
                    source: "memory",
                    sourceBackend: "builtin",
                  },
                ]),
              },
            ],
          },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "response" }],
      },
    ];

    const searches = extractMemorySearches(messages);
    expect(searches).toHaveLength(1);
    expect(searches[0].results[0].path).toBe("memory/y.md");
  });

  it("extracts thinking + text from agent response", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "question" }] },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "tu-1", name: "memory_search", input: { query: "q" } }],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "tu-1",
            content: JSON.stringify([
              {
                path: "memory/z.md",
                startLine: 1,
                endLine: 2,
                score: 0.5,
                snippet: "...",
                source: "memory",
              },
            ]),
          },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me think about this..." },
          { type: "text", text: "Here is the answer." },
        ],
      },
    ];

    const searches = extractMemorySearches(messages);
    expect(searches).toHaveLength(1);
    expect(searches[0].agentResponse).toContain("Let me think about this...");
    expect(searches[0].agentResponse).toContain("Here is the answer.");
  });
});

// ─── handleAgentEnd tests ───────────────────────────────────────────────────

describe("handleAgentEnd", () => {
  beforeEach(() => {
    stopMemoryFeedbackSubscriber();
  });

  afterEach(() => {
    stopMemoryFeedbackSubscriber();
  });

  it("does nothing when not configured", () => {
    // Should not throw even when evaluator is not configured
    expect(() =>
      handleAgentEnd({ messages: [], success: true }, { agentId: "main" }),
    ).not.toThrow();
  });

  it("does nothing when success is false", () => {
    configureMemoryFeedback({
      llmCall: vi.fn(),
      model: "test-model",
    });

    expect(() =>
      handleAgentEnd({ messages: [], success: false }, { agentId: "main" }),
    ).not.toThrow();
  });

  it("does nothing when no memory_search in messages", () => {
    configureMemoryFeedback({
      llmCall: vi.fn(),
      model: "test-model",
    });

    const messages = [
      { role: "user", content: [{ type: "text", text: "hello" }] },
      { role: "assistant", content: [{ type: "text", text: "hi" }] },
    ];

    expect(() => handleAgentEnd({ messages, success: true }, { agentId: "main" })).not.toThrow();
  });
});
