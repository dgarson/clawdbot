import { describe, expect, it, vi, afterEach } from "vitest";
import { selectPolicy, buildMatchContext, buildModelRouteResult } from "./model-router.js";
import type { MatchContext } from "./model-router.js";
import type { RoutingPolicy, RoutingCondition, ClassificationResult } from "./types.js";

// Helper to build a single-condition policy for testing individual condition kinds.
function policyWith(condition: RoutingCondition, id = "test", priority = 1): RoutingPolicy {
  return {
    id,
    conditions: [condition],
    target: { model: `model-${id}` },
    priority,
  };
}

// ---------------------------------------------------------------------------
// Individual condition kinds
// ---------------------------------------------------------------------------

describe("matchCondition - agent", () => {
  it("matches when agentId equals", () => {
    const policy = policyWith({ kind: "agent", agentId: "a1" });
    const ctx: MatchContext = { agentId: "a1" };
    expect(selectPolicy([policy], ctx)).toBe(policy);
  });

  it("does not match when agentId differs", () => {
    const policy = policyWith({ kind: "agent", agentId: "a1" });
    const ctx: MatchContext = { agentId: "a2" };
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });
});

describe("matchCondition - channel", () => {
  it("matches when channel equals", () => {
    const policy = policyWith({ kind: "channel", channel: "telegram" });
    const ctx: MatchContext = { channel: "telegram" };
    expect(selectPolicy([policy], ctx)).toBe(policy);
  });

  it("does not match when channel differs", () => {
    const policy = policyWith({ kind: "channel", channel: "telegram" });
    const ctx: MatchContext = { channel: "discord" };
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });
});

describe("matchCondition - classification", () => {
  it("matches when classification label equals", () => {
    const policy = policyWith({ kind: "classification", label: "code" });
    const classification: ClassificationResult = {
      label: "code",
      confidence: 0.9,
      method: "heuristic",
    };
    const ctx: MatchContext = { classification };
    expect(selectPolicy([policy], ctx)).toBe(policy);
  });

  it("does not match when classification label differs", () => {
    const policy = policyWith({ kind: "classification", label: "code" });
    const classification: ClassificationResult = {
      label: "simple",
      confidence: 0.9,
      method: "heuristic",
    };
    const ctx: MatchContext = { classification };
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });

  it("does not match when classification is undefined", () => {
    const policy = policyWith({ kind: "classification", label: "code" });
    const ctx: MatchContext = {};
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });
});

describe("matchCondition - budget_remaining", () => {
  it("matches gt when budget > threshold", () => {
    const policy = policyWith({ kind: "budget_remaining", operator: "gt", threshold: 0.5 });
    const ctx: MatchContext = { budgetRemaining: 0.8 };
    expect(selectPolicy([policy], ctx)).toBe(policy);
  });

  it("does not match gt when budget <= threshold", () => {
    const policy = policyWith({ kind: "budget_remaining", operator: "gt", threshold: 0.5 });
    const ctx: MatchContext = { budgetRemaining: 0.5 };
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });

  it("matches lt when budget < threshold", () => {
    const policy = policyWith({ kind: "budget_remaining", operator: "lt", threshold: 0.3 });
    const ctx: MatchContext = { budgetRemaining: 0.1 };
    expect(selectPolicy([policy], ctx)).toBe(policy);
  });

  it("does not match lt when budget >= threshold", () => {
    const policy = policyWith({ kind: "budget_remaining", operator: "lt", threshold: 0.3 });
    const ctx: MatchContext = { budgetRemaining: 0.3 };
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });

  it("does not match when budgetRemaining is undefined", () => {
    const policy = policyWith({ kind: "budget_remaining", operator: "gt", threshold: 0.5 });
    const ctx: MatchContext = {};
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });
});

describe("matchCondition - tool_count", () => {
  it("matches gt when toolCount > threshold", () => {
    const policy = policyWith({ kind: "tool_count", operator: "gt", threshold: 3 });
    const ctx: MatchContext = { toolCount: 5 };
    expect(selectPolicy([policy], ctx)).toBe(policy);
  });

  it("does not match gt when toolCount <= threshold", () => {
    const policy = policyWith({ kind: "tool_count", operator: "gt", threshold: 3 });
    const ctx: MatchContext = { toolCount: 3 };
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });

  it("matches lt when toolCount < threshold", () => {
    const policy = policyWith({ kind: "tool_count", operator: "lt", threshold: 5 });
    const ctx: MatchContext = { toolCount: 2 };
    expect(selectPolicy([policy], ctx)).toBe(policy);
  });

  it("does not match lt when toolCount >= threshold", () => {
    const policy = policyWith({ kind: "tool_count", operator: "lt", threshold: 5 });
    const ctx: MatchContext = { toolCount: 5 };
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });

  it("does not match when toolCount is undefined", () => {
    const policy = policyWith({ kind: "tool_count", operator: "gt", threshold: 3 });
    const ctx: MatchContext = {};
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });
});

describe("matchCondition - hour_of_day", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("matches within a normal range (from < to)", () => {
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(14);
    const policy = policyWith({ kind: "hour_of_day", from: 9, to: 17 });
    expect(selectPolicy([policy], {})).toBe(policy);
  });

  it("does not match outside a normal range", () => {
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(8);
    const policy = policyWith({ kind: "hour_of_day", from: 9, to: 17 });
    expect(selectPolicy([policy], {})).toBeUndefined();
  });

  it("does not match at the exact to boundary (exclusive)", () => {
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(17);
    const policy = policyWith({ kind: "hour_of_day", from: 9, to: 17 });
    expect(selectPolicy([policy], {})).toBeUndefined();
  });

  it("matches at the exact from boundary (inclusive)", () => {
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(9);
    const policy = policyWith({ kind: "hour_of_day", from: 9, to: 17 });
    expect(selectPolicy([policy], {})).toBe(policy);
  });

  it("matches wrapping range (from > to) - late night", () => {
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(23);
    const policy = policyWith({ kind: "hour_of_day", from: 22, to: 6 });
    expect(selectPolicy([policy], {})).toBe(policy);
  });

  it("matches wrapping range (from > to) - early morning", () => {
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(3);
    const policy = policyWith({ kind: "hour_of_day", from: 22, to: 6 });
    expect(selectPolicy([policy], {})).toBe(policy);
  });

  it("does not match wrapping range outside both sides", () => {
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(12);
    const policy = policyWith({ kind: "hour_of_day", from: 22, to: 6 });
    expect(selectPolicy([policy], {})).toBeUndefined();
  });

  it("does not match wrapping range at to boundary (exclusive)", () => {
    vi.spyOn(Date.prototype, "getHours").mockReturnValue(6);
    const policy = policyWith({ kind: "hour_of_day", from: 22, to: 6 });
    expect(selectPolicy([policy], {})).toBeUndefined();
  });
});

describe("matchCondition - session_depth", () => {
  it("matches gt when sessionDepth > threshold", () => {
    const policy = policyWith({ kind: "session_depth", operator: "gt", threshold: 10 });
    const ctx: MatchContext = { sessionDepth: 15 };
    expect(selectPolicy([policy], ctx)).toBe(policy);
  });

  it("does not match gt when sessionDepth <= threshold", () => {
    const policy = policyWith({ kind: "session_depth", operator: "gt", threshold: 10 });
    const ctx: MatchContext = { sessionDepth: 10 };
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });

  it("matches lt when sessionDepth < threshold", () => {
    const policy = policyWith({ kind: "session_depth", operator: "lt", threshold: 10 });
    const ctx: MatchContext = { sessionDepth: 5 };
    expect(selectPolicy([policy], ctx)).toBe(policy);
  });

  it("does not match lt when sessionDepth >= threshold", () => {
    const policy = policyWith({ kind: "session_depth", operator: "lt", threshold: 10 });
    const ctx: MatchContext = { sessionDepth: 10 };
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });

  it("does not match when sessionDepth is undefined", () => {
    const policy = policyWith({ kind: "session_depth", operator: "gt", threshold: 10 });
    const ctx: MatchContext = {};
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// selectPolicy (multi-policy)
// ---------------------------------------------------------------------------

describe("selectPolicy", () => {
  it("returns undefined when no policies match", () => {
    const policy = policyWith({ kind: "agent", agentId: "a1" }, "p1", 1);
    const ctx: MatchContext = { agentId: "a2" };
    expect(selectPolicy([policy], ctx)).toBeUndefined();
  });

  it("returns the matching policy", () => {
    const policy = policyWith({ kind: "agent", agentId: "a1" }, "p1", 1);
    const ctx: MatchContext = { agentId: "a1" };
    expect(selectPolicy([policy], ctx)).toBe(policy);
  });

  it("returns the highest priority when multiple policies match", () => {
    const low = policyWith({ kind: "agent", agentId: "a1" }, "low", 1);
    const high = policyWith({ kind: "agent", agentId: "a1" }, "high", 10);
    const mid = policyWith({ kind: "agent", agentId: "a1" }, "mid", 5);
    const ctx: MatchContext = { agentId: "a1" };
    expect(selectPolicy([low, high, mid], ctx)?.id).toBe("high");
  });

  it("requires ALL conditions to match", () => {
    const policy: RoutingPolicy = {
      id: "multi",
      conditions: [
        { kind: "agent", agentId: "a1" },
        { kind: "channel", channel: "telegram" },
      ],
      target: { model: "m1" },
      priority: 1,
    };
    // Only agentId matches
    expect(selectPolicy([policy], { agentId: "a1", channel: "discord" })).toBeUndefined();
    // Both match
    expect(selectPolicy([policy], { agentId: "a1", channel: "telegram" })).toBe(policy);
  });

  it("rejects a policy with no conditions (safety guard)", () => {
    const policy: RoutingPolicy = {
      id: "empty",
      conditions: [],
      target: { model: "m1" },
      priority: 1,
    };
    expect(selectPolicy([policy], {})).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildModelRouteResult
// ---------------------------------------------------------------------------

describe("buildModelRouteResult", () => {
  const config = {
    defaultModel: "",
    classifierModel: "",
    heuristicConfidenceThreshold: 0.7,
    policyFile: "",
    contributorsFile: "",
  };

  it("returns policy target when policy matches", () => {
    const policy: RoutingPolicy = {
      id: "p1",
      conditions: [{ kind: "agent", agentId: "a1" }],
      target: { model: "gpt-4", provider: "openai" },
      priority: 1,
    };
    const result = buildModelRouteResult(policy, config);
    expect(result).toEqual({
      modelOverride: "gpt-4",
      providerOverride: "openai",
      policyId: "p1",
    });
  });

  it("returns default model when no policy matches but default is set", () => {
    const result = buildModelRouteResult(undefined, { ...config, defaultModel: "gpt-3.5" });
    expect(result).toEqual({ modelOverride: "gpt-3.5" });
  });

  it("returns undefined when no policy and no default model", () => {
    const result = buildModelRouteResult(undefined, config);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildMatchContext
// ---------------------------------------------------------------------------

describe("buildMatchContext", () => {
  it("builds context from hook event and agent context", () => {
    const classification: ClassificationResult = {
      label: "code",
      confidence: 0.9,
      method: "heuristic",
    };
    const ctx = buildMatchContext(
      { prompt: "test" },
      { agentId: "a1", sessionKey: "s1", messageProvider: "telegram" },
      classification,
    );
    expect(ctx.agentId).toBe("a1");
    expect(ctx.channel).toBe("telegram");
    expect(ctx.classification).toBe(classification);
  });

  it("handles missing context fields", () => {
    const ctx = buildMatchContext({ prompt: "test" }, {}, undefined);
    expect(ctx.agentId).toBeUndefined();
    expect(ctx.channel).toBeUndefined();
    expect(ctx.classification).toBeUndefined();
  });
});
