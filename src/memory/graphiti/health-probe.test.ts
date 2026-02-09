import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isGraphitiAvailable,
  getGraphitiHealthStatus,
  startGraphitiHealthProbe,
  stopGraphitiHealthProbe,
} from "./health-probe.js";

// Mock the GraphitiClient
const mockHealth = vi.fn();
vi.mock("./client.js", () => {
  return {
    GraphitiClient: class MockGraphitiClient {
      health = mockHealth;
    },
  };
});

// Mock memLog to suppress output
vi.mock("../memory-log.js", () => ({
  memLog: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Graphiti health probe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockHealth.mockReset();
    stopGraphitiHealthProbe();
  });

  afterEach(() => {
    stopGraphitiHealthProbe();
    vi.useRealTimers();
  });

  it("does not start when graphiti is not enabled", () => {
    startGraphitiHealthProbe({ enabled: false });
    expect(isGraphitiAvailable()).toBe(true);
    expect(getGraphitiHealthStatus()).toBeNull();
  });

  it("does not start when config is undefined", () => {
    startGraphitiHealthProbe(undefined);
    expect(isGraphitiAvailable()).toBe(true);
    expect(getGraphitiHealthStatus()).toBeNull();
  });

  it("is optimistically available before any probe runs", () => {
    expect(isGraphitiAvailable()).toBe(true);
  });

  it("reports available after a successful health check", async () => {
    mockHealth.mockResolvedValueOnce({ ok: true, message: "healthy" });
    startGraphitiHealthProbe({ enabled: true });
    // Flush the initial fire-and-forget probe
    await vi.advanceTimersByTimeAsync(0);

    expect(isGraphitiAvailable()).toBe(true);
    const status = getGraphitiHealthStatus();
    expect(status).not.toBeNull();
    expect(status!.ok).toBe(true);
    expect(status!.consecutiveFailures).toBe(0);
  });

  it("stays available after fewer than 3 failures", async () => {
    mockHealth
      .mockResolvedValueOnce({ ok: false, message: "down" })
      .mockResolvedValueOnce({ ok: false, message: "down" });

    startGraphitiHealthProbe({
      enabled: true,
      healthProbeIntervalMinutes: 1,
    });

    // Initial probe (failure 1)
    await vi.advanceTimersByTimeAsync(0);
    expect(isGraphitiAvailable()).toBe(true);
    expect(getGraphitiHealthStatus()!.consecutiveFailures).toBe(1);

    // Interval tick (failure 2)
    await vi.advanceTimersByTimeAsync(60_000);
    expect(isGraphitiAvailable()).toBe(true);
    expect(getGraphitiHealthStatus()!.consecutiveFailures).toBe(2);
  });

  it("marks unavailable after 3 consecutive failures", async () => {
    mockHealth
      .mockResolvedValueOnce({ ok: false, message: "down" })
      .mockResolvedValueOnce({ ok: false, message: "down" })
      .mockResolvedValueOnce({ ok: false, message: "down" });

    startGraphitiHealthProbe({
      enabled: true,
      healthProbeIntervalMinutes: 1,
    });

    // Initial probe + 2 interval ticks = 3 failures
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(isGraphitiAvailable()).toBe(false);
    expect(getGraphitiHealthStatus()!.consecutiveFailures).toBe(3);
  });

  it("recovers after being marked unavailable", async () => {
    mockHealth
      .mockResolvedValueOnce({ ok: false, message: "down" })
      .mockResolvedValueOnce({ ok: false, message: "down" })
      .mockResolvedValueOnce({ ok: false, message: "down" })
      .mockResolvedValueOnce({ ok: true, message: "healthy" });

    startGraphitiHealthProbe({
      enabled: true,
      healthProbeIntervalMinutes: 1,
    });

    // 3 failures → unavailable
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(isGraphitiAvailable()).toBe(false);

    // Recovery
    await vi.advanceTimersByTimeAsync(60_000);
    expect(isGraphitiAvailable()).toBe(true);
    expect(getGraphitiHealthStatus()!.consecutiveFailures).toBe(0);
  });

  it("handles thrown errors the same as failed health checks", async () => {
    mockHealth
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));

    startGraphitiHealthProbe({
      enabled: true,
      healthProbeIntervalMinutes: 1,
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(isGraphitiAvailable()).toBe(false);
    const status = getGraphitiHealthStatus()!;
    expect(status.ok).toBe(false);
    expect(status.message).toContain("ECONNREFUSED");
  });

  it("resets state when stopped", async () => {
    mockHealth.mockResolvedValueOnce({ ok: false, message: "down" });
    startGraphitiHealthProbe({ enabled: true });
    await vi.advanceTimersByTimeAsync(0);

    expect(getGraphitiHealthStatus()).not.toBeNull();
    stopGraphitiHealthProbe();

    expect(isGraphitiAvailable()).toBe(true);
    expect(getGraphitiHealthStatus()).toBeNull();
  });

  it("ignores an in-flight probe result after stop", async () => {
    let resolveHealth: ((value: { ok: boolean; message: string }) => void) | undefined;
    mockHealth.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHealth = resolve;
        }),
    );

    startGraphitiHealthProbe({ enabled: true });
    await vi.advanceTimersByTimeAsync(0);

    stopGraphitiHealthProbe();
    expect(isGraphitiAvailable()).toBe(true);
    expect(getGraphitiHealthStatus()).toBeNull();

    resolveHealth?.({ ok: false, message: "stale failure" });
    await vi.advanceTimersByTimeAsync(0);

    expect(isGraphitiAvailable()).toBe(true);
    expect(getGraphitiHealthStatus()).toBeNull();
  });

  it("ignores stale in-flight probe results after restart", async () => {
    let resolveFirst: ((value: { ok: boolean; message: string }) => void) | undefined;
    mockHealth
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ ok: true, message: "healthy" });

    startGraphitiHealthProbe({ enabled: true });
    await vi.advanceTimersByTimeAsync(0);

    startGraphitiHealthProbe({ enabled: true });
    await vi.advanceTimersByTimeAsync(0);

    const freshStatus = getGraphitiHealthStatus();
    expect(freshStatus).not.toBeNull();
    expect(freshStatus!.ok).toBe(true);
    expect(freshStatus!.consecutiveFailures).toBe(0);

    resolveFirst?.({ ok: false, message: "stale failure" });
    await vi.advanceTimersByTimeAsync(0);

    const status = getGraphitiHealthStatus();
    expect(status).not.toBeNull();
    expect(status!.ok).toBe(true);
    expect(status!.consecutiveFailures).toBe(0);
    expect(isGraphitiAvailable()).toBe(true);
  });

  it("uses custom interval from config", async () => {
    mockHealth.mockResolvedValue({ ok: true, message: "healthy" });
    startGraphitiHealthProbe({
      enabled: true,
      healthProbeIntervalMinutes: 10,
    });

    // Initial probe
    await vi.advanceTimersByTimeAsync(0);
    expect(mockHealth).toHaveBeenCalledTimes(1);

    // Not yet at 10min mark
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(mockHealth).toHaveBeenCalledTimes(1);

    // At 10min mark
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(mockHealth).toHaveBeenCalledTimes(2);
  });
});
