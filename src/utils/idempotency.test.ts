import { describe, expect, it } from "vitest";
import {
  createIdempotencyKey,
  IDEMPOTENCY_STATE,
  InMemoryIdempotencyStore,
} from "./idempotency.js";

describe("InMemoryIdempotencyStore", () => {
  it("dedupes duplicate concurrent work under the same key", async () => {
    const store = new InMemoryIdempotencyStore<string>();
    const key = createIdempotencyKey({ prefix: "test", parts: ["concurrent"] });

    let runs = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = store.run(key, async () => {
      runs += 1;
      await gate;
      return "ok";
    });

    const pendingEntry = store.get(key);
    expect(pendingEntry?.state).toBe(IDEMPOTENCY_STATE.PENDING);

    const second = store.run(key, async () => {
      runs += 1;
      return "should-not-run";
    });

    release?.();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual({ value: "ok", source: "executed" });
    expect(secondResult).toEqual({ value: "ok", source: "pending" });
    expect(runs).toBe(1);
    expect(store.get(key)?.state).toBe(IDEMPOTENCY_STATE.COMPLETED);
  });

  it("returns completed cached value for sequential duplicate calls", async () => {
    const store = new InMemoryIdempotencyStore<string>();
    const key = createIdempotencyKey({ prefix: "test", parts: ["sequential"] });

    let runs = 0;

    const first = await store.run(key, async () => {
      runs += 1;
      return "cached";
    });

    const second = await store.run(key, async () => {
      runs += 1;
      return "miss";
    });

    expect(first).toEqual({ value: "cached", source: "executed" });
    expect(second).toEqual({ value: "cached", source: "completed" });
    expect(runs).toBe(1);

    const entry = store.get(key);
    expect(entry?.state).toBe(IDEMPOTENCY_STATE.COMPLETED);
    expect(entry?.value).toBe("cached");
  });
});
