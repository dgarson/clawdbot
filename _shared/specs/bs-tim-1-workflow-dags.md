# bs-tim-1 — Workflow Graphs: Durable, Restartable Agent Plans

## Objective
Deliver an execution model for agent workflow plans that behaves like a resilient DAG engine:
- deterministic and resumable across process restarts,
- checkpointed at node granularity,
- bounded failure/retry semantics,
- and aligned with existing session and cron persistence/reaper behavior.

## Scope / non-goals
- Scope: planning + run state machine + checkpoint schema + recovery and retry behavior.
- Non-goal: full orchestration of arbitrary task graphs in this doc; this is the core contract first.

## 1) DAG execution model

### Canonical definitions
- **Workflow**: versioned directed acyclic graph (`workflowId`, `planVersion`, `nodes[]`, `edges[]`, optional `defaultContext`).
- **Run**: concrete execution instance keyed by `runId`.
- **Node**: action specification + execution config.
- **Edge**: directed edge with optional `when` (`"on_success" | "on_failure" | "always" | "skip"`) and optional `condition` expression.

### Required invariants
- Graph must be acyclic (fail fast on load).
- Node ids are unique in a workflow.
- At most one active execution attempt per `(runId, nodeId)`.

### Scheduler semantics
- A scheduler cycle repeatedly:
  1. Materializes all nodes with no unmet hard dependencies.
  2. Selects ready nodes by topological order (priority optional via `node.priority`).
  3. Claims a node (pessimistic lock) and persists `running` state before execution.
  4. Executes node through a worker hook.
  5. Persists outcome checkpoint.
  6. Releases claim and wakes dependent nodes.
- A node with zero in-degree can start immediately.
- If a node fails and has outgoing `on_failure` edges, those branches may run without marking full run as failed.
- If a node fails with no failure edges and no continuation override, the run moves to `failed` and downstream `on_success` branches are marked `skipped`.
- `continueOnError` on node can force downstream `on_failure`/`always` evaluation.

## 2) Durability checkpoints

### State surfaces
- **Primary durable state**: existing session store model in `config/sessions` with lock + retry semantics.
- **Runtime state**: dedicated workflow run store (JSON file under state dir) for graph-wide run metadata and node checkpoints.
  - Pattern suggestion: `${stateDir}/agents/<agentId>/workflows/runs.json`
- **Per-node output + transcript continuity**: store output summary + pointers in session transcript/entry.

### Session key strategy (compatibility-first)
- Use nested agent session prefixes already in use by cron/subagent tooling:
  - workflow run session: `agent:<agentId>:workflow:<workflowId>:run:<runId>`
  - per-node run session: `agent:<agentId>:workflow:<workflowId>:run:<runId>:node:<nodeId>:attempt:<attempt>`
- Add detection helpers in `sessions/session-key-utils.ts`:
  - `isWorkflowRunSessionKey`, `isWorkflowNodeSessionKey`
  - plus optional label rules in `session-auto-label` if needed.

### Checkpoint shape
- Persist after every state transition:
  - `queued -> running` (lease acquired)
  - `running -> succeeded|failed|skipped|canceled`.
- Include: `runId`, `nodeId`, `attempt`, `status`, `lastError`, `retryAfterMs`, `lockOwner`, `leaseExpiresAt`, `agentHint`, `startedAtMs`, `endedAtMs`, `checkpointToken`.
- Every checkpoint append/update is idempotent by `(runId,nodeId,attempt)`.

## 3) Resume semantics

### Process restart behavior
- On startup, engine reloads workflow runs and reconstructs frontier:
  - nodes in terminal states remain terminal,
  - nodes in `running` become `stale_running` if lease expired,
  - stale running nodes are either retried (`retry` path) or marked failed when lease stale threshold exceeded.
- Resume algorithm:
  - replay dependency resolution against checkpointed node states,
  - requeue all ready nodes (idempotently),
  - preserve already-succeeded nodes and avoid duplicate side effects by honoring deterministic attempt + idempotency tokens.

### Idempotency model
- Each node attempt gets deterministic `attemptId` derived from `(runId,nodeId,attempt)`.
- Worker hooks should treat attempts as no-op if same `(attemptId)` was fully completed in prior run state.

## 4) Failure + retry policy

- Per-node `retryPolicy` fields:
  - `maxAttempts` (default `1`)
  - `initialDelayMs`
  - `maxDelayMs`
  - `backoff` (`fixed|linear|exponential`)
  - `retryableErrors` (optional allowlist/denylist of error codes/tags)
- Default policy:
  - attempt 1: immediate,
  - attempt 2+: retry with exponential backoff + jitter,
  - abort at `maxAttempts`.
- Run-level policy:
  - hard stop at `maxNodeFailures` or `maxRetriesExhausted`.
  - optional `failOpen` to convert remaining branches to `skipped` and continue.
- Retry state transitions are persisted before next delay scheduling.

## 5) Compatibility with existing sessions/cron model

- **Session persistence**: reuse `updateSessionStore` / lock APIs; no custom file locking required.
- **Cron interop**:
  - workflow launches from cron can use existing cron job path and set workflow run session as `workflow:*` base key.
  - cron session reaper patterns can be extended (or generalized) using existing retention style in `cron/session-reaper.ts`.
- **Observability / UX parity**:
  - existing session listing and tools can discover workflow sessions via `isWorkflow*SessionKey` detection.
- **Spawn lineage**:
  - map workflow node child context into `SessionEntry.spawnedBy` and `spawnDepth` similarly to existing subagent/isolated patterns.

## 6) Minimal implementation spike (if code hooks exist)

### Existing hooks to leverage (no replacement, only extension)
- `src/config/sessions/store.ts` for durable atomic updates.
- `src/cron/session-reaper.ts`/`session-reaper.test.ts` for retention style.
- `src/subagent-registry.*` and `src/sessions/session-key-utils.ts` for restart/resume and key-pattern precedent.

### Spike artifacts to add
1. `clawdbot/src/workflow/` (new) — scheduler contract + checkpoint write/read primitives.
2. `clawdbot/src/workflow/plan-types.ts` — type definitions for workflow/graph/run/node.
3. `clawdbot/src/workflow/engine.ts` — small scheduler loop + frontier reconstruction.
4. `clawdbot/src/workflow/resume.ts` — stale-running recovery logic.
5. `clawdbot/src/workflow/engine.spec.ts` and `engine.resume.spec.ts` (unit).

## 7) Tests (minimal, high-value)

- **Unit**
  - DAG validation rejects cycles; deduplicates node IDs.
  - Topology scheduler respects dependency and failure-edge semantics.
  - Retry delay progression formula + max-attempt clamping.
  - Resume reconstruction marks stale-running and re-queues safely.
- **Store/e2e**
  - Persisted run resumes after simulated crash (running node reclaimed, completed nodes preserved).
  - Node idempotency: same `attemptId` does not duplicate completion side effects.
  - Reaper behavior for workflow run/session keys using pattern-based retention.

## 8) Blockers / risks
- Need authoritative list of supported node action types before final schema freeze.
- Need a shared error taxonomy to classify retryable vs terminal failures.
- Need retention policy location in config (reuse cron retention or add dedicated workflow retention).

## Artifact paths
- Primary architecture note: `_shared/specs/bs-tim-1-workflow-dags.md`
- Suggested implementation location:
  - `clawdbot/src/workflow/`
  - `clawdbot/src/workflow/*.ts` and `clawdbot/src/workflow/*.spec.ts`
  - `clawdbot/src/sessions/session-key-utils.ts` (workflow key helpers)
  - `clawdbot/src/cron/session-reaper.ts` (retention compatibility extension, optional)