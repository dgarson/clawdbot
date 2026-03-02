import type { TelemetryReplayState, TelemetryTimelineEvent } from "./telemetry-types.ts";

/**
 * Manages timeline replay playback.
 * Call tick() on a timer to advance event-by-event according to real timestamps.
 */
export class TelemetryReplayController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onUpdate: (state: TelemetryReplayState) => void;

  constructor(onUpdate: (state: TelemetryReplayState) => void) {
    this.onUpdate = onUpdate;
  }

  /** Replace the update callback (fixes stale closure when state ref changes). */
  setOnUpdate(onUpdate: (state: TelemetryReplayState) => void) {
    this.onUpdate = onUpdate;
  }

  start(events: TelemetryTimelineEvent[], replay: TelemetryReplayState): TelemetryReplayState {
    if (events.length === 0) {
      return replay;
    }
    const next = { ...replay, playing: true };
    // Reset to start if at end
    if (next.currentIndex >= events.length) {
      next.currentIndex = 0;
    }
    this.scheduleNext(events, next);
    return next;
  }

  pause(replay: TelemetryReplayState): TelemetryReplayState {
    this.clearTimer();
    return { ...replay, playing: false };
  }

  togglePlayPause(
    events: TelemetryTimelineEvent[],
    replay: TelemetryReplayState,
  ): TelemetryReplayState {
    if (replay.playing) {
      return this.pause(replay);
    }
    return this.start(events, replay);
  }

  seek(index: number, replay: TelemetryReplayState): TelemetryReplayState {
    this.clearTimer();
    return { ...replay, currentIndex: index, playing: false };
  }

  setSpeed(
    speed: number,
    events: TelemetryTimelineEvent[],
    replay: TelemetryReplayState,
  ): TelemetryReplayState {
    const next = { ...replay, speed };
    if (next.playing) {
      this.clearTimer();
      this.scheduleNext(events, next);
    }
    return next;
  }

  stop(): void {
    this.clearTimer();
  }

  private scheduleNext(events: TelemetryTimelineEvent[], state: TelemetryReplayState) {
    if (!state.playing || state.currentIndex >= events.length) {
      if (state.currentIndex >= events.length) {
        this.onUpdate({ ...state, playing: false });
      }
      return;
    }

    const currentIdx = state.currentIndex;
    const nextIdx = currentIdx + 1;

    if (nextIdx >= events.length) {
      // Show the last event then stop
      const next = { ...state, currentIndex: events.length, playing: false };
      this.onUpdate(next);
      return;
    }

    // Calculate delay based on real timestamps
    const currentTs = new Date(events[currentIdx].timestamp).getTime();
    const nextTs = new Date(events[nextIdx].timestamp).getTime();
    let delay = Math.max(nextTs - currentTs, 50); // At least 50ms
    delay = Math.min(delay, 3000); // Cap at 3 seconds
    delay = delay / state.speed;

    this.timer = globalThis.setTimeout(() => {
      const next: TelemetryReplayState = {
        ...state,
        currentIndex: nextIdx,
      };
      this.onUpdate(next);
      this.scheduleNext(events, next);
    }, delay);
  }

  private clearTimer() {
    if (this.timer != null) {
      globalThis.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
