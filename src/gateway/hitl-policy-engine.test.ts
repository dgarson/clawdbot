import { describe, expect, it } from "vitest";
import { createHitlPolicyEngine, createHitlPolicyEngineFromConfig } from "./hitl-policy-engine.js";

describe("hitl-policy-engine", () => {
  it("prefers exact tool match over category fallback", () => {
    const engine = createHitlPolicyEngine({
      policies: [
        { id: "policy-category", category: "node", minApproverRole: "operator" },
        { id: "policy-tool", tool: "nodes.run", category: "node", minApproverRole: "admin" },
      ],
    });

    const resolved = engine.resolvePolicy({ tool: "nodes.run", category: "node" });

    expect(resolved?.id).toBe("policy-tool");
    expect(resolved?.minApproverRole).toBe("admin");
  });

  it("falls back to category when exact tool policy is missing", () => {
    const engine = createHitlPolicyEngine({
      policies: [{ id: "policy-node", category: "node", minApproverRole: "operator" }],
    });

    const resolved = engine.resolvePolicy({ tool: "nodes.invoke", category: "node" });

    expect(resolved?.id).toBe("policy-node");
  });

  it("uses default policy when no exact/category/pattern match exists", () => {
    const engine = createHitlPolicyEngine({
      policies: [{ id: "policy-default", minApproverRole: "operator" }],
      defaultPolicyId: "policy-default",
    });

    const resolved = engine.resolvePolicy({ tool: "unknown.tool", category: "unknown" });

    expect(resolved?.id).toBe("policy-default");
  });

  it("matches wildcard pattern after exact and category checks", () => {
    const engine = createHitlPolicyEngine({
      policies: [
        { id: "policy-pattern", pattern: "file.*", minApproverRole: "operator" },
        { id: "policy-tool", tool: "file.write", minApproverRole: "admin" },
      ],
    });

    expect(engine.resolvePolicy({ tool: "file.write" })?.id).toBe("policy-tool");
    expect(engine.resolvePolicy({ tool: "file.read" })?.id).toBe("policy-pattern");
  });

  it("can be created from approvals config", () => {
    const engine = createHitlPolicyEngineFromConfig({
      hitl: {
        defaultPolicyId: "policy-default",
        policies: [
          { id: "policy-default", minApproverRole: "operator" },
          { id: "policy-run", tool: "nodes.run", minApproverRole: "admin" },
        ],
      },
    });

    expect(engine.resolvePolicy({ tool: "nodes.run" })?.id).toBe("policy-run");
    expect(engine.resolvePolicy({ tool: "unknown" })?.id).toBe("policy-default");
  });

  it("enforces minApproverRole", () => {
    const engine = createHitlPolicyEngine({
      policies: [{ id: "policy-admin", tool: "exec", minApproverRole: "admin" }],
      approverRoleOrder: ["operator", "admin", "owner"],
    });
    const policy = engine.resolvePolicy({ tool: "exec" });

    expect(policy).toBeTruthy();
    expect(
      engine.authorize({
        policy: policy!,
        approverRole: "operator",
      }),
    ).toEqual({ allowed: false, reason: "insufficient-role" });

    expect(
      engine.authorize({
        policy: policy!,
        approverRole: "owner",
      }),
    ).toEqual({ allowed: true });
  });

  it("enforces requireDifferentActor (no-self-approval)", () => {
    const engine = createHitlPolicyEngine({
      policies: [{ id: "policy-different", tool: "exec", requireDifferentActor: true }],
    });
    const policy = engine.resolvePolicy({ tool: "exec" });

    expect(policy).toBeTruthy();
    expect(
      engine.authorize({
        policy: policy!,
        approverActorId: "actor-1",
        requestActorId: "actor-1",
      }),
    ).toEqual({ allowed: false, reason: "same-actor-required-different" });

    expect(
      engine.authorize({
        policy: policy!,
        approverActorId: "actor-2",
        requestActorId: "actor-1",
      }),
    ).toEqual({ allowed: true });
  });

  it("enforces maxApprovalChainDepth (approval-boundary)", () => {
    const engine = createHitlPolicyEngine({
      policies: [{ id: "policy-depth", tool: "exec", maxApprovalChainDepth: 2 }],
    });
    const policy = engine.resolvePolicy({ tool: "exec" });

    expect(policy).toBeTruthy();

    // Depth 0 should be allowed
    expect(
      engine.authorize({
        policy: policy!,
        currentChainDepth: 0,
      }),
    ).toEqual({ allowed: true });

    // Depth 1 should be allowed
    expect(
      engine.authorize({
        policy: policy!,
        currentChainDepth: 1,
      }),
    ).toEqual({ allowed: true });

    // Depth 2 should be denied (exceeds max of 2)
    expect(
      engine.authorize({
        policy: policy!,
        currentChainDepth: 2,
      }),
    ).toEqual({ allowed: false, reason: "approval-chain-exceeded" });
  });

  it("allows unlimited depth when maxApprovalChainDepth is 0", () => {
    const engine = createHitlPolicyEngine({
      policies: [{ id: "policy-unlimited", tool: "exec", maxApprovalChainDepth: 0 }],
    });
    const policy = engine.resolvePolicy({ tool: "exec" });

    expect(policy).toBeTruthy();
    expect(
      engine.authorize({
        policy: policy!,
        currentChainDepth: 100,
      }),
    ).toEqual({ allowed: true });
  });

  describe("escalation", () => {
    it("returns shouldEscalate false when no escalation config", () => {
      const engine = createHitlPolicyEngine({
        policies: [{ id: "policy-basic", tool: "exec" }],
      });
      const policy = engine.resolvePolicy({ tool: "exec" });

      expect(engine.shouldEscalate({ policy: policy!, trigger: "deny" })).toEqual({
        shouldEscalate: false,
      });
    });

    it("escalates on deny when configured", () => {
      const engine = createHitlPolicyEngine({
        policies: [
          {
            id: "policy-escalate",
            tool: "exec",
            escalation: { onDeny: "admin", maxEscalations: 3 },
          },
        ],
        approverRoleOrder: ["viewer", "operator", "admin", "owner"],
      });
      const policy = engine.resolvePolicy({ tool: "exec" });

      expect(engine.shouldEscalate({ policy: policy!, trigger: "deny" })).toEqual({
        shouldEscalate: true,
        escalateToRole: "admin",
        maxEscalations: 3,
      });
    });

    it("escalates on timeout when configured", () => {
      const engine = createHitlPolicyEngine({
        policies: [
          {
            id: "policy-timeout",
            tool: "exec",
            escalation: { onTimeout: "owner", maxEscalations: 2 },
          },
        ],
        approverRoleOrder: ["viewer", "operator", "admin", "owner"],
      });
      const policy = engine.resolvePolicy({ tool: "exec" });

      expect(engine.shouldEscalate({ policy: policy!, trigger: "timeout" })).toEqual({
        shouldEscalate: true,
        escalateToRole: "owner",
        maxEscalations: 2,
      });
    });

    it("does not escalate beyond maxEscalations", () => {
      const engine = createHitlPolicyEngine({
        policies: [
          {
            id: "policy-limit",
            tool: "exec",
            escalation: { onDeny: "admin", maxEscalations: 2 },
          },
        ],
      });
      const policy = engine.resolvePolicy({ tool: "exec" });

      // At maxEscalations, should not escalate
      expect(
        engine.shouldEscalate({ policy: policy!, trigger: "deny", currentEscalationCount: 2 }),
      ).toEqual({ shouldEscalate: false });

      // Just under max, should escalate
      expect(
        engine.shouldEscalate({ policy: policy!, trigger: "deny", currentEscalationCount: 1 }),
      ).toEqual({
        shouldEscalate: true,
        escalateToRole: "admin",
        maxEscalations: 2,
      });
    });

    it("does not escalate to unknown role", () => {
      const engine = createHitlPolicyEngine({
        policies: [
          {
            id: "policy-unknown",
            tool: "exec",
            escalation: { onDeny: "superuser" }, // Not in role order
          },
        ],
        approverRoleOrder: ["viewer", "operator", "admin", "owner"],
      });
      const policy = engine.resolvePolicy({ tool: "exec" });

      expect(engine.shouldEscalate({ policy: policy!, trigger: "deny" })).toEqual({
        shouldEscalate: false,
      });
    });
  });
});
