import { afterEach, describe, expect, it, vi } from "vitest";
import { TelemetryReplayController } from "./telemetry-replay.ts";
import type { TelemetryReplayState, TelemetryTimelineEvent } from "./telemetry-types.ts";

function makeEvents(count: number): TelemetryTimelineEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    timestamp: new Date(Date.now() + i * 1000).toISOString(),
    kind: i % 2 === 0 ? "run.start" : "llm.call",
  }));
}

function defaultReplay(): TelemetryReplayState {
  return { playing: false, speed: 1, currentIndex: 0 };
}

describe("TelemetryReplayController", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("start sets playing to true", () => {
    const onUpdate = vi.fn();
    const ctrl = new TelemetryReplayController(onUpdate);
    const events = makeEvents(5);
    const result = ctrl.start(events, defaultReplay());

    expect(result.playing).toBe(true);
    expect(result.currentIndex).toBe(0);

    ctrl.stop();
  });

  it("pause sets playing to false", () => {
    const onUpdate = vi.fn();
    const ctrl = new TelemetryReplayController(onUpdate);
    const state: TelemetryReplayState = { playing: true, speed: 1, currentIndex: 2 };
    const result = ctrl.pause(state);

    expect(result.playing).toBe(false);
    expect(result.currentIndex).toBe(2);
  });

  it("togglePlayPause starts when paused", () => {
    const onUpdate = vi.fn();
    const ctrl = new TelemetryReplayController(onUpdate);
    const events = makeEvents(3);
    const result = ctrl.togglePlayPause(events, defaultReplay());

    expect(result.playing).toBe(true);

    ctrl.stop();
  });

  it("togglePlayPause pauses when playing", () => {
    const onUpdate = vi.fn();
    const ctrl = new TelemetryReplayController(onUpdate);
    const state: TelemetryReplayState = { playing: true, speed: 1, currentIndex: 1 };
    const result = ctrl.togglePlayPause(makeEvents(3), state);

    expect(result.playing).toBe(false);
  });

  it("seek sets currentIndex and pauses", () => {
    const onUpdate = vi.fn();
    const ctrl = new TelemetryReplayController(onUpdate);
    const state: TelemetryReplayState = { playing: true, speed: 2, currentIndex: 0 };
    const result = ctrl.seek(5, state);

    expect(result.currentIndex).toBe(5);
    expect(result.playing).toBe(false);
  });

  it("setSpeed updates speed field", () => {
    const onUpdate = vi.fn();
    const ctrl = new TelemetryReplayController(onUpdate);
    const state: TelemetryReplayState = { playing: false, speed: 1, currentIndex: 0 };
    const result = ctrl.setSpeed(5, makeEvents(3), state);

    expect(result.speed).toBe(5);

    ctrl.stop();
  });

  it("start with empty events returns unchanged", () => {
    const onUpdate = vi.fn();
    const ctrl = new TelemetryReplayController(onUpdate);
    const state = defaultReplay();
    const result = ctrl.start([], state);

    expect(result).toEqual(state);
  });

  it("start resets to 0 when at end", () => {
    const onUpdate = vi.fn();
    const ctrl = new TelemetryReplayController(onUpdate);
    const events = makeEvents(3);
    const state: TelemetryReplayState = { playing: false, speed: 1, currentIndex: 3 };
    const result = ctrl.start(events, state);

    expect(result.currentIndex).toBe(0);
    expect(result.playing).toBe(true);

    ctrl.stop();
  });
});
