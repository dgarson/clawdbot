/**
 * Automations Module - Public API exports
 *
 * This module provides the complete public API for the Automations feature.
 * It exports the AutomationService class along with all necessary types.
 */

// Main service
export { AutomationService } from "./service.js";

// Core types - re-export commonly used types
export type {
  // Automation types
  Automation,
  AutomationBase,
  AutomationConfig,
  AutomationCreate,
  AutomationPatch,

  // Schedule types
  AutomationSchedule,

  // Status types
  AutomationStatus,
  AutomationTypeKind,

  // State types
  AutomationState,

  // Run types
  AutomationRun,
  AutomationRunStatus,
  AutomationTrigger,
  AutomationMilestone,
  AutomationArtifact,
  AutomationConflict,
  AutomationAiModel,

  // Result types
  AutomationGetResult,
  AutomationDeleteResult,
  AutomationRunResult,
  AutomationHistoryResult,
  AutomationCancelResult,

  // Service types
  AutomationServiceDeps,
  Logger,
  AutomationStatusSummary,

  // Event types
  AutomationEvent,
  AutomationEventType,

  // Config types
  SmartSyncForkConfig,
  CustomScriptConfig,
  WebhookConfig,

  // Store types
  AutomationStoreFile,
} from "./types.js";

// Store utilities
export {
  resolveAutomationsStorePath,
  loadAutomationsStore,
  saveAutomationsStore,
  cleanOldHistory,
  DEFAULT_AUTOMATIONS_DIR,
  DEFAULT_AUTOMATIONS_STORE_PATH,
} from "./store.js";

// Schedule computation
export { computeNextRunAtMs } from "./schedule.js";

// Events
export {
  emitAutomationStarted,
  emitAutomationProgress,
  emitAutomationCompleted,
  emitAutomationFailed,
  emitAutomationBlocked,
  emitAutomationCancelled,
} from "./events.js";

// Validation utilities
export {
  validateSchedule,
  validateConfigMatchesType,
  validateSmartSyncForkConfig,
  validateCustomScriptConfig,
  validateWebhookConfig,
  validateAutomationCreate,
  validateAutomationPatch,
} from "./utils/validation.js";

// Logger utilities
export {
  createAutomationLogger,
  formatAutomationPrefix,
  AUTOMATION_TYPE_LOG_PREFIX,
} from "./utils/logger.js";

// Artifact storage
export {
  ArtifactStorage,
  resolveArtifactsDir,
  formatBytes,
  type ArtifactStorageOptions,
  type StoredArtifactMetadata,
} from "./artifacts.js";
