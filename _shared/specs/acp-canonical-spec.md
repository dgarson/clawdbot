# ACP Canonical Specification (Consolidated)

**File:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md`  
**Date:** 2026-02-21  
**Owner:** Tim (final consolidation owner per David directive)  
**Source Inputs:**  
- `/Users/openclaw/.openclaw/workspace/amadeus/agent-communication-protocol-spec-2026-02-21.md`  
- `/Users/openclaw/.openclaw/workspace/tim/agent-handoff-teamspace-spec-2026-02-21.md`  
- `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-review-xavier-2026-02-21.md`  
**Status:** Canonical draft for schema freeze (P0)

---

## 1) Purpose and Scope

This document is the **single canonical ACP spec** for engineering execution.

It merges:
- Amadeus’s implementation-ready TypeScript + SQLite architecture (base)
- Tim’s protocol rigor on policy, verification, provenance, rejection codes, and role authority
- Xavier’s mandatory consolidation conditions and de-scoping decisions

This spec is normative for **P0–P1 build** and defines what is deferred to P2+.

---

## 2) Locked Architecture Decisions (Normative)

1. **Protocol family:** Single protocol family `acp` with semver (`1.0.0`) and namespaced message types (`handoff.*`, `status.*`, etc.).
2. **Persistence:** SQLite is primary operational store. JSONL is required audit/export format.
3. **Teamspace storage root:** `/Users/openclaw/.openclaw/workspace/_shared/teamspaces/<teamspace_id>/`.
4. **Identity:** Sender identity (`from`) is derived from calling session context, never accepted from user input.
5. **Envelope `to`:** Always `string[]` (no union type).
6. **Envelope `status`:** Required top-level field for lifecycle queries.
7. **workq coupling:** No hard-coupled `work_item` on base envelope; use generic `external_refs`.
8. **Policy block:** Required on envelope (`visibility`, `sensitivity`, `human_gate`).
9. **Payload size cap:** Inline payload max 4KB; larger content must use artifact refs.
10. **Validation boundary:** Tool handlers validate before persistence.
11. **P1 toolset:** `acp_send`, `acp_respond`, `acp_query`, `acp_inbox`, `acp_handoff`, `acp_status`.
12. **Handoff in P1:** Included (not deferred).

---

## 3) Protocol Versioning

- `protocol`: `"acp"`
- `version`: semver string, initial `"1.0.0"`
- Backward-compatible additions increment minor (`1.1.0`)
- Breaking changes increment major (`2.0.0`)

Consumers must reject unsupported major versions.

---

## 4) Canonical ACP Message Envelope

```typescript
export type ACPPriority = "low" | "normal" | "high" | "critical";

export type ACPMessageStatus =
  | "pending"
  | "delivered"
  | "read"
  | "expired"
  | "failed";

export interface ACPPolicy {
  visibility: "private" | "team" | "human-audit";
  sensitivity: "low" | "moderate" | "high";
  human_gate: "none" | "required";
}

export interface ACPExternalRef {
  type: "workq_item" | "file" | "branch" | "pr" | "url" | "session" | "ticket" | "other";
  value: string;              // identifier, absolute path, URL, etc.
  description?: string;
  version?: string;           // git sha, semantic version, timestamp, etc.
}

export interface ACPMessageEnvelope {
  // Identity
  id: string;                 // UUIDv7
  protocol: "acp";
  version: "1.0.0";         // semver

  // Routing
  from: string;               // derived from session context
  to: string[];               // one-or-many recipients; ["*"] permitted for broadcast
  team?: string;              // optional teamspace scope
  thread_id?: string;
  reply_to?: string;

  // Classification
  type: ACPMessageType;
  topic?: string;
  priority: ACPPriority;
  status: ACPMessageStatus;

  // Operational controls
  sequence?: number;          // required for negotiation messages; optional otherwise
  expires_at?: string;        // ISO8601 UTC

  // Payload + policy
  payload: ACPPayload;
  policy: ACPPolicy;

  // Context
  context?: {
    session_id?: string;      // populated by runtime/persistence
    external_refs?: ACPExternalRef[];
    artifacts?: ACPArtifactRef[];
  };

  // Timestamps
  created_at: string;         // ISO8601 UTC
  updated_at?: string;        // ISO8601 UTC
}
```

### 4.1 Envelope Constraints

- `to` must be non-empty.
- `to: ["*"]` is broadcast and subject to stricter limits.
- `payload` serialized size must be `<= 4096` bytes.
- `from` in request payloads is ignored/rejected; runtime injects true sender.
- `status` transitions allowed:
  - `pending -> delivered -> read`
  - `pending -> failed`
  - `pending|delivered -> expired`

---

## 5) Message Type Catalog

### 5.1 P1 Supported Types (ship now)

```typescript
type ACPMessageType =
  // Handoff (P1)
  | "handoff.initiate"
  | "handoff.accept"
  | "handoff.reject"
  | "handoff.complete"

  // Status (P1)
  | "status.update"
  | "status.blocked"
  | "status.complete"

  // Knowledge (P1)
  | "knowledge.push"
  | "knowledge.query"
  | "knowledge.response"

  // System (P1)
  | "system.ack"
  | "system.error"

  // Reserved for P2+
  | "task.offer"
  | "task.accept"
  | "task.decline"
  | "task.counter"
  | "position.state"
  | "position.challenge"
  | "position.concede"
  | "position.escalate"
  | "team.join"
  | "team.leave"
  | "team.role_change"
  | "team.artifact_update";
```

### 5.2 P2+ Notes

- Negotiation (`task.*`) and disagreement (`position.*`) are deferred.
- Team lifecycle events (`team.*`) activate with teamspace tooling in P2.

---

## 6) Artifact References (No Custom URI Scheme)

```typescript
export interface ACPArtifactRef {
  type: "file" | "branch" | "pr" | "url" | "session" | "workq_item";
  path: string;               // absolute path, URL, or durable identifier
  sha256?: string;
  description?: string;
  version?: string;
  size_bytes?: number;
  required?: boolean;
}
```

- `teamspace://...` URIs are out of scope for v1.
- Use absolute filesystem paths for local artifacts.

---

## 7) Handoff Protocol (THP in ACP)

### 7.1 Canonical Handoff Package

```typescript
export interface ACPHandoffPackage {
  protocol: "acp";
  version: "1.0.0";
  handoff_id: string;         // UUIDv7
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
    percent_complete?: number;  // 0..100
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
    handoff_chain?: string[];  // ordered owner chain for cycle prevention
  };

  policy: {
    classification: "internal" | "restricted";
    requires_human_approval: boolean;
    export_restrictions?: string[];
  };

  verification: {
    schema_version: "1.0.0";
    package_hash: string;     // sha256 of canonicalized package
  };
}
```

### 7.2 Handoff State Machine (P1)

`draft -> proposed -> validating -> accepted|rejected -> activated -> completed -> closed`

Rules:
1. No silent handoffs.
2. Mandatory context (`summary`, `next_step`, at least one success criterion).
3. Single active ownership per task scope.
4. `accepted` requires schema + policy + artifact verification checks.
5. **Timeout enforcement:** if `accepted` but not `completed` within configured SLA (default `24h`), ACP auto-escalates to coordinator and records escalation in audit log.
6. **Cycle prevention:** ACP MUST reject handoffs where `to_agent` already appears in `provenance.handoff_chain`.
7. Handoff state transitions are append-only in audit history (no in-place history rewrite).

### 7.3 Handoff Rejection Reason Codes

```typescript
export type HandoffRejectReason =
  | "missing_artifact"
  | "hash_mismatch"
  | "schema_invalid"
  | "policy_violation"
  | "capacity_unavailable"
  | "capability_mismatch"
  | "success_criteria_ambiguous"
  | "ownership_conflict"
  | "timeout_risk"
  | "other";
```

All `handoff.reject` payloads must include `reason` + `detail`.

---

## 8) Teamspaces (P2 Basic, P3 Hardening)

### 8.1 Canonical Root Path

`/Users/openclaw/.openclaw/workspace/_shared/teamspaces/<teamspace_id>/`

### 8.2 Persistence Model

- SQLite tables for live queries and operational control.
- JSONL append-only logs for audit/export:
  - `messages/messages.jsonl`
  - `handoffs/handoffs.jsonl`
  - `roles/ledger.jsonl`
  - `decisions/decisions.jsonl`
  - `artifacts/registry.jsonl`

### 8.3 Canonical Roles

```typescript
export type TeamRole =
  | "coordinator"
  | "researcher"
  | "executor"
  | "reviewer"
  | "integrator";
```

### 8.4 Role Authority Matrix (Policy-Configured)

| Action | coordinator | researcher | executor | reviewer | integrator |
|---|---:|---:|---:|---:|---:|
| Create task | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign/reassign owner | ✅ | ❌ | ❌ | ❌ | ✅ (merge tasks only) |
| Approve handoff into team scope | ✅ | ❌ | ❌ | ✅ (guarded classes) | ✅ |
| Accept execution task | ❌ | ❌ | ✅ | ❌ | ✅ |
| Mark high-risk closure complete | ✅ | ❌ | ❌ | ✅ | ✅ |
| Block work with reason code | ✅ | ❌ | ❌ | ✅ | ✅ |
| Add/remove team members | ✅ | ❌ | ❌ | ❌ | ❌ |
| Close/archive teamspace | ✅ | ❌ | ❌ | ❌ | ❌ |

Enforcement requirement:
- In P1, even before full teamspaces ship, `coordinator`-only checks must gate member add/remove and team close operations where available.

---

## 9) SQLite Schema (Canonical P1 Baseline)

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS messages (
  id                TEXT PRIMARY KEY,
  protocol          TEXT NOT NULL DEFAULT 'acp',
  version           TEXT NOT NULL DEFAULT '1.0.0',
  from_agent        TEXT NOT NULL,
  to_agents_json    TEXT NOT NULL,           -- normalized recipient array
  team              TEXT,
  reply_to          TEXT,
  thread_id         TEXT,
  type              TEXT NOT NULL,
  topic             TEXT,
  priority          TEXT NOT NULL DEFAULT 'normal',
  status            TEXT NOT NULL DEFAULT 'pending',
  payload_json      TEXT NOT NULL,
  policy_json       TEXT NOT NULL,
  context_json      TEXT,
  external_refs_json TEXT,
  sequence          INTEGER,
  expires_at        TEXT,
  payload_bytes     INTEGER NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now','utc')),
  updated_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status, created_at DESC);

CREATE TABLE IF NOT EXISTS delivery_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id    TEXT NOT NULL,
  recipient     TEXT NOT NULL,
  channel       TEXT NOT NULL,               -- session|inbox|channel|wake
  status        TEXT NOT NULL DEFAULT 'pending',
  delivered_at  TEXT,
  read_at       TEXT,
  error         TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

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

-- Prevent multiple active handoffs on the same task
CREATE UNIQUE INDEX IF NOT EXISTS idx_handoffs_task_active
ON handoffs(task_id)
WHERE status IN ('proposed','validating','accepted','activated');

CREATE TABLE IF NOT EXISTS acp_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO acp_meta (key, value) VALUES ('schema_version', '1');
INSERT OR IGNORE INTO acp_meta (key, value) VALUES ('protocol_version', '1.0.0');
```

### 9.1 JSONL Export Requirement

Operational state remains in SQLite. Export to JSONL for human/audit workflows is mandatory (batch or stream).

---

## 10) Delivery Model and Priority Routing

Delivery channels:
1. Session injection (active recipients)
2. Inbox file rendering
3. Channel notify (urgent/high sensitivity policy routes)
4. Wake trigger (urgent only)

### 10.1 Verification-gated channels (P0 critical)

The following capabilities are **not assumed** and must be verified in P0 before enabling in production:
1. Session injection from ACP extension into active agent sessions
2. Extension-triggered heartbeat/wake for urgent delivery
3. Cross-extension integration for workq ownership transfer (via Gateway RPC methods, not direct tool invocation)

Current spike evidence indicates session injection may append transcript entries without triggering agent processing; ACP delivery design therefore treats wake/poll as a separate requirement.

Until verified, these channels/integrations remain behind feature flags.

### 10.2 Priority defaults

- `low`: inbox only
- `normal`: inbox + session inject if available
- `high`: session + inbox + optional channel
- `critical`: all channels + wake + human audit visibility

### 10.3 Broadcast rate-limit asymmetry (normative)

Broadcasts impose organization-wide token/cognitive cost and must be stricter than direct sends.

Required default controls:
- Direct send: up to **10/minute** per sender
- Broadcast (`to:["*"]`): up to **5/hour** per sender
- Broadcast requires either:
  - sender has coordinator authority, **or**
  - message priority is `high`/`critical`

Implementations may tighten these limits per deployment.

### 10.4 Fallback behavior if spikes fail

- ACP remains operational using SQLite + inbox delivery.
- Session injection and wake channels are disabled via feature flags.
- workq ownership transfer in handoff uses Gateway RPC (`workq.claim`, `workq.release`) with explicit context parameters (`agent_id`, `session_key`).
- If Gateway RPC path is unavailable, ACP degrades to best-effort/manual ownership transfer with explicit operator-visible status.
- Tool responses must return explicit capability-state messages so callers can degrade gracefully.

---

## 11) Tool Surface (P1)

1. `acp_send` — send typed ACP message
2. `acp_respond` — response helper preserving thread/reply integrity
3. `acp_query` — query by agent/thread/type/status/topic/time
4. `acp_inbox` — recipient pending/active inbox fetch + render
5. `acp_handoff` — initiate/accept/reject/complete handoffs
6. `acp_status` — convenience wrapper for status.* messages

Deferred tools (P2+): `acp_team`, `acp_subscribe`, explicit `acp_broadcast` wrapper.

---

## 12) Security, Safety, and Reliability Requirements

### 12.1 Identity anti-spoofing (mandatory)

- ACP tool handlers MUST derive `from_agent` from authenticated calling session context.
- User-supplied `from` values are rejected (or ignored with explicit warning + audit event).
- No ACP write path may persist a sender identity not bound to runtime session identity.

### 12.2 Validation boundary (mandatory)

- All ACP tool handlers MUST validate incoming payloads against canonical JSON Schema **before any database write**.
- Validation failures:
  - return typed error codes (`schema_invalid`, `policy_violation`, etc.)
  - are logged for diagnostics/audit
  - MUST NOT create/modify ACP message or handoff records

### 12.3 Payload and policy enforcement

- Payload cap: `payload_bytes <= 4096`.
- Oversized payloads must be rejected with instruction to use `artifacts` references.
- Policy checks (`visibility`, `sensitivity`, `human_gate`) run pre-persistence.

### 12.4 Broadcast and abuse controls

- Broadcast asymmetry rules from §10.3 are mandatory defaults.
- Rate limiting and circuit breakers are required from first release.
- Loop guards must enforce bounded hop/round behavior by thread.

### 12.5 Idempotency and ordering

- Recipients/handlers must maintain a processed-message registry keyed by `message_id`.
- Duplicate delivery (e.g., session + inbox) must be treated as no-op after first successful process.
- Negotiation messages require monotonic `sequence` within thread; out-of-order sequence is rejected or quarantined.

### 12.6 Graceful degradation

- ACP failures must not block normal agent operation.
- If SQLite is unavailable, ACP tools return clear degraded-mode errors and preserve caller stability.
- If session/wake channels unavailable, ACP falls back to inbox rendering and logs channel degradation status.

### 12.7 Retention and archival

- Active `messages` retention: 90 days.
- Messages older than 90 days must be exported to JSONL/archive table then purged from active table.
- Handoff and decision history retained indefinitely.

### 12.8 Auditability

- High/critical priority and `human_gate=required` operations must emit durable audit events.
- Audit records are append-only and include actor, action, timestamp, and outcome.

---

## 13) Out of Scope / Explicit Cuts (for now)

Removed from canonical v1 scope:
- Custom URI scheme (`teamspace://...`)
- Signing infrastructure fields (`signed_by`)
- ML-based routing and capability ranking
- Knowledge deduplication by semantic similarity
- Agent reputation scoring
- Cross-Gateway federation

---

## 14) Phase Boundary Mapping

- **P0 (1 week):** schema freeze + verification spikes + JSON Schema validation files
- **P1 (4–5 weeks):** core messaging + handoff + 6 tools + CLI observability
- **P2 (4–5 weeks):** negotiation + basic teamspaces + workq ownership integration
- **P3 (4–6 weeks):** hardening (conflicts, disagreement protocol, operational metrics)

---

## 15) P0 Exit Criteria for This Spec

P0 is complete when:
1. This canonical spec is approved by CTO + consolidation reviewer.
2. JSON Schemas exist and pass golden tests for envelope + handoff package + teamspace manifest.
3. All three verification spikes report feasibility and constraints:
   - session injection
   - heartbeat/wake trigger from extension
   - cross-extension workq integration feasibility via Gateway RPC
4. Any failed spike has explicit fallback design documented and linked:
   - session injection fail -> inbox-only delivery mode
   - wake trigger fail -> urgent channel notify without wake, polled inbox fallback
   - Gateway RPC integration unavailable -> manual/best-effort workq transfer path with explicit operator-visible status
5. Capability flags for unverified/failed paths are default-off in rollout config.

---

## 16) Implementation Notes for Engineering

- Start from Amadeus ACP extension skeleton and DB pattern.
- Integrate Tim’s `policy`, `provenance`, and `verification` semantics exactly as defined here.
- For ACP ↔ workq integration, use Gateway RPC methods (`api.registerGatewayMethod` + `callGateway`) with explicit context propagation; do not assume direct plugin-tool invocation exists.
- Keep agent-facing markdown renderers for inbox/team visibility.
- Keep JSONL journal appenders minimal and deterministic.
- Avoid introducing protocol branches or parallel specs.

---

**Canonical Decision:** This file supersedes prior ACP drafts for engineering execution planning.
