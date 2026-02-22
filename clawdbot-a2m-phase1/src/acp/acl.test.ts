/**
 * ACP ACL Tests — Phase 1
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createAcpACL } from "./acl.js";
import type { ACLPolicy, ACLPermission, ACLRole } from "./handoff-types.js";

describe("AcpACL", () => {
  let acl: ReturnType<typeof createAcpACL>;

  beforeEach(() => {
    acl = createAcpACL();
  });

  describe("registerPolicy", () => {
    it("should register a policy for an agent", () => {
      const policy: ACLPolicy = {
        agent_id: "agent-001",
        role: "executor",
        permissions: ["handoff:initiate", "message:send"],
      };

      acl.registerPolicy(policy);

      const retrieved = acl.getPolicy("agent-001");
      expect(retrieved).toEqual(policy);
    });

    it("should update existing policy", () => {
      acl.registerPolicy({
        agent_id: "agent-001",
        role: "observer",
        permissions: ["artifact:read"],
      });

      acl.registerPolicy({
        agent_id: "agent-001",
        role: "executor",
        permissions: ["handoff:initiate"],
      });

      const policy = acl.getPolicy("agent-001");
      expect(policy?.role).toBe("executor");
      expect(policy?.permissions).toEqual(["handoff:initiate"]);
    });
  });

  describe("checkPermission", () => {
    it("should allow permission when in policy", () => {
      acl.registerPolicy({
        agent_id: "agent-001",
        role: "executor",
        permissions: ["handoff:initiate", "message:send"],
      });

      const decision = acl.checkPermission("handoff:initiate", "agent-001");

      expect(decision.allowed).toBe(true);
      expect(decision.permission).toBe("handoff:initiate");
    });

    it("should deny permission when not in policy", () => {
      acl.registerPolicy({
        agent_id: "agent-001",
        role: "observer",
        permissions: ["artifact:read"],
      });

      const decision = acl.checkPermission("handoff:initiate", "agent-001");

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("does not have permission");
    });

    it("should use role-based permissions when policy has no custom permissions", () => {
      acl.registerPolicy({
        agent_id: "agent-001",
        role: "coordinator",
        permissions: [], // Empty - use role defaults
      });

      const decision = acl.checkPermission("handoff:initiate", "agent-001");

      expect(decision.allowed).toBe(true);
    });

    it("should default to observer role when no policy exists", () => {
      const decision = acl.checkPermission("message:send", "unknown-agent");

      expect(decision.allowed).toBe(true); // Observer has message:send
    });

    it("should check resource patterns", () => {
      acl.registerPolicy({
        agent_id: "agent-001",
        role: "executor",
        permissions: ["artifact:read"],
        resource_patterns: ["/workspace/team-a/**"],
      });

      const allowedDecision = acl.checkPermission(
        "artifact:read",
        "agent-001",
        "/workspace/team-a/file1.ts"
      );
      expect(allowedDecision.allowed).toBe(true);

      const deniedDecision = acl.checkPermission(
        "artifact:read",
        "agent-001",
        "/workspace/team-b/file2.ts"
      );
      expect(deniedDecision.allowed).toBe(false);
      expect(deniedDecision.reason).toContain("does not match allowed patterns");
    });

    it("should check restricted_until constraint", () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow

      acl.registerPolicy({
        agent_id: "agent-001",
        role: "executor",
        permissions: ["handoff:initiate"],
        constraints: {
          restricted_until: futureDate,
        },
      });

      const decision = acl.checkPermission("handoff:initiate", "agent-001");

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("restricted until");
    });

    it("should allow after restriction expires", () => {
      const pastDate = new Date(Date.now() - 1000).toISOString(); // 1 second ago

      acl.registerPolicy({
        agent_id: "agent-001",
        role: "executor",
        permissions: ["handoff:initiate"],
        constraints: {
          restricted_until: pastDate,
        },
      });

      const decision = acl.checkPermission("handoff:initiate", "agent-001");

      expect(decision.allowed).toBe(true);
    });
  });

  describe("validateHandoffRecipient", () => {
    it("should validate recipient can accept handoffs", () => {
      acl.registerPolicy({
        agent_id: "sender",
        role: "executor",
        permissions: ["handoff:initiate"],
      });

      acl.registerPolicy({
        agent_id: "receiver",
        role: "reviewer",
        permissions: ["handoff:accept"],
      });

      const decision = acl.validateHandoffRecipient("sender", "receiver");

      expect(decision.allowed).toBe(true);
    });

    it("should reject if recipient is not registered", () => {
      acl.registerPolicy({
        agent_id: "sender",
        role: "executor",
        permissions: ["handoff:initiate"],
      });

      const decision = acl.validateHandoffRecipient("sender", "unknown-receiver");

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("not registered");
    });

    it("should reject if recipient cannot accept handoffs", () => {
      acl.registerPolicy({
        agent_id: "sender",
        role: "executor",
        permissions: ["handoff:initiate"],
      });

      acl.registerPolicy({
        agent_id: "receiver",
        role: "observer",
        permissions: ["artifact:read"], // No handoff:accept
      });

      const decision = acl.validateHandoffRecipient("sender", "receiver");

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("does not have permission to accept");
    });

    it("should check allowed_recipients constraint", () => {
      acl.registerPolicy({
        agent_id: "sender",
        role: "executor",
        permissions: ["handoff:initiate"],
        constraints: {
          allowed_recipients: ["allowed-receiver"],
        },
      });

      acl.registerPolicy({
        agent_id: "allowed-receiver",
        role: "reviewer",
        permissions: ["handoff:accept"],
      });

      acl.registerPolicy({
        agent_id: "blocked-receiver",
        role: "reviewer",
        permissions: ["handoff:accept"],
      });

      const allowed = acl.validateHandoffRecipient("sender", "allowed-receiver");
      expect(allowed.allowed).toBe(true);

      const blocked = acl.validateHandoffRecipient("sender", "blocked-receiver");
      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toContain("not allowed to send handoffs to");
    });

    it("should reject if sender cannot initiate handoffs", () => {
      acl.registerPolicy({
        agent_id: "sender-noperm",
        role: "observer",
        permissions: ["artifact:read"], // No handoff:initiate
      });

      acl.registerPolicy({
        agent_id: "receiver",
        role: "reviewer",
        permissions: ["handoff:accept"],
      });

      const decision = acl.validateHandoffRecipient("sender-noperm", "receiver");

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain("does not have permission to initiate handoffs");
    });
  });

  describe("getRejectionCode", () => {
    it("should map 'not registered' to recipient_unavailable", () => {
      const decision = acl.checkPermission("handoff:initiate", "unknown");
      const code = acl.getRejectionCode({
        ...decision,
        reason: "Agent unknown is not registered in the ACL system",
      });
      expect(code).toBe("recipient_unavailable");
    });

    it("should map 'does not have permission' to unauthorized", () => {
      const code = acl.getRejectionCode({
        allowed: false,
        permission: "handoff:initiate",
        agent_id: "agent-001",
        reason: "Agent agent-001 does not have permission: handoff:initiate",
      });
      expect(code).toBe("unauthorized");
    });

    it("should map 'restricted' to recipient_unavailable", () => {
      const code = acl.getRejectionCode({
        allowed: false,
        permission: "handoff:initiate",
        agent_id: "agent-001",
        reason: "Agent agent-001 is restricted until 2026-01-01",
      });
      expect(code).toBe("recipient_unavailable");
    });

    it("should default to policy_violation for unknown reasons", () => {
      const code = acl.getRejectionCode({
        allowed: false,
        permission: "handoff:initiate",
        agent_id: "agent-001",
        reason: "Some unknown reason",
      });
      expect(code).toBe("policy_violation");
    });
  });

  describe("bulk operations", () => {
    it("should register multiple policies", () => {
      const policies: ACLPolicy[] = [
        { agent_id: "agent-001", role: "executor", permissions: [] },
        { agent_id: "agent-002", role: "reviewer", permissions: [] },
        { agent_id: "agent-003", role: "coordinator", permissions: [] },
      ];

      acl.registerPolicies(policies);

      expect(acl.getPolicy("agent-001")).toBeDefined();
      expect(acl.getPolicy("agent-002")).toBeDefined();
      expect(acl.getPolicy("agent-003")).toBeDefined();
    });

    it("should export all policies", () => {
      acl.registerPolicies([
        { agent_id: "agent-001", role: "executor", permissions: ["handoff:initiate"] },
        { agent_id: "agent-002", role: "reviewer", permissions: ["handoff:accept"] },
      ]);

      const exported = acl.exportPolicies();

      expect(exported).toHaveLength(2);
      expect(exported.find(p => p.agent_id === "agent-001")).toBeDefined();
      expect(exported.find(p => p.agent_id === "agent-002")).toBeDefined();
    });

    it("should remove policy", () => {
      acl.registerPolicy({
        agent_id: "agent-001",
        role: "executor",
        permissions: [],
      });

      const removed = acl.removePolicy("agent-001");
      expect(removed).toBe(true);
      expect(acl.getPolicy("agent-001")).toBeUndefined();

      const removedAgain = acl.removePolicy("agent-001");
      expect(removedAgain).toBe(false);
    });
  });

  describe("role permissions", () => {
    it("should have correct default permissions for each role", () => {
      const roleTests: Array<{ role: ACLRole; required: ACLPermission[] }> = [
        { role: "owner", required: ["admin:configure", "team:manage"] },
        { role: "coordinator", required: ["handoff:initiate", "team:create"] },
        { role: "executor", required: ["handoff:initiate", "artifact:update"] },
        { role: "reviewer", required: ["handoff:accept", "handoff:reject"] },
        { role: "observer", required: ["artifact:read"] },
      ];

      for (const { role, required } of roleTests) {
        const agentId = `test-${role}`;
        acl.registerPolicy({
          agent_id: agentId,
          role,
          permissions: [], // Use role defaults
        });

        const permissions = acl.getEffectivePermissions(agentId);
        for (const perm of required) {
          expect(permissions).toContain(perm);
        }
      }
    });
  });
});
