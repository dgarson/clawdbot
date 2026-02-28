import { afterEach, describe, expect, it } from "vitest";
import type { HealthSignal } from "../types.js";
import { deriveHealthState, resetHealthState } from "./health-evaluator.js";

afterEach(() => {
  resetHealthState();
});

describe("deriveHealthState", () => {
  it("returns healthy when there are no signals", () => {
    expect(deriveHealthState([])).toBe("healthy");
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
