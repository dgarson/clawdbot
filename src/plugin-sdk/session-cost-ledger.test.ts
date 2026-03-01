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
});
