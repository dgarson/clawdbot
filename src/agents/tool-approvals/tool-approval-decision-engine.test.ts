import { describe, expect, it } from "vitest";
import type { ToolRiskAssessment } from "../tool-risk/types.js";
import type { ToolApprovalContext } from "./types.js";
import { decideToolApproval, resolveToolApprovalConfig } from "./tool-approval-decision-engine.js";

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
      expect(result.outcome).toBe("allow");
      expect(result.reason).toBe("config_disabled");
    });

    it("returns allow when enabled is false", () => {
      const result = decideToolApproval(makeAssessment(), makeCtx({ enabled: false }));
      expect(result.outcome).toBe("allow");
      expect(result.reason).toBe("config_disabled");
    });

    it("returns allow when mode is off", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R4" }),
        makeCtx({ mode: "off" }),
      );
      expect(result.outcome).toBe("allow");
      expect(result.reason).toBe("mode_off");
    });
  });

  describe("mode=always", () => {
    it("requires approval for any tool call", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R0" }),
        makeCtx({ mode: "always" }),
      );
      expect(result.outcome).toBe("approval_required");
      expect(result.reason).toBe("mode_always");
    });

    it("denies before requiring approval when denyAtOrAbove matches", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R4" }),
        makeCtx({
          mode: "always",
          policy: { denyAtOrAbove: "R4" },
        }),
      );
      expect(result.outcome).toBe("deny");
      expect(result.reason).toBe("policy_deny");
    });
  });

  describe("mode=adaptive", () => {
    it("allows low-risk tools without approval", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R0" }),
        makeCtx({ mode: "adaptive" }),
      );
      expect(result.outcome).toBe("allow");
      expect(result.reason).toBe("policy_allow");
    });

    it("allows R2 tools when threshold is default R3", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R2" }),
        makeCtx({ mode: "adaptive" }),
      );
      expect(result.outcome).toBe("allow");
      expect(result.reason).toBe("policy_allow");
    });

    it("requires approval at default R3 threshold", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R3" }),
        makeCtx({ mode: "adaptive" }),
      );
      expect(result.outcome).toBe("approval_required");
      expect(result.reason).toBe("policy_threshold");
    });

    it("requires approval above threshold", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R4" }),
        makeCtx({ mode: "adaptive" }),
      );
      expect(result.outcome).toBe("approval_required");
      expect(result.reason).toBe("policy_threshold");
    });

    it("uses custom requireApprovalAtOrAbove threshold", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R2" }),
        makeCtx({
          mode: "adaptive",
          policy: { requireApprovalAtOrAbove: "R2" },
        }),
      );
      expect(result.outcome).toBe("approval_required");
      expect(result.reason).toBe("policy_threshold");
    });

    it("denies at denyAtOrAbove threshold", () => {
      const result = decideToolApproval(
        makeAssessment({ riskClass: "R4" }),
        makeCtx({
          mode: "adaptive",
          policy: { denyAtOrAbove: "R4" },
        }),
      );
      expect(result.outcome).toBe("deny");
      expect(result.reason).toBe("policy_deny");
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
      expect(result.outcome).toBe("deny");
      expect(result.reason).toBe("policy_deny");
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
      expect(result.outcome).toBe("approval_required");
      expect(result.reason).toBe("policy_external_write");
    });

    it("does not require approval for external write when flag is not set", () => {
      const result = decideToolApproval(
        makeAssessment({
          riskClass: "R1",
          sideEffects: ["network_egress"],
        }),
        makeCtx({ mode: "adaptive" }),
      );
      expect(result.outcome).toBe("allow");
      expect(result.reason).toBe("policy_allow");
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
      expect(result.outcome).toBe("approval_required");
      expect(result.reason).toBe("policy_message_send");
    });

    it("does not require approval for messaging when flag is not set", () => {
      const result = decideToolApproval(
        makeAssessment({
          riskClass: "R1",
          sideEffects: ["message_send"],
        }),
        makeCtx({ mode: "adaptive" }),
      );
      expect(result.outcome).toBe("allow");
      expect(result.reason).toBe("policy_allow");
    });
  });
});

describe("resolveToolApprovalConfig", () => {
  it("returns disabled defaults when config is undefined", () => {
    const resolved = resolveToolApprovalConfig(undefined);
    expect(resolved.enabled).toBe(false);
    expect(resolved.mode).toBe("off");
    expect(resolved.timeoutMs).toBe(120_000);
    expect(resolved.requireApprovalAtOrAbove).toBe("R3");
    expect(resolved.denyAtOrAbove).toBeNull();
    expect(resolved.requireApprovalForExternalWrite).toBe(false);
    expect(resolved.requireApprovalForMessagingSend).toBe(false);
  });

  it("returns disabled defaults when enabled is false", () => {
    const resolved = resolveToolApprovalConfig({ enabled: false });
    expect(resolved.enabled).toBe(false);
    expect(resolved.mode).toBe("off");
  });

  it("returns enabled config with overrides", () => {
    const resolved = resolveToolApprovalConfig({
      enabled: true,
      mode: "always",
      timeoutMs: 5000,
      policy: {
        requireApprovalAtOrAbove: "R2",
        denyAtOrAbove: "R4",
        requireApprovalForExternalWrite: true,
        requireApprovalForMessagingSend: true,
      },
    });
    expect(resolved.enabled).toBe(true);
    expect(resolved.mode).toBe("always");
    expect(resolved.timeoutMs).toBe(5000);
    expect(resolved.requireApprovalAtOrAbove).toBe("R2");
    expect(resolved.denyAtOrAbove).toBe("R4");
    expect(resolved.requireApprovalForExternalWrite).toBe(true);
    expect(resolved.requireApprovalForMessagingSend).toBe(true);
  });

  it("uses defaults for missing policy fields", () => {
    const resolved = resolveToolApprovalConfig({
      enabled: true,
      mode: "adaptive",
    });
    expect(resolved.enabled).toBe(true);
    expect(resolved.mode).toBe("adaptive");
    expect(resolved.timeoutMs).toBe(120_000);
    expect(resolved.requireApprovalAtOrAbove).toBe("R3");
    expect(resolved.denyAtOrAbove).toBeNull();
  });
});
