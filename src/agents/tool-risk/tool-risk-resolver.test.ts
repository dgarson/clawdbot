import { describe, expect, it } from "vitest";
import { assessToolRisk, resolveToolRiskProfile } from "./tool-risk-resolver.js";

describe("tool-risk-resolver", () => {
  describe("resolveToolRiskProfile", () => {
    it("resolves core catalog profile for known tool", () => {
      const result = resolveToolRiskProfile("exec");
      expect(result.profile).toBeTruthy();
      expect(result.source).toBe("core_catalog");
      expect(result.profile?.riskClass).toBe("R3");
    });

    it("resolves core catalog profile case-insensitively", () => {
      const result = resolveToolRiskProfile("EXEC");
      expect(result.profile).toBeTruthy();
      expect(result.source).toBe("core_catalog");
    });

    it("returns unknown fallback for unregistered tool", () => {
      const result = resolveToolRiskProfile("completely_unknown_tool_xyz");
      expect(result.profile).toBeNull();
      expect(result.source).toBe("unknown_fallback");
    });

    it("resolves read-only tools as R0", () => {
      const result = resolveToolRiskProfile("ripgrep");
      expect(result.profile?.riskClass).toBe("R0");
      expect(result.source).toBe("core_catalog");
    });

    it("resolves moderate tools as R2", () => {
      const result = resolveToolRiskProfile("browser");
      expect(result.profile?.riskClass).toBe("R2");
    });
  });

  describe("assessToolRisk", () => {
    it("returns full assessment for known tool", () => {
      const assessment = assessToolRisk("exec", { command: "echo hi" });
      expect(assessment.toolName).toBe("exec");
      expect(assessment.riskClass).toBe("R3");
      expect(assessment.source).toBe("core_catalog");
      expect(assessment.approvalRecommended).toBe(true);
      expect(assessment.sideEffects).toContain("process_spawn");
    });

    it("applies parameter bump for destructive exec commands", () => {
      const assessment = assessToolRisk("exec", {
        command: "rm -rf /important",
      });
      expect(assessment.riskClass).toBe("R4");
      expect(assessment.reasonCodes).toContain("parameter_bump");
    });

    it("does not bump for safe exec commands", () => {
      const assessment = assessToolRisk("exec", { command: "ls -la" });
      expect(assessment.riskClass).toBe("R3");
      expect(assessment.reasonCodes).not.toContain("parameter_bump");
    });

    it("fails closed for unknown tools", () => {
      const assessment = assessToolRisk("nonexistent_tool_abc", {});
      expect(assessment.riskClass).toBe("R3");
      expect(assessment.source).toBe("unknown_fallback");
      expect(assessment.reasonCodes).toContain("unknown_tool_profile");
      expect(assessment.approvalRecommended).toBe(true);
    });

    it("classifies web_search as R1", () => {
      const assessment = assessToolRisk("web_search", { query: "test" });
      expect(assessment.riskClass).toBe("R1");
      expect(assessment.approvalRecommended).toBe(false);
    });

    it("classifies message as R3", () => {
      const assessment = assessToolRisk("message", { to: "user", text: "hi" });
      expect(assessment.riskClass).toBe("R3");
      expect(assessment.approvalRecommended).toBe(true);
    });
  });
});
