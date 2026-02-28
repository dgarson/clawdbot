import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPluginCronScheduler, shutdownAllCronJobs } from "./cron.js";

describe("plugin cron scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    shutdownAllCronJobs();
    vi.useRealTimers();
  });

  it("schedule fires handler at interval", () => {
    const cron = createPluginCronScheduler("test-fire");
    const handler = vi.fn();

    cron.schedule("job1", 1000, handler);

    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(handler).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(handler).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(3000);
    expect(handler).toHaveBeenCalledTimes(5);
  });

  it("cancel stops the timer", () => {
    const cron = createPluginCronScheduler("test-cancel");
    const handler = vi.fn();

    cron.schedule("job1", 500, handler);

    vi.advanceTimersByTime(1000);
    expect(handler).toHaveBeenCalledTimes(2);

    cron.cancel("job1");

    vi.advanceTimersByTime(2000);
    // Count should not increase after cancel.
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("list returns scheduled ids", () => {
    const cron = createPluginCronScheduler("test-list");

    expect(cron.list()).toEqual([]);

    cron.schedule("alpha", 1000, () => {});
    cron.schedule("beta", 2000, () => {});

    expect(cron.list().toSorted()).toEqual(["alpha", "beta"]);
  });

  it("re-scheduling same id replaces previous timer", () => {
    const cron = createPluginCronScheduler("test-replace");
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    cron.schedule("job", 1000, handler1);

    vi.advanceTimersByTime(1000);
    expect(handler1).toHaveBeenCalledTimes(1);

    // Replace with handler2 at a different interval.
    cron.schedule("job", 2000, handler2);

    // Advance 2s: handler1 should not fire again, handler2 fires once.
    vi.advanceTimersByTime(2000);
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    // Only one id in the list.
    expect(cron.list()).toEqual(["job"]);
  });

  it("shutdownAllCronJobs clears all timers across all plugins", () => {
    const cronA = createPluginCronScheduler("plugin-a");
    const cronB = createPluginCronScheduler("plugin-b");
    const handlerA = vi.fn();
    const handlerB = vi.fn();

    cronA.schedule("jobA", 1000, handlerA);
    cronB.schedule("jobB", 1000, handlerB);

    vi.advanceTimersByTime(1000);
    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);

    shutdownAllCronJobs();

    vi.advanceTimersByTime(5000);
    // No further invocations.
    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);

    // Lists are empty after shutdown.
    expect(cronA.list()).toEqual([]);
    expect(cronB.list()).toEqual([]);
  });

  it("handler errors are caught (sync throw)", () => {
    const cron = createPluginCronScheduler("test-sync-err");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    cron.schedule("bad-job", 1000, () => {
      throw new Error("sync boom");
    });

    // Should not throw / crash the process.
    vi.advanceTimersByTime(1000);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("sync boom"));
    warnSpy.mockRestore();
  });

  it("async handler rejection is caught", async () => {
    const cron = createPluginCronScheduler("test-async-err");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    cron.schedule("async-bad", 1000, async () => {
      throw new Error("async boom");
    });

    // Advance timer so the handler fires.
    vi.advanceTimersByTime(1000);

    // Flush microtask queue so the Promise rejection handler runs.
    await vi.advanceTimersByTimeAsync(0);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("async boom"));
    warnSpy.mockRestore();
  });
});
