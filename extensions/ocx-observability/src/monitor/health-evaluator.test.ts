import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_HEALTH_CRITERIA } from "../config.js";
import type { HealthSignal } from "../types.js";
import {
  evaluateAgent,
  getAllCurrentHealth,
  getOrCreateStats,
  recordSessionEnd,
  recordSessionStart,
  resetHealthState,
  deriveHealthState,
} from "./health-evaluator.js";

afterEach(() => {
  resetHealthState();
});

describe("deriveHealthState", () => {
  it("returns healthy when there are no signals", () => {
    expect(deriveHealthState([])).toBe("healthy");
  });

  it("does not evaluate lifecycle health transitions for dormant agents", () => {
    const criteria = { ...DEFAULT_HEALTH_CRITERIA, stuckTimeoutMinutes: 1 };
    const agentId = "inactive-agent";
    const stats = getOrCreateStats(agentId);
    stats.activeSessions = 0;
    stats.lastEventAt = Date.now() - 2 * 60_000;

    const evaluation = evaluateAgent(agentId, criteria);
    expect(evaluation.state).toBe("healthy");
  });

  it("does not emit warning signals for dormant agents", () => {
    const criteria = {
      ...DEFAULT_HEALTH_CRITERIA,
      stuckTimeoutMinutes: 1,
      budgetDegradedThreshold: 0.8,
    };
    const agentId = "warning-inactive";
    const stats = getOrCreateStats(agentId);
    stats.activeSessions = 0;
    stats.budgetUtilization = 0.95;
    stats.consecutiveToolFailures = 12;

    const evaluation = evaluateAgent(agentId, criteria);
    expect(evaluation.signals.length).toBe(0);
    expect(evaluation.state).toBe("healthy");
  });

  it("retains stuck state when active sessions are ongoing", () => {
    const criteria = { ...DEFAULT_HEALTH_CRITERIA, stuckTimeoutMinutes: 1 };
    const agentId = "active-agent";
    recordSessionStart(agentId);
    const stats = getOrCreateStats(agentId);
    stats.lastEventAt = Date.now() - 2 * 60_000;

    const evaluation = evaluateAgent(agentId, criteria);
    expect(evaluation.state).toBe("stuck");
  });

  it("supports nested sessions and retires only after final session end", () => {
    const criteria = { ...DEFAULT_HEALTH_CRITERIA, stuckTimeoutMinutes: 1 };
    const agentId = "nested-agent";

    recordSessionStart(agentId);
    recordSessionStart(agentId);

    const stats = getOrCreateStats(agentId);
    stats.lastEventAt = Date.now() - 2 * 60_000;

    const staleTime = Date.now() - 2 * 60_000;
    stats.lastEventAt = staleTime;

    let evaluation = evaluateAgent(agentId, criteria);
    expect(evaluation.state).toBe("stuck");

    recordSessionEnd(agentId);

    stats.lastEventAt = staleTime;
    evaluation = evaluateAgent(agentId, criteria);
    expect(evaluation.state).toBe("stuck");

    recordSessionEnd(agentId);
    expect(getAllCurrentHealth().some((h) => h.agentId === agentId)).toBe(false);
  });

  it("removes current health state when the last active session ends", () => {
    const criteria = { ...DEFAULT_HEALTH_CRITERIA, stuckTimeoutMinutes: 1 };
    const agentId = "retired-agent";
    recordSessionStart(agentId);
    const stats = getOrCreateStats(agentId);
    stats.lastEventAt = Date.now() - 2 * 60_000;

    evaluateAgent(agentId, criteria);
    expect(getAllCurrentHealth().some((h) => h.agentId === agentId)).toBe(true);

    recordSessionEnd(agentId);
    expect(getAllCurrentHealth().some((h) => h.agentId === agentId)).toBe(false);
  });

  it("returns degraded when there are warning signals", () => {
    const signals: HealthSignal[] = [
      {
        kind: "budget_high",
        severity: "warning",
        value: 0.9,
        threshold: 0.8,
        message: "Budget utilization at 90%",
      },
    ];
    expect(deriveHealthState(signals)).toBe("degraded");
  });

  it("returns rogue when token_spike is critical", () => {
    const signals: HealthSignal[] = [
      {
        kind: "token_spike",
        severity: "critical",
        value: 50000,
        threshold: 15000,
        message: "Token usage 50000 exceeds 3x moving average",
      },
    ];
    expect(deriveHealthState(signals)).toBe("rogue");
  });

  it("returns rogue when tool_loop is critical", () => {
    const signals: HealthSignal[] = [
      {
        kind: "tool_loop",
        severity: "critical",
        value: 15,
        threshold: 10,
        message: 'Tool "bash" called 15 times in window',
      },
    ];
    expect(deriveHealthState(signals)).toBe("rogue");
  });

  it("returns stuck when no_events_timeout is critical", () => {
    const signals: HealthSignal[] = [
      {
        kind: "no_events_timeout",
        severity: "critical",
        value: 20,
        threshold: 15,
        message: "No events for 20 minutes",
      },
    ];
    expect(deriveHealthState(signals)).toBe("stuck");
  });

  it("prioritizes rogue over stuck when both are present", () => {
    const signals: HealthSignal[] = [
      {
        kind: "token_spike",
        severity: "critical",
        value: 50000,
        threshold: 15000,
        message: "Token spike",
      },
      {
        kind: "no_events_timeout",
        severity: "critical",
        value: 20,
        threshold: 15,
        message: "No events",
      },
    ];
    expect(deriveHealthState(signals)).toBe("rogue");
  });

  it("prioritizes stuck over degraded when both are present", () => {
    const signals: HealthSignal[] = [
      {
        kind: "no_events_timeout",
        severity: "critical",
        value: 20,
        threshold: 15,
        message: "No events",
      },
      {
        kind: "budget_high",
        severity: "warning",
        value: 0.9,
        threshold: 0.8,
        message: "Budget high",
      },
    ];
    expect(deriveHealthState(signals)).toBe("stuck");
  });

  it("returns healthy when signals have info severity only", () => {
    const signals: HealthSignal[] = [
      {
        kind: "unusual_model",
        severity: "info",
        value: 1,
        threshold: 0,
        message: "Unusual model used",
      },
    ];
    expect(deriveHealthState(signals)).toBe("healthy");
  });
});
