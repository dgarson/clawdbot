import { describe, expect, it } from "vitest";
import {
  diagnosticEventToBillableUsage,
  evaluateBillableLimits,
  summarizeBillableUsage,
  type BillableUsageRecord,
} from "./billable-usage.js";

describe("billable usage", () => {
  it("summarizes records across units", () => {
    const records: BillableUsageRecord[] = [
      {
        ts: 1,
        source: "runtime.model",
        category: "llm",
        provider: "anthropic",
        operation: "completion",
        requestCount: 2,
        usage: { tokens: 100 },
        cost: { usd: 0.3 },
      },
      {
        ts: 2,
        source: "tts.summarize",
        category: "tts",
        provider: "openai",
        operation: "tts.summary",
        usage: { characters: 450 },
      },
    ];

    expect(summarizeBillableUsage(records)).toEqual({
      count: 2,
      requestCount: 3,
      usd: 0.3,
      tokens: 100,
      characters: 450,
      seconds: 0,
      images: 0,
    });
  });

  it("evaluates weekly and monthly scoped limits", () => {
    const nowMs = Date.parse("2026-03-20T10:00:00Z");
    const records: BillableUsageRecord[] = [
      {
        ts: Date.parse("2026-03-17T00:00:00Z"),
        source: "runtime.model",
        category: "llm",
        provider: "anthropic",
        operation: "completion",
        usage: { tokens: 10_000 },
        cost: { usd: 5 },
      },
      {
        ts: Date.parse("2026-03-03T00:00:00Z"),
        source: "runtime.model",
        category: "llm",
        provider: "anthropic",
        operation: "completion",
        usage: { tokens: 20_000 },
        cost: { usd: 8 },
      },
    ];

    const statuses = evaluateBillableLimits({
      records,
      nowMs,
      limits: [
        { id: "week-llm", window: "week", unit: "tokens", max: 12_000, scope: { category: "llm" } },
        { id: "month-usd", window: "month", unit: "usd", max: 10 },
      ],
    });

    expect(statuses[0]?.used).toBe(10_000);
    expect(statuses[0]?.exceeded).toBe(false);
    expect(statuses[1]?.used).toBe(13);
    expect(statuses[1]?.exceeded).toBe(true);
  });

  it("projects existing diagnostic events into billable records", () => {
    const modelRecord = diagnosticEventToBillableUsage({
      type: "model.usage",
      ts: 1,
      seq: 1,
      provider: "anthropic",
      model: "claude-opus",
      usage: { total: 123, input: 100, output: 23 },
      costUsd: 0.51,
    });
    const apiRecord = diagnosticEventToBillableUsage({
      type: "api.usage",
      ts: 2,
      seq: 2,
      source: "tts.summarize",
      apiKind: "tts.summary",
      provider: "openai",
      model: "gpt-4o-mini",
      requestCount: 1,
      inputChars: 500,
      success: true,
      usage: { total: 44, input: 40, output: 4 },
    });

    expect(modelRecord?.usage?.tokens).toBe(123);
    expect(modelRecord?.cost?.usd).toBe(0.51);
    expect(apiRecord?.category).toBe("tts");
    expect(apiRecord?.usage?.characters).toBe(500);
  });
});
