import { describe, expect, it, vi } from "vitest";
import type { AgentRuntime } from "../../agents/agent-runtime.js";

describe("PiRuntimeAdapter", () => {
  it("implements AgentRuntime interface", async () => {
    const { createPiRuntimeAdapter } = await import("./pi-runtime-adapter.js");

    const mockSession = {
      subscribe: vi.fn(() => vi.fn()),
      prompt: vi.fn(async () => {}),
      steer: vi.fn(async () => {}),
      abort: vi.fn(),
      abortCompaction: vi.fn(),
      dispose: vi.fn(),
      isStreaming: false,
      isCompacting: false,
      messages: [],
      sessionId: "test-session",
      agent: {
        streamFn: vi.fn(),
        replaceMessages: vi.fn(),
      },
    };

    const adapter: AgentRuntime = createPiRuntimeAdapter({
      session: mockSession as never,
      runtimeHints: {
        allowSyntheticToolResults: true,
        enforceFinalTag: true,
      },
    });

    expect(adapter.sessionId).toBe("test-session");
    expect(adapter.runtimeHints.allowSyntheticToolResults).toBe(true);
    expect(adapter.runtimeHints.enforceFinalTag).toBe(true);

    adapter.replaceMessages([]);
    expect(mockSession.agent.replaceMessages).toHaveBeenCalledWith([]);

    void adapter.abort();
    expect(mockSession.abort).toHaveBeenCalled();
  });
});
