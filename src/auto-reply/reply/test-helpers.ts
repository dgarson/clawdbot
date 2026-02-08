import { vi } from "vitest";
import type { ExecutionRequest, ExecutionResult } from "../../execution/types.js";
import type { TypingController } from "./typing.js";

export function createMockTypingController(
  overrides: Partial<TypingController> = {},
): TypingController {
  return {
    onReplyStart: vi.fn(async () => {}),
    startTypingLoop: vi.fn(async () => {}),
    startTypingOnText: vi.fn(async () => {}),
    refreshTypingTtl: vi.fn(),
    isActive: vi.fn(() => false),
    markRunComplete: vi.fn(),
    markDispatchIdle: vi.fn(),
    cleanup: vi.fn(),
    ...overrides,
  };
}

/**
 * Build a minimal ExecutionResult for tests.
 * Override specific fields as needed.
 */
export function makeExecutionResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    success: true,
    aborted: false,
    reply: overrides.reply ?? "",
    payloads: overrides.payloads ?? [{ text: "Test reply" }],
    runtime: overrides.runtime ?? {
      kind: "pi",
      provider: "anthropic",
      model: "claude",
      fallbackUsed: false,
    },
    usage: overrides.usage ?? {
      inputTokens: 10,
      outputTokens: 5,
      durationMs: 100,
    },
    events: overrides.events ?? [],
    toolCalls: overrides.toolCalls ?? [],
    didSendViaMessagingTool: overrides.didSendViaMessagingTool ?? false,
    ...overrides,
  };
}

/**
 * Create a mock kernel execute fn that pushes raw events through the request's
 * StreamingMiddleware before returning a result.
 *
 * Usage:
 *   const kernelExecute = vi.fn();
 *   // In vi.mock for ../../execution/kernel.js:
 *   createDefaultExecutionKernel: () => ({ execute: kernelExecute, abort: vi.fn(), getActiveRunCount: () => 0 })
 *
 *   // In a test:
 *   kernelExecute.mockImplementationOnce(async (req: ExecutionRequest) => {
 *     // Push events through middleware to simulate runtime behavior
 *     req.streamMiddleware?.push({ kind: "block_reply", text: "Hello" });
 *     return makeExecutionResult({ payloads: [{ text: "Hello" }] });
 *   });
 */
export type KernelExecuteFn = (request: ExecutionRequest) => Promise<ExecutionResult>;
