import type { RiskClass, ToolRiskAssessment, ToolRiskProfile } from "./types.js";
import { compareRiskClass, maxRiskClass } from "./types.js";

// ---------------------------------------------------------------------------
// Default approval threshold
// ---------------------------------------------------------------------------

/** Risk class at or above which approval is recommended. */
const DEFAULT_APPROVAL_THRESHOLD: RiskClass = "R3";

// ---------------------------------------------------------------------------
// Unknown tool fallback profile — fail-closed at R3
// ---------------------------------------------------------------------------

const UNKNOWN_FALLBACK_PROFILE: ToolRiskProfile = {
  riskClass: "R3",
  sideEffects: [],
  description: "Unknown tool — fail-closed to R3",
};

// ---------------------------------------------------------------------------
// Static Evaluator
// ---------------------------------------------------------------------------

export type StaticEvaluatorOptions = {
  /** Override the risk class threshold for approval recommendation. */
  approvalThreshold?: RiskClass;
};

/**
 * Evaluate a tool invocation against a resolved risk profile.
 *
 * This is the single deterministic evaluator: no model calls, no async,
 * no external dependencies. It takes a profile (from catalog, plugin, or
 * fallback) and optionally inspects the call parameters for risk bumps.
 *
 * @param toolName  Canonical (normalized) tool name.
 * @param profile   Resolved profile, or null to use unknown fallback.
 * @param params    Tool call parameters for parameter-based bump analysis.
 * @param source    Where the profile came from.
 * @param opts      Optional evaluator configuration.
 */
export function evaluateToolRisk(
  toolName: string,
  profile: ToolRiskProfile | null,
  params: Record<string, unknown>,
  source: ToolRiskAssessment["source"],
  opts?: StaticEvaluatorOptions,
): ToolRiskAssessment {
  const effectiveProfile = profile ?? UNKNOWN_FALLBACK_PROFILE;
  const effectiveSource = profile ? source : "unknown_fallback";
  const threshold = opts?.approvalThreshold ?? DEFAULT_APPROVAL_THRESHOLD;

  // Start with the base risk class from the profile.
  let riskClass = effectiveProfile.riskClass;
  const reasonCodes: string[] = [];

  if (!profile) {
    reasonCodes.push("unknown_tool_profile");
  }

  // Apply parameter-based bump if the profile declares one.
  if (effectiveProfile.parameterBump) {
    const bump = effectiveProfile.parameterBump(params);
    if (bump) {
      const elevated = maxRiskClass(riskClass, bump);
      if (elevated !== riskClass) {
        reasonCodes.push("parameter_bump");
        riskClass = elevated;
      }
    }
  }

  // Determine whether approval is recommended (ordinal comparison).
  const approvalRecommended = compareRiskClass(riskClass, threshold) >= 0;

  return {
    toolName,
    riskClass,
    sideEffects: effectiveProfile.sideEffects,
    reasonCodes,
    approvalRecommended,
    source: effectiveSource,
  };
}
