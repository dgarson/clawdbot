import type { SessionSendPolicyConfig } from "./types.base.js";

export type MemoryBackend = "builtin" | "qmd";
export type MemoryCitationsMode = "auto" | "on" | "off";
export type MemoryQmdSearchMode = "query" | "search" | "vsearch";

export type MemoryScopeDecision = "allow" | "deny";

export type MemoryGovernanceMatch = {
  agentId?: string;
  userId?: string;
  sourceId?: string;
  domain?: "user_pref" | "system_fact" | "session_summary" | "agent_eval" | "code_context";
  tag?: string;
};

export type MemoryGovernanceRule = {
  action: MemoryScopeDecision;
  match?: MemoryGovernanceMatch;
};

export type MemoryGovernanceConfig = {
  default?: MemoryScopeDecision;
  rules?: MemoryGovernanceRule[];
};

export type MemoryVectorConfig = {
  provider?: "qdrant" | "pinecone" | "pgvector";
  endpoint?: string;
  apiKey?: string;
  collection?: string;
};

export type MemoryEmbeddingConfig = {
  model?: "text-embedding-3-small";
  dimensions?: number;
  batchSize?: number;
};

export type MemoryRetrievalConfig = {
  defaultLimit?: number;
  maxTokensBudget?: number;
  vectorWeight?: number;
  keywordWeight?: number;
};

export type MemoryRetentionConfig = {
  defaultTtlDays?: number;
  compactionCron?: string;
};

export type MemoryArchitectureConfig = {
  enabled?: boolean;
  vectorDb?: MemoryVectorConfig;
  embedding?: MemoryEmbeddingConfig;
  retrieval?: MemoryRetrievalConfig;
  retention?: MemoryRetentionConfig;
  governance?: MemoryGovernanceConfig;
  shadowWrite?: {
    enabled?: boolean;
  };
};

export type MemoryConfig = {
  backend?: MemoryBackend;
  citations?: MemoryCitationsMode;
  qmd?: MemoryQmdConfig;
  architecture?: MemoryArchitectureConfig;
};

export type MemoryQmdConfig = {
  command?: string;
  searchMode?: MemoryQmdSearchMode;
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
