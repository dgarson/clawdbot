/**
 * Map agent events to OTEL spans.
 *
 * Span mapping tree:
 *   agent_run (runId)
 *     -> model_resolve (model selection)
 *     -> prompt_compose (prompt building)
 *     -> llm_call (each LLM invocation)
 *     -> tool_call (each tool invocation)
 *     -> subagent_run (child agent)
 */

import { type Span, SpanStatusCode, type Tracer, context, trace } from "@opentelemetry/api";
import { getRunTraceContext } from "./trace-context.js";

type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };

// =============================================================================
// Span Store
// =============================================================================

/** Active spans keyed by a composite key (runId or runId:spanName:id). */
const activeSpans = new Map<string, Span>();

function spanKey(runId: string, kind: string, id?: string): string {
  return id ? `${runId}:${kind}:${id}` : `${runId}:${kind}`;
}

// =============================================================================
// Span Builder
// =============================================================================

export type SpanBuilder = {
  /** Start a root agent_run span. */
  startAgentRun(runId: string, attrs: Record<string, string | number>): void;

  /** End the agent_run span. */
  endAgentRun(runId: string, success: boolean, durationMs?: number, error?: string): void;

  /** Start a child span under the current run (model_resolve, prompt_compose, llm_call, tool_call). */
  startChildSpan(
    runId: string,
    kind: "model_resolve" | "prompt_compose" | "llm_call" | "tool_call" | "subagent_run",
    spanId: string,
    attrs: Record<string, string | number>,
  ): void;

  /** End a child span. */
  endChildSpan(
    runId: string,
    kind: "model_resolve" | "prompt_compose" | "llm_call" | "tool_call" | "subagent_run",
    spanId: string,
    success: boolean,
    attrs?: Record<string, string | number>,
    error?: string,
  ): void;

  /** Shutdown: end all active spans. */
  shutdown(): void;
};

export function createSpanBuilder(tracer: Tracer, logger: Logger): SpanBuilder {
  const startSpanWithParent = (
    parentSpan: Span | undefined,
    name: string,
    attrs: Record<string, string | number>,
  ): Span => {
    if (parentSpan) {
      const parentCtx = trace.setSpan(context.active(), parentSpan);
      return tracer.startSpan(name, { attributes: attrs }, parentCtx);
    }
    return tracer.startSpan(name, { attributes: attrs });
  };

  return {
    startAgentRun(runId, attrs) {
      const key = spanKey(runId, "agent_run");
      if (activeSpans.has(key)) {
        return;
      }

      const traceCtx = getRunTraceContext(runId);
      const allAttrs = {
        ...attrs,
        "agent.run.id": runId,
        ...(traceCtx ? { "agent.trace.id": traceCtx.traceId } : {}),
      };

      const span = tracer.startSpan("agent_run", { attributes: allAttrs });
      activeSpans.set(key, span);
    },

    endAgentRun(runId, success, durationMs, error) {
      const key = spanKey(runId, "agent_run");
      const span = activeSpans.get(key);
      if (!span) {
        return;
      }

      if (durationMs !== undefined) {
        span.setAttribute("agent.run.duration_ms", durationMs);
      }

      if (!success) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error ?? "agent run failed",
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
      activeSpans.delete(key);
    },

    startChildSpan(runId, kind, childSpanId, attrs) {
      const parentKey = spanKey(runId, "agent_run");
      const parentSpan = activeSpans.get(parentKey);
      const key = spanKey(runId, kind, childSpanId);

      if (activeSpans.has(key)) {
        return;
      }

      const span = startSpanWithParent(parentSpan, kind, {
        ...attrs,
        "agent.run.id": runId,
        "agent.span.kind": kind,
      });
      activeSpans.set(key, span);
    },

    endChildSpan(runId, kind, childSpanId, success, attrs, error) {
      const key = spanKey(runId, kind, childSpanId);
      const span = activeSpans.get(key);
      if (!span) {
        return;
      }

      if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
          span.setAttribute(k, v);
        }
      }

      if (!success) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error ?? `${kind} failed`,
        });
      }

      span.end();
      activeSpans.delete(key);
    },

    shutdown() {
      for (const [key, span] of activeSpans) {
        try {
          span.setStatus({ code: SpanStatusCode.ERROR, message: "shutdown" });
          span.end();
        } catch {
          logger.warn(`observability: failed to end span ${key} during shutdown`);
        }
      }
      activeSpans.clear();
    },
  };
}
