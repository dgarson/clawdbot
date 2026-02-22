# WORKSTREAM.md — Human Approval Gateway

_Mega-branch:_ `feat/hitl-gateway`
_Owner:_ Xavier + Tim
_Created:_ 2026-02-22
_Last updated:_ 2026-02-22 13:34 MST

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

| Task                                       | Owner          | Status         | Notes                                  |
| ------------------------------------------ | -------------- | -------------- | -------------------------------------- |
| Phase 1 foundation validation              | Tim            | ✅ done        | Landed on `feat/hitl-gateway`          |
| Phase 2 policy + escalation implementation | Roman + Tony   | 🔄 in-progress | primary critical path                  |
| Strict-mode/approval boundary tests        | Claire + Barry | ⏳ queued      | must include no-self-approval coverage |

## Squad

- Roman: phase-2 execution lead
- Tony: escalation and policy transition paths
- Claire: integration and safety testing
- Barry: approval lifecycle edge-case coverage
- Tim: architecture gate + cross-workstream coordination
