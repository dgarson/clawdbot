# Design: Extension Boundary Review and Consolidation Strategy (b)

## Objective

Define whether current extension boundaries are meaningful, identify safe consolidation options, and describe a target architecture that improves reliability, operability, and maintainability.

## Current State (Bounded Contexts)

- `ocx-event-ledger`: canonical event capture, retention, and query.
- `ocx-observability`: health/anomaly/reaper decisioning and telemetry views.
- `ocx-budget-manager`: budget and quota enforcement.
- `ocx-routing-policy`: model routing and prompt contribution policy.
- `ocx-evaluation`: post-run quality scoring and comparison.
- `ocx-orchestration`: work-item/sprint/review/delegation lifecycle.
- `inter-agent-mail`: asynchronous agent messaging/transport.

This separation is broadly sound and aligns to domain boundaries.

## Problem Statement

While domain boundaries are meaningful, cross-extension operator workflows require joining many APIs and stores. This causes:

- fragmented diagnostics,
- duplicated policy/evidence logic,
- higher integration and context overhead.

## Consolidation Principles

1. Prefer **logical consolidation** (shared runtime/contracts) before hard package merges.
2. Preserve isolation where blast radius is critical.
3. Consolidate where data paths are already tightly coupled.
4. Keep migration incremental and reversible.

## Recommended Consolidation Shape

### Track A: Observability Plane

Consolidate (or tightly unify) `ocx-observability` + `ocx-event-ledger` via shared storage/query interfaces.

Expected gains:

- one evidence spine for incidents,
- reduced event-shape duplication,
- lower operator query overhead.

### Track B: Governance Plane

Unify `ocx-budget-manager` + `ocx-routing-policy` through shared policy evaluation primitives.

Expected gains:

- budget-aware routing as first-class behavior,
- consistent policy precedence and explainability,
- fewer divergent policy files and parsers.

### Keep Separate with Shared Core

Keep `ocx-orchestration` and `inter-agent-mail` distinct but extract a shared coordination contract:

- delegation lineage model,
- escalation semantics,
- handoff metadata standard.

## Shared Runtime Contracts

Introduce a shared control-plane contracts/runtime layer:

- event envelope and family/type registries,
- decision explain schema,
- retention metadata,
- policy evaluation trace format.

## Data/Storage Strategy

Adopt storage adapter interface:

- default file adapter,
- optional SQLite adapter,
- future external backends.

This unlocks safe consolidation without immediate package hard-merge.

## Risks and Mitigations

- **Risk**: blast radius grows with merges.
  - **Mitigation**: start with shared interfaces + adapters.
- **Risk**: migration complexity.
  - **Mitigation**: dual-read/dual-write transition window.
- **Risk**: regression in plugin autonomy.
  - **Mitigation**: preserve per-domain ownership and tests.

## Success Metrics

- Reduced cross-plugin incident triage time.
- Fewer duplicated event/policy transform paths.
- Lower operator API call count per investigation.
- Stable or improved failure isolation.
