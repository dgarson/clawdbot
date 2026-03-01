/**
 * AgentCallContext — AsyncLocalStorage-backed context propagation.
 *
 * Allows any code on the call stack to read the current agent invocation
 * context (runId, sessionId, toolCallId, etc.) without explicit parameter
 * threading. Particularly useful for telemetry hooks that need to attribute
 * costs and LLM calls to the right session and run.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type AgentCallContext = {
  runId?: string;
  sessionKey?: string;
  sessionId?: string;
  agentId?: string;
  toolCallId?: string;
};

const storage = new AsyncLocalStorage<AgentCallContext>();

/**
 * Run `fn` within a new agent call context. The context is accessible via
 * `getAgentCallContext()` anywhere on the synchronous or asynchronous call
 * stack inside `fn`.
 */
export function runWithAgentCallContext<T>(ctx: AgentCallContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Return the current agent call context, or `undefined` if called outside
 * of a `runWithAgentCallContext` scope.
 */
export function getAgentCallContext(): AgentCallContext | undefined {
  return storage.getStore();
}
