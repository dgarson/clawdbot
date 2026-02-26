import { beforeEach, describe, expect, it } from "vitest";
import {
  agentBasicSpawnCase,
  agentDepthLimitCase,
  agentResultRoutingCase,
  agentOrphanCleanupCase,
  agentParallelCompletionCase,
} from "./cases/agent-spawning.js";
import { hitlEscalationCase, hitlTimeoutCase } from "./cases/hitl-escalation.js";
import { memoryRecallCase, memoryPathTraversalCase } from "./cases/memory-recall.js";
import {
  toolDispatchSuccessCase,
  toolDispatchUnknownCase,
  toolRetryCase,
  toolMaxRetriesExhaustedCase,
  toolTimeoutAbortCase,
  toolResultSchemaCase,
} from "./cases/tool-reliability.js";
import {
  buildScenarioCatalog,
  filterCatalog,
  validateScenarioMetadata,
  type CataloguedEvaluationCase,
  type ScenarioCatalog,
} from "./catalog.js";
import { createDefaultCatalog, getCatalogStats, validateCatalog } from "./fixtures.js";

// ---------------------------------------------------------------------------
// Catalog construction
// ---------------------------------------------------------------------------

describe("buildScenarioCatalog", () => {
  const allBenchmarkCases: CataloguedEvaluationCase[] = [
    hitlEscalationCase,
    hitlTimeoutCase,
    memoryRecallCase,
    memoryPathTraversalCase,
    toolDispatchSuccessCase,
    toolDispatchUnknownCase,
    toolRetryCase,
    toolMaxRetriesExhaustedCase,
    toolTimeoutAbortCase,
    toolResultSchemaCase,
    agentBasicSpawnCase,
    agentDepthLimitCase,
    agentResultRoutingCase,
    agentOrphanCleanupCase,
    agentParallelCompletionCase,
  ];

  it("groups cases by category", () => {
    const catalog = buildScenarioCatalog(allBenchmarkCases);
    expect(catalog.byCategory.hitl).toHaveLength(2);
    expect(catalog.byCategory.memory).toHaveLength(2);
    expect(catalog.byCategory["tool-reliability"]).toHaveLength(6);
    expect(catalog.byCategory["agent-spawning"]).toHaveLength(5);
  });

  it("groups cases by difficulty", () => {
    const catalog = buildScenarioCatalog(allBenchmarkCases);
    // smoke: tool-dispatch-success, agent-basic-spawn
    // (hitl.escalation-smoke uses difficulty: "integration" despite "smoke" in its name/tags)
    expect(catalog.byDifficulty.smoke).toHaveLength(2);
    // unit: tool-dispatch-unknown, tool-retry, tool-max-retries, tool-timeout-abort,
    //        tool-result-schema, agent-depth, agent-routing, agent-orphan, agent-parallel
    expect(catalog.byDifficulty.unit).toHaveLength(9);
    // integration: hitl.escalation-smoke, hitl.timeout-handling, memory.recall, memory.path-traversal
    expect(catalog.byDifficulty.integration).toHaveLength(4);
  });

  it("sets updatedAt within test execution window", () => {
    const before = new Date().toISOString();
    const catalog = buildScenarioCatalog([hitlEscalationCase]);
    const after = new Date().toISOString();
    expect(catalog.updatedAt >= before).toBe(true);
    expect(catalog.updatedAt <= after).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Catalog filtering
// ---------------------------------------------------------------------------

describe("filterCatalog", () => {
  let catalog: ScenarioCatalog;

  beforeEach(() => {
    catalog = buildScenarioCatalog([
      hitlEscalationCase,
      hitlTimeoutCase,
      memoryRecallCase,
      memoryPathTraversalCase,
      toolDispatchSuccessCase,
      agentBasicSpawnCase,
    ]);
  });

  it("filters by category", () => {
    const hitlCases = filterCatalog(catalog, { category: "hitl" });
    expect(hitlCases).toHaveLength(2);
    expect(hitlCases.every((c) => c.metadata.category === "hitl")).toBe(true);
  });

  it("filters tool-reliability category", () => {
    const toolCases = filterCatalog(catalog, { category: "tool-reliability" });
    expect(toolCases).toHaveLength(1);
    expect(toolCases[0]?.id).toBe("tool-reliability.dispatch-success");
  });

  it("filters agent-spawning category", () => {
    const agentCases = filterCatalog(catalog, { category: "agent-spawning" });
    expect(agentCases).toHaveLength(1);
    expect(agentCases[0]?.id).toBe("agent-spawning.basic-spawn-and-complete");
  });

  it("filters by difficulty=smoke", () => {
    const smokeCases = filterCatalog(catalog, { difficulty: "smoke" });
    expect(smokeCases.every((c) => c.metadata.difficulty === "smoke")).toBe(true);
  });

  it("filters by suite", () => {
    const memoryCases = filterCatalog(catalog, { suite: "memory" });
    expect(memoryCases).toHaveLength(2);
    expect(memoryCases.every((c) => c.suite === "memory")).toBe(true);
  });

  it("filters by tags", () => {
    const smokeCases = filterCatalog(catalog, { tags: ["smoke"] });
    expect(smokeCases.length).toBeGreaterThan(0);
    expect(smokeCases.every((c) => c.tags?.includes("smoke"))).toBe(true);
  });

  it("returns empty array when no matches", () => {
    const cases = filterCatalog(catalog, { category: "regression" });
    expect(cases).toHaveLength(0);
  });

  it("combines multiple filters (AND logic)", () => {
    const cases = filterCatalog(catalog, { category: "hitl", tags: ["smoke"] });
    expect(cases).toHaveLength(1);
    expect(cases[0]?.id).toBe("hitl.escalation-smoke");
  });
});

// ---------------------------------------------------------------------------
// Metadata validation
// ---------------------------------------------------------------------------

describe("validateScenarioMetadata", () => {
  it("validates a correct catalogued case", () => {
    expect(validateScenarioMetadata(hitlEscalationCase)).toBe(true);
    expect(validateScenarioMetadata(toolDispatchSuccessCase)).toBe(true);
    expect(validateScenarioMetadata(agentBasicSpawnCase)).toBe(true);
  });

  it("rejects case without metadata", () => {
    expect(
      validateScenarioMetadata({
        id: "test",
        suite: "test",
        title: "Test",
        run: async () => ({ pass: true, summary: "ok" }),
      }),
    ).toBe(false);
  });

  it("rejects case with invalid category", () => {
    expect(
      validateScenarioMetadata({
        id: "test",
        suite: "test",
        title: "Test",
        run: async () => ({ pass: true, summary: "ok" }),
        metadata: { category: "invalid-category", difficulty: "unit", assertions: ["x"] },
      }),
    ).toBe(false);
  });

  it("rejects case with invalid difficulty", () => {
    expect(
      validateScenarioMetadata({
        id: "test",
        suite: "test",
        title: "Test",
        run: async () => ({ pass: true, summary: "ok" }),
        metadata: { category: "hitl", difficulty: "invalid", assertions: ["x"] },
      }),
    ).toBe(false);
  });

  it("rejects case without assertions", () => {
    expect(
      validateScenarioMetadata({
        id: "test",
        suite: "test",
        title: "Test",
        run: async () => ({ pass: true, summary: "ok" }),
        metadata: { category: "hitl", difficulty: "unit", assertions: [] },
      }),
    ).toBe(false);
  });

  it("rejects primitives and null", () => {
    expect(validateScenarioMetadata("string")).toBe(false);
    expect(validateScenarioMetadata(123)).toBe(false);
    expect(validateScenarioMetadata(null)).toBe(false);
    expect(validateScenarioMetadata(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Default catalog / fixtures
// ---------------------------------------------------------------------------

describe("createDefaultCatalog", () => {
  it("includes all expected scenario categories", () => {
    const catalog = createDefaultCatalog();
    const categories = new Set(catalog.cases.map((c) => c.metadata.category));
    expect(categories.has("integration")).toBe(true); // sample
    expect(categories.has("hitl")).toBe(true);
    expect(categories.has("memory")).toBe(true);
    expect(categories.has("tool-reliability")).toBe(true);
    expect(categories.has("agent-spawning")).toBe(true);
  });

  it("has no duplicate IDs", () => {
    const catalog = createDefaultCatalog();
    const ids = catalog.cases.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe("validateCatalog", () => {
  it("returns empty array — all default scenarios are valid", () => {
    const invalid = validateCatalog();
    expect(invalid).toHaveLength(0);
  });
});

describe("getCatalogStats", () => {
  it("reports total count matching case count", () => {
    const stats = getCatalogStats();
    const catalog = createDefaultCatalog();
    expect(stats.total).toBe(catalog.cases.length);
  });

  it("includes tool-reliability and agent-spawning categories", () => {
    const stats = getCatalogStats();
    expect(stats.byCategory["tool-reliability"]).toBeGreaterThan(0);
    expect(stats.byCategory["agent-spawning"]).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Benchmark scenario smoke runs
// ---------------------------------------------------------------------------

describe("HITL scenarios", () => {
  it("hitl.escalation-smoke passes", async () => {
    const result = await hitlEscalationCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it("hitl.timeout-handling passes", async () => {
    const result = await hitlTimeoutCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
  });
});

describe("Memory scenarios", () => {
  it("memory.recall-context passes", async () => {
    const result = await memoryRecallCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
  });

  it("memory.path-traversal passes", async () => {
    const result = await memoryPathTraversalCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
  });
});

describe("Tool-reliability scenarios", () => {
  it("tool-reliability.dispatch-success passes", async () => {
    const result = await toolDispatchSuccessCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it("tool-reliability.dispatch-unknown-tool passes", async () => {
    const result = await toolDispatchUnknownCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
  });

  it("tool-reliability.retry-on-transient-failure passes", async () => {
    const result = await toolRetryCase.run({ runId: "test", startedAt: new Date().toISOString() });
    expect(result.pass).toBe(true);
  });

  it("tool-reliability.max-retries-exhausted passes", async () => {
    const result = await toolMaxRetriesExhaustedCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
  });

  it("tool-reliability.timeout-abort passes", async () => {
    const result = await toolTimeoutAbortCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
  });

  it("tool-reliability.result-schema-validation passes with partial score 1", async () => {
    const result = await toolResultSchemaCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });
});

describe("Agent-spawning scenarios", () => {
  it("agent-spawning.basic-spawn-and-complete passes", async () => {
    const result = await agentBasicSpawnCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
  });

  it("agent-spawning.depth-limit-enforcement passes", async () => {
    const result = await agentDepthLimitCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
  });

  it("agent-spawning.result-routing-to-requester passes", async () => {
    const result = await agentResultRoutingCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
  });

  it("agent-spawning.orphan-cleanup-on-parent-kill passes", async () => {
    const result = await agentOrphanCleanupCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
  });

  it("agent-spawning.parallel-completion-ordering passes", async () => {
    const result = await agentParallelCompletionCase.run({
      runId: "test",
      startedAt: new Date().toISOString(),
    });
    expect(result.pass).toBe(true);
  });
});
