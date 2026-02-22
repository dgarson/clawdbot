# WORKSTREAM.md — OpenClaw Observability Stack

_Mega-branch:_ `observability/main`  
_Base branch:_ `dgarson/fork`  
_Owner:_ Xavier (engineering lead), Merlin (orchestrator)  
_Created:_ 2026-02-21  
_Last updated:_ 2026-02-22 00:11 MST (Merlin — merged OBS-03/04/06 into observability/main)  
_Priority:_ **P0 — 16-hour overnight workstream**  
_Deadline:_ 2 PM MST Feb 22

---

## Deliverable

A full end-to-end observability stack for OpenClaw: structured per-agent logging (Loki), OpenTelemetry distributed tracing (Jaeger), Prometheus metrics with a `/metrics` exporter, a Docker Compose stack that spins up the entire backend in one command, an A/B experiment framework, analytics UI wired to real data, and a regression/cost-optimization CLI. The entire stack must integrate with the existing UTEE middleware (PR #46) and Telemetry Extension (PR #47).

**Full spec:** `/Users/openclaw/.openclaw/workspace/_shared/OBS_STACK_SPEC.md`

---

## Design

- **Traces:** OpenTelemetry SDK → OTLP → Jaeger (native OTLP ingest, adaptive sampling, rich dependency graph UI)
- **Metrics:** Prometheus counters/histograms exposed at `/metrics` endpoint → Prometheus scrape → Grafana
- **Logs:** Structured JSON per-agent at `~/.openclaw/logs/agents/{agentId}/YYYY-MM-DD.jsonl` → Loki via Promtail
- **Dashboards:** Grafana with 5 auto-provisioned dashboards (no manual config required)
- **Log rotation:** Daily + 50MB max per file + 30-day retention — never pollute existing `~/.openclaw/*.log` files
- **Docker:** `observability/docker-compose.observability.yml` — completely isolated from app compose, connects via scrape URLs
- **A/B:** Feature flag system → experiment context in OTel spans → Grafana comparison panels
- **Reviews:** gpt-5.3-codex-medium handles routine PR reviews. Xavier reserved for major checkpoint reviews only.

---

## Strategy (6 Phases, Sequential + Parallel Where Possible)

```
Phase 1 (OTel Core)      ─────────────────────────────────────────► PR → observability/main
Phase 2 (Prometheus)          starts after P1 PR opens ──────────────────────────────► PR
Phase 3 (Docker Stack)   ─────── can start parallel to P1 ──────────────────────────► PR
Phase 4 (A/B)                 starts after P1 types available ───────────────────────► PR
Phase 5 (Analytics UI)        starts after P1+P2 complete ──────────────────────────► PR
Phase 6 (Regression)          starts after P1+P2 complete ──────────────────────────► PR
                                                              ▼
                                               observability/main → David reviews → dgarson/fork
```

---

## Tasks & Status

Reference: `/Users/openclaw/.openclaw/workspace/_shared/WORKBOARD.md` (OBS-01 through OBS-06)

| Task                                         | Branch                              | Lead                       | Model                       | Status                                      |
| -------------------------------------------- | ----------------------------------- | -------------------------- | --------------------------- | ------------------------------------------- |
| OBS-01 — OTel Core Instrumentation           | `observability/otel-core`           | Merlin sub-agent (opus)    | anthropic/claude-opus-4-6   | `in-progress` — running 00:11 MST           |
| OBS-02 — Prometheus /metrics Endpoint        | `observability/prometheus-exporter` | Merlin sub-agent (opus)    | anthropic/claude-opus-4-6   | `in-progress` — running 00:11 MST           |
| OBS-03 — Docker Compose Stack                | `observability/docker-stack`        | Merlin sub-agent (opus)    | anthropic/claude-opus-4-6   | `done` — PR #55 merged → observability/main |
| OBS-04 — A/B Testing + Experiment Tracking   | `observability/experiments`         | Merlin sub-agent (minimax) | minimax-portal/MiniMax-M2.5 | `done` — PR #56 merged → observability/main |
| OBS-05 — Analytics UI Wire-up                | `observability/analytics-ui`        | Merlin sub-agent (minimax) | minimax-portal/MiniMax-M2.5 | `in-progress` — running 00:11 MST           |
| OBS-06 — Regression Harness + Cost Optimizer | `observability/regression-harness`  | Merlin sub-agent (opus)    | anthropic/claude-opus-4-6   | `done` — PR #57 merged → observability/main |

---

## Squad

| Agent   | Role                                           | Model                               | Phases      |
| ------- | ---------------------------------------------- | ----------------------------------- | ----------- |
| Roman   | OTel SDK + Prometheus lead                     | gpt-5.3-codex-spark (High Thinking) | P1, P2      |
| Larry   | Docker Stack + Regression                      | gpt-5.3-codex-spark (High Thinking) | P3, P6      |
| Oscar   | Grafana dashboards                             | gpt-5.3-codex-spark                 | P3          |
| Nate    | Loki + Promtail config                         | gpt-5.3-codex-spark                 | P3          |
| Vince   | Prometheus scrape config                       | gpt-5.3-codex-spark                 | P3          |
| Barry   | Feature flag system + MiniMax mediator         | MiniMax M2.5                        | P4          |
| Jerry   | Experiment telemetry schema + MiniMax mediator | MiniMax M2.5                        | P4          |
| Wes     | UsageDashboard wire-up                         | MiniMax M2.5                        | P5          |
| Quinn   | Agent Activity Dashboard                       | MiniMax M2.5                        | P5          |
| Piper   | Session Replay view                            | MiniMax M2.5                        | P5          |
| Reed    | Cost Analysis view                             | MiniMax M2.5                        | P5          |
| Sandy   | cost-optimize CLI command + PR reviews         | gpt-5.3-codex-spark                 | P6, reviews |
| Claire  | Session span lifecycle                         | gpt-5.3-codex-spark                 | P1          |
| Xavier  | Engineering lead, checkpoint reviews only      | claude-sonnet-4-6                   | All         |
| Tim     | UTEE integration guidance, arch reviews        | gpt-5.3-codex                       | All         |
| Luis    | Analytics UI coordination (post-P1/P2)         | claude-sonnet-4-6                   | P5          |
| Amadeus | AI telemetry requirements, A/B spec            | claude-opus-4-6                     | P4          |

**Review chain:**

1. Barry / Jerry (MiniMax M2.5) — first-tier review on sub-PRs
2. Sandy / Tony (gpt-5.3-codex-medium) — routine PR reviews
3. Xavier — only for: core OTel initializer changes, phase integration PRs, final `observability/main` → `dgarson/fork` PR

---

## Agent Discovery (Progressive Disclosure)

Any agent working on any observability ticket should:

1. **Start here:** `_shared/workstreams/observability/WORKSTREAM.md` (this file)
2. **Full spec:** `_shared/OBS_STACK_SPEC.md` — architecture decisions, Docker compose layout, metric families, Grafana structure
3. **Workboard:** `_shared/WORKBOARD.md` — OBS-01 through OBS-06 with per-task details
4. **Mega-branch registry:** `_shared/MEGA_BRANCHES.md` — official branch list
5. **Model policy:** `_shared/MODEL_SELECTION_POLICY.md` — which models for which tasks
6. **Existing telemetry:** `extensions/telemetry/` (PR #47), `tim/memory/2026-02-21-utee-notes.md` (UTEE schema)

**Don't start writing code until you've read the spec.** The architecture decisions are made — no need to relitigate Jaeger vs Zipkin or the log path structure.

---

## Open Questions / Blockers

- **Brave API key** — web search is off for all agents (David's action item, 30-min fix, needed before Monday 10 AM Discovery launch)
- **PR #46 UTEE canary** — Tim review in progress; OBS-01 should coordinate on shared span attributes with UTEE middleware
- **PR #47 Telemetry Extension** — currently in review; OBS-01 should not duplicate; extend rather than replace
