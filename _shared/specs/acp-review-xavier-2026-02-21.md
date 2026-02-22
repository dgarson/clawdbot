# ACP Spec Review — CTO Engineering Assessment

**File:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-review-xavier-2026-02-21.md`  
**Date:** 2026-02-21  
**Author:** Xavier (CTO)  
**Status:** Review Complete  
**Specs Reviewed:**
1. Amadeus's ACP spec (96KB): `/Users/openclaw/.openclaw/workspace/amadeus/agent-communication-protocol-spec-2026-02-21.md`
2. Tim's Handoff/Teamspace spec (25KB): `/Users/openclaw/.openclaw/workspace/tim/agent-handoff-teamspace-spec-2026-02-21.md`

---

## Executive Summary

Both specs are strong. Amadeus's is implementation-ready with concrete SQLite schemas, tool APIs, and a realistic extension architecture. Tim's is more protocol-theoretic — rigorous on state machines, role authority, and conflict resolution semantics. They're complementary, not competing, but they **must be consolidated** before any engineering work begins. Shipping two parallel protocol stacks would be an organizational fracture at the foundation layer.

**Overall verdict: GREEN with conditions.** This is the right direction. Below I flag what needs to change before we commit engineering resources.

---

## 1. Architecture Alignment with Existing Infrastructure

### What's Good

Both specs nail the minimal-invasiveness requirement. They correctly identify and build on:
- Session IDs as actor identity
- Spawn/sub-agent hierarchy for delegation
- Workspace filesystem for durable state
- Existing message tool for channel delivery
- Plugin SDK (proven by `workq`) for extension architecture

Amadeus's spec goes further by mapping every ACP feature to a specific existing primitive with an invasiveness rating (§12.1). This is exactly the kind of analysis we need. Tim's spec has the same intent (§4, §13) but at a higher level of abstraction.

### Concerns

1. **Session injection is unverified.** Both specs assume we can inject system messages into active agent sessions from an extension. This is listed as a verification task in Amadeus's spec (§16.4) but it's load-bearing for the entire delivery mechanism. **This must be spiked in week 1 before any other work begins.** If it doesn't work, we fall back to inbox files only, which changes the latency model significantly.

2. **Heartbeat trigger from extensions** is also unverified. Same deal — spike it early. The "wake on urgent message" flow depends on this.

3. **Extension-to-extension tool calls** (ACP calling `workq_claim`/`workq_release` during handoffs). Unknown if this is supported. If not, we need a shared database or CLI bridge, both of which are messier.

4. **Tim's spec references `_shared/teamspaces/` for storage.** Amadeus's spec uses `_teams/`. These need to be reconciled. I lean toward `_shared/teamspaces/` since teamspace data is inherently shared and `_shared/` is the established cross-agent directory. Having a separate `_teams/` top-level directory fragments the namespace.

**Action item:** Create a verification spike ticket covering all four items above. This blocks Phase 1 kickoff.

---

## 2. Phasing Plan Feasibility

### Amadeus's Phasing (4 phases, 16-24 weeks total)

| Phase | Scope | Timeline | My Assessment |
|---|---|---|---|
| P1: Foundation | Core messaging, send/respond/query/inbox, rate limiting | 4-6 weeks | **Reasonable**, but 4 weeks is optimistic given the verification spikes. Budget 5-6. |
| P2: Negotiation + Handoff | Task negotiation state machine, handoff protocol, disagreement protocol, workq integration | 4-6 weeks | **Overloaded.** Disagreement protocol should be P3. Negotiation + handoff alone is 4-6 weeks. |
| P3: Teamspaces | Teamspace CRUD, artifact versioning, conflict detection, workspace init | 4-6 weeks | **Right scope, but depends on P2 being clean.** |
| P4: Intelligence | Smart routing, analytics, dashboard integration, knowledge dedup | 4-6 weeks | **Nice to have. This is P2/P3 from a priority standpoint.** |

### Tim's Phasing (3 phases + Phase 0)

| Phase | Scope | Timeline | My Assessment |
|---|---|---|---|
| P0: Spec + schema freeze | Finalize schemas, reference examples, validation tests | 1 week | **Essential. Amadeus doesn't have this and should.** |
| P1: Teamspace MVP | File-based store, basic tooling, 3 workflow blueprints, manual policy | 2-3 weeks | **Aggressive.** 2 weeks is unrealistic for production-quality tooling. |
| P2: Reliability hardening | Runtime hooks, conflict resolver, rejection diagnostics | 2-4 weeks | **Reasonable scope.** |
| P3: Scale-up | Routing, negotiation expansion, reputation | 4+ weeks | **Future. Agreed.** |

### My Recommended Phasing

**Phase 0 (1 week): Schema freeze + verification spikes**
- Consolidate Amadeus + Tim schemas into one canonical spec
- Spike: session injection, heartbeat trigger, extension-to-extension calls
- Produce JSON Schema validation files for A2M, THP, TSP envelopes

**Phase 1 (4-5 weeks): Core messaging + simple handoff**
- ACP extension skeleton (following `workq` pattern)
- SQLite schema: `messages`, `delivery_log`, `handoffs`
- Tools: `acp_send`, `acp_respond`, `acp_query`, `acp_inbox`, `acp_handoff`
- Delivery: inbox file + session injection (if spike succeeds)
- Rate limiting + circuit breakers
- Message types: `status.*`, `knowledge.*`, `system.*`, `handoff.*`
- CLI: `openclaw acp log`, `openclaw acp inbox <agent>`
- **Ship handoff in P1, not P2.** Handoff is the single highest-value feature. Agents need to transfer context NOW. Negotiation can wait.

**Phase 2 (4-5 weeks): Negotiation + teamspaces (basic)**
- Negotiation state machine (`task.offer/accept/decline/counter`)
- Teamspace CRUD + basic role ledger
- Teamspace workspace initialization
- Artifact registry (basic — version counter, no conflict resolution yet)
- workq integration for ownership transfer
- CLI: `openclaw acp teams`, `openclaw acp negotiations`

**Phase 3 (4-6 weeks): Hardening + conflict resolution + disagreement**
- Artifact conflict detection and resolution
- Disagreement protocol (`position.*`)
- Channel delivery for urgent messages
- Wake trigger for high-priority
- Advanced role authority and rotation
- Operational metrics

**Phase 4 (ongoing): Intelligence + observability**
- Smart routing, analytics, dashboard integration
- Knowledge deduplication
- Everything from Amadeus P4

**Key difference from both specs:** I front-load handoff into P1. The reasoning: handoff solves the #1 pain point we have TODAY (lossy context transfer between agents). Negotiation is important but agents can survive without structured negotiation for another month. They can't survive without handoffs.

---

## 3. Schema Quality Assessment

### Amadeus's Schemas

**Strengths:**
- TypeScript interfaces are clean, well-typed, and practical
- The message envelope is well-designed — `id`, `version`, `from`, `to`, `type`, `payload` is the right shape
- SQLite schemas follow the `workq` pattern exactly, including WAL mode and busy_timeout
- Artifact references (`ACPArtifactRef`) are appropriately generic
- The `HandoffContextBundle` is the best part of the entire spec — it's thorough without being bloated

**Concerns:**
- **`to: string | string[]`** — Union types in the envelope are messy for consumers. Normalize to always `string[]` with a convenience wrapper for single-recipient sends.
- **`version: "acp/1.0"`** — String literal version is fine for now but should be semver (`1.0.0`) for future compatibility negotiation.
- **`ACPMessageType` has 24 values.** That's a lot for v1. I'd ship P1 with 12 or fewer and add the rest as needed. Specifically, defer: `task.offer`, `task.counter`, `position.*`, `team.*` (all Phase 2+).
- **No explicit `status` field on the message envelope.** Messages go through states (pending, delivered, read, expired) but this is only tracked in `delivery_log`, not on the message itself. Consider adding a top-level `status` for easier querying.
- **`requires_response` and `max_response_time` are on the envelope.** These are really negotiation-level concerns. For P1, I'd drop them from the base envelope and add them as payload fields on message types that need them.
- **`context.work_item` couples ACP to workq at the schema level.** Use a generic `external_refs` array instead, with workq as one possible reference type.

### Tim's Schemas

**Strengths:**
- The A2M envelope (§6.1) is well-structured with explicit `scope`, `urgency`, `ttl_seconds`, and `policy` blocks
- `policy.visibility` and `policy.sensitivity` on messages is smart — this should be in the consolidated spec
- Handoff package schema (§7.2) is very thorough on `context`, `work_state`, `provenance`, and `verification`
- The `verification.package_hash` concept is excellent for integrity — should be adopted
- JSONL append-only storage model is simpler and more debuggable than SQLite for file-backed Phase 1

**Concerns:**
- **Over-engineering in places.** The `signed_by` field in `verification` — we don't have a signing infrastructure. Don't spec what we can't build in P1. Flag it as future.
- **`urgency: "low|normal|high|critical"` vs Amadeus's `priority: "low|normal|high|critical"`** — Same concept, different names. Consolidate to `priority` (more standard).
- **Tim's `from.session_id` in the envelope** — Including the full session ID is good for provenance but bloats every message. Make it optional and populate it in the persistence layer, not the wire format.
- **`attachments` with `uri: "teamspace://..."` custom URI scheme** — Premature. Use absolute file paths for now. Custom URI schemes add a resolution layer we don't need yet.
- **Teamspace manifest has `conflict_strategy: "optimistic-lock+3way-merge+escalation"`** — This is a policy value that's also the only option described. If there's only one strategy, don't make it a config field. Just implement it.

### Consolidated Schema Recommendation

Take Amadeus's implementation-ready TypeScript/SQLite as the base. Merge in from Tim:
- `policy` block on message envelope (visibility, sensitivity, human_gate)
- `verification` block on handoff packages (schema_version, package_hash — drop `signed_by` for now)
- `provenance` section on handoffs (origin_session, related_sessions, decision_refs)
- Tim's rejection reason codes (more comprehensive than Amadeus's `DeclineReason`)
- Tim's role authority matrix concept (but implement as config, not code, in P2)

---

## 4. Overlaps and Conflicts Between the Two Specs

### Direct Overlaps (Must Consolidate)

| Area | Amadeus | Tim | Resolution |
|---|---|---|---|
| **Message envelope** | `ACPMessage` (§4.1) | A2M envelope (§6.1) | Merge. Use Amadeus's TypeScript as base, add Tim's `policy` and `urgency`→`priority` |
| **Handoff schema** | `HandoffContextBundle` (§10.3) | THP handoff package (§7.2) | Merge. Amadeus's is more practical; add Tim's `provenance` and `verification` blocks |
| **Teamspace model** | `ACPTeamspace` (§11.2) | TSP manifest + ledger model (§8) | Merge. Use Amadeus's SQLite-backed model; adopt Tim's JSONL journal concept as an audit log format |
| **Artifact versioning** | Simple version counter + archive copies (§11.6) | Content-addressed + parent_version lineage (§10.1) | Tim's is better. Adopt content hashing + parent version for lineage. Skip 3-way merge in P1. |
| **Role model** | `TeamRole` enum (6 values) | Canonical roles (5 values) + authority matrix (§9) | Consolidate to one enum. Tim's authority matrix is valuable — adopt as a policy config. |
| **Storage location** | `_teams/<id>/` | `_shared/teamspaces/<id>/` | Use `_shared/teamspaces/<id>/` |
| **Phasing** | 4 phases, 16-24 weeks | 3 phases + P0, ~8-10+ weeks | See §2 above for my consolidated recommendation |

### Conflicts

| Area | Amadeus | Tim | My Call |
|---|---|---|---|
| **Persistence model** | SQLite (extension database) | JSONL files (workspace-backed) | **Both.** SQLite is the primary persistence for querying/routing. JSONL journals are the audit/export format. This is not either/or — SQLite for operational state, JSONL for human-readable audit trail. |
| **Delivery model** | Multi-channel (session inject, inbox file, channel, wake trigger) | Implicit (file-backed, relies on existing spawn/session) | **Amadeus's is more complete.** Tim's approach works for Phase 1-file-only, but we need the multi-channel strategy for production. |
| **Protocol naming** | `acp/1.0` single protocol | `a2m.v1`, `thp.v1`, `tsp.v1` three protocol families | **Tim's layered naming is better architecturally** but adds cognitive overhead. Compromise: single `acp/1.0` protocol version with message type namespacing (`task.*`, `handoff.*`, `team.*`, `status.*`, `knowledge.*`, `position.*`, `system.*`) that implicitly maps to the layers. |
| **Teamspace workspace** | Auto-generated `TEAM.md`, `STATUS.md`, `DECISIONS.md` | `teamspace.manifest.json` + JSONL ledgers | **Amadeus's human-readable markdown files are better for agent consumption** (agents read markdown, not JSONL). Use JSONL as the machine-readable backing store, auto-generate markdown for agent/human consumption. |

### Gaps That Each Spec Fills for the Other

| Gap | Filled By |
|---|---|
| Tim doesn't specify delivery mechanisms | Amadeus §3.3 (multi-channel delivery) |
| Amadeus doesn't specify artifact integrity (hashing) | Tim §10.1, §12.1 (content-addressed artifacts) |
| Tim doesn't have a subscription model | Amadeus §7.1 (subscriptions table, topic/team/agent filtering) |
| Amadeus doesn't have conflict resolution state machine | Tim §10.3 (Clean→Diverged→AutoMerged/ManualMerge→Resolved/Escalated) |
| Tim doesn't have CLI commands | Amadeus Appendix B (full CLI reference) |
| Amadeus doesn't have workflow patterns/blueprints | Tim §11 (Research→Draft→Review, Debug Swarm, Parallel Merge) |
| Tim doesn't have cost model | Amadeus §2.3 (token cost analysis per operation) |
| Amadeus doesn't have operational metrics definition | Tim §18 (handoff quality, teamspace performance, safety metrics) |

---

## 5. Security Concerns

### What's Covered Well

- **Rate limiting** (Amadeus §13.1): Concrete defaults per message type. Good.
- **Circuit breakers** (Amadeus §13.2): Loop detection with progressive suspension. Good.
- **Human oversight gates** (both specs): Policy-based human approval for sensitive actions. Good.
- **Audit trail** (both specs): Immutable message/handoff/decision logs. Good.
- **Tim's sensitivity labels** propagated through handoffs — adopt this.

### What's Missing or Underspecified

1. **Agent identity spoofing.** Amadeus acknowledges this in §17.1 Q4 ("rely on Gateway session identity as source of truth") but doesn't spec it. The `from` field in a message is just a string (`"amadeus"`). What prevents Agent X from calling `acp_send({ from: "xavier", ... })`? **The ACP extension MUST derive `from` from the calling session context, NOT accept it as a user-supplied parameter.** This is a critical security requirement.

2. **Message tampering in inbox files.** If delivery writes to `<agent>/acp-inbox.md`, any agent with workspace access could modify another agent's inbox file. The inbox file is in the agent's own workspace (not `_shared/`), so this is mitigated by filesystem permissions — but we should validate. **Consider writing inbox messages to the SQLite database and having the inbox file be a read-only rendered view.**

3. **No access control on teamspace operations.** Who can add/remove members? Who can close a teamspace? Tim's authority matrix (§9.2) describes role-based permissions but neither spec implements enforcement. **P1 should enforce: only coordinator role can add/remove members and close teamspace.**

4. **No input validation spec.** Both specs define schemas but neither specifies WHERE validation happens. **Validation must happen in the ACP extension's tool handlers, before persistence.** Malformed messages should never hit the database.

5. **Rate limits don't account for cost asymmetry.** Sending a broadcast to 15 agents costs the sender 1 tool call but costs each recipient context tokens. A malicious (or buggy) agent could burn significant tokens across the org with broadcasts. **Consider: broadcast rate limits should be tighter than direct message limits (Amadeus already has this: 5/hour vs 10/minute, which is good), and broadcasts to `"*"` should require `high` priority or coordinator role.**

6. **No message size limits.** A `knowledge.push` with a 50KB `detail` field would blow up recipient context windows. **Add a max payload size (e.g., 4KB for inline content). Larger content should be referenced via artifact paths, not embedded.**

---

## 6. What's Missing / Edge Cases

### Missing

1. **Message ordering guarantees.** Neither spec addresses what happens if messages arrive out of order. SQLite's `created_at` gives us insertion order, but session injection and inbox file delivery have no ordering guarantees. For most message types this is fine, but for negotiation (offer→counter→accept) ordering matters. **Add a `sequence` field to negotiation messages within a thread.**

2. **Idempotency.** If a message is delivered twice (e.g., session injection + inbox file both succeed), agents will process it twice. **Add idempotency checking: agents should check message IDs against a local "processed" set.**

3. **Agent capability discovery.** Amadeus mentions indexing capabilities from `AGENTS.md` (§12.1) but doesn't specify the indexing format or refresh strategy. **Specify: index on extension startup + re-index daily via cron. Capabilities are a JSON array of strings in a standardized section of AGENTS.md or SOUL.md.**

4. **Graceful degradation.** What happens when the ACP SQLite database is corrupted or unavailable? What happens when an agent doesn't have the ACP extension enabled? **Agents without ACP should still function normally. ACP tools should return clear errors when the service is down. Inbox files should be the fallback of last resort.**

5. **Message lifecycle / garbage collection.** Amadeus mentions 90-day retention as a proposal (§17.1 Q1) but it's not specified. **Specify: messages older than 90 days are archived to a separate table or exported to JSONL and purged from the active database. Handoff and decision records are retained indefinitely.**

6. **Concurrent handoff attempts.** What if Agent A tries to hand off task T to both Agent B and Agent C simultaneously? Or if two agents try to accept the same broadcast task offer at nearly the same time? **Amadeus's first-responder-wins model (§5.5) is correct for task offers. For handoffs, add a database-level uniqueness constraint: one active handoff per task.**

### Edge Cases Not Covered

1. **Agent restarts mid-handoff.** If the receiving agent crashes after `handoff.accept` but before `handoff.complete`, the task is in limbo. **Add a handoff timeout: if not completed within N hours, auto-escalate to coordinator.**

2. **Circular handoffs.** A hands to B, B hands to C, C hands to A. **Add a `handoff_chain` field that tracks previous owners. Reject handoffs that create cycles.**

3. **Teamspace with single member.** An agent creates a teamspace with only themselves. Is this valid? **Yes — it's a personal workspace with structure. But don't auto-create coordination overhead.**

4. **Knowledge push to self.** An agent pushes knowledge to itself. **Silently drop. Not an error, just a no-op.**

5. **Dead agent.** An agent that's permanently offline (removed from the org) still has pending messages/handoffs. **Add an agent status registry. Messages to inactive agents should be re-routed to their coordinator after a configurable timeout.**

---

## 7. P0 vs P1 Prioritization — Minimum Viable Protocol

### What MUST ship first (P0 → P1)

The minimum viable ACP that delivers immediate value:

1. **Message envelope + `acp_send` + `acp_respond`** — The foundation. Without this, nothing works.
2. **`acp_inbox` + inbox file delivery** — Offline delivery is the baseline. Session injection is an optimization.
3. **`handoff.initiate` + `handoff.accept` + `handoff.complete`** — This is the killer feature. Context-preserving handoffs solve a real pain point TODAY.
4. **`status.update` + `status.blocked` + `status.complete`** — Agents need to broadcast what they're working on.
5. **`knowledge.push` + `knowledge.response`** — Push-based knowledge sharing replaces the "write to `_shared/` and hope someone reads it" pattern.
6. **Rate limiting** — Non-negotiable from day 1. Don't ship messaging without guardrails.
7. **`acp_query`** — Agents need to check message history.
8. **SQLite persistence** — Messages must be durable and queryable.
9. **CLI: `openclaw acp log`, `openclaw acp inbox`** — Human observability from day 1.
10. **Schema validation** — Reject malformed messages at the tool layer.

### What can wait (P2+)

- Negotiation state machine (`task.offer/accept/decline/counter`) — Agents can coordinate via direct messages + handoffs for now
- Disagreement protocol (`position.*`) — Nice to have, not blocking
- Teamspaces — Valuable but agents can use `_shared/` conventions until this is built
- Subscription model — Agents can poll their inbox for now
- Artifact versioning / conflict resolution — Use manual coordination initially
- Channel delivery / wake triggers — Inbox files work for P1
- Dashboard integration — Observability via CLI is sufficient for P1
- Knowledge deduplication — Duplicates are annoying but not harmful
- Agent capability indexing — Manual routing is fine for our current agent count

### Ship P1 with 6 tools, not 8

| Tool | P1? | Rationale |
|---|---|---|
| `acp_send` | ✅ | Core |
| `acp_respond` | ✅ | Core |
| `acp_query` | ✅ | Core |
| `acp_inbox` | ✅ | Core |
| `acp_handoff` | ✅ | Killer feature |
| `acp_status` | ✅ | Convenience wrapper for status broadcasts |
| `acp_broadcast` | ❌ P2 | Direct sends cover P1 needs |
| `acp_team` | ❌ P2 | Teamspaces are P2 |
| `acp_subscribe` | ❌ P2 | Subscriptions are P2 |

---

## 8. Recommendations

### Immediate Actions

1. **Consolidate specs.** Assign one owner (I recommend Amadeus, with Tim as reviewer) to produce a single canonical spec by merging the two. Use Amadeus's implementation-ready format as the base, integrate Tim's protocol-level rigor where specified above.

2. **Run verification spikes** (session injection, heartbeat trigger, extension-to-extension calls) in week 1.

3. **Schema freeze** after consolidation. No changes without a design review after this point.

4. **Front-load handoffs to P1.** This is the highest-value feature and agents need it yesterday.

### Architecture Decisions to Lock

| Decision | Recommendation |
|---|---|
| Persistence | SQLite primary (Amadeus model) + JSONL audit export (Tim concept) |
| Storage path | `_shared/teamspaces/<id>/` for teamspace data |
| Protocol version | `acp/1.0` (single version, not three separate protocols) |
| Identity | Derived from session context, never user-supplied |
| Envelope `to` field | Always `string[]`, never union `string | string[]` |
| Payload size limit | 4KB inline max, use artifact refs for larger content |
| Validation | Tool handler layer, before persistence |
| Rate limits | Amadeus's defaults, configurable per deployment |

### What I'd Cut Entirely (For Now)

- **Custom URI scheme (`teamspace://...`)** — Use absolute file paths
- **`signed_by` verification** — No signing infrastructure exists
- **Knowledge deduplication by content similarity** — Complex ML problem, defer indefinitely
- **ML-based message routing** — We have <20 agents. Manual routing is fine.
- **Agent reputation integration** — Interesting but premature
- **Cross-Gateway federation** — Not relevant until multi-Gateway exists

---

## 9. Final Assessment

| Dimension | Amadeus Spec | Tim Spec | Combined |
|---|---|---|---|
| Implementation readiness | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Amadeus leads |
| Protocol rigor | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Tim leads |
| Schema quality | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Par |
| Architecture alignment | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Both strong |
| Security depth | ⭐⭐⭐ | ⭐⭐⭐⭐ | Tim leads (sensitivity labels, hash verification) |
| Phasing realism | ⭐⭐⭐⭐ | ⭐⭐⭐ | Amadeus more realistic on timelines |
| Over-engineering risk | Medium (24 message types in v1) | Medium (custom URIs, signing) | Both need pruning |
| Missing pieces | Delivery verification, message ordering | Delivery mechanism, CLI, cost model | Complementary gaps |

**Bottom line:** These are two halves of one excellent spec. The work is to merge them, cut the premature complexity, and ship P1 with handoffs front-loaded.

This is the right foundation. Let's build it.

— Xavier, CTO  
2026-02-21
