import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ClaudeSdkConfig } from "../../config/zod-schema.agent-runtime.js";
import type { ResolvedProviderAuth } from "../model-auth.js";
import type { EmbeddedPiSubscribeEvent } from "../pi-embedded-subscribe.handlers.types.js";

// ---------------------------------------------------------------------------
// Minimal tool interface compatible with both AnyAgentTool (4-param execute)
// and ToolDefinition from @mariozechner/pi-coding-agent (5-param execute with
// ExtensionContext). The MCP tool server only uses name, description,
// parameters, and execute — so we avoid importing either full type here.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClaudeSdkCompatibleTool = {
  name: string;
  description?: string | null;
  parameters: Record<string, unknown> | { [key: symbol]: unknown };
  ownerOnly?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (...args: any[]) => Promise<unknown>;
};

// ---------------------------------------------------------------------------
// Session creation params — passed from attempt.ts to createClaudeSdkSession()
// ---------------------------------------------------------------------------

export type ClaudeSdkSessionParams = {
  workspaceDir: string;
  agentDir?: string;
  sessionId: string;
  modelId: string;
  tools: ClaudeSdkCompatibleTool[];
  customTools: ClaudeSdkCompatibleTool[];
  systemPrompt: string;
  thinkLevel?: string;
  extraParams?: Record<string, unknown>;
  /** Additional MCP servers to expose to the Claude Agent SDK alongside the
   *  built-in "openclaw-tools" bridge. Keyed by server name. If a caller
   *  includes "openclaw-tools" here it will be overwritten by the internal bridge. */
  mcpServers?: Record<string, unknown>;
  /** Claude Agent SDK session ID to resume. Loaded from SessionManager custom entry. */
  claudeSdkResumeSessionId?: string;
  /** Resolved claudeSdk provider config from agents config. Defaults to claude-code. */
  claudeSdkConfig?: ClaudeSdkConfig;
  /** Full auth object resolved via OpenClaw auth profiles (authStorage.getApiKey()). */
  resolvedProviderAuth?: ResolvedProviderAuth;
  /** SessionManager instance for persisting the claude SDK session ID and messages. */
  sessionManager?: {
    appendCustomEntry?: (key: string, value: unknown) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getEntries?: () => Array<{ type: string; customType?: string; data?: unknown }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appendMessage?: (message: any) => string;
  };
};

// ---------------------------------------------------------------------------
// Session interface — duck-typed to match Pi's AgentSession surface
// ---------------------------------------------------------------------------

export type ClaudeSdkSession = {
  subscribe(handler: (evt: EmbeddedPiSubscribeEvent) => void): () => void;
  prompt(
    text: string,
    options?: { images?: Array<{ type: string; media_type: string; data: string }> },
  ): Promise<void>;
  steer(text: string): Promise<void>;
  abort(): void;
  abortCompaction(): void;
  dispose(): void;
  readonly isStreaming: boolean;
  readonly isCompacting: boolean;
  readonly messages: AgentMessage[];
  readonly sessionId: string;
  /** Claude Agent SDK server-side session ID, set after first prompt. */
  readonly claudeSdkSessionId: string | undefined;
  readonly agent: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    streamFn: any;
    replaceMessages(messages: AgentMessage[]): void;
  };
};

// ---------------------------------------------------------------------------
// Internal event adapter state
// ---------------------------------------------------------------------------

export type ClaudeSdkEventAdapterState = {
  subscribers: Array<(evt: EmbeddedPiSubscribeEvent) => void>;
  streaming: boolean;
  compacting: boolean;
  abortController: AbortController | null;
  pendingSteer: string[];
  messages: AgentMessage[];
  claudeSdkSessionId: string | undefined;
  /** Set when the SDK yields a result message with an error subtype. The
   *  prompt() method throws this after the for-await loop so callers receive
   *  a proper rejection rather than a silent successful resolution. */
  sdkResultError: string | undefined;
  /** Last stderr output captured from the Claude Code subprocess.
   *  Attached to process-exit errors for actionable diagnostics. */
  lastStderr: string | undefined;
  /** Maps content_block_start index to block type so content_block_stop knows what to emit. */
  streamingBlockTypes: Map<number, string>;
  /** Accumulated partial message built up during streaming, used as `message` field in Pi events. */
  streamingPartialMessage: {
    role: "assistant";
    content: unknown[];
    usage?: unknown;
    model?: string;
  } | null;
  /** Set true on stream message_start; used by assistant handler to skip re-emitting events. */
  streamingInProgress: boolean;
  /** SessionManager reference for JSONL persistence. */
  sessionManager?: {
    appendCustomEntry?: (key: string, value: unknown) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getEntries?: () => Array<{ type: string; customType?: string; data?: unknown }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appendMessage?: (message: any) => string;
  };
  /** Whether to enable Claude Code built-in web search tool. */
  enableClaudeWebSearch?: boolean;
};

// ---------------------------------------------------------------------------
// MCP tool server params
// ---------------------------------------------------------------------------

export type ClaudeSdkMcpToolServerParams = {
  tools: ClaudeSdkCompatibleTool[];
  emitEvent: (evt: EmbeddedPiSubscribeEvent) => void;
  getAbortSignal: () => AbortSignal | undefined;
  sessionManager?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appendMessage?: (message: any) => string;
  };
};
