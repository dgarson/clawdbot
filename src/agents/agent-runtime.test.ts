import { describe, expect, it } from "vitest";
import type { AgentRuntime, AgentRuntimeHints } from "./agent-runtime.js";

describe("AgentRuntime interface", () => {
  it("can be satisfied by a minimal mock object", () => {
    const hints: AgentRuntimeHints = {
      allowSyntheticToolResults: true,
      enforceFinalTag: true,
    };
    const mock: AgentRuntime = {
      subscribe: () => () => {},
      prompt: async () => {},
      steer: async () => {},
      abort: async () => {},
      abortCompaction: () => {},
      dispose: () => {},
      replaceMessages: () => {},
      isStreaming: false,
      isCompacting: false,
      messages: [],
      sessionId: "test-session",
      runtimeHints: hints,
    };
    expect(mock.runtimeHints.allowSyntheticToolResults).toBe(true);
    expect(mock.runtimeHints.enforceFinalTag).toBe(true);
    expect(mock.sessionId).toBe("test-session");
  });
});
