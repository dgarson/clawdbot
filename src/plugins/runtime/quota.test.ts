import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const discoverAllSessionsMock = vi.hoisted(() => vi.fn());
const loadSessionCostSummaryMock = vi.hoisted(() => vi.fn());

vi.mock("../../infra/session-cost-usage.js", () => ({
  discoverAllSessions: (...args: unknown[]) => discoverAllSessionsMock(...args),
  loadSessionCostSummary: (...args: unknown[]) => loadSessionCostSummaryMock(...args),
}));

import type { DiscoveredSession, SessionCostSummary } from "../../infra/session-cost-usage.js";
import { createRuntimeQuota } from "./quota.js";

/** Helper: build a minimal DiscoveredSession stub. */
function makeSession(id: string, file?: string): DiscoveredSession {
  return {
    sessionId: id,
    sessionFile: file ?? `/fake/sessions/${id}.jsonl`,
    mtime: Date.now(),
  };
}

/** Helper: build a minimal SessionCostSummary stub with the fields quota.ts reads. */
function makeSummary(overrides: {
  totalTokens?: number;
  input?: number;
  output?: number;
  totalCost?: number;
  userMessages?: number;
}): SessionCostSummary {
  return {
    input: overrides.input ?? 0,
    output: overrides.output ?? 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: overrides.totalTokens ?? 0,
    totalCost: overrides.totalCost ?? 0,
    inputCost: 0,
    outputCost: 0,
    cacheReadCost: 0,
    cacheWriteCost: 0,
    missingCostEntries: 0,
    messageCounts: {
      total: overrides.userMessages ?? 0,
      user: overrides.userMessages ?? 0,
      assistant: 0,
      toolCalls: 0,
      toolResults: 0,
      errors: 0,
    },
  };
}

describe("createRuntimeQuota", () => {
  beforeEach(() => {
    discoverAllSessionsMock.mockReset();
    loadSessionCostSummaryMock.mockReset();
  });

  describe("getUsage", () => {
    it("returns aggregated totals from discovered sessions", async () => {
      discoverAllSessionsMock.mockResolvedValue([
        makeSession("s1", "/a.jsonl"),
        makeSession("s2", "/b.jsonl"),
      ]);
      loadSessionCostSummaryMock
        .mockResolvedValueOnce(
          makeSummary({
            totalTokens: 100,
            input: 40,
            output: 60,
            totalCost: 0.05,
            userMessages: 3,
          }),
        )
        .mockResolvedValueOnce(
          makeSummary({
            totalTokens: 200,
            input: 80,
            output: 120,
            totalCost: 0.1,
            userMessages: 2,
          }),
        );

      const quota = createRuntimeQuota();
      const usage = await quota.getUsage();

      expect(usage.totalTokens).toBe(300);
      expect(usage.inputTokens).toBe(120);
      expect(usage.outputTokens).toBe(180);
      expect(usage.totalCostUsd).toBeCloseTo(0.15);
      expect(usage.turnCount).toBe(5);
    });

    it("returns zeros when no sessions are discovered", async () => {
      discoverAllSessionsMock.mockResolvedValue([]);

      const quota = createRuntimeQuota();
      const usage = await quota.getUsage();

      expect(usage).toEqual({
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCostUsd: 0,
        turnCount: 0,
      });
      expect(loadSessionCostSummaryMock).not.toHaveBeenCalled();
    });

    it("filters by groupIds correctly", async () => {
      // sessionId format: "prefix:agentId:rest" — groupIds match the second colon-separated part.
      discoverAllSessionsMock.mockResolvedValue([
        makeSession("sess:alpha:1"),
        makeSession("sess:beta:2"),
        makeSession("sess:gamma:3"),
      ]);

      loadSessionCostSummaryMock.mockResolvedValue(
        makeSummary({ totalTokens: 10, input: 4, output: 6, totalCost: 0.01, userMessages: 1 }),
      );

      const quota = createRuntimeQuota();
      const usage = await quota.getUsage({ groupIds: ["alpha", "gamma"] });

      // Only alpha and gamma should pass the filter; beta is excluded.
      expect(loadSessionCostSummaryMock).toHaveBeenCalledTimes(2);
      expect(usage.totalTokens).toBe(20);
      expect(usage.turnCount).toBe(2);
    });

    it("skips sessions with null cost summaries", async () => {
      discoverAllSessionsMock.mockResolvedValue([
        makeSession("s1", "/a.jsonl"),
        makeSession("s2", "/b.jsonl"),
        makeSession("s3", "/c.jsonl"),
      ]);
      loadSessionCostSummaryMock
        .mockResolvedValueOnce(
          makeSummary({ totalTokens: 50, input: 20, output: 30, totalCost: 0.02, userMessages: 1 }),
        )
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          makeSummary({ totalTokens: 70, input: 30, output: 40, totalCost: 0.03, userMessages: 2 }),
        );

      const quota = createRuntimeQuota();
      const usage = await quota.getUsage();

      expect(usage).toEqual({
        totalTokens: 120,
        inputTokens: 50,
        outputTokens: 70,
        totalCostUsd: 0.05,
        turnCount: 3,
      });
    });
  });

  describe("checkBudget", () => {
    beforeEach(() => {
      discoverAllSessionsMock.mockResolvedValue([makeSession("s1")]);
      loadSessionCostSummaryMock.mockResolvedValue(
        makeSummary({
          totalTokens: 1000,
          input: 400,
          output: 600,
          totalCost: 0.5,
          userMessages: 5,
        }),
      );
    });

    it("returns exceeded=true when tokens exceed limit", async () => {
      const quota = createRuntimeQuota();
      const result = await quota.checkBudget({}, { maxTokens: 500, maxCostUsd: 10 });

      expect(result.exceeded).toBe(true);
      expect(result.remaining.tokens).toBe(0);
      // Cost is within limit, so costRemaining should be positive.
      expect(result.remaining.costUsd).toBe(9.5);
    });

    it("returns exceeded=true when cost exceeds limit", async () => {
      const quota = createRuntimeQuota();
      const result = await quota.checkBudget({}, { maxTokens: 50_000, maxCostUsd: 0.25 });

      expect(result.exceeded).toBe(true);
      expect(result.remaining.costUsd).toBe(0);
      // Tokens are within limit.
      expect(result.remaining.tokens).toBe(49_000);
    });

    it("returns exceeded=false when within limits", async () => {
      const quota = createRuntimeQuota();
      const result = await quota.checkBudget({}, { maxTokens: 5000, maxCostUsd: 5 });

      expect(result.exceeded).toBe(false);
      expect(result.remaining.tokens).toBe(4000);
      expect(result.remaining.costUsd).toBe(4.5);
      expect(result.usage.totalTokens).toBe(1000);
    });

    it("with only maxTokens (no maxCostUsd) — costRemaining should be undefined", async () => {
      const quota = createRuntimeQuota();
      const result = await quota.checkBudget({}, { maxTokens: 5000 });

      expect(result.exceeded).toBe(false);
      expect(result.remaining.tokens).toBe(4000);
      expect(result.remaining.costUsd).toBeUndefined();
    });
  });

  describe("TTL cache", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("second call within 30s should NOT re-scan sessions", async () => {
      discoverAllSessionsMock.mockResolvedValue([makeSession("s1")]);
      loadSessionCostSummaryMock.mockResolvedValue(
        makeSummary({ totalTokens: 10, input: 4, output: 6, totalCost: 0.01, userMessages: 1 }),
      );

      const quota = createRuntimeQuota();

      const first = await quota.getUsage();
      const second = await quota.getUsage();

      expect(first).toEqual(second);
      expect(discoverAllSessionsMock).toHaveBeenCalledTimes(1);
      expect(loadSessionCostSummaryMock).toHaveBeenCalledTimes(1);
    });

    it("call after cache expires should re-scan", async () => {
      discoverAllSessionsMock.mockResolvedValue([makeSession("s1")]);
      loadSessionCostSummaryMock.mockResolvedValue(
        makeSummary({ totalTokens: 10, input: 4, output: 6, totalCost: 0.01, userMessages: 1 }),
      );

      const quota = createRuntimeQuota();

      await quota.getUsage();
      expect(discoverAllSessionsMock).toHaveBeenCalledTimes(1);

      // Advance past the 30s TTL.
      vi.advanceTimersByTime(31_000);

      await quota.getUsage();
      expect(discoverAllSessionsMock).toHaveBeenCalledTimes(2);
      expect(loadSessionCostSummaryMock).toHaveBeenCalledTimes(2);
    });

    it("different scopes have independent cache entries", async () => {
      discoverAllSessionsMock.mockResolvedValue([makeSession("s1")]);
      loadSessionCostSummaryMock.mockResolvedValue(
        makeSummary({ totalTokens: 10, input: 4, output: 6, totalCost: 0.01, userMessages: 1 }),
      );

      const quota = createRuntimeQuota();

      // Two different scopes should each trigger their own discovery.
      await quota.getUsage({ agentId: "agent-a" });
      await quota.getUsage({ agentId: "agent-b" });

      expect(discoverAllSessionsMock).toHaveBeenCalledTimes(2);

      // Repeating the same scopes within TTL should NOT trigger additional calls.
      await quota.getUsage({ agentId: "agent-a" });
      await quota.getUsage({ agentId: "agent-b" });

      expect(discoverAllSessionsMock).toHaveBeenCalledTimes(2);
    });
  });
});
