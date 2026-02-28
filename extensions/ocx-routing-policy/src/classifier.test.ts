import { describe, expect, it } from "vitest";
import { classify, classifyHeuristic, classifyLLM } from "./classifier.js";
import { resolveConfig } from "./config.js";
import type { ClassifierInput } from "./types.js";

const defaultConfig = resolveConfig(undefined);

describe("classifyHeuristic", () => {
  it("detects code with fenced code blocks", () => {
    const input: ClassifierInput = { text: "Here is some code:\n```\nconst x = 1;\n```\nDone." };
    const result = classifyHeuristic(input);
    expect(result.label).toBe("code");
    expect(result.confidence).toBe(0.7);
    expect(result.method).toBe("heuristic");
  });

  it("detects code with keywords (function, class, import, export)", () => {
    const result = classifyHeuristic({ text: "Please write a function to sort an array" });
    expect(result.label).toBe("code");
  });

  it("detects complex from long text (>2000 chars)", () => {
    const longText = "a".repeat(2100);
    const result = classifyHeuristic({ text: longText });
    expect(result.label).toBe("complex");
    expect(result.confidence).toBe(0.6);
  });

  it("detects complex from many lines (>20)", () => {
    const multiLine = Array.from({ length: 25 }, (_, i) => `Line ${i}`).join("\n");
    const result = classifyHeuristic({ text: multiLine });
    expect(result.label).toBe("complex");
  });

  it("detects multi-step with sequential keywords and length > 500", () => {
    const text = `Please do the following: first set up the project, then install dependencies, after that configure the database. ${" ".repeat(500)}`;
    const result = classifyHeuristic({ text });
    expect(result.label).toBe("multi-step");
    expect(result.confidence).toBe(0.5);
  });

  it("falls back to simple for short messages", () => {
    const result = classifyHeuristic({ text: "Hello, how are you?" });
    expect(result.label).toBe("simple");
    expect(result.confidence).toBe(0.4);
  });

  it("prioritizes code over complex (code check runs first)", () => {
    // Long text with code keyword
    const result = classifyHeuristic({ text: "export " + "x".repeat(2100) });
    expect(result.label).toBe("code");
  });
});

describe("classifyLLM", () => {
  it("returns a classification result with llm method", async () => {
    const result = await classifyLLM({ text: "Hello world" }, defaultConfig);
    expect(result.method).toBe("llm");
    expect(result.confidence).toBe(0.85);
    expect(result.classifierModel).toBe(defaultConfig.classifierModel);
    expect(["simple", "code", "complex", "multi-step"]).toContain(result.label);
  });

  it("detects code via aggressive heuristic", async () => {
    const result = await classifyLLM({ text: "function foo() { return 1; }" }, defaultConfig);
    expect(result.label).toBe("code");
  });
});

describe("classify (hybrid)", () => {
  it("uses heuristic when confidence >= threshold", async () => {
    // Code detection returns 0.7 confidence, default threshold is 0.7
    const result = await classify({ text: "```\nconst x = 1;\n```" }, defaultConfig);
    expect(result.method).toBe("heuristic");
    expect(result.label).toBe("code");
  });

  it("falls back to LLM when heuristic confidence < threshold", async () => {
    // Simple detection returns 0.4 confidence, below default 0.7 threshold
    const result = await classify({ text: "Hello" }, defaultConfig);
    expect(result.method).toBe("llm");
  });

  it("respects a custom threshold", async () => {
    // Code returns 0.7, with threshold 0.8 it should fall to LLM
    const highThreshold = resolveConfig({ heuristicConfidenceThreshold: 0.8 });
    const result = await classify({ text: "```\nconst x = 1;\n```" }, highThreshold);
    expect(result.method).toBe("llm");
  });

  it("uses heuristic when threshold is lowered", async () => {
    // Simple returns 0.4, with threshold 0.3 it should stay heuristic
    const lowThreshold = resolveConfig({ heuristicConfidenceThreshold: 0.3 });
    const result = await classify({ text: "Hello" }, lowThreshold);
    expect(result.method).toBe("heuristic");
    expect(result.label).toBe("simple");
  });
});
