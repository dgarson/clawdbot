# Agent-to-Agent (A2A) Communication Protocol — Implementation Spec

**Date:** 2026-02-21
**Owner:** Amadeus (CAIO)
**Requested by:** David (CEO) via Merlin
**Priority:** P0 — Start immediately

---

## 1. Overview

Build a first-class **Agent-to-Agent Communication Protocol** for OpenClaw — a structured, typed messaging system that enables agents to coordinate directly with each other through defined message types: task requests, status updates, knowledge sharing, and structured negotiation.

This is the foundational primitive that makes our multi-agent platform a *platform* rather than a collection of individual agents. Without this, agents coordinate through shared files and hope. With this, they can actively collaborate.

## 2. Goals

1. **Structured peer-to-peer messaging** between agents (not just parent→child via sub-agents)
2. **Typed message schemas** with validation — agents send well-formed, parseable messages
3. **Task lifecycle support** — request, accept, decline, progress, complete, fail
4. **Knowledge broadcasting** — one agent can share discoveries with relevant peers
5. **Human visibility** — all inter-agent communication is logged and auditable
6. **Rate limiting & circuit breakers** — prevent message storms and infinite loops
7. **Integration with existing session infrastructure** — build on `sessions_send`, don't reinvent

## 3. Architecture

### 3.1 Message Schema (Core)

Every A2A message follows this schema:

```json
{
  "protocol": "openclaw.a2a.v1",
  "messageId": "uuid-v7",
  "timestamp": "2026-02-21T18:30:00.000Z",
  "from": {
    "agentId": "roman",
    "role": "Staff Engineer",
    "sessionKey": "agent:roman:cron:..."
  },
  "to": {
    "agentId": "tim",
    "role": "VP Architecture"
  },
  "type": "task_request | task_response | status_update | knowledge_share | review_request | review_response | broadcast",
  "priority": "low | normal | high | urgent",
  "correlationId": "uuid-v7 (links related messages in a conversation thread)",
  "payload": { }
}
```

### 3.2 Message Types & Payloads

#### `task_request`
```json
{
  "type": "task_request",
  "payload": {
    "taskId": "uuid-v7",
    "title": "Implement A2A message validator",
    "description": "Build the JSON schema validator for A2A messages per spec at /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md",
    "taskType": "implementation | review | research | analysis | design",
    "complexity": "trivial | low | medium | high | expert",
    "deadline": "2026-02-22T00:00:00Z (optional)",
    "context": {
      "branch": "amadeus/a2a-protocol-validator",
      "worktree": "/Users/openclaw/openclaw/worktrees/a2a-protocol-validator",
      "relatedFiles": [
        "/Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md"
      ]
    },
    "acceptanceCriteria": [
      "All message types validate correctly",
      "Invalid messages return descriptive errors",
      "100% test coverage on validator"
    ]
  }
}
```

#### `task_response`
```json
{
  "type": "task_response",
  "payload": {
    "taskId": "uuid-v7 (references the task_request)",
    "action": "accepted | declined | completed | failed | blocked",
    "reason": "string (required for declined/failed/blocked)",
    "result": {
      "branch": "roman/a2a-validator-impl",
      "worktree": "/Users/openclaw/openclaw/worktrees/a2a-validator-impl",
      "filesChanged": [
        "/Users/openclaw/openclaw/worktrees/a2a-validator-impl/src/gateway/a2a/validator.ts",
        "/Users/openclaw/openclaw/worktrees/a2a-validator-impl/test/a2a/validator.test.ts"
      ],
      "summary": "Implemented JSON schema validation for all 7 message types. 42 tests, all passing.",
      "nextSteps": ["Needs T2+ review", "Integration test pending"]
    }
  }
}
```

#### `review_request`
```json
{
  "type": "review_request",
  "payload": {
    "taskId": "uuid-v7",
    "title": "Review: A2A message validator implementation",
    "branch": "roman/a2a-validator-impl",
    "worktree": "/Users/openclaw/openclaw/worktrees/a2a-validator-impl",
    "filesForReview": [
      "/Users/openclaw/openclaw/worktrees/a2a-validator-impl/src/gateway/a2a/validator.ts",
      "/Users/openclaw/openclaw/worktrees/a2a-validator-impl/test/a2a/validator.test.ts"
    ],
    "authorAgent": "roman",
    "authorTier": "T3-Staff",
    "reviewLevel": "T2+ (Bridge/Staff)",
    "priorReviewNotes": "string (optional — notes from a previous review cycle)"
  }
}
```

#### `review_response`
```json
{
  "type": "review_response",
  "payload": {
    "taskId": "uuid-v7",
    "verdict": "approved | changes_requested | escalated",
    "branch": "roman/a2a-validator-impl",
    "worktree": "/Users/openclaw/openclaw/worktrees/a2a-validator-impl",
    "reviewerFixes": [
      {
        "file": "/Users/openclaw/openclaw/worktrees/a2a-validator-impl/src/gateway/a2a/validator.ts",
        "description": "Fixed edge case in array type coercion (line 47)"
      }
    ],
    "unresolvedConcerns": [
      {
        "file": "/path/to/file",
        "line": 23,
        "severity": "must_fix | should_fix | suggestion",
        "description": "Missing null check on correlationId"
      }
    ],
    "nextAction": "send_back_to_worker | push_and_close | escalate_to_senior",
    "nextTasks": [
      {
        "title": "Implement A2A message router",
        "assignTo": "suggested agent or tier",
        "dependencies": ["this task must complete first"]
      }
    ]
  }
}
```

#### `status_update`
```json
{
  "type": "status_update",
  "payload": {
    "taskId": "uuid-v7 (optional — can be general status)",
    "status": "in_progress | blocked | completed | paused",
    "progress": "string describing current state",
    "blockedBy": "string (if blocked — what's the blocker)",
    "estimatedCompletion": "ISO timestamp (optional)"
  }
}
```

#### `knowledge_share`
```json
{
  "type": "knowledge_share",
  "payload": {
    "topic": "string (brief topic label)",
    "discovery": "string (what was learned/found)",
    "relevantTo": ["agentId1", "agentId2"] ,
    "source": "string (how this was discovered — session, research, code review, etc.)",
    "actionable": true,
    "suggestedAction": "string (optional — what to do with this knowledge)"
  }
}
```

#### `broadcast`
```json
{
  "type": "broadcast",
  "payload": {
    "scope": "squad | org | c-suite",
    "topic": "string",
    "message": "string",
    "urgency": "fyi | attention_needed | action_required"
  }
}
```

## 4. Implementation Components (Parallel Workstreams)

### Workstream A: Schema & Validation Layer
- **What:** TypeScript types + JSON Schema definitions + validator module
- **Output:** `src/gateway/a2a/schema.ts`, `src/gateway/a2a/validator.ts`
- **Tests:** Full coverage — valid messages pass, invalid ones fail with descriptive errors
- **Complexity:** Medium
- **Can start:** Immediately (no dependencies)

### Workstream B: Message Router & Delivery
- **What:** Module that receives A2A messages, validates them, routes to the target agent's session, and logs the exchange
- **Output:** `src/gateway/a2a/router.ts`, `src/gateway/a2a/delivery.ts`
- **Integration:** Hooks into existing `sessions_send` infrastructure
- **Includes:** Rate limiting (per-agent, per-minute), circuit breaker (detect loops), delivery confirmation
- **Complexity:** High
- **Can start:** After Workstream A schema is defined (needs types), but design can begin immediately

### Workstream C: Agent-Side SDK (Send/Receive Helpers)
- **What:** Helper functions agents use to construct and send A2A messages, and to parse incoming ones
- **Output:** `src/gateway/a2a/sdk.ts` — functions like `sendTaskRequest()`, `sendReviewRequest()`, `parseA2AMessage()`
- **Includes:** Convenience methods that enforce the schema, auto-populate `from` fields, generate UUIDs
- **Complexity:** Medium
- **Can start:** After Workstream A types are defined

### Workstream D: Audit Log & Human Visibility
- **What:** All A2A messages are logged to a structured audit trail. Humans can query/view inter-agent communication.
- **Output:** `src/gateway/a2a/audit.ts`, log format spec
- **Includes:** JSONL log files at `~/.openclaw/a2a-log/`, CLI command `openclaw a2a log [--agent <id>] [--type <type>] [--since <timestamp>]`
- **Complexity:** Medium
- **Can start:** Immediately (no dependencies on other workstreams)

### Workstream E: Integration Tests & End-to-End Validation
- **What:** Full integration tests that simulate multi-agent communication flows
- **Output:** `test/a2a/integration/` test suite
- **Scenarios:** Task request→accept→complete, review cycle with send-back, knowledge broadcast, rate limit trigger, circuit breaker activation
- **Complexity:** Medium-High
- **Can start:** After Workstreams A+B have initial implementations

### Dependency Graph:
```
Workstream A (Schema)  ──→  Workstream B (Router)  ──→  Workstream E (Integration Tests)
         │                                                        ↑
         └──→  Workstream C (SDK)  ─────────────────────────────→─┘
                                                                  ↑
Workstream D (Audit)  ───────────────────────────────────────────→─┘
```

**Parallel opportunities:**
- A and D can start simultaneously
- B design can start while A is being implemented
- C can start as soon as A's types are merged
- E waits for A+B but test scenario design can begin immediately

## 5. Worker → Reviewer Assignments

Use the existing tier structure from WORK_PROTOCOL.md:

| Workstream | Implementor(s) | Reviewer | Escalation |
|-----------|-----------------|----------|------------|
| A: Schema | Roman (T3-Staff) or Sandy/Tony (T2-Senior) | Tim (T1-VP Arch) | Xavier (CTO) |
| B: Router | Roman (T3-Staff) + Tony (T2-Senior) | Tim (T1-VP Arch) | Amadeus (CAIO) |
| C: SDK | Sandy (T2-Senior) or Claire (T3-Staff) | Amadeus (CAIO) | Xavier (CTO) |
| D: Audit | Barry or Jerry (T4-Mid) | Claire (T3-Staff) | Tim (T1-VP Arch) |
| E: Integration | Claire (T3-Staff) + Jerry (T4-Mid) | Tim (T1-VP Arch) | Amadeus (CAIO) |

## 6. Review & Feedback Loop

Per the updated WORK_PROTOCOL.md Section 7 (Worktree Handoff Protocol):

1. Worker implements in their own worktree/branch
2. Worker sends handoff with: branch, worktree path, files changed, status
3. Reviewer reviews in that worktree
4. Reviewer either:
   - (a) Makes low-complexity fixes directly, pushes, marks done, kicks off next task
   - (b) Sends back with specific feedback + branch/worktree info for worker to address
5. Cycle continues until reviewer approves
6. On approval: reviewer pushes branch, identifies next task(s), ensures they start immediately

## 7. Success Criteria

1. **Schema completeness:** All 7 message types have TypeScript types + JSON Schema + validator coverage
2. **Router reliability:** Messages are delivered correctly, rate-limited, with circuit breaker protection
3. **SDK usability:** Any agent can send/receive A2A messages using simple function calls
4. **Auditability:** All messages are logged and queryable
5. **Test coverage:** >90% unit test coverage, integration tests for all major flows
6. **Documentation:** Architecture doc, API reference, and usage examples for agents

## 8. Timeline Target

- **Day 1-2:** Schema + Audit (Workstreams A, D) — parallel
- **Day 2-3:** Router + SDK (Workstreams B, C) — parallel after A
- **Day 3-4:** Integration tests + polish (Workstream E)
- **Day 4:** Final review pass, documentation, merge readiness

---

*This spec is the source of truth. All implementation work should reference it by path:*
`/Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md`
