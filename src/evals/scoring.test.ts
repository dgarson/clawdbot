import { describe, expect, it } from "vitest";
import {
  evaluateRegression,
  scoreOutput,
  type BaselineSnapshot,
  type ScoringRubric,
} from "./scoring.js";

const T1_RUBRIC: ScoringRubric = {
  id: "t1-codegen-v1",
  taskType: "T1",
  qualityFloor: 0.7,
  formatErrorCap: 0.5,
  dimensions: [
    { id: "correctness", weight: 0.4 },
    { id: "completeness", weight: 0.25 },
    { id: "quality", weight: 0.2 },
    { id: "safety", weight: 0.15 },
  ],
};

describe("scoreOutput", () => {
  it("computes weighted score and pass/fail", () => {
    const result = scoreOutput({
      scenarioId: "scenario-1",
      rubric: T1_RUBRIC,
      sampleCount: 8,
      formatValid: true,
      dimensionScores: {
        correctness: 0.8,
        completeness: 0.7,
        quality: 0.75,
        safety: 1,
      },
    });

    expect(result.score).toBeCloseTo(0.795, 3);
    expect(result.pass).toBe(true);
    expect(result.flags).toEqual([]);
  });

  it("caps score on format errors and marks low confidence for n<5", () => {
    const result = scoreOutput({
      scenarioId: "scenario-2",
      rubric: T1_RUBRIC,
      sampleCount: 1,
      formatValid: false,
      dimensionScores: {
        correctness: 1,
        completeness: 1,
        quality: 1,
        safety: 1,
      },
    });

    expect(result.score).toBe(0.5);
    expect(result.pass).toBe(false);
    expect(result.flags).toContain("format_error");
    expect(result.flags).toContain("low_confidence");
  });

  it("marks missing dimensions", () => {
    const result = scoreOutput({
      scenarioId: "scenario-3",
      rubric: T1_RUBRIC,
      sampleCount: 10,
      dimensionScores: {
        correctness: 0.9,
      },
    });

    expect(result.flags).toContain("missing_dimension");
    expect(result.score).toBeCloseTo(0.36, 2);
  });
});

describe("evaluateRegression", () => {
  const baseline: BaselineSnapshot = {
    key: "openai|T1|tool-reliability|unit",
    meanScore: 0.81,
    passRate: 0.9,
    sampleCount: 20,
    updatedAt: "2026-02-23T00:00:00.000Z",
  };

  it("returns fail when score drops beyond fail threshold", () => {
    const assessment = evaluateRegression(
      baseline.key,
      baseline,
      { meanScore: 0.68, sampleCount: 20 },
      { warnDelta: 0.03, failDelta: 0.08, absoluteFloor: 0.7 },
    );

    expect(assessment.status).toBe("fail");
    expect(assessment.reasons.length).toBeGreaterThan(0);
  });

  it("returns insufficient_data when sample counts are below threshold", () => {
    const assessment = evaluateRegression(
      baseline.key,
      { ...baseline, sampleCount: 2 },
      { meanScore: 0.9, sampleCount: 2 },
      { warnDelta: 0.03, failDelta: 0.08, minSamples: 5 },
    );

    expect(assessment.status).toBe("insufficient_data");
  });
});
