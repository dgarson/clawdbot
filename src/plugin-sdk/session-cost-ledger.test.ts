import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSessionCostLedger,
  SessionCostLedger,
  type CostEntry,
} from "./session-cost-ledger.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cost-ledger-test-"));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("SessionCostLedger", () => {
  let dir: string;
  let ledger: SessionCostLedger;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(async () => {
    await ledger?.close();
    cleanup(dir);
  });

  it("record returns a generated ID", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    const id = ledger.record({
      source: "llm.completion",
      costUsd: 0.01,
      sessionKey: "sess-1",
    });

    expect(id).toMatch(/^cost-/);
  });

  it("record uses caller-provided timestamp", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    const fixedTs = 1700000000000;
    ledger.record({
      timestamp: fixedTs,
      source: "tts.synthesis",
      costUsd: 0.005,
    });

    const summary = ledger.summarize();
    expect(summary.entries[0].timestamp).toBe(fixedTs);
  });

  it("record auto-generates timestamp when omitted", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    const before = Date.now();
    ledger.record({ source: "custom", costUsd: 0.001 });
    const after = Date.now();

    const summary = ledger.summarize();
    expect(summary.entries[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(summary.entries[0].timestamp).toBeLessThanOrEqual(after);
  });

  it("summarize returns total cost", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({ source: "llm.completion", costUsd: 0.1, sessionKey: "s" });
    ledger.record({ source: "tts.synthesis", costUsd: 0.05, sessionKey: "s" });
    ledger.record({ source: "embedding.query", costUsd: 0.02, sessionKey: "s" });

    const summary = ledger.summarize("s");
    expect(summary.totalCostUsd).toBeCloseTo(0.17);
    expect(summary.entryCount).toBe(3);
  });

  it("summarize filters by sessionKey", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({ source: "llm.completion", costUsd: 0.1, sessionKey: "a" });
    ledger.record({ source: "llm.completion", costUsd: 0.2, sessionKey: "b" });

    const summaryA = ledger.summarize("a");
    expect(summaryA.totalCostUsd).toBeCloseTo(0.1);
    expect(summaryA.entryCount).toBe(1);

    const summaryB = ledger.summarize("b");
    expect(summaryB.totalCostUsd).toBeCloseTo(0.2);

    const summaryAll = ledger.summarize();
    expect(summaryAll.totalCostUsd).toBeCloseTo(0.3);
  });

  it("summarize aggregates by source", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({ source: "llm.completion", costUsd: 0.1 });
    ledger.record({ source: "llm.completion", costUsd: 0.05 });
    ledger.record({ source: "tts.synthesis", costUsd: 0.02 });

    const summary = ledger.summarize();
    expect(summary.bySource.get("llm.completion")).toBeCloseTo(0.15);
    expect(summary.bySource.get("tts.synthesis")).toBeCloseTo(0.02);
  });

  it("summarize aggregates by provider", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({ source: "llm.completion", costUsd: 0.1, provider: "anthropic" });
    ledger.record({ source: "llm.completion", costUsd: 0.05, provider: "openai" });
    ledger.record({ source: "tts.synthesis", costUsd: 0.02, provider: "openai" });

    const summary = ledger.summarize();
    expect(summary.byProvider.get("anthropic")).toBeCloseTo(0.1);
    expect(summary.byProvider.get("openai")).toBeCloseTo(0.07);
  });

  it("summarize sorts entries by timestamp (out-of-order tolerance)", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    // Record out of order
    ledger.record({ timestamp: 3000, source: "custom", costUsd: 0.03 });
    ledger.record({ timestamp: 1000, source: "custom", costUsd: 0.01 });
    ledger.record({ timestamp: 2000, source: "custom", costUsd: 0.02 });

    const summary = ledger.summarize();
    expect(summary.entries.map((e) => e.timestamp)).toEqual([1000, 2000, 3000]);
    expect(summary.entries.map((e) => e.costUsd)).toEqual([0.01, 0.02, 0.03]);
  });

  it("drain flushes to JSONL on disk", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({ source: "llm.completion", costUsd: 0.1, provider: "anthropic" });
    ledger.record({ source: "tts.synthesis", costUsd: 0.02, provider: "openai" });
    ledger.drain();

    const filePath = path.join(dir, "cost-ledger.jsonl");
    expect(fs.existsSync(filePath)).toBe(true);

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]) as CostEntry;
    expect(first.source).toBe("llm.completion");
    expect(first.costUsd).toBe(0.1);
    expect(first.id).toMatch(/^cost-/);
  });

  it("loadFromDisk returns sorted entries", async () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    // Write out-of-order entries
    ledger.record({ timestamp: 3000, source: "custom", costUsd: 0.03 });
    ledger.record({ timestamp: 1000, source: "custom", costUsd: 0.01 });
    ledger.record({ timestamp: 2000, source: "custom", costUsd: 0.02 });
    ledger.drain();

    // Load from disk — should be sorted by timestamp
    const entries = ledger.loadFromDisk();
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.timestamp)).toEqual([1000, 2000, 3000]);
  });

  it("loadFromDisk handles corrupted lines gracefully", async () => {
    // Write a ledger with one corrupted line
    const filePath = path.join(dir, "cost-ledger.jsonl");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      filePath,
      '{"id":"a","timestamp":1000,"source":"custom","costUsd":0.01}\nnot-json{{\n{"id":"b","timestamp":2000,"source":"custom","costUsd":0.02}\n',
      "utf-8",
    );

    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });
    const entries = ledger.loadFromDisk();
    expect(entries).toHaveLength(2);
  });

  it("emits diagnostic events when configured", () => {
    const emitted: CostEntry[] = [];
    ledger = createSessionCostLedger({
      stateDir: dir,
      flushIntervalMs: 0,
      emitDiagnostic: true,
      diagnosticEmitter: (entry) => emitted.push(entry),
    });

    ledger.record({ source: "tts.synthesis", costUsd: 0.005, provider: "elevenlabs" });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].source).toBe("tts.synthesis");
  });

  it("does not emit diagnostic events when not configured", () => {
    const emitted: CostEntry[] = [];
    ledger = createSessionCostLedger({
      stateDir: dir,
      flushIntervalMs: 0,
      emitDiagnostic: false,
      diagnosticEmitter: (entry) => emitted.push(entry),
    });

    ledger.record({ source: "tts.synthesis", costUsd: 0.005 });
    expect(emitted).toHaveLength(0);
  });

  it("handles entries with undefined costUsd", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({ source: "custom", costUsd: undefined });
    ledger.record({ source: "custom", costUsd: 0.1 });

    const summary = ledger.summarize();
    expect(summary.totalCostUsd).toBeCloseTo(0.1);
    expect(summary.entryCount).toBe(2);
  });

  it("records usage data alongside cost", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({
      source: "llm.completion",
      costUsd: 0.05,
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      usage: { input: 1000, output: 500, total: 1500 },
    });
    ledger.drain();

    const entries = ledger.loadFromDisk();
    expect(entries[0].usage).toEqual({ input: 1000, output: 500, total: 1500 });
  });

  it("toPluginService stops the ledger on close", async () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 60_000 });

    const service = ledger.toPluginService("cost-tracker");
    expect(service.id).toBe("cost-tracker");

    ledger.record({ source: "custom", costUsd: 0.01 });
    await service.stop();

    // Should have flushed
    const filePath = path.join(dir, "cost-ledger.jsonl");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("records custom meta data", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({
      source: "custom",
      costUsd: 0.001,
      meta: { characters: 1500, voice: "alloy", format: "mp3" },
    });

    const summary = ledger.summarize();
    expect(summary.entries[0].meta).toEqual({
      characters: 1500,
      voice: "alloy",
      format: "mp3",
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases & contract hardening
  // ---------------------------------------------------------------------------

  it("preserves caller-provided ID (does not overwrite)", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    const id = ledger.record({
      id: "my-custom-id-123",
      source: "custom",
      costUsd: 0.01,
    });

    expect(id).toBe("my-custom-id-123");
    const summary = ledger.summarize();
    expect(summary.entries[0].id).toBe("my-custom-id-123");
  });

  it("each auto-generated ID is unique across rapid records", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(ledger.record({ source: "custom", costUsd: 0.001 }));
    }
    expect(ids.size).toBe(100);
  });

  it("summarize with no entries returns zeros and empty collections", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    const summary = ledger.summarize();
    expect(summary.totalCostUsd).toBe(0);
    expect(summary.entryCount).toBe(0);
    expect(summary.bySource.size).toBe(0);
    expect(summary.byProvider.size).toBe(0);
    expect(summary.entries).toEqual([]);
  });

  it("summarize with no filter returns entries from all sessions", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({ source: "llm.completion", costUsd: 0.1, sessionKey: "s1" });
    ledger.record({ source: "tts.synthesis", costUsd: 0.05, sessionKey: "s2" });
    ledger.record({ source: "custom", costUsd: 0.02 }); // no sessionKey

    const summary = ledger.summarize();
    expect(summary.entryCount).toBe(3);
    expect(summary.totalCostUsd).toBeCloseTo(0.17);
  });

  it("loadFromDisk returns empty array for non-existent file", () => {
    ledger = createSessionCostLedger({
      stateDir: path.join(dir, "nonexistent"),
      flushIntervalMs: 0,
    });
    const entries = ledger.loadFromDisk();
    expect(entries).toEqual([]);
  });

  it("loadFromDisk returns empty array for empty file", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });
    // Write an empty file
    fs.writeFileSync(path.join(dir, "cost-ledger.jsonl"), "", "utf-8");

    const entries = ledger.loadFromDisk();
    expect(entries).toEqual([]);
  });

  it("pending() returns buffered entry count", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    expect(ledger.pending()).toBe(0);

    ledger.record({ source: "custom", costUsd: 0.01 });
    expect(ledger.pending()).toBe(1);

    ledger.record({ source: "custom", costUsd: 0.02 });
    expect(ledger.pending()).toBe(2);

    ledger.drain();
    expect(ledger.pending()).toBe(0);
  });

  it("records cacheRead and cacheWrite usage fields", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({
      source: "llm.completion",
      costUsd: 0.05,
      usage: { input: 500, output: 200, cacheRead: 300, cacheWrite: 100, total: 1100 },
    });
    ledger.drain();

    const entries = ledger.loadFromDisk();
    expect(entries[0].usage).toEqual({
      input: 500,
      output: 200,
      cacheRead: 300,
      cacheWrite: 100,
      total: 1100,
    });
  });

  it("CostEntry with all fields populated roundtrips through JSONL", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({
      id: "full-entry-1",
      timestamp: 1700000000000,
      source: "llm.completion",
      costUsd: 0.123,
      sessionKey: "sess-abc",
      runId: "run-xyz",
      agentId: "agent-1",
      toolCallId: "tc-456",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      usage: { input: 1000, output: 500, cacheRead: 200, cacheWrite: 50, total: 1750 },
      durationMs: 3500,
      meta: { custom: "value", nested: { deep: true } },
    });
    ledger.drain();

    const entries = ledger.loadFromDisk();
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.id).toBe("full-entry-1");
    expect(entry.timestamp).toBe(1700000000000);
    expect(entry.source).toBe("llm.completion");
    expect(entry.costUsd).toBe(0.123);
    expect(entry.sessionKey).toBe("sess-abc");
    expect(entry.runId).toBe("run-xyz");
    expect(entry.agentId).toBe("agent-1");
    expect(entry.toolCallId).toBe("tc-456");
    expect(entry.provider).toBe("anthropic");
    expect(entry.model).toBe("claude-sonnet-4-6");
    expect(entry.durationMs).toBe(3500);
    expect(entry.meta).toEqual({ custom: "value", nested: { deep: true } });
  });

  it("entries without provider are excluded from byProvider", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({ source: "custom", costUsd: 0.05 }); // no provider
    ledger.record({ source: "llm.completion", costUsd: 0.1, provider: "openai" });

    const summary = ledger.summarize();
    expect(summary.byProvider.size).toBe(1);
    expect(summary.byProvider.get("openai")).toBeCloseTo(0.1);
  });

  it("all CostSource values aggregate correctly in bySource", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    const sources = [
      "llm.completion",
      "llm.auxiliary",
      "tts.synthesis",
      "embedding.query",
      "embedding.batch",
      "transcription.audio",
      "media.vision",
      "custom",
    ] as const;

    for (const source of sources) {
      ledger.record({ source, costUsd: 0.01 });
    }

    const summary = ledger.summarize();
    expect(summary.bySource.size).toBe(8);
    for (const source of sources) {
      expect(summary.bySource.get(source)).toBeCloseTo(0.01);
    }
    expect(summary.totalCostUsd).toBeCloseTo(0.08);
  });

  it("concurrent record + drain does not lose entries", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    // Record some, drain, record more
    ledger.record({ source: "custom", costUsd: 0.01 });
    ledger.record({ source: "custom", costUsd: 0.02 });
    ledger.drain();

    ledger.record({ source: "custom", costUsd: 0.03 });
    ledger.drain();

    const entries = ledger.loadFromDisk();
    expect(entries).toHaveLength(3);

    // In-memory index should also have all 3
    const summary = ledger.summarize();
    expect(summary.entryCount).toBe(3);
    expect(summary.totalCostUsd).toBeCloseTo(0.06);
  });

  it("durationMs is preserved through record and summarize", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({
      source: "llm.completion",
      costUsd: 0.01,
      durationMs: 2500,
    });

    const summary = ledger.summarize();
    expect(summary.entries[0].durationMs).toBe(2500);
  });

  it("multiple records with same provider accumulate in byProvider", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    ledger.record({ source: "llm.completion", costUsd: 0.1, provider: "openai" });
    ledger.record({ source: "embedding.query", costUsd: 0.02, provider: "openai" });
    ledger.record({ source: "tts.synthesis", costUsd: 0.05, provider: "openai" });

    const summary = ledger.summarize();
    expect(summary.byProvider.get("openai")).toBeCloseTo(0.17);
  });

  it("record with all optional fields undefined works", () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 0 });

    const id = ledger.record({ source: "custom" });
    expect(id).toMatch(/^cost-/);

    const summary = ledger.summarize();
    expect(summary.entryCount).toBe(1);
    expect(summary.totalCostUsd).toBe(0);
    expect(summary.entries[0].costUsd).toBeUndefined();
    expect(summary.entries[0].provider).toBeUndefined();
    expect(summary.entries[0].model).toBeUndefined();
    expect(summary.entries[0].usage).toBeUndefined();
    expect(summary.entries[0].durationMs).toBeUndefined();
    expect(summary.entries[0].meta).toBeUndefined();
    expect(summary.entries[0].sessionKey).toBeUndefined();
  });

  it("close flushes buffered entries and stops the timer", async () => {
    ledger = createSessionCostLedger({ stateDir: dir, flushIntervalMs: 60_000 });

    ledger.record({ source: "custom", costUsd: 0.01 });
    ledger.record({ source: "custom", costUsd: 0.02 });

    expect(ledger.pending()).toBe(2);
    await ledger.close();
    expect(ledger.pending()).toBe(0);

    // Verify flushed to disk
    const entries = new SessionCostLedger({
      stateDir: dir,
      flushIntervalMs: 0,
    }).loadFromDisk();
    expect(entries).toHaveLength(2);
  });
});
