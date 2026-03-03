/**
 * Types for the routing-policy plugin.
 *
 * Covers routing policies, routing conditions, prompt contributors,
 * prompt conditions, classification results, and prompt context.
 */

// ---------------------------------------------------------------------------
// Routing Policy
// ---------------------------------------------------------------------------

export type RoutingCondition =
  | { kind: "agent"; agentId: string }
  | { kind: "channel"; channel: string }
  | { kind: "classification"; label: string }
  | { kind: "budget_remaining"; operator: "gt" | "lt"; threshold: number }
  | { kind: "tool_count"; operator: "gt" | "lt"; threshold: number }
  | { kind: "hour_of_day"; from: number; to: number }
  | { kind: "session_depth"; operator: "gt" | "lt"; threshold: number };

export type RoutingPolicy = {
  id: string;
  /** Conditions that must ALL match for this policy to apply. */
  conditions: RoutingCondition[];
  /** Model/provider to use when conditions match. */
  target: {
    model?: string;
    provider?: string;
  };
  /** Higher priority wins when multiple policies match. */
  priority: number;
};

// ---------------------------------------------------------------------------
// Prompt Composition
// ---------------------------------------------------------------------------

export type PromptCondition =
  | { kind: "agent"; agentId: string }
  | { kind: "channel"; channel: string }
  | { kind: "classification"; label: string }
  | { kind: "has_tool"; toolName: string }
  | { kind: "session_type"; type: "main" | "subagent" | "cron" };

export type PromptContext = {
  agentId: string;
  sessionKey: string;
  channel?: string;
  classification?: string;
  tokenBudget?: number;
  toolNames?: string[];
  sessionType?: string;
};

export type PromptContributor = {
  id: string;
  /** Lower priority runs first (0 = highest priority). */
  priority: number;
  /** Conditions for inclusion (empty = always included). */
  conditions: PromptCondition[];
  /** Whether this contributor can be omitted under token pressure. */
  optional: boolean;
  /** The prompt content to inject (static string only for serializable storage). */
  content: string;
};

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export type ClassificationLabel = "simple" | "code" | "complex" | "multi-step";

export type ClassificationMethod = "heuristic" | "llm";

export type ClassificationResult = {
  label: ClassificationLabel;
  confidence: number;
  method: ClassificationMethod;
  classifierModel?: string;
};

export type ClassifierInput = {
  text: string;
  toolsAvailable?: number;
  sessionDepth?: number;
  hasMedia?: boolean;
};
