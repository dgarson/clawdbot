# Horizon operator dashboard improvement backlog (impact x complexity)

## Ranked improvements (top = highest impact for manageable complexity)

| Rank | Improvement                                                                                 | Impact | Complexity | Status         |
| ---- | ------------------------------------------------------------------------------------------- | ------ | ---------- | -------------- |
| 1    | Realtime Event Tail view with mode filters + pause/search                                   | High   | Low        | ✅ Implemented |
| 2    | Budget Guardrails Center for spend caps + anomaly controls                                  | High   | Low        | ✅ Implemented |
| 3    | Routing Self-Eval Workbench for mismatch/review loops                                       | High   | Low        | ✅ Implemented |
| 4    | Model Provider Utilization Explorer (latency, error, cost/1k token by provider)             | High   | Medium     | Pending        |
| 5    | Tool Reliability Drilldown (top failing tools + retry classes + runbook links)              | High   | Medium     | Pending        |
| 6    | Decision Provenance Viewer (decision -> evidence -> feedback -> review status timeline)     | High   | Medium     | Pending        |
| 7    | Live Journal Tailing presets (agent journal, tool journal, routing journal, budget journal) | Medium | Low        | Pending        |
| 8    | Operator Copilot Action Queue (AI suggestions with approve/apply flow)                      | High   | Medium     | Pending        |
| 9    | Model/Budget policy simulator (what-if thresholds before applying)                          | Medium | Medium     | Pending        |
| 10   | Shift handoff summary generator (auto brief of key anomalies + actions)                     | Medium | Medium     | Pending        |

## Implemented now

### 1) Realtime Event Tail view

- Added dedicated `RealtimeEventTail` view with:
  - mode tabs (`all`, `routing`, `tool`, `budget`, `journal`)
  - stream pause/resume control
  - source/message search
  - severity-aware line rendering

### 2) Budget Guardrails Center

- Added `BudgetGuardrailsCenter` with:
  - daily spend, anomaly risk, protection state cards
  - provider cap snapshots
  - guardrail knobs for throttle and alert sensitivity

### 3) Routing Self-Eval Workbench

- Added `RoutingSelfEvalWorkbench` with:
  - mismatch/false-escalation/open-review metrics
  - confusion hotspots summary
  - self-eval action checklist

## UI cohesion updates

- Registered the 3 views in Horizon navigation and render routing.
- Added skeleton mapping for new view IDs.
- Kept operator dashboard as default entrypoint and surfaced these views as direct adjacent operator workflows.
