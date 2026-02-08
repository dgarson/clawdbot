import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

// ---------------------------------------------------------------------------
// Typed enum schemas (avoid Type.Union per tool-schema guardrails)
// ---------------------------------------------------------------------------

const ToolApprovalDecisionSchema = Type.Unsafe<"allow-once" | "allow-always" | "deny">({
  type: "string",
  enum: ["allow-once", "allow-always", "deny"],
});

const ToolRiskClassSchema = Type.Unsafe<"R0" | "R1" | "R2" | "R3" | "R4">({
  type: "string",
  enum: ["R0", "R1", "R2", "R3", "R4"],
});

// ---------------------------------------------------------------------------
// Tool Approval Request
// ---------------------------------------------------------------------------

export const ToolApprovalRequestParamsSchema = Type.Object(
  {
    /** Optional caller-supplied id; generated if omitted. */
    id: Type.Optional(NonEmptyString),
    /** Canonical tool name (e.g. "exec", "browser.navigate", "plugin:myplugin:deploy"). */
    toolName: NonEmptyString,
    /** Human-readable summary of tool parameters. */
    paramsSummary: Type.Optional(Type.String()),
    /** Risk class assigned by the static evaluator (R0..R4). */
    riskClass: Type.Optional(ToolRiskClassSchema),
    /** List of side-effect tags (e.g. "filesystem_write", "network_egress"). */
    sideEffects: Type.Optional(Type.Array(NonEmptyString)),
    /** Machine-readable reason codes explaining why approval is needed. */
    reasonCodes: Type.Optional(Type.Array(NonEmptyString)),
    /** Session key tying this request to a running agent session. */
    sessionKey: Type.Optional(Type.String()),
    /** Agent identity that triggered the tool call. */
    agentId: Type.Optional(Type.String()),
    /** Policy version that produced this request, for auditing / hash stability. */
    policyVersion: Type.Optional(Type.String()),
    /** SHA-256 hash of the canonical request payload for anti-stale validation. */
    requestHash: NonEmptyString,
    /** Timeout in ms; defaults to 120 000. */
    timeoutMs: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------------------
// Tool Approval Resolve
// ---------------------------------------------------------------------------

export const ToolApprovalResolveParamsSchema = Type.Object(
  {
    /** The approval record id to resolve. */
    id: NonEmptyString,
    /** Decision: "allow-once" | "allow-always" | "deny". */
    decision: ToolApprovalDecisionSchema,
    /** Must match the original requestHash to prevent stale resolution. */
    requestHash: NonEmptyString,
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------------------
// Tool Approvals Get (list pending)
// ---------------------------------------------------------------------------

export const ToolApprovalsGetParamsSchema = Type.Object({}, { additionalProperties: false });
