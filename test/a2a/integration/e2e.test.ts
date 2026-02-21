/**
 * Agent-to-Agent (A2A) Communication Protocol — Integration Tests
 *
 * End-to-end tests that simulate multi-agent communication flows
 * using all components: validator, router, SDK, and audit.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { A2AMessage } from "../../../src/gateway/a2a/types.js";
import { queryA2ALog } from "../../../src/gateway/a2a/audit-query.js";
// Audit
import { logA2AMessage } from "../../../src/gateway/a2a/audit.js";
// Router
import { A2ARouter, type DeliverFn } from "../../../src/gateway/a2a/router.js";
// SDK
import {
  initA2ASDK,
  resetA2ASDK,
  setSendFunction,
  sendTaskRequest,
  sendTaskResponse,
  sendReviewRequest,
  sendReviewResponse,
  sendStatusUpdate,
  sendKnowledgeShare,
  sendBroadcast,
  deriveCorrelationId,
} from "../../../src/gateway/a2a/sdk.js";
// Validator
import { validateA2AMessage } from "../../../src/gateway/a2a/validator.js";

// ─── Test Infrastructure ─────────────────────────────────────────────────────

let testLogDir: string;

/** In-memory mailboxes simulating agent message delivery. */
const mailboxes = new Map<string, A2AMessage[]>();

function createTestDelivery(): DeliverFn {
  return async (targetAgentId: string, message: A2AMessage) => {
    const box = mailboxes.get(targetAgentId) ?? [];
    box.push(message);
    mailboxes.set(targetAgentId, box);
    return { delivered: true };
  };
}

function getMailbox(agentId: string): A2AMessage[] {
  return mailboxes.get(agentId) ?? [];
}

let router: A2ARouter;

beforeEach(async () => {
  testLogDir = path.join(
    os.tmpdir(),
    `a2a-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await fs.mkdir(testLogDir, { recursive: true });

  mailboxes.clear();
  resetA2ASDK();

  router = new A2ARouter({
    deliver: createTestDelivery(),
    validate: validateA2AMessage,
    audit: async (message, result) => {
      await logA2AMessage(
        message as unknown as import("../../../src/gateway/a2a/audit-types.js").A2AMessageLike,
        {
          logDir: testLogDir,
          deliveryStatus: result.status === "delivered" ? "delivered" : "failed",
        },
      );
    },
    rateLimiter: { maxPerWindow: 100, windowMs: 60_000 },
    circuitBreaker: {
      maxCorrelationDepth: 20,
      maxPairMessagesPerWindow: 50,
      windowMs: 60_000,
      cooldownMs: 30_000,
    },
  });
});

afterEach(async () => {
  resetA2ASDK();
  try {
    await fs.rm(testLogDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

/** Switch the SDK context to impersonate an agent. */
function impersonate(agentId: string, role: string) {
  resetA2ASDK();
  initA2ASDK({ agentId, role, sessionKey: `agent:${agentId}:main` });
  setSendFunction(async (msg) => {
    await router.route(msg);
  });
}

// ─── Integration Scenarios ───────────────────────────────────────────────────

describe("E2E: Task Request → Accept → Complete flow", () => {
  it("simulates a full task lifecycle", async () => {
    // 1. Amadeus sends a task request to Roman
    impersonate("amadeus", "CAIO");
    const taskReq = await sendTaskRequest({
      to: { agentId: "roman", role: "Staff Engineer" },
      priority: "high",
      payload: {
        taskId: "task-e2e-001",
        title: "Implement A2A validator",
        description: "Build the validator per spec",
        taskType: "implementation",
        complexity: "medium",
        context: {
          branch: "roman/a2a-validator",
          worktree: "/Users/openclaw/openclaw/worktrees/a2a-validator",
        },
      },
    });

    expect(getMailbox("roman")).toHaveLength(1);
    expect(getMailbox("roman")[0].type).toBe("task_request");

    const corrId = deriveCorrelationId(taskReq);

    // 2. Roman accepts
    impersonate("roman", "Staff Engineer");
    await sendTaskResponse({
      to: { agentId: "amadeus", role: "CAIO" },
      correlationId: corrId,
      payload: { taskId: "task-e2e-001", action: "accepted" },
    });

    expect(getMailbox("amadeus")).toHaveLength(1);
    expect(getMailbox("amadeus")[0].type).toBe("task_response");

    // 3. Roman sends a status update
    await sendStatusUpdate({
      to: { agentId: "amadeus", role: "CAIO" },
      correlationId: corrId,
      payload: {
        taskId: "task-e2e-001",
        status: "in_progress",
        progress: "Types done, starting validator",
      },
    });

    expect(getMailbox("amadeus")).toHaveLength(2);

    // 4. Roman completes and sends result
    await sendTaskResponse({
      to: { agentId: "amadeus", role: "CAIO" },
      correlationId: corrId,
      payload: {
        taskId: "task-e2e-001",
        action: "completed",
        result: {
          branch: "roman/a2a-validator",
          worktree: "/Users/openclaw/openclaw/worktrees/a2a-validator",
          summary: "Validator complete. 82 tests passing.",
          filesChanged: [
            "/Users/openclaw/openclaw/worktrees/a2a-validator/src/gateway/a2a/validator.ts",
          ],
        },
      },
    });

    expect(getMailbox("amadeus")).toHaveLength(3);

    // 5. Verify audit trail
    const auditResult = await queryA2ALog({ correlationId: corrId }, { logDir: testLogDir });
    // task_req + accept + status + complete = 4 messages (task_req has no correlationId by default, so 3)
    expect(auditResult.totalCount).toBeGreaterThanOrEqual(3);
  });
});

describe("E2E: Review cycle with send-back", () => {
  it("simulates review → changes_requested → re-review → approved", async () => {
    const corrId = "review-cycle-001";

    // 1. Roman submits for review
    impersonate("roman", "Staff Engineer");
    await sendReviewRequest({
      to: { agentId: "tim", role: "VP Architecture" },
      correlationId: corrId,
      payload: {
        taskId: "task-review-001",
        title: "Review: A2A validator",
        branch: "roman/a2a-validator",
        worktree: "/w/a2a-validator",
        filesForReview: ["/w/a2a-validator/src/gateway/a2a/validator.ts"],
        authorAgent: "roman",
        authorTier: "T3-Staff",
        reviewLevel: "T1 (VP Architecture)",
      },
    });

    expect(getMailbox("tim")).toHaveLength(1);

    // 2. Tim sends back with changes requested
    impersonate("tim", "VP Architecture");
    await sendReviewResponse({
      to: { agentId: "roman", role: "Staff Engineer" },
      correlationId: corrId,
      payload: {
        taskId: "task-review-001",
        verdict: "changes_requested",
        branch: "roman/a2a-validator",
        worktree: "/w/a2a-validator",
        nextAction: "send_back_to_worker",
        unresolvedConcerns: [
          {
            file: "/w/a2a-validator/src/gateway/a2a/validator.ts",
            line: 52,
            severity: "must_fix",
            description: "Missing null check on optional correlationId",
          },
        ],
      },
    });

    expect(getMailbox("roman")).toHaveLength(1);
    const feedback = getMailbox("roman")[0];
    expect(feedback.type).toBe("review_response");

    // 3. Roman fixes and re-submits
    impersonate("roman", "Staff Engineer");
    await sendReviewRequest({
      to: { agentId: "tim", role: "VP Architecture" },
      correlationId: corrId,
      payload: {
        taskId: "task-review-001",
        title: "Review (v2): A2A validator — null check added",
        branch: "roman/a2a-validator",
        worktree: "/w/a2a-validator",
        filesForReview: ["/w/a2a-validator/src/gateway/a2a/validator.ts"],
        authorAgent: "roman",
        authorTier: "T3-Staff",
        reviewLevel: "T1 (VP Architecture)",
        priorReviewNotes: "Fixed null check on correlationId per Tim's feedback.",
      },
    });

    expect(getMailbox("tim")).toHaveLength(2);

    // 4. Tim approves
    impersonate("tim", "VP Architecture");
    await sendReviewResponse({
      to: { agentId: "roman", role: "Staff Engineer" },
      correlationId: corrId,
      payload: {
        taskId: "task-review-001",
        verdict: "approved",
        branch: "roman/a2a-validator",
        worktree: "/w/a2a-validator",
        nextAction: "push_and_close",
        reviewerFixes: [
          {
            file: "/w/a2a-validator/src/gateway/a2a/validator.ts",
            description: "Added explicit null check (line 52)",
          },
        ],
        nextTasks: [{ title: "Implement router", assignTo: "tony" }],
      },
    });

    expect(getMailbox("roman")).toHaveLength(2);

    // 5. Verify full cycle in audit
    const auditResult = await queryA2ALog({ correlationId: corrId }, { logDir: testLogDir });
    expect(auditResult.totalCount).toBe(4); // review_req + changes_req + review_req_v2 + approved
  });
});

describe("E2E: Knowledge broadcast", () => {
  it("broadcasts knowledge to all agents", async () => {
    impersonate("tim", "VP Architecture");

    await sendKnowledgeShare({
      to: { agentId: "amadeus", role: "CAIO" },
      payload: {
        topic: "Session payload limit",
        discovery: "sessions_send has a 10KB payload limit",
        source: "Router code review",
        actionable: true,
        suggestedAction: "Add payloadRef for large messages",
        relevantTo: ["roman", "tony", "sandy"],
      },
    });

    expect(getMailbox("amadeus")).toHaveLength(1);
    expect(getMailbox("amadeus")[0].type).toBe("knowledge_share");
  });

  it("broadcasts org-wide announcements", async () => {
    impersonate("amadeus", "CAIO");

    await sendBroadcast({
      priority: "high",
      payload: {
        scope: "org",
        topic: "A2A Protocol v1 Live",
        message: "Begin using structured A2A messaging for all inter-agent coordination.",
        urgency: "attention_needed",
      },
    });

    // Broadcast goes to "*" — our test delivery will put it in the "*" mailbox
    expect(getMailbox("*")).toHaveLength(1);
    expect(getMailbox("*")[0].type).toBe("broadcast");
  });
});

describe("E2E: Rate limit trigger", () => {
  it("rate limits an agent that sends too many messages", async () => {
    // Create a router with very low rate limit
    const lowLimitRouter = new A2ARouter({
      deliver: createTestDelivery(),
      validate: validateA2AMessage,
      rateLimiter: { maxPerWindow: 3, windowMs: 60_000 },
    });

    impersonate("alice", "Engineer");

    // Send 3 — should all succeed
    for (let i = 0; i < 3; i++) {
      const msg = await sendTaskRequest({
        to: { agentId: "bob", role: "Reviewer" },
        payload: {
          taskId: `t-${i}`,
          title: "T",
          description: "D",
          taskType: "implementation",
          complexity: "low",
        },
      });
      // Route directly (bypass the SDK send function which uses the default router)
      const result = await lowLimitRouter.route(msg);
      expect(result.status).toBe("delivered");
    }

    // 4th should be rate limited
    const msg = await sendTaskRequest({
      to: { agentId: "bob", role: "Reviewer" },
      payload: {
        taskId: "t-overflow",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    const result = await lowLimitRouter.route(msg);
    expect(result.status).toBe("rate_limited");
    expect(result.error).toContain("rate limit");
  });
});

describe("E2E: Circuit breaker activation", () => {
  it("trips circuit breaker on message flood between agent pair", async () => {
    const cbRouter = new A2ARouter({
      deliver: createTestDelivery(),
      validate: validateA2AMessage,
      circuitBreaker: {
        maxPairMessagesPerWindow: 5,
        windowMs: 60_000,
        cooldownMs: 30_000,
        maxCorrelationDepth: 50,
      },
      rateLimiter: { maxPerWindow: 100, windowMs: 60_000 },
    });

    impersonate("alice", "Engineer");

    // Send 5 — should work
    for (let i = 0; i < 5; i++) {
      const msg = await sendTaskRequest({
        to: { agentId: "bob", role: "Reviewer" },
        payload: {
          taskId: `flood-${i}`,
          title: "T",
          description: "D",
          taskType: "implementation",
          complexity: "low",
        },
      });
      const result = await cbRouter.route(msg);
      expect(result.status).toBe("delivered");
    }

    // 6th should trip circuit
    const msg = await sendTaskRequest({
      to: { agentId: "bob", role: "Reviewer" },
      payload: {
        taskId: "flood-trip",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    const result = await cbRouter.route(msg);
    expect(result.status).toBe("circuit_open");
    expect(result.error).toContain("exceeded");
  });

  it("trips on correlation depth overflow", async () => {
    const cbRouter = new A2ARouter({
      deliver: createTestDelivery(),
      validate: validateA2AMessage,
      circuitBreaker: {
        maxCorrelationDepth: 5,
        maxPairMessagesPerWindow: 100,
        windowMs: 60_000,
        cooldownMs: 30_000,
      },
      rateLimiter: { maxPerWindow: 100, windowMs: 60_000 },
    });

    impersonate("alice", "Engineer");
    const corrId = "deep-chain";

    for (let i = 0; i < 5; i++) {
      const msg = await sendStatusUpdate({
        to: { agentId: "bob", role: "Reviewer" },
        correlationId: corrId,
        payload: { status: "in_progress", progress: `Step ${i}` },
      });
      const result = await cbRouter.route(msg);
      expect(result.status).toBe("delivered");
    }

    const msg = await sendStatusUpdate({
      to: { agentId: "bob", role: "Reviewer" },
      correlationId: corrId,
      payload: { status: "in_progress", progress: "One too many" },
    });
    const result = await cbRouter.route(msg);
    expect(result.status).toBe("circuit_open");
  });
});

describe("E2E: Validation rejects malformed messages via router", () => {
  it("rejects a message with invalid type via the router", async () => {
    const result = await router.route({
      protocol: "openclaw.a2a.v1",
      messageId: "bad-1",
      timestamp: "2026-02-21T00:00:00Z",
      from: { agentId: "alice", role: "Eng" },
      to: { agentId: "bob", role: "Rev" },
      type: "invalid_type",
      priority: "normal",
      payload: {},
    });

    expect(result.status).toBe("validation_failed");
  });

  it("rejects a message missing required fields via the router", async () => {
    const result = await router.route({
      protocol: "openclaw.a2a.v1",
      // missing everything else
    });

    expect(result.status).toBe("validation_failed");
    expect(result.errors!.length).toBeGreaterThan(0);
  });
});

describe("E2E: Audit trail integrity", () => {
  it("all routed messages appear in the audit log", async () => {
    impersonate("alice", "Engineer");
    setSendFunction(async (msg) => {
      await router.route(msg);
    });

    await sendTaskRequest({
      to: { agentId: "bob", role: "Reviewer" },
      payload: {
        taskId: "audit-1",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });

    impersonate("bob", "Reviewer");
    setSendFunction(async (msg) => {
      await router.route(msg);
    });

    await sendTaskResponse({
      to: { agentId: "alice", role: "Engineer" },
      payload: { taskId: "audit-1", action: "accepted" },
    });

    const audit = await queryA2ALog({}, { logDir: testLogDir });
    expect(audit.totalCount).toBe(2);
    expect(audit.entries[0].message.type).toBe("task_request");
    expect(audit.entries[1].message.type).toBe("task_response");
  });

  it("failed deliveries are also audited", async () => {
    // Use a separate log dir so we don't see entries from other tests
    const failLogDir = path.join(testLogDir, "fail-test");
    await fs.mkdir(failLogDir, { recursive: true });

    const failRouter = new A2ARouter({
      deliver: async () => ({ delivered: false, error: "Agent offline" }),
      validate: validateA2AMessage,
      audit: async (message, _result) => {
        await logA2AMessage(
          message as unknown as import("../../../src/gateway/a2a/audit-types.js").A2AMessageLike,
          {
            logDir: failLogDir,
            deliveryStatus: "failed",
          },
        );
      },
    });

    impersonate("alice", "Engineer");
    const msg = await sendTaskRequest({
      to: { agentId: "offline-agent", role: "Ghost" },
      payload: {
        taskId: "fail-1",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    await failRouter.route(msg);

    const audit = await queryA2ALog({}, { logDir: failLogDir });
    expect(audit.totalCount).toBe(1);
    expect(audit.entries[0].meta.deliveryStatus).toBe("failed");
  });
});

describe("E2E: Full system metrics", () => {
  it("tracks all metric categories", async () => {
    const metricRouter = new A2ARouter({
      deliver: createTestDelivery(),
      validate: validateA2AMessage,
      rateLimiter: { maxPerWindow: 2, windowMs: 60_000 },
    });

    impersonate("alice", "Engineer");

    // 2 successful deliveries
    for (let i = 0; i < 2; i++) {
      const msg = await sendTaskRequest({
        to: { agentId: "bob", role: "Reviewer" },
        payload: {
          taskId: `m-${i}`,
          title: "T",
          description: "D",
          taskType: "implementation",
          complexity: "low",
        },
      });
      await metricRouter.route(msg);
    }

    // 1 rate limited
    const msg = await sendTaskRequest({
      to: { agentId: "bob", role: "Reviewer" },
      payload: {
        taskId: "m-overflow",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    await metricRouter.route(msg);

    // 1 validation failure
    await metricRouter.route({ bad: "message" });

    expect(metricRouter.metrics.totalRouted).toBe(4);
    expect(metricRouter.metrics.totalDelivered).toBe(2);
    expect(metricRouter.metrics.totalRateLimited).toBe(1);
    expect(metricRouter.metrics.totalValidationFailed).toBe(1);
  });
});
