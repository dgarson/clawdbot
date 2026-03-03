import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetAllocation } from "./types.js";

/**
 * The evaluateAdmission function is not exported directly. To test it in isolation
 * we reconstruct the same logic using the public building blocks:
 * ScopeResolver + Ledger + config enforcement modes.
 *
 * We test via registerAdmissionHook by capturing the hook handler output.
 */

// Minimal mock types matching the plugin API surface used by admission.ts
type MockApi = {
  on: ReturnType<typeof vi.fn>;
  logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
};

function createMockApi(): MockApi {
  return {
    on: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}

// Build a ScopeResolver-like object with controllable allocations
function createMockScopeResolver(allocations: BudgetAllocation[]) {
  return {
    resolveScopes: vi.fn().mockReturnValue(allocations),
    getAllocation: vi.fn(),
    listScopes: vi.fn().mockReturnValue([]),
    setAllocation: vi.fn(),
    toJSON: vi.fn().mockReturnValue("{}"),
  };
}

// Build a Ledger-like object with controllable usage
function createMockLedger(usageByScope: Map<string, { utilizationPct: Record<string, number> }>) {
  return {
    getCurrentUsage: vi.fn().mockImplementation((allocation: BudgetAllocation) => {
      const key = `${allocation.scope.level}:${allocation.scope.id}`;
      const usage = usageByScope.get(key);
      return {
        scope: allocation.scope,
        windowStart: "2026-02-24T00:00:00.000Z",
        windowEnd: "2026-02-25T00:00:00.000Z",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        runCount: 0,
        utilizationPct: usage?.utilizationPct ?? {},
      };
    }),
    accumulateUsage: vi.fn(),
    getHistoricalUsage: vi.fn().mockResolvedValue([]),
  };
}

function makeAllocation(overrides: Partial<BudgetAllocation> = {}): BudgetAllocation {
  return {
    scope: { level: "agent", id: "test-agent", parentId: "default" },
    window: { kind: "daily" },
    limits: { maxCostUsd: 10 },
    breachAction: "block",
    alertAt: [0.5, 0.8, 0.95],
    ...overrides,
  };
}

// We need to mock emitAgentEvent before importing the module under test
vi.mock("openclaw/plugin-sdk", () => ({
  emitAgentEvent: vi.fn(),
}));

// Now import the module under test
const { registerAdmissionHook } = await import("./admission.js");

describe("admission", () => {
  let hookHandler: (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown;

  function setup(
    allocations: BudgetAllocation[],
    usageByScope: Map<string, { utilizationPct: Record<string, number> }>,
    enforcement: "read-only" | "soft" | "hard" = "hard",
  ) {
    const api = createMockApi();
    const scopeResolver = createMockScopeResolver(allocations);
    const ledger = createMockLedger(usageByScope);
    const config = {
      enforcement,
      defaultWindow: "daily" as const,
      priceTableFile: "price-table.json",
      alertDelivery: "broadcast" as const,
      alertWebhookUrl: "",
      hierarchyFile: "budget-hierarchy.json",
    };

    registerAdmissionHook(api as never, scopeResolver as never, ledger as never, config);

    // Extract the registered hook handler
    const onCall = api.on.mock.calls[0];
    expect(onCall[0]).toBe("before_model_resolve");
    hookHandler = onCall[1] as typeof hookHandler;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows when under budget", () => {
    const alloc = makeAllocation();
    const usageMap = new Map([["agent:test-agent", { utilizationPct: { costUsd: 0.3 } }]]);

    setup([alloc], usageMap, "hard");

    const result = hookHandler({ prompt: "hello" }, { agentId: "test-agent" });
    // Allow returns undefined (no model override)
    expect(result).toBeUndefined();
  });

  it("returns degrade decision when soft limit hit with degradeModel", () => {
    const alloc = makeAllocation({ breachAction: "degrade", degradeModel: "gpt-4.1-mini" });
    const usageMap = new Map([["agent:test-agent", { utilizationPct: { costUsd: 1.05 } }]]);

    setup([alloc], usageMap, "hard");

    const result = hookHandler({ prompt: "hello" }, { agentId: "test-agent" }) as {
      modelOverride?: string;
    };
    expect(result).toBeDefined();
    expect(result.modelOverride).toBe("gpt-4.1-mini");
  });

  it("returns block decision when hard limit hit", () => {
    const alloc = makeAllocation({ breachAction: "block" });
    const usageMap = new Map([["agent:test-agent", { utilizationPct: { costUsd: 1.2 } }]]);

    setup([alloc], usageMap, "hard");

    const result = hookHandler({ prompt: "hello" }, { agentId: "test-agent" }) as {
      modelOverride?: string;
    };
    expect(result).toBeDefined();
    expect(result.modelOverride).toContain("__budget_blocked__");
  });

  it("always allows in read-only mode regardless of utilization", () => {
    const alloc = makeAllocation({ breachAction: "block" });
    const usageMap = new Map([["agent:test-agent", { utilizationPct: { costUsd: 5.0 } }]]);

    setup([alloc], usageMap, "read-only");

    const result = hookHandler({ prompt: "hello" }, { agentId: "test-agent" });
    expect(result).toBeUndefined();
  });

  it("degrades instead of blocking in soft enforcement mode with degradeModel", () => {
    const alloc = makeAllocation({ breachAction: "block", degradeModel: "gpt-4.1-nano" });
    const usageMap = new Map([["agent:test-agent", { utilizationPct: { costUsd: 1.5 } }]]);

    setup([alloc], usageMap, "soft");

    const result = hookHandler({ prompt: "hello" }, { agentId: "test-agent" }) as {
      modelOverride?: string;
    };
    expect(result).toBeDefined();
    expect(result.modelOverride).toBe("gpt-4.1-nano");
  });
});
