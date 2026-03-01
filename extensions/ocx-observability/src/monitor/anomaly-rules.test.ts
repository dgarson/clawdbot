import { describe, expect, it } from "vitest";
import { DEFAULT_HEALTH_CRITERIA } from "../config.js";
import type { AgentStats, AnomalyEvalContext } from "../types.js";
import { evaluateAnomalyRules } from "./anomaly-rules.js";

function createDefaultStats(overrides: Partial<AgentStats> = {}): AgentStats {
  return {
    lastEventAt: Date.now(),
    lastHeartbeatAt: Date.now(),
    totalTokensWindow: 0,
    movingAvgTokens: 0,
    errorsInWindow: 0,
    totalRunsInWindow: 0,
    budgetUtilization: 0,
    consecutiveToolFailures: 0,
    toolCallsWindow: new Map(),
    costWindow: 0,
    previousCostWindow: 0,
    activeSessions: 0,
    maxSessions: 100,
    modelsUsed: new Set(),
    configuredModels: new Set(),
    ...overrides,
  };
}

function createContext(statsOverrides: Partial<AgentStats> = {}): AnomalyEvalContext {
  return {
    agentId: "test-agent",
    criteria: DEFAULT_HEALTH_CRITERIA,
    stats: createDefaultStats(statsOverrides),
  };
}

describe("evaluateAnomalyRules", () => {
  describe("token_spike", () => {
    it("detects token spike when usage exceeds multiplier * average", () => {
      const ctx = createContext({
        movingAvgTokens: 1000,
        totalTokensWindow: 5000, // 5x > 3x multiplier
      });
      const signals = evaluateAnomalyRules(ctx);
      const spike = signals.find((s) => s.kind === "token_spike");
      expect(spike).toBeDefined();
      expect(spike!.severity).toBe("critical");
      expect(spike!.value).toBe(5000);
    });

    it("does not fire when usage is within threshold", () => {
      const ctx = createContext({
        movingAvgTokens: 1000,
        totalTokensWindow: 2000, // 2x < 3x multiplier
      });
      const signals = evaluateAnomalyRules(ctx);
      expect(signals.find((s) => s.kind === "token_spike")).toBeUndefined();
    });

    it("does not fire when moving average is zero", () => {
      const ctx = createContext({
        movingAvgTokens: 0,
        totalTokensWindow: 5000,
      });
      const signals = evaluateAnomalyRules(ctx);
      expect(signals.find((s) => s.kind === "token_spike")).toBeUndefined();
    });
  });

  describe("tool_loop", () => {
    it("detects tool loop when same tool called above threshold", () => {
      const toolCalls = new Map<string, number>();
      toolCalls.set("bash", 15); // > 10 threshold
      const ctx = createContext({ toolCallsWindow: toolCalls });
      const signals = evaluateAnomalyRules(ctx);
      const loop = signals.find((s) => s.kind === "tool_loop");
      expect(loop).toBeDefined();
      expect(loop!.severity).toBe("critical");
      expect(loop!.value).toBe(15);
    });

    it("does not fire when tool calls are within threshold", () => {
      const toolCalls = new Map<string, number>();
      toolCalls.set("bash", 5); // < 10 threshold
      const ctx = createContext({ toolCallsWindow: toolCalls });
      const signals = evaluateAnomalyRules(ctx);
      expect(signals.find((s) => s.kind === "tool_loop")).toBeUndefined();
    });
  });

  describe("error_burst", () => {
    it("detects error burst when error rate exceeds threshold", () => {
      const ctx = createContext({
        errorsInWindow: 5,
        totalRunsInWindow: 10, // 50% > 20% threshold
      });
      const signals = evaluateAnomalyRules(ctx);
      const burst = signals.find((s) => s.kind === "error_burst");
      expect(burst).toBeDefined();
      expect(burst!.value).toBeCloseTo(0.5);
    });

    it("escalates to critical when error rate > 2x threshold", () => {
      const ctx = createContext({
        errorsInWindow: 8,
        totalRunsInWindow: 10, // 80% > 2 * 20%
      });
      const signals = evaluateAnomalyRules(ctx);
      const burst = signals.find((s) => s.kind === "error_burst");
      expect(burst).toBeDefined();
      expect(burst!.severity).toBe("critical");
    });

    it("does not fire when error rate is within threshold", () => {
      const ctx = createContext({
        errorsInWindow: 1,
        totalRunsInWindow: 10, // 10% < 20%
      });
      const signals = evaluateAnomalyRules(ctx);
      expect(signals.find((s) => s.kind === "error_burst")).toBeUndefined();
    });

    it("does not fire when there are no runs", () => {
      const ctx = createContext({
        errorsInWindow: 0,
        totalRunsInWindow: 0,
      });
      const signals = evaluateAnomalyRules(ctx);
      expect(signals.find((s) => s.kind === "error_burst")).toBeUndefined();
    });
  });

  describe("no anomalies", () => {
    it("returns empty array when all values are within thresholds", () => {
      const ctx = createContext({
        movingAvgTokens: 1000,
        totalTokensWindow: 1500, // 1.5x < 3x
        errorsInWindow: 1,
        totalRunsInWindow: 10, // 10% < 20%
        activeSessions: 5,
        maxSessions: 100,
      });
      const signals = evaluateAnomalyRules(ctx);
      expect(signals).toHaveLength(0);
    });
  });
});
