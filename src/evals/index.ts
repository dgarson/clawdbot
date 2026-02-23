export {
  buildEvaluationRunId,
  resolveEvaluationReportPath,
  writeEvaluationReport,
} from "./report.js";
export { BasicEvaluationRunner } from "./runner.js";
export { sampleEchoEvaluationCase } from "./sample-case.js";

// Catalog schema & metadata
export {
  buildScenarioCatalog,
  filterCatalog,
  validateScenarioMetadata,
  createDefaultCatalog,
  loadScenarios,
  loadScenariosByCategory,
  loadScenariosByDifficulty,
  loadScenariosBySuite,
  validateCatalog,
  getCatalogStats,
  loadScenariosFromFixture,
} from "./fixtures.js";

// Catalog types
export type {
  ScenarioCategory,
  ScenarioDifficulty,
  ScenarioMetadata,
  CataloguedEvaluationCase,
  ScenarioCatalog,
  CatalogFilter,
} from "./catalog.js";

// Benchmark scenarios
export { hitlEscalationCase, hitlTimeoutCase } from "./cases/hitl-escalation.js";
export { memoryRecallCase, memoryPathTraversalCase } from "./cases/memory-recall.js";

export type {
  EvaluationCase,
  EvaluationCaseContext,
  EvaluationCaseResult,
  EvaluationCaseRun,
  EvaluationReportOutput,
  EvaluationRunner,
  EvaluationRunOptions,
  EvaluationRunReport,
} from "./types.js";
