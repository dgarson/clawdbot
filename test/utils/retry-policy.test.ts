import { describe, expect, it, vi } from "vitest";
import { RetryPolicy } from "../../src/utils/retry-policy.js";

describe("RetryPolicy", () => {
  it("retries retriable timeout errors and eventually succeeds", async () => {
    const sleep = vi.fn(async () => {});

    let attempts = 0;
    const policy = new RetryPolicy({
      maxRetries: 3,
      initialDelayMs: 500,
      maxDelayMs: 5_000,
      random: () => 0.5,
      sleep,
      isRetriableError: (error) =>
        error instanceof Error && error.message.toLowerCase().includes("timeout"),
    });

    const result = await policy.execute(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("request timeout");
      }
      return "ok";
    });

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 500);
    expect(sleep).toHaveBeenNthCalledWith(2, 1_000);
  });

  it("fails immediately for non-retriable 400 errors", async () => {
    const sleep = vi.fn(async () => {});
    const error400 = Object.assign(new Error("bad request"), { status: 400 });

    const policy = new RetryPolicy({
      sleep,
      isRetriableError: (error) => {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? (error as { status?: number }).status
            : undefined;
        return typeof status === "number" && status >= 500;
      },
    });

    await expect(
      policy.execute(async () => {
        throw error400;
      }),
    ).rejects.toBe(error400);

    expect(sleep).not.toHaveBeenCalled();
  });
});
