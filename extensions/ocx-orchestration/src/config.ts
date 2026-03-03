// ---------------------------------------------------------------------------
// Plugin configuration type and defaults
// ---------------------------------------------------------------------------

export type OrchestrationConfig = {
  /** Path to default team structure file */
  hierarchyFile?: string;
  /** Maximum session duration (minutes) before timeout escalation fires */
  escalationTimeoutMinutes: number;
  /** Consecutive tool failures before escalation */
  maxConsecutiveFailures: number;
  /** Budget utilization ratio (0-1) that triggers budget risk escalation */
  budgetRiskThreshold: number;
  /** Default sprint duration in days */
  defaultSprintDurationDays: number;
  /** HMAC secret for verifying incoming Git webhook payloads */
  gitWebhookSecret?: string;
};

const DEFAULTS: OrchestrationConfig = {
  escalationTimeoutMinutes: 60,
  maxConsecutiveFailures: 3,
  budgetRiskThreshold: 0.8,
  defaultSprintDurationDays: 14,
};

/**
 * Merge raw plugin config with sensible defaults.
 */
export function resolveOrchestrationConfig(
  raw: Record<string, unknown> | undefined,
): OrchestrationConfig {
  if (!raw) return { ...DEFAULTS };
  return {
    hierarchyFile: typeof raw.hierarchyFile === "string" ? raw.hierarchyFile : undefined,
    escalationTimeoutMinutes:
      typeof raw.escalationTimeoutMinutes === "number"
        ? raw.escalationTimeoutMinutes
        : DEFAULTS.escalationTimeoutMinutes,
    maxConsecutiveFailures:
      typeof raw.maxConsecutiveFailures === "number"
        ? raw.maxConsecutiveFailures
        : DEFAULTS.maxConsecutiveFailures,
    budgetRiskThreshold:
      typeof raw.budgetRiskThreshold === "number"
        ? raw.budgetRiskThreshold
        : DEFAULTS.budgetRiskThreshold,
    defaultSprintDurationDays:
      typeof raw.defaultSprintDurationDays === "number"
        ? raw.defaultSprintDurationDays
        : DEFAULTS.defaultSprintDurationDays,
    gitWebhookSecret: typeof raw.gitWebhookSecret === "string" ? raw.gitWebhookSecret : undefined,
  };
}
