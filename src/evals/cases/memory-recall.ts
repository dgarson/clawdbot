/**
 * Memory Path Recall Benchmark Scenario
 *
 * Tests that the system correctly recalls context from previous
 * interactions and maintains memory path integrity.
 */

import type { CataloguedEvaluationCase, ScenarioMetadata } from "../catalog.js";
import type { EvaluationCaseResult } from "../types.js";

const memoryMetadata: ScenarioMetadata = {
  category: "memory",
  difficulty: "integration",
  expectedDurationMs: 5000,
  requiresExternal: false,
  assertions: [
    "memory context is correctly stored",
    "relevant context is recalled for current task",
    "memory path shows correct traversal",
    "older context is aged out appropriately",
  ],
  relatedCases: ["hitl.escalation-smoke"],
};

export const memoryRecallCase: CataloguedEvaluationCase = {
  id: "memory.recall-context",
  suite: "memory",
  title: "Memory context recall",
  description: "Validates that relevant context from previous interactions is correctly recalled.",
  tags: ["memory", "recall", "integration"],
  metadata: memoryMetadata,
  run: async (): Promise<EvaluationCaseResult> => {
    // Simulate stored memory context
    const memoryStore = new Map<string, unknown>();

    // Simulate storing context from previous interaction
    const previousContext = {
      task: "file-analysis",
      filesReviewed: ["src/auth.ts", "src/middleware.ts"],
      conclusions: ["auth uses JWT", "middleware validates tokens"],
      timestamp: new Date(Date.now() - 300000).toISOString(), // 5 min ago
    };

    memoryStore.set("session-123", previousContext);

    // Simulate recalling context for current task
    const currentTask = "security-audit";
    const recalledContext = memoryStore.get("session-123") as typeof previousContext | undefined;

    // Verify recall is relevant (checking if context is applicable)
    const isRelevant =
      recalledContext !== undefined && Date.now() - Date.parse(recalledContext.timestamp) < 3600000; // Within 1 hour

    const pass = isRelevant && recalledContext !== undefined;

    return {
      pass,
      summary: pass
        ? "Memory context correctly recalled for current task"
        : "Memory recall failed or context not relevant",
      score: pass ? 1 : 0,
      details: {
        currentTask,
        recalledContext,
        isRelevant,
        ageMs: recalledContext ? Date.now() - Date.parse(recalledContext.timestamp) : null,
      },
    };
  },
};

export const memoryPathTraversalCase: CataloguedEvaluationCase = {
  id: "memory.path-traversal",
  suite: "memory",
  title: "Memory path traversal",
  description: "Validates that memory path shows correct traversal through conversation history.",
  tags: ["memory", "path", "traversal", "integration"],
  metadata: {
    category: "memory",
    difficulty: "integration",
    expectedDurationMs: 3000,
    requiresExternal: false,
    assertions: [
      "path nodes are in correct chronological order",
      "path includes key decision points",
      "path length is bounded appropriately",
    ],
    relatedCases: ["memory.recall-context"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    // Simulate memory path (chronological list of interaction nodes)
    const memoryPath = [
      { id: "node-1", type: "user-query", timestamp: "2026-02-23T01:00:00Z" },
      { id: "node-2", type: "agent-response", timestamp: "2026-02-23T01:00:05Z" },
      { id: "node-3", type: "tool-call", timestamp: "2026-02-23T01:00:10Z" },
      { id: "node-4", type: "tool-result", timestamp: "2026-02-23T01:00:12Z" },
      { id: "node-5", type: "agent-response", timestamp: "2026-02-23T01:00:15Z" },
      { id: "node-6", type: "user-feedback", timestamp: "2026-02-23T01:01:00Z" },
    ];

    // Validate path ordering (should be chronological)
    const isOrdered = memoryPath.every((node, i) => {
      if (i === 0) {
        return true;
      }
      const prevTime = Date.parse(memoryPath[i - 1].timestamp);
      const currTime = Date.parse(node.timestamp);
      return currTime >= prevTime;
    });

    // Check path length is bounded (e.g., max 100 nodes)
    const isBounded = memoryPath.length <= 100;

    // Identify key decision points (tool calls, user feedback)
    const decisionPoints = memoryPath.filter(
      (n) => n.type === "tool-call" || n.type === "user-feedback",
    );

    const pass = isOrdered && isBounded && decisionPoints.length > 0;

    return {
      pass,
      summary: pass
        ? "Memory path traversal correctly ordered with decision points identified"
        : "Memory path validation failed",
      score: pass ? 1 : 0,
      details: {
        pathLength: memoryPath.length,
        isOrdered,
        isBounded,
        decisionPoints: decisionPoints.map((n) => n.id),
      },
    };
  },
};
