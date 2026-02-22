/**
 * Agent-to-Agent (A2A) Communication Protocol — SDK Tests
 *
 * Tests for the agent-side SDK helper functions.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  initA2ASDK,
  resetA2ASDK,
  getContext,
  setSendFunction,
  sendTaskRequest,
  sendTaskResponse,
  sendReviewRequest,
  sendReviewResponse,
  sendStatusUpdate,
  sendKnowledgeShare,
  sendBroadcast,
  parseA2AMessage,
  isA2AMessage,
  getMessageType,
  deriveCorrelationId,
} from "../../src/gateway/a2a/sdk.js";
import { A2A_PROTOCOL_VERSION } from "../../src/gateway/a2a/types.js";

// ─── Setup ───────────────────────────────────────────────────────────────────

const mockSend = vi.fn(async () => {});

beforeEach(() => {
  resetA2ASDK();
  mockSend.mockClear();
  initA2ASDK({ agentId: "alice", role: "Engineer", sessionKey: "agent:alice:main" });
  setSendFunction(mockSend);
});

afterEach(() => {
  resetA2ASDK();
});

const bobRef = { agentId: "bob", role: "Reviewer" };

// ─── Context Tests ───────────────────────────────────────────────────────────

describe("A2A SDK Context", () => {
  it("throws when context not initialized", () => {
    resetA2ASDK();
    expect(() => getContext()).toThrow("A2A SDK not initialized");
  });

  it("returns context after initialization", () => {
    const ctx = getContext();
    expect(ctx.agentId).toBe("alice");
    expect(ctx.role).toBe("Engineer");
    expect(ctx.sessionKey).toBe("agent:alice:main");
  });

  it("does not leak context mutations", () => {
    const ctx1 = getContext();
    (ctx1 as Record<string, unknown>).agentId = "hacked";
    const ctx2 = getContext();
    expect(ctx2.agentId).toBe("alice");
  });
});

// ─── Message Builder Tests ───────────────────────────────────────────────────

describe("sendTaskRequest", () => {
  it("builds a valid task_request message", async () => {
    const msg = await sendTaskRequest({
      to: bobRef,
      payload: {
        taskId: "task-001",
        title: "Build feature",
        description: "Do the thing",
        taskType: "implementation",
        complexity: "medium",
      },
    });

    expect(msg.protocol).toBe(A2A_PROTOCOL_VERSION);
    expect(msg.type).toBe("task_request");
    expect(msg.from.agentId).toBe("alice");
    expect(msg.from.sessionKey).toBe("agent:alice:main");
    expect(msg.to).toEqual(bobRef);
    expect(msg.priority).toBe("normal");
    expect(msg.messageId).toBeTruthy();
    expect(msg.timestamp).toBeTruthy();
    expect(msg.payload.taskId).toBe("task-001");
  });

  it("generates unique messageIds", async () => {
    const msg1 = await sendTaskRequest({
      to: bobRef,
      payload: {
        taskId: "t1",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    const msg2 = await sendTaskRequest({
      to: bobRef,
      payload: {
        taskId: "t2",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    expect(msg1.messageId).not.toBe(msg2.messageId);
  });

  it("respects custom priority", async () => {
    const msg = await sendTaskRequest({
      to: bobRef,
      priority: "urgent",
      payload: {
        taskId: "t1",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    expect(msg.priority).toBe("urgent");
  });

  it("passes correlationId", async () => {
    const msg = await sendTaskRequest({
      to: bobRef,
      correlationId: "corr-001",
      payload: {
        taskId: "t1",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    expect(msg.correlationId).toBe("corr-001");
  });

  it("calls the send function", async () => {
    await sendTaskRequest({
      to: bobRef,
      payload: {
        taskId: "t1",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].type).toBe("task_request");
  });
});

describe("sendTaskResponse", () => {
  it("builds a task_response message", async () => {
    const msg = await sendTaskResponse({
      to: bobRef,
      correlationId: "corr-001",
      payload: {
        taskId: "task-001",
        action: "completed",
        result: { branch: "alice/feat", worktree: "/w", summary: "Done" },
      },
    });

    expect(msg.type).toBe("task_response");
    expect(msg.payload.action).toBe("completed");
    expect(msg.payload.result?.branch).toBe("alice/feat");
  });
});

describe("sendReviewRequest", () => {
  it("builds a review_request with high priority default", async () => {
    const msg = await sendReviewRequest({
      to: bobRef,
      payload: {
        taskId: "task-001",
        title: "Review: feature X",
        branch: "alice/feat",
        worktree: "/w",
        filesForReview: ["/w/src/feat.ts"],
        authorAgent: "alice",
        authorTier: "T3",
        reviewLevel: "T2+",
      },
    });

    expect(msg.type).toBe("review_request");
    expect(msg.priority).toBe("high"); // default for review requests
    expect(msg.payload.filesForReview).toHaveLength(1);
  });
});

describe("sendReviewResponse", () => {
  it("builds a review_response message", async () => {
    const msg = await sendReviewResponse({
      to: bobRef,
      payload: {
        taskId: "task-001",
        verdict: "approved",
        branch: "alice/feat",
        worktree: "/w",
        nextAction: "push_and_close",
      },
    });

    expect(msg.type).toBe("review_response");
    expect(msg.payload.verdict).toBe("approved");
  });
});

describe("sendStatusUpdate", () => {
  it("builds a status_update message", async () => {
    const msg = await sendStatusUpdate({
      to: bobRef,
      payload: {
        status: "in_progress",
        progress: "Working on validator. 50% done.",
        taskId: "task-001",
      },
    });

    expect(msg.type).toBe("status_update");
    expect(msg.payload.status).toBe("in_progress");
  });
});

describe("sendKnowledgeShare", () => {
  it("builds a knowledge_share message", async () => {
    const msg = await sendKnowledgeShare({
      to: bobRef,
      payload: {
        topic: "Performance insight",
        discovery: "Found a 10KB limit on sessions_send",
        source: "code review",
        actionable: true,
        suggestedAction: "Add file-reference mode",
      },
    });

    expect(msg.type).toBe("knowledge_share");
    expect(msg.payload.actionable).toBe(true);
  });
});

describe("sendBroadcast", () => {
  it("builds a broadcast with wildcard to", async () => {
    const msg = await sendBroadcast({
      payload: {
        scope: "org",
        topic: "A2A ready",
        message: "Protocol is live!",
        urgency: "attention_needed",
      },
    });

    expect(msg.type).toBe("broadcast");
    expect(msg.to.agentId).toBe("*");
    expect(msg.to.role).toBe("*");
    expect(msg.payload.scope).toBe("org");
  });

  it("allows custom priority on broadcast", async () => {
    const msg = await sendBroadcast({
      priority: "high",
      payload: { scope: "c-suite", topic: "T", message: "M", urgency: "action_required" },
    });
    expect(msg.priority).toBe("high");
  });
});

// ─── Parsing Tests ───────────────────────────────────────────────────────────

describe("parseA2AMessage", () => {
  it("parses a valid A2A message", () => {
    const raw = {
      protocol: A2A_PROTOCOL_VERSION,
      messageId: "test",
      timestamp: "2026-02-21T18:30:00Z",
      from: { agentId: "alice", role: "Engineer" },
      to: { agentId: "bob", role: "Reviewer" },
      type: "task_request",
      priority: "normal",
      payload: { taskId: "t1" },
    };
    const parsed = parseA2AMessage(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe("task_request");
  });

  it("returns null for null input", () => {
    expect(parseA2AMessage(null)).toBeNull();
  });

  it("returns null for non-object", () => {
    expect(parseA2AMessage("string")).toBeNull();
    expect(parseA2AMessage(42)).toBeNull();
  });

  it("returns null for wrong protocol", () => {
    expect(parseA2AMessage({ protocol: "wrong", type: "task_request", payload: {} })).toBeNull();
  });

  it("returns null for missing type", () => {
    expect(parseA2AMessage({ protocol: A2A_PROTOCOL_VERSION, payload: {} })).toBeNull();
  });

  it("returns null for missing payload", () => {
    expect(parseA2AMessage({ protocol: A2A_PROTOCOL_VERSION, type: "task_request" })).toBeNull();
  });
});

describe("isA2AMessage", () => {
  it("returns true for valid A2A messages", () => {
    const msg = {
      protocol: A2A_PROTOCOL_VERSION,
      type: "task_request",
      payload: {},
    };
    expect(isA2AMessage(msg)).toBe(true);
  });

  it("returns false for non-A2A objects", () => {
    expect(isA2AMessage({})).toBe(false);
    expect(isA2AMessage(null)).toBe(false);
  });
});

describe("getMessageType", () => {
  it("returns the type field", async () => {
    const msg = await sendTaskRequest({
      to: bobRef,
      payload: {
        taskId: "t1",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    expect(getMessageType(msg)).toBe("task_request");
  });
});

describe("deriveCorrelationId", () => {
  it("returns existing correlationId if present", async () => {
    const msg = await sendTaskRequest({
      to: bobRef,
      correlationId: "existing-corr",
      payload: {
        taskId: "t1",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    expect(deriveCorrelationId(msg)).toBe("existing-corr");
  });

  it("falls back to messageId when no correlationId", async () => {
    const msg = await sendTaskRequest({
      to: bobRef,
      payload: {
        taskId: "t1",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    expect(deriveCorrelationId(msg)).toBe(msg.messageId);
  });
});

// ─── No-send behavior ────────────────────────────────────────────────────────

describe("without send function", () => {
  it("still returns the built message when no send function registered", async () => {
    resetA2ASDK();
    initA2ASDK({ agentId: "alice", role: "Engineer" });
    setSendFunction(null as unknown as typeof mockSend); // Clear send function

    // Re-init without send function by resetting
    resetA2ASDK();
    initA2ASDK({ agentId: "alice", role: "Engineer" });
    // Don't call setSendFunction

    const msg = await sendTaskRequest({
      to: bobRef,
      payload: {
        taskId: "t1",
        title: "T",
        description: "D",
        taskType: "implementation",
        complexity: "low",
      },
    });
    expect(msg.type).toBe("task_request");
  });
});
