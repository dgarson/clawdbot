/**
 * Evaluation Scenario Catalog Tests
 */

import { describe, it, expect } from "vitest";
import { hitlEscalationCase, hitlTimeoutCase } from "./cases/hitl-escalation.js";
import { memoryRecallCase, memoryPathTraversalCase } from "./cases/memory-recall.js";
import {
  buildScenarioCatalog,
  filterCatalog,
  validateScenarioMetadata,
  type CataloguedEvaluationCase,
  type ScenarioCatalog,
} from "./catalog.js";

describe("catalog", () => {
  describe("buildScenarioCatalog", () => {
    it("should build a catalog with cases grouped by category and difficulty", () => {
      const cases: CataloguedEvaluationCase[] = [
        hitlEscalationCase,
        hitlTimeoutCase,
        memoryRecallCase,
        memoryPathTraversalCase,
      ];

      const catalog = buildScenarioCatalog(cases, "1.0.0");

      expect(catalog.version).toBe("1.0.0");
      expect(catalog.cases).toHaveLength(4);
      expect(catalog.byCategory.hitl).toHaveLength(2);
      expect(catalog.byCategory.memory).toHaveLength(2);
      expect(catalog.byDifficulty.integration).toHaveLength(4);
    });

    it("should set updatedAt timestamp", () => {
      const before = new Date().toISOString();
      const catalog = buildScenarioCatalog([hitlEscalationCase]);
      const after = new Date().toISOString();

      expect(catalog.updatedAt).toBeDefined();
      expect(catalog.updatedAt >= before).toBe(true);
      expect(catalog.updatedAt <= after).toBe(true);
    });
  });

  describe("filterCatalog", () => {
    const catalog: ScenarioCatalog = buildScenarioCatalog([
      hitlEscalationCase,
      hitlTimeoutCase,
      memoryRecallCase,
      memoryPathTraversalCase,
    ]);

    it("should filter by category", () => {
      const hitlCases = filterCatalog(catalog, { category: "hitl" });
      expect(hitlCases).toHaveLength(2);
      expect(hitlCases.every((c) => c.metadata.category === "hitl")).toBe(true);
    });

    it("should filter by difficulty", () => {
      const integrationCases = filterCatalog(catalog, {
        difficulty: "integration",
      });
      expect(integrationCases).toHaveLength(4);
    });

    it("should filter by suite", () => {
      const memorySuiteCases = filterCatalog(catalog, { suite: "memory" });
      expect(memorySuiteCases).toHaveLength(2);
    });

    it("should filter by tags", () => {
      const smokeCases = filterCatalog(catalog, { tags: ["smoke"] });
      expect(smokeCases).toHaveLength(1);
      expect(smokeCases[0]?.id).toBe("hitl.escalation-smoke");
    });

    it("should combine multiple filters", () => {
      const cases = filterCatalog(catalog, {
        category: "hitl",
        tags: ["smoke"],
      });
      expect(cases).toHaveLength(1);
    });

    it("should return empty array when no matches", () => {
      const cases = filterCatalog(catalog, { category: "regression" });
      expect(cases).toHaveLength(0);
    });
  });

  describe("validateScenarioMetadata", () => {
    it("should validate a correct catalogued case", () => {
      const result = validateScenarioMetadata(hitlEscalationCase);
      expect(result).toBe(true);
    });

    it("should reject case without metadata", () => {
      const result = validateScenarioMetadata({
        id: "test",
        suite: "test",
        title: "Test",
        run: async () => ({ pass: true, summary: "ok" }),
      });
      expect(result).toBe(false);
    });

    it("should reject case with invalid category", () => {
      const invalidCase = {
        id: "test",
        suite: "test",
        title: "Test",
        run: async () => ({ pass: true, summary: "ok" }),
        metadata: {
          category: "invalid-category",
          difficulty: "unit",
          assertions: ["test"],
        },
      };
      expect(validateScenarioMetadata(invalidCase)).toBe(false);
    });

    it("should reject case with invalid difficulty", () => {
      const invalidCase = {
        id: "test",
        suite: "test",
        title: "Test",
        run: async () => ({ pass: true, summary: "ok" }),
        metadata: {
          category: "hitl",
          difficulty: "invalid-difficulty",
          assertions: ["test"],
        },
      };
      expect(validateScenarioMetadata(invalidCase)).toBe(false);
    });

    it("should reject case without assertions", () => {
      const invalidCase = {
        id: "test",
        suite: "test",
        title: "Test",
        run: async () => ({ pass: true, summary: "ok" }),
        metadata: {
          category: "hitl",
          difficulty: "unit",
          assertions: [],
        },
      };
      expect(validateScenarioMetadata(invalidCase)).toBe(false);
    });

    it("should reject primitive values", () => {
      expect(validateScenarioMetadata("string")).toBe(false);
      expect(validateScenarioMetadata(123)).toBe(false);
      expect(validateScenarioMetadata(null)).toBe(false);
      expect(validateScenarioMetadata(undefined)).toBe(false);
    });
  });
});

describe("catalog cases", () => {
  describe("HITL scenarios", () => {
    it("hitl.escalation-smoke should pass", async () => {
      const result = await hitlEscalationCase.run({
        runId: "test-run",
        startedAt: new Date().toISOString(),
      });
      expect(result.pass).toBe(true);
    });

    it("hitl.timeout-handling should pass", async () => {
      const result = await hitlTimeoutCase.run({
        runId: "test-run",
        startedAt: new Date().toISOString(),
      });
      expect(result.pass).toBe(true);
    });
  });

  describe("Memory scenarios", () => {
    it("memory.recall-context should pass", async () => {
      const result = await memoryRecallCase.run({
        runId: "test-run",
        startedAt: new Date().toISOString(),
      });
      expect(result.pass).toBe(true);
    });

    it("memory.path-traversal should pass", async () => {
      const result = await memoryPathTraversalCase.run({
        runId: "test-run",
        startedAt: new Date().toISOString(),
      });
      expect(result.pass).toBe(true);
    });
  });
});
