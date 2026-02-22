import { describe, expect, it } from "vitest";
import { createHitlPolicyEngine } from "./hitl-policy-engine.js";

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

  it("uses default policy when no exact or category match exists", () => {
    const engine = createHitlPolicyEngine({
      policies: [{ id: "policy-default", minApproverRole: "operator" }],
      defaultPolicyId: "policy-default",
    });

    const resolved = engine.resolvePolicy({ tool: "unknown.tool", category: "unknown" });

    expect(resolved?.id).toBe("policy-default");
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

  it("enforces requireDifferentActor", () => {
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
});
