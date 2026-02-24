import { describe, expect, it } from "vitest";
import { createDeterministicClock } from "./clock.js";

describe("replay clock", () => {
  it("throws for invalid deterministic start timestamps", () => {
    expect(() => createDeterministicClock({ start: "not-a-timestamp" })).toThrow(
      /invalid deterministic clock start timestamp/i,
    );
  });
});
