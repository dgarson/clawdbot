/**
 * Helper types for Claude SDK runner.
 *
 * These mirror Pi embedded types as needed for internal state tracking
 * without duplicating the public contracts (which live in pi-embedded-runner/).
 */

import type { AnyAgentTool } from "../pi-tools.types.js";
import type { MessagingToolSend } from "../pi-embedded-messaging.js";

/** Content block type for per-block tracking */
export type ContentBlockType = "text" | "thinking" | "tool_use" | "unknown";

/** Per-block state tracking */
export type ContentBlockState = {
  type: ContentBlockType;
  content: string;
};

/** Internal state for tracking run progress. */
export type ClaudeSdkRunState = {
  assistantTexts: string[];
  toolMetas: Array<{ toolName: string; meta?: string }>;
  toolMetaById: Map<string, string | undefined>;
  lastToolError?: { toolName: string; meta?: string; error?: string };
  messagingToolSentTexts: string[];
  messagingToolSentTextsNormalized: string[];
  messagingToolSentTargets: MessagingToolSend[];
  pendingMessagingTexts: Map<string, string>;
  pendingMessagingTargets: Map<string, MessagingToolSend>;
  // Per-block tracking (index → block state)
  contentBlocks: Map<number, ContentBlockState>;
  // Current active block index for text accumulation
  currentTextBlockIndex: number | null;
  // Separate buffers for text and thinking
  deltaBuffer: string;
  thinkingBuffer: string;
  // Accumulated thinking for reasoningMode="on" (non-streaming)
  accumulatedThinking: string;
  lastStreamedAssistant?: string;
  aborted: boolean;
  timedOut: boolean;
};

/** Tool definition compatible with the Claude Agent SDK MCP bridge. */
export type ClaudeSdkTool = AnyAgentTool;

/** Usage stats from the SDK run. */
export type ClaudeSdkUsage = {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

/** Result from the SDK session (before payload conversion). */
export type ClaudeSdkSessionResult = {
  assistantTexts: string[];
  toolMetas: Array<{ toolName: string; meta?: string }>;
  lastToolError?: { toolName: string; meta?: string; error?: string };
  usage?: ClaudeSdkUsage;
  sessionId: string;
  model: string;
  provider: string;
  aborted: boolean;
  timedOut: boolean;
  messagingToolSentTexts: string[];
  messagingToolSentTargets: MessagingToolSend[];
  didSendViaMessagingTool: boolean;
  stopReason?: string;
  errorMessage?: string;
  // Accumulated thinking/reasoning content (for reasoningMode="on")
  accumulatedThinking?: string;
};
