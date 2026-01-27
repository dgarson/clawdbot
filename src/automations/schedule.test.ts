/**
 * Tests for automation schedule computation.
 */

import { describe, it, expect } from "vitest";
import { computeNextRunAtMs } from "./schedule.js";

describe("computeNextRunAtMs", () => {
  const nowMs = 1_000_000_000_000; // Fixed timestamp for testing

  describe("at schedule", () => {
    it("should return undefined if time has passed", () => {
      const result = computeNextRunAtMs({ kind: "at", atMs: nowMs - 1000 }, nowMs);
      expect(result).toBeUndefined();
    });

    it("should return the scheduled time if in future", () => {
      const futureTime = nowMs + 10000;
      const result = computeNextRunAtMs({ kind: "at", atMs: futureTime }, nowMs);
      expect(result).toBe(futureTime);
    });

    it("should return undefined if exactly now", () => {
      const result = computeNextRunAtMs({ kind: "at", atMs: nowMs }, nowMs);
      expect(result).toBeUndefined();
    });
  });

  describe("every schedule", () => {
    it("should compute next run for simple interval", () => {
      const result = computeNextRunAtMs({ kind: "every", everyMs: 60000 }, nowMs);
      expect(result).toBe(nowMs + 60000);
    });

    it("should handle anchor time", () => {
      const anchorMs = nowMs - 30000; // 30 seconds ago
      const result = computeNextRunAtMs({ kind: "every", everyMs: 60000, anchorMs }, nowMs);
      // Should align to anchor + multiples of everyMs
      expect(result).toBeGreaterThan(nowMs);
      expect(result! % 60000).toBe(anchorMs % 60000);
    });

    it("should handle intervals", () => {
      const result = computeNextRunAtMs({ kind: "every", everyMs: 300000 }, nowMs);
      expect(result).toBe(nowMs + 300000); // 5 minutes
    });
  });

  describe("cron schedule", () => {
    it("should compute next run for cron expression", () => {
      // Using a simple hourly cron
      const result = computeNextRunAtMs({ kind: "cron", expr: "0 * * * *" }, nowMs);
      expect(result).toBeDefined();
      expect(result!).toBeGreaterThan(nowMs);
    });

    it("should handle timezone", () => {
      const result = computeNextRunAtMs(
        { kind: "cron", expr: "0 * * * *", tz: "America/New_York" },
        nowMs,
      );
      expect(result).toBeDefined();
    });

    it("should handle daily cron", () => {
      const result = computeNextRunAtMs({ kind: "cron", expr: "0 0 * * *" }, nowMs);
      expect(result).toBeDefined();
      // Should be within 24 hours
      expect(result! - nowMs).toBeLessThan(24 * 60 * 60 * 1000);
    });
  });

  describe("edge cases", () => {
    it("should handle zero everyMs by treating as 1ms", () => {
      const result = computeNextRunAtMs({ kind: "every", everyMs: 0 }, nowMs);
      // The cron implementation treats 0 as 1ms (minimum interval)
      expect(result).toBeDefined();
      expect(result!).toBeGreaterThan(nowMs);
    });

    it("should handle negative atMs", () => {
      const result = computeNextRunAtMs({ kind: "at", atMs: -1000 }, nowMs);
      expect(result).toBeUndefined();
    });

    it("should handle very large everyMs", () => {
      const result = computeNextRunAtMs(
        { kind: "every", everyMs: Number.MAX_SAFE_INTEGER - 1 },
        nowMs,
      );
      expect(result).toBeDefined();
      // Due to floating point precision, the result might be slightly off
      expect(result! - nowMs).toBeGreaterThanOrEqual(Number.MAX_SAFE_INTEGER - 2);
    });
  });
});
