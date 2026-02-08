import type { SessionSendPolicyConfig } from "./types.base.js";

export type MemoryBackend = "builtin" | "qmd";
export type MemoryCitationsMode = "auto" | "on" | "off";

export type MemoryProgressiveConfig = {
  enabled?: boolean;
};

export type MemoryGraphitiConfig = {
  enabled?: boolean;
  serverHost?: string; // default: localhost
  mcpPort?: number; // default: 8000
  servicePort?: number; // default: 8001
  apiKey?: string;
  timeoutMs?: number; // default: 10000
};

export type MemoryModelConfig = {
  /** Primary model for memory subsystem runs (e.g. memory flush). Format: provider/model. */
  primary?: string;
  /** Ordered fallback models for memory subsystem runs. Format: provider/model. */
  fallbacks?: string[];
};

export type MemoryEntityExtractionConfig = {
  /** Enable/disable entity extraction in the ingestion pipeline. Default: true. */
  enabled?: boolean;
  /** Minimum text length to attempt extraction. Default: 20. */
  minTextLength?: number;
  /** Maximum entities per episode. Default: 50. */
  maxEntitiesPerEpisode?: number;
};

export type MemoryConfig = {
  backend?: MemoryBackend;
  citations?: MemoryCitationsMode;
  /** Model preferences for memory subsystem runs (e.g. memory flush). Defaults to agents.defaults.model. */
  model?: MemoryModelConfig;
  qmd?: MemoryQmdConfig;
  progressive?: MemoryProgressiveConfig;
  graphiti?: MemoryGraphitiConfig;
  /** Entity extraction pipeline configuration. */
  entityExtraction?: MemoryEntityExtractionConfig;
};

export type MemoryQmdConfig = {
  command?: string;
  includeDefaultMemory?: boolean;
  paths?: MemoryQmdIndexPath[];
  sessions?: MemoryQmdSessionConfig;
  update?: MemoryQmdUpdateConfig;
  limits?: MemoryQmdLimitsConfig;
  scope?: SessionSendPolicyConfig;
};

export type MemoryQmdIndexPath = {
  path: string;
  name?: string;
  pattern?: string;
};

export type MemoryQmdSessionConfig = {
  enabled?: boolean;
  exportDir?: string;
  retentionDays?: number;
};

export type MemoryQmdUpdateConfig = {
  interval?: string;
  debounceMs?: number;
  onBoot?: boolean;
  waitForBootSync?: boolean;
  embedInterval?: string;
  commandTimeoutMs?: number;
  updateTimeoutMs?: number;
  embedTimeoutMs?: number;
};

export type MemoryQmdLimitsConfig = {
  maxResults?: number;
  maxSnippetChars?: number;
  maxInjectedChars?: number;
  timeoutMs?: number;
};
