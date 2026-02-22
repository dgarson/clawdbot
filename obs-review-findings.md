# Observability Stack Review Findings (OBS-01 through OBS-06)

## (a) Gaps in Implementation

1. **Missing Integration Points**:
   - Gateway HTTP handlers are not yet wired with `withSpan`.
   - Agent session lifecycles (run loops, tool invocations, model API calls) do not yet wrap operations in OTel spans or inject attributes (e.g., token usage, duration).
   - `recordSessionStart`, `recordSessionEnd`, `recordTokenUsage`, `recordToolCall` and `recordSessionCost` are fully implemented but *never called* in the codebase (e.g., in `session-run.ts` or model wrapper classes).

2. **Metrics Misalignment (Prometheus vs OTLP)**:
   - `src/telemetry/metrics.ts` uses `metrics.getMeter()` (the global OTel meter provider) to create instruments.
   - However, `initPrometheusExporter` specifically states: *"We intentionally do NOT set this as the OTel global to avoid conflicts... metric instruments should be created via `getPrometheusMeterProvider().getMeter()`"*.
   - Because `metrics.ts` uses the global meter provider, the `getMetrics()` instruments are likely tied to the OTLP exporter (if enabled) and won't actually be scraped by Prometheus.

3. **Incomplete A/B Experiment Metrics (OBS-04/05)**:
   - The UI tries to fetch experiments (`experiments.list`) and telemetry (`sessions.usage.timeseries`) from the Gateway.
   - However, no `experiments.list` server method exists in `src/gateway/server-methods/`.
   - The UI components (`analytics/experiments/page.tsx` and `analytics/page.tsx`) have hardcoded data models or rely on API endpoints that are only stubbed or missing on the backend.

4. **Tracer initialization issues**:
   - `src/telemetry/otel.ts` does not call `provider.register()` properly or configure OTLP tracing headers cleanly in a way that propagates context down to the subagents natively.

## (b) Rooms for Improvement

1. **Architecture & Design**:
   - **Singleton Confusion**: We have two parallel metric pipelines configured: one pushing OTLP metrics in `otel.ts` (`PeriodicExportingMetricReader`) and a pull-based one in `prometheus.ts`. `metrics.ts` doesn't unify them. We should bridge the Prometheus MeterProvider properly so counters increment in both places, or use the OTel collector to translate OTLP to Prometheus.
   - **File-based Telemetry (OBS-06)**: `weekly-telemetry-digest.ts` reads `JSONL` files from `~/.openclaw/logs`. But with Loki + Prometheus in the docker-compose stack, we should be using PromQL/LogQL queries for cost optimization rather than grepping files. It fractures the observability strategy.

2. **Test Coverage**:
   - Good basic unit test coverage in `src/telemetry/*.test.ts`, but no integration tests verifying that spans actually propagate or that Prometheus metrics are exposed via the HTTP server.

3. **Performance**:
   - Writing structured JSONL per agent is great, but currently synchronous or unbuffered if high-throughput. Pino roll is used, but we need to ensure the async transport is configured properly so we don't block the main event loop during intense LLM streaming.

## (c) Opportunities for the Future

1. **Implementation Opportunities**:
   - **Distributed Context Propagation**: Use `W3CTraceContextPropagator` when spawning sub-agents (passing `traceparent` via IPC/env vars) so Jaeger shows a single distributed trace from user message -> main agent -> subagent -> tool execution.
   - **Cost Anomaly Detection**: Wire `alertmanager` in `docker-compose.observability.yml` to trigger a Slack notification if cost spikes > $5 in a 1-hour window.

2. **Usage Opportunities**:
   - **Model Regression Alerting**: Since we have Q-Scores and A/B variants, we can map `experiment.id` to specific model prompts, and track the error rate / tool failure rate per prompt variant.
   - **SLO Dashboards**: Define Gateway API latencies and Agent Response latencies (Time to First Token) and track them as SLOs in Grafana.
   - **Agent Budgeting**: Use the real-time cost counter to actively halt or pause agent sessions if they exceed a per-session budget limit (rather than just observing it after the fact).
