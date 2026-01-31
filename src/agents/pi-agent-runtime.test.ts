import { describe, expect, it } from "vitest";
import { createPiAgentRuntime } from "./pi-agent-runtime.js";

describe("createPiAgentRuntime", () => {
  it("creates a runtime with kind 'pi'", () => {
    const runtime = createPiAgentRuntime();
    expect(runtime.kind).toBe("pi");
  });

  it("creates a runtime with displayName 'Pi Agent'", () => {
    const runtime = createPiAgentRuntime();
    expect(runtime.displayName).toBe("Pi Agent");
  });

  it("has a run method", () => {
    const runtime = createPiAgentRuntime();
    expect(typeof runtime.run).toBe("function");
  });
});
