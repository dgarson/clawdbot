import { describe, expect, it } from "vitest";
import { uuidv7 } from "./uuidv7";

describe("uuidv7", () => {
  it("sets version and variant bits", () => {
    const id = uuidv7(1_700_000_000_000);
    expect(id[14]).toBe("7");
    expect(["8", "9", "a", "b"]).toContain(id[19]);
  });

  it("is lexicographically increasing within the same millisecond", () => {
    const t = 1_700_000_000_000;
    const a = uuidv7(t);
    const b = uuidv7(t);
    const c = uuidv7(t);

    expect(a < b).toBe(true);
    expect(b < c).toBe(true);
  });

  it("sorts chronologically by ms", () => {
    const a = uuidv7(1_000);
    const b = uuidv7(2_000);
    expect(a < b).toBe(true);
  });
});

