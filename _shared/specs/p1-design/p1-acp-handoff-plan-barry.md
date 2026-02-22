# P1 ACP Handoff Implementation Design

**File:** `/Users/openclaw/.openclaw/workspace/_shared/specs/p1-design/p1-acp-handoff-plan-barry.md`  
**Date:** 2026-02-21  
**Status:** P1 Design - Ready for Engineering Review  
**Parent Spec:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md`

---

## 1. Overview

This document details the P1 implementation design for the `acp_handoff` protocol, derived from the canonical ACP specification (§7). The handoff protocol enables explicit, verifiable task transfer between agents with full provenance tracking, verification gates, and auditability.

**Scope:** P1 delivery includes complete handoff lifecycle management, rejection handling, and workq integration points.

---

## 2. Handoff State Machine

### 2.1 State Diagram

```
draft → proposed → validating → accepted/rejected → activated → completed → closed
         ↓                                              ↓
      (timeout)                                   (timeout)
         ↓                                              ↓
      escalation                                   escalation
```

### 2.2 State Definitions

| State | Description | Valid Transitions |
|-------|-------------|-------------------|
| `draft` | Local construction, not yet proposed | → `proposed` |
| `proposed` | Handoff initiated, awaiting validation | → `validating`, `rejected` |
| `validating` | Schema/policy/artifact verification in progress | → `accepted`, `rejected` |
| `accepted` | Handoff approved, awaiting activation | → `activated` |
| `rejected` | Handoff declined with reason code | → `closed` |
| `activated` | Recipient assumed ownership, work underway | → `completed`, `rejected` (re-open) |
| `completed` | Task work finished, awaiting closure | → `closed` |
| `closed` | Terminal state, audit record finalized | — |

### 2.3 Transition Rules

1. **No silent handoffs** — Every transition produces an audit event
2. **Mandatory context** — `summary`, `next_step`, and ≥1 `success_criteria` required to exit `draft`
3. **Single active ownership** — Only one active handoff per `task_id` at any time
4. **Cycle prevention** — Reject if `to_agent` appears in `provenance.handoff_chain`
5. **Append-only history** — No in-place rewrite; all transitions are immutable events

---

## 3. Data Model

### 3.1 SQLite Schema (Handoff Table)

```sql
CREATE TABLE IF NOT EXISTS handoffs (
  id                 TEXT PRIMARY KEY,
  thread_id          TEXT NOT NULL,
  task_id            TEXT NOT NULL,
  from_agent         TEXT NOT NULL,
  to_agent           TEXT NOT NULL,
  title              TEXT NOT NULL,
  reason             TEXT NOT NULL,
  package_json       TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'proposed',
  provenance_json    TEXT NOT NULL,
  verification_json  TEXT NOT NULL,
  initiated_at       TEXT NOT NULL DEFAULT (datetime('now','utc')),
  resolved_at        TEXT,
  resolution_notes   TEXT
);

-- Unique constraint: one active handoff per task
CREATE UNIQUE INDEX IF NOT EXISTS idx_handoffs_task_active
ON handoffs(task_id)
WHERE status IN ('proposed','validating','accepted','activated');
```

### 3.2 Handoff Package Structure

The full `ACPHandoffPackage` is persisted as JSON in `package_json`. Key fields:

```typescript
interface ACPHandoffPackage {
  handoff_id: string;          // UUIDv7
  thread_id: string;
  
  task: {
    task_id: string;
    title: string;
    objective: string;
    success_criteria: string[];
    deadline?: string;
    priority: ACPPriority;
    external_refs?: ACPExternalRef[];
  };
  
  context: {
    summary: string;
    constraints?: string[];
    assumptions?: string[];
    open_questions?: string[];
    known_risks?: string[];
  };
  
  work_state: {
    status: "not_started" | "in_progress" | "blocked" | "review";
    percent_complete?: number;
    completed_steps?: string[];
    next_step: string;
    branch?: string;
    worktree_path?: string;
    test_status?: "passing" | "failing" | "untested";
  };
  
  artifacts: Array<{
    artifact_id: string;
    ref: ACPArtifactRef;
  }>;
  
  provenance: {
    origin_session: string;
    related_sessions?: string[];
    decision_refs?: string[];
    message_thread_refs?: string[];
    handoff_chain?: string[];  // Cycle prevention
  };
  
  policy: {
    classification: "internal" | "restricted";
    requires_human_approval: boolean;
    export_restrictions?: string[];
  };
  
  verification: {
    schema_version: "1.0.0";
    package_hash: string;     // sha256
  };
}
```

---

## 4. Verification & Provenance

### 4.1 Verification Gate (on `accept`)

Before transitioning from `validating` → `accepted`, the implementation MUST verify:

1. **Schema validation** — Package conforms to `ACPHandoffPackage` JSON Schema
2. **Policy compliance** — `visibility`, `sensitivity`, `human_gate` are valid and permissible
3. **Artifact integrity** — If artifacts present, verify:
   - File exists at referenced path
   - SHA256 matches (if `sha256` specified in ref)
   - Required artifacts are present
4. **Cycle detection** — Check `provenance.handoff_chain` for `to_agent` inclusion

### 4.2 Provenance Tracking

| Field | Purpose | Enforcement |
|-------|---------|-------------|
| `origin_session` | Original creator session | Auto-populated from runtime |
| `related_sessions` | Context sessions | Optional, user-provided |
| `decision_refs` | Decisions informing handoff | Optional |
| `message_thread_refs` | ACP thread history | Auto-linked from thread_id |
| `handoff_chain` | Owner lineage | Auto-extended on each handoff |

**Cycle Prevention Algorithm:**
```typescript
function detectCycle(pkg: ACPHandoffPackage, toAgent: string): boolean {
  const chain = pkg.provenance.handoff_chain || [];
  return chain.includes(toAgent);
}
```

---

## 5. Rejection Contracts

### 5.1 Rejection Reason Codes

All rejections MUST include a reason code and detail:

```typescript
type HandoffRejectReason =
  | "missing_artifact"      // Required artifact not found
  | "hash_mismatch"         // Artifact SHA256 mismatch
  | "schema_invalid"        // Package fails schema validation
  | "policy_violation"      // Policy constraints not met
  | "capacity_unavailable"  // Recipient at capacity
  | "capability_mismatch"   // Recipient lacks required capability
  | "success_criteria_ambiguous" // Criteria not measurable
  | "ownership_conflict"    // Task already has active handoff
  | "timeout_risk"          // Deadline unrealistic
  | "other";               // Catch-all with detail required
```

### 5.2 Rejection Payload

```typescript
interface HandoffRejectPayload {
  handoff_id: string;
  reason: HandoffRejectReason;
  detail: string;           // Human-readable explanation
  suggested_fix?: string;   // Optional guidance
}
```

### 5.3 Rejection Flow

1. Recipient calls `acp_handoff` with `action: "reject"`
2. System validates caller is `to_agent` of the handoff
3. Record `resolution_notes` with reason + detail
4. Transition to `rejected` state
5. Emit audit event
6. Optionally notify sender via `system.error` message

---

## 6. Uniqueness Constraints

### 6.1 Task-Level Uniqueness

**Constraint:** Only one active handoff per `task_id` at any time.

**Implementation:**
- SQLite UNIQUE INDEX on `task_id` WHERE `status IN ('proposed','validating','accepted','activated')`
- Attempt to create second active handoff → `ownership_conflict` rejection

**Race Condition Handling:**
- Use `INSERT OR FAIL` with explicit transaction
- Return `ownership_conflict` if PK constraint violation

### 6.2 Cycle Prevention

**Constraint:** No agent can receive a handoff for a task they've already owned in the chain.

**Implementation:**
- Before accepting, check `handoff_chain.includes(to_agent)`
- If found → `ownership_conflict` with detail showing chain

---

## 7. Timeout & Escalation

### 7.1 SLA Configuration

| Stage | Default SLA | Configurable |
|-------|-------------|--------------|
| `proposed` → `validating` | 5 min | Yes |
| `validating` → `accepted/rejected` | 10 min | Yes |
| `accepted` → `activated` | 15 min | Yes |
| `activated` → `completed` | 24 hours | Yes (per-handoff deadline override) |

### 7.2 Timeout Escalation

When SLA exceeded:

1. **Record escalation** in `resolution_notes`:
   ```json
   {
     "escalation": {
       "trigger": "timeout",
       "stage": "accepted→activated",
       "sla_configured": "24h",
       "sla_elapsed": "26h",
       "escalated_to": "coordinator",
       "escalated_at": "2026-02-21T14:00:00Z"
     }
   }
   ```

2. **Notify coordinator** — Send `status.blocked` message to coordinator role
3. **Log audit event** — Append to JSONL handoff log
4. **Do NOT auto-transition** — Keep in current state for manual review

### 7.3 Escalation Notification

```typescript
interface EscalationNotification {
  type: "status.blocked";
  handoff_id: string;
  task_id: string;
  blocking_issue: "timeout";
  escalation_level: "coordinator";
  recommended_action: "reassign" | "extend_sla" | "close";
}
```

---

## 8. Workq Integration Points

### 8.1 External References Pattern

Handoffs reference workq items via `external_refs` (not hard-coupled):

```typescript
// In task.external_refs
{
  type: "workq_item",
  value: "workq:task-123",
  description: "Related workq item for tracking",
  version: "1.0.0"
}
```

### 8.2 Workq Ownership Transfer

| Scenario | Behavior |
|----------|----------|
| Extension-to-extension available | Auto-transfer via `workq.claim` RPC |
| Extension unavailable | Best-effort: mark handoff `activated`, set workq status to `orphaned` for manual claim |
| Workq item doesn't exist | Continue without — handoff is not coupled to workq existence |

### 8.3 Integration API Points

```typescript
// ACP → workq interface (best-effort)
interface WorkqIntegration {
  // Attempt transfer, return success/failure
  transferOwnership(itemId: string, fromAgent: string, toAgent: string): Promise<TransferResult>;
  
  // Check if workq item exists
  itemExists(itemId: string): Promise<boolean>;
  
  // Get item status
  getItemStatus(itemId: string): Promise<WorkqItemStatus>;
}
```

### 8.4 Fallback Behavior

If workq integration fails:
1. Log degradation event
2. Continue with handoff (ACP owns the protocol, workq is optional)
3. Mark handoff with `workq_integration: "degraded"` in context
4. Return clear status in tool response so caller knows state

---

## 9. Tool Interface

### 9.1 `acp_handoff` Tool

```typescript
type ACPHandoffAction = 
  | "initiate"    // Create new handoff (draft → proposed)
  | "accept"      // Approve handoff (validating → accepted)
  | "reject"      // Decline handoff (any → rejected)
  | "activate"    // Start work (accepted → activated)
  | "complete"    // Finish work (activated → completed)
  | "close"       // Finalize (any terminal → closed)
  | "query";      // Lookup handoffs
```

### 9.2 Action Parameters

| Action | Required Fields | Optional Fields |
|--------|-----------------|-----------------|
| `initiate` | `to_agent`, `task`, `context`, `work_state` | `artifacts`, `policy`, `deadline` |
| `accept` | `handoff_id` | `notes` |
| `reject` | `handoff_id`, `reason`, `detail` | `suggested_fix` |
| `activate` | `handoff_id` | `work_state_update` |
| `complete` | `handoff_id` | `completion_notes`, `final_artifacts` |
| `close` | `handoff_id` | `closure_notes` |
| `query` | — | `task_id`, `from_agent`, `to_agent`, `status`, `limit` |

### 9.3 Response Format

```typescript
interface ACPHandoffResponse {
  success: boolean;
  handoff_id?: string;
  status?: string;
  error?: {
    code: string;
    detail: string;
  };
  metadata?: {
    verification_passed?: string[];
    verification_failed?: string[];
    workq_status?: "transferred" | "degraded" | "not_applicable";
    escalation_triggered?: boolean;
  };
}
```

---

## 10. Audit & Logging

### 10.1 JSONL Export

Handoff events appended to: `teamspaces/<teamspace_id>/handoffs/handoffs.jsonl`

```json
{"event":"handoff_transition","handoff_id":"...","from_status":"proposed","to_status":"validating","actor":"agent:tim","timestamp":"2026-02-21T14:00:00Z"}
{"event":"handoff_rejected","handoff_id":"...","reason":"missing_artifact","detail":"...","actor":"agent:barry","timestamp":"..."}
{"event":"handoff_escalation","handoff_id":"...","trigger":"timeout","escalated_to":"coordinator","timestamp":"..."}
```

### 10.2 Audit Event Types

| Event | When Emitted | Fields |
|-------|--------------|--------|
| `handoff_created` | Initiate | handoff_id, task_id, from, to |
| `handoff_transition` | Any state change | handoff_id, from_status, to_status, actor |
| `jected` | Rehandoff_reject action | handoff_id, reason, detail, actor |
| `handoff_verification` | Accept/Reject | handoff_id, passed[], failed[] |
| `handoff_escalation` | Timeout detected | handoff_id, stage, sla_configured, escalated_to |
| `handoff_completed` | Complete action | handoff_id, actor, completion_notes |
| `handoff_closed` | Close action | handoff_id, actor, closure_notes |

---

## 11. Implementation Phases

### Phase 1: Core (Week 1-2)
- [ ] SQLite schema + migrations
- [ ] State machine implementation
- [ ] `acp_handoff` tool with CRUD operations
- [ ] JSON Schema validation for package
- [ ] Basic rejection handling

### Phase 2: Verification & Constraints (Week 2-3)
- [ ] Artifact verification (existence + hash)
- [ ] Policy validation
- [ ] Cycle detection
- [ ] Uniqueness constraint enforcement
- [ ] JSONL audit logging

### Phase 3: Timeout & Integration (Week 3-4)
- [ ] SLA tracking + timeout detection
- [ ] Escalation to coordinator
- [ ] Workq integration points (best-effort)
- [ ] Integration tests

### Phase 4: Observability (Week 4-5)
- [ ] CLI commands for handoff inspection
- [ ] Status queries and filtering
- [ ] Error diagnostics
- [ ] Documentation + examples

---

## 12. Open Questions / deferred to P2

1. **Negotiation on rejection** — Can sender counter-offer after rejection? (P2)
2. **Partial acceptance** — Accept only subset of artifacts? (P2)
3. **Handoff delegation** — Can accepted handoff be re-delegated? (P2)
4. **Teamspace scoping** — How does handoff interact with team roles? (P2)
5. **Human-in-loop approval** — How is `human_gate` enforced pre-handoff? (P2)

---

## 13. Dependencies

- **Canonical spec:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md`
- **JSON Schemas:** To be generated from spec (P0 deliverable)
- **ACP base tools:** `acp_send`, `acp_query`, `acp_inbox` (prerequisite)
- **Workq interface:** Coordination with P2 workq team for integration contract

---

**End of Design**
