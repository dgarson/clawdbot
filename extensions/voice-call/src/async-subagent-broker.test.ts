import { describe, expect, it } from "vitest";
import {
  InMemorySubagentJobStore,
  toSafeSpokenSummary,
  type SubagentJob,
} from "./async-subagent-broker.js";

function makeJob(overrides: Partial<SubagentJob> = {}): SubagentJob {
  const now = Date.now();
  return {
    jobId: "job-1",
    callId: "call-1",
    from: "+15550001111",
    userMessage: "check status",
    transcript: [],
    delegation: { specialist: "research", goal: "check status" },
    state: "queued",
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 10_000,
    attempts: 0,
    ...overrides,
  };
}

describe("InMemorySubagentJobStore", () => {
  it("claims jobs with per-call concurrency constraints", () => {
    const store = new InMemorySubagentJobStore();
    store.enqueue(makeJob({ jobId: "a", callId: "call-1" }));
    store.enqueue(makeJob({ jobId: "b", callId: "call-1" }));

    const first = store.claimNext({
      now: Date.now(),
      runningByCall: new Map(),
      maxPerCall: 1,
    });
    expect(first?.jobId).toBe("a");

    const blocked = store.claimNext({
      now: Date.now(),
      runningByCall: new Map([["call-1", 1]]),
      maxPerCall: 1,
    });
    expect(blocked).toBeNull();
  });

  it("marks expired jobs and can cancel queued jobs by call", () => {
    const store = new InMemorySubagentJobStore();
    store.enqueue(makeJob({ jobId: "exp", expiresAt: Date.now() - 1 }));

    const claimed = store.claimNext({
      now: Date.now(),
      runningByCall: new Map(),
      maxPerCall: 2,
    });
    expect(claimed).toBeNull();

    store.enqueue(makeJob({ jobId: "queued", callId: "call-2" }));
    store.cancelByCall("call-2");
    expect(store.listByCall("call-2")).toEqual([]);
  });
});

describe("toSafeSpokenSummary", () => {
  it("removes control chars and truncates long output", () => {
    const input = `Hello\u0000 world ${"x".repeat(400)}`;
    const result = toSafeSpokenSummary(input);
    expect(result.includes("\u0000")).toBe(false);
    expect(result.length).toBeLessThanOrEqual(320);
  });
});
