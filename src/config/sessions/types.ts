import crypto from "node:crypto";
import type { Skill } from "@mariozechner/pi-coding-agent";
import type { ChatType } from "../../channels/chat-type.js";
import type { ChannelId } from "../../channels/plugins/types.js";
import type { DeliveryContext } from "../../utils/delivery-context.js";
import type { TtsAutoMode } from "../types.tts.js";

export type SessionScope = "per-sender" | "global";

export type SessionChannelId = ChannelId | "webchat";

export type SessionChatType = ChatType;

export type SessionOrigin = {
  label?: string;
  provider?: string;
  surface?: string;
  chatType?: SessionChatType;
  from?: string;
  to?: string;
  accountId?: string;
  threadId?: string | number;
};

export type SessionEntry = {
  /**
   * Last delivered heartbeat payload (used to suppress duplicate heartbeat notifications).
   * Stored on the main session entry.
   */
  lastHeartbeatText?: string;
  /** Timestamp (ms) when lastHeartbeatText was delivered. */
  lastHeartbeatSentAt?: number;
  sessionId: string;
  updatedAt: number;
  sessionFile?: string;
  /** Parent session key that spawned this session (used for sandbox session-tool scoping). */
  spawnedBy?: string;
  /** Subagent spawn depth (0 = main, 1 = sub-agent, 2 = sub-sub-agent). */
  spawnDepth?: number;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  chatType?: SessionChatType;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
  elevatedLevel?: string;
  ttsAuto?: TtsAutoMode;
  execHost?: string;
  execSecurity?: string;
  execAsk?: string;
  execNode?: string;
  responseUsage?: "on" | "off" | "tokens" | "full";
  providerOverride?: string;
  modelOverride?: string;
  authProfileOverride?: string;
  authProfileOverrideSource?: "auto" | "user";
  authProfileOverrideCompactionCount?: number;
  groupActivation?: "mention" | "always";
  groupActivationNeedsSystemIntro?: boolean;
  sendPolicy?: "allow" | "deny";
  queueMode?:
    | "steer"
    | "followup"
    | "collect"
    | "steer-backlog"
    | "steer+backlog"
    | "queue"
    | "interrupt";
  queueDebounceMs?: number;
  queueCap?: number;
  queueDrop?: "old" | "new" | "summarize";
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  /**
   * Whether totalTokens reflects a fresh context snapshot for the latest run.
   * Undefined means legacy/unknown freshness; false forces consumers to treat
   * totalTokens as stale/unknown for context-utilization displays.
   */
  totalTokensFresh?: boolean;
  cacheRead?: number;
  cacheWrite?: number;
  modelProvider?: string;
  model?: string;
  /**
   * Last selected/runtime model pair for which a fallback notice was emitted.
   * Used to avoid repeating the same fallback notice every turn.
   */
  fallbackNoticeSelectedModel?: string;
  fallbackNoticeActiveModel?: string;
  fallbackNoticeReason?: string;
  contextTokens?: number;
  compactionCount?: number;
  memoryFlushAt?: number;
  memoryFlushCompactionCount?: number;
  cliSessionIds?: Record<string, string>;
  claudeCliSessionId?: string;
  label?: string;
  /** Structured classification from the auto-label LLM pass. */
  classification?: SessionClassification;
  displayName?: string;
  channel?: string;
  groupId?: string;
  subject?: string;
  groupChannel?: string;
  space?: string;
  origin?: SessionOrigin;
  deliveryContext?: DeliveryContext;
  lastChannel?: SessionChannelId;
  lastTo?: string;
  lastAccountId?: string;
  lastThreadId?: string | number;
  skillsSnapshot?: SessionSkillSnapshot;
  systemPromptReport?: SessionSystemPromptReport;
  modelSelectionTrace?: SessionModelSelectionTrace;
};

export function mergeSessionEntry(
  existing: SessionEntry | undefined,
  patch: Partial<SessionEntry>,
): SessionEntry {
  const sessionId = patch.sessionId ?? existing?.sessionId ?? crypto.randomUUID();
  const updatedAt = Math.max(existing?.updatedAt ?? 0, patch.updatedAt ?? 0, Date.now());
  if (!existing) {
    return { ...patch, sessionId, updatedAt };
  }
  return { ...existing, ...patch, sessionId, updatedAt };
}

export function resolveFreshSessionTotalTokens(
  entry?: Pick<SessionEntry, "totalTokens" | "totalTokensFresh"> | null,
): number | undefined {
  const total = entry?.totalTokens;
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0) {
    return undefined;
  }
  if (entry?.totalTokensFresh === false) {
    return undefined;
  }
  return total;
}

export function isSessionTotalTokensFresh(
  entry?: Pick<SessionEntry, "totalTokens" | "totalTokensFresh"> | null,
): boolean {
  return resolveFreshSessionTotalTokens(entry) !== undefined;
}

export type GroupKeyResolution = {
  key: string;
  channel?: string;
  id?: string;
  chatType?: SessionChatType;
};

// =============================================================================
// Session Classification
// =============================================================================

/** Broad thematic topic inferred from the first user message. */
export type SessionTopic =
  | "coding"
  | "research"
  | "ops"
  | "conversation"
  | "creative"
  | "debugging"
  | "config"
  | "other";

/**
 * Five-tier complexity scale inferred from the first user message.
 * - trivial:  single-shot factual answers, greetings, config lookups
 * - simple:   single-file edits, straightforward Q&A with one tool call
 * - moderate: multi-file changes, requires reading context before acting
 * - hard:     cross-cutting refactors, multi-step debugging, architecture decisions
 * - complex:  system design, multi-service coordination, novel problem-solving
 */
export type SessionComplexity = "trivial" | "simple" | "moderate" | "hard" | "complex";

/**
 * Structured classification produced by the session auto-label LLM call.
 * Persisted alongside the human-readable label for use by prompt contributors,
 * tool routing, analytics, and plugin hooks.
 */
export type SessionClassification = {
  /** Short topic bucket inferred from the conversation opener. */
  topic: SessionTopic;
  /** Estimated complexity of the task. */
  complexity: SessionComplexity;
  /** 0-3 short domain tags (e.g. ["frontend","react"], ["devops","k8s"]). */
  domain: string[];
  /** 0-2 notable attributes (e.g. ["security-sensitive","multi-file"]). */
  flags: string[];
  /** ISO timestamp when classification was produced. */
  classifiedAt: number;
};

export type SessionSkillSnapshot = {
  prompt: string;
  skills: Array<{ name: string; primaryEnv?: string; requiredEnv?: string[] }>;
  /** Normalized agent-level filter used to build this snapshot; undefined means unrestricted. */
  skillFilter?: string[];
  resolvedSkills?: Skill[];
  version?: number;
};

export type SessionSystemPromptReport = {
  source: "run" | "estimate";
  generatedAt: number;
  sessionId?: string;
  sessionKey?: string;
  provider?: string;
  model?: string;
  workspaceDir?: string;
  bootstrapMaxChars?: number;
  bootstrapTotalMaxChars?: number;
  sandbox?: {
    mode?: string;
    sandboxed?: boolean;
  };
  systemPrompt: {
    chars: number;
    projectContextChars: number;
    nonProjectContextChars: number;
  };
  injectedWorkspaceFiles: Array<{
    name: string;
    path: string;
    missing: boolean;
    rawChars: number;
    injectedChars: number;
    truncated: boolean;
  }>;
  skills: {
    promptChars: number;
    entries: Array<{ name: string; blockChars: number }>;
  };
  tools: {
    listChars: number;
    schemaChars: number;
    entries: Array<{
      name: string;
      summaryChars: number;
      schemaChars: number;
      propertiesCount?: number | null;
    }>;
  };
};

export type SessionModelSelectionTraceStep = {
  source: "config.default" | "agent.primary" | "session.override" | "allowlist.guard" | "final";
  applied: boolean;
  provider?: string;
  model?: string;
  detail?: string;
};

export type SessionModelSelectionTraceAttempt = {
  attempt: number;
  provider: string;
  model: string;
  outcome: "failed" | "skipped" | "selected";
  reason?: string;
  status?: number;
  code?: string;
  error?: string;
  at: number;
};

export type SessionModelSelectionTrace = {
  version: 1;
  runId?: string;
  generatedAt: number;
  agentId?: string;
  sessionKey?: string;
  selected: { provider: string; model: string };
  active?: { provider: string; model: string };
  steps: SessionModelSelectionTraceStep[];
  fallback?: {
    enabled: boolean;
    configured?: string[];
    attempts?: SessionModelSelectionTraceAttempt[];
  };
};

export const DEFAULT_RESET_TRIGGER = "/new";
export const DEFAULT_RESET_TRIGGERS = ["/new", "/reset"];
export const DEFAULT_IDLE_MINUTES = 60;
