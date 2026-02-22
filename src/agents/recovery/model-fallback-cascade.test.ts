import { describe, expect, it } from "vitest";
import {
  buildModelFallbackCascade,
  ModelFallbackCascadeError,
  runModelFallbackCascade,
} from "./model-fallback-cascade.js";

describe("model-fallback-cascade", () => {
  it("builds a cascade with primary first and priority-sorted fallbacks", () => {
    const cascade = buildModelFallbackCascade({
      primary: { provider: "openrouter", model: "minimax" },
      fallbacks: [
        { provider: "openrouter", model: "claude-haiku" },
        { provider: "openrouter", model: "glm-5" },
      ],
      priorityByModelKey: {
        "openrouter/claude-haiku": 20,
        "openrouter/glm-5": 10,
      },
    });

    expect(cascade.map((candidate) => candidate.key)).toEqual([
      "openrouter/minimax",
      "openrouter/glm-5",
      "openrouter/claude-haiku",
    ]);
  });

  it("deduplicates fallback models", () => {
    const cascade = buildModelFallbackCascade({
      primary: { provider: "openrouter", model: "minimax" },
      fallbacks: [
        { provider: "openrouter", model: "glm-5" },
        { provider: "openrouter", model: "glm-5" },
      ],
    });

    expect(cascade).toHaveLength(2);
    expect(cascade[1]?.key).toBe("openrouter/glm-5");
  });

  it("falls back when a model throws", async () => {
    const attempts: string[] = [];

    const result = await runModelFallbackCascade({
      config: {
        primary: { provider: "openrouter", model: "minimax" },
        fallbacks: [{ provider: "openrouter", model: "glm-5" }],
      },
      runModel: async (candidate) => {
        attempts.push(candidate.key);
        if (candidate.model === "minimax") {
          throw new Error("rate limited");
        }
        return "glm-ok";
      },
    });

    expect(result.value).toBe("glm-ok");
    expect(result.selected.key).toBe("openrouter/glm-5");
    expect(result.failures).toHaveLength(1);
    expect(attempts).toEqual(["openrouter/minimax", "openrouter/glm-5"]);
  });

  it("falls back when a model returns invalid output", async () => {
    const result = await runModelFallbackCascade({
      config: {
        primary: { provider: "openrouter", model: "minimax" },
        fallbacks: [{ provider: "openrouter", model: "glm-5" }],
      },
      runModel: async (candidate) => (candidate.model === "minimax" ? "garbage" : "clean"),
      isValidResponse: (value) => value !== "garbage",
    });

    expect(result.value).toBe("clean");
    expect(result.failures[0]?.reason).toBe("invalid_response");
  });

  it("throws structured cascade error when all models fail", async () => {
    await expect(
      runModelFallbackCascade({
        config: {
          primary: { provider: "openrouter", model: "minimax" },
          fallbacks: [{ provider: "openrouter", model: "glm-5" }],
        },
        runModel: async () => {
          throw new Error("boom");
        },
      }),
    ).rejects.toBeInstanceOf(ModelFallbackCascadeError);
  });
});
