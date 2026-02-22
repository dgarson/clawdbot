# ACP Workstream Task Breakdown

**File:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-task-breakdown.md`  
**Date:** 2026-02-21  
**Based on:** Xavier recommended phasing (P0–P3)

## Team Roster for Assignment
Roman, Claire, Sandy, Tony, Barry, Jerry, Harry, Larry, nate, oscar, piper, quinn, reed, sam, vince, wes

Effort is estimated in **engineering days** (ideal days, excluding review latency).

---

## Phase 0 (Week 1): Schema Freeze + Verification Spikes

### Objectives
- Freeze canonical ACP schemas and change control
- De-risk core assumptions via spikes
- Produce go/no-go inputs for P1 build

| ID | Task | Description | Acceptance Criteria | Effort | Suggested Assignee | Dependencies |
|---|---|---|---|---:|---|---|
| P0-01 | Canonical schema freeze package | Convert canonical spec into frozen schema set (envelope, handoff package, teamspace manifest) with ADR note and change-control process. | Freeze doc signed by CTO + owner; change request template created; semver baseline = 1.0.0. | 1.5d | Barry | None |
| P0-02 | JSON Schema authoring | Implement JSON Schema files for `ACPMessageEnvelope`, `ACPHandoffPackage`, `ACPTeamspaceManifest`. | Schemas committed under `_shared/specs/schemas/acp/`; all examples validate. | 2.0d | Claire | P0-01 |
| P0-03 | Validation harness + golden tests | Build test harness to validate valid/invalid fixtures and enforce 4KB payload cap. | CI job green; >=20 fixtures; payload limit test enforced. | 2.0d | Jerry | P0-02 |
| P0-04 | Spike: session injection feasibility | Verify extension can inject system messages into active sessions and document API constraints. | Written spike report with pass/fail, latency sample, fallback if fail. | 1.5d | Roman | None |
| P0-05 | Spike: heartbeat/wake trigger | Validate extension-triggered heartbeat/wake mechanism for urgent ACP delivery. | Report includes mechanism, rate guardrails, failure mode behavior. | 1.5d | Tony | None |
| P0-06 | Spike: cross-extension integration | Verify ACP↔workq integration path using Gateway RPC methods (`workq.claim/release`), since direct plugin-tool invocation is unsupported. | Report includes invocation pattern, explicit auth/session context requirements, and error handling strategy. | 1.5d | Sandy | None |
| P0-07 | Storage path convergence | Validate migration strategy from `_teams/` to `_shared/teamspaces/`; identify backward-compat needs. | Path decision note + migration script sketch + risk list. | 1.0d | Harry | None |
| P0-08 | Security baseline requirements | Draft P1 security requirements: identity derivation, anti-spoofing, validation points, ACL checks. | Security checklist adopted into P1 definition-of-done. | 1.5d | Larry | P0-01 |
| P0-09 | P0 gate review | Consolidate all spike outcomes and decide P1 go/no-go with explicit feature flags. | Decision memo with enabled/disabled channels and contingencies. | 1.0d | Barry | P0-03, P0-04, P0-05, P0-06, P0-08 |

---

## Phase 1 (Weeks 2–6): Core Messaging + Handoffs (6 Tools)

### Objectives
Ship durable ACP core with inbox + query + handoff capability and operational safety controls.

| ID | Task | Description | Acceptance Criteria | Effort | Suggested Assignee | Dependencies |
|---|---|---|---|---:|---|---|
| P1-01 | ACP extension skeleton | Create extension scaffold, manifest, config loading, and boot lifecycle (workq pattern). | Extension loads/unloads cleanly; config schema validated on startup. | 2.0d | Roman | P0-09 |
| P1-02 | SQLite schema + migrations | Implement canonical DB schema and migration runner (messages, delivery_log, handoffs, meta). | Fresh + upgrade migrations pass; indexes present; rollback tested. | 2.5d | Claire | P0-09 |
| P1-03 | Message validation layer | Build pre-persistence validators from frozen JSON Schemas and runtime guards. | Invalid payloads rejected with typed errors; unit test coverage >=90% of validators. | 2.0d | Jerry | P0-03, P1-01 |
| P1-04 | Delivery router core | Implement routing pipeline (session/inbox/channel/wake behind feature flags). | Router delivers to enabled channels; retries + error recording in `delivery_log`. | 3.0d | Tony | P0-04, P0-05, P1-01, P1-02 |
| P1-05 | `acp_send` tool | Implement typed send with identity derivation, policy enforcement, and rate limits. | Tool supports direct + broadcast; spoof attempts rejected; metrics emitted. | 2.5d | Sandy | P1-02, P1-03, P1-04 |
| P1-06 | `acp_respond` tool | Thread-safe response API preserving `reply_to` and thread context. | Replies auto-link to parent; sequence/thread integrity tests pass. | 1.5d | Harry | P1-05 |
| P1-07 | `acp_query` tool | Query API for message history by sender/recipient/type/status/topic/time. | Query latency <150ms p95 on seeded test dataset (50k msgs). | 2.0d | Larry | P1-02 |
| P1-08 | `acp_inbox` tool + renderer | Build pending inbox retrieval and markdown render for recipient workspace view. | Inbox shows unread ordered list; idempotent re-render; no duplicate processing. | 2.0d | nate | P1-02, P1-04 |
| P1-09 | `acp_handoff` tool | Implement initiate/accept/reject/complete flows with validation and audit trail. | Full happy-path + rejection-path E2E tests pass; required fields enforced. | 3.0d | Barry | P1-02, P1-03, P1-05 |
| P1-10 | workq handoff integration | Integrate atomic ownership transfer in handoff acceptance via Gateway RPC (`workq.release` + `workq.claim`) with explicit context propagation. | Atomic transfer test passes; structured RPC error mapping implemented; rollback on failure validated. | 2.5d | oscar | P0-06, P1-09 |
| P1-11 | `acp_status` tool | Convenience API for `status.update|blocked|complete` messages. | Emits canonical payload format; discoverable via tool docs/help. | 1.0d | piper | P1-05 |
| P1-12 | Rate limits + circuit breakers | Implement policy-configured throttles (direct vs broadcast), loop detection, suspension. | Limits enforce spec defaults; loop tests pass; admin override exists. | 2.0d | quinn | P1-05 |
| P1-13 | CLI commands (`log`, `inbox`) | Implement initial CLI observability commands and JSON output mode. | Commands return accurate filtered results; CLI docs included. | 1.5d | reed | P1-07, P1-08 |
| P1-14 | JSONL audit exporter | Stream/flush message + handoff records to append-only JSONL journals. | Export deterministic; replay script reconstructs timeline accurately. | 2.0d | sam | P1-02, P1-09 |
| P1-15 | E2E + chaos test pack | Build integration suite for duplicates, delivery failure, DB-unavailable degradation. | Suite green; degradation behavior documented and verified. | 2.5d | vince | P1-04, P1-05, P1-09, P1-12 |
| P1-16 | Release hardening + runbook | Operational runbook, rollout flags, rollback plan, and known-issues catalog. | Runbook approved by CTO; dry-run rollout completed in staging. | 1.5d | wes | P1-13, P1-15 |

---

## Phase 2 (Weeks 7–11): Negotiation + Basic Teamspaces

### Objectives
Add structured negotiation and practical teamspace coordination primitives.

| ID | Task | Description | Acceptance Criteria | Effort | Suggested Assignee | Dependencies |
|---|---|---|---|---:|---|---|
| P2-01 | Negotiation state machine | Implement `task.offer/accept/decline/counter` + bounded round logic + sequence enforcement. | State transition tests pass; max-round escalation works. | 3.0d | Barry | P1 complete |
| P2-02 | Teamspace CRUD core | Implement teamspace create/read/update lifecycle with canonical storage path. | Teamspace lifecycle commands pass; data persisted in SQLite + JSONL. | 3.0d | Claire | P1 complete |
| P2-03 | Role ledger + policy config | Implement role assignments, role rotation events, and authority matrix config enforcement. | Unauthorized actions blocked; role ledger append-only and queryable. | 2.5d | Larry | P2-02 |
| P2-04 | Team workspace initializer | Auto-create markdown + directory scaffolding under `_shared/teamspaces/<id>/`. | Expected files generated; regeneration is idempotent. | 1.5d | Roman | P2-02 |
| P2-05 | Artifact registry v1 | Add artifact registration, version counters, parent lineage hash fields (no advanced conflict resolver yet). | Writes require parent version; registry query tool returns lineage chain. | 3.0d | Harry | P2-02 |
| P2-06 | workq/team ownership coupling | Map team-level ownership transitions to workq integration hooks. | Ownership changes reflect in workq reliably; failure rollback documented. | 2.0d | oscar | P2-01, P2-02 |
| P2-07 | Team/negotiation CLI | Add `openclaw acp teams` + `openclaw acp negotiations` commands. | Commands support filtering + JSON output; docs and examples added. | 1.5d | piper | P2-01, P2-02 |
| P2-08 | Teamspace E2E workflows | Validate research→draft→review and parallel merge workflows with teamspace primitives. | Two blueprint scenarios run end-to-end with auditable logs. | 2.0d | quinn | P2-03, P2-05 |

---

## Phase 3 (Weeks 12–18): Hardening + Conflict Resolution + Disagreement

### Objectives
Increase protocol robustness under contention and ambiguity.

| ID | Task | Description | Acceptance Criteria | Effort | Suggested Assignee | Dependencies |
|---|---|---|---|---:|---|---|
| P3-01 | Artifact conflict detector | Implement divergence detection and conflict state transitions. | Conflicts detected deterministically under concurrent-write tests. | 2.5d | Tony | P2-05 |
| P3-02 | Conflict resolution flows | Implement auto-merge (safe cases), manual-merge queue, escalation hooks. | Resolution state machine tests pass; escalations auditable. | 3.0d | Sandy | P3-01 |
| P3-03 | Disagreement protocol | Implement `position.*` message family and bounded resolution/escalation logic. | Protocol round limits enforced; escalation event emitted correctly. | 2.5d | Jerry | P2-01 |
| P3-04 | Wake/channel hardening | Production hardening of urgent channel notifications and wake triggers. | p95 urgent delivery SLA met in load test; backoff/failover verified. | 2.0d | wes | P0-05, P1-04 |
| P3-05 | Security hardening pass | ACL expansion, audit tamper checks, abuse protections, broadcast guard refinements. | Security checklist fully green; red-team test report closed. | 2.5d | Larry | P3-02, P3-03 |
| P3-06 | Retention + archival GC | Implement 90-day message archive path and compaction policies. | Archival job tested; restore/replay from archive succeeds. | 1.5d | sam | P1-14 |
| P3-07 | Operational metrics & SLOs | Implement ACP metrics package (delivery, handoff quality, conflict rates, latency). | Dashboard-ready metric outputs + SLO alerts defined. | 2.0d | vince | P3-04, P3-05 |
| P3-08 | Final reliability certification | End-to-end soak tests, failover drills, and launch readiness review. | 72-hour soak passes; launch recommendation documented. | 2.0d | reed | P3-01..P3-07 |

---

## Critical Path Summary

1. **P0 spikes + schema freeze** (`P0-01..P0-09`) gate all build work.
2. **P1 core dependency chain:** `P1-01/02/03 -> P1-04 -> P1-05/09 -> P1-15 -> P1-16`.
3. **P2 depends on full P1 stability.**
4. **P3 depends on P2 artifact + negotiation maturity.**

---

## Timeline (Recommended)

- **Week 1:** P0 complete + go/no-go
- **Weeks 2–6:** P1 implementation + rollout prep
- **Weeks 7–11:** P2 implementation
- **Weeks 12–18:** P3 hardening and readiness

Total: **~18 weeks** including hardening and launch confidence work.

---

## Initial Immediate Assignments (Kickoff)

- Roman: `P0-04` (session injection spike)
- Tony: `P0-05` (heartbeat/wake spike)
- Sandy: `P0-06` (extension-to-extension call spike)
- Barry + Claire: `P0-01`, `P0-02` (schema freeze + schema files)
- P1 pre-assigned leads (to start design prep in parallel):
  - Roman `P1-01`
  - Claire `P1-02`
  - Sandy `P1-05`
  - Barry `P1-09`

