# WORKSTREAM.md — workq Extension

_Mega-branch:_ `feat/workq-extension`
_Owner:_ **Tim** (VP Architecture)
_Created:_ 2026-02-21
_Last updated:_ 2026-02-22 08:41 MST

> Delete this entire directory (`_shared/workstreams/workq-extension/`) ONLY after `feat/workq-extension` is confirmed merged into `dgarson/fork`.

---

## Deliverable

A production-integrated `extensions/workq/` OpenClaw extension committed to repo and merged via mega-branch, now expanded into a **dual-purpose system**:

1. **Work queue/task coordination** across agents (claim/status/files/query/done/release/log/export)
2. **Per-agent inbox messaging** with required read→ack flow (`workq_inbox_read` + mandatory `workq_inbox_ack`)

**Architecture spec:** `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-architecture.md`  
**Implementation plan:** `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-implementation-plan.md`

---

## Design

Key decisions:

- Runtime storage: `node:sqlite` (`node:sqlite` chosen over native add-ons)
- Ownership identity: derive from runtime context (`ctx.agentId`), never self-asserted in tool input
- Current tool surface (implemented): 8 tools for work queue operations
- Gateway surface (integration in progress): register `workq.*` RPC handlers for ACP/A2A interoperability
- Dual-purpose expansion: add inbox schema + `workq_inbox_send/read/ack` contract with mandatory ack discipline

---

## Strategy

1. Integrate existing extension code into tracked repo mega-branch
2. Register plugin/config + gateway RPC surface
3. Add runtime portability + Claude Code discoverability docs
4. Define hardening backlog (safety/reliability for concurrent multi-agent use)
5. Define efficiency backlog (reduce tool round-trips and stale work)
6. Define dual-purpose inbox schema/tools + heartbeat integration policy
7. Execute roadmap groups in parallelized squad slices

---

## Tasks & Status

See source board: `/Users/openclaw/.openclaw/workspace/_shared/WORKBOARD.md`

| Task                                                               | Owner          | Status                 | Notes                                                                                                                                                                        |
| ------------------------------------------------------------------ | -------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create mega-branch `feat/workq-extension` from `dgarson/fork`      | Tim            | ✅ Done                | Branch created + pushed                                                                                                                                                      |
| Copy extension code from `~/.openclaw/extensions/workq/` into repo | Tim            | ✅ Done                | Copied all required files (excluding `node_modules`, lockfile)                                                                                                               |
| Add `extensions/workq/tsconfig.json`                               | Sandy          | 🟣 In review           | Completed on retry lane with commit `008274f6d94fc116d15000f9ee4d17de37c391ee`; attached to PR #54 (`feat/workq-extension`) for consolidated review                          |
| Register `workq.*` gateway RPC methods                             | Oscar (+Sandy) | 🟣 In review           | Completed on retry lane with commit `d332135c426793b5e951368b961b6163332457b3`; attached to PR #54 (`feat/workq-extension`) for consolidated review                          |
| Pi runtime validation + README notes                               | Wes            | 🟣 In review           | Completed in-session (commit `dce4c9cef3c589867a4c3bc8f8b709a5051cd901`) with README Pi/ARM portability updates; landed on existing PR #54 for `feat/workq-extension` review |
| Claude Code opt-in docs (`CLAUDE.md`)                              | Nate           | 🟣 In review           | Completed on retry lane with commit `1df2acb4c`; attached to PR #54 (`feat/workq-extension`) for consolidated review                                                         |
| Config registration (`plugins.workq.*`)                            | Tim            | 🔴 Blocked (Sequenced) | Sequencing enforced: execute after plugin schema registration lands (from Sandy/Oscar lane integration), then apply `plugins.workq.*` config and validate CLI acceptance     |
| Dual-purpose inbox design docs                                     | Tim            | ✅ Done                | Added below in this file + SKILL.md created                                                                                                                                  |

---

## Hardening Backlog (Phase B)

Top 4 hardening items for tool/MCP integration:

1. **Versioned migration runner + startup schema gate**
   - **Why:** Prevent silent drift/corruption as inbox tables and future columns evolve.
   - **Action:** Add monotonic migrations table (`schema_migrations`), transactional migration execution, and startup fail-fast if migration incomplete.

2. **Idempotency keys for mutating calls (`claim`, `done`, `inbox_ack`)**
   - **Why:** Retries are common in agent/tool pipelines; duplicate state transitions create data ambiguity.
   - **Action:** Optional `requestId` on writes, dedupe table keyed by (`agent_id`,`request_id`,`operation`) with replay-safe response.

3. **Standardized error taxonomy for tools + gateway RPC**
   - **Why:** Agents need machine-actionable failures (`NOT_OWNER`, `INVALID_TRANSITION`, `CONFLICT`, `NOT_FOUND`, `DB_UNAVAILABLE`) instead of free-form strings.
   - **Action:** Introduce canonical `code` + `message` + `retryable` fields and keep consistent across tool + RPC handlers.

4. **WAL/locking policy with periodic checkpointing under concurrency**
   - **Why:** Multi-agent writes can cause checkpoint starvation and transient lock spikes.
   - **Action:** enforce WAL mode, `busy_timeout`, periodic passive checkpoint, and metric surfacing for lock wait and checkpoint lag.

---

## Efficiency Backlog (Phase C)

Most impactful 5 improvements:

1. **Batched claim + file registration verification (keep and formalize)**
   - **Assessment:** Already implemented in tool input (`files[]` on `workq_claim`); make it explicit in RPC + docs/tests to ensure parity.

2. **Optimistic file conflict warnings on claim (verify + preserve)**
   - **Assessment:** Existing claim warning path appears wired; keep non-blocking warning semantics and add deterministic warning code for automation.

3. **Stale-item auto-notification via inbox**
   - **Assessment:** High operational leverage; stale ownership should generate inbox alerts to assignee and optional squad lead after threshold.

4. **Compound query shortcuts (`my_active`, `mine_stale`, `squad_open`)**
   - **Assessment:** Reduces filter boilerplate and token usage; add enum shortcuts mapped internally to full query predicates.

5. **Response shaping (`fields[]` / default-minimal)**
   - **Assessment:** Most calls only need a few fields; default compact payload improves latency and reduces context pressure.

---

## Dual-Purpose Inbox Design (Phase D)

### Schema Extension

```sql
CREATE TABLE inbox_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id TEXT NOT NULL,
  sender_id    TEXT NOT NULL,
  message_type TEXT NOT NULL,
  subject      TEXT,
  payload_json TEXT NOT NULL,
  priority     TEXT NOT NULL DEFAULT 'normal',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  read_at      TEXT,
  acked_at     TEXT,
  expires_at   TEXT
);
CREATE INDEX idx_inbox_recipient ON inbox_messages(recipient_id, acked_at);
CREATE INDEX idx_inbox_broadcast ON inbox_messages(message_type, acked_at) WHERE message_type = 'broadcast';
```

### Tool Contracts

1. **`workq_inbox_send`**  
   Input: `{ to: string | string[], messageType, subject?, payload, priority?, expiresIn? }`  
   Output: `{ sent: number, messageIds: number[] }`

2. **`workq_inbox_read`**  
   Input: `{ unreadOnly?: boolean, limit?: number, includeExpired?: boolean }`  
   Agent identity must come from `ctx.agentId`  
   Behavior: set `read_at` for newly surfaced messages  
   Output: `{ messages: InboxMessage[], unreadCount: number }`

3. **`workq_inbox_ack`**  
   Input: `{ messageIds: number[] }` or `{ all: true }`  
   Output: `{ acked: number }`  
   **Policy:** required after reading/processing

### Heartbeat Integration Policy

Add this section to all `HEARTBEAT.md` files:

```markdown
## workq Inbox Check

Call `workq_inbox_read` to check for pending messages. Process each one.
After processing, call `workq_inbox_ack` with the message IDs. This is REQUIRED.
```

For agents without `HEARTBEAT.md`, add this to `AGENTS.md`:

```markdown
## workq Inbox

You have a workq inbox. During any idle check or when triggered, call `workq_inbox_read`
to check for pending messages from other agents or the system. After processing each
message, call `workq_inbox_ack` with the message IDs — this is mandatory.
```

---

## Roadmap: 10 Implementation Groups (Phase E)

| #   | Group                           | Deliverable                                                            | Dependencies | Suggested Owner                   | Est. Squad Size |
| --- | ------------------------------- | ---------------------------------------------------------------------- | ------------ | --------------------------------- | --------------- |
| 1   | Branch & Repo Integration       | Mega-branch created, extension code copied, PR opened                  | None         | Tim                               | 1               |
| 2   | Plugin Registration & Config    | `plugins.workq.*` config path + gateway load validation                | Group 1      | Sandy                             | 2               |
| 3   | Gateway RPC Methods             | `workq.claim/release/query/status/done/files/log` exposed in gateway   | Group 1      | Oscar                             | 2               |
| 4   | Pi Runtime & Claude Code Opt-in | Pi runtime validation + README + `CLAUDE.md`                           | Groups 1–2   | Wes + Nate                        | 2               |
| 5   | Inbox Schema & Database Layer   | `inbox_messages` schema, indexes, migration wiring, TTL cleanup policy | Group 1      | Tony                              | 2               |
| 6   | Inbox Tool Surface              | `workq_inbox_send/read/ack` tool APIs with ctx-based identity          | Group 5      | Barry                             | 2               |
| 7   | Heartbeat + Skill Integration   | HEARTBEAT/AGENTS updates + `skills/workq/SKILL.md`                     | Groups 5–6   | Claire                            | 2               |
| 8   | Advanced Routing                | Broadcast, squad-targeted routing, urgent handling/threading strategy  | Group 6      | Roman                             | 2               |
| 9   | Testing & Reliability           | Inbox tests + idempotency + error codes + WAL/concurrency              | Groups 3,5,6 | Larry                             | 3               |
| 10  | Observability & Analytics       | OTel spans, queue-depth metrics, stale alert dashboards                | Groups 3,6,9 | Xavier (with observability squad) | 2               |

---

## Squad Dispatch Log

- 2026-02-22 07:20 MST — Sandy re-dispatched (`agent:sandy:subagent:44983536-bfcc-44ee-9c95-60752508f02a`): `extensions/workq/tsconfig.json`; branch `feat/workq-extension`; PR target `feat/workq-extension`.
- 2026-02-22 07:20 MST — Oscar re-dispatched (`agent:oscar:subagent:272a3206-71e3-4528-b426-b54c42270e18`): gateway `workq.*` RPC methods; branch `feat/workq-extension`; PR target `feat/workq-extension`.
- 2026-02-22 07:20 MST — Wes re-dispatched (`agent:wes:subagent:53240a0f-f1c0-45cf-a504-127ee2b9b067`): Pi runtime compatibility + README notes; branch `feat/workq-extension`; PR target `feat/workq-extension`.
- 2026-02-22 07:20 MST — Nate re-dispatched (`agent:nate:subagent:3adcd6e2-8b20-4822-8cf4-af566a881ebc`): `extensions/workq/CLAUDE.md`; branch `feat/workq-extension`; PR target `feat/workq-extension`.
- 2026-02-22 07:22 MST — Sandy retry dispatched after rate-limit (`agent:sandy:subagent:b6cc2eca-ad9d-4d77-98a7-6c584a6ad3a4`) using GLM.
- 2026-02-22 07:22 MST — Oscar retry dispatched after rate-limit (`agent:oscar:subagent:b77c6f83-2c51-4c36-b67d-8aa0e0e5644b`) using GLM.
- 2026-02-22 07:22 MST — Nate retry dispatched after rate-limit (`agent:nate:subagent:c1cc3a67-8196-468b-bd48-c8445f6c2e75`) using GLM.
- 2026-02-22 07:26 MST — Wes lane moved to in-review after completion on `agent:wes:subagent:53240a0f-f1c0-45cf-a504-127ee2b9b067` (commit `dce4c9cef3c589867a4c3bc8f8b709a5051cd901`; update attached to PR #54).
- 2026-02-22 07:29 MST — Reviewer ping sent to Tim (`agent:tim:main`) for PR #54 in-review lane; Tim confirmed review pass posted and classified Wes scope as approved pending global CI/integration checks.
- 2026-02-22 07:29 MST — Temporary routing override: remove `gpt-5.3-codex-spark` from redispatch pool for workq lanes due to usage-limit failures; use `glm-5` / `MiniMax-M2.5` until quota recovery to prevent churn.
- 2026-02-22 08:00 MST — Lane completions confirmed from retry sessions: Sandy (`008274f6d94fc116d15000f9ee4d17de37c391ee`), Oscar (`d332135c426793b5e951368b961b6163332457b3`), Nate (`1df2acb4c`) all attached to PR #54 and moved to `In review`.
- 2026-02-22 08:00 MST — Reviewer ping executed to Tim (`agent:tim:main`); consolidated review pass posted on PR #54 (`issuecomment-3941139843`), pending global CI/integration checks.
- 2026-02-22 08:30 MST — Reviewer ping refresh executed to Tim (`agent:tim:main`); blocker check confirms PR #54 still unmergeable pending required checks (`docs-scope`, `secrets`, `actionlint`, `label`, `label-issues`, `no-tabs`). Merge path remains: checks green → final sequencing sanity (`plugins.workq.*` gate) → merge → close in-review lanes.
- 2026-02-22 08:41 MST — Tim reconfirmed blocker state and merge path for PR #54; no new lane-level quality blockers introduced. PR #54 is operating as the integration PR (`feat/workq-extension` → `dgarson/fork`).
- Sequencing note: Tim’s `plugins.workq.*` config registration remains blocked until schema registration lands; do not attempt config set before plugin schema acceptance is merged/available.

---

## Open Questions / Blockers

1. **Config schema gate:** `openclaw config set plugins.workq.enabled true` currently fails with `Unrecognized key: workq`; requires plugin schema registration path or plugin load before config accepts key.
2. **RPC naming parity:** tools are currently snake_case (`workq_claim`) while gateway RPC target is dotted (`workq.claim`)—intentional but must be clearly documented.
3. **Inbox ack enforcement mode:** hard-fail on next read vs soft warning; decision required before rollout.
4. **Heartbeat inbox execution gap:** `openclaw workq` CLI currently has no `inbox` subcommand, so heartbeat-required `workq_inbox_read/ack` flow cannot be executed from this runtime until inbox tool surface is wired/exposed.
