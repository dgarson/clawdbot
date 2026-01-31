/**
 * Agent runtime abstraction layer.
 *
 * Defines the common interface for agent execution backends (Pi Agent, Claude Agent SDK, etc.).
 *
 * ## Session Persistence
 *
 * Session persistence (writing conversation history to JSONL files) is handled
 * differently by each runtime:
 *
 * - **Pi-Agent**: The `@mariozechner/pi-coding-agent` library internally manages
 *   session persistence via `SessionManager.appendMessage()`. The runtime wrapper
 *   passes the `sessionFile` path, and the library handles writing.
 *
 * - **CCSDK**: The runtime wrapper is responsible for writing to Moltbot's session
 *   format. As the SDK emits events (assistant messages, tool calls, tool results),
 *   the wrapper must translate them to `SessionManager.appendMessage()` calls to
 *   maintain compatibility with Moltbot's session JSONL format.
 *
 * ## Callbacks vs Session Writing
 *
 * The callbacks in `AgentRuntimeCallbacks` (onBlockReply, onToolResult, etc.) are
 * for **streaming output to messaging channels**, NOT for session persistence.
 * Session persistence happens via direct `SessionManager` writes, not callbacks.
 */

import type { ImageContent } from "@mariozechner/pi-ai";
import type { MoltbotConfig } from "../config/config.js";
import type { CcSdkModelTiers } from "../config/types.agents.js";
import type { AgentStreamParams } from "../commands/agent/types.js";
import type { ReasoningLevel, ThinkLevel, VerboseLevel } from "../auto-reply/thinking.js";
import type { ExecElevatedDefaults, ExecToolDefaults } from "./bash-tools.js";
import type { BlockReplyChunking, ToolResultFormat } from "./pi-embedded-subscribe.js";
import type { SkillSnapshot } from "./skills.js";
import type {
  AgentRunResult,
  AgentRuntimeKind,
  AgentSandboxInfo,
  ClientToolDefinition,
} from "./runtime-result-types.js";

// Re-export shared result types for convenience
export type {
  AgentRunResult,
  AgentRunMeta,
  AgentRunResultMeta,
  AgentRuntimeKind,
  ClientToolDefinition,
} from "./runtime-result-types.js";

/** Result type shared by all agent runtimes. */
export type AgentRuntimeResult = AgentRunResult;

/** Streaming and event callbacks for agent runs. */
export type AgentRuntimeCallbacks = {
  /** Called when a partial reply chunk is available. */
  onPartialReply?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  /** Called when the assistant message starts. */
  onAssistantMessageStart?: () => void | Promise<void>;
  /** Called for block-level reply delivery. */
  onBlockReply?: (payload: {
    text?: string;
    mediaUrls?: string[];
    audioAsVoice?: boolean;
    replyToId?: string;
    replyToTag?: boolean;
    replyToCurrent?: boolean;
  }) => void | Promise<void>;
  /** Called when block replies should be flushed. */
  onBlockReplyFlush?: () => void | Promise<void>;
  /** Called for reasoning/thinking stream events. */
  onReasoningStream?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  /** Called when a tool result is available. */
  onToolResult?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  /** Called for agent lifecycle and internal events. */
  onAgentEvent?: (evt: { stream: string; data: Record<string, unknown> }) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Runtime-specific option bags
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pi runtime-specific options.
 *
 * These fields are only applicable to the Pi Agent runtime and are not
 * generalizable to other runtimes.
 */
export type PiRuntimeOptions = {
  /** Whether to enforce final XML tag in responses. */
  enforceFinalTag?: boolean;
};

/**
 * CCSDK runtime-specific options.
 *
 * These fields are only applicable to the Claude Code SDK runtime.
 */
export type CcSdkRuntimeOptions = {
  /** Enable Claude Code lifecycle hooks (pre-tool, post-tool, etc.). */
  hooksEnabled?: boolean;
  /** Additional SDK options passed to the runner. */
  sdkOptions?: Record<string, unknown>;
  /** 3-tier model configuration for Claude Code SDK. */
  modelTiers?: CcSdkModelTiers;
  /** Fork the session instead of continuing it. */
  forkSession?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Common parameters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Common parameters for agent run invocations.
 *
 * This type contains:
 * 1. Core fields required by all runtimes
 * 2. Generalized fields that both runtimes can use
 * 3. Runtime-specific option bags for non-generalizable features
 */
export type AgentRuntimeRunParams = {
  // ─── Core fields (required by all runtimes) ─────────────────────────────────
  sessionId: string;
  sessionKey?: string;
  sessionFile: string;
  workspaceDir: string;
  agentDir?: string;
  config?: MoltbotConfig;
  skillsSnapshot?: SkillSnapshot;
  prompt: string;
  images?: ImageContent[];
  provider?: string;
  model?: string;
  authProfileId?: string;
  authProfileIdSource?: "auto" | "user";
  thinkLevel?: ThinkLevel;
  verboseLevel?: VerboseLevel;
  timeoutMs: number;
  runId: string;
  lane?: string;
  abortSignal?: AbortSignal;
  extraSystemPrompt?: string;
  streamParams?: AgentStreamParams;

  // ─── Messaging context (used by both runtimes for routing/context) ──────────
  /** Messaging channel identifier (e.g., "telegram", "discord"). */
  messageChannel?: string;
  /** Message provider identifier (e.g., "telegram", "discord"). */
  messageProvider?: string;
  /** Agent account identifier for multi-account routing. */
  agentAccountId?: string;
  /** Delivery target (e.g. telegram:group:123:topic:456). */
  messageTo?: string;
  /** Thread/topic identifier for routing replies to the originating thread. */
  messageThreadId?: string | number;
  /** Group id for channel-level tool policy resolution. */
  groupId?: string | null;
  /** Group channel label (e.g. #general). */
  groupChannel?: string | null;
  /** Group space label (e.g. guild/team id). */
  groupSpace?: string | null;
  /** Parent session key for subagent policy inheritance. */
  spawnedBy?: string | null;
  /** Current channel ID for auto-threading (Slack). */
  currentChannelId?: string;
  /** Current thread timestamp for auto-threading (Slack). */
  currentThreadTs?: string;
  /** Reply-to mode for Slack auto-threading. */
  replyToMode?: "off" | "first" | "all";
  /** Mutable ref to track if a reply was sent (for "first" mode). */
  hasRepliedRef?: { value: boolean };

  // ─── Sender context (both runtimes can use for system prompt enrichment) ────
  /** Sender identifier. */
  senderId?: string | null;
  /** Sender display name. */
  senderName?: string | null;
  /** Sender username. */
  senderUsername?: string | null;
  /** Sender E.164 phone number. */
  senderE164?: string | null;

  // ─── Generalized fields (applicable to both runtimes) ───────────────────────
  /** Reasoning level for streaming reasoning events. */
  reasoningLevel?: ReasoningLevel;
  /** Tool result format (markdown or plain). */
  toolResultFormat?: ToolResultFormat;
  /** Block reply break mode (text_end or message_end). */
  blockReplyBreak?: "text_end" | "message_end";
  /** Block reply chunking settings. */
  blockReplyChunking?: BlockReplyChunking;
  /** Callback to determine if tool results should be emitted. */
  shouldEmitToolResult?: () => boolean;
  /** Callback to determine if tool output should be emitted. */
  shouldEmitToolOutput?: () => boolean;
  /** Owner phone numbers for access control. */
  ownerNumbers?: string[];
  /** Provider session ID for session resumption (used by CLI providers and CCSDK). */
  providerSessionId?: string;
  /** Sandbox/workspace configuration for agent runs. */
  sandboxInfo?: AgentSandboxInfo;
  /** Bash/exec elevated execution defaults. Controls where exec commands run (sandbox vs host). */
  bashElevated?: ExecElevatedDefaults;
  /** Exec tool overrides (host, security, ask, node). Shared by both runtimes. */
  execOverrides?: Pick<ExecToolDefaults, "host" | "security" | "ask" | "node">;
  /** Client-provided tools (OpenResponses hosted tools). Applicable to both runtimes. */
  clientTools?: ClientToolDefinition[];

  // ─── Runtime-specific option bags ───────────────────────────────────────────
  /** Pi runtime-specific options. */
  piOptions?: PiRuntimeOptions;
  /** CCSDK runtime-specific options. */
  ccsdkOptions?: CcSdkRuntimeOptions;
} & AgentRuntimeCallbacks;

/**
 * Agent runtime interface.
 *
 * Defines the contract for executing agent turns across different backends.
 */
export interface AgentRuntime {
  /** Runtime backend discriminant. */
  readonly kind: AgentRuntimeKind;
  /** Human-readable display name for the runtime. */
  readonly displayName: string;
  /** Execute an agent turn with the given parameters. */
  run(params: AgentRuntimeRunParams): Promise<AgentRuntimeResult>;
}
