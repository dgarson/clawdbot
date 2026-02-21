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
