import { describe, expect, test } from "vitest";
import {
  formatJournalExpanded,
  formatJournalSummary,
  shouldExpandOnConsole,
  shouldShowOnConsole,
} from "./console-formatter.js";
import type { JournalEntry } from "./types.js";

function makeEntry(overrides?: Partial<JournalEntry>): JournalEntry {
  return {
    ts: Date.now(),
    type: "test.event",
    severity: "info",
    summary: "test event happened",
    ...overrides,
  };
}

describe("formatJournalSummary", () => {
  test("includes journal prefix", () => {
    const result = formatJournalSummary(makeEntry());
    expect(result).toContain("[journal]");
  });

  test("includes agent id when present", () => {
    const result = formatJournalSummary(makeEntry({ agentId: "main" }));
    expect(result).toContain("[main]");
  });

  test("includes summary text", () => {
    const result = formatJournalSummary(makeEntry({ summary: "run completed" }));
    expect(result).toContain("run completed");
  });

  test("omits agent bracket when no agentId", () => {
    const result = formatJournalSummary(makeEntry({ agentId: undefined }));
    expect(result).not.toContain("[undefined]");
    expect(result).toBe("[journal] test event happened");
  });
});

describe("formatJournalExpanded", () => {
  test("includes header when no data", () => {
    const result = formatJournalExpanded(makeEntry({ data: undefined }));
    expect(result).toContain("[journal]");
    expect(result).not.toContain("\n");
  });

  test("includes data on separate lines", () => {
    const result = formatJournalExpanded(
      makeEntry({ data: { model: "claude-sonnet-4-6", durationMs: 8000 } }),
    );
    expect(result).toContain("model: claude-sonnet-4-6");
    expect(result).toContain("durationMs: 8000");
  });

  test("skips null/undefined data values", () => {
    const result = formatJournalExpanded(
      makeEntry({ data: { key: "value", empty: undefined, nil: null } as Record<string, unknown> }),
    );
    expect(result).toContain("key: value");
    expect(result).not.toContain("empty:");
    expect(result).not.toContain("nil:");
  });

  test("serializes object values as JSON", () => {
    const result = formatJournalExpanded(makeEntry({ data: { nested: { a: 1, b: 2 } } }));
    expect(result).toContain('nested: {"a":1,"b":2}');
  });
});

describe("shouldShowOnConsole", () => {
  test("suppresses trace and debug", () => {
    expect(shouldShowOnConsole(makeEntry({ severity: "trace" }))).toBe(false);
    expect(shouldShowOnConsole(makeEntry({ severity: "debug" }))).toBe(false);
  });

  test("shows info, warn, error", () => {
    expect(shouldShowOnConsole(makeEntry({ severity: "info" }))).toBe(true);
    expect(shouldShowOnConsole(makeEntry({ severity: "warn" }))).toBe(true);
    expect(shouldShowOnConsole(makeEntry({ severity: "error" }))).toBe(true);
  });
});

describe("shouldExpandOnConsole", () => {
  test("expands warn and error", () => {
    expect(shouldExpandOnConsole(makeEntry({ severity: "warn" }))).toBe(true);
    expect(shouldExpandOnConsole(makeEntry({ severity: "error" }))).toBe(true);
  });

  test("does not expand info", () => {
    expect(shouldExpandOnConsole(makeEntry({ severity: "info" }))).toBe(false);
  });
});
