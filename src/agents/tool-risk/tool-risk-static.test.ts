import { describe, expect, it } from "vitest";
import type { ToolRiskProfile } from "./types.js";
import { evaluateToolRisk } from "./tool-risk-static.js";

describe("tool-risk-static evaluator", () => {
  const baseProfile: ToolRiskProfile = {
    riskClass: "R2",
    sideEffects: ["network_egress"],
    description: "Test tool",
  };

  it("returns base risk class when no parameter bump", () => {
    const result = evaluateToolRisk("test_tool", baseProfile, {}, "core_catalog");
    expect(result.riskClass).toBe("R2");
    expect(result.toolName).toBe("test_tool");
    expect(result.source).toBe("core_catalog");
    expect(result.sideEffects).toEqual(["network_egress"]);
    expect(result.reasonCodes).toEqual([]);
  });

  it("applies parameter bump when profile declares one", () => {
    const profile: ToolRiskProfile = {
      riskClass: "R2",
      sideEffects: ["process_spawn"],
      parameterBump: (params) => {
        if (typeof params.dangerous === "boolean" && params.dangerous) {
          return "R4";
        }
        return null;
      },
    };

    const result = evaluateToolRisk("risky_tool", profile, { dangerous: true }, "core_catalog");
    expect(result.riskClass).toBe("R4");
    expect(result.reasonCodes).toContain("parameter_bump");
  });

  it("does not lower risk class via parameter bump", () => {
    const profile: ToolRiskProfile = {
      riskClass: "R3",
      sideEffects: [],
      parameterBump: () => "R1", // tries to lower
    };

    const result = evaluateToolRisk("test", profile, {}, "core_catalog");
    expect(result.riskClass).toBe("R3"); // stays at base
  });

  it("uses unknown fallback when profile is null", () => {
    const result = evaluateToolRisk("unknown_tool", null, {}, "unknown_fallback");
    expect(result.riskClass).toBe("R3");
    expect(result.source).toBe("unknown_fallback");
    expect(result.reasonCodes).toContain("unknown_tool_profile");
    expect(result.approvalRecommended).toBe(true);
  });

  it("recommends approval for R3 and above", () => {
    const r2 = evaluateToolRisk("safe", { riskClass: "R2", sideEffects: [] }, {}, "core_catalog");
    const r3 = evaluateToolRisk("risky", { riskClass: "R3", sideEffects: [] }, {}, "core_catalog");
    const r4 = evaluateToolRisk(
      "critical",
      { riskClass: "R4", sideEffects: [] },
      {},
      "core_catalog",
    );

    expect(r2.approvalRecommended).toBe(false);
    expect(r3.approvalRecommended).toBe(true);
    expect(r4.approvalRecommended).toBe(true);
  });

  it("respects custom approval threshold", () => {
    // R1 meets threshold R1 -> recommended
    const result = evaluateToolRisk(
      "tool",
      { riskClass: "R1", sideEffects: [] },
      {},
      "core_catalog",
      { approvalThreshold: "R1" },
    );
    expect(result.approvalRecommended).toBe(true);

    // R0 below threshold R1 -> not recommended
    const result0 = evaluateToolRisk(
      "tool",
      { riskClass: "R0", sideEffects: [] },
      {},
      "core_catalog",
      { approvalThreshold: "R1" },
    );
    expect(result0.approvalRecommended).toBe(false);

    // R2 above threshold R1 -> recommended
    const result2 = evaluateToolRisk(
      "tool",
      { riskClass: "R2", sideEffects: [] },
      {},
      "core_catalog",
      { approvalThreshold: "R1" },
    );
    expect(result2.approvalRecommended).toBe(true);
  });

  it("preserves plugin source correctly", () => {
    const profile: ToolRiskProfile = {
      riskClass: "R1",
      sideEffects: ["memory_write"],
    };
    const result = evaluateToolRisk("plugin_tool", profile, {}, "plugin");
    expect(result.source).toBe("plugin");
  });
});
