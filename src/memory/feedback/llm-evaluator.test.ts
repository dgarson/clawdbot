import { describe, it, expect, vi } from "vitest";
import type { MemorySearchResult } from "../types.js";
import type { RelevancyEvaluationContext } from "./types.js";
import { LlmRelevancyEvaluator } from "./llm-evaluator.js";

function makeResult(overrides: Partial<MemorySearchResult> = {}): MemorySearchResult {
  return {
    path: "memory/MEMORY.md",
    startLine: 1,
    endLine: 10,
    score: 0.8,
    snippet: "Test snippet about project setup",
    source: "memory",
    ...overrides,
  };
}

function makeMockLlmCall(response: string) {
  return vi.fn().mockResolvedValue({
    text: response,
    inputTokens: 100,
    outputTokens: 50,
  });
}

const validResponse = JSON.stringify({
  judgments: [
    {
      resultIndex: 0,
      relevanceScore: 0.9,
      wasUsed: true,
      wouldBeUseful: true,
      rationale: "Directly answers the query about project setup.",
    },
    {
      resultIndex: 1,
      relevanceScore: 0.2,
      wasUsed: false,
      wouldBeUseful: false,
      rationale: "Unrelated content about deployment.",
    },
  ],
  systemSuggestions: ["Consider adding project tags to progressive entries"],
});

function makeContext(
  overrides: Partial<RelevancyEvaluationContext> = {},
): RelevancyEvaluationContext {
  return {
    results: [
      makeResult({ path: "memory/MEMORY.md", score: 0.85, snippet: "Project setup instructions" }),
      makeResult({ path: "memory/deploy.md", score: 0.6, snippet: "Deployment configuration" }),
    ],
    retrievalQuery: "how do I set up the project?",
    landingPrompt: "How do I set up the project for development?",
    agentResponse: "To set up the project, run pnpm install and then pnpm dev.",
    backendAttribution: {
      builtin: ["memory/MEMORY.md"],
      progressive: ["memory/deploy.md"],
    },
    queryTraceId: "trace-123",
    ...overrides,
  };
}

describe("LlmRelevancyEvaluator", () => {
  it("evaluates results and produces feedback", async () => {
    const llmCall = makeMockLlmCall(validResponse);
    const evaluator = new LlmRelevancyEvaluator({
      llmCall,
      model: "test-model",
    });

    const feedback = await evaluator.evaluate(makeContext());

    expect(feedback.id).toBeTruthy();
    expect(feedback.ts).toBeTruthy();
    expect(feedback.queryTraceId).toBe("trace-123");
    expect(feedback.evaluatorModel).toBe("test-model");
    expect(feedback.judgments).toHaveLength(2);

    // First result: high relevance, used
    expect(feedback.judgments[0].resultPath).toBe("memory/MEMORY.md");
    expect(feedback.judgments[0].relevanceScore).toBe(0.9);
    expect(feedback.judgments[0].wasUsed).toBe(true);
    expect(feedback.judgments[0].sourceBackend).toBe("builtin");

    // Second result: low relevance, not used
    expect(feedback.judgments[1].resultPath).toBe("memory/deploy.md");
    expect(feedback.judgments[1].relevanceScore).toBe(0.2);
    expect(feedback.judgments[1].wasUsed).toBe(false);
    expect(feedback.judgments[1].sourceBackend).toBe("progressive");

    // Aggregates
    expect(feedback.aggregate.retrievedCount).toBe(2);
    expect(feedback.aggregate.usedCount).toBe(1);
    expect(feedback.aggregate.precision).toBe(0.5); // 1 of 2 > 0.5 threshold
    expect(feedback.aggregate.byBackend.builtin).toBeDefined();
    expect(feedback.aggregate.byBackend.progressive).toBeDefined();

    expect(feedback.evaluationCost.inputTokens).toBe(100);
    expect(feedback.evaluationCost.outputTokens).toBe(50);
  });

  it("handles malformed LLM response gracefully", async () => {
    const llmCall = makeMockLlmCall("not valid json at all");
    const evaluator = new LlmRelevancyEvaluator({
      llmCall,
      model: "test-model",
    });

    const feedback = await evaluator.evaluate(makeContext());

    expect(feedback.judgments).toHaveLength(0);
    expect(feedback.aggregate.retrievedCount).toBe(0);
    expect(feedback.aggregate.precision).toBe(0);
  });

  it("handles JSON wrapped in markdown code blocks", async () => {
    const wrappedResponse = "```json\n" + validResponse + "\n```";
    const llmCall = makeMockLlmCall(wrappedResponse);
    const evaluator = new LlmRelevancyEvaluator({
      llmCall,
      model: "test-model",
    });

    const feedback = await evaluator.evaluate(makeContext());
    expect(feedback.judgments).toHaveLength(2);
  });

  it("clamps relevance scores to [0, 1]", async () => {
    const response = JSON.stringify({
      judgments: [
        {
          resultIndex: 0,
          relevanceScore: 1.5,
          wasUsed: true,
          wouldBeUseful: true,
          rationale: "test",
        },
        {
          resultIndex: 1,
          relevanceScore: -0.3,
          wasUsed: false,
          wouldBeUseful: false,
          rationale: "test",
        },
      ],
    });
    const llmCall = makeMockLlmCall(response);
    const evaluator = new LlmRelevancyEvaluator({
      llmCall,
      model: "test-model",
    });

    const feedback = await evaluator.evaluate(makeContext());
    expect(feedback.judgments[0].relevanceScore).toBe(1);
    expect(feedback.judgments[1].relevanceScore).toBe(0);
  });

  it("respects rate limiting", () => {
    const llmCall = makeMockLlmCall(validResponse);
    const evaluator = new LlmRelevancyEvaluator({
      llmCall,
      model: "test-model",
      maxEvalsPerHour: 2,
    });

    expect(evaluator.shouldEvaluate({ resultCount: 3 })).toBe(true);

    // Simulate having hit the limit by evaluating (fills timestamps)
    // @ts-expect-error -- accessing private for test
    evaluator.evalTimestamps.push(Date.now(), Date.now());

    expect(evaluator.shouldEvaluate({ resultCount: 3 })).toBe(false);
  });

  it("requires minimum results for evaluation", () => {
    const llmCall = makeMockLlmCall(validResponse);
    const evaluator = new LlmRelevancyEvaluator({
      llmCall,
      model: "test-model",
      minResultsForEval: 3,
    });

    expect(evaluator.shouldEvaluate({ resultCount: 2 })).toBe(false);
    expect(evaluator.shouldEvaluate({ resultCount: 3 })).toBe(true);
  });

  it("trims results exceeding maxResultsPerEval", async () => {
    const results = Array.from({ length: 15 }, (_, i) =>
      makeResult({ path: `file-${i}.md`, score: 0.9 - i * 0.05 }),
    );
    const attribution: Record<string, string[]> = {
      builtin: results.map((r) => r.path),
    };

    const response = JSON.stringify({
      judgments: Array.from({ length: 5 }, (_, i) => ({
        resultIndex: i,
        relevanceScore: 0.8,
        wasUsed: true,
        wouldBeUseful: true,
        rationale: "test",
      })),
    });
    const llmCall = makeMockLlmCall(response);
    const evaluator = new LlmRelevancyEvaluator({
      llmCall,
      model: "test-model",
      maxResultsPerEval: 5,
    });

    const feedback = await evaluator.evaluate(
      makeContext({ results, backendAttribution: attribution }),
    );

    // Should have at most 5 judgments since we trimmed to 5
    expect(feedback.judgments.length).toBeLessThanOrEqual(5);
  });
});
