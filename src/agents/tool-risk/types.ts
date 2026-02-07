// ---------------------------------------------------------------------------
// Risk Class Taxonomy
// ---------------------------------------------------------------------------

/**
 * Risk class levels from R0 (no risk / pure read) to R4 (critical / destructive).
 *
 *  R0 — informational, no side effects (e.g. read_file, list_directory)
 *  R1 — low-risk side effects, easily reversible (e.g. write to sandboxed file)
 *  R2 — moderate side effects, may need review (e.g. network request, modify config)
 *  R3 — high-risk, approval recommended (e.g. exec shell, deploy, send message)
 *  R4 — critical, approval required (e.g. delete database, root shell, billing mutation)
 */
export type RiskClass = "R0" | "R1" | "R2" | "R3" | "R4";

/** All risk class values, ordered from lowest to highest. */
export const RISK_CLASSES: readonly RiskClass[] = ["R0", "R1", "R2", "R3", "R4"];

// ---------------------------------------------------------------------------
// Side Effect Types
// ---------------------------------------------------------------------------

/**
 * Semantic tags describing what a tool invocation may do.
 * Used for approval UX and audit logging.
 */
export type SideEffectType =
  | "filesystem_read"
  | "filesystem_write"
  | "filesystem_delete"
  | "process_spawn"
  | "network_egress"
  | "network_listen"
  | "config_mutation"
  | "message_send"
  | "credential_access"
  | "billing_mutation"
  | "data_delete"
  | "deployment"
  | "system_state"
  | "browser_navigation"
  | "memory_write"
  | "none";

// ---------------------------------------------------------------------------
// Tool Risk Profile
// ---------------------------------------------------------------------------

/**
 * Static risk metadata declared for a tool, either by core catalog or plugin.
 * This is the "contract" a tool author provides. It is never computed at runtime.
 */
export type ToolRiskProfile = {
  /** Base risk class for the tool (may be bumped by parameter analysis). */
  riskClass: RiskClass;
  /** Declared side effects. */
  sideEffects: SideEffectType[];
  /** Human-readable one-liner explaining the risk. */
  description?: string;
  /**
   * Optional function that inspects parameters and returns a higher risk class.
   * For example, `exec` with `rm -rf /` may bump from R3 to R4.
   * Must return a risk class >= the base riskClass (never lower).
   */
  parameterBump?: (params: Record<string, unknown>) => RiskClass | null;
};

// ---------------------------------------------------------------------------
// Tool Risk Assessment (runtime output)
// ---------------------------------------------------------------------------

/**
 * The result of evaluating a tool invocation against its risk profile.
 * Produced by the static evaluator at runtime for each tool call.
 */
export type ToolRiskAssessment = {
  /** Canonical tool name (normalized). */
  toolName: string;
  /** Effective risk class after static + parameter evaluation. */
  riskClass: RiskClass;
  /** Declared side effects from the profile. */
  sideEffects: SideEffectType[];
  /** Machine-readable reason codes explaining why this assessment was made. */
  reasonCodes: string[];
  /** Whether approval is recommended (riskClass >= threshold). */
  approvalRecommended: boolean;
  /** The profile source: "core_catalog", "plugin", or "unknown_fallback". */
  source: "core_catalog" | "plugin" | "unknown_fallback";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compare two risk classes. Returns > 0 if a > b, < 0 if a < b, 0 if equal. */
export function compareRiskClass(a: RiskClass, b: RiskClass): number {
  return RISK_CLASSES.indexOf(a) - RISK_CLASSES.indexOf(b);
}

/** Return the higher of two risk classes. */
export function maxRiskClass(a: RiskClass, b: RiskClass): RiskClass {
  return compareRiskClass(a, b) >= 0 ? a : b;
}
