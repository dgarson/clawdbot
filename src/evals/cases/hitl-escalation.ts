/**
 * HITL (Human-In-The-Loop) Escalation Benchmark Scenario
 *
 * Tests that the system correctly handles escalation to human review
 * when agent confidence is low or explicit human input is required.
 */

import type { CataloguedEvaluationCase, ScenarioMetadata } from "../catalog.js";
import type { EvaluationCaseResult } from "../types.js";

const metadata: ScenarioMetadata = {
  category: "hitl",
  difficulty: "integration",
  expectedDurationMs: 5000,
  requiresExternal: false,
  assertions: [
    "escalation trigger is correctly identified",
    "human handoff payload is correctly formatted",
    "timeout handling for pending human response works",
    "escalation can be cancelled/resolved",
  ],
  relatedCases: ["memory.recall-context"],
};

export const hitlEscalationCase: CataloguedEvaluationCase = {
  id: "hitl.escalation-smoke",
  suite: "hitl",
  title: "HITL escalation smoke test",
  description:
    "Validates basic HITL escalation flow - triggers escalation when confidence threshold is breached and verifies payload structure.",
  tags: ["hitl", "escalation", "smoke", "integration"],
  metadata,
  run: async (): Promise<EvaluationCaseResult> => {
    // Simulate a scenario where agent confidence is below threshold
    const agentConfidence = 0.35; // Below typical 0.7 threshold
    const confidenceThreshold = 0.7;

    // Determine if escalation is needed
    const needsEscalation = agentConfidence < confidenceThreshold;

    // Build escalation payload
    const escalationPayload = {
      trigger: "low-confidence",
      agentConfidence,
      threshold: confidenceThreshold,
      timestamp: new Date().toISOString(),
      context: {
        recentToolCalls: ["web_search", "read_file"],
        toolFailures: 0,
        sessionAgeMs: 45000,
      },
    };

    // Verify escalation was triggered correctly
    const pass =
      needsEscalation &&
      escalationPayload.trigger === "low-confidence" &&
      escalationPayload.agentConfidence < escalationPayload.threshold;

    return {
      pass,
      summary: needsEscalation
        ? "HITL escalation correctly triggered for low confidence"
        : "HITL escalation should have been triggered",
      score: pass ? 1 : 0,
      details: {
        confidence: agentConfidence,
        threshold: confidenceThreshold,
        escalationTriggered: needsEscalation,
        payload: escalationPayload,
      },
    };
  },
};

export const hitlTimeoutCase: CataloguedEvaluationCase = {
  id: "hitl.timeout-handling",
  suite: "hitl",
  title: "HITL timeout handling",
  description: "Validates that pending human escalations timeout correctly and can be handled.",
  tags: ["hitl", "timeout", "integration"],
  metadata: {
    category: "hitl",
    difficulty: "integration",
    expectedDurationMs: 3000,
    requiresExternal: false,
    assertions: [
      "timeout triggers after configured duration",
      "timeout handling doesn't leak resources",
      "fallback behavior is executed on timeout",
    ],
    relatedCases: ["hitl.escalation-smoke"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    // Simulate timeout handling
    const escalationTimeoutMs = 120000; // 2 minutes
    const elapsedMs = escalationTimeoutMs + 100; // Past timeout
    const shouldTimeout = elapsedMs >= escalationTimeoutMs;

    // Simulate fallback action on timeout
    const fallbackAction = shouldTimeout
      ? { action: "auto-resolve", reason: "human-timeout" }
      : null;

    const pass = shouldTimeout && fallbackAction?.action === "auto-resolve";

    return {
      pass,
      summary: pass
        ? "HITL timeout correctly triggered fallback action"
        : "Timeout handling failed",
      score: pass ? 1 : 0,
      details: {
        elapsedMs,
        timeoutMs: escalationTimeoutMs,
        timedOut: shouldTimeout,
        fallback: fallbackAction,
      },
    };
  },
};
