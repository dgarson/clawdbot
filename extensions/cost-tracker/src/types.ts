/**
 * Cost tracking types for the cost-tracker extension.
 */

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
}

/** Telemetry event entry from JSONL sink */
export interface TelemetryEntry {
  ts: number;
  jobId: string;
  action: "finished";
  status?: "ok" | "error" | "skipped";
  model?: string;
  provider?: string;
  agentId?: string;
  wave?: string;
  usage?: TokenUsage;
}

/** Aggregated cost for a single model within a time period */
export interface ModelCost {
  model: string;
  provider: string;
  runs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

/** Aggregated cost for an agent */
export interface AgentCost {
  agentId: string;
  runs: number;
  models: ModelCost[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
}

/** Daily cost summary */
export interface DailyCostSummary {
  date: string;
  from: string;
  to: string;
  totalRuns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  agents: AgentCost[];
}

/** Budget alert configuration */
export interface BudgetAlertConfig {
  dailyLimit: number;
  weeklyLimit?: number;
  agentDailyLimit?: number;
  enabled: boolean;
}

/** Budget alert result */
export interface BudgetAlert {
  type: "daily" | "weekly" | "agent_daily";
  threshold: number;
  currentSpend: number;
  percentage: number;
  agentId?: string;
}

/** Cost tracker configuration */
export interface CostTrackerConfig {
  telemetryPath: string;
  outputPath?: string;
  budget?: BudgetAlertConfig;
  slackWebhookUrl?: string;
}
