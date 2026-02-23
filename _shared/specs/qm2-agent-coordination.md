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
