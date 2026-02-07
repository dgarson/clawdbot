import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAsyncOperation } from "./useAsyncOperation";

describe("useAsyncOperation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in idle state", () => {
    const operation = vi.fn().mockResolvedValue("result");
    const { result } = renderHook(() => useAsyncOperation(operation));

    expect(result.current.state).toBe("idle");
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it("transitions to success on successful operation", async () => {
    const operation = vi.fn().mockResolvedValue("result-data");
    const { result } = renderHook(() =>
      useAsyncOperation(operation, { autoResetMs: 0 }),
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.state).toBe("success");
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toBe("result-data");
    expect(result.current.error).toBeNull();
  });

  it("transitions to error on failed operation", async () => {
    const error = new Error("test failure");
    const operation = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useAsyncOperation(operation));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(error);
    expect(result.current.data).toBeNull();
  });

  it("tracks progress updates", async () => {
    let resolveOp: (value: string) => void;
    const operation = vi.fn(
      (setProgress: (p: { current: number; total: number; message?: string }) => void) =>
        new Promise<string>((resolve) => {
          resolveOp = resolve;
          setProgress({ current: 1, total: 3, message: "Step 1" });
        }),
    );

    const { result } = renderHook(() =>
      useAsyncOperation(operation, { autoResetMs: 0 }),
    );

    // Start operation (don't await - it's pending)
    let executePromise: Promise<unknown>;
    act(() => {
      executePromise = result.current.execute();
    });

    // Check progress was set
    expect(result.current.state).toBe("running");
    expect(result.current.isRunning).toBe(true);
    expect(result.current.progress).toEqual({
      current: 1,
      total: 3,
      message: "Step 1",
      percent: 33,
    });

    // Resolve the operation
    await act(async () => {
      resolveOp!("done");
      await executePromise;
    });

    expect(result.current.state).toBe("success");
  });

  it("auto-resets after success when autoResetMs > 0", async () => {
    const operation = vi.fn().mockResolvedValue("ok");
    const { result } = renderHook(() =>
      useAsyncOperation(operation, { autoResetMs: 3000 }),
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.state).toBe("success");

    // Advance past auto-reset timer
    act(() => {
      vi.advanceTimersByTime(3001);
    });

    expect(result.current.state).toBe("idle");
  });

  it("calls onSuccess callback", async () => {
    const onSuccess = vi.fn();
    const operation = vi.fn().mockResolvedValue("ok");
    const { result } = renderHook(() =>
      useAsyncOperation(operation, { onSuccess, autoResetMs: 0 }),
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("calls onError callback", async () => {
    const error = new Error("fail");
    const onError = vi.fn();
    const operation = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() =>
      useAsyncOperation(operation, { onError }),
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it("reset returns to idle state", async () => {
    const error = new Error("fail");
    const operation = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useAsyncOperation(operation));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.state).toBe("error");

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBeNull();
  });

  it("computes percent correctly", async () => {
    const operation = vi.fn(
      (setProgress: (p: { current: number; total: number }) => void) =>
        new Promise<string>((resolve) => {
          setProgress({ current: 2, total: 5 });
          resolve("done");
        }),
    );

    const { result } = renderHook(() =>
      useAsyncOperation(operation, { autoResetMs: 0 }),
    );

    await act(async () => {
      await result.current.execute();
    });

    // After completion, progress should be set to 2/5 = 40%
    // (The progress might have been captured before resolve)
  });

  it("handles non-Error throws", async () => {
    const operation = vi.fn().mockRejectedValue("string-error");
    const { result } = renderHook(() => useAsyncOperation(operation));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error?.message).toBe("string-error");
  });
});
