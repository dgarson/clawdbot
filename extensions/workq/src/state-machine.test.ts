import { describe, expect, it } from "vitest";
import {
  WORKQ_TRANSITIONS,
  assertValidTransition,
  getValidTransitions,
  isValidTransition,
} from "./state-machine.js";
import { WORK_ITEM_STATUSES } from "./types.js";

describe("state-machine", () => {
  it("matches the full valid/invalid transition matrix", () => {
    for (const from of WORK_ITEM_STATUSES) {
      for (const to of WORK_ITEM_STATUSES) {
        const expected = WORKQ_TRANSITIONS[from].includes(to);
        expect(isValidTransition(from, to)).toBe(expected);
      }
    }
  });

  it("returns configured options for getValidTransitions", () => {
    for (const from of WORK_ITEM_STATUSES) {
      expect(getValidTransitions(from)).toEqual([...WORKQ_TRANSITIONS[from]]);
    }
  });

  it("returns a defensive copy from getValidTransitions", () => {
    const firstRead = getValidTransitions("claimed");
    firstRead.push("done");

    expect(getValidTransitions("claimed")).toEqual(["in-progress"]);
  });

  it("treats done and dropped as terminal statuses", () => {
    expect(getValidTransitions("done")).toEqual([]);
    expect(getValidTransitions("dropped")).toEqual([]);

    for (const to of WORK_ITEM_STATUSES) {
      expect(isValidTransition("done", to)).toBe(false);
      expect(isValidTransition("dropped", to)).toBe(false);
    }
  });

  it("throws useful details for invalid transitions with alternatives", () => {
    expect(() => assertValidTransition("claimed", "done")).toThrowError(
      "Invalid status transition: claimed -> done. Valid transitions: in-progress",
    );
  });

  it("throws useful details for invalid transitions from terminal states", () => {
    expect(() => assertValidTransition("done", "in-progress")).toThrowError(
      "Invalid status transition: done -> in-progress. Valid transitions: none",
    );
  });

  it("does not throw for valid transitions", () => {
    expect(() => assertValidTransition("in-review", "done")).not.toThrow();
    expect(() => assertValidTransition("blocked", "in-progress")).not.toThrow();
  });
});
