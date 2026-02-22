import { describe, expect, it } from "vitest";
import {
  createTaskReassignmentEvent,
  isTaskReassignmentEvent,
  toStructuredErrorSnapshot,
} from "./task-reassignment.js";

describe("task-reassignment", () => {
  it("creates a structured task reassignment event", () => {
    const now = new Date("2026-02-22T07:30:00.000Z");
    const event = createTaskReassignmentEvent({
      eventId: "evt-1",
      now,
      taskId: "task-123",
      sessionKey: "agent:main:abc",
      agentId: "amadeus",
      reason: "agent_stalled",
      severity: "critical",
      retryable: true,
      attempt: 2,
      maxAttempts: 3,
      model: { provider: "openrouter", model: "minimax" },
      metadata: {
        queueDepth: 17,
        stalledMs: 45_000,
      },
    });

    expect(event).toMatchObject({
      type: "agent.task-reassignment.requested",
      eventId: "evt-1",
      createdAt: "2026-02-22T07:30:00.000Z",
      taskId: "task-123",
      sessionKey: "agent:main:abc",
      agentId: "amadeus",
      reason: "agent_stalled",
      severity: "critical",
      retryable: true,
      attempt: 2,
      maxAttempts: 3,
      model: { provider: "openrouter", model: "minimax" },
      metadata: { queueDepth: 17, stalledMs: 45_000 },
    });
  });

  it("captures structured error metadata", () => {
    const error = new Error("provider timeout");
    Object.assign(error, { code: "ETIMEDOUT", status: 504 });

    const event = createTaskReassignmentEvent({
      taskId: "task-123",
      sessionKey: "agent:main:abc",
      reason: "timeout",
      error,
    });

    expect(event.lastError).toMatchObject({
      name: "Error",
      message: "provider timeout",
      code: "ETIMEDOUT",
      status: 504,
    });
  });

  it("normalizes non-Error values to structured snapshots", () => {
    expect(toStructuredErrorSnapshot("plain failure")).toEqual({ message: "plain failure" });
    expect(toStructuredErrorSnapshot({ message: "failed", code: "EFAIL" })).toEqual({
      name: undefined,
      message: "failed",
      code: "EFAIL",
      status: undefined,
      stack: undefined,
    });
  });

  it("identifies task reassignment events", () => {
    const event = createTaskReassignmentEvent({
      taskId: "task-123",
      sessionKey: "agent:main:abc",
      reason: "agent_error",
    });

    expect(isTaskReassignmentEvent(event)).toBe(true);
    expect(isTaskReassignmentEvent({ type: "other" })).toBe(false);
    expect(isTaskReassignmentEvent(null)).toBe(false);
  });
});
