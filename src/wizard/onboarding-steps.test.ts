import { describe, expect, it } from "vitest";
import { createStepTracker, WIZARD_PHASES } from "./onboarding-steps.js";

describe("createStepTracker", () => {
  it("starts at phase index 0", () => {
    const tracker = createStepTracker();
    expect(tracker.currentIndex()).toBe(0);
    expect(tracker.current().id).toBe("welcome");
  });

  it("returns correct total count", () => {
    const tracker = createStepTracker();
    expect(tracker.total()).toBe(WIZARD_PHASES.length);
    expect(tracker.total()).toBe(5);
  });

  it("advance increments the phase index", () => {
    const tracker = createStepTracker();
    expect(tracker.currentIndex()).toBe(0);

    tracker.advance();
    expect(tracker.currentIndex()).toBe(1);
    expect(tracker.current().id).toBe("identity");

    tracker.advance();
    expect(tracker.currentIndex()).toBe(2);
    expect(tracker.current().id).toBe("connectivity");
  });

  it("advance does not exceed max phase index", () => {
    const tracker = createStepTracker();
    // Advance through all phases
    for (let i = 0; i < 10; i++) {
      tracker.advance();
    }
    expect(tracker.currentIndex()).toBe(WIZARD_PHASES.length - 1);
    expect(tracker.current().id).toBe("launch");
  });

  it("render returns a string containing the current phase label", () => {
    const tracker = createStepTracker();
    const output = tracker.render();
    expect(output).toContain("Welcome");
    expect(output).toContain("Step 1 of 5");
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
});

describe("WIZARD_PHASES", () => {
  it("has 5 phases", () => {
    expect(WIZARD_PHASES).toHaveLength(5);
  });

  it("phases have required fields", () => {
    for (const phase of WIZARD_PHASES) {
      expect(phase.id).toBeTruthy();
      expect(phase.label).toBeTruthy();
      expect(phase.friendlyLabel).toBeTruthy();
      expect(phase.icon).toBeTruthy();
    }
  });

  it("phase order is correct", () => {
    expect(WIZARD_PHASES.map((p) => p.id)).toEqual([
      "welcome",
      "identity",
      "connectivity",
      "capabilities",
      "launch",
    ]);
  });
});
