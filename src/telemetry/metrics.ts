/**
 * OpenTelemetry Metrics instruments for OpenClaw.
 *
 * Pre-creates all metric instruments so callers can import and record
 * without touching the OTel API directly. When OTel is disabled,
 * the API returns no-op instruments (zero overhead).
 *
 * Metric naming follows Prometheus conventions (snake_case, unit suffix).
 */

import {
  metrics,
  type Meter,
  type Counter,
  type Histogram,
  type UpDownCounter,
} from "@opentelemetry/api";

const DEFAULT_METER_NAME = "openclaw";

/**
 * Return the OpenTelemetry Meter for the given instrumentation scope.
 * Falls back to a no-op meter when the SDK is not initialized.
 */
export function getMeter(name?: string): Meter {
  return metrics.getMeter(name ?? DEFAULT_METER_NAME);
}

// ── Instrument types ──────────────────────────────────────────────────

export type OpenClawMetrics = {
  /** Histogram of session wall-clock duration in seconds. */
  sessionDuration: Histogram;
  /** Counter of total tokens consumed (input + output, by type label). */
  sessionTokens: Counter;
  /** Histogram of session cost in USD. */
  sessionCost: Histogram;
  /** Counter of tool invocations by tool name + status. */
  toolCalls: Counter;
  /** Counter of model/provider errors by error type. */
  modelErrors: Counter;
  /** Up/down gauge of currently active agent sessions. */
  activeSessions: UpDownCounter;
};

// ── Lazy singleton ────────────────────────────────────────────────────

let cached: OpenClawMetrics | undefined;

/**
 * Return the pre-created metric instruments.
 *
 * Instruments are created lazily on first call and reused thereafter.
 * When the OTel SDK is not initialized, the returned instruments are
 * no-op (recording is silently dropped — zero overhead).
 */
export function getMetrics(): OpenClawMetrics {
  if (cached) {
    return cached;
  }

  const meter = getMeter();

  cached = {
    sessionDuration: meter.createHistogram("openclaw_session_duration_seconds", {
      description: "Agent session wall-clock duration in seconds",
      unit: "s",
    }),

    sessionTokens: meter.createCounter("openclaw_session_tokens_total", {
      description: "Total tokens consumed by agent sessions",
      unit: "{token}",
    }),

    sessionCost: meter.createHistogram("openclaw_session_cost_usd", {
      description: "Session cost in USD",
      unit: "USD",
    }),

    toolCalls: meter.createCounter("openclaw_tool_calls_total", {
      description: "Total tool invocations",
    }),

    modelErrors: meter.createCounter("openclaw_model_errors_total", {
      description: "Total model/provider errors",
    }),

    activeSessions: meter.createUpDownCounter("openclaw_agent_active_sessions", {
      description: "Currently active agent sessions",
    }),
  };

  return cached;
}

// ── Convenience recording helpers ─────────────────────────────────────

export type SessionMetricAttrs = {
  agent: string;
  model: string;
  kind?: string;
  provider?: string;
};

/** Record session start (increment active counter). */
export function recordSessionStart(attrs: { agent: string }): void {
  getMetrics().activeSessions.add(1, { agent: attrs.agent });
}

/** Record session end (decrement active counter + record duration). */
export function recordSessionEnd(attrs: SessionMetricAttrs & { durationSec: number }): void {
  const m = getMetrics();
  m.activeSessions.add(-1, { agent: attrs.agent });
  m.sessionDuration.record(attrs.durationSec, {
    agent: attrs.agent,
    model: attrs.model,
    kind: attrs.kind ?? "default",
  });
}

/** Record token usage for a session. */
export function recordTokenUsage(attrs: {
  agent: string;
  model: string;
  provider: string;
  input: number;
  output: number;
}): void {
  const m = getMetrics();
  const base = { agent: attrs.agent, model: attrs.model, provider: attrs.provider };
  m.sessionTokens.add(attrs.input, { ...base, type: "input" });
  m.sessionTokens.add(attrs.output, { ...base, type: "output" });
}

/** Record session cost. */
export function recordSessionCost(attrs: {
  agent: string;
  model: string;
  provider: string;
  costUsd: number;
}): void {
  getMetrics().sessionCost.record(attrs.costUsd, {
    agent: attrs.agent,
    model: attrs.model,
    provider: attrs.provider,
  });
}

/** Record a tool call. */
export function recordToolCall(attrs: {
  tool: string;
  status: "success" | "error";
  agent: string;
}): void {
  getMetrics().toolCalls.add(1, {
    tool: attrs.tool,
    status: attrs.status,
    agent: attrs.agent,
  });
}

/** Record a model error. */
export function recordModelError(attrs: { model: string; errorType: string; agent: string }): void {
  getMetrics().modelErrors.add(1, {
    model: attrs.model,
    error_type: attrs.errorType,
    agent: attrs.agent,
  });
}

/**
 * Reset the cached metrics singleton (for tests).
 * @internal
 */
export function resetMetricsCache(): void {
  cached = undefined;
}
