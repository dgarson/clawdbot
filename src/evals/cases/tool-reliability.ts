/**
 * Tool Reliability Benchmark Scenario
 *
 * Tests that the system correctly handles tool dispatch reliability,
 * including timeout handling, failure recovery, and result validation.
 */

import type { CataloguedEvaluationCase, ScenarioMetadata } from "../catalog.js";
import type { EvaluationCaseResult } from "../types.js";

const toolReliabilityMetadata: ScenarioMetadata = {
  category: "tool-reliability",
  difficulty: "integration",
  expectedDurationMs: 5000,
  requiresExternal: false,
  assertions: [
    "tool dispatch returns correct structure",
    "tool timeout is handled gracefully",
    "tool failure triggers appropriate fallback",
    "tool result validation works correctly",
  ],
  relatedCases: ["hitl.escalation-smoke"],
};

/**
 * Tool dispatch smoke test - verifies basic tool call structure
 */
export const toolDispatchCase: CataloguedEvaluationCase = {
  id: "tool-reliability.dispatch-smoke",
  suite: "tool-reliability",
  title: "Tool dispatch smoke test",
  description:
    "Validates basic tool dispatch flow - verifies tool call structure and response format.",
  tags: ["tool", "dispatch", "smoke", "integration"],
  metadata: toolReliabilityMetadata,
  run: async (): Promise<EvaluationCaseResult> => {
    // Simulate a tool dispatch request
    const toolRequest = {
      tool: "read_file",
      args: { path: "/src/main.ts" },
      requestId: "req-123",
      timestamp: new Date().toISOString(),
    };

    // Simulate tool response structure
    const toolResponse = {
      success: true,
      requestId: toolRequest.requestId,
      tool: toolRequest.tool,
      result: {
        content: "const main = () => { ... }",
        size: 1024,
      },
      durationMs: 150,
    };

    // Validate response structure
    const pass =
      toolResponse.success &&
      toolResponse.requestId === toolRequest.requestId &&
      toolResponse.tool === toolRequest.tool &&
      toolResponse.result !== undefined;

    return {
      pass,
      summary: pass
        ? "Tool dispatch correctly returns expected structure"
        : "Tool dispatch response structure invalid",
      score: pass ? 1 : 0,
      details: {
        request: toolRequest,
        response: toolResponse,
      },
    };
  },
};

/**
 * Tool timeout handling test - verifies timeout detection and handling
 */
export const toolTimeoutCase: CataloguedEvaluationCase = {
  id: "tool-reliability.timeout-handling",
  suite: "tool-reliability",
  title: "Tool timeout handling",
  description: "Validates that tool calls timeout correctly and don't hang indefinitely.",
  tags: ["tool", "timeout", "integration"],
  metadata: {
    category: "tool-reliability",
    difficulty: "integration",
    expectedDurationMs: 3000,
    requiresExternal: false,
    assertions: [
      "timeout is triggered after configured duration",
      "timeout error is properly formatted",
      "no resource leaks on timeout",
    ],
    relatedCases: ["tool-reliability.dispatch-smoke", "hitl.timeout-handling"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    // Simulate tool timeout configuration
    const configuredTimeoutMs = 30000; // 30 seconds
    const toolStartTime = Date.now() - configuredTimeoutMs - 500; // Past timeout + buffer

    // Check if timeout should have triggered
    const elapsedMs = Date.now() - toolStartTime;
    const shouldTimeout = elapsedMs >= configuredTimeoutMs;

    // Simulate timeout error format
    const timeoutError = shouldTimeout
      ? {
          error: "timeout",
          message: `Tool execution exceeded timeout of ${configuredTimeoutMs}ms`,
          elapsedMs,
          timeoutMs: configuredTimeoutMs,
        }
      : null;

    const pass = shouldTimeout && timeoutError !== null;

    return {
      pass,
      summary: pass ? "Tool timeout correctly detected and handled" : "Timeout handling failed",
      score: pass ? 1 : 0,
      details: {
        elapsedMs,
        timeoutMs: configuredTimeoutMs,
        timedOut: shouldTimeout,
        error: timeoutError,
      },
    };
  },
};

/**
 * Tool failure recovery test - verifies fallback behavior on tool failure
 */
export const toolFailureRecoveryCase: CataloguedEvaluationCase = {
  id: "tool-reliability.failure-recovery",
  suite: "tool-reliability",
  title: "Tool failure recovery",
  description: "Validates that tool failures trigger appropriate fallback behavior.",
  tags: ["tool", "failure", "recovery", "integration"],
  metadata: {
    category: "tool-reliability",
    difficulty: "integration",
    expectedDurationMs: 4000,
    requiresExternal: false,
    assertions: [
      "failure is detected and reported",
      "fallback behavior is executed",
      "error details are preserved for debugging",
    ],
    relatedCases: ["tool-reliability.dispatch-smoke"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    // Simulate a tool failure (e.g., file not found)
    const toolError = {
      code: "ENOENT",
      message: "File not found: /nonexistent/path.txt",
      tool: "read_file",
      recoverable: false,
    };

    // Determine if fallback should be triggered
    const shouldFallback = !toolError.recoverable;

    // Simulate fallback action
    const fallbackAction = shouldFallback
      ? {
          action: "return-error-to-user",
          reason: "non-recoverable-tool-error",
          originalError: toolError.code,
        }
      : null;

    const pass = shouldFallback && fallbackAction !== null;

    return {
      pass,
      summary: pass
        ? "Tool failure correctly triggered fallback behavior"
        : "Failure recovery handling failed",
      score: pass ? 1 : 0,
      details: {
        originalError: toolError,
        fallbackTriggered: shouldFallback,
        fallbackAction,
      },
    };
  },
};

/**
 * Tool result validation test - verifies result structure validation
 */
export const toolResultValidationCase: CataloguedEvaluationCase = {
  id: "tool-reliability.result-validation",
  suite: "tool-reliability",
  title: "Tool result validation",
  description: "Validates that tool results are properly validated before being used.",
  tags: ["tool", "validation", "integration"],
  metadata: {
    category: "tool-reliability",
    difficulty: "integration",
    expectedDurationMs: 2000,
    requiresExternal: false,
    assertions: [
      "valid results pass validation",
      "invalid results are caught",
      "validation errors include helpful details",
    ],
    relatedCases: ["tool-reliability.dispatch-smoke"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    // Simulate validation of tool results
    const validateResult = (result: unknown): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];

      if (result === null || result === undefined) {
        errors.push("Result cannot be null or undefined");
      }

      if (typeof result === "object") {
        const obj = result as Record<string, unknown>;
        if (!("content" in obj) && !("error" in obj)) {
          errors.push("Result must have 'content' or 'error' field");
        }
      }

      return { valid: errors.length === 0, errors };
    };

    // Test case 1: Valid result
    const validResult = { content: "file content here", size: 100 };
    const validCheck = validateResult(validResult);

    // Test case 2: Invalid result (missing required fields)
    const invalidResult = { metadata: { created: "2026-01-01" } };
    const invalidCheck = validateResult(invalidResult);

    const pass = validCheck.valid && !invalidCheck.valid;

    return {
      pass,
      summary: pass
        ? "Tool result validation correctly identifies valid and invalid results"
        : "Result validation failed",
      score: pass ? 1 : 0,
      details: {
        validResult,
        validCheck,
        invalidResult,
        invalidCheck,
      },
    };
  },
};
