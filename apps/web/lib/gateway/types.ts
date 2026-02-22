/**
 * Gateway API response types
 * Derived from protocol schemas in src/gateway/protocol/schema/
 */

// === Agents ===

export type AgentSummary = {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
};

export type AgentsListResult = {
  defaultId: string;
  mainKey: string;
  scope: "per-sender" | "global";
  agents: AgentSummary[];
};

export type AgentIdentityResult = {
  agentId: string;
  name?: string;
  avatar?: string;
  emoji?: string;
};

export type AgentFileEntry = {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
};

export type AgentsFilesListResult = {
  agentId: string;
  workspace: string;
  files: AgentFileEntry[];
};

export type AgentsFilesGetResult = {
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
};

export type AgentsCreateResult = {
  ok: true;
  agentId: string;
  name: string;
  workspace: string;
};

// === Models ===

export type ModelChoice = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
};

export type ModelsListResult = {
  models: ModelChoice[];
};

// === Sessions ===

export type SessionEntry = {
  key: string;
  sessionId?: string;
  agentId?: string;
  channel?: string;
  label?: string;
  createdAtMs?: number;
  lastActiveAtMs?: number;
  messageCount?: number;
  derivedTitle?: string;
  lastMessage?: string;
};

export type SessionsListResult = {
  sessions: SessionEntry[];
};

// === Chat ===

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  ts?: number;
  runId?: string;
  usage?: unknown;
  toolCalls?: unknown[];
};

export type ChatEvent = {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
};

// === Cron ===

export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string; staggerMs?: number };

export type CronPayload =
  | { kind: "systemEvent"; text: string }
  | {
      kind: "agentTurn";
      message: string;
      model?: string;
      thinking?: string;
      timeoutSeconds?: number;
      deliver?: boolean;
      channel?: string;
      to?: string;
    };

export type CronDelivery = {
  mode: "none" | "announce" | "webhook";
  channel?: string;
  bestEffort?: boolean;
  to?: string;
};

export type CronJobState = {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
  consecutiveErrors?: number;
};

export type CronJob = {
  id: string;
  agentId?: string;
  sessionKey?: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: "main" | "isolated";
  wakeMode: "next-heartbeat" | "now";
  payload: CronPayload;
  delivery?: CronDelivery;
  state: CronJobState;
};

export type CronRunLogEntry = {
  ts: number;
  jobId: string;
  action: "finished";
  status?: "ok" | "error" | "skipped";
  error?: string;
  summary?: string;
  sessionId?: string;
  sessionKey?: string;
  runAtMs?: number;
  durationMs?: number;
  nextRunAtMs?: number;
};

// === Skills ===

export type SkillEntry = {
  key: string;
  name: string;
  enabled: boolean;
  version?: string;
  description?: string;
  installId?: string;
};

export type SkillStatusReport = {
  skills: SkillEntry[];
};

// === Nodes ===

export type NodeEntry = {
  id: string;
  name?: string;
  platform?: string;
  model?: string;
  connected: boolean;
  lastSeenAt?: number;
};

// === Config ===

export type ConfigSnapshot = {
  raw: string;
  hash: string;
  path?: string;
};

// === Usage ===

export type UsageStatus = {
  totalTokens: number;
  totalCost: number;
  activeSessions: number;
};

// === Rich Usage (sessions.usage) ===

export type SessionCostTotals = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  missingCostEntries: number;
};

export type SessionModelUsageEntry = {
  provider?: string;
  model?: string;
  count: number;
  totals: SessionCostTotals;
};

export type SessionMessageCounts = {
  total: number;
  user: number;
  assistant: number;
  toolCalls: number;
  toolResults: number;
  errors: number;
};

export type SessionToolEntry = {
  name: string;
  count: number;
};

export type SessionToolUsage = {
  totalCalls: number;
  uniqueTools: number;
  tools: SessionToolEntry[];
};

export type SessionLatencyStats = {
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
};

export type SessionDailyLatency = {
  date: string;
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
};

export type SessionDailyModelUsage = {
  date: string;
  provider?: string;
  model?: string;
  tokens: number;
  cost: number;
  count: number;
};

export type SessionsUsageAggregates = {
  messages: SessionMessageCounts;
  tools: SessionToolUsage;
  byModel: SessionModelUsageEntry[];
  byProvider: SessionModelUsageEntry[];
  byAgent: Array<{ agentId: string; totals: SessionCostTotals }>;
  byChannel: Array<{ channel: string; totals: SessionCostTotals }>;
  latency?: SessionLatencyStats;
  dailyLatency?: SessionDailyLatency[];
  modelDaily?: SessionDailyModelUsage[];
  daily: Array<{
    date: string;
    tokens: number;
    cost: number;
    messages: number;
    toolCalls: number;
    errors: number;
  }>;
};

export type SessionUsageEntry = {
  key: string;
  label?: string;
  sessionId?: string;
  updatedAt?: number;
  agentId?: string;
  channel?: string;
  chatType?: string;
  model?: string;
  modelProvider?: string;
  usage: {
    input: number;
    output: number;
    totalTokens: number;
    totalCost: number;
    messageCounts?: SessionMessageCounts;
    latency?: SessionLatencyStats;
  } | null;
};

export type SessionsUsageResult = {
  updatedAt: number;
  startDate: string;
  endDate: string;
  sessions: SessionUsageEntry[];
  totals: SessionCostTotals;
  aggregates: SessionsUsageAggregates;
};

export type SessionLogEntry = {
  role?: string;
  content?: string;
  timestamp?: number;
  type?: string;
  toolName?: string;
  toolCallId?: string;
  traceId?: string;
  spanId?: string;
  error?: string;
  model?: string;
  provider?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
};

// === Experiments ===

export type ExperimentVariant = {
  id: string;
  name: string;
  weight: number;
  participantCount: number;
};

export type ExperimentMetric = {
  name: string;
  control: number;
  treatment: number;
  delta: number;
  deltaPercent: number;
  significant: boolean;
};

export type Experiment = {
  id: string;
  name: string;
  description?: string;
  status: "active" | "completed" | "draft" | "paused";
  createdAt: number;
  updatedAt: number;
  variants: ExperimentVariant[];
  metrics: ExperimentMetric[];
};

// === Channels ===

export type ChannelAccount = {
  plugin: string;
  accountId: string;
  label?: string;
  status: "connected" | "disconnected" | "error" | "starting";
  error?: string;
  meta?: Record<string, unknown>;
  lastActivityAtMs?: number;
};

export type ChannelsStatusResult = {
  channelOrder: string[];
  channelLabels: Record<string, string>;
  channelAccounts: Record<string, ChannelAccount[]>;
};

// === Health ===

export type HealthSnapshot = Record<string, unknown>;
