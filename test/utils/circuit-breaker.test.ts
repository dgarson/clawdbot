import { afterEach, describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "../../src/utils/circuit-breaker.js";

describe("CircuitBreaker", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens after reaching failure threshold and blocks while open", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1_000 });

    await expect(breaker.execute(async () => Promise.reject(new Error("boom-1")))).rejects.toThrow(
      "boom-1",
    );
    expect(breaker.getState()).toBe("CLOSED");

    await expect(breaker.execute(async () => Promise.reject(new Error("boom-2")))).rejects.toThrow(
      "boom-2",
    );
    expect(breaker.getState()).toBe("OPEN");

    await expect(breaker.execute(async () => "ok")).rejects.toThrow("CircuitBreaker is OPEN");
  });

  it("transitions to HALF_OPEN after timeout and allows only one trial", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1_000 });
    await expect(breaker.execute(async () => Promise.reject(new Error("fail")))).rejects.toThrow(
      "fail",
    );

    vi.setSystemTime(1_000);

    let resolveTrial: ((value: string) => void) | undefined;
    const firstTrial = breaker.execute(
      () =>
        new Promise<string>((resolve) => {
          resolveTrial = resolve;
        }),
    );

    expect(breaker.getState()).toBe("HALF_OPEN");

    await expect(breaker.execute(async () => "second")).rejects.toThrow(
      "CircuitBreaker is HALF_OPEN (trial in progress)",
    );

    resolveTrial?.("recovered");
    await expect(firstTrial).resolves.toBe("recovered");
    expect(breaker.getState()).toBe("CLOSED");
  });

  it("re-opens if the HALF_OPEN trial fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1_000 });

    await expect(
      breaker.execute(async () => Promise.reject(new Error("initial-fail"))),
    ).rejects.toThrow("initial-fail");
    expect(breaker.getState()).toBe("OPEN");

    vi.setSystemTime(1_000);

    await expect(
      breaker.execute(async () => Promise.reject(new Error("half-open-fail"))),
    ).rejects.toThrow("half-open-fail");

    expect(breaker.getState()).toBe("OPEN");
    await expect(breaker.execute(async () => "blocked")).rejects.toThrow("CircuitBreaker is OPEN");
  });
});
