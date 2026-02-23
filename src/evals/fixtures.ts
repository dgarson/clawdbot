/**
 * CI-Friendly Fixture Loading for Evaluation Scenarios
 *
 * Provides utilities for loading scenarios from fixtures/catalog
 * for CI pipeline execution.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
  type CatalogFilter,
} from "./catalog.js";
import { sampleEchoEvaluationCase } from "./sample-case.js";

/**
 * All registered evaluation scenarios in the default catalog.
 * Add new CataloguedEvaluationCase entries here to include them in CI runs.
 */
const DEFAULT_SCENARIOS: CataloguedEvaluationCase[] = [
  // Sample smoke (baseline harness validation)
  {
    id: "sample.echo-smoke",
    suite: "sample",
    title: "Sample echo smoke case",
    description: "Simple always-green case proving harness wiring and report plumbing.",
    tags: ["smoke", "sample"],
    run: sampleEchoEvaluationCase.run,
    metadata: {
      category: "integration",
      difficulty: "smoke",
      expectedDurationMs: 100,
      requiresExternal: false,
      assertions: ["harness wiring works", "report path resolves"],
    },
  },

  // HITL scenarios
  hitlEscalationCase,
  hitlTimeoutCase,

  // Memory scenarios
  memoryRecallCase,
  memoryPathTraversalCase,

  // Tool-reliability scenarios
  toolDispatchSuccessCase,
  toolDispatchUnknownCase,
  toolRetryCase,
  toolMaxRetriesExhaustedCase,
  toolTimeoutAbortCase,
  toolResultSchemaCase,

  // Agent-spawning scenarios
  agentBasicSpawnCase,
  agentDepthLimitCase,
  agentResultRoutingCase,
  agentOrphanCleanupCase,
  agentParallelCompletionCase,
];

/**
 * Creates a scenario catalog from all default registered scenarios.
 * Primary entry point for CI to load all scenarios.
 */
export function createDefaultCatalog(): ScenarioCatalog {
  return buildScenarioCatalog(DEFAULT_SCENARIOS, "1.0.0");
}

/**
 * Load scenarios for CI execution.
 *
 * @param filter - Optional filter criteria
 * @returns Filtered list of catalogued scenarios
 */
export function loadScenarios(filter?: CatalogFilter): CataloguedEvaluationCase[] {
  const catalog = createDefaultCatalog();
  if (!filter) {
    return catalog.cases;
  }
  return filterCatalog(catalog, filter);
}

/**
 * Load scenarios by category for targeted CI runs.
 *
 * @param category - Category to filter by
 */
export function loadScenariosByCategory(
  category:
    | "hitl"
    | "memory"
    | "tool-reliability"
    | "agent-spawning"
    | "integration"
    | "regression",
): CataloguedEvaluationCase[] {
  return loadScenarios({ category });
}

/**
 * Load scenarios by difficulty tier for tiered CI execution.
 *
 * @param difficulty - Difficulty tier to filter by
 */
export function loadScenariosByDifficulty(
  difficulty: "smoke" | "unit" | "integration" | "e2e",
): CataloguedEvaluationCase[] {
  return loadScenarios({ difficulty });
}

/**
 * Load scenarios by suite name.
 */
export function loadScenariosBySuite(suite: string): CataloguedEvaluationCase[] {
  return loadScenarios({ suite });
}

/**
 * Validate all scenarios in the default catalog.
 * Returns array of invalid scenario IDs (empty if all valid).
 */
export function validateCatalog(): string[] {
  const catalog = createDefaultCatalog();
  const invalidIds: string[] = [];
  for (const scenario of catalog.cases) {
    if (!validateScenarioMetadata(scenario)) {
      invalidIds.push(scenario.id);
    }
  }
  return invalidIds;
}

/**
 * Get catalog statistics for CI reporting.
 */
export function getCatalogStats(): {
  total: number;
  byCategory: Record<string, number>;
  byDifficulty: Record<string, number>;
  bySuite: Record<string, number>;
} {
  const catalog = createDefaultCatalog();

  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  const bySuite: Record<string, number> = {};

  for (const scenario of catalog.cases) {
    byCategory[scenario.metadata.category] = (byCategory[scenario.metadata.category] ?? 0) + 1;
    byDifficulty[scenario.metadata.difficulty] =
      (byDifficulty[scenario.metadata.difficulty] ?? 0) + 1;
    bySuite[scenario.suite] = (bySuite[scenario.suite] ?? 0) + 1;
  }

  return { total: catalog.cases.length, byCategory, byDifficulty, bySuite };
}

/**
 * Load scenarios from a JSON fixture file (for future extensibility).
 */
export async function loadScenariosFromFixture(
  fixturePath: string,
): Promise<CataloguedEvaluationCase[]> {
  const absolutePath = resolve(process.cwd(), fixturePath);
  const content = await readFile(absolutePath, "utf-8");
  const parsed = JSON.parse(content);

  if (!Array.isArray(parsed)) {
    throw new Error(`Fixture must be an array of scenarios, got ${typeof parsed}`);
  }

  const scenarios: CataloguedEvaluationCase[] = [];
  for (const item of parsed) {
    if (!validateScenarioMetadata(item)) {
      const rawId = (item as Record<string, unknown>)["id"];
      const scenarioId = typeof rawId === "string" ? rawId : "unknown";
      console.warn(`Skipping invalid scenario in fixture: ${scenarioId}`);
      continue;
    }
    scenarios.push(item);
  }

  return scenarios;
}
