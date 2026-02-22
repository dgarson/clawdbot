/**
 * Telemetry Extension — Type Definitions
 *
 * Structured telemetry event schema for agent session observability.
 */

export interface TelemetryEvent {
  /** UUID for this event */
  eventId: string;
  /** ISO 8601 timestamp */
  timestamp: string;

  // ── Source ──────────────────────────────────────────────────────────
  agentId: string;
  sessionKey: string;
  sessionKind: "direct" | "cron" | "subagent" | "heartbeat" | "unknown";
  parentSessionKey?: string;

  // ── Event Type ─────────────────────────────────────────────────────
  eventType: "session_start" | "session_end" | "agent_end" | "model_usage";

  // ── Model ──────────────────────────────────────────────────────────
  model?: string;
  provider?: string;

  // ── Usage ──────────────────────────────────────────────────────────
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;

  // ── Outcome ────────────────────────────────────────────────────────
  status?: "success" | "error" | "timeout" | "aborted";
  durationMs?: number;
  toolCallCount?: number;
  errorMessage?: string;
  messageCount?: number;

  // ── Context ────────────────────────────────────────────────────────
  channel?: string;
  taskLabel?: string;
}

export interface TelemetrySinkConfig {
  /** Write JSON events to a file (one JSON object per line) */
  file?: string;
  /** Write JSON events to stdout */
  stdout?: boolean;
}

export interface TelemetryConfig {
  /** Enable/disable the telemetry extension */
  enabled: boolean;
  /** Sink configuration */
  sink: TelemetrySinkConfig;
}
