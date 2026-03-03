import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetAllocation, BudgetUsage } from "./types.js";

vi.mock("openclaw/plugin-sdk", () => ({
  emitAgentEvent: vi.fn(),
}));

const { registerTrackerHook } = await import("./tracker.js");
const { PriceTable } = await import("./price-table.js");
const { resetAlerts } = await import("./alerts.js");

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

function makeAllocation(overrides: Partial<BudgetAllocation> = {}): BudgetAllocation {
  return {
    scope: { level: "agent", id: "test-agent", parentId: "default" },
    window: { kind: "daily" },
    limits: { maxCostUsd: 10 },
    breachAction: "warn",
    alertAt: [0.5, 0.8, 0.95],
    ...overrides,
  };
}

function createMockScopeResolver(allocations: BudgetAllocation[]) {
  return {
    resolveScopes: vi.fn().mockReturnValue(allocations),
    getAllocation: vi.fn(),
    listScopes: vi.fn().mockReturnValue([]),
    setAllocation: vi.fn(),
    toJSON: vi.fn().mockReturnValue("{}"),
  };
}

describe("tracker", () => {
  let hookHandler: (event: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAlerts();
  });

  it("accumulates usage across scopes", async () => {
    const agentAlloc = makeAllocation();
    const orgAlloc = makeAllocation({
      scope: { level: "organization", id: "org-1", parentId: "system" },
      limits: { maxCostUsd: 100 },
    });

    const api = createMockApi();
    const scopeResolver = createMockScopeResolver([agentAlloc, orgAlloc]);
    const priceTable = new PriceTable();

    const ledger = {
      accumulateUsage: vi.fn(),
      getCurrentUsage: vi.fn().mockReturnValue({
        scope: agentAlloc.scope,
        windowStart: "2026-02-24T00:00:00.000Z",
        windowEnd: "2026-02-25T00:00:00.000Z",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        runCount: 0,
        utilizationPct: {},
      } satisfies BudgetUsage),
    };

    const config = {
      enforcement: "hard" as const,
      defaultWindow: "daily" as const,
      priceTableFile: "price-table.json",
      alertDelivery: "broadcast" as const,
      alertWebhookUrl: "",
      hierarchyFile: "budget-hierarchy.json",
    };

    registerTrackerHook(api as never, scopeResolver as never, ledger as never, priceTable, config);

    const onCall = api.on.mock.calls[0];
    expect(onCall[0]).toBe("llm_output");
    hookHandler = onCall[1] as typeof hookHandler;

    await hookHandler(
      {
        runId: "run-1",
        model: "gpt-4.1",
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      },
      { agentId: "test-agent" },
    );

    // Should accumulate into both agent and org scopes
    expect(ledger.accumulateUsage).toHaveBeenCalledTimes(2);
  });

  it("estimates cost from price table when no provider cost given", async () => {
    const agentAlloc = makeAllocation();
    const api = createMockApi();
    const scopeResolver = createMockScopeResolver([agentAlloc]);
    const priceTable = new PriceTable();

    let capturedUsage: Record<string, unknown> | undefined;
    const ledger = {
      accumulateUsage: vi.fn().mockImplementation((_alloc, usage) => {
        capturedUsage = usage;
      }),
      getCurrentUsage: vi.fn().mockReturnValue({
        scope: agentAlloc.scope,
        windowStart: "2026-02-24T00:00:00.000Z",
        windowEnd: "2026-02-25T00:00:00.000Z",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        runCount: 0,
        utilizationPct: {},
      } satisfies BudgetUsage),
    };

    const config = {
      enforcement: "hard" as const,
      defaultWindow: "daily" as const,
      priceTableFile: "price-table.json",
      alertDelivery: "broadcast" as const,
      alertWebhookUrl: "",
      hierarchyFile: "budget-hierarchy.json",
    };

    registerTrackerHook(api as never, scopeResolver as never, ledger as never, priceTable, config);

    hookHandler = api.on.mock.calls[0][1] as typeof hookHandler;

    // gpt-4.1 pricing: input $0.002/1k, output $0.008/1k
    await hookHandler(
      {
        runId: "run-2",
        model: "gpt-4.1",
        inputTokens: 1000,
        outputTokens: 1000,
      },
      { agentId: "test-agent" },
    );

    expect(capturedUsage).toBeDefined();
    // 1000 input at $0.002/1k = $0.002, 1000 output at $0.008/1k = $0.008
    expect(capturedUsage!.estimatedCostUsd).toBeCloseTo(0.01, 5);
  });

  it("falls back to event.usage.input/output when top-level tokens not provided", async () => {
    const agentAlloc = makeAllocation();
    const api = createMockApi();
    const scopeResolver = createMockScopeResolver([agentAlloc]);
    const priceTable = new PriceTable();

    let capturedUsage: Record<string, unknown> | undefined;
    const ledger = {
      accumulateUsage: vi.fn().mockImplementation((_alloc, usage) => {
        capturedUsage = usage;
      }),
      getCurrentUsage: vi.fn().mockReturnValue({
        scope: agentAlloc.scope,
        windowStart: "2026-02-24T00:00:00.000Z",
        windowEnd: "2026-02-25T00:00:00.000Z",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        runCount: 0,
        utilizationPct: {},
      } satisfies BudgetUsage),
    };

    const config = {
      enforcement: "hard" as const,
      defaultWindow: "daily" as const,
      priceTableFile: "price-table.json",
      alertDelivery: "broadcast" as const,
      alertWebhookUrl: "",
      hierarchyFile: "budget-hierarchy.json",
    };

    registerTrackerHook(api as never, scopeResolver as never, ledger as never, priceTable, config);

    hookHandler = api.on.mock.calls[0][1] as typeof hookHandler;

    // No top-level inputTokens/outputTokens, only event.usage.input/output
    await hookHandler(
      {
        runId: "run-3",
        model: "gpt-4.1-mini",
        usage: { input: 500, output: 200 },
      },
      { agentId: "test-agent" },
    );

    expect(capturedUsage).toBeDefined();
    expect(capturedUsage!.inputTokens).toBe(500);
    expect(capturedUsage!.outputTokens).toBe(200);
    expect(capturedUsage!.totalTokens).toBe(700);
  });
});
