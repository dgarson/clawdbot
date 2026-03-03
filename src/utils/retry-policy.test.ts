import { describe, expect, it, vi } from "vitest";
import { RetryPolicy } from "./retry-policy.js";

describe("RetryPolicy", () => {
  it("keeps jitter within +/-20% bounds", async () => {
    const sleeps: number[] = [];
    const errors = [new Error("fail-0"), new Error("fail-1"), new Error("fail-2")];

    const runner = new RetryPolicy({
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 1_000,
      random: vi
        .fn<() => number>()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(1),
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
      isRetriableError: () => true,
    });

    let attempts = 0;
    await expect(
      runner.execute(async () => {
        if (attempts < errors.length) {
          throw errors[attempts++];
        }
        return "ok";
      }),
    ).resolves.toBe("ok");

    // attempt 0: base 100ms with -20% jitter => 80ms
    // attempt 1: base 200ms with 0% jitter => 200ms
    // attempt 2: base 400ms with +20% jitter => 480ms
    expect(sleeps).toEqual([80, 200, 480]);
  });

  it("clamps exponential delays to maxDelay before jitter", async () => {
    const sleeps: number[] = [];

    const runner = new RetryPolicy({
      maxRetries: 2,
      initialDelayMs: 100,
      maxDelayMs: 150,
      random: () => 1,
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
    });

    let attempts = 0;
    await expect(
      runner.execute(async () => {
        attempts += 1;
        throw new Error(`fail-${attempts}`);
      }),
    ).rejects.toThrow("fail-3");

    // Retry #1: 100ms +20% => 120ms; Retry #2: capped to 150ms +20% => 180ms.
    expect(sleeps).toEqual([120, 180]);
  });
});
