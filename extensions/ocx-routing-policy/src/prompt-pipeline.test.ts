import { describe, expect, it } from "vitest";
import { composePrompt, buildPromptContext } from "./prompt-pipeline.js";
import type { PromptContributor, PromptContext } from "./types.js";

// Helper to create a contributor with minimal boilerplate.
function contrib(
  overrides: Partial<PromptContributor> & { id: string; content: string },
): PromptContributor {
  return {
    priority: 0,
    conditions: [],
    optional: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Condition matching (tested via composePrompt filtering)
// ---------------------------------------------------------------------------

describe("prompt condition - agent", () => {
  it("includes contributor when agentId matches", () => {
    const c = contrib({
      id: "c1",
      content: "Agent prompt",
      conditions: [{ kind: "agent", agentId: "a1" }],
    });
    const ctx: PromptContext = { agentId: "a1", sessionKey: "s1" };
    expect(composePrompt([c], ctx)).toBe("Agent prompt");
  });

  it("excludes contributor when agentId differs", () => {
    const c = contrib({
      id: "c1",
      content: "Agent prompt",
      conditions: [{ kind: "agent", agentId: "a1" }],
    });
    const ctx: PromptContext = { agentId: "a2", sessionKey: "s1" };
    expect(composePrompt([c], ctx)).toBeUndefined();
  });
});

describe("prompt condition - channel", () => {
  it("includes contributor when channel matches", () => {
    const c = contrib({
      id: "c1",
      content: "Channel prompt",
      conditions: [{ kind: "channel", channel: "telegram" }],
    });
    const ctx: PromptContext = { agentId: "a1", sessionKey: "s1", channel: "telegram" };
    expect(composePrompt([c], ctx)).toBe("Channel prompt");
  });

  it("excludes contributor when channel differs", () => {
    const c = contrib({
      id: "c1",
      content: "Channel prompt",
      conditions: [{ kind: "channel", channel: "telegram" }],
    });
    const ctx: PromptContext = { agentId: "a1", sessionKey: "s1", channel: "discord" };
    expect(composePrompt([c], ctx)).toBeUndefined();
  });
});

describe("prompt condition - classification", () => {
  it("includes contributor when classification matches", () => {
    const c = contrib({
      id: "c1",
      content: "Code prompt",
      conditions: [{ kind: "classification", label: "code" }],
    });
    const ctx: PromptContext = { agentId: "a1", sessionKey: "s1", classification: "code" };
    expect(composePrompt([c], ctx)).toBe("Code prompt");
  });

  it("excludes contributor when classification differs", () => {
    const c = contrib({
      id: "c1",
      content: "Code prompt",
      conditions: [{ kind: "classification", label: "code" }],
    });
    const ctx: PromptContext = { agentId: "a1", sessionKey: "s1", classification: "simple" };
    expect(composePrompt([c], ctx)).toBeUndefined();
  });
});

describe("prompt condition - has_tool", () => {
  it("includes contributor when tool is present", () => {
    const c = contrib({
      id: "c1",
      content: "Tool prompt",
      conditions: [{ kind: "has_tool", toolName: "search" }],
    });
    const ctx: PromptContext = {
      agentId: "a1",
      sessionKey: "s1",
      toolNames: ["search", "read"],
    };
    expect(composePrompt([c], ctx)).toBe("Tool prompt");
  });

  it("excludes contributor when tool is absent", () => {
    const c = contrib({
      id: "c1",
      content: "Tool prompt",
      conditions: [{ kind: "has_tool", toolName: "search" }],
    });
    const ctx: PromptContext = {
      agentId: "a1",
      sessionKey: "s1",
      toolNames: ["read", "write"],
    };
    expect(composePrompt([c], ctx)).toBeUndefined();
  });

  it("excludes contributor when toolNames is undefined", () => {
    const c = contrib({
      id: "c1",
      content: "Tool prompt",
      conditions: [{ kind: "has_tool", toolName: "search" }],
    });
    const ctx: PromptContext = { agentId: "a1", sessionKey: "s1" };
    expect(composePrompt([c], ctx)).toBeUndefined();
  });
});

describe("prompt condition - session_type", () => {
  it("includes contributor when session type matches", () => {
    const c = contrib({
      id: "c1",
      content: "Subagent prompt",
      conditions: [{ kind: "session_type", type: "subagent" }],
    });
    const ctx: PromptContext = {
      agentId: "a1",
      sessionKey: "s1",
      sessionType: "subagent",
    };
    expect(composePrompt([c], ctx)).toBe("Subagent prompt");
  });

  it("excludes contributor when session type differs", () => {
    const c = contrib({
      id: "c1",
      content: "Subagent prompt",
      conditions: [{ kind: "session_type", type: "subagent" }],
    });
    const ctx: PromptContext = {
      agentId: "a1",
      sessionKey: "s1",
      sessionType: "main",
    };
    expect(composePrompt([c], ctx)).toBeUndefined();
  });

  it("excludes contributor when sessionType is undefined", () => {
    const c = contrib({
      id: "c1",
      content: "Cron prompt",
      conditions: [{ kind: "session_type", type: "cron" }],
    });
    const ctx: PromptContext = { agentId: "a1", sessionKey: "s1" };
    expect(composePrompt([c], ctx)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Sorting by priority
// ---------------------------------------------------------------------------

describe("contributor sorting by priority", () => {
  it("sorts contributors by priority (lower first)", () => {
    const c1 = contrib({ id: "c1", content: "First", priority: 0 });
    const c2 = contrib({ id: "c2", content: "Second", priority: 10 });
    const c3 = contrib({ id: "c3", content: "Third", priority: 5 });
    const ctx: PromptContext = { agentId: "a1", sessionKey: "s1" };
    // Should order: c1 (0), c3 (5), c2 (10)
    expect(composePrompt([c2, c3, c1], ctx)).toBe("First\n\nThird\n\nSecond");
  });
});

// ---------------------------------------------------------------------------
// Token budget: optional vs required
// ---------------------------------------------------------------------------

describe("token budget with optional contributors", () => {
  it("includes required contributors even when budget is tight", () => {
    const required = contrib({ id: "req", content: "Required", priority: 0, optional: false });
    const optional = contrib({
      id: "opt",
      content: "Optional extra content that uses tokens",
      priority: 1,
      optional: true,
    });
    const ctx: PromptContext = {
      agentId: "a1",
      sessionKey: "s1",
      // Budget enough for required only (~8 chars = ~2 tokens)
      tokenBudget: 5,
    };
    const result = composePrompt([required, optional], ctx);
    expect(result).toBe("Required");
  });

  it("includes optional contributors when budget allows", () => {
    const required = contrib({ id: "req", content: "R", priority: 0, optional: false });
    const optional = contrib({ id: "opt", content: "O", priority: 1, optional: true });
    const ctx: PromptContext = {
      agentId: "a1",
      sessionKey: "s1",
      tokenBudget: 1000,
    };
    const result = composePrompt([required, optional], ctx);
    expect(result).toBe("R\n\nO");
  });

  it("strips optional contributors from lowest priority when budget exceeded", () => {
    const req = contrib({ id: "req", content: "A", priority: 0, optional: false });
    const opt1 = contrib({ id: "opt1", content: "B", priority: 1, optional: true });
    const opt2 = contrib({ id: "opt2", content: "C".repeat(100), priority: 2, optional: true });
    const ctx: PromptContext = {
      agentId: "a1",
      sessionKey: "s1",
      // Budget enough for req + opt1 but not opt2
      tokenBudget: 5,
    };
    const result = composePrompt([req, opt1, opt2], ctx);
    expect(result).toBe("A\n\nB");
  });
});

// ---------------------------------------------------------------------------
// composePrompt: join with double newline
// ---------------------------------------------------------------------------

describe("composePrompt join", () => {
  it("joins multiple contributors with double newline", () => {
    const c1 = contrib({ id: "c1", content: "Hello", priority: 0 });
    const c2 = contrib({ id: "c2", content: "World", priority: 1 });
    const ctx: PromptContext = { agentId: "a1", sessionKey: "s1" };
    expect(composePrompt([c1, c2], ctx)).toBe("Hello\n\nWorld");
  });

  it("returns undefined when no contributors match", () => {
    const c = contrib({
      id: "c1",
      content: "Nope",
      conditions: [{ kind: "agent", agentId: "x" }],
    });
    const ctx: PromptContext = { agentId: "a1", sessionKey: "s1" };
    expect(composePrompt([c], ctx)).toBeUndefined();
  });

  it("returns content for a single contributor (no extra newlines)", () => {
    const c = contrib({ id: "c1", content: "Solo" });
    const ctx: PromptContext = { agentId: "a1", sessionKey: "s1" };
    expect(composePrompt([c], ctx)).toBe("Solo");
  });

  it("includes contributors with empty conditions (always included)", () => {
    const c = contrib({ id: "c1", content: "Always", conditions: [] });
    const ctx: PromptContext = { agentId: "a1", sessionKey: "s1" };
    expect(composePrompt([c], ctx)).toBe("Always");
  });
});

// ---------------------------------------------------------------------------
// buildPromptContext
// ---------------------------------------------------------------------------

describe("buildPromptContext", () => {
  it("builds context from hook inputs", () => {
    const ctx = buildPromptContext(
      { agentId: "a1", sessionKey: "s1", messageProvider: "telegram" },
      "code",
      1000,
      ["search", "read"],
      "main",
    );
    expect(ctx.agentId).toBe("a1");
    expect(ctx.sessionKey).toBe("s1");
    expect(ctx.channel).toBe("telegram");
    expect(ctx.classification).toBe("code");
    expect(ctx.tokenBudget).toBe(1000);
    expect(ctx.toolNames).toEqual(["search", "read"]);
    expect(ctx.sessionType).toBe("main");
  });

  it("provides defaults for missing fields", () => {
    const ctx = buildPromptContext({});
    expect(ctx.agentId).toBe("");
    expect(ctx.sessionKey).toBe("");
    expect(ctx.channel).toBeUndefined();
    expect(ctx.classification).toBeUndefined();
    expect(ctx.tokenBudget).toBeUndefined();
    expect(ctx.toolNames).toBeUndefined();
    expect(ctx.sessionType).toBeUndefined();
  });
});
