import { afterEach, describe, expect, it, vi } from "vitest";
import { RetryQueue } from "./retry-queue.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("RetryQueue", () => {
  it("runs a task once when it succeeds", async () => {
    const runner = vi.fn(async () => ({ success: true }));
    const queue = new RetryQueue(runner, { jitterFactor: 0 });
    const result = queue.enqueue("k1", { id: 1 });

    expect(result.enqueued).toBe(true);
    await vi.waitFor(() => {
      expect(runner).toHaveBeenCalledTimes(1);
    });
    expect(queue.getState().pendingKeys).toBe(0);
  });

  it("deduplicates pending keys", async () => {
    vi.useFakeTimers();
    const runner = vi.fn(async () => ({ success: true }));
    const queue = new RetryQueue(runner, { jitterFactor: 0 });

    const first = queue.enqueue("same", { id: 1 });
    const second = queue.enqueue("same", { id: 2 });
    expect(first.enqueued).toBe(true);
    expect(second.enqueued).toBe(true);
    expect(second.duplicate).toBe(true);

    await vi.runAllTimersAsync();
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("retries retryable failures until success", async () => {
    vi.useFakeTimers();
    const runner = vi
      .fn<() => Promise<{ success: boolean; retryable?: boolean }>>()
      .mockResolvedValueOnce({ success: false, retryable: true })
      .mockResolvedValueOnce({ success: false, retryable: true })
      .mockResolvedValueOnce({ success: true });

    const queue = new RetryQueue(runner, {
      baseBackoffMs: 10,
      maxBackoffMs: 20,
      maxAttempts: 4,
      jitterFactor: 0,
    });

    queue.enqueue("retry", { id: 1 });
    await vi.runAllTimersAsync();

    expect(runner).toHaveBeenCalledTimes(3);
    expect(queue.getState().pendingKeys).toBe(0);
  });

  it("does not retry when failure is non-retryable", async () => {
    vi.useFakeTimers();
    const runner = vi.fn(async () => ({ success: false, retryable: false }));
    const queue = new RetryQueue(runner, {
      baseBackoffMs: 5,
      maxAttempts: 5,
      jitterFactor: 0,
    });

    queue.enqueue("no-retry", { id: 1 });
    await vi.runAllTimersAsync();

    expect(runner).toHaveBeenCalledTimes(1);
    expect(queue.getState().pendingKeys).toBe(0);
  });

  it("returns queue_full when bounded queue is saturated", () => {
    const runner = vi.fn(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          setTimeout(() => resolve({ success: true }), 1000);
        }),
    );
    const queue = new RetryQueue(runner, {
      concurrency: 1,
      maxQueueSize: 1,
      jitterFactor: 0,
    });

    const a = queue.enqueue("a", { id: 1 });
    const b = queue.enqueue("b", { id: 2 });
    const c = queue.enqueue("c", { id: 3 });

    expect(a.enqueued).toBe(true);
    expect(b.enqueued).toBe(true);
    expect(c.enqueued).toBe(false);
    expect(c.reason).toBe("queue_full");
  });
});
