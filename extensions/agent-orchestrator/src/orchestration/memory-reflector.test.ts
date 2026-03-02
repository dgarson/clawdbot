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

function makeMockClient(): AnthropicClientLike {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
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
        ],
        stop_reason: "tool_use",
      }),
    },
  };
}

describe("runMemoryReflector", () => {
  const config: MemoryFeedbackConfig = {
    enabled: true,
    model: "claude-haiku-4-5-20251001",
    autoWriteThreshold: 0.85,
    maxContextMessages: 50,
  };

  it("returns early if not enabled", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const result = await runMemoryReflector(
      { ...config, enabled: false },
      { agentId: "a1", sessionKey: "sk1", runId: "r1", stateDir: "/tmp/test" },
      { assistantTexts: ["hello"], toolMetas: [], messages: [] },
    );
    expect(result).toBeUndefined();
  });

  it("returns early if no meaningful content", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const result = await runMemoryReflector(
      config,
      { agentId: "a1", sessionKey: "sk1", runId: "r1", stateDir: "/tmp/test" },
      { assistantTexts: [], toolMetas: [], messages: [] },
    );
    expect(result).toBeUndefined();
  });

  it("calls Anthropic SDK and returns feedback", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const result = await runMemoryReflector(
      config,
      { agentId: "a1", sessionKey: "sk1", runId: "r1", stateDir: "/tmp/test" },
      {
        assistantTexts: ["I investigated the auth system and found JWT is used"],
        toolMetas: [{ toolName: "read_file", meta: "src/auth.ts" }],
        messages: [],
      },
      makeMockClient(),
    );
    expect(result).toBeDefined();
    expect(result?.would_have_helped).toHaveLength(1);
    expect(result?.should_store).toHaveLength(1);
    expect(result?.should_store[0].name).toBe("auth-decision");
  });

  it("writes feedback to queue file", async () => {
    const fs = await import("node:fs/promises");
    const { runMemoryReflector } = await import("./memory-reflector.js");
    vi.clearAllMocks();

    await runMemoryReflector(
      config,
      { agentId: "a1", sessionKey: "sk1", runId: "r1", stateDir: "/tmp/test" },
      {
        assistantTexts: ["completed task"],
        toolMetas: [{ toolName: "bash", meta: "ls" }],
        messages: [],
      },
      makeMockClient(),
    );

    expect(fs.default.appendFile).toHaveBeenCalledWith(
      expect.stringContaining("memory-feedback"),
      expect.stringContaining('"agentId":"a1"'),
    );
  });
});
