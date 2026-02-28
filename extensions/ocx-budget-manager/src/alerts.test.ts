import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkAlerts, clearExpiredAlerts, getActiveAlerts, resetAlerts } from "./alerts.js";
import type { BudgetAllocation, BudgetUsage } from "./types.js";

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function makeAllocation(overrides: Partial<BudgetAllocation> = {}): BudgetAllocation {
  return {
    scope: { level: "agent", id: "agent-1", parentId: "default" },
    window: { kind: "daily" },
    limits: { maxCostUsd: 10 },
    breachAction: "warn",
    alertAt: [0.5, 0.8, 0.95],
    ...overrides,
  };
}

function makeUsage(utilizationPct: Record<string, number>): BudgetUsage {
  return {
    scope: { level: "agent", id: "agent-1", parentId: "default" },
    windowStart: "2026-02-24T00:00:00.000Z",
    windowEnd: "2026-02-25T00:00:00.000Z",
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    runCount: 0,
    utilizationPct,
  };
}

describe("alerts", () => {
  beforeEach(() => {
    resetAlerts();
    vi.clearAllMocks();
  });

  describe("checkAlerts", () => {
    it("detects 50% threshold", () => {
      const alloc = makeAllocation();
      const usage = makeUsage({ costUsd: 0.55 });

      const alerts = checkAlerts(alloc, usage, logger);

      expect(alerts.length).toBe(1);
      expect(alerts[0].threshold).toBe(0.5);
      expect(alerts[0].dimension).toBe("costUsd");
      expect(alerts[0].currentPct).toBe(0.55);
    });

    it("detects 80% threshold", () => {
      const alloc = makeAllocation();
      const usage = makeUsage({ costUsd: 0.85 });

      const alerts = checkAlerts(alloc, usage, logger);

      // Should trigger both 50% and 80% thresholds
      expect(alerts.length).toBe(2);
      const thresholds = alerts.map((a) => a.threshold).sort();
      expect(thresholds).toEqual([0.5, 0.8]);
    });

    it("detects 95% threshold", () => {
      const alloc = makeAllocation();
      const usage = makeUsage({ costUsd: 0.96 });

      const alerts = checkAlerts(alloc, usage, logger);

      // Should trigger 50%, 80%, and 95%
      expect(alerts.length).toBe(3);
      const thresholds = alerts.map((a) => a.threshold).sort();
      expect(thresholds).toEqual([0.5, 0.8, 0.95]);
    });

    it("deduplicates - same threshold not re-alerted", () => {
      const alloc = makeAllocation();

      // First call at 55% triggers 50% threshold
      const alerts1 = checkAlerts(alloc, makeUsage({ costUsd: 0.55 }), logger);
      expect(alerts1.length).toBe(1);

      // Second call at 60% should not re-trigger 50%
      const alerts2 = checkAlerts(alloc, makeUsage({ costUsd: 0.6 }), logger);
      expect(alerts2.length).toBe(0);

      // Third call at 85% should only trigger the 80% threshold (50% already fired)
      const alerts3 = checkAlerts(alloc, makeUsage({ costUsd: 0.85 }), logger);
      expect(alerts3.length).toBe(1);
      expect(alerts3[0].threshold).toBe(0.8);
    });
  });

  describe("getActiveAlerts", () => {
    it("returns stored alerts after checkAlerts triggers them", () => {
      const alloc = makeAllocation();

      // Initially empty
      expect(getActiveAlerts()).toEqual([]);

      // Trigger some alerts
      checkAlerts(alloc, makeUsage({ costUsd: 0.85 }), logger);

      const active = getActiveAlerts();
      expect(active.length).toBe(2); // 50% and 80%
      expect(active.some((a) => a.threshold === 0.5)).toBe(true);
      expect(active.some((a) => a.threshold === 0.8)).toBe(true);
    });

    it("returns alerts across multiple scopes", () => {
      const agentAlloc = makeAllocation();
      const orgAlloc = makeAllocation({
        scope: { level: "organization", id: "org-1", parentId: "system" },
      });

      checkAlerts(agentAlloc, makeUsage({ costUsd: 0.55 }), logger);
      checkAlerts(
        orgAlloc,
        {
          ...makeUsage({ costUsd: 0.85 }),
          scope: orgAlloc.scope,
        },
        logger,
      );

      const active = getActiveAlerts();
      // agent: 50%, org: 50%+80%
      expect(active.length).toBe(3);
    });
  });

  describe("clearExpiredAlerts", () => {
    it("removes alerts older than the window start", () => {
      const alloc = makeAllocation();

      // Trigger alerts (timestamps will be "now")
      checkAlerts(alloc, makeUsage({ costUsd: 0.85 }), logger);
      expect(getActiveAlerts().length).toBe(2);

      // Clear with a window start in the future — all current alerts are "expired"
      const futureWindow = new Date(Date.now() + 60_000).toISOString();
      clearExpiredAlerts(futureWindow);

      expect(getActiveAlerts()).toEqual([]);
    });

    it("keeps alerts within the current window", () => {
      const alloc = makeAllocation();

      checkAlerts(alloc, makeUsage({ costUsd: 0.85 }), logger);
      expect(getActiveAlerts().length).toBe(2);

      // Clear with a window start in the past — all current alerts are kept
      const pastWindow = new Date(Date.now() - 60_000).toISOString();
      clearExpiredAlerts(pastWindow);

      expect(getActiveAlerts().length).toBe(2);
    });

    it("re-enables alerts after clearing expired ones", () => {
      const alloc = makeAllocation();

      // Trigger 50% alert
      checkAlerts(alloc, makeUsage({ costUsd: 0.55 }), logger);
      expect(getActiveAlerts().length).toBe(1);

      // Clear all (future window)
      clearExpiredAlerts(new Date(Date.now() + 60_000).toISOString());

      // Now the 50% threshold should fire again
      const alerts = checkAlerts(alloc, makeUsage({ costUsd: 0.55 }), logger);
      expect(alerts.length).toBe(1);
      expect(alerts[0].threshold).toBe(0.5);
    });
  });
});
