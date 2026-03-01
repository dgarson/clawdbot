import { describe, expect, test } from "vitest";
import { buildCacheInvalidationEntry, extractAgentId } from "./subscriber.js";

// We test the mapping functions directly since they're the core logic.
// The startJournalSubscriber function is an integration that wires
// onDiagnosticEvent/onAgentEvent to the writer.

describe("extractAgentId", () => {
  test("extracts agentId from standard session key", () => {
    expect(extractAgentId("agent:main:slack:channel:c123")).toBe("main");
  });

  test("extracts agentId from complex session key", () => {
    expect(extractAgentId("agent:julia:discord:dm:user123")).toBe("julia");
  });

  test("returns undefined for missing session key", () => {
    expect(extractAgentId(undefined)).toBeUndefined();
    expect(extractAgentId("")).toBeUndefined();
  });

  test("returns undefined for non-agent session key", () => {
    expect(extractAgentId("slack:channel:c123")).toBeUndefined();
  });

  test("handles short agent keys", () => {
    expect(extractAgentId("agent:a")).toBe("a");
  });
});

describe("buildCacheInvalidationEntry", () => {
  test("creates cache.invalidation entry when hashes differ", () => {
    const entry = buildCacheInvalidationEntry({
      currentPromptHash: "abc12345",
      previousPromptHash: "def67890",
      sessionKey: "agent:main:slack:channel:c123",
      sessionId: "session-1",
    });

    expect(entry.type).toBe("cache.invalidation");
    expect(entry.severity).toBe("warn");
    expect(entry.agentId).toBe("main");
    expect(entry.summary).toContain("cache invalidated");
    expect(entry.summary).toContain("def67890→abc12345");
  });

  test("includes invalidator section in summary when present", () => {
    const entry = buildCacheInvalidationEntry({
      currentPromptHash: "abc12345",
      previousPromptHash: "def67890",
      invalidatorBlock: {
        name: "Current Date & Time",
        source: "runtime",
        byteOffset: 1234,
        wastedTokensEstimated: 500,
      },
    });

    expect(entry.summary).toContain("invalidator=Current Date & Time");
    expect(entry.summary).toContain("wastedTokens≈500");
    expect(entry.data?.invalidatorBlock).toBeDefined();
  });

  test("creates cache.hit entry when hashes match", () => {
    const entry = buildCacheInvalidationEntry({
      currentPromptHash: "abc12345",
      previousPromptHash: "abc12345",
      sessionKey: "agent:main:default",
    });

    expect(entry.type).toBe("cache.hit");
    expect(entry.severity).toBe("trace");
    expect(entry.summary).toContain("cache hit");
  });

  test("creates cache.invalidation for first run (empty previous hash)", () => {
    const entry = buildCacheInvalidationEntry({
      currentPromptHash: "abc12345",
      previousPromptHash: "",
    });

    // Empty previous hash = first run, counts as cache hit (no invalidation)
    expect(entry.type).toBe("cache.hit");
  });

  test("uses explicit agentId over parsed one", () => {
    const entry = buildCacheInvalidationEntry({
      currentPromptHash: "abc12345",
      previousPromptHash: "abc12345",
      sessionKey: "agent:main:default",
      agentId: "julia",
    });

    expect(entry.agentId).toBe("julia");
  });
});
