/**
 * UTEE Phase 1 Adapter Tests
 *
 * Tests for the Unified Tool Execution Envelope observability layer.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  disableUtee,
  enableUtee,
  isUteeEnabled,
  createUteeRequestMeta,
  createUteeResponseMeta,
  wrapExecuteWithUtee,
  getUteeMetricsSnapshot,
  resetUteeMetrics,
  getCurrentUteeContext,
  runWithUteeContext,
  __testing,
} from "./utee-adapter.js";

describe("UTEE Phase 1 Adapter", () => {
  beforeEach(() => {
    resetUteeMetrics();
    disableUtee();
  });

  afterEach(() => {
    resetUteeMetrics();
    disableUtee();
  });

  describe("Feature Flag", () => {
    it("should start disabled", () => {
      expect(isUteeEnabled()).toBe(false);
    });

    it("should enable UTEE", () => {
      enableUtee();
      expect(isUteeEnabled()).toBe(true);
    });

    it("should disable UTEE", () => {
      enableUtee();
      disableUtee();
      expect(isUteeEnabled()).toBe(false);
    });

    it("should toggle via setUteeEnabled", async () => {
      const { setUteeEnabled } = await import("./utee-adapter.js");
      setUteeEnabled(true);
      expect(isUteeEnabled()).toBe(true);
      setUteeEnabled(false);
      expect(isUteeEnabled()).toBe(false);
    });
  });

  describe("ID Generation", () => {
    it("should generate valid UUID v4", () => {
      const uuid = __testing.generateUuid();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("should generate unique UUIDs", () => {
      const uuids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        uuids.add(__testing.generateUuid());
      }
      expect(uuids.size).toBe(100);
    });

    it("should generate valid span IDs", () => {
      const spanId = __testing.generateSpanId();
      expect(spanId).toMatch(/^[0-9a-f]{8}$/i);
    });

    it("should generate valid trace IDs", () => {
      const traceId = __testing.generateTraceId();
      // 16 bytes = 32 hex characters (W3C-compatible trace ID format)
      expect(traceId).toMatch(/^[0-9a-f]{32}$/i);
    });
  });

  describe("Request/Response Metadata", () => {
    it("should create request metadata with all required fields", () => {
      const meta = createUteeRequestMeta();
      expect(meta.requestId).toBeDefined();
      expect(meta.traceId).toBeDefined();
      expect(meta.spanId).toBeDefined();
      expect(meta.startTime).toBeDefined();
    });

    it("should create response metadata", () => {
      const requestMeta = createUteeRequestMeta();
      const responseMeta = createUteeResponseMeta(requestMeta, 100, "success");
      expect(responseMeta.requestId).toBe(requestMeta.requestId);
      expect(responseMeta.traceId).toBe(requestMeta.traceId);
      expect(responseMeta.spanId).toBe(requestMeta.spanId);
      expect(responseMeta.durationMs).toBe(100);
      expect(responseMeta.status).toBe("success");
    });

    it("should support error status in response", () => {
      const requestMeta = createUteeRequestMeta();
      const responseMeta = createUteeResponseMeta(requestMeta, 50, "error");
      expect(responseMeta.status).toBe("error");
    });
  });

  describe("Context Propagation", () => {
    it("should return undefined when no context is set", () => {
      expect(getCurrentUteeContext()).toBeUndefined();
    });

    it("should propagate context within runWithUteeContext", () => {
      const meta = createUteeRequestMeta();
      const ctx = { utee: meta };

      runWithUteeContext(ctx, () => {
        const currentCtx = getCurrentUteeContext();
        expect(currentCtx).toBeDefined();
        expect(currentCtx?.utee.requestId).toBe(meta.requestId);
        expect(currentCtx?.utee.traceId).toBe(meta.traceId);
      });
    });

    it("should not leak context outside runWithUteeContext", () => {
      const meta = createUteeRequestMeta();
      const ctx = { utee: meta };

      runWithUteeContext(ctx, () => {
        // Context is available inside
      });

      // Context should not be available outside
      expect(getCurrentUteeContext()).toBeUndefined();
    });

    it("should inherit trace ID from parent context", () => {
      const parentMeta = createUteeRequestMeta();
      const parentCtx = { utee: parentMeta };

      runWithUteeContext(parentCtx, () => {
        const childMeta = createUteeRequestMeta(getCurrentUteeContext());
        expect(childMeta.traceId).toBe(parentMeta.traceId);
        expect(childMeta.parentSpanId).toBe(parentMeta.spanId);
        expect(childMeta.spanId).not.toBe(parentMeta.spanId);
      });
    });
  });

  describe("wrapExecuteWithUtee", () => {
    it("should pass through when UTEE is disabled", async () => {
      const originalExecute = async (...args: unknown[]) => {
        const x = args[0] as number;
        return x * 2;
      };
      const wrappedExecute = wrapExecuteWithUtee("test-tool", originalExecute);

      const result = await wrappedExecute(5);
      expect(result).toBe(10);

      // No metrics should be recorded when disabled
      const metrics = getUteeMetricsSnapshot();
      expect(Object.keys(metrics.invocationCount)).toHaveLength(0);
    });

    it("should wrap execution when UTEE is enabled", async () => {
      enableUtee();

      const originalExecute = async (...args: unknown[]) => {
        const x = args[0] as number;
        return x * 2;
      };
      const wrappedExecute = wrapExecuteWithUtee("test-tool", originalExecute);

      const result = await wrappedExecute(5);
      expect(result).toBe(10);

      // Metrics should be recorded when enabled
      const metrics = getUteeMetricsSnapshot();
      expect(metrics.invocationCount["test-tool"]).toBe(1);
      expect(metrics.avgDurationMs["test-tool"]).toBeGreaterThanOrEqual(0);
    });

    it("should record errors in metrics", async () => {
      enableUtee();

      const originalExecute = async () => {
        throw new Error("Test error");
      };
      const wrappedExecute = wrapExecuteWithUtee("error-tool", originalExecute);

      await expect(wrappedExecute()).rejects.toThrow("Test error");

      const metrics = getUteeMetricsSnapshot();
      expect(metrics.invocationCount["error-tool"]).toBe(1);
      expect(metrics.errorCount["error-tool"]).toBe(1);
    });

    it("should preserve original error when wrapping", async () => {
      enableUtee();

      const originalError = new Error("Original error");
      const originalExecute = async () => {
        throw originalError;
      };
      const wrappedExecute = wrapExecuteWithUtee("error-tool", originalExecute);

      try {
        await wrappedExecute();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBe(originalError);
      }
    });

    it("should not change result when wrapping", async () => {
      enableUtee();

      const originalResult = { status: "success", data: [1, 2, 3] };
      const originalExecute = async () => originalResult;
      const wrappedExecute = wrapExecuteWithUtee("result-tool", originalExecute);

      const result = await wrappedExecute();
      expect(result).toBe(originalResult);
    });

    it("should normalize tool names for metrics", async () => {
      enableUtee();

      const originalExecute = async () => "ok";
      const wrappedExecute = wrapExecuteWithUtee("  MyTool  ", originalExecute);

      await wrappedExecute();

      const metrics = getUteeMetricsSnapshot();
      expect(metrics.invocationCount["mytool"]).toBe(1);
    });
  });

  describe("Metrics", () => {
    it("should track invocation counts", async () => {
      enableUtee();

      const execute = async () => "ok";
      const wrapped = wrapExecuteWithUtee("counter-tool", execute);

      await wrapped();
      await wrapped();
      await wrapped();

      const metrics = getUteeMetricsSnapshot();
      expect(metrics.invocationCount["counter-tool"]).toBe(3);
    });

    it("should track max duration", async () => {
      enableUtee();

      const execute = async (...args: unknown[]) => {
        const delay = args[0] as number;
        await new Promise((r) => setTimeout(r, delay));
        return "ok";
      };
      const wrapped = wrapExecuteWithUtee("slow-tool", execute);

      await wrapped(5);
      await wrapped(15);
      await wrapped(10);

      const metrics = getUteeMetricsSnapshot();
      expect(metrics.maxDurationMs["slow-tool"]).toBeGreaterThanOrEqual(15);
    });

    it("should reset metrics", async () => {
      enableUtee();

      const execute = async () => "ok";
      const wrapped = wrapExecuteWithUtee("reset-tool", execute);
      await wrapped();

      expect(getUteeMetricsSnapshot().invocationCount["reset-tool"]).toBe(1);

      resetUteeMetrics();

      expect(Object.keys(getUteeMetricsSnapshot().invocationCount)).toHaveLength(0);
    });
  });

  describe("Rollback", () => {
    it("should be able to disable during runtime", async () => {
      enableUtee();

      const execute = async () => "ok";
      const wrapped = wrapExecuteWithUtee("toggle-tool", execute);

      await wrapped();
      expect(getUteeMetricsSnapshot().invocationCount["toggle-tool"]).toBe(1);

      disableUtee();
      resetUteeMetrics();

      await wrapped();
      expect(Object.keys(getUteeMetricsSnapshot().invocationCount)).toHaveLength(0);
    });

    it("should add minimal overhead when enabled (<1ms per call)", async () => {
      enableUtee();

      const execute = async () => "ok";
      const wrapped = wrapExecuteWithUtee("perf-tool", execute);

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        await wrapped();
      }
      const duration = performance.now() - start;

      // Average overhead should be <1ms per call
      const avgMs = duration / 1000;
      expect(avgMs).toBeLessThan(1);
    });
  });
});
