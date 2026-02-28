/**
 * Shared types for OpenClaw control-plane extensions.
 *
 * These types represent concepts that appear in 3+ extensions. Import from
 * here rather than duplicating. Extensions should NOT add types here unless
 * they are genuinely cross-cutting — domain-specific types belong in each
 * extension's own types.ts.
 *
 * Migration note: types added here should be adopted incrementally. When
 * updating an extension to use a type from this package, remove the local
 * duplicate and add @openclaw/ocx-platform to that extension's package.json.
 */

// ---------------------------------------------------------------------------
// Agent / Run context
//
// The (runId, agentId, sessionKey) tuple appears in every control-plane
// extension. Use this as a base for event, scorecard, ledger, and budget
// record types.
// ---------------------------------------------------------------------------

export type AgentRunContext = {
  runId: string;
  agentId: string;
  sessionKey: string;
  /** Optional causal lineage id for tracing across delegation hops. */
  lineageId?: string;
};

// ---------------------------------------------------------------------------
// Timestamp
//
// All control-plane extensions use ISO-8601 strings for timestamps. Use this
// branded type to make timestamp fields self-documenting.
// ---------------------------------------------------------------------------

/** An ISO-8601 datetime string (e.g. "2026-02-27T12:00:00.000Z"). */
export type ISOTimestamp = string;

// ---------------------------------------------------------------------------
// Model / Provider reference
//
// Appears in routing-policy targets, evaluation scorecards, and event-ledger
// run summaries. Centralised here to keep the shape consistent.
// ---------------------------------------------------------------------------

export type ModelProviderRef = {
  model?: string;
  provider?: string;
};

// ---------------------------------------------------------------------------
// Classification label
//
// Defined in ocx-routing-policy's classifier; referenced in evaluation
// scorecards and model comparison. Kept here to avoid a direct cross-
// extension import between routing-policy and evaluation.
// ---------------------------------------------------------------------------

export type ClassificationLabel = "simple" | "code" | "complex" | "multi-step";

// ---------------------------------------------------------------------------
// Policy decision trace
//
// Shared explain output format. Each policy engine (routing, budget, reaper)
// should emit this shape so operators can query cross-domain decision history
// with a consistent structure. Extensions keep their own rule formats — this
// only standardises the explain/audit output.
// ---------------------------------------------------------------------------

export type PolicyDecisionTrace = {
  /** Unique id for this decision (used for dedup and correlation). */
  decisionId: string;
  /** Which policy engine produced this trace. */
  engine: "routing" | "budget" | "reaper";
  /** The run/agent/session this decision applied to. */
  context: AgentRunContext;
  /** ISO-8601 timestamp when the decision was made. */
  decidedAt: ISOTimestamp;
  /** Whether the decision was to allow, degrade, or block the action. */
  outcome: "allow" | "degrade" | "block" | "terminate";
  /** Human-readable summary of why this outcome was chosen. */
  reason: string;
  /** Ordered list of policies evaluated, with their individual outcomes. */
  policyEvalSteps: Array<{
    policyId: string;
    matched: boolean;
    outcome: "allow" | "degrade" | "block" | "terminate" | "skip";
    reason?: string;
  }>;
};
