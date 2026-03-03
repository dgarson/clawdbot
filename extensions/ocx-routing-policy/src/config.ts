/**
 * Plugin configuration type and defaults for routing-policy.
 */

export type RoutingPolicyConfig = {
  /** Model used for LLM-based classification (default: "gpt-4.1-mini"). */
  classifierModel: string;
  /** Minimum heuristic confidence before escalating to LLM (default: 0.7). */
  heuristicConfidenceThreshold: number;
  /** Filename for routing policies in stateDir (default: "routing-policies.json"). */
  policyFile: string;
  /** Filename for prompt contributors in stateDir (default: "prompt-contributors.json"). */
  contributorsFile: string;
  /** Default model when no policy matches (empty = use agent's configured model). */
  defaultModel: string;
};

const DEFAULTS: RoutingPolicyConfig = {
  classifierModel: "gpt-4.1-mini",
  heuristicConfidenceThreshold: 0.7,
  policyFile: "routing-policies.json",
  contributorsFile: "prompt-contributors.json",
  defaultModel: "",
};

/** Resolve plugin config from raw plugin config record, applying defaults. */
export function resolveConfig(raw: Record<string, unknown> | undefined): RoutingPolicyConfig {
  const src = raw ?? {};
  return {
    classifierModel:
      typeof src.classifierModel === "string" && src.classifierModel.trim()
        ? src.classifierModel.trim()
        : DEFAULTS.classifierModel,
    heuristicConfidenceThreshold:
      typeof src.heuristicConfidenceThreshold === "number" &&
      Number.isFinite(src.heuristicConfidenceThreshold) &&
      src.heuristicConfidenceThreshold > 0 &&
      src.heuristicConfidenceThreshold <= 1
        ? src.heuristicConfidenceThreshold
        : DEFAULTS.heuristicConfidenceThreshold,
    policyFile:
      typeof src.policyFile === "string" && src.policyFile.trim()
        ? src.policyFile.trim()
        : DEFAULTS.policyFile,
    contributorsFile:
      typeof src.contributorsFile === "string" && src.contributorsFile.trim()
        ? src.contributorsFile.trim()
        : DEFAULTS.contributorsFile,
    defaultModel:
      typeof src.defaultModel === "string" ? src.defaultModel.trim() : DEFAULTS.defaultModel,
  };
}
