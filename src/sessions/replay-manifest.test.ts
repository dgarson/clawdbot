import { describe, expect, it } from "vitest";
import {
  ReplaySessionStateSchema,
  ReplaySessionEventTypeSchema,
  ReplaySessionIdSchema,
  ReplaySessionManifestSchema,
  ReplaySessionEventSchema,
  ReplaySessionEventLogSchema,
  ReplaySessionStatsSchema,
  parseReplaySessionManifest,
  parseReplaySessionManifestJSON,
  serializeReplaySessionManifest,
  parseReplaySessionEvent,
  parseReplaySessionEventJSON,
  serializeReplaySessionEvent,
  parseReplaySessionEventLog,
  parseReplaySessionEventLogJSON,
  serializeReplaySessionEventLog,
  createReplaySessionId,
  createReplaySessionManifest,
  createReplaySessionEvent,
  exportSessionManifest,
  REPLAY_SESSION_STATES,
  REPLAY_SESSION_EVENT_TYPES,
} from "./replay-manifest.js";

describe("ReplaySessionStateSchema", () => {
  it("should accept valid session states", () => {
    for (const state of REPLAY_SESSION_STATES) {
      expect(ReplaySessionStateSchema.parse(state)).toBe(state);
    }
  });

  it("should reject invalid session states", () => {
    expect(() => ReplaySessionStateSchema.parse("invalid")).toThrow();
    expect(() => ReplaySessionStateSchema.parse("")).toThrow();
  });
});

describe("ReplaySessionEventTypeSchema", () => {
  it("should accept valid event types", () => {
    for (const eventType of REPLAY_SESSION_EVENT_TYPES) {
      expect(ReplaySessionEventTypeSchema.parse(eventType)).toBe(eventType);
    }
  });

  it("should reject invalid event types", () => {
    expect(() => ReplaySessionEventTypeSchema.parse("invalid")).toThrow();
    expect(() => ReplaySessionEventTypeSchema.parse("")).toThrow();
  });
});

describe("ReplaySessionIdSchema", () => {
  it("should parse valid session ID", () => {
    const id = { sessionKey: "session-123", replayId: "replay-456" };
    expect(ReplaySessionIdSchema.parse(id)).toEqual(id);
  });

  it("should reject missing sessionKey", () => {
    expect(() => ReplaySessionIdSchema.parse({ replayId: "replay-456" })).toThrow();
  });

  it("should reject missing replayId", () => {
    expect(() => ReplaySessionIdSchema.parse({ sessionKey: "session-123" })).toThrow();
  });

  it("should reject empty sessionKey", () => {
    expect(() => ReplaySessionIdSchema.parse({ sessionKey: "", replayId: "replay-456" })).toThrow();
  });
});

describe("ReplaySessionManifestSchema", () => {
  it("should parse valid manifest", () => {
    const manifest = {
      id: { sessionKey: "session-123", replayId: "replay-456" },
      state: "recorded",
      recordedAt: "2026-02-23T10:00:00Z",
      agentId: "agent-001",
      eventCount: 42,
      categories: ["llm", "tool"],
      redacted: false,
    };
    expect(ReplaySessionManifestSchema.parse(manifest)).toEqual(manifest);
  });

  it("should parse manifest with optional fields", () => {
    const manifest = {
      id: { sessionKey: "session-123", replayId: "replay-456" },
      state: "completed",
      recordedAt: "2026-02-23T10:00:00Z",
      endedAt: "2026-02-23T10:30:00Z",
      agentId: "agent-001",
      eventCount: 100,
      categories: ["llm", "tool", "message"],
      redacted: true,
      label: "test-session",
      notes: "Test notes",
    };
    const parsed = ReplaySessionManifestSchema.parse(manifest);
    expect(parsed.label).toBe("test-session");
    expect(parsed.notes).toBe("Test notes");
  });

  it("should accept unknown fields (non-strict mode)", () => {
    const manifest = {
      id: { sessionKey: "session-123", replayId: "replay-456" },
      state: "recorded",
      recordedAt: "2026-02-23T10:00:00Z",
      agentId: "agent-001",
      eventCount: 42,
      categories: ["llm"],
      redacted: false,
      unknownField: "should pass",
    };
    // Without strict mode, unknown fields are accepted
    const parsed = ReplaySessionManifestSchema.parse(manifest);
    expect(parsed.state).toBe("recorded");
  });

  it("should reject invalid state", () => {
    const manifest = {
      id: { sessionKey: "session-123", replayId: "replay-456" },
      state: "invalid-state",
      recordedAt: "2026-02-23T10:00:00Z",
      agentId: "agent-001",
      eventCount: 42,
      categories: ["llm"],
      redacted: false,
    };
    expect(() => ReplaySessionManifestSchema.parse(manifest)).toThrow();
  });
});

describe("ReplaySessionEventSchema", () => {
  it("should parse valid event", () => {
    const event = {
      eventId: "evt-001",
      type: "session_started",
      timestamp: "2026-02-23T10:00:00Z",
      sessionKey: "session-123",
    };
    expect(ReplaySessionEventSchema.parse(event)).toEqual(event);
  });

  it("should parse event with payload", () => {
    const event = {
      eventId: "evt-001",
      type: "replay_failed",
      timestamp: "2026-02-23T10:00:00Z",
      sessionKey: "session-123",
      payload: { error: "test error", code: 500 },
    };
    const parsed = ReplaySessionEventSchema.parse(event);
    expect(parsed.payload).toEqual({ error: "test error", code: 500 });
  });

  it("should reject missing required fields", () => {
    expect(() =>
      ReplaySessionEventSchema.parse({
        type: "session_started",
        timestamp: "2026-02-23T10:00:00Z",
        sessionKey: "session-123",
      }),
    ).toThrow();
  });
});

describe("ReplaySessionEventLogSchema", () => {
  it("should parse valid event log", () => {
    const log = {
      sessionKey: "session-123",
      events: [
        {
          eventId: "evt-001",
          type: "session_started",
          timestamp: "2026-02-23T10:00:00Z",
          sessionKey: "session-123",
        },
      ],
    };
    expect(ReplaySessionEventLogSchema.parse(log)).toEqual(log);
  });

  it("should parse empty events array", () => {
    const log = {
      sessionKey: "session-123",
      events: [],
    };
    expect(ReplaySessionEventLogSchema.parse(log)).toEqual(log);
  });
});

describe("ReplaySessionStatsSchema", () => {
  it("should parse valid stats", () => {
    const stats = {
      totalEvents: 100,
      durationMs: 5000,
      replayCount: 3,
      lastReplayAt: "2026-02-23T10:30:00Z",
    };
    expect(ReplaySessionStatsSchema.parse(stats)).toEqual(stats);
  });

  it("should parse stats with optional fields missing", () => {
    const stats = {
      totalEvents: 50,
      replayCount: 0,
    };
    const parsed = ReplaySessionStatsSchema.parse(stats);
    expect(parsed.durationMs).toBeUndefined();
    expect(parsed.lastReplayAt).toBeUndefined();
  });
});

describe("parseReplaySessionManifest", () => {
  it("should parse valid manifest object", () => {
    const manifest = {
      id: { sessionKey: "session-123", replayId: "replay-456" },
      state: "recorded",
      recordedAt: "2026-02-23T10:00:00Z",
      agentId: "agent-001",
      eventCount: 42,
      categories: ["llm"],
      redacted: false,
    };
    expect(parseReplaySessionManifest(manifest)).toEqual(manifest);
  });

  it("should throw on invalid manifest", () => {
    expect(() => parseReplaySessionManifest({})).toThrow();
  });
});

describe("parseReplaySessionManifestJSON", () => {
  it("should parse valid JSON string", () => {
    const json = JSON.stringify({
      id: { sessionKey: "session-123", replayId: "replay-456" },
      state: "recorded",
      recordedAt: "2026-02-23T10:00:00Z",
      agentId: "agent-001",
      eventCount: 42,
      categories: ["llm"],
      redacted: false,
    });
    const parsed = parseReplaySessionManifestJSON(json);
    expect(parsed.id.sessionKey).toBe("session-123");
  });

  it("should throw on invalid JSON", () => {
    expect(() => parseReplaySessionManifestJSON("not valid json")).toThrow();
  });

  it("should throw on invalid manifest JSON", () => {
    expect(() => parseReplaySessionManifestJSON("{}")).toThrow();
  });
});

describe("serializeReplaySessionManifest", () => {
  it("should serialize manifest to JSON", () => {
    const manifest = {
      id: { sessionKey: "session-123", replayId: "replay-456" },
      state: "recorded" as const,
      recordedAt: "2026-02-23T10:00:00Z",
      agentId: "agent-001",
      eventCount: 42,
      categories: ["llm"] as const,
      redacted: false,
    };
    const serialized = serializeReplaySessionManifest(manifest);
    const parsed = JSON.parse(serialized);
    expect(parsed.id.sessionKey).toBe("session-123");
    expect(parsed.state).toBe("recorded");
  });
});

describe("parseReplaySessionEvent", () => {
  it("should parse valid event object", () => {
    const event = {
      eventId: "evt-001",
      type: "session_started" as const,
      timestamp: "2026-02-23T10:00:00Z",
      sessionKey: "session-123",
    };
    expect(parseReplaySessionEvent(event)).toEqual(event);
  });

  it("should throw on invalid event", () => {
    expect(() => parseReplaySessionEvent({})).toThrow();
  });
});

describe("parseReplaySessionEventJSON", () => {
  it("should parse valid JSON string", () => {
    const json = JSON.stringify({
      eventId: "evt-001",
      type: "session_started",
      timestamp: "2026-02-23T10:00:00Z",
      sessionKey: "session-123",
    });
    const parsed = parseReplaySessionEventJSON(json);
    expect(parsed.eventId).toBe("evt-001");
  });

  it("should throw on invalid JSON", () => {
    expect(() => parseReplaySessionEventJSON("not valid json")).toThrow();
  });
});

describe("serializeReplaySessionEvent", () => {
  it("should serialize event to JSON", () => {
    const event = {
      eventId: "evt-001",
      type: "session_started" as const,
      timestamp: "2026-02-23T10:00:00Z",
      sessionKey: "session-123",
    };
    const serialized = serializeReplaySessionEvent(event);
    const parsed = JSON.parse(serialized);
    expect(parsed.eventId).toBe("evt-001");
  });
});

describe("parseReplaySessionEventLog", () => {
  it("should parse valid event log object", () => {
    const log = {
      sessionKey: "session-123",
      events: [
        {
          eventId: "evt-001",
          type: "session_started" as const,
          timestamp: "2026-02-23T10:00:00Z",
          sessionKey: "session-123",
        },
      ],
    };
    expect(parseReplaySessionEventLog(log)).toEqual(log);
  });

  it("should throw on invalid event log", () => {
    expect(() => parseReplaySessionEventLog({})).toThrow();
  });
});

describe("serializeReplaySessionEventLog", () => {
  it("should serialize event log to JSON", () => {
    const log = {
      sessionKey: "session-123",
      events: [
        {
          eventId: "evt-001",
          type: "session_started" as const,
          timestamp: "2026-02-23T10:00:00Z",
          sessionKey: "session-123",
        },
      ],
    };
    const serialized = serializeReplaySessionEventLog(log);
    const parsed = JSON.parse(serialized);
    expect(parsed.sessionKey).toBe("session-123");
    expect(parsed.events).toHaveLength(1);
  });
});

describe("createReplaySessionId", () => {
  it("should create valid session ID", () => {
    const id = createReplaySessionId("session-123", "replay-456");
    expect(id.sessionKey).toBe("session-123");
    expect(id.replayId).toBe("replay-456");
  });
});

describe("createReplaySessionManifest", () => {
  it("should create manifest with required fields", () => {
    const id = createReplaySessionId("session-123", "replay-456");
    const manifest = createReplaySessionManifest(id, "agent-001", ["llm", "tool"], 42, false);
    expect(manifest.id).toEqual(id);
    expect(manifest.agentId).toBe("agent-001");
    expect(manifest.eventCount).toBe(42);
    expect(manifest.categories).toEqual(["llm", "tool"]);
    expect(manifest.redacted).toBe(false);
    expect(manifest.state).toBe("recorded");
    expect(manifest.recordedAt).toBeDefined();
  });

  it("should create manifest with optional label", () => {
    const id = createReplaySessionId("session-123", "replay-456");
    const manifest = createReplaySessionManifest(id, "agent-001", ["llm"], 10, false, "test-label");
    expect(manifest.label).toBe("test-label");
  });
});

describe("createReplaySessionEvent", () => {
  it("should create event with required fields", () => {
    const event = createReplaySessionEvent("session_started", "session-123");
    expect(event.type).toBe("session_started");
    expect(event.sessionKey).toBe("session-123");
    expect(event.eventId).toBeDefined();
    expect(event.timestamp).toBeDefined();
  });

  it("should create event with payload", () => {
    const event = createReplaySessionEvent("replay_failed", "session-123", { error: "test" });
    expect(event.payload).toEqual({ error: "test" });
  });
});

describe("exportSessionManifest", () => {
  it("should return serialized manifest (stub)", async () => {
    const id = createReplaySessionId("session-123", "replay-456");
    const manifest = createReplaySessionManifest(id, "agent-001", ["llm"], 10, false);
    const result = await exportSessionManifest(manifest);
    expect(result).toBeDefined();
    expect(result).toContain("session-123");
  });

  it("should accept options parameter (stub)", async () => {
    const id = createReplaySessionId("session-123", "replay-456");
    const manifest = createReplaySessionManifest(id, "agent-001", ["llm"], 10, false);
    const result = await exportSessionManifest(manifest, {
      outputPath: "/tmp/test.replay",
      includeEventLog: true,
      compress: true,
    });
    expect(result).toBeDefined();
  });
});

describe("round-trip serialization", () => {
  it("should round-trip manifest through serialize/parse", () => {
    const original = {
      id: { sessionKey: "session-123", replayId: "replay-456" },
      state: "recorded" as const,
      recordedAt: "2026-02-23T10:00:00Z",
      agentId: "agent-001",
      eventCount: 42,
      categories: ["llm", "tool"] as const,
      redacted: false,
      label: "test",
    };
    const serialized = serializeReplaySessionManifest(original);
    const parsed = parseReplaySessionManifestJSON(serialized);
    expect(parsed).toEqual(original);
  });

  it("should round-trip event through serialize/parse", () => {
    const original = {
      eventId: "evt-001",
      type: "session_started" as const,
      timestamp: "2026-02-23T10:00:00Z",
      sessionKey: "session-123",
      payload: { key: "value" },
    };
    const serialized = serializeReplaySessionEvent(original);
    const parsed = parseReplaySessionEventJSON(serialized);
    expect(parsed).toEqual(original);
  });

  it("should round-trip event log through serialize/parse", () => {
    const original = {
      sessionKey: "session-123",
      events: [
        {
          eventId: "evt-001",
          type: "session_started" as const,
          timestamp: "2026-02-23T10:00:00Z",
          sessionKey: "session-123",
        },
        {
          eventId: "evt-002",
          type: "session_ended" as const,
          timestamp: "2026-02-23T10:30:00Z",
          sessionKey: "session-123",
        },
      ],
    };
    const serialized = serializeReplaySessionEventLog(original);
    const parsed = parseReplaySessionEventLogJSON(serialized);
    expect(parsed).toEqual(original);
  });
});
