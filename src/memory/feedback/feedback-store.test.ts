import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { RelevanceFeedback } from "./types.js";
import { FeedbackStore } from "./feedback-store.js";

function makeFeedback(overrides: Partial<RelevanceFeedback> = {}): RelevanceFeedback {
  return {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ts: new Date().toISOString(),
    queryTraceId: "trace-1",
    query: "test query",
    judgments: [
      {
        resultPath: "memory/MEMORY.md",
        relevanceScore: 0.9,
        wasUsed: true,
        wouldBeUseful: true,
        rationale: "Relevant",
        sourceBackend: "builtin",
        originalScore: 0.85,
      },
      {
        resultPath: "memory/deploy.md",
        relevanceScore: 0.2,
        wasUsed: false,
        wouldBeUseful: false,
        rationale: "Irrelevant",
        sourceBackend: "progressive",
        originalScore: 0.6,
      },
    ],
    aggregate: {
      precision: 0.5,
      usedCount: 1,
      retrievedCount: 2,
      meanRelevanceScore: 0.55,
      byBackend: {
        builtin: { precision: 1.0, meanRelevance: 0.9, count: 1 },
        progressive: { precision: 0.0, meanRelevance: 0.2, count: 1 },
      },
    },
    evaluatorModel: "test-model",
    evaluationCost: {
      inputTokens: 100,
      outputTokens: 50,
      durationMs: 500,
    },
    ...overrides,
  };
}

describe("FeedbackStore", () => {
  let tempDir: string;
  let store: FeedbackStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "feedback-store-test-"));
    store = new FeedbackStore({ dbPath: join(tempDir, "feedback.db") });
  });

  afterEach(async () => {
    store.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("stores and retrieves feedback", () => {
    const feedback = makeFeedback();
    store.storeFeedback(feedback);

    const retrieved = store.getByTraceId("trace-1");
    expect(retrieved).toBeDefined();
    expect(retrieved?.queryTraceId).toBe("trace-1");
    expect(retrieved?.judgments).toHaveLength(2);
    expect(retrieved?.aggregate.precision).toBe(0.5);
  });

  it("lists feedback with pagination", () => {
    for (let i = 0; i < 5; i++) {
      store.storeFeedback(makeFeedback({ id: `fb-${i}`, queryTraceId: `trace-${i}` }));
    }

    const page1 = store.listFeedback({ limit: 2 });
    expect(page1).toHaveLength(2);

    const page2 = store.listFeedback({ limit: 2, offset: 2 });
    expect(page2).toHaveLength(2);
  });

  it("counts stored feedback", () => {
    expect(store.count()).toBe(0);
    store.storeFeedback(makeFeedback());
    expect(store.count()).toBe(1);
  });

  it("updates backend aggregates", () => {
    store.storeFeedback(makeFeedback());
    store.storeFeedback(
      makeFeedback({
        id: "fb-2",
        queryTraceId: "trace-2",
        aggregate: {
          precision: 0.8,
          usedCount: 2,
          retrievedCount: 3,
          meanRelevanceScore: 0.7,
          byBackend: {
            builtin: { precision: 0.9, meanRelevance: 0.85, count: 2 },
          },
        },
      }),
    );

    const aggs = store.getBackendAggregates(7);
    expect(aggs.length).toBeGreaterThan(0);

    const builtinAgg = aggs.find((a) => a.backend === "builtin");
    expect(builtinAgg).toBeDefined();
    expect(builtinAgg!.evalCount).toBe(2);
  });

  it("returns empty aggregates for no data", () => {
    const aggs = store.getBackendAggregates(7);
    expect(aggs).toHaveLength(0);
  });

  it("returns null for unknown trace ID", () => {
    const result = store.getByTraceId("nonexistent");
    expect(result).toBeNull();
  });
});
