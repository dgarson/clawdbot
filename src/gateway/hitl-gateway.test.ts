import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExecApprovalManager } from "./exec-approval-manager.js";
import { createHitlGateway, HitlGateway, type HitlGatewayPolicy } from "./hitl-gateway.js";
import { createHitlPolicyEngine } from "./hitl-policy-engine.js";
import { HitlRequestStore } from "./hitl-request-store.js";

const TEST_POLICIES: HitlGatewayPolicy[] = [
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
    gatewayEscalation: {
      afterTimeoutMs: 30_000,
      escalateTo: ["admin-channel"],
      fallbackAction: "deny",
    },
  },
  {
    id: "policy-none",
    tool: "read.file",
    gate: "none",
    timeoutMs: 60_000,
  },
];

describe("hitl-gateway", () => {
  let tmpDir: string;
  let nowMs = 1_700_000_000_000;
  let store: HitlRequestStore;
  let approvalManager: ExecApprovalManager;
  let policyEngine: ReturnType<typeof createHitlPolicyEngine>;
  let gateway: HitlGateway;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hitl-gateway-test-"));
    const dbPath = path.join(tmpDir, "hitl-requests.sqlite");
    nowMs = 1_700_000_000_000;
    store = new HitlRequestStore({ dbPath, now: () => nowMs });
    approvalManager = new ExecApprovalManager();
    policyEngine = createHitlPolicyEngine({
      policies: TEST_POLICIES,
      approverRoleOrder: ["user", "operator", "admin", "owner"],
    });
    gateway = createHitlGateway({
      policyEngine,
      requestStore: store,
      approvalManager,
      policies: TEST_POLICIES,
      now: () => nowMs,
    });
  });

  afterEach(async () => {
    store.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ─── checkAndGate ────────────────────────────────────────────────────────────

  describe("checkAndGate", () => {
    it("returns gated=false for tools without a matching policy", () => {
      const result = gateway.checkAndGate({
        tool: "unknown.tool",
        requesterSession: "user-1",
        requesterRole: "user",
      });
      expect(result.gated).toBe(false);
    });

    it("returns gated=false for gate=none policies", () => {
      const result = gateway.checkAndGate({
        tool: "read.file",
        requesterSession: "user-1",
        requesterRole: "user",
      });
      expect(result.gated).toBe(false);
    });

    it("returns gated=true and creates a pending request for gate=required", () => {
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

      const stored = store.getRequest(result.requestId);
      expect(stored).not.toBeNull();
      expect(stored?.tool).toBe("exec.run");
      expect(stored?.status).toBe("pending");
      expect(stored?.requesterSession).toBe("user-1");
      expect(stored?.requesterRole).toBe("user");
    });

    it("allows bypass for advisory gate when requester is owner", () => {
      const result = gateway.checkAndGate({
        tool: "http.request",
        requesterSession: "owner-1",
        requesterRole: "owner",
      });
      expect(result.gated).toBe(false);
    });

    it("gates advisory policy for non-owner roles", () => {
      const result = gateway.checkAndGate({
        tool: "http.request",
        requesterSession: "user-1",
        requesterRole: "user",
      });
      expect(result.gated).toBe(true);
      expect(result.policy?.gate).toBe("advisory");
    });

    it("gates strict policy and includes escalation config", () => {
      const result = gateway.checkAndGate({
        tool: "system.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });
      expect(result.gated).toBe(true);
      expect(result.policy?.gate).toBe("strict");
      expect(result.policy?.gatewayEscalation).toBeDefined();
      expect(result.policy?.gatewayEscalation?.fallbackAction).toBe("deny");
    });

    it("records a request.created audit event on gate", () => {
      const result = gateway.checkAndGate({
        tool: "exec.run",
        arguments: { command: "echo hi" },
        requesterSession: "user-1",
        requesterRole: "user",
      });

      expect(result.gated).toBe(true);
      const audit = store.listAudit(result.requestId);
      expect(audit.length).toBeGreaterThanOrEqual(1);
      expect(audit[0].event).toBe("request.created");
      expect(audit[0].data?.gateLevel).toBe("required");
    });
  });

  // ─── authorize ───────────────────────────────────────────────────────────────

  describe("authorize", () => {
    const execPolicy = TEST_POLICIES[0]; // policy-exec, minApproverRole=operator, requireDifferentActor=true

    it("allows operator to approve exec policy", () => {
      const result = gateway.authorize({
        policy: execPolicy,
        approverSession: "operator-1",
        approverRole: "operator",
        requesterSession: "user-1",
      });
      expect(result.allowed).toBe(true);
    });

    it("blocks user from approving operator-gated policy", () => {
      const result = gateway.authorize({
        policy: execPolicy,
        approverSession: "user-2",
        approverRole: "user",
        requesterSession: "user-1",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe("insufficient-role");
      }
    });

    it("blocks self-approval when requireDifferentActor=true", () => {
      const result = gateway.authorize({
        policy: execPolicy,
        approverSession: "user-1",
        approverRole: "operator",
        requesterSession: "user-1",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe("same-actor-required-different");
      }
    });

    it("blocks when approval chain depth exceeded", () => {
      const deepPolicy: HitlGatewayPolicy = {
        id: "policy-chain",
        tool: "chain.tool",
        minApproverRole: "operator",
        maxApprovalChainDepth: 2,
        gate: "required",
        timeoutMs: 30_000,
      };
      const result = gateway.authorize({
        policy: deepPolicy,
        approverSession: "operator-1",
        approverRole: "operator",
        requesterSession: "user-1",
        currentChainDepth: 2,
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe("approval-chain-exceeded");
      }
    });
  });

  // ─── recordDecision ──────────────────────────────────────────────────────────

  describe("recordDecision", () => {
    it("records an approval and transitions request to approved", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });
      expect(gateResult.gated).toBe(true);

      const decisionResult = gateway.recordDecision({
        requestId: gateResult.requestId!,
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "approve",
        reason: "LGTM",
      });

      expect(decisionResult.success).toBe(true);
      if (decisionResult.success) {
        expect(decisionResult.request.status).toBe("approved");
        expect(decisionResult.decision.decision).toBe("approve");
        expect(decisionResult.decision.reason).toBe("LGTM");
      }
    });

    it("records a denial and transitions request to denied", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      const decisionResult = gateway.recordDecision({
        requestId: gateResult.requestId!,
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "deny",
        reason: "Not authorized for this command",
      });

      expect(decisionResult.success).toBe(true);
      if (decisionResult.success) {
        expect(decisionResult.request.status).toBe("denied");
        expect(decisionResult.decision.decision).toBe("deny");
      }
    });

    it("returns error for unknown request ID", () => {
      const result = gateway.recordDecision({
        requestId: "nonexistent-id",
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "approve",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/not found/);
      }
    });

    it("blocks self-approval and records audit event", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      const result = gateway.recordDecision({
        requestId: gateResult.requestId!,
        actorSession: "user-1", // same as requester
        actorRole: "operator",
        decision: "approve",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/same-actor-required-different/);
      }

      // Audit trail should have the unauthorized decision event
      const audit = store.listAudit(gateResult.requestId);
      const unauthorizedEvent = audit.find((a) => a.event === "decision.unauthorized");
      expect(unauthorizedEvent).toBeDefined();
    });

    it("blocks approval on already-resolved request", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      // First approval succeeds
      gateway.recordDecision({
        requestId: gateResult.requestId!,
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "approve",
      });

      // Second approval on already-resolved request
      const second = gateway.recordDecision({
        requestId: gateResult.requestId!,
        actorSession: "operator-2",
        actorRole: "operator",
        decision: "approve",
      });

      expect(second.success).toBe(false);
      if (!second.success) {
        expect(second.error).toMatch(/not pending/);
      }
    });
  });

  // ─── expireRequest ───────────────────────────────────────────────────────────

  describe("expireRequest", () => {
    it("expires a pending request", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      const expired = gateway.expireRequest(gateResult.requestId, true);
      expect(expired?.status).toBe("expired");

      const audit = store.listAudit(gateResult.requestId);
      const expiredEvent = audit.find((a) => a.event === "request.expired");
      expect(expiredEvent).toBeDefined();
    });

    it("escalates instead of expiring when escalation threshold is reached", () => {
      const gateResult = gateway.checkAndGate({
        tool: "system.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      // Advance time past escalation threshold (30_000ms)
      nowMs += 31_000;

      const escalated = gateway.expireRequest(gateResult.requestId, false);
      expect(escalated?.status).toBe("escalated");

      const audit = store.listAudit(gateResult.requestId);
      const escalationEvent = audit.find((a) => a.event === "request.escalated");
      expect(escalationEvent).toBeDefined();
      expect(escalationEvent?.data?.escalateTo).toEqual(["admin-channel"]);
    });

    it("does not escalate when time hasn't reached threshold", () => {
      const gateResult = gateway.checkAndGate({
        tool: "system.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      // Only 10 seconds elapsed (threshold is 30_000ms)
      nowMs += 10_000;

      const result = gateway.expireRequest(gateResult.requestId, false);
      // Under threshold and not forced — will still expire since we're simulating a timeout
      // The escalation check looks at elapsed vs afterTimeoutMs
      // Since 10s < 30s threshold, it goes straight to expired
      expect(result?.status).toBe("expired");
    });

    it("returns null for unknown request ID", () => {
      const result = gateway.expireRequest("nonexistent-id");
      expect(result).toBeNull();
    });

    it("returns null for already-resolved request", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });

      gateway.recordDecision({
        requestId: gateResult.requestId!,
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "approve",
      });

      const result = gateway.expireRequest(gateResult.requestId);
      expect(result).toBeNull();
    });
  });

  // ─── listPendingRequests ─────────────────────────────────────────────────────

  describe("listPendingRequests", () => {
    it("returns only pending and escalated requests", () => {
      // Create 3 requests
      const r1 = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-1",
        requesterRole: "user",
      });
      const r2 = gateway.checkAndGate({
        tool: "file.write",
        requesterSession: "user-2",
        requesterRole: "user",
      });
      const r3 = gateway.checkAndGate({
        tool: "exec.run",
        requesterSession: "user-3",
        requesterRole: "user",
      });

      expect(r1.gated && r2.gated && r3.gated).toBe(true);

      // Approve r1
      gateway.recordDecision({
        requestId: r1.requestId!,
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "approve",
      });

      // Expire r2
      gateway.expireRequest(r2.requestId, true);

      // r3 stays pending
      const pending = gateway.listPendingRequests();
      const pendingIds = pending.map((r) => r.id);
      expect(pendingIds).toContain(r3.requestId);
      expect(pendingIds).not.toContain(r1.requestId);
      expect(pendingIds).not.toContain(r2.requestId);
    });
  });

  // ─── getRequestWithTimeline ──────────────────────────────────────────────────

  describe("getRequestWithTimeline", () => {
    it("returns full timeline for a request", () => {
      const gateResult = gateway.checkAndGate({
        tool: "exec.run",
        arguments: { command: "test" },
        requesterSession: "user-1",
        requesterRole: "user",
      });

      gateway.recordDecision({
        requestId: gateResult.requestId!,
        actorSession: "operator-1",
        actorRole: "operator",
        decision: "approve",
        reason: "Approved",
      });

      const timeline = gateway.getRequestWithTimeline(gateResult.requestId);
      expect(timeline).not.toBeNull();
      expect(timeline?.request.status).toBe("approved");
      expect(timeline?.decisions.length).toBe(1);
      expect(timeline?.audit.length).toBeGreaterThanOrEqual(2); // created + approved
    });

    it("returns null for unknown request", () => {
      const result = gateway.getRequestWithTimeline("nonexistent");
      expect(result).toBeNull();
    });
  });
});
