import { describe, expect, it } from "vitest";
import { createClaudeMaxStubModel } from "./claude-max-model.js";

describe("createClaudeMaxStubModel", () => {
  it("returns a Model-like object with the given modelId", () => {
    const model = createClaudeMaxStubModel("claude-sonnet-4-20250514");
    expect(model.provider).toBe("claude-max");
    expect(model.id).toBe("claude-sonnet-4-20250514");
    expect(model.contextWindow).toBeGreaterThan(0);
    expect(model.api).toBe("anthropic");
  });

  it("defaults context window to 200000", () => {
    const model = createClaudeMaxStubModel("claude-opus-4-6");
    expect(model.contextWindow).toBe(200_000);
  });
});
