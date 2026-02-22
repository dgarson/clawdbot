import { describe, it, expect } from "vitest";
import { validateExperimentEvent, type ExperimentTelemetryEvent } from "./schema.ts";

describe("validateExperimentEvent", () => {
  const validEvent: ExperimentTelemetryEvent = {
    experimentId: "model-routing-test-2026-02",
    variant: "gpt4-routing",
    cohort: "a3f8b2c1d4e5",
    metric: "response_latency_ms",
    value: 342,
  };

  it("returns no errors for a valid event", () => {
    expect(validateExperimentEvent(validEvent)).toEqual([]);
  });

  it("catches missing experimentId", () => {
    const event = { ...validEvent, experimentId: "" };
    const errors = validateExperimentEvent(event);
    expect(errors).toContain("experimentId is required");
  });

  it("catches missing variant", () => {
    const event = { ...validEvent, variant: "  " };
    const errors = validateExperimentEvent(event);
    expect(errors).toContain("variant is required");
  });

  it("catches missing cohort", () => {
    const event = { ...validEvent, cohort: "" };
    const errors = validateExperimentEvent(event);
    expect(errors).toContain("cohort is required");
  });

  it("catches missing metric", () => {
    const event = { ...validEvent, metric: "" };
    const errors = validateExperimentEvent(event);
    expect(errors).toContain("metric is required");
  });

  it("catches NaN value", () => {
    const event = { ...validEvent, value: NaN };
    const errors = validateExperimentEvent(event);
    expect(errors).toContain("value must be a valid number");
  });

  it("allows zero and negative values", () => {
    expect(validateExperimentEvent({ ...validEvent, value: 0 })).toEqual([]);
    expect(validateExperimentEvent({ ...validEvent, value: -1 })).toEqual([]);
  });

  it("returns multiple errors at once", () => {
    const event = {
      experimentId: "",
      variant: "",
      cohort: "",
      metric: "",
      value: NaN,
    };
    const errors = validateExperimentEvent(event);
    expect(errors).toHaveLength(5);
  });
});
