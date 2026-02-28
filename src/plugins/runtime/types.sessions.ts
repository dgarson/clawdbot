/**
 * Session read API types for `runtime.sessions` (P5).
 * Extracted from runtime/types.ts to keep that file focused on the core
 * PluginRuntime interface shape.
 */

/** Lightweight session descriptor returned by `runtime.sessions.list()`. */
export type PluginSessionEntry = {
  sessionId: string;
  agentId?: string;
  filePath: string;
  /** First user message content (truncated to ~100 chars), if available. */
  firstUserMessage?: string;
  mtimeMs?: number;
};

/** Usage/cost summary returned by `runtime.sessions.getUsageSummary()`. */
export type PluginSessionUsageSummary = {
  totalTokens?: number;
  totalCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  firstActivityMs?: number;
  lastActivityMs?: number;
  turnCount?: number;
  toolCallCount?: number;
};
