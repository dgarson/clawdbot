import { describe, expect, it } from "vitest";
import type { ToolRiskAssessment } from "../tool-risk/types.js";
import type { ToolApprovalContext } from "./types.js";
import { decideToolApproval } from "./tool-approval-decision-engine.js";

function makeAssessment(overrides: Partial<ToolRiskAssessment> = {}): ToolRiskAssessment {
  return {
    toolName: "test_tool",
    riskClass: "R0",
    sideEffects: [],
    reasonCodes: [],
    approvalRecommended: false,
    source: "core_catalog",
    ...overrides,
  };
}

function makeCtx(
  overrides: Partial<NonNullable<ToolApprovalContext["toolApprovalsConfig"]>> = {},
): ToolApprovalContext {
  return {
    agentId: "main",
    sessionKey: "test-session",
    toolApprovalsConfig: {
      enabled: true,
      mode: "adaptive",
      ...overrides,
    },
  };
}

describe("decideToolApproval", () => {
  describe("disabled / no config", () => {
    it("returns allow when toolApprovalsConfig is undefined", () => {
      const result = decideToolApproval(makeAssessment(), { agentId: "main" });
      expect(result).toBe("allow");
    });

    it("returns allow when enabled is false", () => {
      const result = decideToolApproval(makeAssessment(), makeCtx({ enabled: false }));
      expect(result).toBe("allow");
    });

    it("returns allow when mode is off", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R4" }),
        makeCtx({ mode: "off" }),
      );
      expect(result).toBe("allow");
    });
  });

  describe("mode=always", () => {
    it("requires approval for any tool call", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R0" }),
        makeCtx({ mode: "always" }),
      );
      expect(result).toBe("approval_required");
    });

    it("denies before requiring approval when denyAtOrAbove matches", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R4" }),
        makeCtx({
          mode: "always",
          policy: { denyAtOrAbove: "R4" },
        }),
      );
      expect(result).toBe("deny");
    });
  });

  describe("mode=adaptive", () => {
    it("allows low-risk tools without approval", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R0" }),
        makeCtx({ mode: "adaptive" }),
      );
      expect(result).toBe("allow");
    });

    it("allows R2 tools when threshold is default R3", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R2" }),
        makeCtx({ mode: "adaptive" }),
      );
      expect(result).toBe("allow");
    });

    it("requires approval at default R3 threshold", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R3" }),
        makeCtx({ mode: "adaptive" }),
      );
      expect(result).toBe("approval_required");
    });

    it("requires approval above threshold", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R4" }),
        makeCtx({ mode: "adaptive" }),
      );
      expect(result).toBe("approval_required");
    });

    it("uses custom requireApprovalAtOrAbove threshold", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R2" }),
        makeCtx({
          mode: "adaptive",
          policy: { requireApprovalAtOrAbove: "R2" },
        }),
      );
      expect(result).toBe("approval_required");
    });

    it("denies at denyAtOrAbove threshold", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R4" }),
        makeCtx({
          mode: "adaptive",
          policy: { denyAtOrAbove: "R4" },
        }),
      );
      expect(result).toBe("deny");
    });

    it("deny takes priority over approval_required", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R3" }),
        makeCtx({
          mode: "adaptive",
          policy: {
            requireApprovalAtOrAbove: "R2",
            denyAtOrAbove: "R3",
          },
        }),
      );
      expect(result).toBe("deny");
    });
  });

  describe("side-effect policy flags", () => {
    it("requires approval for external write when flag is set", () => {
      const result = decideToolApproval(
        makeAssessment({
          riskClass: "R1",
          sideEffects: ["network_egress"],
        }),
        makeCtx({
          mode: "adaptive",
          policy: { requireApprovalForExternalWrite: true },
        }),
      );
      expect(result).toBe("approval_required");
    });

    it("does not require approval for external write when flag is not set", () => {
      const result = decideToolApproval(
        makeAssessment({
          riskClass: "R1",
          sideEffects: ["network_egress"],
        }),
        makeCtx({ mode: "adaptive" }),
      );
      expect(result).toBe("allow");
    });

    it("requires approval for messaging send when flag is set", () => {
      const result = decideToolApproval(
        makeAssessment({
          riskClass: "R1",
          sideEffects: ["message_send"],
        }),
        makeCtx({
          mode: "adaptive",
          policy: { requireApprovalForMessagingSend: true },
        }),
      );
      expect(result).toBe("approval_required");
    });

    it("does not require approval for messaging when flag is not set", () => {
      const result = decideToolApproval(
        makeAssessment({
          riskClass: "R1",
          sideEffects: ["message_send"],
        }),
        makeCtx({ mode: "adaptive" }),
      );
      expect(result).toBe("allow");
    });
  });
});
