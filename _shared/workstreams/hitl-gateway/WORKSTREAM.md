# WORKSTREAM.md — Human Approval Gateway

_Mega-branch:_ `feat/hitl-gateway`
_Owner:_ Xavier + Tim
_Created:_ 2026-02-22
_Last updated:_ 2026-02-23 03:20 MST

## Deliverable

Policy-driven HITL Gateway for gating tool executions.

## Design

Reference detailed specs by absolute path:

- `/Users/openclaw/.openclaw/workspace/_shared/specs/bs-tim-2-hitl-gateway.md`
- `/Users/openclaw/.openclaw/workspace/_shared/specs/bs-tim-2-hitl-implementation-plan.md`

## Strategy

- Phase 1: ✅ Core infrastructure (HitlRequestStore, HitlPolicyEngine, ExecApprovalManager extension)
- Phase 2: ✅ Policy wiring, escalation flows, strict-mode enforcement (HitlGateway class + 26 tests)
- Phase 3: ✅ Test scaffolding + integration tests (PR #76, node-invoke approval tests)
- Phase 4 (active): HitlGateway orchestration class landed on feat/hitl-gateway — gate-level enforcement, audit trail, escalation. 56 HITL tests passing.
- Phase 5 (next): Server-level wiring — hook HitlGateway into node.invoke / tool dispatch paths; forwarding to operator channels

## Tasks & Status

| Task                                                      | Owner          | Status    | Notes                                           |
| --------------------------------------------------------- | -------------- | --------- | ----------------------------------------------- |
| Phase 1 foundation validation                             | Tim            | ✅ done   | HitlRequestStore, HitlPolicyEngine, ApprovalMgr |
| Phase 2 policy + escalation implementation                | Roman + Tony   | ✅ done   | HitlGateway class designed (tony branch)        |
| Strict-mode/approval boundary tests                       | Claire + Barry | ✅ done   | no-self-approval, timeout, chain depth          |
| Phase 3 integration + test scaffolding (PR #76)           | Tim            | ✅ done   | node-invoke approval bypass E2E test            |
| Phase 4: HitlGateway class on feat/hitl-gateway (0d7e86c) | Amadeus        | ✅ done   | 24 new tests, 56 total passing                  |
| Phase 5: Server wiring — hook into tool dispatch          | TBD            | ⏳ queued | node.invoke, exec, channel approval forwarding  |

## What's In feat/hitl-gateway Now

- `hitl-request-store.ts` — SQLite-backed request/decision/audit persistence
- `hitl-policy-engine.ts` — Policy resolution (exact/category/wildcard/default), role auth, chain depth, escalation
- `hitl-gateway.ts` — Orchestration class: checkAndGate / authorize / recordDecision / expireRequest
- `exec-approval-manager.ts` — In-memory approval lifecycle (generalized for HITL payloads)
- Tests: 56 passing across all HITL components

## Phase 5 Work Remaining

1. **Server wiring** — integrate `HitlGateway.checkAndGate()` at `node.invoke` entry point (pre-dispatch hook)
2. **Approval forwarding** — emit HITL pending events to operator channels (Slack #cb-notifications or configured target)
3. **Decision API** — expose `exec.approval.hitl.decide` RPC method for channel-based approve/deny
4. **Timeout worker** — background sweep to expire/escalate overdue requests
5. **Config surfacing** — document `approvals.hitl` config structure with examples

## Squad

- Roman: phase-2 execution lead
- Tony: escalation and policy transition paths
- Claire: integration and safety testing
- Barry: approval lifecycle edge-case coverage
- Tim: architecture gate + cross-workstream coordination
- Amadeus: phase 4 delivery (HitlGateway class)
