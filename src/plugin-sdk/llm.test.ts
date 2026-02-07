import { describe, expect, it } from "vitest";
import { completeTextWithModelRef, probeModelRefAuth } from "./llm.js";

describe("plugin-sdk llm helpers", () => {
  it("throws for invalid model refs", async () => {
    await expect(
      completeTextWithModelRef({
        cfg: {},
        modelRef: "foo/",
        prompt: "hi",
        timeoutMs: 10,
        maxTokens: 1,
      }),
    ).rejects.toThrow(/Invalid model ref/i);
  });

  it("reports invalid model refs in probeModelRefAuth", async () => {
    const res = await probeModelRefAuth({ cfg: {}, modelRef: "foo/" });
    expect(res.ok).toBe(false);
    expect(res.hasKey).toBe(false);
    expect(res.error).toMatch(/Invalid model ref/i);
  });

  it("throws when model cannot be resolved", async () => {
    await expect(
      completeTextWithModelRef({
        cfg: {},
        modelRef: "madeup/madeup",
        prompt: "hi",
        timeoutMs: 10,
        maxTokens: 1,
      }),
    ).rejects.toThrow();
  });
});
