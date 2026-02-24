import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { HitlApprovalsPolicyConfig } from "../config/types.approvals.js";
import type { ExecApprovalDecision } from "../infra/exec-approvals.js";
import type { ExecApprovalManager } from "./exec-approval-manager.js";
import type { HitlPolicyEngine, HitlAuthorizationResult } from "./hitl-policy-engine.js";
import {
  HitlRequestStore,
  type HitlRequestRow,
  type HitlDecisionRow,
  type HitlAuditRow,
  type HitlRequestStatus,
} from "./hitl-request-store.js";

/**
 * HITL Gate Levels
 * - none: No approval required
 * - advisory: Request approval but allow bypass for owner role
 * - required: Block until approved (default)
 * - strict: Require explicit approval + additional verification (treated same as required currently)
 */
export type HitlGateLevel = "none" | "advisory" | "required" | "strict";

/**
 * Gateway-level escalation config (operational, not policy-declarative).
 * Controls what happens when a request times out at the gateway layer.
 */
export type HitlGatewayEscalationConfig = {
  /** Escalate after this many ms past the request's expiry (expiresAtMs) */
  afterTimeoutMs: number;
  /** Channels/roles to notify/escalate to */
  escalateTo: string[];
  /** Fallback action if escalation also times out */
  fallbackAction: "allow-once" | "deny" | "block";
};

/**
 * Extended policy definition with gateway-specific fields.
 * Combines core policy config with gate-level and timeout settings.
 */
export type HitlGatewayPolicy = HitlApprovalsPolicyConfig & {
  /** Approval requirement level */
  gate: HitlGateLevel;
  /** Timeout for approval response in ms */
  timeoutMs: number;
  /** Optional gateway-level escalation config (distinct from policy engine escalation) */
  gatewayEscalation?: HitlGatewayEscalationConfig;
};

/**
 * Input for checking if a tool should be gated.
 */
export type HitlGateCheckInput = {
  /** Tool name being invoked */
  tool: string;
  /** Optional tool category */
  category?: string;
  /** Tool arguments (for audit trail) */
  arguments?: Record<string, unknown>;
  /** Requester session key */
  requesterSession: string;
  /** Requester role */
  requesterRole: string;
};

/**
 * Result of gate check — indicates whether approval is needed.
 */
export type HitlGateCheckResult =
  | {
      /** Gate not triggered; proceed */
      gated: false;
      policy?: never;
    }
  | {
      /** Gate triggered; wait for decision */
      gated: true;
      /** Policy that triggered the gate */
      policy: HitlGatewayPolicy;
      /** Pending request ID */
      requestId: string;
      /** Request expiry timestamp */
      expiresAtMs: number;
    };

/**
 * Input for recording an approval or denial decision.
 */
export type HitlDecisionInput = {
  requestId: string;
  actorSession: string;
  actorRole: string;
  decision: "approve" | "deny";
  reason?: string;
};

/**
 * Result of recording a decision.
 */
export type HitlDecisionRecordResult =
  | { success: true; request: HitlRequestRow; decision: HitlDecisionRow }
  | { success: false; error: string };

/**
 * Options for creating a HitlGateway instance.
 */
export type HitlGatewayOptions = {
  policyEngine: HitlPolicyEngine;
  requestStore: HitlRequestStore;
  approvalManager: ExecApprovalManager;
  /** Gateway policies with gate levels and timeouts */
  policies?: HitlGatewayPolicy[];
  /** Default timeout for approvals in ms (default: 120_000) */
  defaultTimeoutMs?: number;
  /** Clock override for testing */
  now?: () => number;
};

/**
 * Maps a HITL approve/deny decision to the ExecApprovalDecision type
 * consumed by ExecApprovalManager.
 */
function toExecDecision(decision: "approve" | "deny"): ExecApprovalDecision {
  return decision === "approve" ? "allow-once" : "deny";
}

/**
 * Main HITL Gateway orchestrator.
 *
 * Coordinates policy resolution, durable request storage, and
 * the approval lifecycle (pending → approved/denied/expired/escalated).
 *
 * The approvalManager bridges the durable SQLite store to the in-memory
 * promise-based lifecycle that blocking callers await. When checkAndGate
 * creates a request it registers a promise in the approvalManager; when
 * recordDecision commits a decision it resolves that promise, unblocking
 * callers that are awaiting via approvalManager.awaitDecision(requestId).
 */
export class HitlGateway {
  private readonly policyEngine: HitlPolicyEngine;
  private readonly requestStore: HitlRequestStore;
  private readonly approvalManager: ExecApprovalManager;
  private readonly policiesById: Map<string, HitlGatewayPolicy>;
  private readonly defaultTimeoutMs: number;
  private readonly now: () => number;

  constructor(options: HitlGatewayOptions) {
    this.policyEngine = options.policyEngine;
    this.requestStore = options.requestStore;
    this.approvalManager = options.approvalManager;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 120_000;
    this.now = options.now ?? Date.now;
    this.policiesById = new Map();
    for (const policy of options.policies ?? []) {
      this.policiesById.set(policy.id, policy);
    }
  }

  /**
   * Check whether a tool invocation should be gated.
   *
   * If gated, creates a pending HITL request in the durable store AND
   * registers it with the approvalManager so callers can await the decision
   * via approvalManager.awaitDecision(requestId).
   */
  checkAndGate(input: HitlGateCheckInput): HitlGateCheckResult {
    const resolvedPolicy = this.policyEngine.resolvePolicy({
      tool: input.tool,
      category: input.category,
    });

    if (!resolvedPolicy) {
      return { gated: false };
    }

    const gatewayPolicy = this.policiesById.get(resolvedPolicy.id);
    const gateLevel = gatewayPolicy?.gate ?? "required";
    const timeoutMs = gatewayPolicy?.timeoutMs ?? this.defaultTimeoutMs;

    if (gateLevel === "none") {
      return { gated: false };
    }

    // Advisory gates allow bypass for owner role
    if (gateLevel === "advisory" && input.requesterRole === "owner") {
      return { gated: false };
    }

    const nowMs = this.now();
    const requestId = randomUUID();
    const expiresAtMs = nowMs + timeoutMs;

    this.requestStore.createRequest({
      id: requestId,
      tool: input.tool,
      arguments: input.arguments ?? null,
      requesterSession: input.requesterSession,
      requesterRole: input.requesterRole,
      policyId: resolvedPolicy.id,
      status: "pending",
      expiresAtMs,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    this.requestStore.recordAudit({
      requestId,
      event: "request.created",
      actorSession: input.requesterSession,
      actorRole: input.requesterRole,
      data: {
        tool: input.tool,
        arguments: input.arguments ?? null,
        gateLevel,
        timeoutMs,
      },
    });

    // Register in-memory approval record so callers can block on awaitDecision(requestId).
    // The record is created with the same ID so the two lifecycles stay in sync.
    const record = this.approvalManager.create(
      {
        tool: input.tool,
        category: input.category ?? null,
        sessionKey: input.requesterSession,
        ...input.arguments,
      },
      timeoutMs,
      requestId,
    );
    // Register (non-blocking) — callers use approvalManager.awaitDecision(requestId) to block.
    void this.approvalManager.register(record, timeoutMs);

    return {
      gated: true,
      policy: {
        ...resolvedPolicy,
        gate: gateLevel,
        timeoutMs,
        gatewayEscalation: gatewayPolicy?.gatewayEscalation,
      },
      requestId,
      expiresAtMs,
    };
  }

  /**
   * Authorize an approver against the policy requirements.
   */
  authorize(input: {
    policy: HitlGatewayPolicy;
    approverSession: string;
    approverRole: string;
    requesterSession: string;
    currentChainDepth?: number;
  }): HitlAuthorizationResult {
    return this.policyEngine.authorize({
      policy: {
        id: input.policy.id,
        minApproverRole: input.policy.minApproverRole,
        requireDifferentActor: input.policy.requireDifferentActor,
        maxApprovalChainDepth: input.policy.maxApprovalChainDepth,
      },
      approverRole: input.approverRole,
      approverActorId: input.approverSession,
      requestActorId: input.requesterSession,
      currentChainDepth: input.currentChainDepth,
    });
  }

  /**
   * Record an approval or denial decision for a pending request.
   *
   * Validates:
   * 1. Request exists and is in a decidable state (pending or escalated)
   * 2. Request has not passed its expiresAtMs deadline
   * 3. Policy exists for the request's policyId (required for authorization)
   * 4. Approver satisfies policy authorization requirements
   *
   * On success, commits the decision to the durable store and resolves the
   * in-memory approvalManager promise to unblock any waiting callers.
   */
  recordDecision(input: HitlDecisionInput): HitlDecisionRecordResult {
    const request = this.requestStore.getRequest(input.requestId);
    if (!request) {
      return { success: false, error: "request not found" };
    }

    if (request.status !== "pending" && request.status !== "escalated") {
      return { success: false, error: `request is not pending (status: ${request.status})` };
    }

    // Reject decisions on requests that have passed their deadline.
    // Without a running timeout sweep (Phase 5) the status may still read
    // "pending" even though the window has closed, so we check the clock.
    const nowMs = this.now();
    if (nowMs > request.expiresAtMs) {
      return { success: false, error: "request has expired" };
    }

    // Policy is required to perform authorization. Silently skipping auth when
    // the policy is missing would allow any actor to approve/deny — treat a
    // missing policy as a configuration error and reject the decision.
    const policy = this.policiesById.get(request.policyId);
    if (!policy) {
      return {
        success: false,
        error: `policy '${request.policyId}' not found; cannot authorize decision`,
      };
    }

    const authResult = this.authorize({
      policy,
      approverSession: input.actorSession,
      approverRole: input.actorRole,
      requesterSession: request.requesterSession,
    });

    if (!authResult.allowed) {
      this.requestStore.recordAudit({
        requestId: input.requestId,
        event: "decision.unauthorized",
        actorSession: input.actorSession,
        actorRole: input.actorRole,
        data: {
          reason: authResult.reason,
          attemptedDecision: input.decision,
        },
      });
      return { success: false, error: `authorization failed: ${authResult.reason}` };
    }

    const newStatus: HitlRequestStatus = input.decision === "approve" ? "approved" : "denied";
    const decisionType: "explicit" | "escalation" =
      request.status === "escalated" ? "escalation" : "explicit";

    const decision = this.requestStore.recordDecision({
      requestId: input.requestId,
      actorSession: input.actorSession,
      actorRole: input.actorRole,
      decision: input.decision,
      reason: input.reason ?? null,
      decidedAtMs: nowMs,
      type: decisionType,
    });

    const updated = this.requestStore.updateRequestStatus({
      requestId: input.requestId,
      status: newStatus,
    });

    this.requestStore.recordAudit({
      requestId: input.requestId,
      event: input.decision === "approve" ? "decision.approved" : "decision.denied",
      actorSession: input.actorSession,
      actorRole: input.actorRole,
      data: {
        reason: input.reason ?? null,
        decisionType,
      },
    });

    // Resolve the in-memory approval promise to unblock any caller awaiting
    // the decision via approvalManager.awaitDecision(requestId).
    this.approvalManager.resolve(
      input.requestId,
      toExecDecision(input.decision),
      input.actorSession,
    );

    return {
      success: true,
      request: updated!,
      decision,
    };
  }

  /**
   * Expire or escalate a pending request when its timeout is reached.
   *
   * Escalation check: if the gateway policy has an escalation config and
   * `afterTimeoutMs` has elapsed since the request's *expiry time* (not
   * creation time), transitions to "escalated" rather than "expired".
   *
   * Note: the approvalManager's own timeout will resolve the in-memory
   * promise with null independently; no explicit resolve is needed here.
   */
  expireRequest(requestId: string, forceExpire: boolean = false): HitlRequestRow | null {
    const request = this.requestStore.getRequest(requestId);
    if (!request) {
      return null;
    }
    if (request.status !== "pending" && request.status !== "escalated") {
      return null;
    }

    const nowMs = this.now();
    const policy = this.policiesById.get(request.policyId);
    const escalationConfig = policy?.gatewayEscalation;

    // Escalate only if the request has already passed its deadline and enough
    // additional time has elapsed since expiry (afterTimeoutMs is measured from
    // expiresAtMs, not createdAtMs).
    if (!forceExpire && escalationConfig && request.status === "pending") {
      const elapsedSinceExpiry = nowMs - request.expiresAtMs;
      if (elapsedSinceExpiry >= escalationConfig.afterTimeoutMs) {
        const updated = this.requestStore.updateRequestStatus({
          requestId,
          status: "escalated",
        });
        this.requestStore.recordAudit({
          requestId,
          event: "request.escalated",
          data: {
            escalateTo: escalationConfig.escalateTo,
            fallbackAction: escalationConfig.fallbackAction,
          },
        });
        return updated;
      }
    }

    const updated = this.requestStore.updateRequestStatus({ requestId, status: "expired" });
    this.requestStore.recordAudit({
      requestId,
      event: "request.expired",
      data: {
        forceExpire,
        fallbackAction: escalationConfig?.fallbackAction ?? null,
      },
    });
    return updated;
  }

  /**
   * Get a single request by ID.
   */
  getRequest(requestId: string): HitlRequestRow | null {
    return this.requestStore.getRequest(requestId);
  }

  /**
   * Get a request with its full decision and audit timeline.
   */
  getRequestWithTimeline(requestId: string): {
    request: HitlRequestRow;
    decisions: HitlDecisionRow[];
    audit: HitlAuditRow[];
  } | null {
    return this.requestStore.getRequestWithTimeline(requestId);
  }

  /**
   * List all currently pending or escalated requests.
   * Queries each status explicitly to avoid the default 100-record limit
   * silently dropping pending requests when the queue grows large.
   */
  listPendingRequests(): HitlRequestRow[] {
    const pending = this.requestStore.listRequests({ status: "pending", limit: 500 });
    const escalated = this.requestStore.listRequests({ status: "escalated", limit: 500 });
    return [...pending, ...escalated];
  }
}

/**
 * Factory to create a HitlGateway with sensible defaults.
 */
export function createHitlGateway(options: {
  policyEngine: HitlPolicyEngine;
  requestStore?: HitlRequestStore;
  approvalManager: ExecApprovalManager;
  policies?: HitlGatewayPolicy[];
  dbPath?: string;
  db?: DatabaseSync;
  now?: () => number;
  defaultTimeoutMs?: number;
}): HitlGateway {
  const store =
    options.requestStore ?? new HitlRequestStore({ dbPath: options.dbPath, db: options.db });

  return new HitlGateway({
    policyEngine: options.policyEngine,
    requestStore: store,
    approvalManager: options.approvalManager,
    policies: options.policies,
    defaultTimeoutMs: options.defaultTimeoutMs,
    now: options.now,
  });
}
