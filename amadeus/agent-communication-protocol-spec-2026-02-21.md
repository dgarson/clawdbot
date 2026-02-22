# Agent Communication Protocol (ACP) — Full Specification

**File:** `/Users/openclaw/.openclaw/workspace/amadeus/agent-communication-protocol-spec-2026-02-21.md`  
**Date:** 2026-02-21  
**Author:** Amadeus (Chief AI Officer)  
**Commissioned by:** David (CEO)  
**Status:** Draft v1.0 — For Review  

**Cross-references:**
- Amadeus Idea #8: Inter-Agent Communication Protocol / Structured Negotiation (`/Users/openclaw/.openclaw/workspace/amadeus/brainstorm-roadmap-2026-02-21.md`)
- Tim Idea #10: Multi-Agent Teamspaces with Roles, Handoffs, Shared Artifacts (`/Users/openclaw/.openclaw/workspace/tim/brainstorm-roadmap-2026-02-21.md`)
- Luis Idea #2: Agent Relationship Visualization & Topology View (`/Users/openclaw/.openclaw/workspace/luis/brainstorm-roadmap-2026-02-21.md`)
- Luis Idea #4: Real-Time Agent Activity Dashboard / Mission Control
- Existing `workq` extension architecture (`/Users/openclaw/.openclaw/workspace/_shared/specs/workq-architecture.md`)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Philosophy & Constraints](#2-design-philosophy--constraints)
3. [Architecture Overview](#3-architecture-overview)
4. [ACP Message Schema](#4-acp-message-schema)
5. [Communication Patterns](#5-communication-patterns)
6. [Negotiation Protocol](#6-negotiation-protocol)
7. [Status Broadcasting](#7-status-broadcasting)
8. [Knowledge Push Protocol](#8-knowledge-push-protocol)
9. [Constructive Disagreement Protocol](#9-constructive-disagreement-protocol)
10. [Task Handoff Protocol](#10-task-handoff-protocol)
11. [Agent Teamspaces](#11-agent-teamspaces)
12. [Integration with Existing Architecture](#12-integration-with-existing-architecture)
13. [Safety, Rate Limiting & Human Oversight](#13-safety-rate-limiting--human-oversight)
14. [Example Flows](#14-example-flows)
15. [Phasing Plan](#15-phasing-plan)
16. [Dependency Analysis](#16-dependency-analysis)
17. [Open Questions & Future Work](#17-open-questions--future-work)

---

## 1. Executive Summary

The Agent Communication Protocol (ACP) is a structured, layered system for agent-to-agent communication, task negotiation, knowledge sharing, and coordinated handoff within the OpenClaw platform. It is designed to be **minimally invasive** — layered entirely on top of existing infrastructure (sessions, messaging, workspaces, spawn/sub-agent) — while enabling dramatically richer multi-agent coordination.

### What ACP Enables

| Capability | Today | With ACP |
|---|---|---|
| Agent-to-agent messaging | Indirect (shared files, sub-agent reports) | Direct, typed, routable messages with schemas |
| Task negotiation | Manual (human assigns tasks) | Structured offer/accept/decline with capability matching |
| Status sharing | Per-agent memory files, opaque to peers | Typed broadcast events, subscribable by any agent |
| Knowledge transfer | Write to `_shared/` and hope others read it | Push-based knowledge delivery to relevant recipients |
| Disagreement | Not supported | Structured counter-proposals with evidence |
| Task handoff | Lossy (restart with new agent) | Lossless state transfer with context, artifacts, and audit trail |
| Team coordination | Flat org chart + ad hoc spawning | Persistent teamspaces with roles, shared state, and artifact versioning |

### Core Principles

1. **Layer, don't replace.** ACP sits on top of existing sessions, messages, and workspaces. No core refactoring required.
2. **Structured by default.** Every message has a typed envelope. Free-form text is a payload inside structure, never the structure itself.
3. **Human-visible.** Every ACP message is inspectable by humans. No opaque agent-to-agent channels.
4. **Push-based, not poll-based.** Agents receive messages; they don't poll shared files for changes.
5. **Opt-in complexity.** Agents can participate at any sophistication level — from "I can receive task requests" to full negotiation.
6. **Cost-aware.** Protocol interactions are cheap. An ACP message should never require a full Opus reasoning turn to parse.

---

## 2. Design Philosophy & Constraints

### 2.1 Minimal Invasiveness Requirement

David's directive is explicit: **layer on top of what we have**. The existing OpenClaw architecture provides:

| Existing Primitive | What It Gives Us |
|---|---|
| **Sessions** (`sessions_spawn`, `sessions_list`, `sessions_history`) | Agent execution contexts, parent/child relationships |
| **Messaging** (`message` tool — Slack, Discord, etc.) | Cross-channel delivery, threading, persistence |
| **Workspaces** (`~/.openclaw/workspace/<agent>/`) | Per-agent file storage, shared directories |
| **Sub-agents** (spawn/subagent infra) | Hierarchical task delegation, auto-announce on completion |
| **Extensions** (plugin SDK — see `workq` pattern) | Registereable tools, CLI commands, services |
| **`_shared/` directory** | Cross-agent file sharing |
| **Agent identity files** (`AGENTS.md`, `SOUL.md`) | Agent capabilities, roles, behaviors |

**ACP does not modify any of these.** It is implemented as an OpenClaw extension (`acp`) that registers tools agents can call, backed by a lightweight persistence layer.

### 2.2 Design Constraints

1. **No new daemon processes.** ACP runs within the existing Gateway process as an extension.
2. **No new network protocols.** Messages route through existing session/message infrastructure.
3. **No agent identity changes.** Agents remain who they are. ACP adds communication capabilities, not new identities.
4. **SQLite for persistence.** Following the `workq` pattern — proven, concurrency-safe, zero-dependency.
5. **Extension-first.** ACP ships as `~/.openclaw/extensions/acp/`, installable via `openclaw ext install acp`.
6. **Progressive adoption.** Agents that don't opt into ACP continue to work exactly as they do today.

### 2.3 Cost Model

Every ACP interaction has a cost. The protocol is designed so that:

- **Receiving a message** = injecting a small structured payload into the agent's next turn (low cost, < 500 tokens).
- **Sending a message** = one tool call from the sending agent (already part of a reasoning turn).
- **Negotiation rounds** = bounded by protocol (max 3 rounds per negotiation by default).
- **Status broadcasts** = fire-and-forget; recipients process asynchronously on their next wake.
- **Knowledge pushes** = delivered as compact summaries with optional deep-link to full artifacts.

No ACP operation should require spawning a new session or making an additional LLM API call beyond what the agent was already doing.

---

## 3. Architecture Overview

### 3.1 System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        OpenClaw Gateway                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   ACP Extension                           │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │  ACP Tools   │  │  ACP Router   │  │  ACP Delivery  │  │   │
│  │  │              │  │              │  │                │  │   │
│  │  │ acp_send     │  │ Topic subs   │  │ Session inject │  │   │
│  │  │ acp_query    │  │ Agent routes │  │ Channel notify │  │   │
│  │  │ acp_respond  │  │ Team routes  │  │ Workspace file │  │   │
│  │  │ acp_broadcast│  │ Broadcast    │  │                │  │   │
│  │  │ acp_handoff  │  │              │  │                │  │   │
│  │  │ acp_team     │  │              │  │                │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  │                                                           │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │              ACP Persistence (SQLite)              │    │   │
│  │  │                                                    │    │   │
│  │  │  messages │ negotiations │ handoffs │ teamspaces   │    │   │
│  │  │  subscriptions │ agent_capabilities │ delivery_log │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │   Sessions    │  │  Messaging   │  │    Workspaces      │    │
│  │  (existing)   │  │  (existing)  │  │    (existing)      │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Components

| Component | Responsibility |
|---|---|
| **ACP Tools** | Agent-facing tool API (registered via plugin SDK) |
| **ACP Router** | Resolves message recipients from topics, teams, capabilities |
| **ACP Delivery** | Gets messages to recipients (session injection, channel notification, workspace file) |
| **ACP Persistence** | SQLite database for messages, negotiations, handoffs, teamspaces |

### 3.3 Delivery Mechanisms

ACP uses a **multi-channel delivery strategy** to reach agents regardless of their current state:

| Delivery Channel | When Used | Mechanism |
|---|---|---|
| **Session Injection** | Agent has an active session | Inject ACP message as a system message into the agent's next turn |
| **Inbox File** | Agent is offline / between sessions | Write to `~/.openclaw/workspace/<agent>/acp-inbox.md` for pickup on next wake |
| **Channel Notification** | Urgent / human-visible | Post to a designated ACP channel (e.g., `#acp-bus` in Slack) |
| **Wake Trigger** | Agent is idle and message is urgent | Trigger agent heartbeat/cron to process the message |

**Priority determines delivery urgency:**

| Priority | Delivery |
|---|---|
| `low` | Inbox file only — processed on next natural wake |
| `normal` | Inbox file + session injection if active |
| `high` | Session injection + channel notification + wake trigger if needed |
| `critical` | All channels + immediate wake trigger + human notification |

---

## 4. ACP Message Schema

### 4.1 Core Envelope

Every ACP message conforms to this envelope schema. It is the universal wire format for all agent-to-agent communication.

```typescript
interface ACPMessage {
  // === Identity ===
  id: string;                    // UUID v7 (time-sortable)
  version: "acp/1.0";           // Protocol version
  
  // === Routing ===
  from: string;                  // Sender agent ID (e.g., "amadeus")
  to: string | string[];         // Recipient agent ID(s), or "*" for broadcast
  team?: string;                 // Team/teamspace context (if applicable)
  reply_to?: string;             // ID of message being replied to
  thread_id?: string;            // Conversation thread ID (groups related messages)
  
  // === Classification ===
  type: ACPMessageType;          // Message type (see §4.2)
  topic?: string;                // Semantic topic tag (e.g., "auth-refactor", "q1-planning")
  priority: "low" | "normal" | "high" | "critical";
  
  // === Payload ===
  payload: ACPPayload;           // Type-specific payload (see §4.3)
  
  // === Metadata ===
  timestamp: string;             // ISO 8601 UTC
  expires_at?: string;           // ISO 8601 UTC — message is void after this time
  requires_response?: boolean;   // Hint that sender expects a reply
  max_response_time?: string;    // ISO 8601 duration (e.g., "PT1H" = 1 hour)
  
  // === Context ===
  context?: {
    session_id?: string;         // Originating session
    work_item?: string;          // Associated workq issue_ref
    artifacts?: ACPArtifactRef[]; // Referenced files/resources
  };
}
```

### 4.2 Message Types

```typescript
type ACPMessageType =
  // --- Task Negotiation ---
  | "task.offer"            // "I have work available, who can take it?"
  | "task.request"          // "I need someone to do X"
  | "task.accept"           // "I'll take that"
  | "task.decline"          // "I can't take that (with reason)"
  | "task.counter"          // "I can do a modified version of that"
  
  // --- Task Handoff ---
  | "handoff.initiate"      // "I'm passing this work to you"
  | "handoff.accept"        // "I've received the handoff"
  | "handoff.reject"        // "I can't accept this handoff (with reason)"
  | "handoff.complete"      // "Handoff fully transferred and confirmed"
  
  // --- Status ---
  | "status.update"         // "Here's what I'm doing"
  | "status.blocked"        // "I'm stuck on X"
  | "status.complete"       // "I finished X"
  | "status.progress"       // "X is N% done"
  
  // --- Knowledge ---
  | "knowledge.push"        // "I discovered something you should know"
  | "knowledge.query"       // "Do you know anything about X?"
  | "knowledge.response"    // "Here's what I know about X"
  
  // --- Disagreement ---
  | "position.state"        // "I believe X because Y"
  | "position.challenge"    // "I disagree with X because Z"
  | "position.concede"      // "I'm convinced, updating my position"
  | "position.escalate"     // "We can't resolve this, escalating to human/senior"
  
  // --- Team ---
  | "team.join"             // "I'm joining this teamspace"
  | "team.leave"            // "I'm leaving this teamspace"
  | "team.role_change"      // "Role assignment change"
  | "team.artifact_update"  // "I've updated a shared artifact"
  
  // --- System ---
  | "system.ack"            // "Message received"
  | "system.error"          // "Could not process message"
  | "system.ping"           // Liveness check
  | "system.pong";          // Liveness response
```

### 4.3 Payload Types

Each message type has a corresponding typed payload. Here are the key ones:

#### Task Negotiation Payloads

```typescript
interface TaskOfferPayload {
  title: string;                    // Human-readable task description
  description: string;              // Detailed task description
  required_capabilities?: string[]; // e.g., ["typescript", "sqlite", "testing"]
  estimated_effort?: string;        // e.g., "PT2H" (2 hours), "P1D" (1 day)
  deadline?: string;                // ISO 8601
  artifacts?: ACPArtifactRef[];     // Files/resources the task involves
  acceptance_criteria?: string[];   // What "done" looks like
  work_item?: string;               // Associated workq issue_ref
}

interface TaskRequestPayload {
  title: string;
  description: string;
  required_capabilities?: string[];
  preferred_agent?: string;         // Hint: prefer this agent if available
  estimated_effort?: string;
  deadline?: string;
  artifacts?: ACPArtifactRef[];
  acceptance_criteria?: string[];
  fallback_strategy?: "broadcast" | "escalate" | "queue";
}

interface TaskAcceptPayload {
  offer_id: string;                 // ID of the task.offer/task.request being accepted
  estimated_completion?: string;    // When the agent expects to finish
  conditions?: string[];            // "I can do this IF..."
  notes?: string;
}

interface TaskDeclinePayload {
  offer_id: string;                 // ID of the task being declined
  reason: DeclineReason;
  detail?: string;                  // Human-readable explanation
  suggested_agent?: string;         // "Try asking X instead"
  available_after?: string;         // "I could do this after <datetime>"
}

type DeclineReason = 
  | "at_capacity"          // Too much current work
  | "lacks_capability"     // Don't have the skills
  | "conflicting_work"     // Would conflict with current tasks
  | "deadline_unrealistic" // Can't meet the deadline
  | "out_of_scope"         // Not in my domain
  | "other";

interface TaskCounterPayload {
  offer_id: string;
  proposed_changes: string;         // What the counter-proposer wants to change
  revised_scope?: string;           // Modified task description
  revised_deadline?: string;
  revised_effort?: string;
  conditions?: string[];
}
```

#### Handoff Payloads

```typescript
interface HandoffInitiatePayload {
  title: string;                    // What's being handed off
  reason: HandoffReason;            // Why the handoff is happening
  
  // === State Transfer ===
  state_summary: string;            // Natural-language summary of current state
  decisions_made: string[];         // Key decisions already taken
  open_questions: string[];         // Unresolved questions
  
  // === Artifacts ===
  artifacts: ACPArtifactRef[];      // Files, branches, PRs, etc.
  workspace_snapshot?: string;      // Path to workspace state snapshot
  
  // === Context ===
  work_item?: string;               // Associated workq issue_ref
  session_history_key?: string;     // Session key for history retrieval
  relevant_messages?: string[];     // ACP message IDs with relevant context
  
  // === Expectations ===
  next_steps: string[];             // Recommended next actions
  risks: string[];                  // Known risks/pitfalls
  stakeholders?: string[];          // Who else needs to know about this
  deadline?: string;
}

type HandoffReason =
  | "shift_change"          // Agent going offline / capacity rotation
  | "specialization"        // Another agent is better suited
  | "escalation"            // Task is harder than expected
  | "de_escalation"         // Task turned out simpler, route to cheaper agent
  | "load_balancing"        // Current agent is overloaded
  | "completion_handoff"    // Handing off completed work for review/integration
  | "blocked_dependency"    // Blocked on something in the other agent's domain
  | "requested";            // Human or senior agent requested the handoff

interface HandoffAcceptPayload {
  handoff_id: string;
  confirmation: string;             // "I've reviewed the context and I'm ready"
  clarifying_questions?: string[];  // Questions before fully taking over
  revised_timeline?: string;
}

interface HandoffRejectPayload {
  handoff_id: string;
  reason: string;
  suggested_alternative?: string;   // Another agent who might accept
}

interface HandoffCompletePayload {
  handoff_id: string;
  received_artifacts: string[];     // Confirm which artifacts were received
  state_acknowledged: boolean;      // Confirm state was understood
  notes?: string;
}
```

#### Knowledge Payloads

```typescript
interface KnowledgePushPayload {
  topic: string;                    // What this knowledge is about
  summary: string;                  // Concise summary (< 500 chars)
  detail?: string;                  // Longer explanation
  evidence?: string[];              // Supporting data/links
  artifacts?: ACPArtifactRef[];     // Related files
  relevance: string;                // Why this matters to the recipient
  confidence: "low" | "medium" | "high"; // How confident the sender is
  actionable?: boolean;             // Does this require action from the recipient?
  suggested_action?: string;        // If actionable, what should they do?
}

interface KnowledgeQueryPayload {
  question: string;                 // What the sender wants to know
  context?: string;                 // Why they're asking
  urgency?: "when_convenient" | "soon" | "urgent";
}

interface KnowledgeResponsePayload {
  query_id: string;                 // ID of the knowledge.query being answered
  answer: string;
  confidence: "low" | "medium" | "high";
  sources?: string[];               // Where this knowledge comes from
  caveats?: string[];               // Limitations of this answer
}
```

#### Disagreement Payloads

```typescript
interface PositionStatePayload {
  topic: string;                    // What the position is about
  position: string;                 // The position being stated
  reasoning: string;                // Why the agent holds this position
  evidence?: string[];              // Supporting evidence
  confidence: "low" | "medium" | "high";
  open_to_revision: boolean;        // Whether the agent is willing to change their mind
}

interface PositionChallengePayload {
  position_id: string;              // ID of the position.state being challenged
  counter_position: string;         // The alternative view
  reasoning: string;                // Why the challenger disagrees
  evidence?: string[];              // Counter-evidence
  proposed_resolution?: string;     // How to resolve the disagreement
  severity: "minor" | "significant" | "blocking";
}

interface PositionConcedePayload {
  position_id: string;
  challenge_id: string;
  revised_position?: string;        // Updated position after conceding
  what_changed_mind: string;        // What evidence/argument was convincing
}

interface PositionEscalatePayload {
  position_ids: string[];           // All positions in the thread
  summary: string;                  // Summary of the disagreement
  escalate_to: string;              // Agent or human to escalate to
  reason: string;                   // Why escalation is needed
  deadline?: string;                // When resolution is needed by
}
```

### 4.4 Artifact References

```typescript
interface ACPArtifactRef {
  type: "file" | "branch" | "pr" | "url" | "session" | "workq_item";
  path: string;                     // Absolute file path, URL, or identifier
  description?: string;             // What this artifact is
  version?: string;                 // Git SHA, timestamp, or semantic version
  size_hint?: string;               // Approximate size for context budgeting
}
```

---

## 5. Communication Patterns

### 5.1 Direct Messaging

The simplest pattern: one agent sends a typed message to another.

```
Agent A ──[acp_send]──► ACP Router ──[deliver]──► Agent B
                                                      │
                                                      ▼
                                                 (processes on
                                                  next turn)
```

**Tool:** `acp_send`

```typescript
// Agent A calls:
acp_send({
  to: "xavier",
  type: "knowledge.push",
  priority: "normal",
  payload: {
    topic: "model-abstraction",
    summary: "MiniMax M2.5 tool calls fail 15% of the time on structured output. This should factor into the capabilities layer design.",
    confidence: "high",
    relevance: "You're designing the model abstraction layer. This is a critical data point for capability profiling.",
    actionable: true,
    suggested_action: "Add a 'structured_output_reliability' field to the capabilities taxonomy."
  }
})
```

### 5.2 Broadcast

Agent sends to all agents, or to all agents matching a filter.

```
Agent A ──[acp_broadcast]──► ACP Router ──┬──► Agent B
                                           ├──► Agent C
                                           ├──► Agent D
                                           └──► ...
```

**Tool:** `acp_broadcast`

```typescript
acp_broadcast({
  type: "status.blocked",
  topic: "auth-refactor",
  priority: "high",
  filter: { team: "platform-core" },  // Only agents in this team
  payload: {
    summary: "Auth refactor is blocked on a database migration decision. If anyone has context on the migration strategy, please share.",
    blocked_on: "Database schema migration approach for user_sessions table",
    work_item: "openclaw/openclaw#142"
  }
})
```

### 5.3 Request-Response

Structured request/response with timeout and fallback.

```
Agent A ──[task.request]──► Agent B
Agent B ──[task.accept]───► Agent A
                  or
Agent B ──[task.decline]──► Agent A ──[task.request]──► Agent C (fallback)
```

### 5.4 Negotiation (Multi-Round)

```
Agent A ──[task.offer]──────► Agent B
Agent B ──[task.counter]────► Agent A      (round 1)
Agent A ──[task.counter]────► Agent B      (round 2)
Agent B ──[task.accept]─────► Agent A      (agreement)
```

Bounded to `max_negotiation_rounds` (default: 3). After max rounds, auto-escalates.

### 5.5 Fan-Out with First-Responder

For capability-based task routing: broadcast a request, first qualified acceptor wins.

```
Agent A ──[task.request, to="*"]──► ACP Router ──┬──► Agent B (declines)
                                                  ├──► Agent C (accepts ✓)
                                                  └──► Agent D (accepts, but too late)
                                                            │
                                  Agent C ◄──[task.accept]──┘
                                  Agent D ◄──[system.ack: already_claimed]
```

---

## 6. Negotiation Protocol

### 6.1 Negotiation State Machine

```
                     ┌──────────┐
                     │  offered  │
                     └─────┬─────┘
                           │
                ┌──────────┼──────────┐
                ▼          ▼          ▼
          ┌──────────┐ ┌────────┐ ┌──────────┐
          │ accepted │ │counter │ │ declined │
          └──────────┘ └───┬────┘ └──────────┘
                           │
                    ┌──────┼──────┐
                    ▼      ▼      ▼
              ┌──────────┐│ ┌──────────┐
              │ accepted ││ │ declined │
              └──────────┘│ └──────────┘
                          ▼
                   ┌────────────┐
                   │ max_rounds │
                   │ → escalate │
                   └────────────┘
```

### 6.2 Negotiation Rules

1. **Initiator sets terms.** The task.offer/task.request defines the initial scope.
2. **Responder can accept, decline, or counter.** No silent ignoring — non-response after `max_response_time` is treated as a decline.
3. **Counter-proposals are bounded.** Max `negotiation_max_rounds` (default: 3) counter/counter exchanges. After that, the negotiation auto-escalates to a coordinator or human.
4. **First-responder wins for broadcasts.** When a task is offered to `"*"` (broadcast), the first `task.accept` claims it. Subsequent accepts receive a `system.ack` with `status: "already_claimed"`.
5. **Decline requires a reason.** The `DeclineReason` enum ensures agents explain why they can't take work, enabling better routing decisions.
6. **Capability matching is advisory.** `required_capabilities` on a task offer is a hint, not enforcement. Agents self-assess whether they can do the work.

### 6.3 Negotiation Persistence

All negotiation messages are stored in the `negotiations` table with a shared `thread_id` so the full negotiation history is queryable:

```sql
CREATE TABLE IF NOT EXISTS negotiations (
  id            TEXT PRIMARY KEY,          -- ACP message ID
  thread_id     TEXT NOT NULL,             -- Groups all messages in this negotiation
  from_agent    TEXT NOT NULL,
  to_agent      TEXT,                      -- NULL for broadcasts
  type          TEXT NOT NULL,             -- task.offer, task.accept, etc.
  payload_json  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open', -- open | accepted | declined | escalated | expired
  round         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  expires_at    TEXT
);

CREATE INDEX idx_negotiations_thread ON negotiations(thread_id);
CREATE INDEX idx_negotiations_status ON negotiations(status);
CREATE INDEX idx_negotiations_to ON negotiations(to_agent, status);
```

---

## 7. Status Broadcasting

### 7.1 Subscription Model

Agents subscribe to status updates by topic, team, or agent. Subscriptions are persistent across sessions.

```typescript
interface ACPSubscription {
  subscriber: string;         // Agent ID
  filter: {
    from_agents?: string[];   // Specific agents to watch
    topics?: string[];        // Topic tags to match
    teams?: string[];         // Teamspace IDs
    types?: ACPMessageType[]; // Specific message types
    priority_min?: "low" | "normal" | "high" | "critical";
  };
  delivery: "session" | "inbox" | "channel"; // How to deliver
  created_at: string;
}
```

**Tool:** `acp_subscribe`

```typescript
// Xavier subscribes to all blocked statuses from platform-core team
acp_subscribe({
  filter: {
    teams: ["platform-core"],
    types: ["status.blocked"],
  },
  delivery: "session"
})
```

### 7.2 Default Subscriptions

Certain subscriptions are automatic based on org role:

| Role | Auto-Subscribed To |
|---|---|
| C-Suite (Xavier, Amadeus, etc.) | `critical` priority from all agents in their domain |
| Team Lead | All `status.blocked` from their team members |
| All agents | `knowledge.push` tagged with their declared capabilities |
| Coordinator (Merlin) | All `position.escalate` messages |

### 7.3 Status Update Schema

```typescript
interface StatusUpdatePayload {
  summary: string;                  // What's happening (< 280 chars)
  detail?: string;                  // Longer explanation
  work_item?: string;               // Associated workq issue_ref
  progress_pct?: number;            // 0-100 (optional)
  estimated_completion?: string;    // ISO 8601
  blockers?: string[];              // Current blockers (if any)
  artifacts_changed?: ACPArtifactRef[]; // What files/resources changed
}
```

### 7.4 Broadcasting Rules

1. **Rate limiting:** Max 1 status broadcast per agent per topic per 10 minutes (prevents spam).
2. **Deduplication:** Identical status updates within the dedup window (5 min) are suppressed.
3. **Aggregation:** If multiple updates queue for one subscriber, they're batched into a single delivery.
4. **Expiry:** Status messages expire after 24 hours by default (configurable).

---

## 8. Knowledge Push Protocol

### 8.1 Design Rationale

Today, agents discover knowledge by reading shared files. This is lossy — an agent only reads files it knows to look for, at times it happens to check. Knowledge push inverts this: the discovering agent pushes knowledge to agents who need it.

### 8.2 Routing Intelligence

When an agent pushes knowledge, the ACP Router determines recipients using:

1. **Explicit recipients** — `to: ["xavier", "tim"]` (agent knows who needs this)
2. **Topic-based routing** — Match knowledge topic against subscriber interests
3. **Capability-based routing** — Match knowledge topic against agent declared capabilities
4. **Team routing** — Route to all members of a relevant teamspace
5. **Smart routing (Phase 3)** — ML-based relevance scoring using agent history (future)

### 8.3 Knowledge Deduplication

Knowledge pushes are deduplicated by content similarity within a 24-hour window. If Agent A pushes "MiniMax tool calls fail 15% of the time" and Agent B pushes "MiniMax structured output reliability is around 85%", the second message is tagged as potentially duplicate and only delivered to recipients who didn't receive the first.

### 8.4 Knowledge Persistence

Pushed knowledge is persisted in the `knowledge` table and optionally promoted to shared workspace files:

```sql
CREATE TABLE IF NOT EXISTS knowledge (
  id            TEXT PRIMARY KEY,
  from_agent    TEXT NOT NULL,
  topic         TEXT NOT NULL,
  summary       TEXT NOT NULL,
  detail        TEXT,
  confidence    TEXT NOT NULL,       -- low | medium | high
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  expires_at    TEXT,
  superseded_by TEXT,                -- ID of newer knowledge that replaces this
  tags_json     TEXT DEFAULT '[]'
);

CREATE INDEX idx_knowledge_topic ON knowledge(topic);
CREATE INDEX idx_knowledge_from ON knowledge(from_agent);
CREATE INDEX idx_knowledge_created ON knowledge(created_at DESC);
```

---

## 9. Constructive Disagreement Protocol

### 9.1 Why This Matters

Today, if two agents have conflicting views (e.g., Tim recommends one architectural approach and Amadeus recommends another), there's no structured way to resolve it. They write their opinions in separate documents and a human reconciles. ACP enables structured, evidence-based disagreement that can sometimes self-resolve.

### 9.2 Disagreement Flow

```
1. Agent A states a position:
   position.state { topic: "auth-architecture", position: "Use JWT tokens", reasoning: "...", evidence: [...] }

2. Agent B challenges:
   position.challenge { counter_position: "Use session cookies", reasoning: "...", evidence: [...] }

3. Resolution paths:
   a. Agent A concedes:
      position.concede { what_changed_mind: "Agent B's evidence about JWT revocation complexity is compelling" }
   
   b. Agent B concedes:
      position.concede { ... }
   
   c. Neither concedes → Escalation:
      position.escalate { summary: "Agents disagree on auth approach", escalate_to: "david" }
```

### 9.3 Disagreement Rules

1. **Evidence required.** Positions and challenges must include reasoning. "I think X" without "because Y" is rejected by schema validation.
2. **Severity guides urgency.** `minor` disagreements can be queued; `blocking` disagreements are escalated immediately.
3. **Max rounds: 2.** Position → Challenge → (Concede or Escalate). No extended debates. If neither side concedes after one challenge round, it escalates.
4. **Escalation is not failure.** Escalation produces a structured summary that's far more useful to the human decision-maker than an ad-hoc Slack thread.
5. **Human override is final.** When a human resolves an escalated disagreement, that decision is broadcast as a `knowledge.push` with `confidence: "high"` so all relevant agents update their understanding.

### 9.4 Disagreement Audit Trail

Every position/challenge/concede/escalate is stored in the `disagreements` table:

```sql
CREATE TABLE IF NOT EXISTS disagreements (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL,       -- Groups position + challenges
  type          TEXT NOT NULL,       -- position.state, position.challenge, etc.
  agent_id      TEXT NOT NULL,
  topic         TEXT NOT NULL,
  payload_json  TEXT NOT NULL,
  resolution    TEXT,                -- conceded_a | conceded_b | escalated | human_resolved
  resolved_at   TEXT,
  resolved_by   TEXT,                -- Agent or human who resolved it
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX idx_disagreements_thread ON disagreements(thread_id);
CREATE INDEX idx_disagreements_topic ON disagreements(topic);
CREATE INDEX idx_disagreements_resolution ON disagreements(resolution);
```

---

## 10. Task Handoff Protocol

### 10.1 The Handoff Problem

Today, when work passes from one agent to another, context is lost. If Roman starts a refactoring task and needs to hand off to Claire, the transfer is ad hoc: maybe Roman writes a note in a shared file, maybe the human re-explains the task. The new agent starts with incomplete context and often makes mistakes or redoes work.

ACP handoffs solve this with a structured state transfer protocol.

### 10.2 Handoff Lifecycle

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PREPARE   │────►│    TRANSFER     │────►│    CONFIRM      │
│             │     │                 │     │                 │
│ Sender      │     │ Context bundle  │     │ Receiver        │
│ packages    │     │ delivered to    │     │ acknowledges    │
│ state       │     │ receiver        │     │ receipt &       │
│             │     │                 │     │ understanding   │
└─────────────┘     └─────────────────┘     └─────────────────┘
                                                     │
                                              ┌──────┴──────┐
                                              ▼             ▼
                                        ┌──────────┐ ┌──────────┐
                                        │ ACCEPTED │ │ REJECTED │
                                        │          │ │          │
                                        │ Receiver │ │ Back to  │
                                        │ takes    │ │ sender   │
                                        │ ownership│ │ or       │
                                        └──────────┘ │ reroute  │
                                                     └──────────┘
```

### 10.3 Handoff Context Bundle

The handoff context bundle is the critical innovation. It packages everything the receiving agent needs to continue work without context loss:

```typescript
interface HandoffContextBundle {
  // === Narrative State ===
  state_summary: string;            // "Here's where things stand..."
  decisions_made: Array<{
    decision: string;               // What was decided
    reasoning: string;              // Why it was decided
    timestamp: string;              // When it was decided
    reversible: boolean;            // Can this be changed?
  }>;
  open_questions: Array<{
    question: string;
    context: string;                // Why this question matters
    attempted_answers?: string[];   // What was already tried
  }>;
  
  // === Artifact Manifest ===
  artifacts: Array<{
    ref: ACPArtifactRef;
    status: "created" | "modified" | "reviewed" | "needs_attention";
    notes?: string;                 // Context about this artifact
  }>;
  
  // === Work State ===
  work_item?: string;               // workq issue_ref
  branch?: string;                  // Git branch
  worktree_path?: string;           // Git worktree path
  test_status?: "passing" | "failing" | "untested";
  
  // === Relationship Map ===
  stakeholders: Array<{
    agent_id: string;
    role: string;                   // "reviewer", "dependent", "requester"
    last_interaction?: string;      // When they were last engaged
    expectations?: string;          // What they expect from this work
  }>;
  
  // === Environment ===
  environment_notes?: string;       // Special setup, env vars, etc.
  
  // === Warnings ===
  risks: string[];                  // Known risks
  pitfalls: string[];               // Things to avoid
  gotchas: string[];                // Non-obvious complexities
  
  // === Recommended Next Steps ===
  next_steps: Array<{
    step: string;
    priority: "must" | "should" | "could";
    estimated_effort?: string;
  }>;
}
```

### 10.4 Handoff Persistence

```sql
CREATE TABLE IF NOT EXISTS handoffs (
  id              TEXT PRIMARY KEY,        -- Handoff ID
  thread_id       TEXT NOT NULL,           -- Groups all messages in this handoff
  from_agent      TEXT NOT NULL,
  to_agent        TEXT NOT NULL,
  title           TEXT NOT NULL,
  reason          TEXT NOT NULL,            -- HandoffReason enum value
  context_json    TEXT NOT NULL,            -- Full HandoffContextBundle
  status          TEXT NOT NULL DEFAULT 'initiated', -- initiated | accepted | rejected | completed
  work_item       TEXT,                     -- Associated workq issue_ref
  initiated_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  resolved_at     TEXT,
  resolution_notes TEXT
);

CREATE INDEX idx_handoffs_from ON handoffs(from_agent, status);
CREATE INDEX idx_handoffs_to ON handoffs(to_agent, status);
CREATE INDEX idx_handoffs_status ON handoffs(status);
CREATE INDEX idx_handoffs_work_item ON handoffs(work_item);
```

### 10.5 Handoff Integration with workq

When a handoff involves a workq work item, ACP coordinates the ownership transfer:

1. Sender calls `acp_handoff` → ACP creates handoff record
2. Receiver calls `acp_respond` with `handoff.accept` → ACP updates handoff status
3. ACP automatically calls `workq_release` for the sender and `workq_claim` for the receiver (with the same `issue_ref`)
4. ACP copies the handoff context bundle to the receiver's workspace as `acp-handoff-<id>.md`
5. Receiver calls `acp_respond` with `handoff.complete` → handoff is finalized

### 10.6 Handoff Safety Rules

1. **No silent handoffs.** Both sender and receiver must explicitly participate. A handoff cannot be forced on an unwilling receiver.
2. **Context bundle is mandatory.** `handoff.initiate` without a `state_summary` and at least one `next_step` is rejected.
3. **Work item transfer is atomic.** If the workq claim fails for the receiver, the handoff is rolled back.
4. **Audit trail is permanent.** Every handoff is logged with full context, queryable forever.
5. **Human notification on critical handoffs.** Handoffs tagged `critical` notify the relevant human stakeholder.

---

## 11. Agent Teamspaces

### 11.1 Concept

A teamspace is a **persistent coordination context** for a group of agents working toward a shared goal. It provides:

- **Shared identity:** The team has a name, goal, and membership roster.
- **Role assignments:** Each member has a defined role within the team.
- **Shared artifacts:** A dedicated workspace directory with versioned artifacts.
- **Communication channel:** All ACP messages within the team are visible to all members.
- **Coordination state:** Shared understanding of who's doing what.

### 11.2 Teamspace Schema

```typescript
interface ACPTeamspace {
  id: string;                       // Unique teamspace ID (slug)
  name: string;                     // Human-readable name
  goal: string;                     // What this team is trying to accomplish
  status: "active" | "paused" | "completed" | "archived";
  
  // === Membership ===
  members: Array<{
    agent_id: string;
    role: TeamRole;
    joined_at: string;
    status: "active" | "busy" | "away";
  }>;
  
  // === Artifacts ===
  workspace_path: string;           // e.g., "~/.openclaw/workspace/_teams/<team-id>/"
  artifacts: Array<{
    path: string;                   // Relative to workspace_path
    description: string;
    last_modified_by: string;       // Agent ID
    last_modified_at: string;
    version: number;                // Monotonically incrementing
  }>;
  
  // === Coordination ===
  active_work: Array<{
    agent_id: string;
    task: string;
    status: string;
    work_item?: string;             // workq reference
  }>;
  
  // === History ===
  decisions: Array<{
    decision: string;
    made_by: string;
    timestamp: string;
    rationale: string;
  }>;
  
  // === Meta ===
  created_at: string;
  created_by: string;
  updated_at: string;
}

type TeamRole = 
  | "coordinator"     // Manages the team, routes tasks, resolves conflicts
  | "lead"            // Technical/domain lead, makes key decisions
  | "contributor"     // Does assigned work
  | "reviewer"        // Reviews work products
  | "advisor"         // Provides input but doesn't execute work
  | "observer";       // Can see team state but doesn't participate actively
```

### 11.3 Teamspace Persistence

```sql
CREATE TABLE IF NOT EXISTS teamspaces (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  goal            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  workspace_path  TEXT NOT NULL,
  config_json     TEXT DEFAULT '{}',
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE TABLE IF NOT EXISTS teamspace_members (
  teamspace_id  TEXT NOT NULL,
  agent_id      TEXT NOT NULL,
  role          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  joined_at     TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  PRIMARY KEY (teamspace_id, agent_id),
  FOREIGN KEY (teamspace_id) REFERENCES teamspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teamspace_artifacts (
  id              TEXT PRIMARY KEY,
  teamspace_id    TEXT NOT NULL,
  path            TEXT NOT NULL,
  description     TEXT,
  last_modified_by TEXT NOT NULL,
  last_modified_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  version         INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (teamspace_id) REFERENCES teamspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teamspace_decisions (
  id            TEXT PRIMARY KEY,
  teamspace_id  TEXT NOT NULL,
  decision      TEXT NOT NULL,
  rationale     TEXT,
  made_by       TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  FOREIGN KEY (teamspace_id) REFERENCES teamspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_ts_members_agent ON teamspace_members(agent_id);
CREATE INDEX idx_ts_artifacts_team ON teamspace_artifacts(teamspace_id);
CREATE INDEX idx_ts_artifacts_modified ON teamspace_artifacts(last_modified_at DESC);
CREATE INDEX idx_ts_decisions_team ON teamspace_decisions(teamspace_id, created_at DESC);
```

### 11.4 Teamspace Lifecycle

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   CREATE     │────►│   ACTIVE     │────►│  COMPLETED   │
│              │     │              │     │              │
│ Define goal  │     │ Members      │     │ Goal met,    │
│ Add members  │     │ collaborate  │     │ artifacts    │
│ Init workspace│    │ via ACP      │     │ archived     │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   PAUSED     │
                     │              │
                     │ Temporarily  │
                     │ inactive     │
                     └──────────────┘
```

### 11.5 Teamspace Workspace Structure

When a teamspace is created, ACP initializes a workspace directory:

```
~/.openclaw/workspace/_teams/<team-id>/
├── TEAM.md                    # Team identity, goal, membership
├── STATUS.md                  # Current status, active work, blockers
├── DECISIONS.md               # Decision log
├── artifacts/                 # Shared work products
│   ├── <artifact-1>.md
│   └── <artifact-2>.md
├── reviews/                   # Peer review artifacts
└── archive/                   # Completed/superseded artifacts
```

### 11.6 Artifact Versioning

Teamspace artifacts use a simple versioning scheme:

1. **Every write increments the version counter** in `teamspace_artifacts`.
2. **Before overwriting**, the current version is copied to `archive/<artifact>-v<N>.md`.
3. **Conflict detection:** If two agents try to write the same artifact concurrently, the second write detects a version mismatch and:
   - For `minor` changes: auto-merges if possible (append-only content).
   - For `major` changes: creates a `.conflict` file and notifies the team coordinator.
4. **The artifact table tracks who modified what and when** for full audit trail.

### 11.7 Teamspace Tools

```typescript
// Create a teamspace
acp_team({
  action: "create",
  name: "Auth Refactor Team",
  goal: "Redesign authentication system to support session cookies alongside JWT",
  members: [
    { agent_id: "tim", role: "lead" },
    { agent_id: "roman", role: "contributor" },
    { agent_id: "claire", role: "contributor" },
    { agent_id: "sandy", role: "reviewer" },
  ]
})

// Update team status
acp_team({
  action: "status",
  team: "auth-refactor-team",
  status: { summary: "Phase 1 schema migration complete. Starting Phase 2 handler refactor." }
})

// Record a team decision
acp_team({
  action: "decide",
  team: "auth-refactor-team",
  decision: "Use cookie-based sessions for web clients, JWT for API clients",
  rationale: "Session cookies provide better security for browser-based access; JWT is standard for machine-to-machine."
})

// Update a shared artifact
acp_team({
  action: "artifact",
  team: "auth-refactor-team",
  path: "artifacts/auth-migration-plan.md",
  description: "Migration plan for auth schema changes",
  content: "..."  // Or reference to a file
})

// Query team state
acp_team({
  action: "query",
  team: "auth-refactor-team"
})
// Returns full teamspace state: members, artifacts, decisions, active work
```

### 11.8 Coordination via Tim's Teamspace Vision

Tim's brainstorm (Idea #10) emphasizes explicit roles, shared context, and structured handoffs. ACP implements this precisely:

| Tim's Concept | ACP Implementation |
|---|---|
| Explicit roles (researcher, reviewer, executor, coordinator) | `TeamRole` on `teamspace_members` — coordinator, lead, contributor, reviewer, advisor, observer |
| Shared context | Teamspace workspace directory + `TEAM.md` + `STATUS.md` auto-maintained |
| Artifact versioning | `teamspace_artifacts` table with version counter + archive copies |
| Structured handoffs | Full handoff protocol (§10) integrated with teamspace membership |
| Cost controls | Rate limiting per team (§13), observable via ACP metrics |
| Observability | All team ACP messages logged, queryable, and surfaceable in Luis's topology view |

---

## 12. Integration with Existing Architecture

This is the critical section. Every ACP capability is mapped to existing OpenClaw primitives, showing exactly where it plugs in.

### 12.1 Integration Map

| ACP Feature | Existing Primitive | Integration Point | Invasiveness |
|---|---|---|---|
| **Message routing** | `sessions_spawn` / `message` tool | ACP extends message tool with typed payloads | **None** — new tool, doesn't modify existing |
| **Message delivery (active agent)** | Session injection (system messages) | ACP injects messages via existing system message capability | **Low** — uses existing injection API |
| **Message delivery (offline agent)** | Workspace files | ACP writes to `<agent>/acp-inbox.md` | **None** — just file writes |
| **Message delivery (urgent)** | Channel messaging (Slack, etc.) | ACP posts to designated channel | **None** — uses existing `message` tool |
| **Agent wake for urgent messages** | Heartbeat/cron system | ACP triggers existing heartbeat mechanism | **Low** — hook into heartbeat trigger |
| **Persistence** | SQLite (see `workq` pattern) | ACP uses own SQLite database | **None** — independent storage |
| **Tool registration** | Plugin SDK (`api.registerTool`) | ACP registers tools identically to `workq` | **None** — standard extension |
| **CLI registration** | Plugin SDK (`api.registerCli`) | ACP registers CLI commands identically to `workq` | **None** — standard extension |
| **Teamspace workspaces** | Workspace filesystem | ACP creates directories under `_teams/` | **None** — just directories |
| **Work item integration** | `workq` extension | ACP calls `workq` tools for handoff ownership transfer | **None** — tool-to-tool calls |
| **Agent capability registry** | `AGENTS.md` files | ACP reads agent configs to build capability index | **Low** — read-only access |
| **Topology / observability** | Gateway event stream (WebSocket) | ACP emits events that Luis's dashboard can consume | **Low** — adds event types |

### 12.2 Extension Structure

Following the `workq` pattern exactly:

```
~/.openclaw/extensions/acp/
├── openclaw.plugin.json          # Extension manifest
├── package.json
├── index.ts                      # Plugin entry point
├── src/
│   ├── database.ts               # SQLite schema, migrations, CRUD
│   ├── database.test.ts
│   ├── router.ts                 # Message routing logic
│   ├── router.test.ts
│   ├── delivery.ts               # Multi-channel delivery
│   ├── delivery.test.ts
│   ├── tools.ts                  # Agent tool registrations
│   ├── tools.test.ts
│   ├── cli.ts                    # CLI command registrations
│   ├── cli.test.ts
│   ├── types.ts                  # Shared TypeScript types
│   ├── negotiation.ts            # Negotiation state machine
│   ├── negotiation.test.ts
│   ├── handoff.ts                # Handoff lifecycle management
│   ├── handoff.test.ts
│   ├── teamspace.ts              # Teamspace CRUD and coordination
│   ├── teamspace.test.ts
│   ├── subscriptions.ts          # Subscription management
│   ├── subscriptions.test.ts
│   ├── knowledge.ts              # Knowledge routing and persistence
│   ├── knowledge.test.ts
│   ├── safety.ts                 # Rate limiting, circuit breakers
│   ├── safety.test.ts
│   └── capabilities.ts           # Agent capability indexing
└── migrations/
    └── 001_initial.sql           # Initial schema
```

### 12.3 Plugin Registration

```typescript
// index.ts
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { ACPDatabase } from "./src/database.js";
import { ACPRouter } from "./src/router.js";
import { ACPDelivery } from "./src/delivery.js";
import { registerACPTools } from "./src/tools.js";
import { registerACPCli } from "./src/cli.js";
import { ACPSafety } from "./src/safety.js";

export default function register(api: OpenClawPluginApi) {
  const config = (api.pluginConfig ?? {}) as ACPConfig;
  
  if (config.enabled === false) {
    api.logger.info("[acp] Disabled by config");
    return;
  }

  const dbPath = api.resolvePath(config.dbPath ?? "~/.openclaw/acp/acp.db");
  
  const db = new ACPDatabase(dbPath);
  const safety = new ACPSafety(config.rateLimits ?? DEFAULT_RATE_LIMITS);
  const router = new ACPRouter(db, api);
  const delivery = new ACPDelivery(api, config.delivery ?? DEFAULT_DELIVERY_CONFIG);

  // Register tools (via factory for ctx.agentId access)
  registerACPTools(api, db, router, delivery, safety);
  registerACPCli(api, db);

  api.registerService({
    id: "acp",
    start: () => {
      db.initialize();
      router.buildCapabilityIndex();
      api.logger.info(`[acp] Ready — db: ${dbPath}`);
    },
    stop: () => db.close(),
  });
}
```

### 12.4 Plugin Manifest

```json
{
  "id": "acp",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "enabled": { "type": "boolean" },
      "dbPath": { "type": "string", "description": "Path to ACP SQLite database" },
      "delivery": {
        "type": "object",
        "properties": {
          "inboxDir": { "type": "string", "description": "Base directory for agent inbox files" },
          "channelId": { "type": "string", "description": "Channel for urgent ACP notifications" },
          "wakeOnHighPriority": { "type": "boolean", "description": "Trigger heartbeat for high-priority messages" }
        }
      },
      "rateLimits": {
        "type": "object",
        "properties": {
          "messagesPerMinute": { "type": "integer", "minimum": 1 },
          "broadcastsPerHour": { "type": "integer", "minimum": 1 },
          "negotiationMaxRounds": { "type": "integer", "minimum": 1, "maximum": 10 }
        }
      },
      "subscriptions": {
        "type": "object",
        "properties": {
          "autoSubscribeCritical": { "type": "boolean" },
          "defaultDelivery": { "type": "string", "enum": ["session", "inbox", "channel"] }
        }
      }
    }
  }
}
```

### 12.5 Agent Tool Surface

ACP registers the following tools. Each is optional — agents must have `acp` in their `tools.allow` list.

| Tool | Purpose | Parameters |
|---|---|---|
| `acp_send` | Send a typed message to one or more agents | `to`, `type`, `priority`, `payload`, `topic`, `context` |
| `acp_broadcast` | Broadcast a message to subscribers | `type`, `priority`, `payload`, `topic`, `filter` |
| `acp_respond` | Reply to a received ACP message | `reply_to`, `type`, `payload` |
| `acp_query` | Query ACP messages, negotiations, handoffs | `filter` (type, from, to, topic, status, date range) |
| `acp_subscribe` | Subscribe to message types/topics/agents | `filter`, `delivery` |
| `acp_handoff` | Initiate a structured task handoff | `to`, `title`, `reason`, `context_bundle` |
| `acp_team` | Manage teamspaces | `action` (create, join, leave, status, decide, artifact, query) |
| `acp_inbox` | Read pending ACP messages for the calling agent | `limit`, `types`, `since` |

**Total tools: 8** — a manageable surface that doesn't bloat agent context.

### 12.6 Agent Onboarding

For an agent to participate in ACP, minimal changes to their `AGENTS.md`:

```markdown
## ACP (Agent Communication Protocol)

This agent participates in the Agent Communication Protocol for structured inter-agent coordination.

### Capabilities Declared
- typescript, architecture, code-review, system-design

### ACP Behavior
- Check `acp_inbox` at the start of each session for pending messages
- Respond to task.request messages within your capabilities
- Push knowledge discoveries to relevant agents via acp_send
- When handing off work, always use acp_handoff with full context bundle
```

This is a **documentation change only** — no code changes, no config schema changes, no model changes.

### 12.7 Inbox File Format

For offline delivery, ACP writes to `~/.openclaw/workspace/<agent>/acp-inbox.md`:

```markdown
# ACP Inbox
*Last updated: 2026-02-21T10:30:00Z*

## Pending Messages (3)

### [HIGH] Task Request from Xavier (2026-02-21T10:15:00Z)
**ID:** `acp-msg-01JMQX...`  
**Type:** `task.request`  
**Topic:** auth-refactor  
**Respond with:** `acp_respond({ reply_to: "acp-msg-01JMQX...", type: "task.accept", payload: {...} })`

> **Title:** Review auth migration SQL schema  
> **Description:** Need a code review of the auth schema migration before we run it. Focus on index performance and backwards compatibility.  
> **Estimated effort:** PT1H  
> **Deadline:** 2026-02-21T18:00:00Z  

---

### [NORMAL] Knowledge Push from Drew (2026-02-21T09:45:00Z)
**ID:** `acp-msg-01JMQW...`  
**Type:** `knowledge.push`  
**Topic:** data-quality  

> **Summary:** User session table has 12% null values in the `last_active_at` column. This may affect any queries relying on session recency.  
> **Confidence:** high  
> **Actionable:** yes  
> **Suggested action:** Add a NOT NULL constraint with a default in the migration, and backfill existing nulls.

---

### [NORMAL] Status Update from Roman (2026-02-21T09:30:00Z)
**ID:** `acp-msg-01JMQV...`  
**Type:** `status.progress`  
**Topic:** auth-refactor  

> **Summary:** Auth handler refactor is 60% complete. Token validation and cookie parsing are done. Starting session management layer.  
> **Progress:** 60%  
> **Estimated completion:** 2026-02-21T16:00:00Z
```

This format is:
- **Human-readable** — anyone can inspect an agent's inbox
- **Machine-parseable** — agents can extract message IDs and respond
- **Self-documenting** — includes the `acp_respond` call template
- **Append-only** — new messages are appended; processed messages are removed

---

## 13. Safety, Rate Limiting & Human Oversight

### 13.1 Rate Limiting

| Limit | Default | Configurable |
|---|---|---|
| Messages per agent per minute | 10 | Yes |
| Broadcasts per agent per hour | 5 | Yes |
| Negotiation rounds per thread | 3 | Yes |
| Knowledge pushes per agent per hour | 10 | Yes |
| Handoffs per agent per hour | 3 | Yes |
| Teamspace creations per day | 5 | Yes |

When a rate limit is hit, the tool returns an error with the limit details and when the agent can try again.

### 13.2 Circuit Breakers

If an agent enters a messaging loop (detected by repeated similar messages within a short window), ACP trips a circuit breaker:

1. **Detection:** >3 messages with the same `type` and `to` within 60 seconds.
2. **Action:** Block further messages from that agent for 5 minutes.
3. **Notification:** Alert the agent coordinator (Merlin) and log the event.
4. **Recovery:** After cooldown, agent can resume. After 3 circuit breaker trips in a day, agent is suspended from ACP until manual review.

### 13.3 Human Oversight

| Oversight Mechanism | Implementation |
|---|---|
| **All messages are queryable** | `openclaw acp log` CLI shows all ACP traffic |
| **Critical messages notify humans** | `critical` priority messages post to a human-visible channel |
| **Escalations go to humans** | `position.escalate` is delivered to the specified human |
| **Inbox files are human-readable** | Any human can read `<agent>/acp-inbox.md` |
| **Rate limits prevent runaway** | Hard limits on all message types |
| **Audit trail is immutable** | SQLite database preserves all messages permanently |
| **Team decisions are logged** | `teamspace_decisions` table + `DECISIONS.md` file |

### 13.4 ACP Dashboard Data (for Luis's Mission Control)

ACP emits structured events that feed into the observability dashboard:

```typescript
interface ACPEvent {
  type: "acp.message" | "acp.negotiation" | "acp.handoff" | "acp.team" | "acp.circuit_breaker";
  timestamp: string;
  from: string;
  to?: string | string[];
  message_type: ACPMessageType;
  priority: string;
  topic?: string;
  team?: string;
}
```

These events are emittable on the Gateway WebSocket stream, so Luis's dashboard can render:
- Live ACP message flow between agents (topology view — Luis's Idea #2)
- Negotiation status (who's talking to whom about what)
- Handoff tracking (who's passing work to whom)
- Teamspace activity (which teams are active, what they're working on)
- Circuit breaker alerts

---

## 14. Example Flows

### 14.1 Flow: Bug Discovery → Knowledge Push → Task Request → Handoff

**Scenario:** Drew discovers a data quality issue during analytics work. He pushes the knowledge to the relevant agents. Tim determines it needs an engineering fix and creates a task request. Roman picks it up, partially completes it, and hands off to Claire when his session ends.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Step 1: Drew discovers the issue and pushes knowledge               │
└─────────────────────────────────────────────────────────────────────┘

Drew calls:
  acp_send({
    to: ["tim", "amadeus"],
    type: "knowledge.push",
    priority: "high",
    topic: "user-sessions-data-quality",
    payload: {
      topic: "user_sessions table data quality",
      summary: "12% of rows in user_sessions have NULL last_active_at. This will cause incorrect session expiry calculations.",
      confidence: "high",
      evidence: ["SELECT COUNT(*) FROM user_sessions WHERE last_active_at IS NULL → 14,223 rows"],
      relevance: "Any code touching session expiry logic will produce wrong results until this is fixed.",
      actionable: true,
      suggested_action: "Backfill NULL values and add NOT NULL constraint."
    }
  })

Result: ACP delivers to Tim (session injection — he's active) and Amadeus (inbox file — offline).

┌─────────────────────────────────────────────────────────────────────┐
│ Step 2: Tim creates a task request based on the knowledge           │
└─────────────────────────────────────────────────────────────────────┘

Tim calls:
  acp_send({
    to: ["roman", "claire"],
    type: "task.request",
    priority: "high",
    topic: "user-sessions-data-quality",
    payload: {
      title: "Fix NULL last_active_at in user_sessions + add constraint",
      description: "Backfill 14,223 NULL values in user_sessions.last_active_at using created_at as fallback, then add NOT NULL DEFAULT constraint. Include migration and test.",
      required_capabilities: ["sql", "migrations", "testing"],
      estimated_effort: "PT3H",
      deadline: "2026-02-22T00:00:00Z",
      acceptance_criteria: [
        "Zero NULL values in last_active_at",
        "NOT NULL constraint added",
        "Migration is reversible",
        "Tests pass"
      ],
      work_item: "openclaw/openclaw#187"
    },
    context: {
      artifacts: [
        { type: "file", path: "/Users/openclaw/.openclaw/workspace/drew/analysis/session-nulls.md" }
      ]
    }
  })

┌─────────────────────────────────────────────────────────────────────┐
│ Step 3: Roman accepts the task                                      │
└─────────────────────────────────────────────────────────────────────┘

Roman calls:
  acp_respond({
    reply_to: "acp-msg-01JMQX...",  // Tim's task.request message ID
    type: "task.accept",
    payload: {
      offer_id: "acp-msg-01JMQX...",
      estimated_completion: "2026-02-21T18:00:00Z",
      notes: "I'll start with the backfill query, then the migration, then tests."
    }
  })

// ACP automatically notifies Tim: "Roman accepted your task request"
// ACP also sends system.ack to Claire: "Task already claimed by Roman"

┌─────────────────────────────────────────────────────────────────────┐
│ Step 4: Roman works on it, then hands off to Claire                 │
└─────────────────────────────────────────────────────────────────────┘

Roman (at end of his session) calls:
  acp_handoff({
    to: "claire",
    title: "Continue: Fix NULL last_active_at",
    reason: "shift_change",
    context_bundle: {
      state_summary: "Backfill query is written and tested locally. Migration file created but NOT NULL constraint not yet added. Tests partially written — backfill test passes, constraint test not started.",
      decisions_made: [
        {
          decision: "Use created_at as fallback for NULL last_active_at values",
          reasoning: "It's the most conservative estimate — session was at least active when created",
          timestamp: "2026-02-21T14:30:00Z",
          reversible: true
        }
      ],
      open_questions: [
        {
          question: "Should the migration run in a transaction or in batches?",
          context: "14K rows is small enough for a single transaction, but Drew mentioned the table might be under load",
          attempted_answers: ["Asked Drew — no response yet"]
        }
      ],
      artifacts: [
        {
          ref: { type: "file", path: "/worktrees/roman-187/migrations/20260221_backfill_last_active.sql" },
          status: "modified",
          notes: "Backfill query is complete. Constraint ALTER TABLE is commented out — needs testing first."
        },
        {
          ref: { type: "file", path: "/worktrees/roman-187/tests/session_migration.test.ts" },
          status: "modified",
          notes: "Backfill test passes. Constraint test is a TODO stub."
        }
      ],
      work_item: "openclaw/openclaw#187",
      branch: "roman/187-session-nulls",
      worktree_path: "/worktrees/roman-187",
      test_status: "failing",
      stakeholders: [
        { agent_id: "tim", role: "requester", expectations: "PR by EOD" },
        { agent_id: "drew", role: "dependent", expectations: "Needs this fixed for analytics accuracy" }
      ],
      risks: ["Table might be under write load during migration — consider batching"],
      pitfalls: ["Don't run the constraint ALTER until backfill is verified — it will fail on existing NULLs"],
      gotchas: ["The test database fixture has intentional NULLs — need to update fixture after migration"],
      next_steps: [
        { step: "Add NOT NULL DEFAULT constraint to migration", priority: "must" },
        { step: "Write constraint test", priority: "must" },
        { step: "Check with Drew about table load — batch vs transaction", priority: "should" },
        { step: "Run full test suite", priority: "must" },
        { step: "Submit PR and tag Tim for review", priority: "must" }
      ]
    }
  })

┌─────────────────────────────────────────────────────────────────────┐
│ Step 5: Claire receives the handoff and accepts                     │
└─────────────────────────────────────────────────────────────────────┘

Claire (on her next session wake) reads acp_inbox:
  - Sees handoff.initiate from Roman
  - Reviews the context bundle
  - Calls workq_claim for the issue (auto-transferred by ACP)

Claire calls:
  acp_respond({
    reply_to: "acp-msg-01JMQY...",  // Roman's handoff message ID
    type: "handoff.accept",
    payload: {
      handoff_id: "acp-msg-01JMQY...",
      confirmation: "I've reviewed the context. Backfill query looks good. I'll add the constraint, write the test, check with Drew about batching, and submit the PR.",
      revised_timeline: "Will complete by 2026-02-21T20:00:00Z"
    }
  })

// ACP notifies Roman: "Claire accepted your handoff"
// ACP notifies Tim: "Handoff from Roman → Claire for openclaw/openclaw#187"
// ACP updates workq: ownership transferred from Roman to Claire
```

### 14.2 Flow: Structured Disagreement → Resolution

**Scenario:** Tim and Amadeus disagree on whether to use a graph database for the collective knowledge system.

```
Tim states position:
  acp_send({
    to: "amadeus",
    type: "position.state",
    topic: "knowledge-graph-storage",
    payload: {
      topic: "Storage backend for collective knowledge graph",
      position: "Use PostgreSQL with JSONB + recursive CTEs for graph queries",
      reasoning: "We already operate PostgreSQL. Graph databases add operational complexity we don't need at our scale. PostgreSQL's recursive CTEs handle our graph traversal needs.",
      evidence: ["Our graph will be <100K nodes for the next 12 months", "PostgreSQL recursive CTEs perform well up to ~1M nodes"],
      confidence: "high",
      open_to_revision: true
    }
  })

Amadeus challenges:
  acp_respond({
    reply_to: "acp-msg-01JMQZ...",
    type: "position.challenge",
    payload: {
      position_id: "acp-msg-01JMQZ...",
      counter_position: "Use SQLite with a lightweight graph abstraction layer, not PostgreSQL",
      reasoning: "We don't currently run PostgreSQL in production — only SQLite (workq) and the agent workspace. Adding PostgreSQL is more operational overhead than a well-designed SQLite schema. At our scale (<100K nodes, as you note), SQLite is more than sufficient.",
      evidence: [
        "workq already proves SQLite works well for our multi-agent coordination",
        "No PostgreSQL infrastructure exists in current deployment",
        "SQLite with adjacency list handles <1M node graphs efficiently"
      ],
      proposed_resolution: "Start with SQLite + adjacency list. Define a clean abstraction layer so we can migrate to PostgreSQL or a graph DB later if scale demands it.",
      severity: "significant"
    }
  })

Tim concedes (partially):
  acp_respond({
    reply_to: "acp-msg-01JMR0...",
    type: "position.concede",
    payload: {
      position_id: "acp-msg-01JMQZ...",
      challenge_id: "acp-msg-01JMR0...",
      revised_position: "Use SQLite with adjacency list + clean abstraction layer, with PostgreSQL as the documented scaling path",
      what_changed_mind: "Valid point about operational overhead. We shouldn't add a new database to the stack when SQLite serves the scale. The abstraction layer means we don't lock ourselves in."
    }
  })

// ACP automatically broadcasts:
//   knowledge.push: "Decision: Knowledge graph storage will use SQLite with adjacency list, 
//   abstraction layer for future migration. [Agreed by Tim + Amadeus, 2026-02-21]"
```

### 14.3 Flow: Teamspace Creation and Coordinated Work

**Scenario:** David requests a coordinated effort to build the auth system refactor. Xavier creates a teamspace.

```
Xavier calls:
  acp_team({
    action: "create",
    name: "Auth System Refactor",
    goal: "Replace JWT-only auth with hybrid session cookies (web) + JWT (API) architecture. Deliver migration-safe implementation with zero downtime.",
    members: [
      { agent_id: "xavier", role: "coordinator" },
      { agent_id: "tim", role: "lead" },
      { agent_id: "roman", role: "contributor" },
      { agent_id: "claire", role: "contributor" },
      { agent_id: "sandy", role: "reviewer" },
      { agent_id: "amadeus", role: "advisor" }
    ]
  })

// ACP creates:
//   - Teamspace record in SQLite
//   - Directory: ~/.openclaw/workspace/_teams/auth-system-refactor/
//   - Files: TEAM.md, STATUS.md, DECISIONS.md
//   - Sends team.join notifications to all members
//   - Auto-subscribes all members to team-scoped ACP messages

Tim (as lead) records architecture decision:
  acp_team({
    action: "decide",
    team: "auth-system-refactor",
    decision: "Session cookies for web clients, JWT for API/machine clients. Both stored in unified sessions table.",
    rationale: "Cookies provide CSRF protection and httpOnly security for browsers. JWT is standard for API consumers. Unified storage simplifies session management."
  })

// ACP:
//   - Stores decision in teamspace_decisions table
//   - Appends to _teams/auth-system-refactor/DECISIONS.md
//   - Broadcasts to all team members as knowledge.push

Tim distributes work via task offers:
  acp_send({
    to: "roman",
    type: "task.offer",
    team: "auth-system-refactor",
    payload: {
      title: "Implement session cookie handler middleware",
      estimated_effort: "P1D",
      acceptance_criteria: ["Cookie set/read/validate", "httpOnly + Secure flags", "CSRF token rotation"]
    }
  })

  acp_send({
    to: "claire",
    type: "task.offer",
    team: "auth-system-refactor",
    payload: {
      title: "Implement JWT handler updates for dual-auth flow",
      estimated_effort: "PT8H",
      acceptance_criteria: ["JWT validation unchanged", "New session lookup fallback", "API client tests"]
    }
  })

// Both accept. Team STATUS.md auto-updates with active work assignments.
// Sandy subscribes to review-ready artifacts.
// Amadeus monitors for model/quality concerns via advisor role.
```

---

## 15. Phasing Plan

### Phase 1: Foundation (4-6 weeks)

**Goal:** Core messaging infrastructure. Agents can send, receive, and respond to typed messages.

**Deliverables:**
- [ ] ACP extension skeleton (following `workq` pattern)
- [ ] SQLite schema: `messages`, `delivery_log` tables
- [ ] Core tools: `acp_send`, `acp_respond`, `acp_query`, `acp_inbox`
- [ ] Delivery: inbox file (offline) + session injection (active agent)
- [ ] Rate limiting + circuit breakers
- [ ] CLI: `openclaw acp log`, `openclaw acp inbox <agent>`
- [ ] Message types: `status.*`, `knowledge.*`, `system.*`
- [ ] Agent onboarding docs + `AGENTS.md` template additions
- [ ] Unit + integration tests

**Dependencies:** Plugin SDK (`api.registerTool`, `api.registerCli`, `api.registerService`), SQLite runtime

**Risk:** Low — follows proven `workq` pattern.

**Effort estimate:** 1 senior engineer + 1 mid engineer, 4-6 weeks

### Phase 2: Negotiation + Handoff (4-6 weeks)

**Goal:** Structured task negotiation and lossless handoff.

**Deliverables:**
- [ ] Negotiation state machine + persistence (`negotiations` table)
- [ ] Tools: enhanced `acp_send` with `task.*` types
- [ ] Handoff protocol + persistence (`handoffs` table)
- [ ] Tool: `acp_handoff`
- [ ] Integration with `workq` for handoff ownership transfer
- [ ] Handoff context bundle rendering (writes human-readable markdown to receiver workspace)
- [ ] CLI: `openclaw acp negotiations`, `openclaw acp handoffs`
- [ ] Disagreement protocol (`position.*` types, `disagreements` table)
- [ ] Channel delivery for urgent/critical messages
- [ ] Wake trigger for high-priority messages
- [ ] Agent capability indexing (from `AGENTS.md`)
- [ ] Tests

**Dependencies:** Phase 1 complete, `workq` extension (for handoff integration)

**Risk:** Medium — negotiation state machine is the trickiest piece. Need to carefully handle edge cases (timeouts, concurrent negotiations, withdrawn offers).

**Effort estimate:** 1 senior + 1 mid, 4-6 weeks

### Phase 3: Teamspaces (4-6 weeks)

**Goal:** Persistent multi-agent teamspaces with roles, shared artifacts, and coordinated work.

**Deliverables:**
- [ ] Teamspace CRUD + persistence (`teamspaces`, `teamspace_members`, `teamspace_artifacts`, `teamspace_decisions` tables)
- [ ] Tool: `acp_team` (all actions)
- [ ] Subscription enhancement: auto-subscribe team members
- [ ] Teamspace workspace initialization (`_teams/<id>/` directory structure)
- [ ] Artifact versioning (version counter + archive copies)
- [ ] Artifact conflict detection
- [ ] Team status auto-generation (`STATUS.md` from active work items)
- [ ] CLI: `openclaw acp teams`, `openclaw acp team <id> status`
- [ ] Gateway WebSocket event emission (for Luis's dashboard)
- [ ] Tests

**Dependencies:** Phase 2 complete

**Risk:** Medium — artifact versioning and conflict detection need careful design. Teamspace lifecycle management (cleanup, archival) needs thoughtful defaults.

**Effort estimate:** 1 senior + 1 mid, 4-6 weeks

### Phase 4: Intelligence + Observability (4-6 weeks)

**Goal:** Smart routing, analytics, and dashboard integration.

**Deliverables:**
- [ ] Subscription model: topic-based and capability-based routing
- [ ] Smart delivery: priority-based multi-channel delivery
- [ ] ACP analytics: message volume, response times, negotiation outcomes, handoff success rates
- [ ] CLI: `openclaw acp metrics`
- [ ] Dashboard data API (JSON) for Luis's topology view
- [ ] Knowledge deduplication (content similarity within time window)
- [ ] Broadcast with capability matching (route to agents with matching declared capabilities)
- [ ] Default subscription auto-configuration based on org role
- [ ] Tests + performance benchmarks

**Dependencies:** Phase 3 complete, dashboard frontend (parallel work with Luis)

**Risk:** Low-Medium — mostly refinement and optimization on top of working infrastructure.

**Effort estimate:** 1 senior + 1 mid, 4-6 weeks

### Total Timeline: ~16-24 weeks (4-6 months)

```
Month 1-2:    Phase 1 (Foundation)
Month 2-3:    Phase 2 (Negotiation + Handoff)
Month 3-4:    Phase 3 (Teamspaces)
Month 4-5:    Phase 4 (Intelligence + Observability)
Month 5-6:    Stabilization, documentation, internal dogfooding
```

---

## 16. Dependency Analysis

### 16.1 Internal Dependencies

| Dependency | Required By | Status | Risk |
|---|---|---|---|
| Plugin SDK (`registerTool`, `registerCli`, `registerService`) | All phases | ✅ Exists (proven by `workq`) | None |
| SQLite runtime (`node:sqlite` or equivalent) | All phases | ✅ Exists (used by `workq`) | None |
| Session injection API (inject system messages into active sessions) | Phase 1+ | ⚠️ Needs verification — may exist but not documented for extension use | Low |
| Agent workspace filesystem access | Phase 1+ | ✅ Exists (extensions can read/write workspace files) | None |
| `workq` extension | Phase 2 (handoff integration) | 🔄 In development | Low — handoff works without workq, just lacks ownership transfer |
| Heartbeat trigger API (trigger agent wake) | Phase 2+ | ⚠️ Needs verification — heartbeat exists but may not be triggerable from extensions | Medium |
| Gateway WebSocket event emission | Phase 4 | ⚠️ Needs extension hook for custom event types | Medium |
| Channel `message` tool access from extensions | Phase 2+ | ⚠️ Needs verification — extensions may need API access to send channel messages | Medium |

### 16.2 External Dependencies

| Dependency | Required By | Status | Risk |
|---|---|---|---|
| None | — | — | — |

ACP has zero external dependencies. It's a pure extension built on existing OpenClaw primitives.

### 16.3 Cross-Workstream Dependencies

| Workstream | Relationship to ACP |
|---|---|
| **Luis: Dashboard / Mission Control** | ACP provides event data for topology view + real-time activity. Dashboard is a consumer, not a dependency. Parallel development. |
| **Luis: Agent Relationship Visualization** | ACP's teamspace membership + message flow data directly feeds the topology graph. |
| **Tim: Workflow Graphs** | ACP teamspaces could serve as the coordination layer for workflow graph nodes. Future integration, not a dependency. |
| **Tim: Tool Reliability Layer** | ACP's tool calls benefit from reliability (retries, validation). ACP can be a consumer of this layer when it ships. |
| **Amadeus: Intent Classifier** | Could be used for smart message routing (classifying what kind of ACP message to send). Future optimization. |
| **Amadeus: Model Telemetry** | ACP metrics contribute to overall agent observability. Parallel, not dependent. |
| **workq Extension** | ACP integrates with workq for handoff ownership transfer. Soft dependency — ACP works without it. |

### 16.4 Verification Tasks (Pre-Phase 1)

Before starting Phase 1 implementation, these capabilities need verification:

1. **Can an extension inject a system message into an active agent session?**  
   If yes → use for active delivery. If no → fall back to inbox file + next-turn pickup.

2. **Can an extension trigger an agent heartbeat/wake?**  
   If yes → use for urgent message delivery. If no → rely on natural wake cycles + channel notification.

3. **Can an extension emit custom events on the Gateway WebSocket?**  
   If yes → Phase 4 dashboard integration is straightforward. If no → use polling API.

4. **Can an extension call other extension's tools (e.g., workq tools)?**  
   If yes → handoff-workq integration is clean. If no → use CLI bridge or shared database access.

---

## 17. Open Questions & Future Work

### 17.1 Open Questions

1. **Message persistence duration.** How long should ACP messages be retained? Proposal: 90 days active, then archive. But negotiation threads and handoff records may need indefinite retention for audit.

2. **Cross-Gateway communication.** If/when OpenClaw supports multiple Gateways (distributed execution — Amadeus Idea #13), ACP needs a federation protocol. Not needed now, but architecture should not preclude it.

3. **Human participation in ACP.** Should humans be able to send ACP messages directly (e.g., David assigns a task via ACP instead of Slack)? This could unify the coordination layer but adds complexity. Proposal: defer to Phase 4+.

4. **Agent identity verification.** Currently, agent identity is derived from session context. If agents can impersonate each other (unlikely but possible in edge cases), ACP messages could be spoofed. Proposal: rely on Gateway session identity as source of truth.

5. **Message encryption.** Should ACP messages be encrypted at rest? For single-Gateway deployment this is probably overkill. For multi-Gateway or enterprise deployment, it may be required.

6. **Cost attribution.** ACP messages are "free" to send (they're tool calls in existing sessions), but they cause the recipient to process additional context (tokens). Should ACP track the token cost of message processing? Proposal: yes, in Phase 4 analytics.

### 17.2 Future Work (Post-Phase 4)

1. **ML-based message routing.** Use agent history and message content to predict which agents will be most interested/relevant for a given message.

2. **Automated team formation.** Given a goal description, ACP recommends a team composition based on agent capabilities and current workload.

3. **Cross-team coordination.** When multiple teamspaces have overlapping work, ACP detects potential conflicts or synergies.

4. **Natural language ACP interface.** Instead of agents constructing typed ACP messages, they describe what they want to communicate in natural language and ACP classifies and routes it.

5. **ACP analytics dashboard.** Dedicated view showing communication patterns, bottlenecks, knowledge flow, and coordination health.

6. **Agent reputation integration.** ACP negotiation outcomes (accept rates, handoff success, knowledge quality) feed into the agent reputation system (Amadeus Idea #7).

7. **Workflow graph integration.** ACP teamspaces become the coordination layer for Tim's durable workflow graphs (Tim Idea #1).

---

## Appendix A: Full SQLite Schema (Consolidated)

```sql
-- ACP Database Schema v1.0
-- File: ~/.openclaw/acp/acp.db

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

-- ============================================================
-- Core Messages
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,          -- UUID v7
  version       TEXT NOT NULL DEFAULT 'acp/1.0',
  from_agent    TEXT NOT NULL,
  to_agent      TEXT,                      -- NULL for broadcasts
  to_agents_json TEXT,                     -- JSON array for multi-recipient
  team          TEXT,                      -- Teamspace ID
  reply_to      TEXT,                      -- Parent message ID
  thread_id     TEXT,                      -- Conversation thread ID
  type          TEXT NOT NULL,             -- ACPMessageType
  topic         TEXT,
  priority      TEXT NOT NULL DEFAULT 'normal',
  payload_json  TEXT NOT NULL,
  context_json  TEXT,
  expires_at    TEXT,
  requires_response INTEGER DEFAULT 0,
  max_response_time TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX idx_messages_from ON messages(from_agent, created_at DESC);
CREATE INDEX idx_messages_to ON messages(to_agent, created_at DESC);
CREATE INDEX idx_messages_thread ON messages(thread_id, created_at);
CREATE INDEX idx_messages_type ON messages(type, created_at DESC);
CREATE INDEX idx_messages_topic ON messages(topic, created_at DESC);
CREATE INDEX idx_messages_team ON messages(team, created_at DESC);
CREATE INDEX idx_messages_priority ON messages(priority, created_at DESC);

-- ============================================================
-- Delivery Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id    TEXT NOT NULL,
  recipient     TEXT NOT NULL,
  channel       TEXT NOT NULL,             -- session | inbox | channel | wake
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | delivered | read | failed
  delivered_at  TEXT,
  read_at       TEXT,
  error         TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_delivery_message ON delivery_log(message_id);
CREATE INDEX idx_delivery_recipient ON delivery_log(recipient, status);

-- ============================================================
-- Subscriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriber    TEXT NOT NULL,
  filter_json   TEXT NOT NULL,             -- ACPSubscription.filter
  delivery      TEXT NOT NULL DEFAULT 'session',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX idx_subscriptions_subscriber ON subscriptions(subscriber, active);

-- ============================================================
-- Negotiations
-- ============================================================

CREATE TABLE IF NOT EXISTS negotiations (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL,
  from_agent    TEXT NOT NULL,
  to_agent      TEXT,
  type          TEXT NOT NULL,
  payload_json  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open',
  round         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  expires_at    TEXT
);

CREATE INDEX idx_negotiations_thread ON negotiations(thread_id);
CREATE INDEX idx_negotiations_status ON negotiations(status);
CREATE INDEX idx_negotiations_to ON negotiations(to_agent, status);

-- ============================================================
-- Handoffs
-- ============================================================

CREATE TABLE IF NOT EXISTS handoffs (
  id              TEXT PRIMARY KEY,
  thread_id       TEXT NOT NULL,
  from_agent      TEXT NOT NULL,
  to_agent        TEXT NOT NULL,
  title           TEXT NOT NULL,
  reason          TEXT NOT NULL,
  context_json    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'initiated',
  work_item       TEXT,
  initiated_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  resolved_at     TEXT,
  resolution_notes TEXT
);

CREATE INDEX idx_handoffs_from ON handoffs(from_agent, status);
CREATE INDEX idx_handoffs_to ON handoffs(to_agent, status);
CREATE INDEX idx_handoffs_status ON handoffs(status);
CREATE INDEX idx_handoffs_work_item ON handoffs(work_item);

-- ============================================================
-- Knowledge
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge (
  id            TEXT PRIMARY KEY,
  from_agent    TEXT NOT NULL,
  topic         TEXT NOT NULL,
  summary       TEXT NOT NULL,
  detail        TEXT,
  confidence    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  expires_at    TEXT,
  superseded_by TEXT,
  tags_json     TEXT DEFAULT '[]'
);

CREATE INDEX idx_knowledge_topic ON knowledge(topic);
CREATE INDEX idx_knowledge_from ON knowledge(from_agent);
CREATE INDEX idx_knowledge_created ON knowledge(created_at DESC);

-- ============================================================
-- Disagreements
-- ============================================================

CREATE TABLE IF NOT EXISTS disagreements (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL,
  type          TEXT NOT NULL,
  agent_id      TEXT NOT NULL,
  topic         TEXT NOT NULL,
  payload_json  TEXT NOT NULL,
  resolution    TEXT,
  resolved_at   TEXT,
  resolved_by   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX idx_disagreements_thread ON disagreements(thread_id);
CREATE INDEX idx_disagreements_topic ON disagreements(topic);
CREATE INDEX idx_disagreements_resolution ON disagreements(resolution);

-- ============================================================
-- Teamspaces
-- ============================================================

CREATE TABLE IF NOT EXISTS teamspaces (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  goal            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  workspace_path  TEXT NOT NULL,
  config_json     TEXT DEFAULT '{}',
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE TABLE IF NOT EXISTS teamspace_members (
  teamspace_id  TEXT NOT NULL,
  agent_id      TEXT NOT NULL,
  role          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  joined_at     TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  PRIMARY KEY (teamspace_id, agent_id),
  FOREIGN KEY (teamspace_id) REFERENCES teamspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teamspace_artifacts (
  id              TEXT PRIMARY KEY,
  teamspace_id    TEXT NOT NULL,
  path            TEXT NOT NULL,
  description     TEXT,
  last_modified_by TEXT NOT NULL,
  last_modified_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  version         INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (teamspace_id) REFERENCES teamspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teamspace_decisions (
  id            TEXT PRIMARY KEY,
  teamspace_id  TEXT NOT NULL,
  decision      TEXT NOT NULL,
  rationale     TEXT,
  made_by       TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  FOREIGN KEY (teamspace_id) REFERENCES teamspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_ts_members_agent ON teamspace_members(agent_id);
CREATE INDEX idx_ts_artifacts_team ON teamspace_artifacts(teamspace_id);
CREATE INDEX idx_ts_artifacts_modified ON teamspace_artifacts(last_modified_at DESC);
CREATE INDEX idx_ts_decisions_team ON teamspace_decisions(teamspace_id, created_at DESC);

-- ============================================================
-- Agent Capabilities (cached from AGENTS.md)
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_capabilities (
  agent_id        TEXT PRIMARY KEY,
  capabilities_json TEXT NOT NULL,         -- JSON array of capability strings
  tier            TEXT,                    -- c-suite | architecture | senior | mid | etc.
  last_indexed_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- ============================================================
-- Rate Limiting
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  agent_id      TEXT NOT NULL,
  action_type   TEXT NOT NULL,             -- send | broadcast | handoff | etc.
  window_start  TEXT NOT NULL,
  count         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (agent_id, action_type, window_start)
);

-- ============================================================
-- Schema Metadata
-- ============================================================

CREATE TABLE IF NOT EXISTS acp_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO acp_meta (key, value) VALUES ('schema_version', '1');
INSERT OR IGNORE INTO acp_meta (key, value) VALUES ('protocol_version', 'acp/1.0');
```

---

## Appendix B: ACP CLI Reference

```
openclaw acp <command>

Commands:
  openclaw acp log [options]                 Show ACP message log
    --from <agent>                           Filter by sender
    --to <agent>                             Filter by recipient
    --type <type>                            Filter by message type
    --topic <topic>                          Filter by topic
    --team <team>                            Filter by teamspace
    --since <iso>                            Messages after this time
    --limit <n>                              Max results (default: 50)
    --json                                   Output as JSON

  openclaw acp inbox <agent>                 Show pending messages for an agent
    --types <types>                          Filter by message types (comma-separated)
    --limit <n>                              Max results (default: 20)

  openclaw acp negotiations [options]        Show active negotiations
    --status <status>                        Filter by status
    --agent <agent>                          Filter by participant
    --json                                   Output as JSON

  openclaw acp handoffs [options]            Show handoff history
    --status <status>                        Filter by status
    --from <agent>                           Filter by sender
    --to <agent>                             Filter by receiver
    --json                                   Output as JSON

  openclaw acp teams [options]               List teamspaces
    --status <status>                        Filter by status
    --member <agent>                         Filter by member
    --json                                   Output as JSON

  openclaw acp team <id> [command]           Teamspace operations
    status                                   Show team status
    members                                  List team members
    artifacts                                List team artifacts
    decisions                                List team decisions
    log                                      Show team message log

  openclaw acp metrics [options]             Show ACP metrics
    --period <period>                        Time period (1h, 24h, 7d, 30d)
    --agent <agent>                          Filter by agent
    --json                                   Output as JSON

  openclaw acp subscriptions [options]       Show active subscriptions
    --agent <agent>                          Filter by subscriber
    --json                                   Output as JSON
```

---

## Appendix C: Design Decision Record

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| **SQLite for persistence** | Proven by `workq`, zero external deps, WAL for concurrency | PostgreSQL (overkill), Redis (no durability), flat files (no queryability) |
| **Extension architecture** | Follows established pattern, zero core changes, installable | Core feature (invasive), separate service (operational overhead) |
| **8 tools** | Manageable context window impact, covers all interaction patterns | Fewer tools with more params (harder to learn), more tools (context bloat) |
| **Inbox files for offline delivery** | Human-readable, zero infrastructure, works with existing workspace model | Database-only (agents can't inspect), channel-only (noisy) |
| **Typed message envelopes** | Prevents freeform chaos, enables machine processing, ensures auditability | Freeform text (lossy, unparseable), protocol buffers (overkill) |
| **Rate limits by default** | Prevents runaway agent-to-agent message storms | No limits (unsafe), per-message approval (too slow) |
| **Max 3 negotiation rounds** | Prevents infinite back-and-forth, forces resolution | No limit (agents could loop), 1 round (too rigid) |
| **Max 2 disagreement rounds** | Disagreements should resolve or escalate quickly | Extended debate (expensive, unproductive for agents) |
| **Handoff context bundle is mandatory** | The whole point of structured handoff is preventing context loss | Optional context (enables lazy handoffs that defeat the purpose) |
| **Team workspaces under `_teams/`** | Clean separation, doesn't pollute agent workspaces | In agent workspaces (confusing ownership), in `_shared/` (too broad) |

---

*This specification represents the most important architectural work on OpenClaw's roadmap. Multi-agent coordination is our core differentiator, and ACP is the protocol that makes it real. The phased approach means we start delivering value in 4-6 weeks while building toward a comprehensive coordination system over 4-6 months.*

*Every design decision prioritizes minimal invasiveness to the existing architecture, human visibility into agent communication, and practical utility over theoretical elegance.*

— Amadeus, Chief AI Officer  
2026-02-21
