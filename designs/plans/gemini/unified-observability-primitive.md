# Unified Observability Primitive

**Source Material:** New Gemini Proposal.

## Goal

Create a single, coherent observability layer that unifies logging, distributed tracing, and metrics across the entire agent lifecycle. This primitive will bridge the gap between the `Unified Event Pipeline`, `Inbound Pipeline`, `Session Kernel`, and `Tool Artifact Ledger`, providing a "trace-once, observe-everywhere" experience.

## Problem Statement

Currently, observability is fragmented:

- **Logging:** `tslog` is used directly in some places, `console` in others, with inconsistent metadata context.
- **Tracing:** There is no concept of a "Run ID" or "Trace ID" that persists from the Inbound Webhook -> Policy Engine -> Kernel -> Agent -> Tool -> Hook -> Reply.
- **Metrics:** We lack visibility into "Tool Latency", "Token Usage per Session", or "Error Rates by Provider" without parsing text logs.
- **Diagnostics:** Debugging "why did this run fail?" often requires stitching together logs from 3 different subsystems.

## Proposed Primitive: `ObservabilityContext`

A scoped, immutable context object passed through the entire stack (or attached to the `AsyncLocalStorage` equivalent).

### 1. Unified Tracing Context

**Responsibilities:**

- **Trace Propagation:** Generate a `TraceID` at the _Edge_ (Inbound/Webhook) and propagate it to all downstream calls.
- **Span Management:** Track logic blocks (`PolicyEval`, `AgentRun`, `ToolExec`) with duration and success/fail status.
- **Correlation:** Link `AgentRunID` to `SessionID` to `TraceID`.

**API:**

```ts
interface TraceContext {
  traceId: string;
  spanId: string;
  parentId?: string;
  tags: Record<string, string>; // e.g., { agentId: "...", sessionId: "..." }
}

function startTrace<T>(name: string, ctx: TraceContext, fn: (span: Span) => Promise<T>): Promise<T>;
```

### 2. Structured Logging & Events

**Responsibilities:**

- **Context Injection:** Automatically inject `traceId`, `agentId`, `sessionId` into every log line logged within a span.
- **Event Bus Bridge:** Automatically emit high-priority logs (Warn/Error) to the `Unified Event Pipeline` as `system.log` events.
- **Redaction:** Enforce a strict "No PII/Secrets" policy on log payloads via a sanitizer.

### 3. Metrics & Telemetry

**Responsibilities:**

- **Counters:** `messages.received`, `agent.runs`, `tools.executed`.
- **Histograms:** `latency.policy_eval`, `latency.llm_response`, `latency.tool_exec`.
- **Exporters:** Pluggable backends (e.g., Prometheus, JSON file, Console, OpenTelemetry).

## Integration Plan

### Phase 1: Context Core

1.  Implement `src/observability/context.ts` (using `AsyncLocalStorage` for minimal plumbing intrusion).
2.  Define the `TraceID` generation logic.

### Phase 2: Pipeline Integration

1.  **Inbound:** Start a trace in `InboundPipeline`. Tag with `channelId`, `userId`.
2.  **Kernel:** Create a child span for `executeTurn`. Tag with `agentId`.
3.  **Tools:** Create child spans for `ToolArtifactLedger` operations.

### Phase 3: Logging Facade

1.  Wrap the existing Logger to read from `ObservabilityContext`.
2.  Ensure all logs output the `traceId`.

### Phase 4: Visualization (Doctor)

1.  Update `openclaw doctor` or `openclaw logs` to allow filtering by `TraceID` or `RunID`.
2.  "Show me what happened in Run X" should print a coherent timeline of all spans and logs.

## Expected Impact

- **Debuggability:** Instant answer to "What happened during this request?".
- **Performance:** Identify bottlenecks (e.g., "Policy eval took 500ms") easily.
- **Reliability:** Catch errors that are currently swallowed or logged without context.
- **Ecosystem:** Plugins can emit metrics/logs that automatically correlate with the core trace.
