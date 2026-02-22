/**
 * ACP ACL (Access Control Layer) — Phase 1
 * 
 * Implements permission checks for ACP operations:
 * - Handoff operations (initiate, accept, reject, cancel, escalate)
 * - Message operations (send, broadcast)
 * - Artifact operations (register, read, update)
 * - Team operations (create, join, manage)
 * 
 * Based on: /Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md §12
 */

import type { 
  ACLPermission, 
  ACLRole, 
  ACLPolicy, 
  ACLDecision,
  HandoffRejectionCode 
} from "./handoff-types.js";

/**
 * Default role permissions matrix
 */
const DEFAULT_ROLE_PERMISSIONS: Record<ACLRole, ACLPermission[]> = {
  owner: [
    "handoff:initiate",
    "handoff:accept",
    "handoff:reject",
    "handoff:cancel",
    "handoff:escalate",
    "message:send",
    "message:broadcast",
    "artifact:register",
    "artifact:read",
    "artifact:update",
    "team:create",
    "team:join",
    "team:manage",
    "admin:configure",
  ],
  coordinator: [
    "handoff:initiate",
    "handoff:accept",
    "handoff:reject",
    "handoff:cancel",
    "handoff:escalate",
    "message:send",
    "message:broadcast",
    "artifact:register",
    "artifact:read",
    "artifact:update",
    "team:create",
    "team:join",
  ],
  executor: [
    "handoff:initiate",
    "handoff:accept",
    "message:send",
    "artifact:register",
    "artifact:read",
    "artifact:update",
  ],
  reviewer: [
    "handoff:accept",
    "handoff:reject",
    "message:send",
    "artifact:read",
  ],
  observer: [
    "artifact:read",
    "message:send",
  ],
};

/**
 * ACP ACL - Access Control Layer
 */
export class AcpACL {
  private policies: Map<string, ACLPolicy> = new Map();
  private rolePermissions: Record<ACLRole, ACLPermission[]>;

  constructor(customRolePermissions?: Partial<Record<ACLRole, ACLPermission[]>>) {
    this.rolePermissions = { ...DEFAULT_ROLE_PERMISSIONS, ...customRolePermissions };
  }

  /**
   * Register or update an ACL policy for an agent
   */
  registerPolicy(policy: ACLPolicy): void {
    this.policies.set(policy.agent_id, policy);
  }

  /**
   * Remove policy for an agent
   */
  removePolicy(agentId: string): boolean {
    return this.policies.delete(agentId);
  }

  /**
   * Get policy for an agent
   */
  getPolicy(agentId: string): ACLPolicy | undefined {
    return this.policies.get(agentId);
  }

  /**
   * Get effective permissions for an agent
   */
  getEffectivePermissions(agentId: string): ACLPermission[] {
    const policy = this.policies.get(agentId);
    if (!policy) {
      // Default to observer role if no policy exists
      return this.rolePermissions.observer;
    }

    // Check for custom permissions
    if (policy.permissions.length > 0) {
      return policy.permissions;
    }

    // Use role-based permissions
    return this.rolePermissions[policy.role] || [];
  }

  /**
   * Check if agent has a specific permission
   */
  checkPermission(
    permission: ACLPermission,
    agentId: string,
    resource?: string
  ): ACLDecision {
    const policy = this.policies.get(agentId);
    const effectivePermissions = this.getEffectivePermissions(agentId);

    // Check if permission is in effective permissions
    if (!effectivePermissions.includes(permission)) {
      return {
        allowed: false,
        permission,
        agent_id: agentId,
        resource,
        reason: `Agent ${agentId} does not have permission: ${permission}`,
        policy_id: policy?.agent_id,
      };
    }

    // Check resource patterns if specified
    if (resource && policy?.resource_patterns) {
      const matches = policy.resource_patterns.some(pattern => 
        this.matchPattern(pattern, resource)
      );
      if (!matches) {
        return {
          allowed: false,
          permission,
          agent_id: agentId,
          resource,
          reason: `Resource ${resource} does not match allowed patterns for agent ${agentId}`,
          policy_id: policy.agent_id,
        };
      }
    }

    // Check constraints
    if (policy?.constraints) {
      const constraintCheck = this.checkConstraints(policy, permission);
      if (!constraintCheck.allowed) {
        return constraintCheck;
      }
    }

    return {
      allowed: true,
      permission,
      agent_id: agentId,
      resource,
      policy_id: policy?.agent_id,
    };
  }

  /**
   * Check constraint limits
   */
  private checkConstraints(policy: ACLPolicy, permission: ACLPermission): ACLDecision {
    const constraints = policy.constraints;
    if (!constraints) {
      return {
        allowed: true,
        permission,
        agent_id: policy.agent_id,
      };
    }

    // Check restricted_until
    if (constraints.restricted_until) {
      const restrictedUntil = new Date(constraints.restricted_until);
      if (restrictedUntil > new Date()) {
        return {
          allowed: false,
          permission,
          agent_id: policy.agent_id,
          reason: `Agent ${policy.agent_id} is restricted until ${constraints.restricted_until}`,
          policy_id: policy.agent_id,
        };
      }
    }

    // Note: Rate limiting (max_handoffs_per_day, max_broadcasts_per_hour) should be
    // enforced by the caller using separate rate limit tracking

    return {
      allowed: true,
      permission,
      agent_id: policy.agent_id,
    };
  }

  /**
   * Simple glob pattern matching
   */
  private matchPattern(pattern: string, value: string): boolean {
    // Convert glob pattern to regex
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    return regex.test(value);
  }

  /**
   * Validate handoff recipient
   */
  validateHandoffRecipient(
    fromAgentId: string,
    toAgentId: string
  ): ACLDecision {
    const fromPolicy = this.policies.get(fromAgentId);
    const toPolicy = this.policies.get(toAgentId);

    // Check if sender has permission to initiate handoffs
    const fromPermissions = this.getEffectivePermissions(fromAgentId);
    if (!fromPermissions.includes("handoff:initiate")) {
      return {
        allowed: false,
        permission: "handoff:initiate",
        agent_id: fromAgentId,
        reason: `Sender ${fromAgentId} does not have permission to initiate handoffs`,
        policy_id: fromPolicy?.agent_id,
      };
    }

    // Check if recipient exists (has a policy)
    if (!toPolicy) {
      return {
        allowed: false,
        permission: "handoff:initiate",
        agent_id: fromAgentId,
        reason: `Recipient ${toAgentId} is not registered in the ACL system`,
        policy_id: fromPolicy?.agent_id,
      };
    }

    // Check if recipient can accept handoffs
    const toPermissions = this.getEffectivePermissions(toAgentId);
    if (!toPermissions.includes("handoff:accept")) {
      return {
        allowed: false,
        permission: "handoff:initiate",
        agent_id: fromAgentId,
        reason: `Recipient ${toAgentId} does not have permission to accept handoffs`,
        policy_id: fromPolicy?.agent_id,
      };
    }

    // Check allowed_recipients constraint on sender
    if (fromPolicy?.constraints?.allowed_recipients) {
      if (!fromPolicy.constraints.allowed_recipients.includes(toAgentId)) {
        return {
          allowed: false,
          permission: "handoff:initiate",
          agent_id: fromAgentId,
          reason: `Agent ${fromAgentId} is not allowed to send handoffs to ${toAgentId}`,
          policy_id: fromPolicy.agent_id,
        };
      }
    }

    return {
      allowed: true,
      permission: "handoff:initiate",
      agent_id: fromAgentId,
      policy_id: fromPolicy?.agent_id,
    };
  }

  /**
   * Determine rejection code from ACL decision
   */
  getRejectionCode(decision: ACLDecision): HandoffRejectionCode {
    if (decision.allowed) {
      throw new Error("Cannot get rejection code for allowed decision");
    }

    if (decision.reason?.includes("not registered")) {
      return "recipient_unavailable";
    }
    if (decision.reason?.includes("does not have permission")) {
      return "unauthorized";
    }
    if (decision.reason?.includes("not allowed to send")) {
      return "unauthorized";
    }
    if (decision.reason?.includes("restricted")) {
      return "recipient_unavailable";
    }
    if (decision.reason?.includes("overloaded")) {
      return "recipient_overloaded";
    }

    return "policy_violation";
  }

  /**
   * Bulk register policies
   */
  registerPolicies(policies: ACLPolicy[]): void {
    for (const policy of policies) {
      this.registerPolicy(policy);
    }
  }

  /**
   * Export all policies (for backup/debugging)
   */
  exportPolicies(): ACLPolicy[] {
    return Array.from(this.policies.values());
  }
}

/**
 * Create default ACL instance
 */
export function createAcpACL(): AcpACL {
  return new AcpACL();
}
