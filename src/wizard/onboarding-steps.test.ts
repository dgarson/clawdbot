import { describe, expect, it } from "vitest";
import {
  ADVANCED_PHASES,
  createStepTracker,
  REGULAR_PHASES,
  WIZARD_PHASES,
} from "./onboarding-steps.js";

describe("createStepTracker", () => {
  it("starts at phase index 0", () => {
    const tracker = createStepTracker();
    expect(tracker.currentIndex()).toBe(0);
    expect(tracker.current().id).toBe("welcome");
  });

  it("returns correct total for advanced (default) track", () => {
    const tracker = createStepTracker();
    expect(tracker.total()).toBe(ADVANCED_PHASES.length);
    expect(tracker.total()).toBe(8);
  });

  it("returns correct total for regular track", () => {
    const tracker = createStepTracker({ friendly: true });
    expect(tracker.total()).toBe(REGULAR_PHASES.length);
    expect(tracker.total()).toBe(6);
  });

  it("advance increments the phase index", () => {
    const tracker = createStepTracker({ friendly: true });
    expect(tracker.currentIndex()).toBe(0);

    tracker.advance();
    expect(tracker.currentIndex()).toBe(1);
    expect(tracker.current().id).toBe("identity");

    tracker.advance();
    expect(tracker.currentIndex()).toBe(2);
    expect(tracker.current().id).toBe("personalize");

    tracker.advance();
    expect(tracker.currentIndex()).toBe(3);
    expect(tracker.current().id).toBe("connectivity");
  });

  it("advance does not exceed max phase index", () => {
    const tracker = createStepTracker({ friendly: true });
    for (let i = 0; i < 20; i++) {
      tracker.advance();
    }
    expect(tracker.currentIndex()).toBe(REGULAR_PHASES.length - 1);
    expect(tracker.current().id).toBe("launch");
  });

  it("render returns a string containing the current phase label", () => {
    const tracker = createStepTracker({ friendly: true });
    const output = tracker.render();
    expect(output).toContain("Welcome");
    expect(output).toContain("Step 1 of 6");
  });

  it("uses friendly labels when friendly option is set", () => {
    const tracker = createStepTracker({ friendly: true });
    tracker.advance(); // identity phase
    const output = tracker.render();
    expect(output).toContain("Your Bot");
  });

  it("uses standard labels when friendly option is false", () => {
    const tracker = createStepTracker({ friendly: false });
    tracker.advance(); // identity phase
    const output = tracker.render();
    expect(output).toContain("Identity");
  });

  it("renderPhaseSummary includes all entries", () => {
    const tracker = createStepTracker();
    const summary = tracker.renderPhaseSummary([
      { label: "Workspace", value: "/home/user/workspace" },
      { label: "Model", value: "claude-3-opus" },
    ]);
    expect(summary).toContain("Workspace");
    expect(summary).toContain("/home/user/workspace");
    expect(summary).toContain("Model");
    expect(summary).toContain("claude-3-opus");
  });

  it("hasPhase returns true for phases in the track", () => {
    const regular = createStepTracker({ friendly: true });
    expect(regular.hasPhase("welcome")).toBe(true);
    expect(regular.hasPhase("personalize")).toBe(true);
    expect(regular.hasPhase("launch")).toBe(true);
    // configuration and security are Advanced-only
    expect(regular.hasPhase("configuration")).toBe(false);
    expect(regular.hasPhase("security")).toBe(false);
  });

  it("hasPhase returns true for Advanced-only phases", () => {
    const advanced = createStepTracker({ friendly: false });
    expect(advanced.hasPhase("configuration")).toBe(true);
    expect(advanced.hasPhase("security")).toBe(true);
    expect(advanced.hasPhase("launch")).toBe(true);
  });
});

describe("REGULAR_PHASES", () => {
  it("has 6 phases", () => {
    expect(REGULAR_PHASES).toHaveLength(6);
  });

  it("phase order is correct", () => {
    expect(REGULAR_PHASES.map((p) => p.id)).toEqual([
      "welcome",
      "identity",
      "personalize",
      "connectivity",
      "capabilities",
      "launch",
    ]);
  });
});

describe("ADVANCED_PHASES", () => {
  it("has 8 phases", () => {
    expect(ADVANCED_PHASES).toHaveLength(8);
  });

  it("phase order is correct", () => {
    expect(ADVANCED_PHASES.map((p) => p.id)).toEqual([
      "welcome",
      "identity",
      "personalize",
      "connectivity",
      "capabilities",
      "configuration",
      "security",
      "launch",
    ]);
  });
});

describe("WIZARD_PHASES (deprecated alias)", () => {
  it("is the same as REGULAR_PHASES", () => {
    expect(WIZARD_PHASES).toBe(REGULAR_PHASES);
  });

  it("phases have required fields", () => {
    for (const phase of WIZARD_PHASES) {
      expect(phase.id).toBeTruthy();
      expect(phase.label).toBeTruthy();
      expect(phase.friendlyLabel).toBeTruthy();
      expect(phase.icon).toBeTruthy();
    }
  });
});
