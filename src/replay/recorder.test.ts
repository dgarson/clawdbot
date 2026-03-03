import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeterministicClock } from "./clock.js";
import {
  InMemoryReplayRecorder,
  type ReplayRecorder,
  validateReplayConstraints,
} from "./recorder.js";
import type { ReplayEvent, ReplayEventInput } from "./types.js";

describe("replay recorder", () => {
  let recorder: ReplayRecorder;

  beforeEach(() => {
    recorder = new InMemoryReplayRecorder({
      replayId: "replay-1",
      sessionId: "session-1",
      agentId: "agent-1",
    });
  });

  it("assigns deterministic sequence numbers and timestamps", () => {
    const now = createDeterministicClock({
      start: "2026-02-23T00:00:00.000Z",
      stepMs: 17,
    });
    recorder = new InMemoryReplayRecorder({
      replayId: "replay-1",
      sessionId: "session-1",
      agentId: "agent-1",
      now,
    });

    const first = recorder.emit({ category: "llm", type: "llm.request", data: {} });
    const second = recorder.emit({
      category: "tool",
      type: "tool.request",
      data: { name: "search" },
    });

    expect(first.seq).toBe(0);
    expect(second.seq).toBe(1);
    expect(first.ts).toBe("2026-02-23T00:00:00.000Z");
    expect(second.ts).toBe("2026-02-23T00:00:00.017Z");

    const manifest = recorder.finalize();
    expect(manifest.stats.totalEvents).toBe(2);
    expect(manifest.stats.eventsByCategory.tool).toBe(1);
    expect(manifest.stats.eventsByCategory.llm).toBe(1);
  });

  it("supports sink registration for deterministic replay contracts", () => {
    const sink = vi.fn();
    recorder.attach(sink);

    const input: ReplayEventInput = {
      category: "message",
      type: "message.inbound",
      data: { text: "hello" },
    };
    recorder.emit(input);

    expect(sink).toHaveBeenCalledTimes(1);
    const called = sink.mock.calls[0]?.[0] as ReplayEventInput;
    expect(called.type).toBe("message.inbound");
  });

  it("no-op when disabled", () => {
    recorder = new InMemoryReplayRecorder({
      replayId: "replay-disabled",
      sessionId: "session-disabled",
      agentId: "agent-1",
      enabled: false,
    });

    recorder.emit({ category: "state", type: "session_start", data: {} });

    expect(recorder.getEvents().length).toBe(0);
    expect(recorder.finalize().stats.totalEvents).toBe(0);
  });

  it("returns a defensive copy from getEvents", () => {
    recorder.emit({ category: "state", type: "session_start", data: {} });

    const events = recorder.getEvents() as ReplayEvent[];
    events.push({ category: "state", type: "session_end", data: {} });

    expect(recorder.getEvents()).toHaveLength(1);
  });

  it("increments synthetic sequence numbers when disabled", () => {
    recorder = new InMemoryReplayRecorder({
      replayId: "replay-disabled",
      sessionId: "session-disabled",
      agentId: "agent-1",
      enabled: false,
    });

    const first = recorder.emit({ category: "state", type: "session_start", data: {} });
    const second = recorder.emit({ category: "state", type: "session_end", data: {} });

    expect(first.seq).toBe(0);
    expect(second.seq).toBe(1);
    expect(recorder.getEvents()).toHaveLength(0);
  });

  it("normalizes manifest categories in deterministic order", () => {
    recorder = new InMemoryReplayRecorder({
      replayId: "replay-categories",
      sessionId: "session-categories",
      agentId: "agent-1",
      categories: ["tool", "llm", "tool", "message"],
    });

    recorder.emit({ category: "tool", type: "tool.request", data: { name: "search" } });

    const manifest = recorder.finalize();
    expect(manifest.recording.categories).toEqual(["llm", "message", "tool"]);
  });

  it("detects sequence mismatches as deterministic constraint violations", () => {
    const events: ReadonlyArray<{
      seq: number;
      ts: string;
      category: "llm" | "tool" | "message" | "file" | "state" | "system" | "user";
      type: string;
      data: Record<string, unknown>;
    }> = [
      {
        seq: 0,
        ts: "2026-02-23T00:00:00.000Z",
        category: "llm",
        type: "llm.request",
        data: {},
      },
      {
        seq: 1,
        ts: "2026-02-23T00:00:00.001Z",
        category: "tool",
        type: "tool.request",
        data: {},
      },
      {
        seq: 2,
        ts: "2026-02-23T00:00:00.002Z",
        category: "system",
        type: "system.flush",
        data: {},
      },
    ];

    const check = validateReplayConstraints({
      actual: events,
      expected: [
        { category: "llm", type: "llm.request" },
        { category: "tool", type: "tool.request" },
        { category: "state", type: "session_end" },
      ],
    });

    expect(check.ok).toBe(false);
    expect(check.violations).toHaveLength(1);
    expect(check.violations[0]).toMatchObject({
      index: 2,
      reason: "event mismatch",
    });
  });
});
