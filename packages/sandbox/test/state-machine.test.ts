/**
 * State Machine Tests
 */

import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  getStateDescription,
  RUNTIME_STATE_TRANSITIONS,
} from "../src/state-machine.js";

describe("Runtime State Machine", () => {
  describe("isValidTransition", () => {
    it("should allow idle -> starting", () => {
      expect(isValidTransition("idle", "starting")).toBe(true);
    });

    it("should not allow idle -> ready directly", () => {
      expect(isValidTransition("idle", "ready")).toBe(false);
    });

    it("should allow starting -> ready", () => {
      expect(isValidTransition("starting", "ready")).toBe(true);
    });

    it("should allow starting -> failed", () => {
      expect(isValidTransition("starting", "failed")).toBe(true);
    });

    it("should allow ready -> busy", () => {
      expect(isValidTransition("ready", "busy")).toBe(true);
    });

    it("should allow ready -> terminating", () => {
      expect(isValidTransition("ready", "terminating")).toBe(true);
    });

    it("should allow busy -> ready", () => {
      expect(isValidTransition("busy", "ready")).toBe(true);
    });

    it("should allow busy -> terminating", () => {
      expect(isValidTransition("busy", "terminating")).toBe(true);
    });

    it("should allow busy -> failed", () => {
      expect(isValidTransition("busy", "failed")).toBe(true);
    });

    it("should allow terminating -> idle", () => {
      expect(isValidTransition("terminating", "idle")).toBe(true);
    });

    it("should allow terminating -> failed", () => {
      expect(isValidTransition("terminating", "failed")).toBe(true);
    });

    it("should allow failed -> ready (retry)", () => {
      expect(isValidTransition("failed", "ready")).toBe(true);
    });

    it("should allow failed -> terminal", () => {
      expect(isValidTransition("failed", "terminal")).toBe(true);
    });

    it("should allow failed -> starting (restart)", () => {
      expect(isValidTransition("failed", "starting")).toBe(true);
    });

    it("should not allow going back to idle from ready", () => {
      expect(isValidTransition("ready", "idle")).toBe(false);
    });

    it("should not allow going back to starting from ready", () => {
      expect(isValidTransition("ready", "starting")).toBe(false);
    });
  });

  describe("getStateDescription", () => {
    it("should return correct description for idle", () => {
      expect(getStateDescription("idle")).toBe("No sandbox process running");
    });

    it("should return correct description for starting", () => {
      expect(getStateDescription("starting")).toBe("Launching sandbox process...");
    });

    it("should return correct description for ready", () => {
      expect(getStateDescription("ready")).toBe("Sandbox ready to accept requests");
    });

    it("should return correct description for busy", () => {
      expect(getStateDescription("busy")).toBe("Sandbox executing a request");
    });

    it("should return correct description for terminating", () => {
      expect(getStateDescription("terminating")).toBe("Shutting down sandbox...");
    });

    it("should return correct description for failed", () => {
      expect(getStateDescription("failed")).toBe("Sandbox encountered an error");
    });
  });

  describe("RUNTIME_STATE_TRANSITIONS", () => {
    it("should have transitions defined for all states", () => {
      const states = ["idle", "starting", "ready", "busy", "terminating", "failed"];

      for (const state of states) {
        expect(RUNTIME_STATE_TRANSITIONS).toHaveProperty(state);
        expect(Array.isArray(RUNTIME_STATE_TRANSITIONS[state])).toBe(true);
      }
    });

    it("should have idle as terminal state", () => {
      const idleTransitions = RUNTIME_STATE_TRANSITIONS["idle"];
      expect(idleTransitions).toContain("starting");
      expect(idleTransitions).not.toContain("ready");
    });
  });
});
