# Design: Tool Surface Consolidation and Expansion (c)

## Objective

Reduce tool sprawl and context overhead while preserving safety, permissions boundaries, and testability.

## Current State

- Some domains already use multi-action tools (`mail`, `orchestration`).
- Several control-plane capabilities remain gateway-method-heavy and fragmented for operators.

## Problem Statement

Operators and agents must discover many methods/tools for one investigation. This increases:

- planning overhead,
- schema/token cost,
- inconsistent response formats.

## Proposed Tool Architecture

### 1) Unified Read/Query Tool

Create `control_plane(action=...)` for read-only and explain actions:

- `query_events`
- `run_summary`
- `health`
- `anomalies`
- `budget_status`
- `scorecards`
- `route_explain`
- `decision_trace`

Properties:

- no destructive mutation actions,
- compact normalized response envelope,
- strict action enum.

### 2) Keep Domain Mutation Tools Specialized

Do not collapse state-changing actions into mega-tool.

Examples:

- keep `mail(action=send|ack|forward...)`
- keep `orchestration(action=update_item|request_review|report_blocked...)`
- keep any destructive reaper operations behind explicit tool/method gates.

### 3) Persona-aware Access

Split worker vs operator access where possible:

- worker-centric task tools,
- operator-centric diagnostics/control tools.

## Response Envelope Standard

Define a common response shape:

- `ok`
- `action`
- `scope` (run/session/agent/time)
- `data`
- `evidenceRefs`
- `nextActions`

## Risks and Mitigations

- **Risk**: `control_plane` becomes a monolith.
  - **Mitigation**: read-only scope + strict enum + size limits.
- **Risk**: hidden permission creep.
  - **Mitigation**: explicit persona allowlists and audit events.

## Success Metrics

- Fewer tool/method invocations per incident.
- Lower average prompt/tool-cardinality.
- Faster operator time-to-explanation.
