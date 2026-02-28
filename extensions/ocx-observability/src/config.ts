/**
 * Plugin configuration type and defaults for the observability plugin.
 */

import type { HealthCriteria, SuppressionRule } from "./types.js";

// =============================================================================
// Plugin Config
// =============================================================================

export type ObservabilityConfig = {
  /** OTLP HTTP endpoint (default: http://localhost:4318) */
  otlpEndpoint: string;
  /** OTLP protocol: "http" or "grpc" (default: "http") */
  otlpProtocol: "http" | "grpc";
  /** OTEL service name (default: "openclaw-agents") */
  serviceName: string;

  /** Interval between health evaluations in seconds (default: 30) */
  healthCheckIntervalSeconds: number;

  /** Health criteria thresholds */
  criteria: HealthCriteria;

  /** Enable reaper policy engine (default: true) */
  reaperEnabled: boolean;
  /** Path to custom reaper policies JSON file */
  reaperPoliciesFile: string;

  /** Default suppression cooldown in minutes (default: 15) */
  suppressionCooldownMinutes: number;
  /** Default maximum alerts per hour (default: 10) */
  maxAlertsPerHour: number;
};

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_HEALTH_CRITERIA: HealthCriteria = {
  stuckTimeoutMinutes: 15,
  tokenSpikeMultiplier: 3.0,
  tokenMovingAvgWindowMinutes: 60,
  errorRateThreshold: 0.2,
  errorRateWindowMinutes: 30,
  budgetDegradedThreshold: 0.8,
  maxConsecutiveToolFailures: 5,
  toolLoopCallThreshold: 10,
  toolLoopWindowMinutes: 5,
};

export const DEFAULT_SUPPRESSION_RULES: SuppressionRule[] = [
  { signalKind: "token_spike", cooldownMinutes: 15, maxPerHour: 4 },
  { signalKind: "error_burst", cooldownMinutes: 10, maxPerHour: 6 },
  { signalKind: "tool_loop", cooldownMinutes: 5, maxPerHour: 12 },
  { signalKind: "cost_spike", cooldownMinutes: 60, maxPerHour: 1 },
];

export const DEFAULT_CONFIG: ObservabilityConfig = {
  otlpEndpoint: "http://localhost:4318",
  otlpProtocol: "http",
  serviceName: "openclaw-agents",
  healthCheckIntervalSeconds: 30,
  criteria: DEFAULT_HEALTH_CRITERIA,
  reaperEnabled: true,
  reaperPoliciesFile: "reaper-policies.json",
  suppressionCooldownMinutes: 15,
  maxAlertsPerHour: 10,
};

// =============================================================================
// Config Resolution
// =============================================================================

/** Merge raw plugin config with defaults. */
export function resolveConfig(raw: Record<string, unknown>): ObservabilityConfig {
  const protocol = raw.otlpProtocol === "grpc" ? ("grpc" as const) : ("http" as const);

  const criteria: HealthCriteria = {
    stuckTimeoutMinutes: asNumber(
      raw.stuckTimeoutMinutes,
      DEFAULT_HEALTH_CRITERIA.stuckTimeoutMinutes,
    ),
    tokenSpikeMultiplier: asNumber(
      raw.tokenSpikeMultiplier,
      DEFAULT_HEALTH_CRITERIA.tokenSpikeMultiplier,
    ),
    tokenMovingAvgWindowMinutes: asNumber(
      raw.tokenMovingAvgWindowMinutes,
      DEFAULT_HEALTH_CRITERIA.tokenMovingAvgWindowMinutes,
    ),
    errorRateThreshold: asNumber(
      raw.errorRateThreshold,
      DEFAULT_HEALTH_CRITERIA.errorRateThreshold,
    ),
    errorRateWindowMinutes: asNumber(
      raw.errorRateWindowMinutes,
      DEFAULT_HEALTH_CRITERIA.errorRateWindowMinutes,
    ),
    budgetDegradedThreshold: asNumber(
      raw.budgetDegradedThreshold,
      DEFAULT_HEALTH_CRITERIA.budgetDegradedThreshold,
    ),
    maxConsecutiveToolFailures: asNumber(
      raw.maxConsecutiveToolFailures,
      DEFAULT_HEALTH_CRITERIA.maxConsecutiveToolFailures,
    ),
    toolLoopCallThreshold: asNumber(
      raw.toolLoopCallThreshold,
      DEFAULT_HEALTH_CRITERIA.toolLoopCallThreshold,
    ),
    toolLoopWindowMinutes: asNumber(
      raw.toolLoopWindowMinutes,
      DEFAULT_HEALTH_CRITERIA.toolLoopWindowMinutes,
    ),
  };

  return {
    otlpEndpoint: asString(raw.otlpEndpoint, DEFAULT_CONFIG.otlpEndpoint),
    otlpProtocol: protocol,
    serviceName: asString(raw.serviceName, DEFAULT_CONFIG.serviceName),
    healthCheckIntervalSeconds: asNumber(
      raw.healthCheckIntervalSeconds,
      DEFAULT_CONFIG.healthCheckIntervalSeconds,
    ),
    criteria,
    reaperEnabled: asBoolean(raw.reaperEnabled, DEFAULT_CONFIG.reaperEnabled),
    reaperPoliciesFile: asString(raw.reaperPoliciesFile, DEFAULT_CONFIG.reaperPoliciesFile),
    suppressionCooldownMinutes: asNumber(
      raw.suppressionCooldownMinutes,
      DEFAULT_CONFIG.suppressionCooldownMinutes,
    ),
    maxAlertsPerHour: asNumber(raw.maxAlertsPerHour, DEFAULT_CONFIG.maxAlertsPerHour),
  };
}

// =============================================================================
// Helpers
// =============================================================================

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
