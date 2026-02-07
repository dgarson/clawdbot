import { describe, expect, it, vi } from "vitest";
import {
  waitForAgentDrain,
  shouldAttemptGracefulDrain,
  resolveGracefulTimeoutMs,
  DEFAULT_GRACEFUL_TIMEOUT_MS,
  MAX_GRACEFUL_TIMEOUT_MS,
} from "./agent-drain.js";

describe("waitForAgentDrain", () => {
  it("returns immediately when no agents are running", async () => {
    const agentRunSeq = new Map<string, number>();
    const result = await waitForAgentDrain({
      agentRunSeq,
      timeoutMs: 1000,
    });
    expect(result.drained).toBe(true);
    expect(result.runningAgents).toBe(0);
    expect(result.waitedMs).toBe(0);
  });

  it("waits for agents to complete", async () => {
    const agentRunSeq = new Map<string, number>();
    agentRunSeq.set("run-1", 5);

    // Simulate agent completing after 100ms
    setTimeout(() => {
      agentRunSeq.delete("run-1");
    }, 100);

    const result = await waitForAgentDrain({
      agentRunSeq,
      timeoutMs: 2000,
      pollIntervalMs: 50,
    });

    expect(result.drained).toBe(true);
    expect(result.runningAgents).toBe(0);
    expect(result.waitedMs).toBeGreaterThanOrEqual(100);
    expect(result.waitedMs).toBeLessThan(500);
  });

  it("times out when agents do not complete", async () => {
    const agentRunSeq = new Map<string, number>();
    agentRunSeq.set("run-1", 5);
    agentRunSeq.set("run-2", 3);

    const result = await waitForAgentDrain({
      agentRunSeq,
      timeoutMs: 200,
      pollIntervalMs: 50,
    });

    expect(result.drained).toBe(false);
    expect(result.runningAgents).toBe(2);
    expect(result.waitedMs).toBeGreaterThanOrEqual(200);
  });

  it("calls onPoll callback during waiting", async () => {
    const agentRunSeq = new Map<string, number>();
    agentRunSeq.set("run-1", 5);

    const onPoll = vi.fn();

    // Complete after 150ms
    setTimeout(() => {
      agentRunSeq.delete("run-1");
    }, 150);

    await waitForAgentDrain({
      agentRunSeq,
      timeoutMs: 1000,
      pollIntervalMs: 50,
      onPoll,
    });

    expect(onPoll).toHaveBeenCalled();
    expect(onPoll.mock.calls[0][0]).toBe(1); // runningCount
    expect(onPoll.mock.calls[0][1]).toBeGreaterThanOrEqual(0); // elapsedMs
  });
});

describe("shouldAttemptGracefulDrain", () => {
  it("returns false when explicitly disabled", () => {
    expect(
      shouldAttemptGracefulDrain({
        requestGraceful: false,
        configGraceful: true,
        runningAgentCount: 5,
      }),
    ).toBe(false);
  });

  it("returns false when no agents running", () => {
    expect(
      shouldAttemptGracefulDrain({
        requestGraceful: true,
        runningAgentCount: 0,
      }),
    ).toBe(false);
  });

  it("returns true when explicitly enabled and agents running", () => {
    expect(
      shouldAttemptGracefulDrain({
        requestGraceful: true,
        runningAgentCount: 3,
      }),
    ).toBe(true);
  });

  it("returns true when config enabled and agents running", () => {
    expect(
      shouldAttemptGracefulDrain({
        configGraceful: true,
        runningAgentCount: 2,
      }),
    ).toBe(true);
  });

  it("returns false when neither enabled", () => {
    expect(
      shouldAttemptGracefulDrain({
        runningAgentCount: 5,
      }),
    ).toBe(false);
  });
});

describe("resolveGracefulTimeoutMs", () => {
  it("uses request timeout when provided", () => {
    expect(resolveGracefulTimeoutMs({ requestTimeoutMs: 10000 })).toBe(10000);
  });

  it("uses config timeout when request not provided", () => {
    expect(resolveGracefulTimeoutMs({ configTimeoutMs: 15000 })).toBe(15000);
  });

  it("uses default when neither provided", () => {
    expect(resolveGracefulTimeoutMs({})).toBe(DEFAULT_GRACEFUL_TIMEOUT_MS);
  });

  it("prefers request over config", () => {
    expect(
      resolveGracefulTimeoutMs({
        requestTimeoutMs: 5000,
        configTimeoutMs: 20000,
      }),
    ).toBe(5000);
  });

  it("clamps to maximum", () => {
    expect(resolveGracefulTimeoutMs({ requestTimeoutMs: 10 * 60 * 1000 })).toBe(
      MAX_GRACEFUL_TIMEOUT_MS,
    );
  });

  it("clamps negative values to zero", () => {
    expect(resolveGracefulTimeoutMs({ requestTimeoutMs: -1000 })).toBe(0);
  });
});
