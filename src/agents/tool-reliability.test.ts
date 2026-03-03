import { describe, it, expect, vi } from "vitest";
import { CircuitBreaker, IdempotencyGuard } from "./tool-reliability.js";

describe("CircuitBreaker", () => {
  it("should open after max failures and prevent execution", async () => {
    const cb = new CircuitBreaker("test", { maxFailures: 2, resetTimeoutMs: 1000 });
    let attempts = 0;

    const failingAction = async () => {
      attempts++;
      throw new Error("fail");
    };

    await expect(cb.execute(failingAction)).rejects.toThrow("fail");
    await expect(cb.execute(failingAction)).rejects.toThrow("fail");
    expect(attempts).toBe(2);

    // Third attempt should be blocked
    await expect(cb.execute(failingAction)).rejects.toThrow("CircuitBreaker [test] is OPEN");
    expect(attempts).toBe(2); // no new execution
  });

  it("should recover after reset timeout", async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker("test-recover", { maxFailures: 1, resetTimeoutMs: 1000 });

    await expect(
      cb.execute(async () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");

    // Attempt blocked immediately
    await expect(cb.execute(async () => "ok")).rejects.toThrow(
      "CircuitBreaker [test-recover] is OPEN",
    );

    // Advance time past reset timeout
    vi.advanceTimersByTime(1100);

    // It should now allow a call (HALF_OPEN -> CLOSED on success)
    const result = await cb.execute(async () => "recovered");
    expect(result).toBe("recovered");

    vi.useRealTimers();
  });
});

describe("IdempotencyGuard", () => {
  it("should cache successful responses", async () => {
    const guard = new IdempotencyGuard({ ttlMs: 1000 });
    let calls = 0;

    const action = async () => {
      calls++;
      return "result";
    };

    const first = await guard.execute("key1", action);
    const second = await guard.execute("key1", action);

    expect(first).toBe("result");
    expect(second).toBe("result");
    expect(calls).toBe(1); // Cached
  });

  it("should expire cache entries after TTL", async () => {
    vi.useFakeTimers();
    const guard = new IdempotencyGuard({ ttlMs: 1000 });
    let calls = 0;

    const action = async () => {
      calls++;
      return "result";
    };

    await guard.execute("key1", action);
    expect(calls).toBe(1);

    vi.advanceTimersByTime(1500);

    await guard.execute("key1", action);
    expect(calls).toBe(2); // Retried after TTL

    vi.useRealTimers();
  });
});
