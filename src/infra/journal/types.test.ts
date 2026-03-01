import { describe, expect, test } from "vitest";
import {
  DEFAULT_JOURNAL_CONFIG,
  type JournalEntry,
  resolveActivityBuckets,
  resolveJournalConfig,
} from "./types.js";

describe("resolveJournalConfig", () => {
  test("returns defaults when no config provided", () => {
    const config = resolveJournalConfig(undefined);
    expect(config).toEqual(DEFAULT_JOURNAL_CONFIG);
  });

  test("merges partial config with defaults", () => {
    const config = resolveJournalConfig({ retentionDays: 14 });
    expect(config.retentionDays).toBe(14);
    expect(config.enabled).toBe(true);
    expect(config.maxFileMb).toBe(100);
  });

  test("respects all overrides", () => {
    const config = resolveJournalConfig({
      enabled: false,
      maxFileMb: 50,
      retentionDays: 7,
      activityBuckets: false,
      consoleSummary: false,
    });
    expect(config.enabled).toBe(false);
    expect(config.maxFileMb).toBe(50);
    expect(config.retentionDays).toBe(7);
    expect(config.activityBuckets).toBe(false);
    expect(config.consoleSummary).toBe(false);
  });
});

describe("resolveActivityBuckets", () => {
  const makeEntry = (overrides: Partial<JournalEntry>): JournalEntry => ({
    ts: Date.now(),
    type: "test",
    severity: "info",
    summary: "test entry",
    ...overrides,
  });

  test("maps run events to runs bucket", () => {
    expect(resolveActivityBuckets(makeEntry({ type: "run.start" }))).toContain("runs");
    expect(resolveActivityBuckets(makeEntry({ type: "run.end" }))).toContain("runs");
    expect(resolveActivityBuckets(makeEntry({ type: "run.attempt" }))).toContain("runs");
  });

  test("maps message events to messages bucket", () => {
    expect(resolveActivityBuckets(makeEntry({ type: "message.queued" }))).toContain("messages");
    expect(resolveActivityBuckets(makeEntry({ type: "message.processed" }))).toContain("messages");
  });

  test("maps usage events to usage bucket", () => {
    expect(resolveActivityBuckets(makeEntry({ type: "model.usage" }))).toContain("usage");
  });

  test("maps cache events to cache bucket", () => {
    expect(resolveActivityBuckets(makeEntry({ type: "cache.invalidation" }))).toContain("cache");
    expect(resolveActivityBuckets(makeEntry({ type: "cache.hit" }))).toContain("cache");
  });

  test("maps error/warn severity to errors bucket", () => {
    expect(resolveActivityBuckets(makeEntry({ severity: "error" }))).toContain("errors");
    expect(resolveActivityBuckets(makeEntry({ severity: "warn" }))).toContain("errors");
  });

  test("does not add errors bucket for info/debug/trace", () => {
    expect(resolveActivityBuckets(makeEntry({ severity: "info" }))).not.toContain("errors");
    expect(resolveActivityBuckets(makeEntry({ severity: "debug" }))).not.toContain("errors");
    expect(resolveActivityBuckets(makeEntry({ severity: "trace" }))).not.toContain("errors");
  });

  test("run.end with error severity goes to both runs and errors", () => {
    const buckets = resolveActivityBuckets(makeEntry({ type: "run.end", severity: "error" }));
    expect(buckets).toContain("runs");
    expect(buckets).toContain("errors");
  });

  test("returns empty for unrecognized event type with info severity", () => {
    const buckets = resolveActivityBuckets(makeEntry({ type: "heartbeat", severity: "trace" }));
    expect(buckets).toEqual([]);
  });
});
