import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

// ---------------------------------------------------------------------------
// Risk class enum values (R0 = no risk, R4 = critical)
// Kept as string literals so the wire format is human-readable.
// ---------------------------------------------------------------------------

export const ToolApprovalRiskClassValues = ["R0", "R1", "R2", "R3", "R4"] as const;

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
    riskClass: Type.Optional(Type.String()),
    /** List of side-effect tags (e.g. "filesystem_write", "network_egress"). */
    sideEffects: Type.Optional(Type.Array(Type.String())),
    /** Machine-readable reason codes explaining why approval is needed. */
    reasonCodes: Type.Optional(Type.Array(Type.String())),
    /** Session key tying this request to a running agent session. */
    sessionKey: Type.Optional(Type.String()),
    /** Agent identity that triggered the tool call. */
    agentId: Type.Optional(Type.String()),
    /** Expiration timestamp (epoch ms); informational for the requester. */
    expiresAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
    /** SHA-256 hash of the canonical request payload for anti-stale validation. */
    requestHash: NonEmptyString,
    /** Timeout in ms; defaults to 120 000. */
    timeoutMs: Type.Optional(Type.Integer({ minimum: 1 })),
    /**
     * Legacy exec fields: when toolName === "exec", callers may pass these
     * so the gateway can emit backward-compatible exec.approval.* events.
     */
    command: Type.Optional(Type.String()),
    cwd: Type.Optional(Type.String()),
    host: Type.Optional(Type.String()),
    security: Type.Optional(Type.String()),
    ask: Type.Optional(Type.String()),
    resolvedPath: Type.Optional(Type.String()),
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
    decision: NonEmptyString,
    /** Must match the original requestHash to prevent stale resolution. */
    requestHash: NonEmptyString,
  },
  { additionalProperties: false },
);

// ---------------------------------------------------------------------------
// Tool Approvals Get (list pending)
// ---------------------------------------------------------------------------

export const ToolApprovalsGetParamsSchema = Type.Object({}, { additionalProperties: false });
