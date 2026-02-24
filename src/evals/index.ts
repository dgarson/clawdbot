// Core runner & report
export { BasicEvaluationRunner } from "./runner.js";
export {
  buildEvaluationRunId,
  resolveEvaluationReportPath,
  writeEvaluationReport,
} from "./report.js";
export { sampleEchoEvaluationCase } from "./sample-case.js";

// JSONL Export for CI integration
export {
  writeEvaluationJsonl,
  writeEvaluationJsonlSummary,
  resolveJsonlPath,
} from "./export-jsonl.js";
export type { JsonlExportOptions, EvaluationJsonlRecord } from "./export-jsonl.js";

// Catalog schema & metadata
export {
  buildScenarioCatalog,
  filterCatalog,
  validateScenarioMetadata,
  createDefaultCatalog,
} from "./catalog.js";

// Catalog types
export type {
  CatalogFilter,
  CataloguedEvaluationCase,
  ScenarioCatalog,
  ScenarioCategory,
  ScenarioDifficulty,
  ScenarioMetadata,
} from "./catalog.js";

// Fixture / CI loading
export {
  createDefaultCatalog,
  getCatalogStats,
  loadScenarios,
  loadScenariosByCategory,
  loadScenariosByDifficulty,
  loadScenariosBySuite,
  loadScenariosFromFixture,
  validateCatalog,
} from "./fixtures.js";

// Benchmark scenarios — HITL
export { hitlEscalationCase, hitlTimeoutCase } from "./cases/hitl-escalation.js";

// Benchmark scenarios — Memory
export { memoryPathTraversalCase, memoryRecallCase } from "./cases/memory-recall.js";

// Benchmark scenarios — Tool reliability
export {
  toolDispatchSuccessCase,
  toolDispatchUnknownCase,
  toolMaxRetriesExhaustedCase,
  toolResultSchemaCase,
  toolRetryCase,
  toolTimeoutAbortCase,
} from "./cases/tool-reliability.js";

// Benchmark scenarios — Agent spawning
export {
  agentBasicSpawnCase,
  agentDepthLimitCase,
  agentOrphanCleanupCase,
  agentParallelCompletionCase,
  agentResultRoutingCase,
} from "./cases/agent-spawning.js";

// Scoring, baselines, regression policy
export {
  DEFAULT_MIN_CONFIDENCE_SAMPLES,
  DEFAULT_QUALITY_FLOOR,
  clampUnit,
  evaluateRegression,
  scoreOutput,
} from "./scoring.js";
export type {
  BaselineSnapshot,
  RegressionAssessment,
  RegressionStatus,
  RegressionThresholds,
  RubricDimension,
  ScoreFlag,
  ScoreInput,
  ScoreResult,
  ScoringRubric,
} from "./scoring.js";

// Benchmark matrix + reporting format
export {
  buildBenchmarkMatrix,
  buildBenchmarkReport,
  buildBenchmarkRunSummary,
} from "./benchmark-report.js";
export type {
  BenchmarkCell,
  BenchmarkMatrix,
  BenchmarkRecord,
  BenchmarkReport,
  BenchmarkRunSummary,
} from "./benchmark-report.js";

// Core types
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
