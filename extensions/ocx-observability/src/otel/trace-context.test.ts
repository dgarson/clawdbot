import { afterEach, describe, expect, it } from "vitest";
import {
  clearAllTraceContexts,
  generateTraceId,
  getRunTraceContext,
  setRunTraceContext,
} from "./trace-context.js";

afterEach(() => {
  clearAllTraceContexts();
});

describe("generateTraceId", () => {
  it("produces a 32-character hex string without seed", () => {
    const traceId = generateTraceId();
    expect(traceId).toHaveLength(32);
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces a 32-character hex string with seed", () => {
    const traceId = generateTraceId("my-lineage-id");
    expect(traceId).toHaveLength(32);
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is deterministic when given the same seed", () => {
    const a = generateTraceId("deterministic-seed");
    const b = generateTraceId("deterministic-seed");
    expect(a).toBe(b);
  });

  it("produces different values for different seeds", () => {
    const a = generateTraceId("seed-alpha");
    const b = generateTraceId("seed-beta");
    expect(a).not.toBe(b);
  });

  it("produces unique values without seed (random)", () => {
    const a = generateTraceId();
    const b = generateTraceId();
    // Extremely unlikely to collide
    expect(a).not.toBe(b);
  });
});

describe("setRunTraceContext / getRunTraceContext", () => {
  it("stores and retrieves a trace context", () => {
    const ctx = { traceId: "a".repeat(32), spanId: "b".repeat(16) };
    setRunTraceContext("run-1", ctx);
    expect(getRunTraceContext("run-1")).toEqual(ctx);
  });

  it("returns undefined for unknown runId", () => {
    expect(getRunTraceContext("nonexistent")).toBeUndefined();
  });

  it("overwrites existing context for the same runId", () => {
    const ctx1 = { traceId: "a".repeat(32), spanId: "b".repeat(16) };
    const ctx2 = { traceId: "c".repeat(32), spanId: "d".repeat(16) };
    setRunTraceContext("run-1", ctx1);
    setRunTraceContext("run-1", ctx2);
    expect(getRunTraceContext("run-1")).toEqual(ctx2);
  });
});

describe("clearAllTraceContexts", () => {
  it("removes all stored trace contexts", () => {
    setRunTraceContext("run-1", { traceId: "a".repeat(32), spanId: "b".repeat(16) });
    setRunTraceContext("run-2", { traceId: "c".repeat(32), spanId: "d".repeat(16) });

    clearAllTraceContexts();

    expect(getRunTraceContext("run-1")).toBeUndefined();
    expect(getRunTraceContext("run-2")).toBeUndefined();
  });
});
