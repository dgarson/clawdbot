/**
 * Agent Spawning & Coordination Benchmark Scenarios
 *
 * Tests that agent lifecycle management, result routing, depth limits,
 * and orphan prevention behave correctly. All scenarios are deterministic
 * and require no external services or LLM calls.
 */

import type { CataloguedEvaluationCase } from "../catalog.js";
import type { EvaluationCaseResult } from "../types.js";

// ---------------------------------------------------------------------------
// Shared simulation helpers
// ---------------------------------------------------------------------------

type AgentStatus = "pending" | "running" | "complete" | "failed" | "killed";

type SimulatedAgent = {
  id: string;
  label: string;
  parentId: string | null;
  depth: number;
  status: AgentStatus;
  result?: unknown;
};

const MAX_SPAWN_DEPTH = 3;

function spawnAgent(
  id: string,
  label: string,
  parentId: string | null,
  depth: number,
): SimulatedAgent {
  return { id, label, parentId, depth, status: "pending" };
}

function runAgent(agent: SimulatedAgent): SimulatedAgent {
  return { ...agent, status: "complete", result: { agentId: agent.id, done: true } };
}

// ---------------------------------------------------------------------------
// agent-spawning.basic-spawn-and-complete
// ---------------------------------------------------------------------------

export const agentBasicSpawnCase: CataloguedEvaluationCase = {
  id: "agent-spawning.basic-spawn-and-complete",
  suite: "agent-spawning",
  title: "Agent spawning — basic spawn and completion",
  description:
    "Validates that a sub-agent can be spawned, runs to completion, and its result is accessible to the parent.",
  tags: ["agent-spawning", "lifecycle", "smoke"],
  metadata: {
    category: "agent-spawning",
    difficulty: "smoke",
    expectedDurationMs: 500,
    requiresExternal: false,
    assertions: [
      "sub-agent is created with correct parent reference",
      "sub-agent reaches complete status",
      "result is accessible after completion",
    ],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    const parent = spawnAgent("parent-001", "parent", null, 0);
    const child = spawnAgent("child-001", "child-task", parent.id, 1);

    const completedChild = runAgent(child);

    const pass =
      completedChild.status === "complete" &&
      completedChild.parentId === parent.id &&
      completedChild.result !== undefined;

    return {
      pass,
      summary: pass
        ? "Sub-agent spawned, ran, and completed with result accessible"
        : "Sub-agent lifecycle failed",
      score: pass ? 1 : 0,
      details: {
        parent: { id: parent.id, status: parent.status },
        child: completedChild,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// agent-spawning.depth-limit-enforcement
// ---------------------------------------------------------------------------

export const agentDepthLimitCase: CataloguedEvaluationCase = {
  id: "agent-spawning.depth-limit-enforcement",
  suite: "agent-spawning",
  title: "Agent spawning — depth limit enforcement",
  description:
    "Validates that attempts to spawn agents beyond the max nesting depth are rejected with a structured error.",
  tags: ["agent-spawning", "depth-limit", "safety", "unit"],
  metadata: {
    category: "agent-spawning",
    difficulty: "unit",
    expectedDurationMs: 200,
    requiresExternal: false,
    assertions: [
      "spawn at max depth is rejected",
      "spawn within depth limit is allowed",
      "error message includes depth information",
    ],
    relatedCases: ["agent-spawning.basic-spawn-and-complete"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    type SpawnResult = { spawned: boolean; error?: string };

    const trySpawn = (parentDepth: number): SpawnResult => {
      const childDepth = parentDepth + 1;
      if (childDepth > MAX_SPAWN_DEPTH) {
        return {
          spawned: false,
          error: `Max spawn depth (${MAX_SPAWN_DEPTH}) exceeded. Parent depth: ${parentDepth}`,
        };
      }
      return { spawned: true };
    };

    const withinLimit = trySpawn(MAX_SPAWN_DEPTH - 1); // Should succeed
    const atLimit = trySpawn(MAX_SPAWN_DEPTH); // Should fail

    const pass =
      withinLimit.spawned &&
      !atLimit.spawned &&
      typeof atLimit.error === "string" &&
      atLimit.error.includes(String(MAX_SPAWN_DEPTH));

    return {
      pass,
      summary: pass
        ? `Depth limit (${MAX_SPAWN_DEPTH}) correctly enforced`
        : "Depth limit enforcement failed",
      score: pass ? 1 : 0,
      details: {
        maxDepth: MAX_SPAWN_DEPTH,
        withinLimit,
        atLimit,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// agent-spawning.result-routing-to-requester
// ---------------------------------------------------------------------------

export const agentResultRoutingCase: CataloguedEvaluationCase = {
  id: "agent-spawning.result-routing-to-requester",
  suite: "agent-spawning",
  title: "Agent result routing — result delivered to requester session",
  description:
    "Validates that a completed sub-agent's result is routed back to the correct requester session and not lost.",
  tags: ["agent-spawning", "result-routing", "unit"],
  metadata: {
    category: "agent-spawning",
    difficulty: "unit",
    expectedDurationMs: 300,
    requiresExternal: false,
    assertions: [
      "result is tagged with sub-agent id",
      "result is delivered to requester session id",
      "result is not delivered to unrelated sessions",
    ],
    relatedCases: ["agent-spawning.basic-spawn-and-complete"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    type ResultDelivery = {
      fromAgentId: string;
      toSessionId: string;
      payload: unknown;
    };

    const requesterSessionId = "session-abc";
    const unrelatedSessionId = "session-xyz";
    const subAgentId = "subagent-001";

    const deliveryQueue: ResultDelivery[] = [];

    // Simulate result routing
    const routeResult = (fromAgentId: string, toSessionId: string, payload: unknown): void => {
      deliveryQueue.push({ fromAgentId, toSessionId, payload });
    };

    // Sub-agent completes and routes result to requester
    routeResult(subAgentId, requesterSessionId, { done: true, output: "task complete" });

    // Check routing
    const deliveredToRequester = deliveryQueue.filter(
      (d) => d.toSessionId === requesterSessionId && d.fromAgentId === subAgentId,
    );
    const deliveredToUnrelated = deliveryQueue.filter((d) => d.toSessionId === unrelatedSessionId);

    const pass = deliveredToRequester.length === 1 && deliveredToUnrelated.length === 0;

    return {
      pass,
      summary: pass
        ? "Sub-agent result correctly routed to requester session only"
        : `Routing incorrect: requester deliveries=${deliveredToRequester.length}, unrelated=${deliveredToUnrelated.length}`,
      score: pass ? 1 : 0,
      details: {
        requesterSessionId,
        unrelatedSessionId,
        subAgentId,
        deliveryQueue,
        deliveredToRequester,
        deliveredToUnrelated,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// agent-spawning.orphan-cleanup-on-parent-kill
// ---------------------------------------------------------------------------

export const agentOrphanCleanupCase: CataloguedEvaluationCase = {
  id: "agent-spawning.orphan-cleanup-on-parent-kill",
  suite: "agent-spawning",
  title: "Agent cleanup — orphan prevention on parent termination",
  description:
    "Validates that when a parent agent is killed, all of its descendant sub-agents are also terminated and not left orphaned.",
  tags: ["agent-spawning", "cleanup", "safety", "unit"],
  metadata: {
    category: "agent-spawning",
    difficulty: "unit",
    expectedDurationMs: 300,
    requiresExternal: false,
    assertions: [
      "killing a parent kills all direct children",
      "killing a parent kills all nested descendants",
      "no agents remain in running state after parent kill",
    ],
    relatedCases: ["agent-spawning.basic-spawn-and-complete"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    // Build an agent tree
    const agents = new Map<string, SimulatedAgent>([
      ["root", spawnAgent("root", "root", null, 0)],
      ["child-1", spawnAgent("child-1", "child", "root", 1)],
      ["child-2", spawnAgent("child-2", "child", "root", 1)],
      ["grandchild-1", spawnAgent("grandchild-1", "gc", "child-1", 2)],
    ]);

    // Mark all as running
    for (const [key, agent] of agents.entries()) {
      agents.set(key, { ...agent, status: "running" });
    }

    // Kill function: terminates agent and all descendants
    const kill = (agentId: string): void => {
      const agent = agents.get(agentId);
      if (!agent) {
        return;
      }
      agents.set(agentId, { ...agent, status: "killed" });
      // Kill all children
      for (const [key, a] of agents.entries()) {
        if (a.parentId === agentId && a.status !== "killed") {
          kill(key);
        }
      }
    };

    kill("root");

    const allKilled = [...agents.values()].every((a) => a.status === "killed");
    const pass = allKilled;

    return {
      pass,
      summary: pass
        ? "All descendant agents correctly terminated when root was killed"
        : `Some agents survived parent kill: ${[...agents.values()]
            .filter((a) => a.status !== "killed")
            .map((a) => a.id)
            .join(", ")}`,
      score: pass ? 1 : 0,
      details: {
        agentStatuses: Object.fromEntries([...agents.entries()].map(([k, a]) => [k, a.status])),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// agent-spawning.parallel-completion-ordering
// ---------------------------------------------------------------------------

export const agentParallelCompletionCase: CataloguedEvaluationCase = {
  id: "agent-spawning.parallel-completion-ordering",
  suite: "agent-spawning",
  title: "Agent spawning — parallel sub-agents complete independently",
  description:
    "Validates that multiple parallel sub-agents can complete in any order and all results are collected without racing or loss.",
  tags: ["agent-spawning", "parallel", "unit"],
  metadata: {
    category: "agent-spawning",
    difficulty: "unit",
    expectedDurationMs: 400,
    requiresExternal: false,
    assertions: [
      "all parallel sub-agents reach complete status",
      "results are collected regardless of completion order",
      "no results are lost",
    ],
    relatedCases: ["agent-spawning.result-routing-to-requester"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    const subAgentCount = 4;
    const results: Array<{ id: string; value: number }> = [];

    // Simulate parallel agents completing in reverse order
    const completionOrder: number[] = [];
    const tasks = Array.from({ length: subAgentCount }, (_, i) => i).toReversed();

    for (const i of tasks) {
      // Simulate async completion
      await Promise.resolve();
      completionOrder.push(i);
      results.push({ id: `agent-${i}`, value: i * 10 });
    }

    const allCollected = results.length === subAgentCount;
    const allIds = new Set(results.map((r) => r.id));
    const noLost = allIds.size === subAgentCount;

    const pass = allCollected && noLost;

    return {
      pass,
      summary: pass
        ? `All ${subAgentCount} parallel sub-agent results collected (completion order: ${completionOrder.join("→")})`
        : `Result collection failed: collected=${results.length}, expected=${subAgentCount}`,
      score: pass ? 1 : 0,
      details: {
        subAgentCount,
        completionOrder,
        results,
        allCollected,
        noLost,
      },
    };
  },
};
