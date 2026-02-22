import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExecApprovalManager } from "./exec-approval-manager.js";
import { createHitlGateway, type HitlGatewayPolicy } from "./hitl-gateway.js";
import { createHitlPolicyEngine } from "./hitl-policy-engine.js";
import { HitlRequestStore } from "./hitl-request-store.js";

describe("hitl-gateway", () => {
  let tmpDir = "";
  let nowMs = 1_700_000_000_000;
  let store: HitlRequestStore;
  let approvalManager: ExecApprovalManager;
  let policyEngine: ReturnType<typeof createHitlPolicyEngine>;
  let gateway: HitlGateway;

  const testPolicies: HitlGatewayPolicy[] = [
    {
      id: "policy-exec",
      tool: "exec.run",
      minApproverRole: "operator",
      requireDifferentActor: true,
      gate: "required",
      timeoutMs: 60_000,
    },
    {
      id: "policy-file-write",
      tool: "file.write",
      minApproverRole: "operator",
      requireDifferentActor: true,
      gate: "required",
      timeoutMs: 30_000,
    },
    {
      id: "policy-advisory",
      tool: "http.request",
      minApproverRole: "operator",
      gate: "advisory",
      timeoutMs: 30_000,
    },
    {
      id: "policy-strict",
      tool: "system.run",
      minApproverRole: "admin",
      requireDifferentActor: true,
      gate: "strict",
      timeoutMs: 120_000,
      escalation: {
        afterTimeoutMs: 30_000,
        escalateTo: ["admin-channel"],
        fallbackAction: "deny",
      },
    },
  ];

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hitl-gateway-"));
    const dbPath = path.join(tmpDir, "hitl-requests.sqlite");
    store = new HitlRequestStore({ dbPath, now: () => nowMs });
    approvalManager = new ExecApprovalManager();
    policyEngine = createHitlPolicyEngine({
      policies: testPolicies,
      approverRoleOrder: ["user", "operator", "admin", "owner"],
    });
    gateway = createHitlGateway({
      policyEngine,
      requestStore: store,
      approvalManager,
      policies: testPolicies,
      now: () => nowMs,
    });
  });

  afterEach(async () => {
    store.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("checkAndGate", () => {
    it("returns gated=false for tools without a policy", () => {
      const result = gateway.checkAndGate({
        tool: "unknown.tool",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      expect(result.gated).toBe(false);
    });

    it("returns gated=true and creates request for policy with gate=required", () => {
      const result = gateway.checkAndGate({
        tool: "exec.run",
        arguments: { command: "ls -la" },
        requesterSession: "user-1",
        requesterRole: "user",
      });

      expect(result.gated).toBe(true);
      expect(result.policy?.id).toBe("policy-exec");
      expect(result.requestId).toBeDefined();
      expect(result.expiresAtMs).toBe(nowMs + 60_000);

      // Verify request was created in store
      const request = store.getRequest(result.requestId);
      expect(request).not.toBeNull();
      expect(request?.tool).toBe("exec.run");
      expect(request?.status).toBe("pending");
    });

    it("allows bypass for advisory gate when requester is owner", () => {
      const result = gateway.checkAndGate({
        tool: "http.request",
        requesterSession: "owner-1",
        requesterRole: "owner",
      });

      expect(result.gated).toBe(false);
    });

    it("requires approval for advisory gate when requester is not owner", () => {
      const result = gateway.checkAndGate({
        tool: "http.request",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      expect(result.gated).toBe(true);
      expect(result.policy?.gate).toBe("advisory");
    });

    it("returns strict gate level for strict policy", () => {
      const result = gateway.checkAndGate({
        tool: "system.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      expect(result.gated).toBe(true);
      expect(result.policy?.gate).toBe("strict");
      expect(result.policy?.escalation).toBeDefined();
    });
  });

  describe("authorize", () => {
    it("allows operator to approve when minApproverRole=operator", () => {
      const policy = testPolicies[0]; // policy-exec
      const result = gateway.authorize({
        policy,
        approverSession: "operator-1",
        approverRole: "operator",
        requesterSession: "user-1",
      });

      expect(result.allowed).toBe(true);
    });

    it("denies user when minApproverRole=operator", () => {
      const policy = testPolicies[0]; // policy-exec
      const result = gateway.authorize({
        policy,
        approverSession: "user-1",
        approverRole: "user",
        requesterSession: "user-2",
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("insufficient-role");
    });

    it("denies self-approval when requireDifferentActor=true", () => {
      const policy = testPolicies[0]; // policy-exec
      const result = gateway.authorize({
        policy,
        approverSession: "user-1",
        approverRole: "operator",
        requesterSession: "user-1",
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("same-actor-required-different");
    });

    it("allows different actor approval", () => {
      const policy = testPolicies[0]; // policy-exec
      const result = gateway.authorize({
        policy,
        approverSession: "operator-1",
        approverRole: "operator",
        requesterSession: "user-1",
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe("recordDecision", () => {
    it("approves request and updates status", () => {
      // First create a gated request
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });
      expect(gateResult.gated).toBe(true);

      // Record approval
      const result = gateway.recordDecision({
        requestId: gateResult.requestId,
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "approve",
        reason: "looks safe",
      });

      expect(result.success).toBe(true);
      expect(result.request?.status).toBe("approved");
      expect(result.decision?.decision).toBe("approve");
    });

    it("denies request and updates status", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      const result = gateway.recordDecision({
        requestId: gateResult.requestId,
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "deny",
        reason: "dangerous command",
      });

      expect(result.success).toBe(true);
      expect(result.request?.status).toBe("denied");
      expect(result.decision?.decision).toBe("deny");
    });

    it("rejects self-approval at decision time", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      const result = gateway.recordDecision({
        requestId: gateResult.requestId,
        actorSession: "user-1", // Same as requester
        actorRole: "operator",
        decision: "approve",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("same-actor-required-different");
    });

    it("rejects decision for non-existent request", () => {
      const result = gateway.recordDecision({
        requestId: "non-existent",
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "approve",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("request not found");
    });

    it("rejects decision for already-resolved request", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      // First approval
      gateway.recordDecision({
        requestId: gateResult.requestId,
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "approve",
      });

      // Second attempt should fail
      const result = gateway.recordDecision({
        requestId: gateResult.requestId,
        actorSession: "operator-2",
        actorRole: "operator",
        decision: "deny",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not pending");
    });

    it("requires minimum role for strict policy", () => {
      const gateResult = gateway.checkAndGate({
        tool: "system.run", // strict policy requires admin
        requesterSession: "user-1",
        requesterRole: "user",
      });

      // Try to approve as operator (should fail - needs admin)
      const result = gateway.recordDecision({
        requestId: gateResult.requestId,
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "approve",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("insufficient-role");
    });

    it("allows admin to approve strict policy", () => {
      const gateResult = gateway.checkAndGate({
        tool: "system.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      const result = gateway.recordDecision({
        requestId: gateResult.requestId,
        actorSession: "admin-1",
        actorRole: "admin",
        decision: "approve",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("expireRequest", () => {
    it("expires pending request after timeout", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      // Advance time past timeout
      nowMs += 61_000;

      const expired = gateway.expireRequest(gateResult.requestId);

      expect(expired).not.toBeNull();
      expect(expired?.status).toBe("expired");
    });

    it("escalates request if escalation is configured and timeout reached", () => {
      const gateResult = gateway.checkAndGate({
        tool: "system.run", // has escalation after 30s
        requesterSession: "user-1",
        requesterRole: "user",
      });

      // Advance time past escalation threshold (30s) but not past total timeout
      nowMs += 31_000;

      const result = gateway.expireRequest(gateResult.requestId);

      expect(result).not.toBeNull();
      expect(result?.status).toBe("escalated");

      // Verify escalation audit
      const timeline = store.getRequestWithTimeline(gateResult.requestId);
      const escalationAudit = timeline?.audit.find((a) => a.event === "request.escalated");
      expect(escalationAudit).toBeDefined();
    });

    it("does not escalate if within escalation threshold", () => {
      const gateResult = gateway.checkAndGate({
        tool: "system.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      // Advance time but not past escalation threshold
      nowMs += 29_000;

      const result = gateway.expireRequest(gateResult.requestId);

      expect(result?.status).toBe("expired");
    });
  });

  describe("strict mode transitions", () => {
    it("transitions from pending to approved via explicit approval", () => {
      const gateResult = gateway.checkAndGate({
        tool: "system.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      expect(gateResult.policy?.gate).toBe("strict");

      const result = gateway.recordDecision({
        requestId: gateResult.requestId,
        actorSession: "admin-1",
        actorRole: "admin",
        decision: "approve",
        reason: "approved after review",
      });

      expect(result.success).toBe(true);
      expect(result.request?.status).toBe("approved");
    });

    it("transitions from pending to denied", () => {
      const gateResult = gateway.checkAndGate({
        tool: "system.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      const result = gateway.recordDecision({
        requestId: gateResult.requestId,
        actorSession: "admin-1",
        actorRole: "admin",
        decision: "deny",
        reason: "not approved",
      });

      expect(result.success).toBe(true);
      expect(result.request?.status).toBe("denied");
    });

    it("transitions from escalated to approved", () => {
      const gateResult = gateway.checkAndGate({
        tool: "system.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      // Escalate
      nowMs += 31_000;
      gateway.expireRequest(gateResult.requestId);

      // Verify escalated
      let request = store.getRequest(gateResult.requestId);
      expect(request?.status).toBe("escalated");

      // Approve from escalated state
      const result = gateway.recordDecision({
        requestId: gateResult.requestId,
        actorSession: "admin-1",
        actorRole: "admin",
        decision: "approve",
        reason: "approved after escalation",
      });

      expect(result.success).toBe(true);
      expect(result.request?.status).toBe("approved");
      expect(result.decision?.type).toBe("escalation");
    });

    it("transitions from escalated to denied", () => {
      const gateResult = gateway.checkAndGate({
        tool: "system.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      // Escalate
      nowMs += 31_000;
      gateway.expireRequest(gateResult.requestId);

      // Deny from escalated state
      const result = gateway.recordDecision({
        requestId: gateResult.requestId,
        actorSession: "admin-1",
        actorRole: "admin",
        decision: "deny",
        reason: "denied after escalation",
      });

      expect(result.success).toBe(true);
      expect(result.request?.status).toBe("denied");
      expect(result.decision?.type).toBe("escalation");
    });
  });

  describe("audit trail", () => {
    it("records audit events for request creation", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        arguments: { command: "ls" },
        requesterSession: "user-1",
        requesterRole: "user",
      });

      const timeline = store.getRequestWithTimeline(gateResult.requestId);
      expect(timeline?.audit).toHaveLength(1);
      expect(timeline?.audit[0]?.event).toBe("request.created");
    });

    it("records audit events for decisions", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      gateway.recordDecision({
        requestId: gateResult.requestId,
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "approve",
        reason: "approved",
      });

      const timeline = store.getRequestWithTimeline(gateResult.requestId);
      const approvalAudit = timeline?.audit.find((a) => a.event === "decision.approved");
      expect(approvalAudit).toBeDefined();
    });
  });

  describe("listPendingRequests", () => {
    it("lists only pending and escalated requests", () => {
      // Create and approve one
      const r1 = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });
      gateway.recordDecision({
        requestId: r1.requestId,
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "approve",
      });

      // Create another that's still pending
      const r2 = gateway.checkAndGate({
        tool: "file.write",
        requesterSession: "user-2",
        requesterRole: "user",
      });

      // Create and escalate third
      const r3 = gateway.checkAndGate({
        tool: "system.run",
        requesterSession: "user-3",
        requesterRole: "user",
      });
      nowMs += 31_000;
      gateway.expireRequest(r3.requestId);

      const pending = gateway.listPendingRequests();
      expect(pending).toHaveLength(2);
      expect(pending.map((r) => r.id).toSorted((a, b) => a.localeCompare(b))).toEqual(
        [r2.requestId, r3.requestId].toSorted((a, b) => a.localeCompare(b)),
      );
    });
  });
});
