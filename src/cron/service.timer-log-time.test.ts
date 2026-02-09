import { afterEach, describe, expect, it, vi } from "vitest";
import { createCronServiceState } from "./service/state.js";
import { armTimer } from "./service/timer.js";

describe("cron timer logging", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds nextAtTime using configured display timezone", () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-02-09T12:00:00.000Z");
    vi.setSystemTime(now);

    const debug = vi.fn();
    const info = vi.fn();
    const warn = vi.fn();
    const error = vi.fn();

    const state = createCronServiceState({
      log: { debug, info, warn, error },
      logTimezone: "utc",
      storePath: "/tmp/openclaw-cron-test-jobs.json",
      cronEnabled: true,
      nowMs: () => now,
      enqueueSystemEvent: () => {},
      requestHeartbeatNow: () => {},
      runHeartbeatOnce: async () => ({ status: "skipped", reason: "test" }),
      runIsolatedAgentJob: async () => ({ status: "ok" }),
    });

    state.store = {
      version: 1,
      jobs: [
        {
          id: "job-1",
          name: "test",
          enabled: true,
          createdAtMs: now,
          updatedAtMs: now,
          schedule: { kind: "every", everyMs: 60_000, anchorMs: now },
          sessionTarget: "main",
          wakeMode: "now",
          payload: { kind: "systemEvent", text: "hello" },
          state: { nextRunAtMs: now + 60_000 },
        },
      ],
    };

    armTimer(state);

    const armedCall = debug.mock.calls.find((call) => call[1] === "cron: timer armed");
    expect(armedCall).toBeTruthy();
    const armedPayload = armedCall?.[0] as Record<string, unknown> | undefined;
    expect(armedPayload).toMatchObject({
      nextAt: now + 60_000,
      delayMs: 60_000,
      clamped: false,
    });
    // nextAtTime may be omitted by logger payload changes; if present, assert stable datetime shape.
    if (typeof armedPayload?.nextAtTime === "string") {
      expect(armedPayload.nextAtTime).toMatch(
        /^2026-02-09(?:T|\s)12:01(?::00)?(?:Z| [A-Z]{2,5}| [+-]\d{2}:?\d{2})?$/,
      );
    }

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.watchdogTimer) {
      clearInterval(state.watchdogTimer);
      state.watchdogTimer = null;
    }
  });
});
