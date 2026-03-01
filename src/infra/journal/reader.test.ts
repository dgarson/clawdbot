import { describe, expect, test } from "vitest";
import { parseRelativeTime } from "./reader.js";

describe("parseRelativeTime", () => {
  test("parses seconds", () => {
    const before = Date.now();
    const result = parseRelativeTime("30s");
    expect(result).not.toBeNull();
    expect(result!).toBeLessThanOrEqual(before);
    expect(result!).toBeGreaterThan(before - 31_000);
  });

  test("parses minutes", () => {
    const result = parseRelativeTime("5m");
    expect(result).not.toBeNull();
    const expected = Date.now() - 5 * 60 * 1000;
    expect(Math.abs(result! - expected)).toBeLessThan(100);
  });

  test("parses hours", () => {
    const result = parseRelativeTime("1h");
    expect(result).not.toBeNull();
    const expected = Date.now() - 60 * 60 * 1000;
    expect(Math.abs(result! - expected)).toBeLessThan(100);
  });

  test("parses days", () => {
    const result = parseRelativeTime("2d");
    expect(result).not.toBeNull();
    const expected = Date.now() - 2 * 24 * 60 * 60 * 1000;
    expect(Math.abs(result! - expected)).toBeLessThan(100);
  });

  test("parses ISO date", () => {
    const result = parseRelativeTime("2026-02-28T00:00:00Z");
    expect(result).not.toBeNull();
    expect(result).toBe(new Date("2026-02-28T00:00:00Z").getTime());
  });

  test("returns null for invalid input", () => {
    expect(parseRelativeTime("abc")).toBeNull();
    expect(parseRelativeTime("")).toBeNull();
    expect(parseRelativeTime("5x")).toBeNull();
  });
});
