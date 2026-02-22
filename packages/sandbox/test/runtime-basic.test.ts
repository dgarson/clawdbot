/**
 * Runtime Basic Tests - Simplified
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLocalSandbox } from "../src/runtime.js";

describe("LocalSandboxRuntime Basic", () => {
  let runtime: ReturnType<typeof createLocalSandbox>;

  beforeEach(() => {
    runtime = createLocalSandbox({
      rootDir: "/tmp/test-sandbox",
    });
  });

  afterEach(async () => {
    try {
      await runtime.close();
    } catch {}
  });

  describe("initial state", () => {
    it("should start in idle state", async () => {
      const status = await runtime.status();
      expect(status.state).toBe("idle");
    });

    it("should have zero execution count", async () => {
      const status = await runtime.status();
      expect(status.executionCount).toBe(0);
    });
  });

  describe("getState()", () => {
    it("should return current state", () => {
      expect(runtime.getState()).toBe("idle");
    });
  });

  describe("stop()", () => {
    it("should be idempotent when already idle", async () => {
      await runtime.stop(); // Should not throw
      const status = await runtime.status();
      expect(status.state).toBe("idle");
    });
  });
});
