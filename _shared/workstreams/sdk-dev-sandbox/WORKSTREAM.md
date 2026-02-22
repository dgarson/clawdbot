# WORKSTREAM.md — OpenClaw SDK + Local Dev Sandbox

_Mega-branch:_ `feat/sdk-dev-sandbox`
_Owner:_ Tim
_Created:_ 2026-02-22
_Last updated:_ 2026-02-22 13:33 MST

## Deliverable

Ship bs-tim-6: developer-facing SDK plus local sandbox runtime with clear package boundaries, runnable quickstart, and reliability-oriented test coverage for local/CI workflows.

## Design

Primary design spec:

- `/Users/openclaw/.openclaw/workspace/_shared/specs/bs-tim-6-sdk-sandbox.md`

Package boundaries:

- `@openclaw/sdk`
- `@openclaw/sandbox`
- `@openclaw/cli`

## Strategy

1. Phase 1: package shells + typed client interfaces + docs quickstart
2. Phase 2: local runtime lifecycle implementation + CLI ops commands
3. Phase 3: CI hardening, compatibility matrix, release checklist

## Tasks & Status

| Task                                  | Owner       | Status         | Notes                            |
| ------------------------------------- | ----------- | -------------- | -------------------------------- |
| Branch bootstrap + registry           | Tim         | ✅ done        | Branch pushed to origin          |
| SDK package scaffolding               | Sandy       | 🔄 in-progress | Feature Dev lead                 |
| Sandbox lifecycle implementation plan | Claire      | 🔄 in-progress | state machine + failure handling |
| CLI/quickstart validation             | Larry/Harry | ⏳ queued      | runbook + docs hardening         |

## Squad

- Tim — architecture decisions + final review
- Sandy/Claire — primary execution owners
- Larry/Harry — quickstart DX + test collateral

## Open Questions / Blockers

- Single-flight vs bounded parallel execution in phase 1 sandbox
- Credential handoff path (SDK config vs runtime bootstrap)
- Persistent artifact path defaults in CI vs local dev
