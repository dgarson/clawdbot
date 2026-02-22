# WORKSTREAM.md — Human Approval Gateway

_Mega-branch:_ `feat/hitl-gateway`
_Owner:_ Xavier + Tim
_Created:_ 2026-02-22
_Last updated:_ 2026-02-22 13:40 MST

## Deliverable

Policy-driven HITL Gateway for gating tool executions.

## Design

Reference detailed specs by absolute path:

- `/Users/openclaw/.openclaw/workspace/_shared/specs/bs-tim-2-hitl-gateway.md`
- `/Users/openclaw/.openclaw/workspace/_shared/specs/bs-tim-2-hitl-implementation-plan.md`

## Strategy

- Phase 1: ✅ Core infrastructure landed (HitlRequestStore, HitlPolicyEngine, ExecApprovalManager extension)
- Phase 2 (active): Policy wiring, escalation flows, strict-mode enforcement, and integration hardening
- Phase 3: end-to-end validation + rollout guards

## Tasks & Status

| Task                                       | Owner          | Status    | Notes                             |
| ------------------------------------------ | -------------- | --------- | --------------------------------- |
| Phase 1 foundation validation              | Tim            | ✅ done   | Landed on `feat/hitl-gateway`     |
| Phase 2 policy + escalation implementation | Roman + Tony   | ✅ done   | HitlGateway class + 26 tests      |
| Strict-mode/approval boundary tests        | Claire + Barry | ✅ done   | no-self-approval, timeout, strict |
| Phase 3 integration + e2e validation       | TBD            | ⏳ queued | node-invoke wiring, E2E tests     |

## Squad

- Roman: phase-2 execution lead
- Tony: escalation and policy transition paths
- Claire: integration and safety testing
- Barry: approval lifecycle edge-case coverage
- Tim: architecture gate + cross-workstream coordination
