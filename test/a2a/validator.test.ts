/**
 * Agent-to-Agent (A2A) Communication Protocol — Validator Tests
 *
 * Comprehensive test suite covering all 7 message types, edge cases,
 * and semantic validation rules.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 * Sample payloads: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-sample-payloads.json
 */

import { describe, expect, it } from "vitest";
import { A2A_PROTOCOL_VERSION, MESSAGE_TYPES, PRIORITIES } from "../../src/gateway/a2a/types.js";
import { validateA2AMessage, type ValidationResult } from "../../src/gateway/a2a/validator.js";

// ─── Test Helpers ────────────────────────────────────────────────────────────

/** Minimal valid envelope fields. Merge with type-specific fields to create a valid message. */
function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    protocol: A2A_PROTOCOL_VERSION,
    messageId: "test-msg-001",
    timestamp: "2026-02-21T18:30:00.000Z",
    from: { agentId: "alice", role: "Engineer" },
    to: { agentId: "bob", role: "Reviewer" },
    priority: "normal",
    ...overrides,
  };
}

function validTaskRequest(): Record<string, unknown> {
  return envelope({
    type: "task_request",
    payload: {
      taskId: "task-001",
      title: "Implement feature X",
      description: "Build the thing per spec",
      taskType: "implementation",
      complexity: "medium",
    },
  });
}

function validTaskResponseAccepted(): Record<string, unknown> {
  return envelope({
    type: "task_response",
    correlationId: "proj-001",
    payload: {
      taskId: "task-001",
      action: "accepted",
    },
  });
}

function validTaskResponseCompleted(): Record<string, unknown> {
  return envelope({
    type: "task_response",
    payload: {
      taskId: "task-001",
      action: "completed",
      result: {
        branch: "alice/feature-x",
        worktree: "/home/openclaw/worktrees/feature-x",
        summary: "Done. 12 tests passing.",
        filesChanged: ["/home/openclaw/worktrees/feature-x/src/feature.ts"],
      },
    },
  });
}

function validTaskResponseDeclined(): Record<string, unknown> {
  return envelope({
    type: "task_response",
    payload: {
      taskId: "task-001",
      action: "declined",
      reason: "Currently at capacity with P0 bug fix.",
    },
  });
}

function validReviewRequest(): Record<string, unknown> {
  return envelope({
    type: "review_request",
    priority: "high",
    payload: {
      taskId: "task-001",
      title: "Review: feature X implementation",
      branch: "alice/feature-x",
      worktree: "/home/openclaw/worktrees/feature-x",
      filesForReview: ["/home/openclaw/worktrees/feature-x/src/feature.ts"],
      authorAgent: "alice",
      authorTier: "T3-Staff",
      reviewLevel: "T2+ (Bridge/Staff)",
    },
  });
}

function validReviewResponseApproved(): Record<string, unknown> {
  return envelope({
    type: "review_response",
    payload: {
      taskId: "task-001",
      verdict: "approved",
      branch: "alice/feature-x",
      worktree: "/home/openclaw/worktrees/feature-x",
      nextAction: "push_and_close",
    },
  });
}

function validReviewResponseChangesRequested(): Record<string, unknown> {
  return envelope({
    type: "review_response",
    payload: {
      taskId: "task-001",
      verdict: "changes_requested",
      branch: "alice/feature-x",
      worktree: "/home/openclaw/worktrees/feature-x",
      nextAction: "send_back_to_worker",
      unresolvedConcerns: [
        {
          file: "/home/openclaw/worktrees/feature-x/src/feature.ts",
          severity: "must_fix",
          description: "Missing null check on line 42",
        },
      ],
    },
  });
}

function validStatusUpdate(): Record<string, unknown> {
  return envelope({
    type: "status_update",
    payload: {
      status: "in_progress",
      progress: "Schema types 80% complete. Starting validator next.",
    },
  });
}

function validKnowledgeShare(): Record<string, unknown> {
  return envelope({
    type: "knowledge_share",
    payload: {
      topic: "Session payload limit",
      discovery: "sessions_send has a 10KB payload limit. Large A2A messages may need chunking.",
      source: "Discovered during router implementation",
      actionable: true,
      suggestedAction: "Add payloadRef field for large messages.",
      relevantTo: ["roman", "tony"],
    },
  });
}

function validBroadcast(): Record<string, unknown> {
  return envelope({
    type: "broadcast",
    priority: "high",
    payload: {
      scope: "org",
      topic: "A2A Protocol v1 ready",
      message: "The A2A protocol is now live. All agents should begin using structured messaging.",
      urgency: "attention_needed",
    },
  });
}

function expectValid(result: ValidationResult): void {
  if (!result.valid) {
    throw new Error(
      `Expected valid message but got errors:\n${JSON.stringify(result.errors, null, 2)}`,
    );
  }
  expect(result.valid).toBe(true);
  expect(result.message).toBeDefined();
}

function expectInvalid(result: ValidationResult, expectedPathSubstr?: string): void {
  expect(result.valid).toBe(false);
  if (!result.valid) {
    expect(result.errors.length).toBeGreaterThan(0);
    if (expectedPathSubstr) {
      const found = result.errors.some((e) => e.path.includes(expectedPathSubstr));
      if (!found) {
        throw new Error(
          `Expected error at path containing "${expectedPathSubstr}" but got:\n${JSON.stringify(result.errors, null, 2)}`,
        );
      }
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("A2A Message Validator", () => {
  // ── Basic type guards ──────────────────────────────────────────────────

  describe("input type guards", () => {
    it("rejects null", () => {
      expectInvalid(validateA2AMessage(null));
    });

    it("rejects undefined", () => {
      expectInvalid(validateA2AMessage(undefined));
    });

    it("rejects a string", () => {
      expectInvalid(validateA2AMessage("not a message"));
    });

    it("rejects a number", () => {
      expectInvalid(validateA2AMessage(42));
    });

    it("rejects an array", () => {
      expectInvalid(validateA2AMessage([1, 2, 3]));
    });

    it("rejects a boolean", () => {
      expectInvalid(validateA2AMessage(true));
    });
  });

  // ── Envelope validation ────────────────────────────────────────────────

  describe("envelope validation", () => {
    it("rejects missing protocol", () => {
      const msg = validTaskRequest();
      delete msg.protocol;
      expectInvalid(validateA2AMessage(msg), "/protocol");
    });

    it("rejects wrong protocol version", () => {
      const msg = validTaskRequest();
      msg.protocol = "openclaw.a2a.v99";
      expectInvalid(validateA2AMessage(msg), "/protocol");
    });

    it("rejects missing messageId", () => {
      const msg = validTaskRequest();
      delete msg.messageId;
      expectInvalid(validateA2AMessage(msg), "/messageId");
    });

    it("rejects empty messageId", () => {
      const msg = validTaskRequest();
      msg.messageId = "";
      expectInvalid(validateA2AMessage(msg), "/messageId");
    });

    it("rejects missing timestamp", () => {
      const msg = validTaskRequest();
      delete msg.timestamp;
      expectInvalid(validateA2AMessage(msg), "/timestamp");
    });

    it("rejects missing from", () => {
      const msg = validTaskRequest();
      delete msg.from;
      expectInvalid(validateA2AMessage(msg), "/from");
    });

    it("rejects from without agentId", () => {
      const msg = validTaskRequest();
      msg.from = { role: "Engineer" };
      expectInvalid(validateA2AMessage(msg), "/from");
    });

    it("rejects from without role", () => {
      const msg = validTaskRequest();
      msg.from = { agentId: "alice" };
      expectInvalid(validateA2AMessage(msg), "/from");
    });

    it("rejects missing to", () => {
      const msg = validTaskRequest();
      delete msg.to;
      expectInvalid(validateA2AMessage(msg), "/to");
    });

    it("rejects missing type", () => {
      const msg = validTaskRequest();
      delete msg.type;
      expectInvalid(validateA2AMessage(msg), "/type");
    });

    it("rejects invalid type", () => {
      const msg = validTaskRequest();
      msg.type = "invalid_type";
      expectInvalid(validateA2AMessage(msg), "/type");
    });

    it("rejects missing priority", () => {
      const msg = validTaskRequest();
      delete msg.priority;
      expectInvalid(validateA2AMessage(msg), "/priority");
    });

    it("rejects invalid priority", () => {
      const msg = validTaskRequest();
      msg.priority = "super_urgent";
      expectInvalid(validateA2AMessage(msg), "/priority");
    });

    it("rejects missing payload", () => {
      const msg = validTaskRequest();
      delete msg.payload;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects null payload", () => {
      const msg = validTaskRequest();
      msg.payload = null;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("accepts optional correlationId", () => {
      const msg = validTaskRequest();
      msg.correlationId = "corr-001";
      expectValid(validateA2AMessage(msg));
    });

    it("accepts null correlationId", () => {
      const msg = validTaskRequest();
      msg.correlationId = null;
      expectValid(validateA2AMessage(msg));
    });

    it("rejects non-string correlationId", () => {
      const msg = validTaskRequest();
      msg.correlationId = 123;
      expectInvalid(validateA2AMessage(msg), "/correlationId");
    });

    it("accepts null correlationId", () => {
      const msg = validTaskRequest();
      msg.correlationId = null;
      expectValid(validateA2AMessage(msg));
    });

    it("accepts message without correlationId", () => {
      const msg = validTaskRequest();
      delete msg.correlationId;
      expectValid(validateA2AMessage(msg));
    });

    it("accepts from with optional sessionKey", () => {
      const msg = validTaskRequest();
      msg.from = { agentId: "alice", role: "Engineer", sessionKey: "agent:alice:main" };
      expectValid(validateA2AMessage(msg));
    });
  });

  // ── Valid messages for each type ───────────────────────────────────────

  describe("valid messages — all 7 types", () => {
    it("validates task_request", () => {
      expectValid(validateA2AMessage(validTaskRequest()));
    });

    it("validates task_request with optional fields", () => {
      const msg = validTaskRequest();
      (msg.payload as Record<string, unknown>).deadline = "2026-02-22T00:00:00Z";
      (msg.payload as Record<string, unknown>).context = {
        branch: "alice/feature-x",
        worktree: "/home/openclaw/worktrees/feature-x",
        relatedFiles: ["/path/to/spec.md"],
      };
      (msg.payload as Record<string, unknown>).acceptanceCriteria = [
        "All tests pass",
        "No regressions",
      ];
      expectValid(validateA2AMessage(msg));
    });

    it("validates task_response (accepted)", () => {
      expectValid(validateA2AMessage(validTaskResponseAccepted()));
    });

    it("validates task_response (completed with result)", () => {
      expectValid(validateA2AMessage(validTaskResponseCompleted()));
    });

    it("validates task_response (declined with reason)", () => {
      expectValid(validateA2AMessage(validTaskResponseDeclined()));
    });

    it("validates review_request", () => {
      expectValid(validateA2AMessage(validReviewRequest()));
    });

    it("validates review_request with priorReviewNotes", () => {
      const msg = validReviewRequest();
      (msg.payload as Record<string, unknown>).priorReviewNotes =
        "First pass had type errors, now fixed.";
      expectValid(validateA2AMessage(msg));
    });

    it("validates review_response (approved)", () => {
      expectValid(validateA2AMessage(validReviewResponseApproved()));
    });

    it("validates review_response (changes_requested)", () => {
      expectValid(validateA2AMessage(validReviewResponseChangesRequested()));
    });

    it("validates review_response with reviewerFixes and nextTasks", () => {
      const msg = validReviewResponseApproved();
      const payload = msg.payload as Record<string, unknown>;
      payload.reviewerFixes = [{ file: "/path/to/file.ts", description: "Fixed typo on line 12" }];
      payload.nextTasks = [
        { title: "Implement router", assignTo: "tony", dependencies: ["schema must be stable"] },
      ];
      expectValid(validateA2AMessage(msg));
    });

    it("validates status_update", () => {
      expectValid(validateA2AMessage(validStatusUpdate()));
    });

    it("validates status_update with all optional fields", () => {
      const msg = validStatusUpdate();
      const payload = msg.payload as Record<string, unknown>;
      payload.taskId = "task-001";
      payload.blockedBy = "Waiting on schema types";
      payload.estimatedCompletion = "2026-02-22T12:00:00Z";
      expectValid(validateA2AMessage(msg));
    });

    it("validates knowledge_share", () => {
      expectValid(validateA2AMessage(validKnowledgeShare()));
    });

    it("validates knowledge_share minimal (no optional fields)", () => {
      const msg = envelope({
        type: "knowledge_share",
        payload: {
          topic: "A discovery",
          discovery: "Something important",
          source: "code review",
          actionable: false,
        },
      });
      expectValid(validateA2AMessage(msg));
    });

    it("validates broadcast", () => {
      expectValid(validateA2AMessage(validBroadcast()));
    });
  });

  // ── Payload validation per type ────────────────────────────────────────

  describe("task_request payload validation", () => {
    it("rejects missing taskId", () => {
      const msg = validTaskRequest();
      delete (msg.payload as Record<string, unknown>).taskId;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects missing title", () => {
      const msg = validTaskRequest();
      delete (msg.payload as Record<string, unknown>).title;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects missing description", () => {
      const msg = validTaskRequest();
      delete (msg.payload as Record<string, unknown>).description;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects invalid taskType", () => {
      const msg = validTaskRequest();
      (msg.payload as Record<string, unknown>).taskType = "hacking";
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects invalid complexity", () => {
      const msg = validTaskRequest();
      (msg.payload as Record<string, unknown>).complexity = "impossible";
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects empty title", () => {
      const msg = validTaskRequest();
      (msg.payload as Record<string, unknown>).title = "";
      expectInvalid(validateA2AMessage(msg), "/payload");
    });
  });

  describe("task_response payload validation", () => {
    it("rejects missing taskId", () => {
      const msg = validTaskResponseAccepted();
      delete (msg.payload as Record<string, unknown>).taskId;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects invalid action", () => {
      const msg = validTaskResponseAccepted();
      (msg.payload as Record<string, unknown>).action = "maybe";
      expectInvalid(validateA2AMessage(msg), "/payload");
    });
  });

  describe("review_request payload validation", () => {
    it("rejects missing branch", () => {
      const msg = validReviewRequest();
      delete (msg.payload as Record<string, unknown>).branch;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects empty filesForReview array", () => {
      const msg = validReviewRequest();
      (msg.payload as Record<string, unknown>).filesForReview = [];
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects missing authorAgent", () => {
      const msg = validReviewRequest();
      delete (msg.payload as Record<string, unknown>).authorAgent;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });
  });

  describe("review_response payload validation", () => {
    it("rejects invalid verdict", () => {
      const msg = validReviewResponseApproved();
      (msg.payload as Record<string, unknown>).verdict = "maybe_ok";
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects missing nextAction", () => {
      const msg = validReviewResponseApproved();
      delete (msg.payload as Record<string, unknown>).nextAction;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects invalid nextAction value", () => {
      const msg = validReviewResponseApproved();
      (msg.payload as Record<string, unknown>).nextAction = "do_nothing";
      expectInvalid(validateA2AMessage(msg), "/payload");
    });
  });

  describe("status_update payload validation", () => {
    it("rejects invalid status", () => {
      const msg = validStatusUpdate();
      (msg.payload as Record<string, unknown>).status = "vibing";
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects missing progress", () => {
      const msg = validStatusUpdate();
      delete (msg.payload as Record<string, unknown>).progress;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects empty progress string", () => {
      const msg = validStatusUpdate();
      (msg.payload as Record<string, unknown>).progress = "";
      expectInvalid(validateA2AMessage(msg), "/payload");
    });
  });

  describe("knowledge_share payload validation", () => {
    it("rejects missing topic", () => {
      const msg = validKnowledgeShare();
      delete (msg.payload as Record<string, unknown>).topic;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects missing discovery", () => {
      const msg = validKnowledgeShare();
      delete (msg.payload as Record<string, unknown>).discovery;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects missing actionable boolean", () => {
      const msg = validKnowledgeShare();
      delete (msg.payload as Record<string, unknown>).actionable;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects wrong type for actionable (string instead of boolean)", () => {
      const msg = validKnowledgeShare();
      (msg.payload as Record<string, unknown>).actionable = "yes";
      expectInvalid(validateA2AMessage(msg), "/payload");
    });
  });

  describe("broadcast payload validation", () => {
    it("rejects invalid scope", () => {
      const msg = validBroadcast();
      (msg.payload as Record<string, unknown>).scope = "everyone";
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects invalid urgency", () => {
      const msg = validBroadcast();
      (msg.payload as Record<string, unknown>).urgency = "panic";
      expectInvalid(validateA2AMessage(msg), "/payload");
    });

    it("rejects missing message", () => {
      const msg = validBroadcast();
      delete (msg.payload as Record<string, unknown>).message;
      expectInvalid(validateA2AMessage(msg), "/payload");
    });
  });

  // ── Semantic validation ────────────────────────────────────────────────

  describe("semantic validation", () => {
    it("rejects task_response with action=declined but no reason", () => {
      const msg = envelope({
        type: "task_response",
        payload: { taskId: "task-001", action: "declined" },
      });
      const result = validateA2AMessage(msg);
      expectInvalid(result, "/payload/reason");
    });

    it("rejects task_response with action=failed but no reason", () => {
      const msg = envelope({
        type: "task_response",
        payload: { taskId: "task-001", action: "failed" },
      });
      const result = validateA2AMessage(msg);
      expectInvalid(result, "/payload/reason");
    });

    it("rejects task_response with action=blocked but no reason", () => {
      const msg = envelope({
        type: "task_response",
        payload: { taskId: "task-001", action: "blocked" },
      });
      const result = validateA2AMessage(msg);
      expectInvalid(result, "/payload/reason");
    });

    it("rejects task_response with action=declined and empty reason", () => {
      const msg = envelope({
        type: "task_response",
        payload: { taskId: "task-001", action: "declined", reason: "" },
      });
      const result = validateA2AMessage(msg);
      expectInvalid(result, "/payload/reason");
    });

    it("rejects task_response with action=declined and whitespace-only reason", () => {
      const msg = envelope({
        type: "task_response",
        payload: { taskId: "task-001", action: "declined", reason: "   " },
      });
      const result = validateA2AMessage(msg);
      expectInvalid(result, "/payload/reason");
    });

    it("allows task_response with action=accepted and no reason", () => {
      expectValid(validateA2AMessage(validTaskResponseAccepted()));
    });

    it("allows task_response with action=completed and no reason", () => {
      expectValid(validateA2AMessage(validTaskResponseCompleted()));
    });

    it("rejects review_response with verdict=changes_requested but no unresolvedConcerns", () => {
      const msg = envelope({
        type: "review_response",
        payload: {
          taskId: "task-001",
          verdict: "changes_requested",
          branch: "alice/feature-x",
          worktree: "/home/openclaw/worktrees/feature-x",
          nextAction: "send_back_to_worker",
        },
      });
      const result = validateA2AMessage(msg);
      expectInvalid(result, "/payload/unresolvedConcerns");
    });

    it("rejects review_response with verdict=changes_requested and empty unresolvedConcerns", () => {
      const msg = envelope({
        type: "review_response",
        payload: {
          taskId: "task-001",
          verdict: "changes_requested",
          branch: "alice/feature-x",
          worktree: "/home/openclaw/worktrees/feature-x",
          nextAction: "send_back_to_worker",
          unresolvedConcerns: [],
        },
      });
      const result = validateA2AMessage(msg);
      expectInvalid(result, "/payload/unresolvedConcerns");
    });

    it("allows review_response with verdict=approved and no unresolvedConcerns", () => {
      expectValid(validateA2AMessage(validReviewResponseApproved()));
    });
  });

  // ── Error quality ──────────────────────────────────────────────────────

  describe("error quality", () => {
    it("returns multiple errors for a message with multiple issues", () => {
      const msg = {
        protocol: "wrong",
        // missing messageId, timestamp, from, to, type, priority, payload
      };
      const result = validateA2AMessage(msg);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(3);
      }
    });

    it("errors include path, message, and rule fields", () => {
      const msg = validTaskRequest();
      delete msg.protocol;
      const result = validateA2AMessage(msg);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        for (const err of result.errors) {
          expect(err).toHaveProperty("path");
          expect(err).toHaveProperty("message");
          expect(err).toHaveProperty("rule");
          expect(typeof err.path).toBe("string");
          expect(typeof err.message).toBe("string");
          expect(typeof err.rule).toBe("string");
        }
      }
    });

    it("error messages are descriptive (not just codes)", () => {
      const msg = validTaskRequest();
      msg.priority = "super_urgent";
      const result = validateA2AMessage(msg);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        const priorityError = result.errors.find((e) => e.path.includes("priority"));
        expect(priorityError).toBeDefined();
        expect(priorityError!.message).toContain("Invalid priority");
      }
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("rejects empty object", () => {
      expectInvalid(validateA2AMessage({}));
    });

    it("accepts all valid priority values", () => {
      for (const priority of PRIORITIES) {
        const msg = validTaskRequest();
        msg.priority = priority;
        expectValid(validateA2AMessage(msg));
      }
    });

    it("accepts all valid message types with minimal payloads", () => {
      const payloads: Record<string, object> = {
        task_request: {
          taskId: "t1",
          title: "T",
          description: "D",
          taskType: "implementation",
          complexity: "low",
        },
        task_response: {
          taskId: "t1",
          action: "accepted",
        },
        review_request: {
          taskId: "t1",
          title: "R",
          branch: "b",
          worktree: "/w",
          filesForReview: ["/f.ts"],
          authorAgent: "a",
          authorTier: "T3",
          reviewLevel: "T2",
        },
        review_response: {
          taskId: "t1",
          verdict: "approved",
          branch: "b",
          worktree: "/w",
          nextAction: "push_and_close",
        },
        status_update: {
          status: "in_progress",
          progress: "Working",
        },
        knowledge_share: {
          topic: "T",
          discovery: "D",
          source: "S",
          actionable: false,
        },
        broadcast: {
          scope: "org",
          topic: "T",
          message: "M",
          urgency: "fyi",
        },
      };

      for (const type of MESSAGE_TYPES) {
        const msg = envelope({ type, payload: payloads[type] });
        const result = validateA2AMessage(msg);
        if (!result.valid) {
          throw new Error(
            `Expected ${type} to be valid but got:\n${JSON.stringify(result.errors, null, 2)}`,
          );
        }
      }
    });

    it("handles deeply nested optional null values", () => {
      const msg = validTaskRequest();
      (msg.payload as Record<string, unknown>).deadline = null;
      (msg.payload as Record<string, unknown>).context = null;
      (msg.payload as Record<string, unknown>).acceptanceCriteria = null;
      expectValid(validateA2AMessage(msg));
    });

    it("preserves the original message object on valid result", () => {
      const msg = validTaskRequest();
      const result = validateA2AMessage(msg);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.message).toBe(msg);
      }
    });
  });
});
