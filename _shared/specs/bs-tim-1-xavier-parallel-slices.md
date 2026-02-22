# bs-tim-1 — Xavier Parallel Slices (Draft for Tim sign-off)

## Scope
`openclaw/openclaw#bs-tim-1` — Workflow Graphs: Durable, Restartable Agent Plans (DAGs)

## Slice A — DAG Persistence + Run-State Machine

### Deliverables
- Persistent DAG run schema (run, node, edge, attempt/event tables)
- Canonical run/node states:
  - run: `pending | running | blocked | completed | failed | cancelled`
  - node: `pending | ready | running | blocked | completed | failed | skipped`
- Transition guard helpers (invalid transition rejection)
- Minimal tests for state transition integrity

### Suggested files
- `src/agents/workflow/dag-store.ts`
- `src/agents/workflow/dag-state-machine.ts`
- `test/agents/workflow/dag-state-machine.test.ts`

## Slice B — Restart/Resume Semantics + Replay Hooks Contract

### Deliverables
- Resume algorithm contract:
  - recover active run by ID
  - requeue `ready` + `blocked` resolution checks
  - prevent duplicate side-effects for completed nodes
- Replay hook interface for deterministic trace capture/replay
- Minimal tests for restart idempotency and replay hook invocation order

### Suggested files
- `src/agents/workflow/dag-resume.ts`
- `src/agents/workflow/dag-replay-hooks.ts`
- `test/agents/workflow/dag-resume.test.ts`

## Acceptance criteria
- Persisted run recovers after process restart without re-executing completed nodes
- Invalid state transitions are rejected
- Replay hooks can emit deterministic execution event sequence
