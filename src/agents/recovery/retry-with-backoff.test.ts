import { describe, expect, it, vi } from "vitest";
import {
  classifyRetryFailure,
  isTransientRetryFailure,
  retryWithBackoff,
} from "./retry-with-backoff.js";

describe("retry-with-backoff", () => {
  it("classifies common transient failures", () => {
    expect(classifyRetryFailure({ status: 429 })).toBe("rate_limit");
    expect(classifyRetryFailure({ code: "ENOTFOUND" })).toBe("network");
    expect(classifyRetryFailure({ code: "ETIMEDOUT" })).toBe("timeout");
    expect(classifyRetryFailure({ status: 503 })).toBe("server");
  });

  it("marks transient failures as retryable", () => {
    expect(isTransientRetryFailure({ status: 429 })).toBe(true);
    expect(isTransientRetryFailure({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientRetryFailure({ message: "request timed out" })).toBe(true);
    expect(isTransientRetryFailure({ message: "syntax error" })).toBe(false);
  });

  it("retries with exponential backoff and jitter", async () => {
    const sleepCalls: number[] = [];
    const retryEvents: Array<{ attempt: number; delayMs: number }> = [];
    let attempts = 0;

    const result = await retryWithBackoff({
      maxRetries: 2,
      initialDelayMs: 100,
      backoffMultiplier: 2,
      jitterRatio: 0.5,
      random: () => 1,
      sleep: async (delayMs) => {
        sleepCalls.push(delayMs);
      },
      onRetry: async (event) => {
        retryEvents.push({ attempt: event.attempt, delayMs: event.delayMs });
      },
      execute: async () => {
        attempts += 1;
        if (attempts < 3) {
          const error = new Error("rate limit");
          Object.assign(error, { status: 429 });
          throw error;
        }
        return "ok";
      },
    });

    expect(result.value).toBe("ok");
    expect(result.attempts).toBe(3);
    expect(sleepCalls).toEqual([150, 300]);
    expect(result.totalDelayMs).toBe(450);
    expect(retryEvents).toEqual([
      { attempt: 1, delayMs: 150 },
      { attempt: 2, delayMs: 300 },
    ]);
  });

  it("does not retry unknown failures by default", async () => {
    const execute = vi.fn(async () => {
      throw new Error("validation failed");
    });

    await expect(
      retryWithBackoff({
        maxRetries: 4,
        execute,
      }),
    ).rejects.toThrow("validation failed");

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("supports custom retry policy", async () => {
    let attempts = 0;

    const result = await retryWithBackoff({
      maxRetries: 3,
      sleep: async () => undefined,
      shouldRetry: () => true,
      execute: async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("non transient");
        }
        return 42;
      },
    });

    expect(result.value).toBe(42);
    expect(result.attempts).toBe(2);
  });
});
