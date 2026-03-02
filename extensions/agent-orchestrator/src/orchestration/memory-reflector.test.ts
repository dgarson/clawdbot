import { describe, expect, it, vi } from "vitest";
import type { MemoryFeedbackConfig } from "../types.js";
import type { AnthropicClientLike } from "./memory-reflector.js";

vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    appendFile: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockSessionManager = {
  appendCustomEntry: vi.fn(),
};

vi.mock("@mariozechner/pi-coding-agent", () => ({
  SessionManager: {
    open: vi.fn().mockReturnValue(mockSessionManager),
  },
}));

function makeMockClient(overrides?: { content?: unknown[] }): AnthropicClientLike {
  const defaultContent = [
    {
      type: "tool_use",
      name: "memory_feedback",
      input: {
        would_have_helped: [
          {
            query: "project auth pattern",
            why: "Would have saved research time",
            confidence: 0.9,
          },
        ],
        should_store: [
          {
            name: "auth-decision",
            body: "We use JWT",
            group: "test-architecture",
            confidence: 0.95,
          },
        ],
      },
    },
  ];
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: overrides?.content ?? defaultContent,
        stop_reason: "tool_use",
      }),
    },
  };
}

const baseCtx = { agentId: "a1", sessionKey: "sk1", runId: "r1", stateDir: "/tmp/test" };

describe("runMemoryReflector", () => {
  const config: MemoryFeedbackConfig = {
    enabled: true,
    model: "claude-haiku-4-5-20251001",
    autoWriteThreshold: 0.85,
    maxContextMessages: 50,
  };

  // ── Early-exit / negative ────────────────────────────────────────────────

  it("returns undefined when disabled", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const result = await runMemoryReflector({ ...config, enabled: false }, baseCtx, {
      assistantTexts: ["hello"],
      toolMetas: [],
      messages: [],
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined when both assistantTexts and toolMetas are empty", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const result = await runMemoryReflector(config, baseCtx, {
      assistantTexts: [],
      toolMetas: [],
      messages: [],
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined when Anthropic response has no tool_use block", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const client = makeMockClient({
      content: [{ type: "text", text: "I cannot help with that." }],
    });
    const result = await runMemoryReflector(
      config,
      baseCtx,
      { assistantTexts: ["did some work"], toolMetas: [], messages: [] },
      client,
    );
    expect(result).toBeUndefined();
  });

  it("returns undefined when tool_use block has wrong tool name", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const client = makeMockClient({
      content: [{ type: "tool_use", name: "something_else", input: {} }],
    });
    const result = await runMemoryReflector(
      config,
      baseCtx,
      { assistantTexts: ["did some work"], toolMetas: [], messages: [] },
      client,
    );
    expect(result).toBeUndefined();
  });

  // ── Threshold / boundary ─────────────────────────────────────────────────

  it("runs when only toolMetas is provided (empty assistantTexts)", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const client = makeMockClient();
    const result = await runMemoryReflector(
      config,
      baseCtx,
      {
        assistantTexts: [],
        toolMetas: [{ toolName: "read_file", meta: "src/foo.ts" }],
        messages: [],
      },
      client,
    );
    expect(result).toBeDefined();
  });

  it("runs when only assistantTexts is provided (empty toolMetas)", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const client = makeMockClient();
    const result = await runMemoryReflector(
      config,
      baseCtx,
      { assistantTexts: ["I researched the codebase"], toolMetas: [], messages: [] },
      client,
    );
    expect(result).toBeDefined();
  });

  it("accepts feedback result with empty arrays", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const client = makeMockClient({
      content: [
        {
          type: "tool_use",
          name: "memory_feedback",
          input: { would_have_helped: [], should_store: [] },
        },
      ],
    });
    const result = await runMemoryReflector(
      config,
      baseCtx,
      { assistantTexts: ["quick task done"], toolMetas: [], messages: [] },
      client,
    );
    expect(result).toBeDefined();
    expect(result?.would_have_helped).toHaveLength(0);
    expect(result?.should_store).toHaveLength(0);
  });

  // ── Happy path ───────────────────────────────────────────────────────────

  it("returns structured feedback from Anthropic response", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const result = await runMemoryReflector(
      config,
      baseCtx,
      {
        assistantTexts: ["I investigated the auth system and found JWT is used"],
        toolMetas: [{ toolName: "read_file", meta: "src/auth.ts" }],
        messages: [],
      },
      makeMockClient(),
    );
    expect(result).toBeDefined();
    expect(result?.would_have_helped).toHaveLength(1);
    expect(result?.would_have_helped[0].query).toBe("project auth pattern");
    expect(result?.would_have_helped[0].confidence).toBe(0.9);
    expect(result?.should_store).toHaveLength(1);
    expect(result?.should_store[0].name).toBe("auth-decision");
    expect(result?.should_store[0].group).toBe("test-architecture");
  });

  it("creates memory-feedback directory before writing", async () => {
    const fs = await import("node:fs/promises");
    const { runMemoryReflector } = await import("./memory-reflector.js");
    vi.clearAllMocks();

    await runMemoryReflector(
      config,
      baseCtx,
      { assistantTexts: ["work done"], toolMetas: [], messages: [] },
      makeMockClient(),
    );

    expect(fs.default.mkdir).toHaveBeenCalledWith(expect.stringContaining("memory-feedback"), {
      recursive: true,
    });
  });

  it("writes queue file with correct agentId and runId in path and payload", async () => {
    const fs = await import("node:fs/promises");
    const { runMemoryReflector } = await import("./memory-reflector.js");
    vi.clearAllMocks();

    await runMemoryReflector(
      config,
      { agentId: "builder-1", sessionKey: "sk-b", runId: "run-xyz", stateDir: "/state" },
      {
        assistantTexts: ["completed task"],
        toolMetas: [{ toolName: "bash", meta: "ls" }],
        messages: [],
      },
      makeMockClient(),
    );

    const [filePath, payload] = (fs.default.appendFile as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, string];
    expect(filePath).toContain("builder-1");
    expect(filePath).toContain("run-xyz");
    expect(filePath).toContain("memory-feedback");
    const parsed = JSON.parse(payload.trim());
    expect(parsed.agentId).toBe("builder-1");
    expect(parsed.runId).toBe("run-xyz");
    expect(parsed.sessionKey).toBe("sk-b");
    expect(parsed.timestamp).toBeTypeOf("number");
    expect(parsed.feedback).toBeDefined();
  });

  it("writes to session transcript when sessionFile is provided", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const piCodingAgent = await import("@mariozechner/pi-coding-agent");
    vi.clearAllMocks();

    await runMemoryReflector(
      config,
      baseCtx,
      {
        assistantTexts: ["checked auth"],
        toolMetas: [],
        messages: [],
        sessionFile: "/sessions/a1.jsonl",
      },
      makeMockClient(),
    );

    expect(piCodingAgent.SessionManager.open).toHaveBeenCalledWith("/sessions/a1.jsonl");
    expect(mockSessionManager.appendCustomEntry).toHaveBeenCalledWith(
      "openclaw:memory-reflection",
      expect.objectContaining({
        would_have_helped: expect.any(Array),
        should_store: expect.any(Array),
      }),
    );
  });

  it("does not call SessionManager when sessionFile is not provided", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const piCodingAgent = await import("@mariozechner/pi-coding-agent");
    vi.clearAllMocks();

    await runMemoryReflector(
      config,
      baseCtx,
      { assistantTexts: ["work done"], toolMetas: [], messages: [] },
      makeMockClient(),
    );

    expect(piCodingAgent.SessionManager.open).not.toHaveBeenCalled();
    expect(mockSessionManager.appendCustomEntry).not.toHaveBeenCalled();
  });

  it("swallows SessionManager errors without propagating", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const piCodingAgent = await import("@mariozechner/pi-coding-agent");
    vi.clearAllMocks();
    (piCodingAgent.SessionManager.open as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("session file gone");
    });

    // Should not throw — SessionManager errors are swallowed as non-fatal
    const result = await runMemoryReflector(
      config,
      baseCtx,
      {
        assistantTexts: ["did some work"],
        toolMetas: [],
        messages: [],
        sessionFile: "/sessions/gone.jsonl",
      },
      makeMockClient(),
    );

    // Result is still returned even if session write failed
    expect(result).toBeDefined();
  });

  it("passes model from config to Anthropic create call", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const client = makeMockClient();
    await runMemoryReflector(
      { ...config, model: "claude-opus-4-6" },
      baseCtx,
      { assistantTexts: ["did work"], toolMetas: [], messages: [] },
      client,
    );
    expect(client.messages.create as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-opus-4-6" }),
    );
  });
});
