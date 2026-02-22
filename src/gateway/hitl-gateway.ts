import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { HitlApprovalsPolicyConfig } from "../config/types.approvals.js";
import type { ExecApprovalManager } from "./exec-approval-manager.js";
import type { HitlPolicyEngine, HitlAuthorizationResult } from "./hitl-policy-engine.js";
import type {
  HitlRequestStore,
  HitlRequestRow,
  HitlDecisionRow,
  HitlAuditRow,
  HitlRequestStatus,
} from "./hitl-request-store.js";

/**
 * HITL Gate Levels
 * - none: No approval required
 * - advisory: Request approval but allow override
 * - required: Block until approved
 * - strict: Require explicit approval + additional verification
 */
export type HitlGateLevel = "none" | "advisory" | "required" | "strict";

/**
 * Escalation configuration for timeout handling
 */
export type HitlEscalationConfig = {
  /** Escalate after this many ms */
  afterTimeoutMs: number;
  /** Who to notify/escalate to */
  escalateTo: string[];
  /** Fallback action if escalation also times out */
  fallbackAction: "allow-once" | "deny" | "block";
};

/**
 * Extended policy definition with gateway-specific fields
 */
export type HitlGatewayPolicy = HitlApprovalsPolicyConfig & {
  /** Approval requirement level */
  gate: HitlGateLevel;
  /** Timeout for approval response in ms */
  timeoutMs: number;
  /** Optional escalation config */
  escalation?: HitlEscalationConfig;
};

/**
 * Input for checking if a tool should be gated
 */
export type HitlGateCheckInput = {
  /** Tool name being invoked */
  tool: string;
  /** Optional category */
  category?: string;
  /** Tool arguments (for audit) */
  arguments?: Record<string, unknown>;
  /** Requester session key */
  requesterSession: string;
  /** Requester role */
  requesterRole: string;
  /** Requester display name */
  requesterDisplayName?: string;
};

/**
 * Result of gate check - indicates if approval is needed
 */
export type HitlGateCheckResult =
  | {
      /** Whether gate is required */
      gated: false;
      /** Policy that allowed bypass (if any) */
      policy?: never;
    }
  | {
      /** Whether gate is required */
      gated: true;
      /** Policy requiring approval */
      policy: HitlGatewayPolicy;
      /** Request ID for the pending approval */
      requestId: string;
      /** Expires at timestamp */
      expiresAtMs: number;
    };

/**
 * Decision input for recording an approval/denial
 */
export type HitlDecisionInput = {
  /** Request ID */
  requestId: string;
  /** Approver session key */
  actorSession: string;
  /** Approver role */
  actorRole: string;
  /** Approver display name */
  actorDisplayName?: string;
  /** Decision */
  decision: "approve" | "deny";
  /** Optional reason */
  reason?: string;
};

/**
 * Result of recording a decision
 */
export type HitlDecisionResult =
  | { success: true; request: HitlRequestRow; decision: HitlDecisionRow }
  | { success: false; error: string };

/**
 * Options for creating HitlGateway
 */
export type HitlGatewayOptions = {
  /** Policy engine instance */
  policyEngine: HitlPolicyEngine;
  /** Request store instance */
  requestStore: HitlRequestStore;
  /** Approval manager instance */
  approvalManager: ExecApprovalManager;
  /** Gateway-specific policies with gate levels */
  policies?: HitlGatewayPolicy[];
  /** Default timeout for approvals (ms) */
  defaultTimeoutMs?: number;
  /** Clock override for testing */
  now?: () => number;
};

/**
 * Main HITL Gateway class that orchestrates policy resolution, request storage,
 * and approval lifecycle management.
 */
export class HitlGateway {
  private readonly policyEngine: HitlPolicyEngine;
  private readonly requestStore: HitlRequestStore;
  private readonly approvalManager: ExecApprovalManager;
  private readonly policies: Map<string, HitlGatewayPolicy>;
  private readonly defaultTimeoutMs: number;
  private readonly now: () => number;

  constructor(options: HitlGatewayOptions) {
    this.policyEngine = options.policyEngine;
    this.requestStore = options.requestStore;
    this.approvalManager = options.approvalManager;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 120_000;
    this.now = options.now ?? Date.now;

    // Index policies by ID
    this.policies = new Map();
    if (options.policies) {
      for (const policy of options.policies) {
        this.policies.set(policy.id, policy);
      }
    }
  }

  /**
   * Check if a tool invocation should be gated and create a pending request if needed.
   */
  checkAndGate(input: HitlGateCheckInput): HitlGateCheckResult {
    // Resolve policy from the policy engine
    const resolvedPolicy = this.policyEngine.resolvePolicy({
      tool: input.tool,
      category: input.category,
    });

    // If no policy or gate is none, allow through
    if (!resolvedPolicy) {
      return { gated: false };
    }

    // Get gateway policy with gate level
    const gatewayPolicy = this.policies.get(resolvedPolicy.id);
    const gateLevel = gatewayPolicy?.gate ?? "required";
    const timeoutMs = gatewayPolicy?.timeoutMs ?? this.defaultTimeoutMs;

    // If gate is none, allow through
    if (gateLevel === "none") {
      return { gated: false };
    }

    // For advisory gates with owner role, allow bypass
    if (gateLevel === "advisory" && input.requesterRole === "owner") {
      return { gated: false };
    }

    // Create pending request
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

    // Record audit event
    this.requestStore.recordAudit({
      requestId,
      event: "request.created",
      actorSession: input.requesterSession,
      actorRole: input.requesterRole,
      data: {
        tool: input.tool,
        arguments: input.arguments,
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
        escalation: gatewayPolicy?.escalation,
      },
      requestId,
      expiresAtMs,
    };
  }

  /**
   * Authorize an approver for a specific policy.
   */
  authorize(input: {
    policy: HitlGatewayPolicy;
    approverSession: string;
    approverRole: string;
    requesterSession: string;
  }): HitlAuthorizationResult {
    return this.policyEngine.authorize({
      policy: {
        id: input.policy.id,
        minApproverRole: input.policy.minApproverRole,
        requireDifferentActor: input.policy.requireDifferentActor,
      },
      approverRole: input.approverRole,
      approverActorId: input.approverSession,
      requestActorId: input.requesterSession,
    });
  }

  /**
   * Record an approval or denial decision.
   */
  recordDecision(input: HitlDecisionInput): HitlDecisionResult {
    const request = this.requestStore.getRequest(input.requestId);
    if (!request) {
      return { success: false, error: "request not found" };
    }

    if (request.status !== "pending" && request.status !== "escalated") {
      return { success: false, error: `request is not pending (status: ${request.status})` };
    }

    // Authorize the approver
    const policy = this.policies.get(request.policyId);
    if (policy) {
      const authResult = this.authorize({
        policy,
        approverSession: input.actorSession,
        approverRole: input.actorRole,
        requesterSession: request.requesterSession,
      });

      if (!authResult.allowed) {
        // Record denied attempt in audit
        this.requestStore.recordAudit({
          requestId: input.requestId,
          event: "decision.denied",
          actorSession: input.actorSession,
          actorRole: input.actorRole,
          data: {
            reason: authResult.reason,
            decision: input.decision,
          },
        });

        return { success: false, error: `authorization failed: ${authResult.reason}` };
      }
    }

    const now = this.now();
    const newStatus: HitlRequestStatus = input.decision === "approve" ? "approved" : "denied";
    const decisionType: "explicit" | "escalation" =
      request.status === "escalated" ? "escalation" : "explicit";

    // Record the decision
    const decision = this.requestStore.recordDecision({
      requestId: input.requestId,
      actorSession: input.actorSession,
      actorRole: input.actorRole,
      decision: input.decision,
      reason: input.reason ?? null,
      decidedAtMs: now,
      type: decisionType,
    });

    // Update request status
    const updated = this.requestStore.updateRequestStatus({
      requestId: input.requestId,
      status: newStatus,
    });

    // Record audit event
    this.requestStore.recordAudit({
      requestId: input.requestId,
      event: input.decision === "approve" ? "decision.approved" : "decision.denied",
      actorSession: input.actorSession,
      actorRole: input.actorRole,
      data: {
        reason: input.reason,
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
   * Get a request by ID.
   */
  getRequest(requestId: string): HitlRequestRow | null {
    return this.requestStore.getRequest(requestId);
  }

  /**
   * Get request with its timeline (decisions and audit).
   */
  getRequestWithTimeline(requestId: string): {
    request: HitlRequestRow | null;
    decisions: HitlDecisionRow[];
    audit: HitlAuditRow[];
  } | null {
    return this.requestStore.getRequestWithTimeline(requestId);
  }

  /**
   * Expire a pending request (called when timeout is reached).
   */
  expireRequest(requestId: string, escalated: boolean = false): HitlRequestRow | null {
    const request = this.requestStore.getRequest(requestId);
    if (!request || (request.status !== "pending" && request.status !== "escalated")) {
      return null;
    }

    const now = this.now();
    const policy = this.policies.get(request.policyId);

    // Check if we should escalate instead of expire
    if (!escalated && policy?.escalation) {
      const elapsed = now - request.createdAtMs;
      if (elapsed >= policy.escalation.afterTimeoutMs) {
        // Escalate
        const updated = this.requestStore.updateRequestStatus({
          requestId,
          status: "escalated",
        });

        this.requestStore.recordAudit({
          requestId,
          event: "request.escalated",
          data: {
            escalationTarget: policy.escalation.escalateTo,
            fallbackAction: policy.escalation.fallbackAction,
          },
        });

        return updated;
      }
    }

    // Expire the request
    const newStatus: HitlRequestStatus = escalated ? "expired" : "expired";
    const updated = this.requestStore.updateRequestStatus({
      requestId,
      status: newStatus,
    });

    this.requestStore.recordAudit({
      requestId,
      event: "request.expired",
      data: {
        escalated,
        fallbackAction: policy?.escalation?.fallbackAction,
      },
    });

    return updated;
  }

  /**
   * List all pending requests.
   */
  listPendingRequests(): HitlRequestRow[] {
    return this.requestStore
      .listRequests()
      .filter((r) => r.status === "pending" || r.status === "escalated");
  }
}

/**
 * Helper to create HitlGateway with typical defaults
 */
export function createHitlGateway(options: {
  policyEngine: HitlPolicyEngine;
  requestStore?: HitlRequestStore;
  approvalManager: ExecApprovalManager;
  policies?: HitlGatewayPolicy[];
  dbPath?: string;
  db?: DatabaseSync;
  now?: () => number;
}): HitlGateway {
  const store =
    options.requestStore ?? new HitlRequestStore({ dbPath: options.dbPath, db: options.db });

  return new HitlGateway({
    policyEngine: options.policyEngine,
    requestStore: store,
    approvalManager: options.approvalManager,
    policies: options.policies,
    now: options.now,
  });
}
