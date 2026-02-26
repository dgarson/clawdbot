import { describe, expect, it } from "vitest";
import {
  ReplayEventCategory,
  ReplayManifestSchema,
  REPLAY_EVENT_CATEGORIES,
  REPLAY_SCHEMA_VERSION,
  parseReplayManifest,
  parseReplayManifestJSON,
  serializeReplayManifest,
  type ReplayManifest,
  type ReplayManifestStats,
} from "./types.js";

describe("Replay manifest schema", () => {
  const validManifest: ReplayManifest = {
    schemaVersion: REPLAY_SCHEMA_VERSION,
    replayId: "replay-01",
    session: {
      sessionId: "session-01",
      agentId: "agent-01",
      startedAt: "2026-02-23T00:00:00.000Z",
      endedAt: "2026-02-23T00:01:00.000Z",
    },
    environment: {
      nodeVersion: "v20.0.0",
      platform: "darwin",
      architecture: "arm64",
    },
    recording: {
      categories: ["llm", "tool"],
      redacted: false,
    },
    stats: {
      totalEvents: 2,
      eventsByCategory: {
        llm: 1,
        tool: 1,
        message: 0,
        file: 0,
        state: 0,
        system: 0,
        user: 0,
      },
    } satisfies ReplayManifestStats,
    eventFingerprint: "a".repeat(64),
  };

  it("accepts a valid manifest", () => {
    expect(ReplayManifestSchema.parse(validManifest)).toMatchObject({
      schemaVersion: REPLAY_SCHEMA_VERSION,
    });
  });

  it("deduplicates duplicate categories", () => {
    const parsed = parseReplayManifest({
      ...validManifest,
      recording: {
        ...validManifest.recording,
        categories: ["llm", "llm", "tool", "tool", "message"],
      },
    });
    expect(parsed.recording.categories).toHaveLength(3);
    expect(parsed.recording.categories).toContain("message");
  });

  it("parses JSON text", () => {
    const serialized = serializeReplayManifest(validManifest);
    const parsed = parseReplayManifestJSON(serialized);
    expect(parsed).toEqual(validManifest);
  });

  it("rejects invalid schema version", () => {
    expect(() =>
      parseReplayManifest({
        ...validManifest,
        schemaVersion: 99,
      }),
    ).toThrowError(/Invalid replay manifest/);
  });

  it("rejects invalid event category in recording", () => {
    expect(() =>
      parseReplayManifest({
        ...validManifest,
        recording: {
          ...validManifest.recording,
          categories: ["invalid-category"],
        },
      }),
    ).toThrow();
  });

  it("accepts all known event categories in stats", () => {
    const parsed = parseReplayManifest(validManifest);
    for (const category of REPLAY_EVENT_CATEGORIES) {
      const expected = parsed.stats.eventsByCategory[category];
      expect(typeof expected).toBe("number");
    }

    const category = "llm" as ReplayEventCategory;
    expect(parsed.stats.eventsByCategory[category]).toBe(1);
  });

  it("rejects wrong eventFingerprint format", () => {
    expect(() =>
      parseReplayManifest({
        ...validManifest,
        eventFingerprint: "not-a-hash",
      }),
    ).toThrow(/must be a 64 character SHA-256 fingerprint/);
  });
});
