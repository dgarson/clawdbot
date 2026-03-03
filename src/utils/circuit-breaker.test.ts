import { describe, expect, it } from "vitest";
import { CircuitBreaker } from "./circuit-breaker.js";

describe("CircuitBreaker", () => {
  it("transitions CLOSED -> OPEN after threshold failures", async () => {
    let now = 0;
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 100,
      now: () => now,
    });

    await expect(breaker.execute(async () => Promise.reject(new Error("fail-1")))).rejects.toThrow(
      "fail-1",
    );
    expect(breaker.getState()).toBe("CLOSED");

    await expect(breaker.execute(async () => Promise.reject(new Error("fail-2")))).rejects.toThrow(
      "fail-2",
    );
    expect(breaker.getState()).toBe("OPEN");

    await expect(breaker.execute(async () => "blocked")).rejects.toThrow("CircuitBreaker is OPEN");

    now += 101;
    await expect(breaker.execute(async () => "recovered")).resolves.toBe("recovered");
    expect(breaker.getState()).toBe("CLOSED");
  });

  it("reopens from HALF_OPEN when the trial call fails", async () => {
    let now = 0;
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 50,
      now: () => now,
    });

    await expect(
      breaker.execute(async () => Promise.reject(new Error("initial-failure"))),
    ).rejects.toThrow("initial-failure");
    expect(breaker.getState()).toBe("OPEN");

    now += 51;

    await expect(
      breaker.execute(async () => Promise.reject(new Error("trial-failure"))),
    ).rejects.toThrow("trial-failure");
    expect(breaker.getState()).toBe("OPEN");
  });
});
