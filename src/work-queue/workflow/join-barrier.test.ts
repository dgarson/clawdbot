import { describe, expect, it, vi } from "vitest";
import type { GatewayCallFn, JoinBarrierEntry, WorkflowLogger } from "./types.js";
import { awaitJoinBarrier } from "./join-barrier.js";

const mockLog: WorkflowLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function makeEntry(overrides: Partial<JoinBarrierEntry> = {}): JoinBarrierEntry {
  return {
    runId: "run-1",
    sessionKey: "agent:main:workflow:discover:abc",
    label: "test question",
    ...overrides,
  };
}

describe("awaitJoinBarrier", () => {
  it("returns ok results when all subagents complete successfully", async () => {
    const callGateway = vi
      .fn()
      // agent.wait call
      .mockResolvedValueOnce({ status: "ok" });

    // Mock readLatestAssistantReply via the module mock
    const { readLatestAssistantReply } = await import("../../agents/tools/agent-step.js");
    vi.mocked(readLatestAssistantReply).mockResolvedValueOnce("Discovery findings here");

    const results = await awaitJoinBarrier({
      entries: [makeEntry()],
      timeoutMs: 10_000,
      callGateway: callGateway as GatewayCallFn,
      log: mockLog,
    });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("ok");
    expect(results[0].reply).toBe("Discovery findings here");
  });

  it("handles timeout status", async () => {
    const callGateway = vi.fn().mockResolvedValueOnce({ status: "timeout" });

    const results = await awaitJoinBarrier({
      entries: [makeEntry()],
      timeoutMs: 10_000,
      callGateway: callGateway as GatewayCallFn,
      log: mockLog,
    });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("timeout");
  });

  it("handles error status", async () => {
    const callGateway = vi.fn().mockResolvedValueOnce({
      status: "error",
      error: "session crashed",
    });

    const results = await awaitJoinBarrier({
      entries: [makeEntry()],
      timeoutMs: 10_000,
      callGateway: callGateway as GatewayCallFn,
      log: mockLog,
    });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("error");
    expect(results[0].error).toBe("session crashed");
  });

  it("handles gateway call failure gracefully", async () => {
    const callGateway = vi.fn().mockRejectedValueOnce(new Error("network error"));

    const results = await awaitJoinBarrier({
      entries: [makeEntry()],
      timeoutMs: 10_000,
      callGateway: callGateway as GatewayCallFn,
      log: mockLog,
    });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("error");
    expect(results[0].error).toContain("network error");
  });

  it("processes multiple entries in parallel", async () => {
    const callGateway = vi
      .fn()
      .mockResolvedValueOnce({ status: "ok" })
      .mockResolvedValueOnce({ status: "ok" })
      .mockResolvedValueOnce({ status: "timeout" });

    const entries = [
      makeEntry({ runId: "run-1", label: "Q1" }),
      makeEntry({ runId: "run-2", label: "Q2" }),
      makeEntry({ runId: "run-3", label: "Q3" }),
    ];

    const results = await awaitJoinBarrier({
      entries,
      timeoutMs: 10_000,
      callGateway: callGateway as GatewayCallFn,
      log: mockLog,
    });

    expect(results).toHaveLength(3);
  });

  it("returns empty array for no entries", async () => {
    const callGateway = vi.fn();

    const results = await awaitJoinBarrier({
      entries: [],
      timeoutMs: 10_000,
      callGateway: callGateway as GatewayCallFn,
      log: mockLog,
    });

    expect(results).toHaveLength(0);
    expect(callGateway).not.toHaveBeenCalled();
  });
});

vi.mock("../../agents/tools/agent-step.js", () => ({
  readLatestAssistantReply: vi.fn().mockResolvedValue(undefined),
}));
