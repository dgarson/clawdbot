import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WorkerConfig } from "../../config/types.agents.js";
import type { WorkItem } from "../types.js";
import type { GatewayCallFn, WorkflowLogger } from "./types.js";
import { WorkerWorkflowEngine } from "./engine.js";

// Mock all workflow phases.
vi.mock("./phases/plan.js", () => ({
  runPlanPhase: vi.fn().mockResolvedValue({
    intent: "Test intent",
    scope: "Test scope",
    discoveryQuestions: ["What files exist?"],
    constraints: ["Stay focused"],
    successCriteria: ["Tests pass"],
    estimatedComplexity: "medium" as const,
  }),
}));

vi.mock("./phases/review.js", () => ({
  runReviewPhase: vi.fn().mockResolvedValue({
    plan: {
      intent: "Test intent",
      scope: "Test scope",
      discoveryQuestions: ["What files exist?"],
      constraints: ["Stay focused"],
      successCriteria: ["Tests pass"],
      estimatedComplexity: "medium" as const,
    },
    iterations: [{ iteration: 1, approved: true, feedback: "LGTM" }],
  }),
}));

vi.mock("./phases/discover.js", () => ({
  runDiscoveryPhase: vi.fn().mockResolvedValue([
    {
      question: "What files exist?",
      runId: "r1",
      sessionKey: "s1",
      status: "ok" as const,
      findings: "Found src/main.ts",
      keyInsights: ["Entry point is main.ts"],
    },
  ]),
}));

vi.mock("./phases/decompose.js", () => ({
  runDecomposePhase: vi.fn().mockResolvedValue({
    planVersion: 1,
    phases: [
      {
        id: "p1",
        name: "Phase 1",
        status: "todo",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tasks: [
          {
            id: "t1",
            name: "Task 1",
            status: "todo",
            acceptanceCriteria: ["Done"],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            subtasks: [
              {
                id: "s1",
                name: "Subtask 1",
                objective: "Do thing",
                acceptanceCriteria: ["Thing done"],
                status: "todo",
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          },
        ],
      },
    ],
  }),
}));

vi.mock("./phases/execute.js", () => ({
  runExecutePhase: vi.fn().mockResolvedValue({
    totalNodes: 1,
    completedNodes: 1,
    failedNodes: 0,
  }),
}));

function makeWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "wi-1",
    queueId: "q-1",
    title: "Test work item",
    description: "A test task",
    status: "in_progress",
    priority: "medium",
    workstream: "test-stream",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("WorkerWorkflowEngine", () => {
  const mockLog: WorkflowLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const mockCallGateway = vi.fn().mockResolvedValue({});

  const config: WorkerConfig = {
    enabled: true,
    thinking: "high",
    workflow: { enabled: true },
  };

  let engine: WorkerWorkflowEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new WorkerWorkflowEngine({
      agentId: "test-agent",
      config,
      deps: {
        callGateway: mockCallGateway as GatewayCallFn,
        log: mockLog,
      },
    });
  });

  it("executes full workflow pipeline", async () => {
    const item = makeWorkItem();
    const state = await engine.executeWorkflow(item);

    expect(state.phase).toBe("completed");
    expect(state.workItemId).toBe("wi-1");
    expect(state.plan).toBeDefined();
    expect(state.plan!.intent).toBe("Test intent");
    expect(state.reviewIterations).toHaveLength(1);
    expect(state.discoveryResults).toHaveLength(1);
    expect(state.dag).toBeDefined();
    expect(state.executionProgress).toBeDefined();
    expect(state.executionProgress!.completedNodes).toBe(1);
    expect(state.completedAt).toBeDefined();
    expect(state.error).toBeUndefined();
  });

  it("captures error in workflow state on failure", async () => {
    const { runPlanPhase } = await import("./phases/plan.js");
    vi.mocked(runPlanPhase).mockRejectedValueOnce(new Error("planner exploded"));

    const item = makeWorkItem();
    const state = await engine.executeWorkflow(item);

    expect(state.phase).toBe("failed");
    expect(state.error).toContain("planner exploded");
    expect(state.completedAt).toBeDefined();
  });

  it("skips review when disabled", async () => {
    const noReviewConfig: WorkerConfig = {
      enabled: true,
      workflow: {
        enabled: true,
        review: { enabled: false },
      },
    };

    const noReviewEngine = new WorkerWorkflowEngine({
      agentId: "test-agent",
      config: noReviewConfig,
      deps: {
        callGateway: mockCallGateway as GatewayCallFn,
        log: mockLog,
      },
    });

    const item = makeWorkItem();
    const state = await noReviewEngine.executeWorkflow(item);

    expect(state.phase).toBe("completed");
    // Review iterations should be empty since review was skipped.
    expect(state.reviewIterations).toHaveLength(0);
  });

  it("skips discovery when no questions", async () => {
    const { runPlanPhase } = await import("./phases/plan.js");
    vi.mocked(runPlanPhase).mockResolvedValueOnce({
      intent: "No discovery needed",
      scope: "Small scope",
      discoveryQuestions: [],
      constraints: [],
      successCriteria: ["Done"],
      estimatedComplexity: "low",
    });

    // Also mock review to return the plan with no discovery questions.
    const { runReviewPhase } = await import("./phases/review.js");
    vi.mocked(runReviewPhase).mockResolvedValueOnce({
      plan: {
        intent: "No discovery needed",
        scope: "Small scope",
        discoveryQuestions: [],
        constraints: [],
        successCriteria: ["Done"],
        estimatedComplexity: "low",
      },
      iterations: [{ iteration: 1, approved: true, feedback: "OK" }],
    });

    const item = makeWorkItem();
    const state = await engine.executeWorkflow(item);

    expect(state.phase).toBe("completed");
    expect(state.discoveryResults).toHaveLength(0);
  });
});
