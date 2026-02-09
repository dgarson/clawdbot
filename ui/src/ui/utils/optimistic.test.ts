import { describe, it, expect, vi } from "vitest";
import { optimistic, snapshot } from "./optimistic.ts";

describe("snapshot", () => {
  it("shallow-copies arrays", () => {
    const arr = [1, 2, 3];
    const copy = snapshot(arr);
    expect(copy).toEqual([1, 2, 3]);
    expect(copy).not.toBe(arr);
    arr.push(4);
    expect(copy).toHaveLength(3);
  });

  it("shallow-copies objects", () => {
    const obj = { a: 1, b: "two" };
    const copy = snapshot(obj);
    expect(copy).toEqual({ a: 1, b: "two" });
    expect(copy).not.toBe(obj);
    obj.a = 99;
    expect(copy.a).toBe(1);
  });

  it("returns primitives as-is", () => {
    expect(snapshot(42)).toBe(42);
    expect(snapshot("hello")).toBe("hello");
    expect(snapshot(null)).toBe(null);
    expect(snapshot(undefined)).toBe(undefined);
    expect(snapshot(true)).toBe(true);
  });
});

describe("optimistic", () => {
  it("applies change, calls mutate, and returns result on success", async () => {
    let value = "original";
    const result = await optimistic({
      apply() {
        value = "optimistic";
      },
      rollback() {
        value = "original";
      },
      mutate: async () => {
        expect(value).toBe("optimistic");
        return "server-result";
      },
    });

    expect(result).toBe("server-result");
    expect(value).toBe("optimistic");
  });

  it("rolls back on mutate failure", async () => {
    let value = "original";
    const result = await optimistic({
      apply() {
        value = "optimistic";
      },
      rollback() {
        value = "original";
      },
      mutate: async () => {
        throw new Error("API failed");
      },
      toastError: false,
    });

    expect(result).toBeUndefined();
    expect(value).toBe("original");
  });

  it("calls refresh on success", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    await optimistic({
      apply() {},
      rollback() {},
      mutate: async () => "ok",
      refresh,
    });

    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not call refresh on failure", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    await optimistic({
      apply() {},
      rollback() {},
      mutate: async () => {
        throw new Error("fail");
      },
      refresh,
      toastError: false,
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it("handles refresh failure gracefully (non-critical)", async () => {
    let value = "changed";
    await optimistic({
      apply() {
        value = "optimistic";
      },
      rollback() {
        value = "original";
      },
      mutate: async () => "ok",
      refresh: async () => {
        throw new Error("refresh failed");
      },
    });

    // Value should still be the optimistic one — refresh failure is non-critical
    expect(value).toBe("optimistic");
  });

  it("calls onError callback on failure", async () => {
    const onError = vi.fn();
    const error = new Error("test error");
    await optimistic({
      apply() {},
      rollback() {},
      mutate: async () => {
        throw error;
      },
      onError,
      toastError: false,
    });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it("preserves apply order: apply runs before mutate", async () => {
    const order: string[] = [];
    await optimistic({
      apply() {
        order.push("apply");
      },
      rollback() {
        order.push("rollback");
      },
      mutate: async () => {
        order.push("mutate");
        return "ok";
      },
    });

    expect(order).toEqual(["apply", "mutate"]);
  });

  it("returns undefined when mutate throws (not the error)", async () => {
    const result = await optimistic({
      apply() {},
      rollback() {},
      mutate: async () => {
        throw new Error("boom");
      },
      toastError: false,
    });

    expect(result).toBeUndefined();
  });
});
