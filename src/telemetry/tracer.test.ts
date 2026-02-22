import { describe, it, expect } from "vitest";
import { getTracer, withSpan, withSpanSync, setSpanAttributes, getActiveSpan } from "./tracer.js";

describe("telemetry/tracer (no-op mode)", () => {
  it("getTracer returns a tracer without throwing", () => {
    const tracer = getTracer();
    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe("function");
  });

  it("getTracer accepts a custom name", () => {
    expect(getTracer("custom-scope")).toBeDefined();
  });

  it("withSpan executes and returns result", async () => {
    expect(await withSpan("openclaw.test.noop", async () => 42)).toBe(42);
  });

  it("withSpan passes a span to the callback", async () => {
    await withSpan("openclaw.test.span-arg", async (span) => {
      expect(span).toBeDefined();
      expect(typeof span.setAttribute).toBe("function");
    });
  });

  it("withSpan propagates thrown errors", async () => {
    await expect(
      withSpan("openclaw.test.error", async () => {
        throw new Error("test error");
      }),
    ).rejects.toThrow("test error");
  });

  it("withSpan accepts initial attributes", async () => {
    const r = await withSpan("openclaw.test.attrs", async () => "ok", {
      "test.key": "value",
      "test.num": 123,
    });
    expect(r).toBe("ok");
  });

  it("withSpanSync executes synchronously", () => {
    expect(withSpanSync("openclaw.test.sync", () => "sync-result")).toBe("sync-result");
  });

  it("withSpanSync propagates thrown errors", () => {
    expect(() =>
      withSpanSync("openclaw.test.sync-error", () => {
        throw new Error("sync test error");
      }),
    ).toThrow("sync test error");
  });

  it("setSpanAttributes does not throw on no-op span", () => {
    const span = getTracer().startSpan("test");
    expect(() =>
      setSpanAttributes(span, { "str.attr": "hello", "num.attr": 42, "undef.attr": undefined }),
    ).not.toThrow();
    span.end();
  });

  it("getActiveSpan returns undefined when no span is active", () => {
    expect(getActiveSpan()).toBeUndefined();
  });
});
