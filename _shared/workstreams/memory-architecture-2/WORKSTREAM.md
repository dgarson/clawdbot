# WORKSTREAM.md — Memory Architecture 2.0

_Mega-branch:_ `feat/memory-architecture-2`
_Owner:_ Tim
_Created:_ 2026-02-22
_Last updated:_ 2026-02-22 13:33 MST

## Deliverable

Ship bs-tim-3 as a production-ready memory architecture: scoped retrieval, governance boundaries, retention/deletion semantics, and measurable quality gates that can be rolled out additively without destabilizing current session behavior.

## Design

Primary design spec:

- `/Users/openclaw/.openclaw/workspace/_shared/specs/bs-tim-3-memory-architecture.md`

Key decisions:

- Hybrid retrieval (vector + lexical fallback)
- Strict tenant/agent scope isolation
- Policy-driven retention/deletion with explicit forgetting flows
- Additive interfaces first, migration later

## Strategy

1. Phase 1: schema + interfaces + shadow-write wiring
2. Phase 2: hybrid read path + eval harness hooks
3. Phase 3: policy enforcement hardening + cutover plan

## Tasks & Status

| Task                           | Owner         | Status         | Notes                                       |
| ------------------------------ | ------------- | -------------- | ------------------------------------------- |
| Branch bootstrap + registry    | Tim           | ✅ done        | Branch pushed to origin                     |
| Implementation plan refinement | Amadeus/Jerry | 🔄 in-progress | fallback spec complete, now execution slice |
| Phase 1 scaffolding PR prep    | Oscar         | ⏳ queued      | kick off immediately                        |
| Evaluation metrics integration | Nate          | ⏳ queued      | align with bs-tim-7 harness                 |

## Squad

- Tim — architecture + review gate
- Amadeus/Jerry — memory model + governance policy surface
- Oscar/Nate — implementation scaffolding + test harness integration

## Open Questions / Blockers

- Final vector store backend choice for phase 1 default
- Cost guardrail thresholds for embedding refresh cadence
- Data residency controls for enterprise tenants
