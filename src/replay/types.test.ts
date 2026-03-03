import { describe, expect, it } from "vitest";
import { createDeterministicClock } from "./clock.js";
import { InMemoryReplayRecorder } from "./recorder.js";
import {
  parseReplayEvent,
  parseReplayEventJSON,
  parseReplayEventJSONL,
  parseReplayManifest,
  parseReplayManifestJSON,
  ReplayEventCategory,
  REPLAY_EVENT_CATEGORIES,
  REPLAY_SCHEMA_VERSION,
  serializeReplayManifest,
  type ReplayEvent,
} from "./types.js";

describe("replay event JSONL parsing and serialization", () => {
  it("parses event objects and preserves event order", () => {
    const clock = createDeterministicClock({
      start: "2026-02-23T00:00:00.000Z",
      stepMs: 7,
    });

    const recorder = new InMemoryReplayRecorder({
      replayId: "replay-types",
      sessionId: "session-types",
      agentId: "agent-1",
      now: clock,
    });

    recorder.emit({ category: "llm", type: "llm.request", data: { model: "gpt" } });
    recorder.emit({ category: "tool", type: "tool.request", data: { tool: "search" } });

    const parsed = parseReplayEventJSONL(recorder.toJSONL());
    expect(parsed).toHaveLength(2);
    expect(parsed[0].type).toBe("llm.request");
    expect(parsed[1].type).toBe("tool.request");
    expect(parsed[1].seq).toBe(1);
  });

  it("rejects malformed JSON lines with line numbers", () => {
    const payload =
      '{"seq":0,"ts":"2026-02-23T00:00:00.000Z","category":"llm","type":"llm.request","data":{}}\nnot-json';
    expect(() => parseReplayEventJSONL(payload)).toThrow(/line 2/i);
  });

  it("round-trips a single replay event", () => {
    const event: ReplayEvent = {
      seq: 0,
      ts: "2026-02-23T00:00:00.000Z",
      category: "message",
      type: "message.outbound",
      data: { text: "hi" },
    };

    const raw = JSON.stringify(event);
    const parsed = parseReplayEventJSON(raw);
    expect(parsed).toEqual(event);
  });

  it("rejects invalid category payloads", () => {
    expect(() =>
      parseReplayEvent({
        seq: 0,
        ts: "2026-02-23T00:00:00.000Z",
        category: "bad",
        type: "x",
        data: {},
      } as unknown),
    ).toThrow();
  });
});

describe("replay manifest category canonicalization", () => {
  it("normalizes duplicate and unordered categories", () => {
    const manifest = parseReplayManifest({
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
        categories: ["tool", "llm", "tool", "message"],
        redacted: false,
      },
      stats: {
        totalEvents: 0,
        eventsByCategory: {
          llm: 0,
          tool: 0,
          message: 0,
          file: 0,
          state: 0,
          system: 0,
          user: 0,
        },
      },
      eventFingerprint: "a".repeat(64),
    });

    expect(manifest.recording.categories).toEqual(["llm", "message", "tool"]);
  });

  it("validates that all event categories are retained in manifest schema", () => {
    const manifest = parseReplayManifestJSON(
      serializeReplayManifest({
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
          categories: REPLAY_EVENT_CATEGORIES,
          redacted: false,
        },
        stats: {
          totalEvents: 7,
          eventsByCategory: {
            llm: 1,
            tool: 1,
            message: 1,
            file: 1,
            state: 1,
            system: 1,
            user: 1,
          },
        },
        eventFingerprint: "f".repeat(64),
      }),
    );

    expect(manifest.stats.eventsByCategory).toMatchObject({
      llm: 1,
      tool: 1,
      message: 1,
      file: 1,
      state: 1,
      system: 1,
      user: 1,
    } as Record<ReplayEventCategory, number>);
  });
});
