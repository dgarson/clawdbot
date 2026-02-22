import { describe, it, expect } from "vitest";
import {
  setExperimentSpanAttributes,
  EXPERIMENT_SPAN_ATTRIBUTES,
  type SpanLike,
} from "./context.ts";
import type { ExperimentContext } from "./flags.ts";

/** Mock span that records setAttribute calls */
function createMockSpan(): SpanLike & {
  attributes: Record<string, string | number | boolean>;
} {
  const attributes: Record<string, string | number | boolean> = {};
  return {
    attributes,
    setAttribute(key: string, value: string | number | boolean) {
      attributes[key] = value;
    },
  };
}

describe("setExperimentSpanAttributes", () => {
  it("sets all three experiment attributes on the span", () => {
    const span = createMockSpan();
    const ctx: ExperimentContext = {
      experimentId: "model-routing-test-2026-02",
      variant: "gpt4-routing",
      cohort: "a3f8b2c1d4e5",
    };

    setExperimentSpanAttributes(span, ctx);

    expect(span.attributes["experiment.id"]).toBe("model-routing-test-2026-02");
    expect(span.attributes["experiment.variant"]).toBe("gpt4-routing");
    expect(span.attributes["experiment.cohort"]).toBe("a3f8b2c1d4e5");
  });

  it("uses the correct semantic attribute keys", () => {
    expect(EXPERIMENT_SPAN_ATTRIBUTES.EXPERIMENT_ID).toBe("experiment.id");
    expect(EXPERIMENT_SPAN_ATTRIBUTES.EXPERIMENT_VARIANT).toBe("experiment.variant");
    expect(EXPERIMENT_SPAN_ATTRIBUTES.EXPERIMENT_COHORT).toBe("experiment.cohort");
  });
});
