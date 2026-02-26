import { describe, expect, it } from "vitest";
import {
  ToolCircuitBreaker,
  ToolCircuitState,
  type ToolCircuitBreakerConfig,
} from "./circuit-breaker.js";

function config(overrides?: Partial<ToolCircuitBreakerConfig>): ToolCircuitBreakerConfig {
  return {
    name: "test",
    windowMs: 60_000,
    minimumCalls: 3,
    failureRateThreshold: 0.5,
    consecutiveFailureThreshold: 3,
    openDurationMs: 1_000,
    halfOpenProbeCount: 2,
    halfOpenSuccessThreshold: 1,
    ...overrides,
  };
}

describe("ToolCircuitBreaker", () => {
  it("opens when consecutive failures threshold is reached", () => {
    const breaker = new ToolCircuitBreaker(config({ consecutiveFailureThreshold: 2 }));

    expect(breaker.allowCall(0)).toBe(true);
    breaker.recordOutcome(false, 10, 10);

    expect(breaker.currentState).toBe(ToolCircuitState.Closed);
    expect(breaker.allowCall(20)).toBe(true);

    breaker.recordOutcome(false, 10, 30);

    expect(breaker.currentState).toBe(ToolCircuitState.Open);
    expect(breaker.allowCall(40)).toBe(false);
  });

  it("opens when failure rate threshold is met", () => {
    const breaker = new ToolCircuitBreaker(
      config({
        minimumCalls: 4,
        failureRateThreshold: 0.5,
        consecutiveFailureThreshold: 99,
      }),
    );

    breaker.recordOutcome(true, 10, 10);
    breaker.recordOutcome(false, 10, 20);
    breaker.recordOutcome(true, 10, 30);
    breaker.recordOutcome(false, 10, 40);

    expect(breaker.currentState).toBe(ToolCircuitState.Open);
    expect(breaker.allowCall(50)).toBe(false);
  });

  it("transitions to half-open after cooldown and closes after successful probes", () => {
    const breaker = new ToolCircuitBreaker(config({ openDurationMs: 100 }));

    breaker.recordOutcome(false, 10, 10);
    breaker.recordOutcome(false, 10, 20);
    breaker.recordOutcome(false, 10, 30);

    expect(breaker.currentState).toBe(ToolCircuitState.Open);
    expect(breaker.allowCall(50)).toBe(false);

    expect(breaker.allowCall(131)).toBe(true);
    expect(breaker.currentState).toBe(ToolCircuitState.HalfOpen);

    breaker.recordOutcome(true, 10, 140);
    expect(breaker.currentState).toBe(ToolCircuitState.HalfOpen);

    breaker.recordOutcome(true, 10, 150);
    expect(breaker.currentState).toBe(ToolCircuitState.Closed);
  });

  it("reopens when half-open probes do not meet success threshold", () => {
    const breaker = new ToolCircuitBreaker(config({ openDurationMs: 100 }));

    breaker.recordOutcome(false, 10, 10);
    breaker.recordOutcome(false, 10, 20);
    breaker.recordOutcome(false, 10, 30);

    expect(breaker.allowCall(131)).toBe(true);
    expect(breaker.currentState).toBe(ToolCircuitState.HalfOpen);

    breaker.recordOutcome(true, 10, 140);
    breaker.recordOutcome(false, 10, 150);

    expect(breaker.currentState).toBe(ToolCircuitState.Open);
  });
});
