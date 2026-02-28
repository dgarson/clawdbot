import { describe, expect, it } from "vitest";
import { isInCleanupHookScope, runInCleanupHookScope } from "./cleanup-hook-gate.js";

describe("isInCleanupHookScope", () => {
  it("returns false outside any scope", () => {
    expect(isInCleanupHookScope()).toBe(false);
  });

  it("returns true inside runInCleanupHookScope", async () => {
    let inside = false;
    await runInCleanupHookScope(async () => {
      inside = isInCleanupHookScope();
    });
    expect(inside).toBe(true);
  });

  it("returns false after scope resolves", async () => {
    await runInCleanupHookScope(async () => {
      // inside scope
    });
    expect(isInCleanupHookScope()).toBe(false);
  });

  it("returns false after scope rejects", async () => {
    await runInCleanupHookScope(async () => {
      throw new Error("boom");
    }).catch(() => {
      // swallow
    });
    expect(isInCleanupHookScope()).toBe(false);
  });

  it("propagates the return value from fn", async () => {
    const result = await runInCleanupHookScope(async () => 42);
    expect(result).toBe(42);
  });

  it("propagates errors from fn", async () => {
    const err = new Error("test error");
    await expect(
      runInCleanupHookScope(async () => {
        throw err;
      }),
    ).rejects.toThrow("test error");
  });
});
