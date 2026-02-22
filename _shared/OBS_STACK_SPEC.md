# OpenClaw Observability Stack — Master Spec

**Created:** 2026-02-21 22:05 MST  
**Owner:** Merlin (orchestrator), Xavier + Tim (architecture), Luis + Amadeus (requirements)  
**Branch target:** `dgarson/fork` → mega-branch: `observability/main`  
**Priority:** P0 — burn Codex credits, 16-hour overnight workstream

---

## 1. What We Already Have (Do Not Duplicate)

| Asset                                | Location                                                 | Status                         |
| ------------------------------------ | -------------------------------------------------------- | ------------------------------ |
| Drew's Telemetry Spec                | `drew/TELEMETRY_SPEC.md`                                 | ✅ Spec done                   |
| PR #47 — Telemetry Extension Phase 1 | `extensions/telemetry/` — 7 files, JSONL sink            | 🔵 In review                   |
| Amadeus Quality Score Framework      | `amadeus/findings/quality-score-framework-2026-02-21.md` | ✅ Done                        |
| UTEE RFC (OTel-compatible schema)    | `tim/memory/2026-02-21-utee-notes.md`                    | ✅ Spec done, PR #46 in canary |
| Usage Dashboard view                 | `apps/web-next/src/views/UsageDashboard.tsx`             | ✅ Done (mock data)            |
| Agent Activity Dashboard spec        | `luis/ui-ideas-detailed-spec-2026-02-21.md` idea #4      | ✅ Specced, not built          |
| Session Replay & Debug Timeline spec | `luis/ui-ideas-detailed-spec-2026-02-21.md` idea #7      | ✅ Specced, not built          |

---

## 2. Target Stack Architecture

### 2.1 Telemetry Signals (Three Pillars)

```
Logs     → Structured JSON per-agent, per-session → Loki (via Promtail/Alloy)
Metrics  → Prometheus counters/histograms → Prometheus → Grafana
Traces   → OpenTelemetry OTLP spans → Jaeger (primary recommendation)
```

### 2.2 Why Jaeger Over Zipkin

| Capability                      | Jaeger       | Zipkin            |
| ------------------------------- | ------------ | ----------------- |
| Native OTLP ingest              | ✅           | ❌ (needs bridge) |
| Adaptive sampling               | ✅           | ❌                |
| Service dependency graph        | ✅           | ✅                |
| Tag-based filtering             | ✅ (better)  | ✅ (basic)        |
| Distributed context propagation | W3C + Jaeger | B3 only           |
| Kubernetes native               | ✅           | ✅                |
| All-in-one Docker image         | ✅           | ✅                |
| UI quality                      | ⭐⭐⭐⭐⭐   | ⭐⭐⭐            |

**Decision: Jaeger** — native OTLP, best UI, adaptive sampling. Single container for dev.

### 2.3 Full Observability Docker Compose Stack

```yaml
# docker-compose.observability.yml (NEW — separate from app compose)
services:
  prometheus: # Metrics scraping + storage
  grafana: # Unified dashboards (metrics + traces + logs)
  jaeger: # Distributed tracing (OTLP receiver)
  loki: # Log aggregation
  promtail: # Log shipper (tails agent log files)
  alertmanager: # Alert routing (Slack/PagerDuty)
```

---

## 3. Implementation Work Breakdown

### Phase 1: OTel Instrumentation in Core (Tim + Roman + Claire)

**Branch:** `observability/otel-core`

- `src/telemetry/otel.ts` — SDK init, resource attributes, OTLP exporter
- `src/telemetry/tracer.ts` — Tracer singleton + span helpers
- `src/telemetry/metrics.ts` — Meter, counters, histograms
- `src/telemetry/logger.ts` — Structured logger (pino), separate log files per agent
- Integration points:
  - Gateway request handler → HTTP server span
  - Agent session lifecycle → session span (start→end) with subagent child spans
  - Tool invocations → tool span (inside UTEE middleware when M1 lands)
  - Model API calls → LLM span with token/cost attributes

**Log file strategy:**

- Main: `~/.openclaw/logs/gateway.jsonl`
- Per-agent: `~/.openclaw/logs/agents/{agentId}/{date}.jsonl`
- Rotation: daily + max 50MB per file, 30-day retention
- Separate from existing output logs (never pollute ~/.openclaw/\*.log)

### Phase 2: Prometheus Exporter (Roman + Larry)

**Branch:** `observability/prometheus-exporter`

Extension or core module exposing `/metrics` endpoint:

```
openclaw_session_duration_seconds{agent,model,kind}
openclaw_session_tokens_total{agent,model,provider,type="input|output"}
openclaw_session_cost_usd{agent,model,provider}
openclaw_tool_calls_total{tool,status,agent}
openclaw_model_errors_total{model,error_type,agent}
openclaw_agent_active_sessions{agent}
```

### Phase 3: Docker Compose Observability Stack (Codex Spark)

**Branch:** `observability/docker-stack`

`docker-compose.observability.yml` + `observability/` directory:

```
observability/
├── docker-compose.observability.yml
├── prometheus/
│   └── prometheus.yml           # Scrape configs
├── grafana/
│   ├── provisioning/
│   │   ├── dashboards/          # Auto-provisioned dashboards
│   │   └── datasources/         # Prometheus + Jaeger + Loki
│   └── dashboards/
│       ├── openclaw-overview.json
│       ├── agent-metrics.json
│       ├── model-performance.json
│       ├── cost-analysis.json
│       └── a-b-experiments.json
├── loki/
│   └── loki-config.yaml
├── promtail/
│   └── promtail-config.yaml     # Tail ~/.openclaw/logs/**/*.jsonl
├── jaeger/
│   └── (config if needed)
└── README.md
```

### Phase 4: A/B Testing + Experiment Tracking (Amadeus + Barry/Jerry)

**Branch:** `observability/experiments`

- Feature flag system: `src/experiments/flags.ts` (JSON config-driven)
- Experiment context propagation in OTel spans (`experiment.id`, `variant`)
- Telemetry schema extension: `experimentId`, `variant`, `cohort`
- Grafana dashboard: experiment comparison panels (metric A vs B with date ranges)
- Regression detection: baseline metric computation + threshold alerts

### Phase 5: Analytics UI (Luis + MiniMax squad)

**Branch:** `observability/analytics-ui`

Wire existing Horizon UI views to real observability APIs:

- `UsageDashboard.tsx` → real Prometheus metrics via `/metrics` proxy
- Agent Activity Dashboard (Idea #4) → real Gateway WebSocket events
- Session Replay & Debug Timeline (Idea #7) → real session JSONL + Jaeger trace lookup
- New: Cost Analysis view with model comparison charts
- New: A/B Experiment Dashboard

### Phase 6: Regression Testing + Cost Optimization Analysis (Drew + Codex Spark)

**Branch:** `observability/regression-harness`

- `scripts/regression-check.ts` — compare metric baselines across git tags
- Cost optimization CLI: `openclaw telemetry cost-optimize` — suggests model downgrades based on Q-score ROI
- Weekly digest cron: aggregates metrics, flags regressions, sends Slack report

---

## 4. Model Assignments for Implementation

| Phase   | Task                             | Model                               | Agent        |
| ------- | -------------------------------- | ----------------------------------- | ------------ |
| P1      | OTel SDK integration             | gpt-5.3-codex-spark (High Thinking) | Roman        |
| P1      | Structured logger + log rotation | MiniMax M2.5                        | Jerry        |
| P1      | Session span lifecycle           | gpt-5.3-codex-spark                 | Claire       |
| P2      | Prometheus /metrics endpoint     | gpt-5.3-codex-spark                 | Roman        |
| P2      | Metrics schema + labels          | GLM-5                               | Barry        |
| P3      | docker-compose.observability.yml | gpt-5.3-codex-spark (High Thinking) | Larry        |
| P3      | Grafana dashboards JSON          | gpt-5.3-codex-spark                 | Oscar        |
| P3      | Prometheus scrape config         | GLM-5                               | Vince        |
| P3      | Loki + Promtail config           | GLM-5                               | Nate         |
| P4      | Feature flag system              | MiniMax M2.5                        | Barry        |
| P4      | Experiment telemetry schema      | GLM-5                               | Jerry        |
| P4      | Grafana A/B dashboard            | gpt-5.3-codex-spark                 | Oscar        |
| P5      | UsageDashboard wire-up           | MiniMax M2.5                        | Wes          |
| P5      | Agent Activity Dashboard         | MiniMax M2.5                        | Quinn        |
| P5      | Session Replay view              | MiniMax M2.5                        | Piper        |
| P5      | Cost Analysis view               | MiniMax M2.5                        | Reed         |
| P6      | Regression harness               | gpt-5.3-codex-spark                 | Larry        |
| P6      | cost-optimize CLI command        | gpt-5.3-codex-spark                 | Sandy        |
| Reviews | All PRs                          | gpt-5.3-codex-medium                | Tim → Xavier |

---

## 5. Mega-Branch Strategy

```
observability/main          ← integration branch (all PRs merge here)
├── observability/otel-core      (P1)
├── observability/prometheus-exporter (P2)
├── observability/docker-stack   (P3)
├── observability/experiments    (P4)
├── observability/analytics-ui   (P5)
└── observability/regression-harness (P6)
```

David reviews `observability/main` before final merge to `dgarson/fork`.

---

## 6. Success Criteria

- [ ] OTel spans visible in Jaeger for every agent session (including subagent chains)
- [ ] Prometheus metrics at `/metrics` with all 6 metric families
- [ ] `docker compose -f docker-compose.observability.yml up` starts full stack in <2 min
- [ ] Grafana at `:3000` with 5 auto-provisioned dashboards (no manual config)
- [ ] Per-agent log files at `~/.openclaw/logs/agents/{id}/` with daily rotation
- [ ] A/B experiment framework: create experiment → assign variant → see comparison in Grafana
- [ ] Regression test: `openclaw telemetry regression --baseline v1 --current HEAD` outputs pass/fail
- [ ] `openclaw telemetry cost-optimize` outputs actionable model downgrade recommendations
