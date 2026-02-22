import { afterEach, describe, expect, it } from "vitest";
import {
  getMeter,
  getMetrics,
  recordSessionStart,
  recordSessionEnd,
  recordTokenUsage,
  recordSessionCost,
  recordToolCall,
  recordModelError,
  resetMetricsCache,
} from "./metrics.js";

describe("telemetry/metrics (no-op mode)", () => {
  afterEach(() => {
    resetMetricsCache();
  });

  it("getMeter returns a meter without throwing", () => {
    expect(getMeter()).toBeDefined();
  });

  it("getMeter accepts a custom name", () => {
    expect(getMeter("custom-meter")).toBeDefined();
  });

  it("getMetrics returns all 6 instruments", () => {
    const m = getMetrics();
    expect(m.sessionDuration).toBeDefined();
    expect(m.sessionTokens).toBeDefined();
    expect(m.sessionCost).toBeDefined();
    expect(m.toolCalls).toBeDefined();
    expect(m.modelErrors).toBeDefined();
    expect(m.activeSessions).toBeDefined();
  });

  it("getMetrics returns cached instance", () => {
    expect(getMetrics()).toBe(getMetrics());
  });

  it("returns fresh instance after resetMetricsCache", () => {
    const m1 = getMetrics();
    resetMetricsCache();
    expect(getMetrics()).not.toBe(m1);
  });

  it("instruments accept records without throwing", () => {
    const m = getMetrics();
    m.toolCalls.add(1, { tool: "browser", status: "success", agent: "main" });
    m.activeSessions.add(1, { agent: "test" });
    m.activeSessions.add(-1, { agent: "test" });
    m.sessionTokens.add(500, {
      agent: "main",
      model: "claude",
      provider: "anthropic",
      type: "output",
    });
    m.modelErrors.add(1, { model: "gpt-4", error_type: "rate_limit", agent: "main" });
    m.sessionDuration.record(30.0, { agent: "main", model: "claude", kind: "chat" });
    m.sessionCost.record(0.1, { agent: "main", model: "claude", provider: "anthropic" });
  });

  it("recordSessionStart does not throw", () => {
    expect(() => recordSessionStart({ agent: "main" })).not.toThrow();
  });

  it("recordSessionEnd does not throw", () => {
    expect(() =>
      recordSessionEnd({
        agent: "main",
        model: "claude-sonnet-4-20250514",
        kind: "chat",
        durationSec: 12.5,
      }),
    ).not.toThrow();
  });

  it("recordTokenUsage does not throw", () => {
    expect(() =>
      recordTokenUsage({
        agent: "main",
        model: "claude-sonnet-4-20250514",
        provider: "anthropic",
        input: 1000,
        output: 500,
      }),
    ).not.toThrow();
  });

  it("recordSessionCost does not throw", () => {
    expect(() =>
      recordSessionCost({
        agent: "main",
        model: "claude-sonnet-4-20250514",
        provider: "anthropic",
        costUsd: 0.015,
      }),
    ).not.toThrow();
  });

  it("recordToolCall does not throw", () => {
    expect(() =>
      recordToolCall({ tool: "web_search", status: "success", agent: "main" }),
    ).not.toThrow();
  });

  it("recordModelError does not throw", () => {
    expect(() =>
      recordModelError({ model: "gpt-4o", errorType: "rate_limit", agent: "main" }),
    ).not.toThrow();
  });
});
