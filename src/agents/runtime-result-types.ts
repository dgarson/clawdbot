/**
 * Shared result types for all agent runtimes.
 *
 * These types define the common contract for agent run results across
 * different execution backends (Pi Agent, Claude Agent SDK, etc.).
 */

import type { MessagingToolSend } from "./pi-embedded-messaging.js";
import type { SessionSystemPromptReport } from "../config/sessions/types.js";

/** Runtime backend discriminant for agent runs. */
export type AgentRuntimeKind = "pi" | "ccsdk";

/**
 * Simplified tool definition for client-provided tools (OpenResponses hosted tools).
 *
 * These tools are defined by external clients (e.g., via OpenResponses API) and
 * return "pending" results when called - execution is delegated back to the client.
 */
export type ClientToolDefinition = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

/**
 * Agent metadata returned from a run.
 *
 * Contains information about the session, provider, model, and token usage.
 */
export type AgentRunMeta = {
  /** Session ID for this run (provider-specific, used for session resumption). */
  sessionId: string;
  /** Provider that executed this run (e.g., "anthropic", "openai"). */
  provider: string;
  /** Model used for this run. */
  model: string;
  /** Runtime backend that executed this run. */
  runtime?: AgentRuntimeKind;
  /** Token usage statistics. */
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
};

/**
 * Metadata about an agent run execution.
 *
 * Contains timing, status, and error information.
 */
export type AgentRunResultMeta = {
  /** Duration of the run in milliseconds. */
  durationMs: number;
  /** Agent-specific metadata (session, provider, model, usage). */
  agentMeta?: AgentRunMeta;
  /** Whether the run was aborted. */
  aborted?: boolean;
  /** System prompt report for diagnostics. */
  systemPromptReport?: SessionSystemPromptReport;
  /** Error information if the run failed. */
  error?: {
    kind: "context_overflow" | "compaction_failure" | "role_ordering" | "image_size";
    message: string;
  };
  /** Stop reason for the agent run (e.g., "completed", "tool_calls"). */
  stopReason?: string;
  /** Pending tool calls when stopReason is "tool_calls". */
  pendingToolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
};

/**
 * Result payload from an agent run.
 */
export type AgentRunPayload = {
  /** Text content of the payload. */
  text?: string;
  /** Single media URL (legacy, prefer mediaUrls). */
  mediaUrl?: string;
  /** Media URLs attached to the payload. */
  mediaUrls?: string[];
  /** Message ID to reply to. */
  replyToId?: string;
  /** Whether this payload represents an error. */
  isError?: boolean;
};

/**
 * Complete result from an agent run.
 *
 * This is the shared result type returned by all agent runtimes.
 */
export type AgentRunResult = {
  /** Response payloads from the agent. */
  payloads?: AgentRunPayload[];
  /** Execution metadata. */
  meta: AgentRunResultMeta;
  /**
   * True if a messaging tool (telegram, whatsapp, discord, slack, sessions_send)
   * successfully sent a message. Used to suppress agent's confirmation text.
   */
  didSendViaMessagingTool?: boolean;
  /** Texts successfully sent via messaging tools during the run. */
  messagingToolSentTexts?: string[];
  /** Messaging tool targets that successfully sent a message during the run. */
  messagingToolSentTargets?: MessagingToolSend[];
};

/**
 * Sandbox/workspace configuration for agent runs.
 *
 * Describes the execution environment constraints and capabilities.
 */
export type AgentSandboxInfo = {
  /** Whether sandboxing is enabled. */
  enabled: boolean;
  /** Workspace directory path. */
  workspaceDir?: string;
  /** Workspace access level. */
  workspaceAccess?: "none" | "ro" | "rw";
  /** Mount point for agent workspace (when read-only). */
  agentWorkspaceMount?: string;
  /** Browser bridge URL for browser automation. */
  browserBridgeUrl?: string;
  /** NoVNC URL for browser viewing. */
  browserNoVncUrl?: string;
  /** Whether host browser control is allowed. */
  hostBrowserAllowed?: boolean;
  /** Elevated execution permissions. */
  elevated?: {
    allowed: boolean;
    defaultLevel: "on" | "off" | "ask" | "full";
  };
};
