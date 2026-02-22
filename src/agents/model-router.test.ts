import { describe, expect, it } from "vitest";
import {
  classifyPromptIntent,
  resolveDynamicModelRoute,
  type ModelRoutingConfig,
} from "./model-router.js";

describe("classifyPromptIntent", () => {
  it("classifies short fact and lookup prompts as simple", () => {
    const result = classifyPromptIntent("What is the capital of France?");
    expect(result.intent).toBe("simple");
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.scores.simple).toBeGreaterThan(result.scores.coding);
  });

  it("classifies coding tasks as coding intent", () => {
    const result = classifyPromptIntent(
      "Can you write a Python script to parse CSV and implement a new API?",
    );
    expect(result.intent).toBe("coding");
    expect(result.scores.coding).toBeGreaterThan(result.scores.simple);
  });

  it("classifies security-sensitive prompts as critical", () => {
    const result = classifyPromptIntent(
      "We need to plan the security incident response and audit requirements.",
    );
    expect(result.intent).toBe("critical");
    expect(result.scores.critical).toBeGreaterThan(result.scores.analysis);
  });
});

describe("resolveDynamicModelRoute", () => {
  const defaultConfig: ModelRoutingConfig = {
    enabled: true,
    fallbackModel: "provider-b/fallback-small",
    rules: [
      {
        id: "routing-coding",
        intent: "coding",
        model: "provider-c/coding-model",
      },
      {
        id: "routing-critical",
        intent: "critical",
        model: "provider-d/critical-model",
      },
    ],
  };

  it("uses the route matching the classified intent", () => {
    const decision = resolveDynamicModelRoute({
      prompt: "Implement a refactor and fix this TypeScript function.",
      defaultProvider: "provider-a",
      defaultModel: "default-model",
      config: { agents: { defaults: { modelRouting: defaultConfig } } },
    });

    expect(decision).toMatchObject({
      provider: "provider-c",
      model: "coding-model",
      intent: "coding",
      reason: "route",
    });
  });

  it("falls back when no explicit intent rule matches", () => {
    const decision = resolveDynamicModelRoute({
      prompt: "Can you list the top three priorities for tomorrow?",
      defaultProvider: "provider-a",
      defaultModel: "default-model",
      config: { agents: { defaults: { modelRouting: defaultConfig } } },
    });

    expect(decision).toMatchObject({
      provider: "provider-b",
      model: "fallback-small",
      intent: "simple",
      reason: "fallback",
    });
  });

  it("returns null when routing disabled", () => {
    const decision = resolveDynamicModelRoute({
      prompt: "Implement a new API endpoint and test it.",
      defaultProvider: "provider-a",
      defaultModel: "default-model",
      config: {
        agents: {
          defaults: {
            modelRouting: {
              enabled: false,
              fallbackModel: "provider-b/fallback-small",
            },
          },
        },
      },
    });
    expect(decision).toBeNull();
  });
});
