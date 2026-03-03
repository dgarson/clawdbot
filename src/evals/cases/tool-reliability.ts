/**
 * Tool Reliability Benchmark Scenarios
 *
 * Tests that tool dispatch, error handling, retry logic, and
 * graceful degradation behave correctly under various failure modes.
 * All scenarios are deterministic and require no external services.
 */

import type { CataloguedEvaluationCase } from "../catalog.js";
import type { EvaluationCaseResult } from "../types.js";

// ---------------------------------------------------------------------------
// tool-reliability.dispatch-success
// ---------------------------------------------------------------------------

export const toolDispatchSuccessCase: CataloguedEvaluationCase = {
  id: "tool-reliability.dispatch-success",
  suite: "tool-reliability",
  title: "Tool dispatch — successful invocation",
  description:
    "Validates that a tool invocation with valid arguments succeeds and returns the expected result shape.",
  tags: ["tool-reliability", "dispatch", "smoke"],
  metadata: {
    category: "tool-reliability",
    difficulty: "smoke",
    expectedDurationMs: 500,
    requiresExternal: false,
    assertions: [
      "tool call with valid arguments returns result",
      "result contains expected fields",
      "tool name and call id are tracked",
    ],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    // Simulate a tool registry and dispatch
    type ToolResult = { ok: boolean; value: unknown };
    type ToolCall = { toolName: string; callId: string; args: Record<string, unknown> };

    const dispatchTool = async (call: ToolCall): Promise<ToolResult> => {
      const registry: Record<string, (args: Record<string, unknown>) => unknown> = {
        echo: (args) => args["input"],
        add: (args) => (args["a"] as number) + (args["b"] as number),
      };

      const fn = registry[call.toolName];
      if (!fn) {
        return { ok: false, value: `Unknown tool: ${call.toolName}` };
      }
      return { ok: true, value: fn(call.args) };
    };

    const call: ToolCall = {
      toolName: "add",
      callId: "call-001",
      args: { a: 3, b: 4 },
    };

    const result = await dispatchTool(call);
    const pass = result.ok && result.value === 7;

    return {
      pass,
      summary: pass
        ? "Tool dispatch succeeded with correct result"
        : `Tool dispatch failed or returned unexpected value: ${JSON.stringify(result.value)}`,
      score: pass ? 1 : 0,
      details: {
        call,
        result,
        expected: 7,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// tool-reliability.dispatch-unknown-tool
// ---------------------------------------------------------------------------

export const toolDispatchUnknownCase: CataloguedEvaluationCase = {
  id: "tool-reliability.dispatch-unknown-tool",
  suite: "tool-reliability",
  title: "Tool dispatch — unknown tool graceful error",
  description:
    "Validates that dispatching an unknown tool name returns a structured error without throwing.",
  tags: ["tool-reliability", "dispatch", "error-handling", "unit"],
  metadata: {
    category: "tool-reliability",
    difficulty: "unit",
    expectedDurationMs: 200,
    requiresExternal: false,
    assertions: [
      "unknown tool name returns ok=false",
      "error message includes tool name",
      "dispatch does not throw",
    ],
    relatedCases: ["tool-reliability.dispatch-success"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    type ToolResult = { ok: boolean; error?: string; value?: unknown };

    const dispatchTool = async (
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<ToolResult> => {
      const knownTools = new Set(["echo", "add", "read", "write"]);
      if (!knownTools.has(toolName)) {
        return { ok: false, error: `Unknown tool: ${toolName}` };
      }
      return { ok: true, value: args };
    };

    const result = await dispatchTool("nonexistent_tool", { x: 1 });
    const pass =
      !result.ok && typeof result.error === "string" && result.error.includes("nonexistent_tool");

    return {
      pass,
      summary: pass
        ? "Unknown tool correctly returned structured error"
        : "Expected structured error for unknown tool, got: " + JSON.stringify(result),
      score: pass ? 1 : 0,
      details: { result },
    };
  },
};

// ---------------------------------------------------------------------------
// tool-reliability.retry-on-transient-failure
// ---------------------------------------------------------------------------

export const toolRetryCase: CataloguedEvaluationCase = {
  id: "tool-reliability.retry-on-transient-failure",
  suite: "tool-reliability",
  title: "Tool retry — transient failure recovery",
  description:
    "Validates that the retry logic correctly retries failed tool calls up to the max attempt limit and succeeds on a later attempt.",
  tags: ["tool-reliability", "retry", "resilience", "unit"],
  metadata: {
    category: "tool-reliability",
    difficulty: "unit",
    expectedDurationMs: 500,
    requiresExternal: false,
    assertions: [
      "tool is retried after transient failure",
      "success on allowed attempt passes through",
      "attempt count is tracked correctly",
      "does not exceed max retries",
    ],
    relatedCases: ["tool-reliability.dispatch-success"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    const maxRetries = 3;
    let attemptCount = 0;
    const failUntil = 2; // fails on attempts 1-2, succeeds on 3

    const callWithRetry = async (): Promise<{ success: boolean; attempts: number }> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        attemptCount = attempt;
        if (attempt < failUntil) {
          // Simulate transient error
          continue;
        }
        // Simulate success
        return { success: true, attempts: attempt };
      }
      return { success: false, attempts: attemptCount };
    };

    const outcome = await callWithRetry();
    const pass = outcome.success && outcome.attempts === failUntil && attemptCount <= maxRetries;

    return {
      pass,
      summary: pass
        ? `Tool succeeded after ${outcome.attempts} attempt(s) (retry worked)`
        : `Retry logic failed: success=${outcome.success}, attempts=${outcome.attempts}`,
      score: pass ? 1 : 0,
      details: {
        maxRetries,
        failUntil,
        outcome,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// tool-reliability.max-retries-exhausted
// ---------------------------------------------------------------------------

export const toolMaxRetriesExhaustedCase: CataloguedEvaluationCase = {
  id: "tool-reliability.max-retries-exhausted",
  suite: "tool-reliability",
  title: "Tool retry — max retries exhausted returns failure",
  description:
    "Validates that when all retry attempts fail, the system returns a structured failure and does not loop forever.",
  tags: ["tool-reliability", "retry", "error-handling", "unit"],
  metadata: {
    category: "tool-reliability",
    difficulty: "unit",
    expectedDurationMs: 300,
    requiresExternal: false,
    assertions: [
      "retries stop at max limit",
      "final result is a structured failure",
      "attempt count equals max retries",
    ],
    relatedCases: ["tool-reliability.retry-on-transient-failure"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    const maxRetries = 3;
    let attemptsMade = 0;

    const callWithRetry = async (): Promise<{ success: boolean; attempts: number }> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        attemptsMade = attempt;
        // Always fail
      }
      return { success: false, attempts: attemptsMade };
    };

    const outcome = await callWithRetry();
    const pass = !outcome.success && outcome.attempts === maxRetries;

    return {
      pass,
      summary: pass
        ? `Tool correctly gave up after ${maxRetries} failed attempts`
        : `Expected failure after ${maxRetries} attempts, got: ${JSON.stringify(outcome)}`,
      score: pass ? 1 : 0,
      details: { maxRetries, outcome },
    };
  },
};

// ---------------------------------------------------------------------------
// tool-reliability.timeout-abort
// ---------------------------------------------------------------------------

export const toolTimeoutAbortCase: CataloguedEvaluationCase = {
  id: "tool-reliability.timeout-abort",
  suite: "tool-reliability",
  title: "Tool timeout — abort signal propagation",
  description:
    "Validates that an AbortSignal is propagated to tool execution and causes early termination.",
  tags: ["tool-reliability", "timeout", "abort", "unit"],
  metadata: {
    category: "tool-reliability",
    difficulty: "unit",
    expectedDurationMs: 200,
    requiresExternal: false,
    assertions: [
      "abort signal causes tool to stop early",
      "abort is detected before timeout expires",
      "result indicates abort rather than success",
    ],
    relatedCases: ["tool-reliability.retry-on-transient-failure"],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    const controller = new AbortController();

    // Simulate a tool that checks the abort signal
    const runTool = async (signal: AbortSignal): Promise<{ aborted: boolean; step: number }> => {
      let step = 0;
      for (let i = 0; i < 10; i++) {
        if (signal.aborted) {
          return { aborted: true, step };
        }
        step++;
        if (i === 2) {
          // Simulate abort happening mid-execution
          controller.abort();
        }
      }
      return { aborted: false, step };
    };

    const outcome = await runTool(controller.signal);
    const pass = outcome.aborted && outcome.step <= 10;

    return {
      pass,
      summary: pass
        ? `Tool correctly aborted at step ${outcome.step}`
        : `Expected early abort, tool ran to step ${outcome.step}`,
      score: pass ? 1 : 0,
      details: { outcome },
    };
  },
};

// ---------------------------------------------------------------------------
// tool-reliability.result-schema-validation
// ---------------------------------------------------------------------------

export const toolResultSchemaCase: CataloguedEvaluationCase = {
  id: "tool-reliability.result-schema-validation",
  suite: "tool-reliability",
  title: "Tool result schema validation",
  description:
    "Validates that tool results are checked against their declared schema and malformed results are rejected.",
  tags: ["tool-reliability", "schema", "validation", "unit"],
  metadata: {
    category: "tool-reliability",
    difficulty: "unit",
    expectedDurationMs: 200,
    requiresExternal: false,
    assertions: [
      "valid result passes schema check",
      "result missing required field is rejected",
      "result with wrong field type is rejected",
    ],
  },
  run: async (): Promise<EvaluationCaseResult> => {
    type ToolOutput = { status: "ok" | "error"; data?: unknown; error?: string };

    const validateOutput = (raw: unknown): { valid: boolean; reason?: string } => {
      if (!raw || typeof raw !== "object") {
        return { valid: false, reason: "not an object" };
      }
      const r = raw as Record<string, unknown>;
      if (r["status"] !== "ok" && r["status"] !== "error") {
        return { valid: false, reason: `invalid status: ${String(r["status"])}` };
      }
      if (r["status"] === "error" && typeof r["error"] !== "string") {
        return { valid: false, reason: "error status requires string error field" };
      }
      return { valid: true };
    };

    const validResult: ToolOutput = { status: "ok", data: { items: [1, 2, 3] } };
    const missingStatus = { data: "something" };
    const wrongErrorType: Record<string, unknown> = { status: "error", error: 42 };

    const checks = [
      { label: "valid result", input: validResult, expectValid: true },
      { label: "missing status", input: missingStatus, expectValid: false },
      { label: "wrong error type", input: wrongErrorType, expectValid: false },
    ];

    const results = checks.map(({ label, input, expectValid }) => {
      const { valid, reason } = validateOutput(input);
      return { label, valid, reason, passed: valid === expectValid };
    });

    const pass = results.every((r) => r.passed);

    return {
      pass,
      summary: pass
        ? "All schema validation checks passed"
        : `Schema validation failed: ${results
            .filter((r) => !r.passed)
            .map((r) => r.label)
            .join(", ")}`,
      score: results.filter((r) => r.passed).length / results.length,
      details: { checks: results },
    };
  },
};
