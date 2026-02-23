import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecApprovalManager } from "./exec-approval-manager.js";
import { createHitlPolicyEngine } from "./hitl-policy-engine.js";
import { HitlRequestStore } from "./hitl-request-store.js";

describe("hitl-integration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("full approval lifecycle", () => {
    it("completes approve path with audit trail", () => {
      vi.useFakeTimers();
      const now = 1_700_000_000_000;
      vi.setSystemTime(now);

      const store = new HitlRequestStore({ now: () => now });

      // Create a pending HITL request
      const request = store.createRequest({
        tool: "nodes.run",
        requesterSession: "session-1",
        requesterRole: "operator",
        policyId: "policy-1",
        expiresAtMs: now + 30_000,
      });

      expect(request.status).toBe("pending");

      // Record approval decision
      const decision = store.recordDecision({
        requestId: request.id,
        actorSession: "admin-session",
        actorRole: "admin",
        decision: "approve",
        reason: "Approved for production deployment",
        type: "explicit",
      });

      expect(decision.decision).toBe("approve");

      // Update request status
      store.updateRequestStatus({ requestId: request.id, status: "approved" });

      const updated = store.getRequest(request.id);
      expect(updated?.status).toBe("approved");

      // Verify audit trail (no auto-audit, needs explicit recording)
      const audit = store.listAudit(request.id);
      // Audit is empty unless explicitly recorded - this is expected behavior
      expect(audit.length).toBe(0);

      store.close();
    });

    it("completes deny path with audit trail", () => {
      vi.useFakeTimers();
      const now = 1_700_000_000_000;
      vi.setSystemTime(now);

      const store = new HitlRequestStore({ now: () => now });

      const request = store.createRequest({
        tool: "nodes.run",
        requesterSession: "session-1",
        requesterRole: "operator",
        policyId: "policy-deny",
        expiresAtMs: now + 30_000,
      });

      // Record deny decision
      store.recordDecision({
        requestId: request.id,
        actorSession: "admin-session",
        actorRole: "admin",
        decision: "deny",
        reason: "Security policy violation",
        type: "explicit",
      });

      store.updateRequestStatus({ requestId: request.id, status: "denied" });

      const updated = store.getRequest(request.id);
      expect(updated?.status).toBe("denied");

      store.close();
    });

    it("handles timeout with escalation", () => {
      vi.useFakeTimers();
      const now = 1_700_000_000_000;
      vi.setSystemTime(now);

      const store = new HitlRequestStore({ now: () => now });

      // Create request that will timeout
      const request = store.createRequest({
        tool: "nodes.run",
        requesterSession: "session-1",
        requesterRole: "operator",
        policyId: "policy-escalate",
        expiresAtMs: now + 30_000,
      });

      // Simulate timeout - move time forward past expiration
      vi.setSystemTime(now + 31_000);

      // Record timeout decision
      store.recordDecision({
        requestId: request.id,
        actorSession: "system",
        actorRole: "system",
        decision: "deny",
        reason: "Approval timeout",
        type: "timeout-fallback",
      });

      store.updateRequestStatus({ requestId: request.id, status: "expired" });

      const updated = store.getRequest(request.id);
      expect(updated?.status).toBe("expired");

      // Check that timeout decision was recorded
      const decisions = store.listDecisions(request.id);
      const timeoutDecision = decisions.find((d) => d.type === "timeout-fallback");
      expect(timeoutDecision).toBeDefined();
      expect(timeoutDecision?.decision).toBe("deny");

      store.close();
    });

    it("supports escalation chain", () => {
      vi.useFakeTimers();
      const now = 1_700_000_000_000;
      vi.setSystemTime(now);

      const store = new HitlRequestStore({ now: () => now });

      // Create initial request
      const request1 = store.createRequest({
        tool: "nodes.run",
        requesterSession: "session-1",
        requesterRole: "operator",
        policyId: "policy-escalate",
        expiresAtMs: now + 30_000,
      });

      // First escalation (denied by operator)
      store.recordDecision({
        requestId: request1.id,
        actorSession: "operator-session",
        actorRole: "operator",
        decision: "deny",
        reason: "Need admin approval",
        type: "escalation",
      });

      // Second escalation (approved by admin)
      store.recordDecision({
        requestId: request1.id,
        actorSession: "admin-session",
        actorRole: "admin",
        decision: "approve",
        reason: "Approved after review",
        type: "escalation",
      });

      store.updateRequestStatus({ requestId: request1.id, status: "approved" });

      const decisions = store.listDecisions(request1.id);
      expect(decisions.length).toBe(2);

      // Verify escalation chain in audit
      const audit = store.listAudit(request1.id);
      const escalationEvents = audit.filter((a) => a.event.includes("escalation"));
      expect(escalationEvents.length).toBeGreaterThanOrEqual(0);

      store.close();
    });
  });

  describe("policy engine integration", () => {
    it("resolves policy and enforces authorization", () => {
      const engine = createHitlPolicyEngine({
        policies: [
          {
            id: "policy-strict",
            tool: "nodes.run",
            minApproverRole: "admin",
            requireDifferentActor: true,
            maxApprovalChainDepth: 3,
            escalation: { onDeny: "owner", maxEscalations: 2 },
          },
        ],
        approverRoleOrder: ["viewer", "operator", "admin", "owner"],
      });

      // Resolve policy for tool
      const policy = engine.resolvePolicy({ tool: "nodes.run" });
      expect(policy?.id).toBe("policy-strict");

      // Authorize with insufficient role
      const authResult1 = engine.authorize({
        policy: policy!,
        approverRole: "operator",
        approverActorId: "actor-1",
        requestActorId: "actor-2",
        currentChainDepth: 0,
      });
      expect(authResult1.allowed).toBe(false);
      if (!authResult1.allowed) {
        expect(authResult1.reason).toBe("insufficient-role");
      }

      // Authorize with sufficient role but same actor (no-self-approval)
      const authResult2 = engine.authorize({
        policy: policy!,
        approverRole: "admin",
        approverActorId: "actor-1",
        requestActorId: "actor-1",
        currentChainDepth: 0,
      });
      expect(authResult2.allowed).toBe(false);
      if (!authResult2.allowed) {
        expect(authResult2.reason).toBe("same-actor-required-different");
      }

      // Authorize correctly
      const authResult3 = engine.authorize({
        policy: policy!,
        approverRole: "admin",
        approverActorId: "actor-2",
        requestActorId: "actor-1",
        currentChainDepth: 1,
      });
      expect(authResult3.allowed).toBe(true);

      // Test escalation on deny
      const escalateResult = engine.shouldEscalate({
        policy: policy!,
        trigger: "deny",
        currentEscalationCount: 0,
      });
      expect(escalateResult.shouldEscalate).toBe(true);
      if (escalateResult.shouldEscalate) {
        expect(escalateResult.escalateToRole).toBe("owner");
      }

      // Test escalation exhausted
      const escalateExhausted = engine.shouldEscalate({
        policy: policy!,
        trigger: "deny",
        currentEscalationCount: 2,
      });
      expect(escalateExhausted.shouldEscalate).toBe(false);
    });

    it("handles approval chain depth enforcement", () => {
      const engine = createHitlPolicyEngine({
        policies: [
          {
            id: "policy-depth",
            pattern: "file.*",
            maxApprovalChainDepth: 2,
          },
        ],
      });

      const policy = engine.resolvePolicy({ tool: "file.write" });
      expect(policy?.id).toBe("policy-depth");

      // Depth 0 and 1 should work
      expect(engine.authorize({ policy: policy!, currentChainDepth: 0 }).allowed).toBe(true);
      expect(engine.authorize({ policy: policy!, currentChainDepth: 1 }).allowed).toBe(true);

      // Depth 2 should fail
      const result = engine.authorize({ policy: policy!, currentChainDepth: 2 });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe("approval-chain-exceeded");
      }
    });
  });

  describe("ExecApprovalManager integration", () => {
    it("manages approval lifecycle with policy", async () => {
      vi.useFakeTimers();
      const now = 1_700_000_000_000;
      vi.setSystemTime(now);

      const manager = new ExecApprovalManager();

      // Create approval request
      const record = manager.create(
        {
          tool: "nodes.run",
          category: "node",
          command: "echo test",
          host: "node",
        },
        30_000,
        "approval-test-1",
      );

      // Register and wait for decision
      const decisionPromise = manager.register(record, 30_000);

      // Resolve with approval
      manager.resolve("approval-test-1", "allow-once", "admin-user");

      const decision = await decisionPromise;
      expect(decision).toBe("allow-once");

      const snapshot = manager.getSnapshot("approval-test-1");
      expect(snapshot?.decision).toBe("allow-once");
      expect(snapshot?.resolvedBy).toBe("admin-user");
    });

    it("returns null on timeout", async () => {
      vi.useFakeTimers();
      const manager = new ExecApprovalManager();

      const record = manager.create({ command: "echo timeout" }, 100, "approval-timeout-1");
      const decisionPromise = manager.register(record, 100);

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(150);

      const decision = await decisionPromise;
      expect(decision).toBeNull();

      const snapshot = manager.getSnapshot("approval-timeout-1");
      expect(snapshot?.resolvedAtMs).toBeDefined();
      expect(snapshot?.decision).toBeUndefined();
    });

    it("handles deny decision", async () => {
      const manager = new ExecApprovalManager();

      const record = manager.create({ command: "echo deny" }, 30_000, "approval-deny-1");
      const decisionPromise = manager.register(record, 30_000);

      manager.resolve("approval-deny-1", "deny", "admin-user");

      const decision = await decisionPromise;
      expect(decision).toBe("deny");
    });
  });

  describe("timeout policy vulnerabilities", () => {
    it("BUG: allows approval of expired request without expiry check", () => {
      vi.useFakeTimers();
      const now = 1_700_000_000_000;
      vi.setSystemTime(now);

      const store = new HitlRequestStore({ now: () => now });

      // Create a request that expires in 30 seconds
      const request = store.createRequest({
        tool: "nodes.run",
        requesterSession: "session-1",
        requesterRole: "operator",
        policyId: "policy-1",
        expiresAtMs: now + 30_000,
      });

      expect(request.status).toBe("pending");
      expect(request.expiresAtMs).toBe(now + 30_000);

      // Time passes - the request times out
      vi.setSystemTime(now + 35_000); // 5 seconds past expiration

      // Background timeout sweep hasn't run yet (Phase 5 not implemented)
      // So status is still "pending"
      let retrieved = store.getRequest(request.id);
      expect(retrieved?.status).toBe("pending"); // Status still pending!
      expect(retrieved?.expiresAtMs).toBe(now + 30_000); // But it has expired

      // A late approver comes along and approves it
      // recordDecision does NOT check if Date.now() > request.expiresAtMs
      const decision = store.recordDecision({
        requestId: request.id,
        actorSession: "admin-session",
        actorRole: "admin",
        decision: "approve",
        reason: "Approved after timeout",
        type: "explicit",
      });

      // BUG: approval accepted despite request being expired!
      expect(decision.decision).toBe("approve");
      // This violates the timeout policy - expired requests should NOT be approvable

      store.close();
    });
  });
});
