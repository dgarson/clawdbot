/**
 * Tracer singleton and span helpers for OpenClaw.
 *
 * Provides a thin, type-safe wrapper around the OTel Tracing API.
 * When OTel is disabled the API returns no-op implementations automatically,
 * so callers never need to guard on `isOtelEnabled()`.
 *
 * Span naming convention: `openclaw.<component>.<operation>`
 *   e.g. `openclaw.session.run`, `openclaw.tool.invoke`, `openclaw.model.request`
 */

import {
  trace,
  type Tracer,
  type Span,
  SpanStatusCode,
  type AttributeValue,
  context,
} from "@opentelemetry/api";

const DEFAULT_TRACER_NAME = "openclaw";

/**
 * Return the OpenTelemetry Tracer for the given instrumentation scope.
 * Falls back to a no-op tracer when the SDK is not initialized.
 */
export function getTracer(name?: string): Tracer {
  return trace.getTracer(name ?? DEFAULT_TRACER_NAME);
}

/**
 * Execute an async function inside an OpenTelemetry span.
 *
 * - Automatically records exceptions and sets ERROR status on throw.
 * - Ends the span when the function completes (success or failure).
 * - Optionally attaches initial attributes.
 *
 * @example
 * ```ts
 * const result = await withSpan("openclaw.session.run", async (span) => {
 *   span.setAttribute("session.id", sessionId);
 *   return runSession();
 * }, { "agent.id": agentId });
 * ```
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attrs?: Record<string, AttributeValue>,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span: Span) => {
    try {
      if (attrs) {
        setSpanAttributes(span, attrs);
      }
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err: unknown) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      if (err instanceof Error) {
        span.recordException(err);
      }
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Execute a synchronous function inside an OpenTelemetry span.
 * Same semantics as `withSpan` but for sync operations.
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  attrs?: Record<string, AttributeValue>,
): T {
  const tracer = getTracer();
  const span = tracer.startSpan(name);
  const ctx = trace.setSpan(context.active(), span);
  try {
    if (attrs) {
      setSpanAttributes(span, attrs);
    }
    const result = context.with(ctx, () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err: unknown) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof Error) {
      span.recordException(err);
    }
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Type-safe bulk attribute setter.
 * Skips `undefined` values to avoid OTel SDK warnings.
 */
export function setSpanAttributes(
  span: Span,
  attrs: Record<string, AttributeValue | undefined>,
): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) {
      span.setAttribute(key, value);
    }
  }
}

/**
 * Get the currently-active span (if any).
 * Returns `undefined` when no span is in context.
 */
export function getActiveSpan(): Span | undefined {
  return trace.getActiveSpan();
}
