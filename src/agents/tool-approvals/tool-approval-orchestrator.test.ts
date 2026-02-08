import { describe, expect, it, vi } from "vitest";
import type { GatewayCallFn, ToolApprovalContext } from "./types.js";
import { evaluateToolApproval } from "./tool-approval-orchestrator.js";

function makeCtx(
  overrides: Partial<NonNullable<ToolApprovalContext["toolApprovalsConfig"]>> = {},
): ToolApprovalContext {
  return {
    agentId: "main",
    sessionKey: "test-session",
    toolApprovalsConfig: {
      enabled: true,
      mode: "adaptive",
      timeoutMs: 5000,
      ...overrides,
    },
  };
}

describe("evaluateToolApproval", () => {
  describe("disabled / no config", () => {
    it("allows when toolApprovalsConfig is undefined", async () => {
      const result = await evaluateToolApproval(
        "read",
        {},
        {
          agentId: "main",
        },
      );
      expect(result.allowed).toBe(true);
    });

    it("allows when enabled is false", async () => {
      const result = await evaluateToolApproval("read", {}, makeCtx({ enabled: false }));
      expect(result.allowed).toBe(true);
    });

    it("allows when mode is off", async () => {
      const result = await evaluateToolApproval(
        "exec",
        { command: "rm -rf /" },
        makeCtx({ mode: "off" }),
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe("adaptive mode — low risk", () => {
    it("allows R0 tools without gateway call", async () => {
      const callGateway = vi.fn();
      const result = await evaluateToolApproval("ripgrep", { pattern: "test" }, makeCtx(), null, {
        callGateway,
      });
      expect(result.allowed).toBe(true);
      expect(callGateway).not.toHaveBeenCalled();
    });

    it("allows R1 tools without gateway call", async () => {
      const callGateway = vi.fn();
      const result = await evaluateToolApproval("web_search", { query: "test" }, makeCtx(), null, {
        callGateway,
      });
      expect(result.allowed).toBe(true);
      expect(callGateway).not.toHaveBeenCalled();
    });

    it("allows R2 tools without gateway call", async () => {
      const callGateway = vi.fn();
      const result = await evaluateToolApproval(
        "browser",
        { url: "https://example.com" },
        makeCtx(),
        null,
        { callGateway },
      );
      expect(result.allowed).toBe(true);
      expect(callGateway).not.toHaveBeenCalled();
    });
  });

  describe("adaptive mode — high risk", () => {
    it("requests approval for R3 tool via gateway", async () => {
      const callGateway: GatewayCallFn = vi.fn().mockResolvedValue({
        decision: "allow-once",
      });
      const result = await evaluateToolApproval("exec", { command: "ls" }, makeCtx(), null, {
        callGateway,
      });
      expect(result.allowed).toBe(true);
      expect(callGateway).toHaveBeenCalledTimes(1);
      const callArgs = (callGateway as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe("tool.approval.request");
      expect(callArgs.params.toolName).toBe("exec");
      expect(callArgs.params.riskClass).toBe("R3");
      expect(callArgs.params.requestHash).toBeTruthy();
    });

    it("blocks when approval is denied", async () => {
      const callGateway: GatewayCallFn = vi.fn().mockResolvedValue({
        decision: "deny",
      });
      const result = await evaluateToolApproval("exec", { command: "ls" }, makeCtx(), null, {
        callGateway,
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.code).toBe("TOOL_APPROVAL_BLOCKED");
        expect(result.reason).toBe("approval_denied");
        expect(result.toolName).toBe("exec");
      }
    });

    it("blocks when approval times out (null decision)", async () => {
      const callGateway: GatewayCallFn = vi.fn().mockResolvedValue({
        decision: null,
      });
      const result = await evaluateToolApproval("message", { text: "hello" }, makeCtx(), null, {
        callGateway,
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe("approval_timeout");
      }
    });

    it("allows when approval is allow-always", async () => {
      const callGateway: GatewayCallFn = vi.fn().mockResolvedValue({
        decision: "allow-always",
      });
      const result = await evaluateToolApproval("exec", { command: "npm test" }, makeCtx(), null, {
        callGateway,
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe("policy deny", () => {
    it("denies without gateway call when denyAtOrAbove matches", async () => {
      const callGateway = vi.fn();
      const result = await evaluateToolApproval(
        "exec",
        { command: "rm -rf /" },
        makeCtx({
          policy: { denyAtOrAbove: "R3" },
        }),
        null,
        { callGateway },
      );
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe("policy_deny");
      }
      expect(callGateway).not.toHaveBeenCalled();
    });
  });

  describe("no gateway available", () => {
    it("blocks with approval_request_failed when no callGateway provided", async () => {
      const result = await evaluateToolApproval(
        "exec",
        { command: "ls" },
        makeCtx(),
        null,
        // No callGateway
      );
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe("approval_request_failed");
      }
    });
  });

  describe("gateway call failure", () => {
    it("blocks with approval_request_failed on gateway error", async () => {
      const callGateway: GatewayCallFn = vi.fn().mockRejectedValue(new Error("connection refused"));
      const result = await evaluateToolApproval("exec", { command: "ls" }, makeCtx(), null, {
        callGateway,
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe("approval_request_failed");
      }
    });
  });

  describe("param redaction in gateway call", () => {
    it("redacts sensitive params in paramsSummary", async () => {
      const callGateway: GatewayCallFn = vi.fn().mockResolvedValue({
        decision: "allow-once",
      });
      await evaluateToolApproval("exec", { command: "curl", token: "secret123" }, makeCtx(), null, {
        callGateway,
      });
      const callArgs = (callGateway as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const summary = callArgs.params.paramsSummary;
      expect(summary).not.toContain("secret123");
      expect(summary).toContain("[REDACTED]");
    });

    it("redacts sensitive values nested in arrays", async () => {
      const callGateway: GatewayCallFn = vi.fn().mockResolvedValue({
        decision: "allow-once",
      });
      await evaluateToolApproval(
        "http.request",
        { headers: [{ Authorization: "Bearer secret-token" }], apiKeys: ["key-1", "key-2"] },
        makeCtx(),
        null,
        { callGateway },
      );
      const callArgs = (callGateway as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const summary = callArgs.params.paramsSummary;
      expect(summary).not.toContain("secret-token");
      expect(summary).toContain("[REDACTED]");
    });
  });

  describe("mode=always", () => {
    it("requires approval even for R0 tools", async () => {
      const callGateway: GatewayCallFn = vi.fn().mockResolvedValue({
        decision: "allow-once",
      });
      const result = await evaluateToolApproval(
        "ripgrep",
        { pattern: "test" },
        makeCtx({ mode: "always" }),
        null,
        { callGateway },
      );
      expect(result.allowed).toBe(true);
      expect(callGateway).toHaveBeenCalledTimes(1);
    });
  });
});
