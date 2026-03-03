# QM2 Agent Coordination Layer — Phase 1 Spec Draft

**Owner:** Tim (VP Architecture) + Xavier (CTO)  
**Status:** Draft (Planning → Spec kickoff)  
**Target milestone:** Mid-March (QM2 Phase 1)

## 1) Problem Statement

OpenClaw already supports multi-agent execution and subagent spawning, but coordination is still mostly _implicit_ and per-feature. The current gaps:

1. **No canonical coordination model**
   - Different execution paths (main agent, spawned subagents, cron/hook sessions) use different control assumptions.
   - No first-class concept of a "coordination plan" or "handoff contract".

2. **Message routing is local and ad hoc**
   - Routing often depends on caller context rather than explicit delivery intent.
   - Limited policy-level routing controls (priority lanes, escalation lanes, delivery guarantees).

3. **Weak conflict prevention/resolution semantics**
   - Parallel agent outputs can race on shared resources (files, status updates, queue actions).
   - No standard conflict policy (last-write-wins vs owner-wins vs merge-required) across workstreams.

4. **Inconsistent lifecycle observability**
   - We can observe individual sessions and tool calls, but not a full coordination graph with causal links.
   - Hard to answer: "Which coordinator instruction caused this side effect?"

5. **Limited failure-path governance**
   - Missing common contract for retry, timeout, cancellation, and escalation behavior across agent-to-agent operations.
   - Human intervention points are available (HITL), but not consistently wired into coordination transitions.

### Why QM2 exists

QM1 delivered execution-plane reliability primitives. QM2 must add a **reliable coordination substrate** so multi-agent workflows are deterministic, governable, and auditable under concurrency.

---

## 2) Proposed Architecture

QM2 introduces a logical **Agent Coordination Layer (ACL)** sitting between orchestration intents and concrete session/tool execution.

### 2.1 Core pattern

1. **Coordinator intent** (task + constraints + policy)
2. **Plan compilation** into explicit coordination steps
3. **Routed dispatch** to target agents/sessions
4. **Stateful tracking** of acknowledgements, progress, and outcomes
5. **Conflict arbitration** when multiple actions target shared resources
6. **Terminalization** (success, partial, failed, escalated)

### 2.2 Coordination primitives

- **CoordinationPlan**: declarative execution graph (steps, dependencies, timeouts, ownership).
- **CoordinationStep**: single dispatchable unit with input envelope and expected output contract.
- **CoordinationEnvelope**: standard metadata attached to every inter-agent instruction.
- **CoordinationLedger**: append-only event trail keyed by `coordinationId`.
- **ArbiterPolicy**: conflict resolution strategy for contested operations.

### 2.3 Message routing model

Routing happens through explicit, policy-aware lanes:

- **Control lane** — plan/control messages (spawn, steer, cancel, escalate)
- **Data lane** — payload/result messages
- **Escalation lane** — exceptions requiring human or privileged review

Each message includes route metadata:

- `coordinationId`
- `stepId`
- `sourceSession`
- `targetSession`
- `priority`
- `deliveryMode` (best-effort | at-least-once)
- `deadlineMs`

### 2.4 Conflict resolution model

Conflicts are resolved using ordered policy evaluation:

1. **Ownership check** (does step own resource?)
2. **Lock/lease check** (active claim?)
3. **Policy strategy**
   - `owner_wins`
   - `priority_wins`
   - `merge_if_safe`
   - `manual_review`
4. **Arbiter decision emission** to ledger + downstream consumers

For Phase 1, arbitration stays deterministic and rule-based (no LLM in the decision path).

---

## 3) Key Interfaces / Contracts

## 3.1 CoordinationEnvelope (conceptual)

```ts
type CoordinationEnvelope = {
  coordinationId: string;
  stepId: string;
  parentStepId?: string;
  sourceSession: string;
  targetSession: string;
  intent: "execute" | "report" | "cancel" | "escalate" | "ack";
  priority: "low" | "normal" | "high" | "critical";
  deliveryMode: "best_effort" | "at_least_once";
  deadlineMs?: number;
  createdAtMs: number;
  trace: {
    runId?: string;
    spanId?: string;
    causalRef?: string;
  };
};
```

## 3.2 CoordinationPlan

```ts
type CoordinationPlan = {
  coordinationId: string;
  objective: string;
  ownerSession: string;
  steps: CoordinationStep[];
  conflictPolicy: ArbiterPolicy;
  failurePolicy: {
    retryBudget: number;
    timeoutPolicy: "fail_fast" | "continue_with_partial";
    escalationPolicy: "none" | "hitl";
  };
};
```

## 3.3 CoordinationLedger events

Minimum event types for Phase 1:

- `coordination.created`
- `step.dispatched`
- `step.acknowledged`
- `step.completed`
- `step.failed`
- `step.timed_out`
- `conflict.detected`
- `conflict.resolved`
- `coordination.escalated`
- `coordination.terminal`

### 3.4 Idempotency and replay

- Every dispatch carries `idempotencyKey = coordinationId:stepId:attempt`.
- Receivers must treat duplicate keys as replay, not new work.
- Ledger is the source of truth for recovery/replay decisions.

---

## 4) Phasing

## Phase 1 (QM2 target: mid-March)

1. **Contract layer**
   - Introduce CoordinationEnvelope + CoordinationPlan types.
   - Add lightweight validation for envelope/plan payloads.

2. **Routing layer (MVP)**
   - Control/data lane dispatch abstraction.
   - Basic delivery guarantees (`best_effort`, `at_least_once`) with idempotency keys.

3. **Ledger + observability**
   - Persist core coordination events.
   - Add trace correlation hooks (runId/spanId linkage).

4. **Conflict arbitration (rule-based v1)**
   - Implement owner/priority/manual-review strategies.
   - Emit `conflict.*` events and deterministic outcomes.

5. **Failure semantics**
   - Standard timeout + retry budget handling.
   - Escalation hook to HITL for policy-defined cases.

### Post-Phase 1 (later QM2+)

- Plan compiler optimization and dependency-aware scheduling.
- Advanced arbitration (semantic merge helpers where safe).
- Priority fairness + backpressure queues.
- Policy DSL and per-workstream policy packs.
- Coordination analytics dashboards and SLOs.

---

## 5) Dependencies on Other Workstreams

## HITL (bs-tim-2)

- Required for `manual_review` conflict path and escalation lane.
- Need stable interface for creating/awaiting decisions with timeout semantics.

## Memory Architecture 2.0 (bs-tim-3)

- Needed for durable ledger storage, retrieval, and replay support.
- Coordination events should be queryable by `coordinationId` and causal trace refs.

## ACP Integration (bs-tim-1)

- ACP transport/capability model should carry coordination envelope metadata end-to-end.
- Coordination layer should remain transport-agnostic; ACP is a primary execution backend.

---

## 6) Open Questions (Xavier / David)

1. **Scope boundary for Phase 1:**
   - Do we require full lane separation in runtime now, or can we stage with logical lanes over existing transport?

2. **Delivery guarantee target:**
   - Is `at_least_once` sufficient for Phase 1, or do we need selective exactly-once semantics for sensitive operations?

3. **Conflict policy default:**
   - Should global default be `owner_wins` or `manual_review` for high-risk operations?

---

## 7) Minimally Invasive Implementation Plan (Reuse-First)

This section maps QM2 to existing OpenClaw primitives so Phase 1 can land with low churn and minimal new runtime surface area.

### 7.1 Existing primitives we should extend first

1. **Agent event stream (already run-scoped + ordered)**
   - `src/infra/agent-events.ts` already gives per-run ordering via `(runId, seq)` and includes optional `sessionKey` context.
   - Reuse this as the first sink for `coordination.*` lifecycle emissions before introducing any new transport.

2. **Subagent lifecycle hooks and events (already modeled)**
   - Subagent lifecycle concepts exist (`src/agents/subagent-lifecycle-events.ts`) and plugin hooks already expose subagent spawning/spawned/ended interception points.
   - Represent each subagent hop as a `CoordinationStep` wrapper around existing spawn + completion semantics, rather than replacing subagent internals.

3. **Plugin hook framework (existing policy extension point)**
   - `src/plugins/hooks.ts` already supports ordered (priority-aware) hook execution and merge semantics for modifying hooks.
   - Add coordination-specific hook events (for arbitration + escalation decisions) instead of introducing a separate policy engine in Phase 1.

4. **Existing durable queue path for at-least-once behavior**
   - `src/infra/outbound/delivery-queue.ts` already provides a persisted queue, retries, backoff, and recovery.
   - Reuse its persistence/retry pattern for coordination dispatch retry semantics (`deliveryMode=at_least_once`) in the MVP.

5. **Lane-based command serialization primitive**
   - `src/process/command-queue.ts` already gives lane-based bounded concurrency.
   - Use lanes to implement logical control/data routing lanes without requiring an immediate new message bus.

### 7.2 Recommended Phase 1 integration shape

1. **Contracts package (types + validation only, no new runtime yet)**
   - Add `CoordinationEnvelope`, `CoordinationPlan`, `CoordinationStep`, `ArbiterPolicy` types in a small, isolated module (for example `src/agents/coordination/contracts.ts`).
   - Keep validation lightweight and runtime-safe (fast structural checks + useful errors).

2. **Envelope pass-through in existing call paths**
   - Thread an optional `coordination` field through existing subagent dispatch and relevant hook contexts.
   - If absent, execution behaves exactly as today (strict backward compatibility).

3. **Logical lanes over existing queue primitive**
   - Map:
     - control lane → high-priority command lane
     - data lane → normal command lane
     - escalation lane → dedicated lane with low concurrency (or serial)
   - Keep this as a naming/policy layer over `enqueueCommandInLane` to avoid infrastructure churn.

4. **Ledger as event projection first**
   - Start with append-only coordination event projection by emitting to agent events + a small durable log writer.
   - Avoid introducing a new storage backend in Phase 1; write events in a recoverable format keyed by `coordinationId`.

5. **Arbitration in deterministic policy module**
   - Implement rule-based arbitration as a pure function (`owner_wins`, `priority_wins`, `merge_if_safe`, `manual_review`).
   - Invoke it at contested write boundaries (session/file/queue side effects), and always emit a ledger decision event.

6. **Escalation via existing HITL hooks**
   - Route `manual_review` and policy-triggered escalation through existing hook/plugin integration points first.
   - Keep HITL transport abstraction pluggable so ACP-backed or provider-specific escalations can reuse the same coordination contract.

### 7.3 Compatibility and risk controls

- **Default-off flag:** ship behind `coordination.phase1.enabled` config gate.
- **No behavior break:** if no envelope is present, current subagent and hook flows must remain unchanged.
- **Deterministic replay:** enforce `idempotencyKey=coordinationId:stepId:attempt` at dispatch boundary; duplicates become no-ops.
- **Observability first:** require every state transition to emit a `coordination.*` event before enabling broader rollout.

### 7.4 Suggested concrete sequencing (small PR slices)

1. Add contracts + validation + tests.
2. Add event emission helpers (`coordination.created`, `step.dispatched`, etc.) backed by current event infrastructure.
3. Add lane adapter + dispatch wrapper using existing queue semantics.
4. Add arbitration module + deterministic tests.
5. Add escalation hook bridge.
6. Enable for one controlled flow (subagent spawn path), then expand.

### 7.5 Non-goals for Phase 1 (to keep scope disciplined)

- No brand-new transport protocol.
- No exactly-once guarantees across all operations.
- No LLM-driven conflict decisions.
- No full policy DSL.
- No UI dashboard dependency for rollout.

4. **Escalation policy ownership:**
   - Who owns default escalation mappings (Architecture vs Security/Ops)?

5. **Persistence backend choice for ledger in Phase 1:**
   - Extend existing SQLite footprint, or wire directly to Memory Arch 2.0 storage abstraction?

6. **SLO commitment for QM2 Phase 1:**
   - Which objective is primary: lower coordination failures, faster completion latency, or deterministic replay fidelity?

7. **Rollout strategy:**
   - Single feature-flagged cutover vs per-workstream adoption (HITL first, then Memory/ACP-heavy flows)?

---

## 7) Proposed Next Step

- Align on open questions in an architecture review with Xavier.
- Freeze Phase 1 contract set (Envelope, Plan, Ledger event schema).
- Start implementation branch for routing + ledger MVP under QM2 feature flag.
