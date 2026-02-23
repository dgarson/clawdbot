/**
 * Evaluation Scenario Catalog Schema & Metadata Contracts
 *
 * Defines the schema for organizing evaluation scenarios into a catalog
 * with categories, benchmarks, and standardized metadata.
 */

import type { EvaluationCase } from "./types.js";

/**
 * Scenario category types for organization
 */
export type ScenarioCategory =
  | "hitl" // Human-In-The-Loop scenarios
  | "memory" // Memory/path recall scenarios
  | "tool-reliability" // Tool dispatch & reliability
  | "agent-spawning" // Agent spawning & coordination
  | "integration" // End-to-end integration scenarios
  | "regression"; // Regression test scenarios

/**
 * Difficulty tier for scenario classification
 */
export type ScenarioDifficulty = "smoke" | "unit" | "integration" | "e2e";

/**
 * Scenario metadata attached to each evaluation case
 */
export type ScenarioMetadata = {
  /** Unique category identifier */
  category: ScenarioCategory;
  /** Difficulty tier */
  difficulty: ScenarioDifficulty;
  /** Expected duration in ms (for CI timeout planning) */
  expectedDurationMs?: number;
  /** Whether this scenario requires external services */
  requiresExternal?: boolean;
  /** Key assertions this scenario validates */
  assertions: string[];
  /** Related scenarios for cascade failure analysis */
  relatedCases?: string[];
};

/**
 * Extended EvaluationCase with catalog metadata
 */
export type CataloguedEvaluationCase = EvaluationCase & {
  metadata: ScenarioMetadata;
};

/**
 * Scenario catalog containing all registered scenarios
 */
export type ScenarioCatalog = {
  /** Catalog version for schema compatibility */
  version: string;
  /** Last updated timestamp */
  updatedAt: string;
  /** All registered scenarios */
  cases: CataloguedEvaluationCase[];
  /** Scenarios grouped by category */
  byCategory: Record<ScenarioCategory, CataloguedEvaluationCase[]>;
  /** Scenarios grouped by difficulty */
  byDifficulty: Record<ScenarioDifficulty, CataloguedEvaluationCase[]>;
};

/**
 * Filter options for querying the catalog
 */
export type CatalogFilter = {
  category?: ScenarioCategory;
  difficulty?: ScenarioDifficulty;
  tags?: string[];
  suite?: string;
};

/**
 * Builds a scenario catalog from a list of catalogued cases
 */
export function buildScenarioCatalog(
  cases: CataloguedEvaluationCase[],
  version: string = "1.0.0",
): ScenarioCatalog {
  const byCategory: Record<ScenarioCategory, CataloguedEvaluationCase[]> = {
    hitl: [],
    memory: [],
    "tool-reliability": [],
    "agent-spawning": [],
    integration: [],
    regression: [],
  };

  const byDifficulty: Record<ScenarioDifficulty, CataloguedEvaluationCase[]> = {
    smoke: [],
    unit: [],
    integration: [],
    e2e: [],
  };

  for (const scenarioCase of cases) {
    byCategory[scenarioCase.metadata.category].push(scenarioCase);
    byDifficulty[scenarioCase.metadata.difficulty].push(scenarioCase);
  }

  return {
    version,
    updatedAt: new Date().toISOString(),
    cases,
    byCategory,
    byDifficulty,
  };
}

/**
 * Filter scenarios from a catalog based on criteria
 */
export function filterCatalog(
  catalog: ScenarioCatalog,
  filter: CatalogFilter,
): CataloguedEvaluationCase[] {
  return catalog.cases.filter((scenarioCase) => {
    if (filter.category && scenarioCase.metadata.category !== filter.category) {
      return false;
    }
    if (filter.difficulty && scenarioCase.metadata.difficulty !== filter.difficulty) {
      return false;
    }
    if (filter.suite && scenarioCase.suite !== filter.suite) {
      return false;
    }
    if (filter.tags?.length) {
      const scenarioTags = scenarioCase.tags ?? [];
      if (!filter.tags.some((tag) => scenarioTags.includes(tag))) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Validates that a scenario has required metadata
 */
export function validateScenarioMetadata(scenario: unknown): scenario is CataloguedEvaluationCase {
  if (!scenario || typeof scenario !== "object") {
    return false;
  }

  const s = scenario as Record<string, unknown>;

  // Check required EvaluationCase fields
  if (typeof s.id !== "string" || !s.id) {
    return false;
  }
  if (typeof s.suite !== "string" || !s.suite) {
    return false;
  }
  if (typeof s.title !== "string" || !s.title) {
    return false;
  }
  if (typeof s.run !== "function") {
    return false;
  }

  // Check required metadata fields
  if (!s.metadata || typeof s.metadata !== "object") {
    return false;
  }
  const m = s.metadata as Record<string, unknown>;

  const validCategories: ScenarioCategory[] = [
    "hitl",
    "memory",
    "tool-reliability",
    "agent-spawning",
    "integration",
    "regression",
  ];
  if (!validCategories.includes(m.category as ScenarioCategory)) {
    return false;
  }

  const validDifficulties: ScenarioDifficulty[] = ["smoke", "unit", "integration", "e2e"];
  if (!validDifficulties.includes(m.difficulty as ScenarioDifficulty)) {
    return false;
  }

  if (!Array.isArray(m.assertions) || m.assertions.length === 0) {
    return false;
  }

  return true;
}
