import type { MemoryTemporalMetadata } from "../models/memory.js";

export type MemClawdIngestEventType =
  | "agent.tool_use"
  | "agent.compaction"
  | "agent.session_end"
  | "agent.session_start"
  | "agent.message"
  | "agent.note"
  | "agent.memory"
  | "agent.system";

export type MemClawdEventSource = "hook" | "tool" | "system" | "scheduler" | "manual";

export type ToolUsePayload = {
  toolName: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  durationMs?: number;
  success?: boolean;
  error?: string;
};

export type CompactionPayload = {
  summary: string;
  tokensBefore?: number;
  tokensAfter?: number;
  compactedAt: string;
};

export type SessionLifecyclePayload = {
  sessionId?: string;
  sessionKey?: string;
  sessionKeyCrn?: string;
  channel?: string;
  startedAt?: string;
  endedAt?: string;
  reason?: string;
};

export type MessagePayload = {
  messageId?: string;
  role: "user" | "assistant" | "system" | (string & {});
  content: string;
  channel?: string;
  senderId?: string;
  receivedAt: string;
  temporal?: MemoryTemporalMetadata;
};

export type MemClawdIngestEventPayload =
  | ToolUsePayload
  | CompactionPayload
  | SessionLifecyclePayload
  | MessagePayload
  | Record<string, unknown>;

export type MemClawdIngestEvent<TPayload = MemClawdIngestEventPayload> = {
  id: string;
  type: MemClawdIngestEventType;
  occurredAt: string;
  source: MemClawdEventSource;
  agentId?: string;
  sessionId?: string;
  sessionKey?: string;
  sessionKeyCrn?: string;
  traceId?: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
};
