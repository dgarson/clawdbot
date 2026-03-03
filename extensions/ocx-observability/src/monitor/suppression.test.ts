import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SuppressionRule } from "../types.js";
import { type SuppressionEngine, createSuppressionEngine } from "./suppression.js";

const TEST_RULES: SuppressionRule[] = [
  { signalKind: "token_spike", cooldownMinutes: 15, maxPerHour: 4 },
  { signalKind: "error_burst", cooldownMinutes: 10, maxPerHour: 6 },
];

let engine: SuppressionEngine;

beforeEach(() => {
  vi.useFakeTimers();
  engine = createSuppressionEngine(TEST_RULES);
});

afterEach(() => {
  engine.reset();
  vi.useRealTimers();
});

describe("createSuppressionEngine", () => {
  describe("cooldown", () => {
    it("does not suppress the first alert", () => {
      expect(engine.shouldSuppress("agent-1", "token_spike")).toBe(false);
    });

    it("suppresses within cooldown window after recording an alert", () => {
      engine.recordAlert("agent-1", "token_spike");

      // Advance time by 5 minutes (within 15-minute cooldown)
      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(engine.shouldSuppress("agent-1", "token_spike")).toBe(true);
    });

    it("allows alert after cooldown window expires", () => {
      engine.recordAlert("agent-1", "token_spike");

      // Advance time past the 15-minute cooldown
      vi.advanceTimersByTime(16 * 60 * 1000);

      expect(engine.shouldSuppress("agent-1", "token_spike")).toBe(false);
    });
  });

  describe("maxPerHour rate limiting", () => {
    it("suppresses when maxPerHour is reached", () => {
      // Record 4 alerts for token_spike (maxPerHour = 4)
      for (let i = 0; i < 4; i++) {
        engine.recordAlert("agent-1", "token_spike");
        // Advance past the cooldown each time so cooldown doesn't suppress
        vi.advanceTimersByTime(16 * 60 * 1000);
      }

      // Still within the hour for the 4th alert, so should suppress
      // (4 alerts in ~64 minutes, but last one is still within 1 hour of first)
      // Let's do a cleaner test: record 4 alerts with small gaps
      const engine2 = createSuppressionEngine(TEST_RULES);
      for (let i = 0; i < 4; i++) {
        engine2.recordAlert("agent-2", "token_spike");
        // Small advance, enough that cooldown passes but still within 1 hour
        vi.advanceTimersByTime(16 * 60 * 1000);
      }

      // After 4 * 16 = 64 minutes, the first alert is > 1 hour old so it doesn't count.
      // We need to keep them closer together.
      const engine3 = createSuppressionEngine(TEST_RULES);
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      for (let i = 0; i < 4; i++) {
        engine3.recordAlert("agent-3", "token_spike");
        // 1 minute between alerts
        vi.advanceTimersByTime(1 * 60 * 1000);
      }
      // Now advance past cooldown (15 min from last alert at minute 4)
      vi.advanceTimersByTime(16 * 60 * 1000);
      // Total elapsed: ~20 minutes, all 4 alerts are within the last hour
      expect(engine3.shouldSuppress("agent-3", "token_spike")).toBe(true);
    });
  });

  describe("independent signal kinds", () => {
    it("tracks different signal kinds independently", () => {
      engine.recordAlert("agent-1", "token_spike");

      // token_spike should be suppressed (within cooldown)
      expect(engine.shouldSuppress("agent-1", "token_spike")).toBe(true);

      // error_burst should not be suppressed (no alerts recorded for it)
      expect(engine.shouldSuppress("agent-1", "error_burst")).toBe(false);
    });

    it("tracks different agents independently", () => {
      engine.recordAlert("agent-1", "token_spike");

      // agent-1 should be suppressed
      expect(engine.shouldSuppress("agent-1", "token_spike")).toBe(true);

      // agent-2 should not be suppressed
      expect(engine.shouldSuppress("agent-2", "token_spike")).toBe(false);
    });
  });

  describe("unknown signal kinds", () => {
    it("does not suppress signals without a suppression rule", () => {
      engine.recordAlert("agent-1", "unknown_signal");
      expect(engine.shouldSuppress("agent-1", "unknown_signal")).toBe(false);
    });
  });

  describe("reset", () => {
    it("clears all suppression state", () => {
      engine.recordAlert("agent-1", "token_spike");
      expect(engine.shouldSuppress("agent-1", "token_spike")).toBe(true);

      engine.reset();
      expect(engine.shouldSuppress("agent-1", "token_spike")).toBe(false);
    });
  });
});
