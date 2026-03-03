import { describe, expect, it, vi } from "vitest";
import { createBillableUsageCollector } from "./billable-usage-collector.js";

describe("billable usage collector", () => {
  it("collects diagnostic events, summarizes, and evaluates limits", () => {
    const onRecord = vi.fn();
    const onLimitStatus = vi.fn();

    const collector = createBillableUsageCollector({
      onRecord,
      onLimitStatus,
      nowMs: () => Date.parse("2026-03-20T10:00:00Z"),
      limits: [{ id: "week-llm", window: "week", unit: "tokens", max: 100 }],
    });

    const record = collector.ingestDiagnosticEvent({
      type: "model.usage",
      ts: Date.parse("2026-03-19T10:00:00Z"),
      seq: 1,
      provider: "anthropic",
      model: "claude-opus",
      usage: { total: 120, input: 80, output: 40 },
      costUsd: 0.8,
    });

    expect(record).not.toBeNull();
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onLimitStatus).toHaveBeenCalledTimes(1);
    expect(collector.summarize().tokens).toBe(120);
    expect(collector.evaluateLimits()[0]?.exceeded).toBe(true);
  });

  it("ignores non-billable diagnostic events", () => {
    const collector = createBillableUsageCollector();
    const res = collector.ingestDiagnosticEvent({
      type: "webhook.received",
      ts: 1,
      seq: 1,
      channel: "telegram",
    });
    expect(res).toBeNull();
    expect(collector.getRecords()).toHaveLength(0);
  });
});
