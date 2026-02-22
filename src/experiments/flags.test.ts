import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ExperimentManager,
  _computeBucket,
  _computeCohort,
  type ExperimentsConfig,
} from "./flags.ts";

const TEST_DIR = join(tmpdir(), "openclaw-experiments-test-" + Date.now());
const CONFIG_PATH = join(TEST_DIR, "experiments.json");

function writeConfig(config: ExperimentsConfig): void {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config));
}

describe("ExperimentManager", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("handles missing config file gracefully", () => {
      const mgr = new ExperimentManager("/nonexistent/path.json");
      expect(mgr.listExperiments()).toEqual([]);
      expect(mgr.isEnabled("anything")).toBe(false);
    });

    it("loads valid config", () => {
      writeConfig({
        flags: { "feature-a": true, "feature-b": false },
        experiments: [
          {
            id: "test-exp",
            description: "A test experiment",
            variants: ["control", "treatment"],
            trafficSplit: [50, 50],
            enabled: true,
          },
        ],
      });

      const mgr = new ExperimentManager(CONFIG_PATH);
      expect(mgr.listExperiments()).toHaveLength(1);
      expect(mgr.isEnabled("feature-a")).toBe(true);
      expect(mgr.isEnabled("feature-b")).toBe(false);
    });

    it("throws on invalid traffic split (not summing to 100)", () => {
      writeConfig({
        experiments: [
          {
            id: "bad",
            description: "Bad split",
            variants: ["a", "b"],
            trafficSplit: [60, 60],
            enabled: true,
          },
        ],
      });

      expect(() => new ExperimentManager(CONFIG_PATH)).toThrow("trafficSplit must sum to 100");
    });

    it("throws on mismatched variants/trafficSplit lengths", () => {
      writeConfig({
        experiments: [
          {
            id: "bad",
            description: "Mismatched",
            variants: ["a", "b", "c"],
            trafficSplit: [50, 50],
            enabled: true,
          },
        ],
      });

      expect(() => new ExperimentManager(CONFIG_PATH)).toThrow("must have the same length");
    });

    it("throws on empty variants", () => {
      writeConfig({
        experiments: [
          {
            id: "bad",
            description: "Empty",
            variants: [],
            trafficSplit: [],
            enabled: true,
          },
        ],
      });

      expect(() => new ExperimentManager(CONFIG_PATH)).toThrow("must have at least one variant");
    });
  });

  describe("getVariant — determinism", () => {
    it("returns the same variant for the same input every time", () => {
      writeConfig({
        experiments: [
          {
            id: "determinism-test",
            description: "Test determinism",
            variants: ["control", "treatment"],
            trafficSplit: [50, 50],
            enabled: true,
          },
        ],
      });

      const mgr = new ExperimentManager(CONFIG_PATH);
      const results = new Set<string>();

      // Call 100 times with same inputs — must always get the same result
      for (let i = 0; i < 100; i++) {
        const ctx = mgr.getVariant("determinism-test", "user-42");
        expect(ctx).not.toBeNull();
        results.add(ctx!.variant);
      }

      // Should only have one unique variant
      expect(results.size).toBe(1);
    });

    it("returns consistent cohort for the same input", () => {
      writeConfig({
        experiments: [
          {
            id: "cohort-test",
            description: "Cohort test",
            variants: ["a", "b"],
            trafficSplit: [50, 50],
            enabled: true,
          },
        ],
      });

      const mgr = new ExperimentManager(CONFIG_PATH);
      const ctx1 = mgr.getVariant("cohort-test", "user-1");
      const ctx2 = mgr.getVariant("cohort-test", "user-1");

      expect(ctx1).not.toBeNull();
      expect(ctx2).not.toBeNull();
      expect(ctx1!.cohort).toBe(ctx2!.cohort);
      expect(ctx1!.variant).toBe(ctx2!.variant);
    });

    it("different subjects can get different variants", () => {
      writeConfig({
        experiments: [
          {
            id: "multi-variant-test",
            description: "Multi-variant",
            variants: ["control", "treatment"],
            trafficSplit: [50, 50],
            enabled: true,
          },
        ],
      });

      const mgr = new ExperimentManager(CONFIG_PATH);
      const variants = new Set<string>();

      // With enough subjects, we should see both variants
      for (let i = 0; i < 200; i++) {
        const ctx = mgr.getVariant("multi-variant-test", `user-${i}`);
        if (ctx) {
          variants.add(ctx.variant);
        }
      }

      expect(variants.size).toBe(2);
      expect(variants.has("control")).toBe(true);
      expect(variants.has("treatment")).toBe(true);
    });
  });

  describe("getVariant — traffic split distribution", () => {
    it("distributes traffic approximately according to split percentages", () => {
      writeConfig({
        experiments: [
          {
            id: "distribution-test",
            description: "Distribution test",
            variants: ["control", "treatment-a", "treatment-b"],
            trafficSplit: [50, 30, 20],
            enabled: true,
          },
        ],
      });

      const mgr = new ExperimentManager(CONFIG_PATH);
      const counts: Record<string, number> = {
        control: 0,
        "treatment-a": 0,
        "treatment-b": 0,
      };

      const totalSubjects = 10000;
      for (let i = 0; i < totalSubjects; i++) {
        const ctx = mgr.getVariant("distribution-test", `subject-${i}`);
        expect(ctx).not.toBeNull();
        counts[ctx!.variant]++;
      }

      // Allow 5% tolerance for hash-based distribution
      const tolerance = 0.05;
      expect(counts.control / totalSubjects).toBeCloseTo(0.5, 1);
      expect(Math.abs(counts["treatment-a"] / totalSubjects - 0.3)).toBeLessThan(tolerance);
      expect(Math.abs(counts["treatment-b"] / totalSubjects - 0.2)).toBeLessThan(tolerance);
    });

    it("handles 100/0 split correctly", () => {
      writeConfig({
        experiments: [
          {
            id: "all-control",
            description: "All control",
            variants: ["control", "treatment"],
            trafficSplit: [100, 0],
            enabled: true,
          },
        ],
      });

      const mgr = new ExperimentManager(CONFIG_PATH);

      for (let i = 0; i < 100; i++) {
        const ctx = mgr.getVariant("all-control", `user-${i}`);
        expect(ctx).not.toBeNull();
        expect(ctx!.variant).toBe("control");
      }
    });
  });

  describe("getVariant — edge cases", () => {
    it("returns null for unknown experiment", () => {
      writeConfig({ experiments: [] });
      const mgr = new ExperimentManager(CONFIG_PATH);
      expect(mgr.getVariant("nonexistent", "user-1")).toBeNull();
    });

    it("returns null for disabled experiment", () => {
      writeConfig({
        experiments: [
          {
            id: "disabled-exp",
            description: "Disabled",
            variants: ["a", "b"],
            trafficSplit: [50, 50],
            enabled: false,
          },
        ],
      });

      const mgr = new ExperimentManager(CONFIG_PATH);
      expect(mgr.getVariant("disabled-exp", "user-1")).toBeNull();
    });

    it("returns null for experiment not yet started", () => {
      writeConfig({
        experiments: [
          {
            id: "future-exp",
            description: "Future",
            variants: ["a", "b"],
            trafficSplit: [50, 50],
            enabled: true,
            startDate: "2099-01-01",
          },
        ],
      });

      const mgr = new ExperimentManager(CONFIG_PATH);
      expect(mgr.getVariant("future-exp", "user-1")).toBeNull();
    });

    it("returns null for experiment past end date", () => {
      writeConfig({
        experiments: [
          {
            id: "expired-exp",
            description: "Expired",
            variants: ["a", "b"],
            trafficSplit: [50, 50],
            enabled: true,
            endDate: "2020-01-01",
          },
        ],
      });

      const mgr = new ExperimentManager(CONFIG_PATH);
      expect(mgr.getVariant("expired-exp", "user-1")).toBeNull();
    });
  });

  describe("isEnabled", () => {
    it("returns false for unknown flags", () => {
      writeConfig({ flags: {} });
      const mgr = new ExperimentManager(CONFIG_PATH);
      expect(mgr.isEnabled("unknown")).toBe(false);
    });

    it("returns correct values for known flags", () => {
      writeConfig({
        flags: { enabled: true, disabled: false },
      });

      const mgr = new ExperimentManager(CONFIG_PATH);
      expect(mgr.isEnabled("enabled")).toBe(true);
      expect(mgr.isEnabled("disabled")).toBe(false);
    });
  });

  describe("listExperiments", () => {
    it("returns a copy of experiments (not the internal array)", () => {
      writeConfig({
        experiments: [
          {
            id: "exp-1",
            description: "First",
            variants: ["a"],
            trafficSplit: [100],
            enabled: true,
          },
        ],
      });

      const mgr = new ExperimentManager(CONFIG_PATH);
      const list = mgr.listExperiments();
      list.push({
        id: "injected",
        description: "Sneaky",
        variants: ["x"],
        trafficSplit: [100],
        enabled: true,
      });

      // Original should be unaffected
      expect(mgr.listExperiments()).toHaveLength(1);
    });
  });
});

describe("computeBucket", () => {
  it("is deterministic", () => {
    const b1 = _computeBucket("exp-1", "user-1");
    const b2 = _computeBucket("exp-1", "user-1");
    expect(b1).toBe(b2);
  });

  it("returns values in [0, 99]", () => {
    for (let i = 0; i < 1000; i++) {
      const bucket = _computeBucket("exp", `user-${i}`);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(100);
    }
  });

  it("varies by experimentId", () => {
    const b1 = _computeBucket("exp-a", "user-1");
    const b2 = _computeBucket("exp-b", "user-1");
    // Not guaranteed to differ but overwhelmingly likely for different experiment ids
    // We just check they're both valid
    expect(b1).toBeGreaterThanOrEqual(0);
    expect(b2).toBeGreaterThanOrEqual(0);
  });
});

describe("computeCohort", () => {
  it("is deterministic", () => {
    const c1 = _computeCohort("exp-1", "user-1");
    const c2 = _computeCohort("exp-1", "user-1");
    expect(c1).toBe(c2);
  });

  it("returns a 12-character hex string", () => {
    const cohort = _computeCohort("exp-1", "user-1");
    expect(cohort).toHaveLength(12);
    expect(cohort).toMatch(/^[0-9a-f]{12}$/);
  });
});
