# ACP Sample Payloads — Implementation Reference

**File:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-sample-payloads-2026-02-21.md`  
**Date:** 2026-02-21  
**Author:** Amadeus (Chief AI Officer)  
**Purpose:** Concrete JSON payloads for every important ACP tool call and response. This is the reference for agents doing implementation work.  
**Source specs:**
- ACP Spec: `/Users/openclaw/.openclaw/workspace/amadeus/agent-communication-protocol-spec-2026-02-21.md`
- Tim's Handoff/Teamspace Spec: `/Users/openclaw/.openclaw/workspace/tim/agent-handoff-teamspace-spec-2026-02-21.md`

---

## Table of Contents

1. [Task Offer / Accept / Decline / Counter](#1-task-negotiation)
2. [Task Handoff with Context Bundle](#2-task-handoff-with-context-bundle)
3. [Status Update Messages](#3-status-update-messages)
4. [Knowledge Push Messages](#4-knowledge-push-messages)
5. [Disagreement / Escalation Messages](#5-disagreement--escalation-messages)
6. [Teamspace Creation and Role Assignment](#6-teamspace-creation-and-role-assignment)
7. [System Messages (Ack / Error)](#7-system-messages)
8. [Subscription Management](#8-subscription-management)
9. [Inbox Query](#9-inbox-query)
10. [Full End-to-End Flow](#10-full-end-to-end-flow)

---

## 1. Task Negotiation

### 1.1 Task Offer — Broadcasting Available Work

**Scenario:** Tim (VP Architecture) has a code review task available and offers it to agents with the right capabilities.

**Tool call:** `acp_send`

**Input JSON:**

```json
{
  "to": ["roman", "claire"],
  "type": "task.offer",
  "priority": "normal",
  "topic": "auth-refactor",
  "payload": {
    "title": "Review auth migration SQL schema",
    "description": "Code review of the auth schema migration before we run it. Focus on index performance, backwards compatibility, and rollback safety.",
    "required_capabilities": ["sql", "code-review", "migrations"],
    "estimated_effort": "PT1H",
    "deadline": "2026-02-21T18:00:00Z",
    "artifacts": [
      {
        "type": "file",
        "path": "/Users/openclaw/.openclaw/workspace/_shared/migrations/20260221_auth_schema.sql",
        "description": "The migration SQL file to review"
      },
      {
        "type": "branch",
        "path": "tim/auth-schema-migration",
        "description": "Git branch containing the migration"
      }
    ],
    "acceptance_criteria": [
      "Index impact analysis documented",
      "Backwards compatibility confirmed or risks identified",
      "Rollback plan reviewed",
      "Approval or list of required changes"
    ],
    "work_item": "openclaw/openclaw#192"
  },
  "context": {
    "session_id": "agent:tim:subagent:a1b2c3d4",
    "work_item": "openclaw/openclaw#192"
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMR1A2B3C4D5E6F7G8H9J0",
  "thread_id": "acp-thread-01JMR1KKKK000001",
  "delivered_to": ["roman", "claire"],
  "delivery_details": [
    { "agent": "roman", "channel": "session", "status": "delivered" },
    { "agent": "claire", "channel": "inbox", "status": "delivered" }
  ],
  "expires_at": "2026-02-21T18:00:00Z"
}
```

**Annotation:** Tim offers a bounded review task to two agents. Roman is currently in an active session so the message is injected live; Claire is offline so it's written to her inbox file. The response confirms delivery status per recipient.

---

### 1.2 Task Request — Requesting Specific Work

**Scenario:** Xavier (CTO) needs someone to implement a specific feature. He sends a task request with a preferred agent but a broadcast fallback.

**Tool call:** `acp_send`

**Input JSON:**

```json
{
  "to": "roman",
  "type": "task.request",
  "priority": "high",
  "topic": "session-management",
  "payload": {
    "title": "Implement session cookie handler middleware",
    "description": "Build Express middleware that sets httpOnly secure cookies for web client sessions. Must integrate with the existing auth flow and support CSRF token rotation.",
    "required_capabilities": ["typescript", "express", "security", "cookies"],
    "preferred_agent": "roman",
    "estimated_effort": "P1D",
    "deadline": "2026-02-23T00:00:00Z",
    "artifacts": [
      {
        "type": "file",
        "path": "/Users/openclaw/.openclaw/workspace/_shared/specs/auth-architecture.md",
        "description": "Architecture doc for the hybrid auth system"
      }
    ],
    "acceptance_criteria": [
      "Cookie set/read/validate working",
      "httpOnly + Secure + SameSite flags configured",
      "CSRF token rotation implemented",
      "Integration tests passing",
      "PR submitted with documentation"
    ],
    "fallback_strategy": "broadcast",
    "work_item": "openclaw/openclaw#195"
  },
  "context": {
    "session_id": "agent:xavier:main:slack",
    "work_item": "openclaw/openclaw#195"
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMR2B3C4D5E6F7G8H9J0K1",
  "thread_id": "acp-thread-01JMR2LLLL000002",
  "delivered_to": ["roman"],
  "delivery_details": [
    { "agent": "roman", "channel": "session", "status": "delivered" }
  ],
  "requires_response": true,
  "max_response_time": "PT1H"
}
```

**Annotation:** Xavier targets Roman specifically but sets `fallback_strategy: "broadcast"` so if Roman declines, ACP auto-broadcasts to other capable agents. The `requires_response` flag tells the system to track whether a reply comes within `max_response_time`.

---

### 1.3 Task Accept

**Scenario:** Roman accepts Xavier's task request.

**Tool call:** `acp_respond`

**Input JSON:**

```json
{
  "reply_to": "acp-msg-01JMR2B3C4D5E6F7G8H9J0K1",
  "type": "task.accept",
  "payload": {
    "offer_id": "acp-msg-01JMR2B3C4D5E6F7G8H9J0K1",
    "estimated_completion": "2026-02-22T20:00:00Z",
    "conditions": [
      "Need access to the staging environment for integration testing"
    ],
    "notes": "I'll start with the cookie middleware, then CSRF rotation, then integration tests. Will have a draft PR up by tomorrow evening."
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMR3C4D5E6F7G8H9J0K1L2",
  "thread_id": "acp-thread-01JMR2LLLL000002",
  "negotiation_status": "accepted",
  "notified": ["xavier"],
  "workq_claimed": true,
  "workq_issue": "openclaw/openclaw#195"
}
```

**Annotation:** Roman's acceptance triggers automatic notifications to Xavier (the requester). If the task has an associated `work_item`, ACP auto-claims it in workq for Roman. The `negotiation_status` confirms the task is now assigned.

---

### 1.4 Task Decline

**Scenario:** Claire declines a task offer because she's at capacity.

**Tool call:** `acp_respond`

**Input JSON:**

```json
{
  "reply_to": "acp-msg-01JMR1A2B3C4D5E6F7G8H9J0",
  "type": "task.decline",
  "payload": {
    "offer_id": "acp-msg-01JMR1A2B3C4D5E6F7G8H9J0",
    "reason": "at_capacity",
    "detail": "I'm currently working on the JWT handler updates (openclaw/openclaw#196) and the API client test suite. Both are due today. I won't have bandwidth until tomorrow.",
    "suggested_agent": "sandy",
    "available_after": "2026-02-22T10:00:00Z"
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMR4D5E6F7G8H9J0K1L2M3",
  "thread_id": "acp-thread-01JMR1KKKK000001",
  "negotiation_status": "declined",
  "notified": ["tim"],
  "decline_reason": "at_capacity",
  "suggested_agent": "sandy"
}
```

**Annotation:** Declines are never silent — the reason enum (`at_capacity`, `lacks_capability`, `conflicting_work`, `deadline_unrealistic`, `out_of_scope`, `other`) ensures the requester gets actionable information. The `suggested_agent` helps with re-routing.

---

### 1.5 Task Counter-Proposal

**Scenario:** Roman can do the work Tim offered, but needs a different timeline and wants to narrow the scope.

**Tool call:** `acp_respond`

**Input JSON:**

```json
{
  "reply_to": "acp-msg-01JMR1A2B3C4D5E6F7G8H9J0",
  "type": "task.counter",
  "payload": {
    "offer_id": "acp-msg-01JMR1A2B3C4D5E6F7G8H9J0",
    "proposed_changes": "I can do the review, but I need until tomorrow morning and I'd like to focus only on index performance — Claire is better suited for the backwards compatibility analysis.",
    "revised_scope": "Review auth migration SQL schema focusing exclusively on index performance and query plan impact. Backwards compatibility analysis handled separately.",
    "revised_deadline": "2026-02-22T12:00:00Z",
    "revised_effort": "PT45M",
    "conditions": [
      "Claire handles backwards compatibility review as a separate task",
      "Access to production query stats for realistic index analysis"
    ]
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMR5E6F7G8H9J0K1L2M3N4",
  "thread_id": "acp-thread-01JMR1KKKK000001",
  "negotiation_status": "counter_proposed",
  "negotiation_round": 1,
  "max_rounds": 3,
  "notified": ["tim"]
}
```

**Annotation:** Counter-proposals enable structured negotiation without free-form back-and-forth. Negotiations are bounded to `max_rounds` (default 3). After max rounds, the system auto-escalates to a coordinator or human. Tim can now accept the counter, decline it, or counter again (up to the round limit).

---

### 1.6 Accepting a Counter-Proposal

**Scenario:** Tim accepts Roman's counter-proposal.

**Tool call:** `acp_respond`

**Input JSON:**

```json
{
  "reply_to": "acp-msg-01JMR5E6F7G8H9J0K1L2M3N4",
  "type": "task.accept",
  "payload": {
    "offer_id": "acp-msg-01JMR1A2B3C4D5E6F7G8H9J0",
    "estimated_completion": "2026-02-22T12:00:00Z",
    "notes": "Agreed — Roman takes index performance review, I'll create a separate task for Claire on backwards compatibility."
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMR6F7G8H9J0K1L2M3N4O5",
  "thread_id": "acp-thread-01JMR1KKKK000001",
  "negotiation_status": "accepted",
  "negotiation_rounds_used": 1,
  "notified": ["roman"],
  "workq_claimed": true,
  "workq_issue": "openclaw/openclaw#192"
}
```

**Annotation:** The negotiation concludes after 1 round of counter/accept. The original task offer is now bound with the revised scope and timeline from Roman's counter-proposal.

---

## 2. Task Handoff with Context Bundle

### 2.1 Handoff Initiate — Full Context Transfer

**Scenario:** Roman has been working on fixing NULL values in the `user_sessions` table. His session is ending and he needs to hand off to Claire with full context so she can continue without losing any work state.

**Tool call:** `acp_handoff`

**Input JSON:**

```json
{
  "to": "claire",
  "title": "Continue: Fix NULL last_active_at in user_sessions + add constraint",
  "reason": "shift_change",
  "context_bundle": {
    "state_summary": "Backfill query is written and tested locally — it uses created_at as the fallback value for NULL last_active_at rows. Migration file is created but the NOT NULL constraint ALTER TABLE is commented out pending testing. Unit tests are partially written: backfill test passes, constraint test is a TODO stub. The PR has not been created yet.",
    "decisions_made": [
      {
        "decision": "Use created_at as fallback for NULL last_active_at values",
        "reasoning": "It's the most conservative estimate — a session was at least active when it was created. Using NOW() would falsely mark old sessions as recently active.",
        "timestamp": "2026-02-21T14:30:00Z",
        "reversible": true
      },
      {
        "decision": "Single migration file for both backfill and constraint",
        "reasoning": "Keeps the migration atomic — either both happen or neither does. Simpler rollback.",
        "timestamp": "2026-02-21T15:00:00Z",
        "reversible": true
      }
    ],
    "open_questions": [
      {
        "question": "Should the migration run in a single transaction or in batches?",
        "context": "14,223 rows is small enough for a single transaction, but Drew mentioned the table might be under write load during business hours.",
        "attempted_answers": [
          "Asked Drew via ACP knowledge.query — no response yet as of 16:30"
        ]
      },
      {
        "question": "Should we add an index on last_active_at?",
        "context": "The column is used in session expiry queries. An index would speed those up but adds write overhead.",
        "attempted_answers": []
      }
    ],
    "artifacts": [
      {
        "ref": {
          "type": "file",
          "path": "/worktrees/roman-187/migrations/20260221_backfill_last_active.sql",
          "description": "Migration SQL — backfill is complete, ALTER TABLE is commented out"
        },
        "status": "modified",
        "notes": "Lines 1-15: backfill UPDATE (done). Lines 18-20: ALTER TABLE ADD NOT NULL (commented out, needs testing first)."
      },
      {
        "ref": {
          "type": "file",
          "path": "/worktrees/roman-187/tests/session_migration.test.ts",
          "description": "Test file for the migration"
        },
        "status": "modified",
        "notes": "backfillNullLastActive test passes. constraintEnforced test is a TODO stub on line 42."
      },
      {
        "ref": {
          "type": "file",
          "path": "/Users/openclaw/.openclaw/workspace/drew/analysis/session-nulls.md",
          "description": "Drew's original analysis of the NULL data issue"
        },
        "status": "reviewed",
        "notes": "Reference material — the source of truth for the problem statement."
      }
    ],
    "work_item": "openclaw/openclaw#187",
    "branch": "roman/187-session-nulls",
    "worktree_path": "/worktrees/roman-187",
    "test_status": "failing",
    "stakeholders": [
      {
        "agent_id": "tim",
        "role": "requester",
        "last_interaction": "2026-02-21T13:00:00Z",
        "expectations": "PR submitted and reviewed by EOD"
      },
      {
        "agent_id": "drew",
        "role": "dependent",
        "last_interaction": "2026-02-21T14:00:00Z",
        "expectations": "Needs this fixed for analytics accuracy — waiting on it for a report"
      }
    ],
    "environment_notes": "Worktree is at /worktrees/roman-187. Test database has fixture data in tests/fixtures/sessions.sql. The fixture intentionally includes NULL last_active_at rows for testing.",
    "risks": [
      "Table might be under write load during migration — consider batching or off-peak timing",
      "If the constraint is added before backfill completes, existing inserts without last_active_at will fail"
    ],
    "pitfalls": [
      "Don't run the ALTER TABLE constraint until the backfill UPDATE is verified — it will fail on existing NULLs",
      "The test fixture has intentional NULLs — need to update the fixture AFTER verifying migration tests pass"
    ],
    "gotchas": [
      "The ORM model doesn't have last_active_at as required yet — need to update the TypeScript interface after migration",
      "There's a scheduled analytics job that reads last_active_at — it runs at 02:00 UTC, so deploy before then for clean data"
    ],
    "next_steps": [
      { "step": "Uncomment and test the NOT NULL constraint ALTER TABLE", "priority": "must", "estimated_effort": "PT30M" },
      { "step": "Write the constraint enforcement test (stub on line 42)", "priority": "must", "estimated_effort": "PT20M" },
      { "step": "Check with Drew about table load — batch vs single transaction", "priority": "should", "estimated_effort": "PT10M" },
      { "step": "Run full test suite to catch any regressions", "priority": "must", "estimated_effort": "PT15M" },
      { "step": "Update TypeScript ORM interface for required last_active_at", "priority": "should", "estimated_effort": "PT10M" },
      { "step": "Submit PR, tag Tim for review, notify Drew", "priority": "must", "estimated_effort": "PT15M" }
    ]
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "handoff_id": "acp-handoff-01JMR7G8H9J0K1L2M3N4O5P6",
  "message_id": "acp-msg-01JMR7G8H9J0K1L2M3N4O5P7",
  "thread_id": "acp-thread-01JMR7MMMM000003",
  "status": "initiated",
  "delivered_to": ["claire"],
  "delivery_details": [
    { "agent": "claire", "channel": "inbox", "status": "delivered" }
  ],
  "context_file_written": "/Users/openclaw/.openclaw/workspace/claire/acp-handoff-01JMR7G8H9J0K1L2M3N4O5P6.md",
  "stakeholders_notified": ["tim", "drew"]
}
```

**Annotation:** This is the most critical payload in the entire protocol. The context bundle is **mandatory** — a handoff without `state_summary` and at least one `next_step` is rejected by schema validation. ACP writes a human-readable markdown version to Claire's workspace and notifies all listed stakeholders. The handoff context file includes the `acp_respond` template so Claire knows exactly how to accept.

---

### 2.2 Handoff Accept

**Scenario:** Claire reviews the handoff context bundle and accepts ownership.

**Tool call:** `acp_respond`

**Input JSON:**

```json
{
  "reply_to": "acp-msg-01JMR7G8H9J0K1L2M3N4O5P7",
  "type": "handoff.accept",
  "payload": {
    "handoff_id": "acp-handoff-01JMR7G8H9J0K1L2M3N4O5P6",
    "confirmation": "I've reviewed the full context bundle. The backfill approach using created_at makes sense. I'll pick up from the NOT NULL constraint, write the missing test, check with Drew on batching, and get the PR submitted.",
    "clarifying_questions": [
      "Roman — did you test the backfill against the production data volume or just the fixture? Want to make sure the UPDATE doesn't lock the table."
    ],
    "revised_timeline": "2026-02-21T20:00:00Z"
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMR8H9J0K1L2M3N4O5P6Q7",
  "thread_id": "acp-thread-01JMR7MMMM000003",
  "handoff_status": "accepted",
  "ownership_transferred": true,
  "workq_transfer": {
    "issue": "openclaw/openclaw#187",
    "from": "roman",
    "to": "claire",
    "status": "claimed"
  },
  "notified": ["roman", "tim"]
}
```

**Annotation:** Acceptance triggers automatic workq ownership transfer (release from Roman, claim for Claire). Roman and Tim are notified. If Claire had clarifying questions, they're delivered to Roman as part of the accept so he can answer asynchronously.

---

### 2.3 Handoff Reject

**Scenario:** Claire can't accept a handoff due to a capability mismatch.

**Tool call:** `acp_respond`

**Input JSON:**

```json
{
  "reply_to": "acp-msg-01JMR9AAAAAAAAAAAAAAAAAA",
  "type": "handoff.reject",
  "payload": {
    "handoff_id": "acp-handoff-01JMR9BBBBBBBBBBBBBBBBBB",
    "reason": "This handoff involves GPU cluster configuration for the ML pipeline. I don't have experience with CUDA driver setup or distributed training orchestration — this needs someone with infrastructure/ML ops skills.",
    "suggested_alternative": "drew"
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMR9CCCCCCCCCCCCCCCCCC",
  "thread_id": "acp-thread-01JMR9DDDDDDDDDDDDDDDD",
  "handoff_status": "rejected",
  "ownership_retained_by": "roman",
  "suggested_alternative": "drew",
  "notified": ["roman"]
}
```

**Annotation:** Handoff rejections keep ownership with the original sender. The `suggested_alternative` helps the sender re-route. No work item transfer occurs on rejection. This maps to Tim's THP rejection codes: `capability_mismatch`.

---

### 2.4 Handoff Complete (Confirmation)

**Scenario:** After Claire has accepted and verified she has everything she needs, she confirms the handoff is fully complete.

**Tool call:** `acp_respond`

**Input JSON:**

```json
{
  "reply_to": "acp-msg-01JMR7G8H9J0K1L2M3N4O5P7",
  "type": "handoff.complete",
  "payload": {
    "handoff_id": "acp-handoff-01JMR7G8H9J0K1L2M3N4O5P6",
    "received_artifacts": [
      "/worktrees/roman-187/migrations/20260221_backfill_last_active.sql",
      "/worktrees/roman-187/tests/session_migration.test.ts"
    ],
    "state_acknowledged": true,
    "notes": "All artifacts verified, worktree accessible, tests run locally. Roman answered my batching question — single transaction is fine for 14K rows. Proceeding with the remaining work."
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMRAH9J0K1L2M3N4O5P6Q8",
  "thread_id": "acp-thread-01JMR7MMMM000003",
  "handoff_status": "completed",
  "handoff_closed_at": "2026-02-21T17:15:00Z",
  "audit_record": {
    "handoff_id": "acp-handoff-01JMR7G8H9J0K1L2M3N4O5P6",
    "from": "roman",
    "to": "claire",
    "initiated_at": "2026-02-21T16:30:00Z",
    "accepted_at": "2026-02-21T17:00:00Z",
    "completed_at": "2026-02-21T17:15:00Z",
    "artifacts_count": 3,
    "total_duration_minutes": 45
  }
}
```

**Annotation:** The complete confirmation closes the handoff record with a full audit trail. This maps to Tim's THP state machine: `Activated → Completed → Closed`. The audit record is immutable and queryable via `openclaw acp handoffs`.

---

## 3. Status Update Messages

### 3.1 Progress Update

**Scenario:** Roman is working on the session cookie middleware and reports progress to the team.

**Tool call:** `acp_broadcast`

**Input JSON:**

```json
{
  "type": "status.progress",
  "topic": "auth-refactor",
  "priority": "normal",
  "filter": { "team": "auth-system-refactor" },
  "payload": {
    "summary": "Session cookie middleware is 60% complete. Cookie set/read/validate working. Starting CSRF token rotation implementation.",
    "detail": "Completed the core cookie middleware with httpOnly, Secure, and SameSite flags. Integration with the existing auth flow verified in unit tests. Next up: CSRF token rotation, which requires a new token store.",
    "work_item": "openclaw/openclaw#195",
    "progress_pct": 60,
    "estimated_completion": "2026-02-22T16:00:00Z",
    "blockers": [],
    "artifacts_changed": [
      {
        "type": "file",
        "path": "/worktrees/roman-195/src/middleware/session-cookie.ts",
        "description": "New session cookie middleware"
      },
      {
        "type": "file",
        "path": "/worktrees/roman-195/tests/session-cookie.test.ts",
        "description": "Tests for cookie middleware — 8/12 passing"
      }
    ]
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMRBJ0K1L2M3N4O5P6Q7R8",
  "broadcast_recipients": ["xavier", "tim", "claire", "sandy", "amadeus"],
  "delivery_details": [
    { "agent": "xavier", "channel": "session", "status": "delivered" },
    { "agent": "tim", "channel": "session", "status": "delivered" },
    { "agent": "claire", "channel": "inbox", "status": "delivered" },
    { "agent": "sandy", "channel": "inbox", "status": "delivered" },
    { "agent": "amadeus", "channel": "inbox", "status": "delivered" }
  ]
}
```

**Annotation:** Broadcasts go to all team members matching the filter. Rate-limited to 1 per agent per topic per 10 minutes. Delivery channel depends on whether each recipient is in an active session.

---

### 3.2 Blocked Status

**Scenario:** Claire is stuck and needs help from the team.

**Tool call:** `acp_broadcast`

**Input JSON:**

```json
{
  "type": "status.blocked",
  "topic": "auth-refactor",
  "priority": "high",
  "filter": { "team": "auth-system-refactor" },
  "payload": {
    "summary": "JWT handler update blocked — cannot determine correct token refresh endpoint for the new session cookie flow.",
    "detail": "The existing JWT refresh endpoint assumes stateless tokens. With the new cookie-based sessions, we need to decide: does the refresh endpoint return a new cookie, a new JWT, or both? The architecture doc doesn't specify this case. Need a decision from Tim or Xavier.",
    "work_item": "openclaw/openclaw#196",
    "blockers": [
      "Architecture decision needed: refresh endpoint behavior for hybrid auth"
    ],
    "artifacts_changed": []
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMRCK1L2M3N4O5P6Q7R8S9",
  "broadcast_recipients": ["xavier", "tim", "roman", "sandy", "amadeus"],
  "delivery_details": [
    { "agent": "xavier", "channel": "session", "status": "delivered" },
    { "agent": "tim", "channel": "session", "status": "delivered" },
    { "agent": "roman", "channel": "session", "status": "delivered" },
    { "agent": "sandy", "channel": "inbox", "status": "delivered" },
    { "agent": "amadeus", "channel": "inbox", "status": "delivered" }
  ],
  "priority_escalation": {
    "wake_triggered": false,
    "channel_notified": false
  }
}
```

**Annotation:** Blocked statuses at `high` priority get session injection and inbox delivery but not channel notification (that's reserved for `critical`). Tim or Xavier's lead/coordinator subscriptions auto-match `status.blocked` from team members.

---

### 3.3 Completion Status

**Scenario:** Roman finishes his task and broadcasts completion.

**Tool call:** `acp_broadcast`

**Input JSON:**

```json
{
  "type": "status.complete",
  "topic": "auth-refactor",
  "priority": "normal",
  "filter": { "team": "auth-system-refactor" },
  "payload": {
    "summary": "Session cookie middleware implementation complete. PR #47 submitted for review.",
    "detail": "All acceptance criteria met: cookie set/read/validate, httpOnly + Secure + SameSite flags, CSRF token rotation with configurable TTL. 15 tests passing. PR is up and tagged Sandy for review.",
    "work_item": "openclaw/openclaw#195",
    "progress_pct": 100,
    "artifacts_changed": [
      {
        "type": "pr",
        "path": "openclaw/openclaw#47",
        "description": "PR: Implement session cookie handler middleware"
      }
    ]
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMRDL2M3N4O5P6Q7R8S9T0",
  "broadcast_recipients": ["xavier", "tim", "claire", "sandy", "amadeus"],
  "delivery_details": [
    { "agent": "xavier", "channel": "inbox", "status": "delivered" },
    { "agent": "tim", "channel": "session", "status": "delivered" },
    { "agent": "claire", "channel": "inbox", "status": "delivered" },
    { "agent": "sandy", "channel": "session", "status": "delivered" },
    { "agent": "amadeus", "channel": "inbox", "status": "delivered" }
  ]
}
```

**Annotation:** Completion broadcasts notify the team so coordinators can update the task board, reviewers can prepare for review, and dependent agents can unblock. Sandy sees this in her active session and can pick up the review immediately.

---

## 4. Knowledge Push Messages

### 4.1 Knowledge Push — Discovery Sharing

**Scenario:** Drew discovers a data quality issue during analytics work and pushes it to the agents who need to know.

**Tool call:** `acp_send`

**Input JSON:**

```json
{
  "to": ["tim", "amadeus", "xavier"],
  "type": "knowledge.push",
  "priority": "high",
  "topic": "user-sessions-data-quality",
  "payload": {
    "topic": "user_sessions table data quality — NULL last_active_at",
    "summary": "12% of rows in user_sessions have NULL last_active_at. This causes incorrect session expiry calculations and will produce wrong results in any code touching session recency.",
    "detail": "Ran a data quality scan across all session tables. Found 14,223 out of 118,424 rows with NULL last_active_at. These appear to be sessions created before the column was added (migration 20250915). The NULL values cause the session expiry query to silently skip these sessions, meaning 12% of sessions never expire.",
    "evidence": [
      "SELECT COUNT(*) FROM user_sessions WHERE last_active_at IS NULL → 14,223 rows",
      "SELECT COUNT(*) FROM user_sessions → 118,424 rows",
      "Earliest NULL row: created_at = 2025-08-12 (predates last_active_at column)",
      "Session expiry query: WHERE last_active_at < NOW() - INTERVAL '30 days' — skips NULLs"
    ],
    "artifacts": [
      {
        "type": "file",
        "path": "/Users/openclaw/.openclaw/workspace/drew/analysis/session-nulls.md",
        "description": "Full analysis with queries and data samples"
      }
    ],
    "relevance": "Anyone working on auth, sessions, or user management needs to know about this. The session expiry bug affects security posture.",
    "confidence": "high",
    "actionable": true,
    "suggested_action": "Backfill NULL values with created_at as a conservative fallback, then add NOT NULL DEFAULT constraint. Also fix the expiry query to handle NULLs safely."
  },
  "context": {
    "session_id": "agent:drew:subagent:analytics-scan-01",
    "artifacts": [
      {
        "type": "file",
        "path": "/Users/openclaw/.openclaw/workspace/drew/analysis/session-nulls.md",
        "description": "Detailed data quality analysis"
      }
    ]
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMREM3N4O5P6Q7R8S9T0U1",
  "thread_id": "acp-thread-01JMRENNNN000004",
  "delivered_to": ["tim", "amadeus", "xavier"],
  "delivery_details": [
    { "agent": "tim", "channel": "session", "status": "delivered" },
    { "agent": "amadeus", "channel": "inbox", "status": "delivered" },
    { "agent": "xavier", "channel": "session", "status": "delivered" }
  ],
  "knowledge_id": "acp-know-01JMREM3N4O5P6Q7R8S9T0U2",
  "persisted": true
}
```

**Annotation:** Knowledge pushes are persisted in the `knowledge` table so they're searchable later. The `confidence` level helps recipients judge how much to trust the information. The `actionable` flag and `suggested_action` make it clear this isn't just FYI — it requires follow-up.

---

### 4.2 Knowledge Query

**Scenario:** Claire needs to understand the session table schema before starting her work.

**Tool call:** `acp_send`

**Input JSON:**

```json
{
  "to": "drew",
  "type": "knowledge.query",
  "priority": "normal",
  "topic": "user-sessions-schema",
  "payload": {
    "question": "What is the current schema for the user_sessions table? Specifically, what columns exist, which have constraints, and are there any known data quality issues beyond the NULL last_active_at issue?",
    "context": "I'm picking up openclaw/openclaw#187 (fix NULL last_active_at). Before I write the migration, I want to make sure I'm not missing other schema issues that should be addressed in the same migration.",
    "urgency": "soon"
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMRFN4O5P6Q7R8S9T0U1V2",
  "thread_id": "acp-thread-01JMRFOOOO000005",
  "delivered_to": ["drew"],
  "delivery_details": [
    { "agent": "drew", "channel": "session", "status": "delivered" }
  ],
  "requires_response": true
}
```

**Annotation:** Knowledge queries are directed requests for information. The `urgency` field tells the recipient how quickly they should respond. ACP tracks whether a response comes back.

---

### 4.3 Knowledge Response

**Scenario:** Drew responds to Claire's schema question.

**Tool call:** `acp_respond`

**Input JSON:**

```json
{
  "reply_to": "acp-msg-01JMRFN4O5P6Q7R8S9T0U1V2",
  "type": "knowledge.response",
  "payload": {
    "query_id": "acp-msg-01JMRFN4O5P6Q7R8S9T0U1V2",
    "answer": "The user_sessions table has 8 columns: id (PK, UUID), user_id (FK, NOT NULL), session_token (UNIQUE, NOT NULL), created_at (NOT NULL), last_active_at (nullable — the known issue), expires_at (nullable), ip_address (nullable), user_agent (nullable). Beyond the NULL last_active_at, I also found that expires_at is NULL for ~8% of rows, which means those sessions have no expiry. Probably worth fixing in the same migration.",
    "confidence": "high",
    "sources": [
      "Direct query against production replica: \\d user_sessions",
      "/Users/openclaw/.openclaw/workspace/drew/analysis/session-nulls.md"
    ],
    "caveats": [
      "The expires_at NULL issue hasn't been fully analyzed yet — I can dig deeper if needed",
      "Schema info is from the production replica as of 2026-02-21 10:00 UTC"
    ]
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMRGO5P6Q7R8S9T0U1V2W3",
  "thread_id": "acp-thread-01JMRFOOOO000005",
  "delivered_to": ["claire"],
  "delivery_details": [
    { "agent": "claire", "channel": "session", "status": "delivered" }
  ],
  "knowledge_id": "acp-know-01JMRGO5P6Q7R8S9T0U1V2W4",
  "persisted": true
}
```

**Annotation:** Knowledge responses are also persisted, creating a searchable knowledge base over time. The `caveats` field is important — it tells the recipient the limitations of the answer so they don't over-rely on it.

---

## 5. Disagreement / Escalation Messages

### 5.1 Position Statement

**Scenario:** Tim states a position on the storage backend for a new feature.

**Tool call:** `acp_send`

**Input JSON:**

```json
{
  "to": "amadeus",
  "type": "position.state",
  "priority": "normal",
  "topic": "knowledge-graph-storage",
  "payload": {
    "topic": "Storage backend for collective knowledge graph",
    "position": "Use PostgreSQL with JSONB columns and recursive CTEs for graph queries",
    "reasoning": "We already operate PostgreSQL for production data. Adding it for the knowledge graph avoids introducing a new database technology. PostgreSQL's recursive CTEs handle graph traversal efficiently for our expected scale. JSONB gives us flexible schema for knowledge nodes without requiring schema migrations for every new knowledge type.",
    "evidence": [
      "Our knowledge graph will be < 100K nodes for the next 12 months based on current agent output rates",
      "PostgreSQL recursive CTEs perform well up to ~1M nodes with proper indexing",
      "JSONB indexing with GIN handles flexible schema queries efficiently",
      "One less operational dependency to manage compared to a dedicated graph DB"
    ],
    "confidence": "high",
    "open_to_revision": true
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMRHP6Q7R8S9T0U1V2W3X4",
  "thread_id": "acp-thread-01JMRHPPPP000006",
  "delivered_to": ["amadeus"],
  "delivery_details": [
    { "agent": "amadeus", "channel": "inbox", "status": "delivered" }
  ],
  "disagreement_id": "acp-disagree-01JMRHP6Q7R8S9T0U1V2W3X5",
  "position_registered": true
}
```

**Annotation:** Position statements require `reasoning` — the schema rejects positions without justification. The `open_to_revision` flag signals the sender is willing to change their mind based on evidence, which sets the tone for constructive disagreement.

---

### 5.2 Position Challenge

**Scenario:** Amadeus disagrees with Tim's PostgreSQL recommendation and proposes SQLite instead.

**Tool call:** `acp_respond`

**Input JSON:**

```json
{
  "reply_to": "acp-msg-01JMRHP6Q7R8S9T0U1V2W3X4",
  "type": "position.challenge",
  "payload": {
    "position_id": "acp-msg-01JMRHP6Q7R8S9T0U1V2W3X4",
    "counter_position": "Use SQLite with a lightweight graph abstraction layer — not PostgreSQL",
    "reasoning": "We don't currently run PostgreSQL in production. The workq extension and all agent coordination use SQLite. Adding PostgreSQL introduces significant operational overhead: deployment, monitoring, connection pooling, backups, and migrations infrastructure for a new database. At our scale (< 100K nodes, as Tim himself notes), SQLite with an adjacency list pattern handles graph traversal efficiently. Starting with SQLite and a clean abstraction layer lets us migrate later if scale demands it, without paying the operational cost upfront.",
    "evidence": [
      "workq already proves SQLite with WAL mode works well for multi-agent concurrent coordination",
      "No PostgreSQL infrastructure exists in current deployment — adding it is a net-new operational burden",
      "SQLite with adjacency list handles < 1M node graphs efficiently with recursive CTEs (same as PostgreSQL)",
      "Clean abstraction layer means we can migrate to PostgreSQL or a graph DB later without rewriting application code",
      "Operational simplicity: SQLite requires zero additional deployment/monitoring/backup infrastructure"
    ],
    "proposed_resolution": "Start with SQLite + adjacency list + clean storage abstraction interface. Document PostgreSQL as the scaling path when we exceed 500K nodes. This gives us the simplicity benefit now with a defined upgrade path.",
    "severity": "significant"
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMRIQ7R8S9T0U1V2W3X4Y5",
  "thread_id": "acp-thread-01JMRHPPPP000006",
  "delivered_to": ["tim"],
  "delivery_details": [
    { "agent": "tim", "channel": "session", "status": "delivered" }
  ],
  "disagreement_round": 1,
  "max_rounds": 2,
  "severity": "significant"
}
```

**Annotation:** Challenges must include `reasoning` and `evidence`. The `severity` level affects urgency: `minor` can queue, `significant` should be addressed soon, `blocking` escalates immediately. Max 2 rounds (position → challenge → concede or escalate). No extended agent debates.

---

### 5.3 Position Concede

**Scenario:** Tim is convinced by Amadeus's argument and updates his position.

**Tool call:** `acp_respond`

**Input JSON:**

```json
{
  "reply_to": "acp-msg-01JMRIQ7R8S9T0U1V2W3X4Y5",
  "type": "position.concede",
  "payload": {
    "position_id": "acp-msg-01JMRHP6Q7R8S9T0U1V2W3X4",
    "challenge_id": "acp-msg-01JMRIQ7R8S9T0U1V2W3X4Y5",
    "revised_position": "Use SQLite with adjacency list + clean storage abstraction interface. PostgreSQL is the documented scaling path when we exceed 500K nodes.",
    "what_changed_mind": "Valid point about operational overhead — we shouldn't add a new database to the stack when SQLite serves the scale. The workq precedent is compelling evidence. The abstraction layer ensures we don't lock ourselves in. Key insight: the right architecture decision is the one that defers unnecessary complexity, not the one that anticipates it."
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMRJR8S9T0U1V2W3X4Y5Z6",
  "thread_id": "acp-thread-01JMRHPPPP000006",
  "disagreement_status": "resolved",
  "resolution": "conceded_to_challenger",
  "resolved_by": "tim",
  "auto_broadcast": {
    "type": "knowledge.push",
    "topic": "knowledge-graph-storage",
    "summary": "Decision: Knowledge graph storage will use SQLite with adjacency list + clean abstraction layer. PostgreSQL documented as scaling path at 500K+ nodes. [Agreed by Tim + Amadeus, 2026-02-21]",
    "delivered_to": ["xavier", "roman", "claire", "drew", "sandy", "luis"]
  }
}
```

**Annotation:** When a disagreement resolves via concession, ACP auto-broadcasts the decision as a `knowledge.push` to all relevant agents. This ensures the entire org updates their understanding. The `what_changed_mind` field is valuable for institutional learning — it documents why the decision went one way.

---

### 5.4 Position Escalation

**Scenario:** Neither Tim nor Amadeus concede on a different topic. The disagreement needs human resolution.

**Tool call:** `acp_respond`

**Input JSON:**

```json
{
  "reply_to": "acp-msg-01JMRKS9T0U1V2W3X4Y5Z6A7",
  "type": "position.escalate",
  "payload": {
    "position_ids": [
      "acp-msg-01JMRKBBBBBBBBBBBBBBBBBB",
      "acp-msg-01JMRKCCCCCCCCCCCCCCCCCC"
    ],
    "summary": "Tim and Amadeus disagree on whether to use server-side rendering (SSR) or client-side rendering (CSR) for the agent dashboard. Tim argues SSR is simpler and reduces client complexity. Amadeus argues CSR enables richer real-time interactivity which is essential for monitoring live agent activity. Both positions have merit; this is a product direction decision that needs human input on the priority: simplicity vs. real-time capability.",
    "escalate_to": "david",
    "reason": "This is a product direction decision, not a purely technical one. Both approaches are technically viable. The right answer depends on David's priorities for the dashboard: is it primarily a monitoring tool (favors SSR) or an interactive control surface (favors CSR)?",
    "deadline": "2026-02-22T18:00:00Z"
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMRLT0U1V2W3X4Y5Z6A7B8",
  "thread_id": "acp-thread-01JMRKQQQQ000007",
  "disagreement_status": "escalated",
  "escalated_to": "david",
  "delivery_details": [
    { "agent": "david", "channel": "channel", "status": "delivered", "channel_id": "#acp-escalations" }
  ],
  "deadline": "2026-02-22T18:00:00Z",
  "escalation_summary_written": "/Users/openclaw/.openclaw/workspace/_shared/escalations/acp-disagree-01JMRKQQQQ000007.md"
}
```

**Annotation:** Escalation is not failure — it's a structured way to get human decisions on genuinely ambiguous questions. The escalation writes a human-readable summary to `_shared/escalations/` and notifies the target via channel message (not just inbox). The deadline ensures escalations don't languish. When David decides, his resolution is broadcast as `knowledge.push` with `confidence: "high"`.

---

## 6. Teamspace Creation and Role Assignment

### 6.1 Create Teamspace

**Scenario:** Xavier creates a teamspace for the auth system refactor project.

**Tool call:** `acp_team`

**Input JSON:**

```json
{
  "action": "create",
  "name": "Auth System Refactor",
  "goal": "Replace JWT-only auth with hybrid session cookies (web) + JWT (API) architecture. Deliver migration-safe implementation with zero downtime. Target: all acceptance criteria met and deployed within 2 weeks.",
  "members": [
    { "agent_id": "xavier", "role": "coordinator" },
    { "agent_id": "tim", "role": "lead" },
    { "agent_id": "roman", "role": "contributor" },
    { "agent_id": "claire", "role": "contributor" },
    { "agent_id": "sandy", "role": "reviewer" },
    { "agent_id": "amadeus", "role": "advisor" }
  ]
}
```

**Response JSON:**

```json
{
  "ok": true,
  "teamspace_id": "auth-system-refactor",
  "name": "Auth System Refactor",
  "status": "active",
  "workspace_path": "/Users/openclaw/.openclaw/workspace/_teams/auth-system-refactor/",
  "created_by": "xavier",
  "created_at": "2026-02-21T14:00:00Z",
  "members_added": [
    { "agent_id": "xavier", "role": "coordinator", "status": "active" },
    { "agent_id": "tim", "role": "lead", "status": "active" },
    { "agent_id": "roman", "role": "contributor", "status": "active" },
    { "agent_id": "claire", "role": "contributor", "status": "active" },
    { "agent_id": "sandy", "role": "reviewer", "status": "active" },
    { "agent_id": "amadeus", "role": "advisor", "status": "active" }
  ],
  "workspace_initialized": {
    "files_created": [
      "_teams/auth-system-refactor/TEAM.md",
      "_teams/auth-system-refactor/STATUS.md",
      "_teams/auth-system-refactor/DECISIONS.md"
    ],
    "directories_created": [
      "_teams/auth-system-refactor/artifacts/",
      "_teams/auth-system-refactor/reviews/",
      "_teams/auth-system-refactor/archive/"
    ]
  },
  "notifications_sent": {
    "type": "team.join",
    "delivered_to": ["xavier", "tim", "roman", "claire", "sandy", "amadeus"]
  },
  "auto_subscriptions_created": 6
}
```

**Annotation:** Teamspace creation is a comprehensive operation. ACP creates the SQLite records, initializes the workspace directory with template files (`TEAM.md`, `STATUS.md`, `DECISIONS.md`), sends `team.join` notifications to all members, and auto-subscribes everyone to team-scoped ACP messages. This maps to both the ACP spec's teamspace model and Tim's TSP manifest concept.

---

### 6.2 Record Team Decision

**Scenario:** Tim (as lead) records an architecture decision for the team.

**Tool call:** `acp_team`

**Input JSON:**

```json
{
  "action": "decide",
  "team": "auth-system-refactor",
  "decision": "Session cookies for web clients, JWT for API/machine clients. Both stored in unified user_sessions table with a 'session_type' discriminator column.",
  "rationale": "Cookies provide httpOnly + CSRF protection for browser-based access. JWT is standard for machine-to-machine and mobile API consumers. Unified storage simplifies session management, revocation, and monitoring — one table to query for all active sessions regardless of type."
}
```

**Response JSON:**

```json
{
  "ok": true,
  "decision_id": "acp-decision-01JMRMU1V2W3X4Y5Z6A7B8C9",
  "teamspace_id": "auth-system-refactor",
  "made_by": "tim",
  "created_at": "2026-02-21T14:30:00Z",
  "persisted": {
    "database": true,
    "decisions_file": "/Users/openclaw/.openclaw/workspace/_teams/auth-system-refactor/DECISIONS.md"
  },
  "auto_broadcast": {
    "type": "knowledge.push",
    "topic": "auth-refactor",
    "summary": "[Team Decision] Auth System Refactor: Session cookies for web clients, JWT for API/machine clients. Unified user_sessions table with session_type discriminator. — Tim, 2026-02-21",
    "delivered_to": ["xavier", "roman", "claire", "sandy", "amadeus"]
  }
}
```

**Annotation:** Team decisions are persisted in both the SQLite `teamspace_decisions` table and appended to the human-readable `DECISIONS.md` file. They're also auto-broadcast to all team members as knowledge pushes. This maps to Tim's TSP decision log (ADR-like records).

---

### 6.3 Update Team Status

**Scenario:** Xavier (as coordinator) updates the team's overall status.

**Tool call:** `acp_team`

**Input JSON:**

```json
{
  "action": "status",
  "team": "auth-system-refactor",
  "status": {
    "summary": "Phase 1 (schema migration) complete. Phase 2 (handler implementation) in progress. On track for deadline.",
    "active_work": [
      {
        "agent_id": "roman",
        "task": "Session cookie middleware",
        "status": "in_progress",
        "work_item": "openclaw/openclaw#195",
        "progress_pct": 60
      },
      {
        "agent_id": "claire",
        "task": "JWT handler updates for dual-auth",
        "status": "blocked",
        "work_item": "openclaw/openclaw#196",
        "blockers": ["Needs refresh endpoint decision"]
      }
    ],
    "blockers": [
      "Architecture decision needed: refresh endpoint behavior for hybrid auth (Claire blocked)"
    ],
    "next_milestone": "All handlers implemented and unit tested by 2026-02-23"
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "teamspace_id": "auth-system-refactor",
  "status_updated_at": "2026-02-21T16:00:00Z",
  "status_file_updated": "/Users/openclaw/.openclaw/workspace/_teams/auth-system-refactor/STATUS.md",
  "active_blockers": 1,
  "members_notified": false
}
```

**Annotation:** Status updates refresh the `STATUS.md` file in the teamspace workspace. This is the single source of truth for "what's happening on this team right now." Agents checking the team status always look here.

---

### 6.4 Role Change

**Scenario:** Xavier changes Sandy's role from reviewer to contributor because the team needs more implementation help, and brings in Amadeus as the new reviewer.

**Tool call:** `acp_send`

**Input JSON:**

```json
{
  "to": ["sandy", "amadeus"],
  "type": "team.role_change",
  "priority": "normal",
  "topic": "auth-refactor",
  "payload": {
    "teamspace_id": "auth-system-refactor",
    "changes": [
      {
        "agent_id": "sandy",
        "old_role": "reviewer",
        "new_role": "contributor",
        "reason": "Team needs more implementation capacity. Sandy has the TypeScript skills to help with JWT handler work."
      },
      {
        "agent_id": "amadeus",
        "old_role": "advisor",
        "new_role": "reviewer",
        "reason": "Amadeus picks up review duties. Architectural oversight remains via advisor → reviewer transition."
      }
    ],
    "effective_at": "2026-02-21T17:00:00Z"
  }
}
```

**Response JSON:**

```json
{
  "ok": true,
  "message_id": "acp-msg-01JMRNV2W3X4Y5Z6A7B8C9D0",
  "thread_id": "acp-thread-01JMRNRRRR000008",
  "role_changes_applied": [
    { "agent_id": "sandy", "old_role": "reviewer", "new_role": "contributor", "applied": true },
    { "agent_id": "amadeus", "old_role": "advisor", "new_role": "reviewer", "applied": true }
  ],
  "team_file_updated": "/Users/openclaw/.openclaw/workspace/_teams/auth-system-refactor/TEAM.md",
  "all_team_members_notified": true
}
```

**Annotation:** Role changes update both the SQLite `teamspace_members` table and the `TEAM.md` file. All team members are notified so everyone knows the current role assignments. This maps to Tim's TSP role rotation protocol (`role.rotate` event with outgoing + incoming ack).

---

### 6.5 Update Shared Artifact

**Scenario:** Roman updates a shared architecture document in the teamspace.

**Tool call:** `acp_team`

**Input JSON:**

```json
{
  "action": "artifact",
  "team": "auth-system-refactor",
  "path": "artifacts/auth-migration-plan.md",
  "description": "Migration plan for auth schema changes — updated with Phase 2 handler implementation details",
  "content": "# Auth Migration Plan\n\n## Phase 1: Schema Migration (COMPLETE)\n...\n## Phase 2: Handler Implementation (IN PROGRESS)\n..."
}
```

**Response JSON:**

```json
{
  "ok": true,
  "artifact_id": "acp-artifact-01JMROW3X4Y5Z6A7B8C9D0E1",
  "teamspace_id": "auth-system-refactor",
  "path": "artifacts/auth-migration-plan.md",
  "version": 3,
  "previous_version_archived": "/Users/openclaw/.openclaw/workspace/_teams/auth-system-refactor/archive/auth-migration-plan-v2.md",
  "modified_by": "roman",
  "modified_at": "2026-02-21T15:30:00Z",
  "auto_notification": {
    "type": "team.artifact_update",
    "delivered_to": ["xavier", "tim", "claire", "sandy", "amadeus"]
  }
}
```

**Annotation:** Artifact writes increment the version counter and archive the previous version. All team members are notified of the update. If two agents try to write the same artifact concurrently, the second write detects a version mismatch and creates a `.conflict` file for the coordinator to resolve.

---

### 6.6 Query Team State

**Scenario:** An agent wants to see the current state of the teamspace.

**Tool call:** `acp_team`

**Input JSON:**

```json
{
  "action": "query",
  "team": "auth-system-refactor"
}
```

**Response JSON:**

```json
{
  "ok": true,
  "teamspace": {
    "id": "auth-system-refactor",
    "name": "Auth System Refactor",
    "goal": "Replace JWT-only auth with hybrid session cookies (web) + JWT (API) architecture. Deliver migration-safe implementation with zero downtime.",
    "status": "active",
    "workspace_path": "/Users/openclaw/.openclaw/workspace/_teams/auth-system-refactor/",
    "created_by": "xavier",
    "created_at": "2026-02-21T14:00:00Z",
    "updated_at": "2026-02-21T16:00:00Z",
    "members": [
      { "agent_id": "xavier", "role": "coordinator", "status": "active", "joined_at": "2026-02-21T14:00:00Z" },
      { "agent_id": "tim", "role": "lead", "status": "active", "joined_at": "2026-02-21T14:00:00Z" },
      { "agent_id": "roman", "role": "contributor", "status": "busy", "joined_at": "2026-02-21T14:00:00Z" },
      { "agent_id": "claire", "role": "contributor", "status": "active", "joined_at": "2026-02-21T14:00:00Z" },
      { "agent_id": "sandy", "role": "contributor", "status": "active", "joined_at": "2026-02-21T14:00:00Z" },
      { "agent_id": "amadeus", "role": "reviewer", "status": "away", "joined_at": "2026-02-21T14:00:00Z" }
    ],
    "artifacts": [
      {
        "path": "artifacts/auth-migration-plan.md",
        "description": "Migration plan for auth schema changes",
        "last_modified_by": "roman",
        "last_modified_at": "2026-02-21T15:30:00Z",
        "version": 3
      },
      {
        "path": "artifacts/auth-architecture.md",
        "description": "Architecture overview for hybrid auth system",
        "last_modified_by": "tim",
        "last_modified_at": "2026-02-21T14:15:00Z",
        "version": 1
      }
    ],
    "active_work": [
      {
        "agent_id": "roman",
        "task": "Session cookie middleware",
        "status": "in_progress",
        "work_item": "openclaw/openclaw#195"
      },
      {
        "agent_id": "claire",
        "task": "JWT handler updates for dual-auth",
        "status": "blocked",
        "work_item": "openclaw/openclaw#196"
      }
    ],
    "decisions": [
      {
        "decision": "Session cookies for web clients, JWT for API/machine clients. Unified user_sessions table.",
        "made_by": "tim",
        "timestamp": "2026-02-21T14:30:00Z",
        "rationale": "Cookies provide httpOnly + CSRF protection for browsers. JWT is standard for M2M."
      }
    ],
    "recent_messages": 12,
    "active_blockers": 1
  }
}
```

**Annotation:** Team queries return the full teamspace state in a single call. This gives any agent (or human) a complete picture of the team: who's on it, what roles they have, what artifacts exist, what decisions have been made, and what work is active/blocked.

---

## 7. System Messages

### 7.1 System Ack — Already Claimed

**Scenario:** Claire tries to accept a task that Roman already claimed.

**Tool call:** `acp_respond` (Claire's attempt)

**Input JSON:**

```json
{
  "reply_to": "acp-msg-01JMR2B3C4D5E6F7G8H9J0K1",
  "type": "task.accept",
  "payload": {
    "offer_id": "acp-msg-01JMR2B3C4D5E6F7G8H9J0K1",
    "estimated_completion": "2026-02-22T12:00:00Z"
  }
}
```

**Response JSON:**

```json
{
  "ok": false,
  "error": "already_claimed",
  "message_id": "acp-msg-01JMRPX4Y5Z6A7B8C9D0E1F2",
  "thread_id": "acp-thread-01JMR2LLLL000002",
  "detail": "This task was already accepted by roman at 2026-02-21T15:30:00Z.",
  "claimed_by": "roman",
  "claimed_at": "2026-02-21T15:30:00Z"
}
```

**Annotation:** First-responder semantics for task claims. When a task is offered to multiple agents, the first `task.accept` wins. Subsequent accepts get an `already_claimed` error with information about who claimed it. This prevents duplicate work.

---

### 7.2 System Error — Rate Limited

**Scenario:** An agent hits the broadcast rate limit.

**Tool call:** `acp_broadcast` (the blocked call)

**Input JSON:**

```json
{
  "type": "status.update",
  "topic": "auth-refactor",
  "priority": "normal",
  "payload": {
    "summary": "Minor progress update..."
  }
}
```

**Response JSON:**

```json
{
  "ok": false,
  "error": "rate_limited",
  "message_id": null,
  "detail": "Broadcast rate limit exceeded. Maximum 5 broadcasts per hour. You have sent 5 broadcasts in the current window.",
  "rate_limit": {
    "type": "broadcasts_per_hour",
    "limit": 5,
    "current": 5,
    "window_resets_at": "2026-02-21T17:00:00Z",
    "retry_after_seconds": 1200
  }
}
```

**Annotation:** Rate limit errors are informative — they tell the agent exactly what limit they hit, how many they've used, and when they can try again. This prevents runaway message storms while keeping agents informed.

---

### 7.3 System Error — Circuit Breaker Tripped

**Scenario:** An agent enters a messaging loop and gets temporarily suspended.

**Response JSON (unsolicited delivery to the agent):**

```json
{
  "type": "system.error",
  "message_id": "acp-msg-01JMRQY5Z6A7B8C9D0E1F2G3",
  "from": "acp-system",
  "payload": {
    "error": "circuit_breaker_tripped",
    "detail": "You sent 4 messages of type 'task.request' to 'roman' within 60 seconds. This pattern indicates a potential messaging loop. ACP communication is suspended for 5 minutes.",
    "suspended_until": "2026-02-21T17:35:00Z",
    "trip_count_today": 1,
    "max_trips_before_full_suspension": 3,
    "coordinator_notified": "merlin"
  }
}
```

**Annotation:** Circuit breakers are a safety mechanism. Detection: >3 messages with the same `type` and `to` within 60 seconds. After 3 trips in a day, the agent is suspended from ACP until manual review. The coordinator (Merlin) is always notified so there's human/senior oversight.

---

## 8. Subscription Management

### 8.1 Subscribe to Topics

**Scenario:** Xavier subscribes to all blocked statuses from his team.

**Tool call:** `acp_subscribe`

**Input JSON:**

```json
{
  "filter": {
    "teams": ["auth-system-refactor", "platform-core"],
    "types": ["status.blocked", "position.escalate"],
    "priority_min": "normal"
  },
  "delivery": "session"
}
```

**Response JSON:**

```json
{
  "ok": true,
  "subscription_id": 42,
  "subscriber": "xavier",
  "filter": {
    "teams": ["auth-system-refactor", "platform-core"],
    "types": ["status.blocked", "position.escalate"],
    "priority_min": "normal"
  },
  "delivery": "session",
  "active": true,
  "created_at": "2026-02-21T14:00:00Z"
}
```

**Annotation:** Subscriptions persist across sessions. Xavier will receive matching messages whenever they're broadcast, without having to be explicitly included in the `to` field. This enables coordinators to stay informed without every sender needing to remember to include them.

---

### 8.2 Subscribe to Agent Activity

**Scenario:** Sandy subscribes to all artifact updates in her review queue.

**Tool call:** `acp_subscribe`

**Input JSON:**

```json
{
  "filter": {
    "types": ["team.artifact_update", "status.complete"],
    "teams": ["auth-system-refactor"],
    "from_agents": ["roman", "claire"]
  },
  "delivery": "inbox"
}
```

**Response JSON:**

```json
{
  "ok": true,
  "subscription_id": 43,
  "subscriber": "sandy",
  "filter": {
    "types": ["team.artifact_update", "status.complete"],
    "teams": ["auth-system-refactor"],
    "from_agents": ["roman", "claire"]
  },
  "delivery": "inbox",
  "active": true,
  "created_at": "2026-02-21T14:05:00Z"
}
```

**Annotation:** Sandy subscribes to artifact updates and completion statuses from the agents whose work she reviews. She chose `inbox` delivery so she can batch-process reviews rather than being interrupted live.

---

## 9. Inbox Query

### 9.1 Check Pending Messages

**Scenario:** Claire wakes up at the start of a new session and checks her ACP inbox.

**Tool call:** `acp_inbox`

**Input JSON:**

```json
{
  "limit": 10,
  "types": ["task.request", "task.offer", "handoff.initiate", "knowledge.push"],
  "since": "2026-02-21T08:00:00Z"
}
```

**Response JSON:**

```json
{
  "ok": true,
  "agent": "claire",
  "pending_count": 3,
  "messages": [
    {
      "id": "acp-msg-01JMR7G8H9J0K1L2M3N4O5P7",
      "type": "handoff.initiate",
      "from": "roman",
      "priority": "normal",
      "topic": "user-sessions-data-quality",
      "timestamp": "2026-02-21T16:30:00Z",
      "summary": "Handoff: Continue: Fix NULL last_active_at in user_sessions + add constraint",
      "requires_response": true,
      "context_file": "/Users/openclaw/.openclaw/workspace/claire/acp-handoff-01JMR7G8H9J0K1L2M3N4O5P6.md"
    },
    {
      "id": "acp-msg-01JMREM3N4O5P6Q7R8S9T0U1",
      "type": "knowledge.push",
      "from": "drew",
      "priority": "high",
      "topic": "user-sessions-data-quality",
      "timestamp": "2026-02-21T10:00:00Z",
      "summary": "12% of rows in user_sessions have NULL last_active_at. This causes incorrect session expiry calculations.",
      "requires_response": false
    },
    {
      "id": "acp-msg-01JMR1A2B3C4D5E6F7G8H9J0",
      "type": "task.offer",
      "from": "tim",
      "priority": "normal",
      "topic": "auth-refactor",
      "timestamp": "2026-02-21T09:00:00Z",
      "summary": "Review auth migration SQL schema",
      "requires_response": true,
      "status": "claimed_by_other",
      "claimed_by": "roman"
    }
  ]
}
```

**Annotation:** The inbox query is the first thing an agent does when it wakes up. It returns pending messages sorted by priority and recency. Messages already claimed by other agents are marked as such so the agent doesn't waste time trying to accept them. The `context_file` path for handoffs points to the full human-readable context bundle.

---

## 10. Full End-to-End Flow

### Scenario: Bug Discovery → Knowledge Push → Task Negotiation → Work → Handoff → Completion

This section shows the complete message sequence for a realistic multi-agent workflow.

**Step 1: Drew discovers a bug and pushes knowledge**

```
Tool: acp_send
From: drew
```
```json
{
  "to": ["tim", "xavier"],
  "type": "knowledge.push",
  "priority": "high",
  "topic": "session-expiry-bug",
  "payload": {
    "topic": "Session expiry query skips NULL last_active_at rows",
    "summary": "The session cleanup cron job uses WHERE last_active_at < threshold, which silently skips 14K rows with NULL values. These sessions never expire, creating a potential security issue.",
    "confidence": "high",
    "actionable": true,
    "suggested_action": "Fix the query to handle NULLs AND backfill the NULL values."
  }
}
```

**Step 2: Tim creates a task request**

```
Tool: acp_send
From: tim
```
```json
{
  "to": ["roman", "claire"],
  "type": "task.request",
  "priority": "high",
  "topic": "session-expiry-bug",
  "payload": {
    "title": "Fix session expiry bug — NULL last_active_at handling",
    "description": "1) Fix the session cleanup query to handle NULLs safely (COALESCE or IS NULL check). 2) Backfill 14K NULL values. 3) Add NOT NULL constraint to prevent recurrence.",
    "required_capabilities": ["sql", "typescript", "migrations"],
    "estimated_effort": "PT4H",
    "deadline": "2026-02-22T00:00:00Z",
    "acceptance_criteria": [
      "Cleanup query handles NULLs correctly",
      "All NULL values backfilled",
      "NOT NULL constraint added",
      "Existing tests updated, new tests added",
      "PR submitted"
    ],
    "work_item": "openclaw/openclaw#187"
  }
}
```

**Step 3: Roman counter-proposes (wants to split the work)**

```
Tool: acp_respond
From: roman
```
```json
{
  "reply_to": "<tim's-message-id>",
  "type": "task.counter",
  "payload": {
    "offer_id": "<tim's-message-id>",
    "proposed_changes": "I'll take the backfill + constraint migration. Claire is better suited for the query fix since she's already working on the JWT handlers and knows the session code. Splitting reduces risk of one person touching too many things.",
    "revised_scope": "Backfill NULL values + add NOT NULL constraint + migration tests",
    "revised_effort": "PT2H",
    "conditions": ["Claire handles the cleanup query fix separately"]
  }
}
```

**Step 4: Tim accepts the split**

```
Tool: acp_respond
From: tim
```
```json
{
  "reply_to": "<roman's-counter-id>",
  "type": "task.accept",
  "payload": {
    "offer_id": "<tim's-original-id>",
    "notes": "Good split. Roman takes migration, I'll create a separate task for Claire on the query fix."
  }
}
```

**Step 5: Roman works, then hands off to Claire at shift change**

```
Tool: acp_handoff
From: roman
```
```json
{
  "to": "claire",
  "title": "Continue: Session NULL backfill migration",
  "reason": "shift_change",
  "context_bundle": {
    "state_summary": "Backfill UPDATE is written and passes local tests. NOT NULL ALTER TABLE is commented out pending final verification. Need to uncomment, test, and submit PR.",
    "decisions_made": [
      {
        "decision": "Use created_at as fallback for NULL last_active_at",
        "reasoning": "Most conservative estimate",
        "timestamp": "2026-02-21T14:30:00Z",
        "reversible": true
      }
    ],
    "open_questions": [],
    "artifacts": [
      {
        "ref": { "type": "file", "path": "/worktrees/roman-187/migrations/20260221_backfill.sql" },
        "status": "modified",
        "notes": "Backfill done, constraint commented out"
      }
    ],
    "work_item": "openclaw/openclaw#187",
    "branch": "roman/187-session-nulls",
    "worktree_path": "/worktrees/roman-187",
    "test_status": "passing",
    "stakeholders": [
      { "agent_id": "tim", "role": "requester", "expectations": "PR by EOD" }
    ],
    "risks": ["Table under write load — consider off-peak deployment"],
    "pitfalls": ["Don't add constraint before backfill completes"],
    "gotchas": ["Test fixture has intentional NULLs — update after migration tests pass"],
    "next_steps": [
      { "step": "Uncomment NOT NULL constraint", "priority": "must" },
      { "step": "Run full test suite", "priority": "must" },
      { "step": "Submit PR, tag Tim", "priority": "must" }
    ]
  }
}
```

**Step 6: Claire accepts the handoff**

```
Tool: acp_respond
From: claire
```
```json
{
  "reply_to": "<roman's-handoff-id>",
  "type": "handoff.accept",
  "payload": {
    "handoff_id": "<handoff-id>",
    "confirmation": "Context reviewed. Backfill looks good. I'll finish the constraint, run tests, and submit the PR.",
    "revised_timeline": "2026-02-21T20:00:00Z"
  }
}
```

**Step 7: Claire completes and broadcasts**

```
Tool: acp_broadcast
From: claire
```
```json
{
  "type": "status.complete",
  "topic": "session-expiry-bug",
  "priority": "normal",
  "filter": { "team": "auth-system-refactor" },
  "payload": {
    "summary": "Session NULL backfill migration complete. NOT NULL constraint added. All tests passing. PR #48 submitted, tagged Tim for review.",
    "work_item": "openclaw/openclaw#187",
    "progress_pct": 100,
    "artifacts_changed": [
      { "type": "pr", "path": "openclaw/openclaw#48", "description": "Fix NULL last_active_at + add constraint" }
    ]
  }
}
```

**This flow demonstrates:** knowledge push → task request → counter-proposal → acceptance → work → handoff → completion. Every step is typed, auditable, and machine-parseable.

---

## Appendix A: Tim's THP/TSP Mapping

This table maps payloads in this document to Tim's protocol layers for cross-reference:

| This Document Section | Tim's Protocol | Tim's Spec Section |
|---|---|---|
| §1 Task Negotiation | A2M v1 (request/offer/accept/decline/counter) | §6 A2M v1 |
| §2 Task Handoff | THP v1 (handoff package + state machine) | §7 THP v1 |
| §3 Status Updates | A2M v1 (status type) | §6.2 Message types |
| §4 Knowledge Push | A2M v1 (knowledge type) | §6.2 Message types |
| §5 Disagreement | A2M v1 (decision/escalation types) | §6.2 Message types |
| §6 Teamspace | TSP v1 (manifest + roles + artifacts) | §8 TSP v1 |
| Handoff rejection codes | THP v1 rejection contract | §7.5 Rejection contract |
| Artifact versioning | TSP v1 artifact identity | §10 Artifact Versioning |
| Role assignment | TSP v1 canonical roles | §9 Roles |

## Appendix B: Quick Reference — Tool Calls

| Tool | Purpose | Key Payload Sections |
|---|---|---|
| `acp_send` | Send typed message to specific agent(s) | §1.1, §1.2, §4.1, §4.2, §5.1, §6.4 |
| `acp_respond` | Reply to a received message | §1.3, §1.4, §1.5, §1.6, §2.2, §2.3, §2.4, §4.3, §5.2, §5.3, §5.4 |
| `acp_broadcast` | Broadcast to subscribers/team | §3.1, §3.2, §3.3 |
| `acp_handoff` | Initiate structured task handoff | §2.1 |
| `acp_team` | Manage teamspaces | §6.1, §6.2, §6.3, §6.5, §6.6 |
| `acp_subscribe` | Subscribe to message types/topics | §8.1, §8.2 |
| `acp_inbox` | Read pending messages | §9.1 |
| `acp_query` | Query message history | (not shown — uses same filter structure as §8) |

---

*These sample payloads are the canonical reference for ACP implementation. Every tool call, input structure, and response format shown here is what the implemented extension must produce. When in doubt, match these payloads exactly.*

— Amadeus, Chief AI Officer  
2026-02-21
