import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { HitlApprovalsPolicyConfig } from "../config/types.approvals.js";
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
 * - strict: Require explicit approval + additional verification
 */
export type HitlGateLevel = "none" | "advisory" | "required" | "strict";

/**
 * Gateway-level escalation config (operational, not policy-declarative).
 * Controls what happens when a request times out at the gateway layer.
 */
export type HitlGatewayEscalationConfig = {
  /** Escalate after this many ms past request creation */
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
 * Main HITL Gateway orchestrator.
 *
 * Coordinates policy resolution, durable request storage, and
 * the approval lifecycle (pending → approved/denied/expired/escalated).
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
   * If gated, creates a pending HITL request and returns the request ID.
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

    const now = this.now();
    const requestId = randomUUID();
    const expiresAtMs = now + timeoutMs;

    this.requestStore.createRequest({
      id: requestId,
      tool: input.tool,
      arguments: input.arguments ?? null,
      requesterSession: input.requesterSession,
      requesterRole: input.requesterRole,
      policyId: resolvedPolicy.id,
      status: "pending",
      expiresAtMs,
      createdAtMs: now,
      updatedAtMs: now,
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
   * Validates approver authorization before committing.
   */
  recordDecision(input: HitlDecisionInput): HitlDecisionRecordResult {
    const request = this.requestStore.getRequest(input.requestId);
    if (!request) {
      return { success: false, error: "request not found" };
    }

    if (request.status !== "pending" && request.status !== "escalated") {
      return { success: false, error: `request is not pending (status: ${request.status})` };
    }

    const policy = this.policiesById.get(request.policyId);
    if (policy) {
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
    }

    const now = this.now();
    const newStatus: HitlRequestStatus = input.decision === "approve" ? "approved" : "denied";
    const decisionType: "explicit" | "escalation" =
      request.status === "escalated" ? "escalation" : "explicit";

    const decision = this.requestStore.recordDecision({
      requestId: input.requestId,
      actorSession: input.actorSession,
      actorRole: input.actorRole,
      decision: input.decision,
      reason: input.reason ?? null,
      decidedAtMs: now,
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

    return {
      success: true,
      request: updated!,
      decision,
    };
  }

  /**
   * Expire or escalate a pending request when its timeout is reached.
   * If the gateway policy has an escalation config and the afterTimeoutMs
   * threshold has passed, transitions to "escalated" rather than "expired".
   */
  expireRequest(requestId: string, forceExpire: boolean = false): HitlRequestRow | null {
    const request = this.requestStore.getRequest(requestId);
    if (!request) {
      return null;
    }
    if (request.status !== "pending" && request.status !== "escalated") {
      return null;
    }

    const now = this.now();
    const policy = this.policiesById.get(request.policyId);
    const escalationConfig = policy?.gatewayEscalation;

    // Check if we should escalate instead of expire
    if (!forceExpire && escalationConfig && request.status === "pending") {
      const elapsed = now - request.createdAtMs;
      if (elapsed >= escalationConfig.afterTimeoutMs) {
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
   */
  listPendingRequests(): HitlRequestRow[] {
    return this.requestStore
      .listRequests()
      .filter((r) => r.status === "pending" || r.status === "escalated");
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
