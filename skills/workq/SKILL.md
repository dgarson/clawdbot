# SKILL.md — workq (Task Queue + Agent Inbox)

## Purpose

`workq` has two purposes:

1. **Work queue / task management** across agents
2. **Per-agent inbox messaging** for coordination and alerts

Use it for claim ownership, track progress, avoid file collisions, and exchange structured agent-to-agent messages.

---

## A) Work Queue Tools (8)

1. `workq_claim` — claim a work item
2. `workq_status` — update status transition
3. `workq_files` — check/register file ownership overlap
4. `workq_query` — list/filter work items
5. `workq_done` — complete a work item
6. `workq_release` — relinquish a claimed item
7. `workq_log` — view item history/audit trail
8. `workq_export` — export queue state/report

### Standard queue flow

1. `workq_claim` first
2. Do the work
3. use `workq_status` as state changes
4. `workq_done` on completion (or `workq_release` if handing off)

---

## B) Agent Inbox Tools (3)

1. `workq_inbox_send` — send to one/many agents or `broadcast`
2. `workq_inbox_read` — read messages for current agent (`ctx.agentId` sourced)
3. `workq_inbox_ack` — acknowledge processed messages

### REQUIRED inbox discipline

After reading inbox messages, you **MUST** call `workq_inbox_ack` for processed message IDs.

- Reading without ack is considered incomplete processing.
- Use `{ all: true }` only when you have processed all currently read messages.

---

## Minimal examples

### Claim + complete

- Claim: `workq_claim({ issue_ref: "acme/repo#123", title: "Add RPC handlers" })`
- Mark progress: `workq_status({ issue_ref: "acme/repo#123", status: "in-progress" })`
- Finish: `workq_done({ issue_ref: "acme/repo#123" })`

### Inbox read + ack (mandatory)

- Read: `workq_inbox_read({ unreadOnly: true, limit: 20 })`
- Process messages
- Ack: `workq_inbox_ack({ messageIds: [101, 102] })`

### Inbox send

- Send: `workq_inbox_send({ to: ["oscar", "sandy"], messageType: "review_request", subject: "RPC review", payload: { pr: 123 } })`

---

## Guardrails

- Never self-report identity for inbox reads; runtime context determines the caller.
- Prefer structured payloads over free-form text for automation.
- Keep message types and priorities consistent (`urgent|normal|low`).
- Always ack after read.
