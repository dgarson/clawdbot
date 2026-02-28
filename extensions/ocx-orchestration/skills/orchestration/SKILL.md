# Orchestration — Skill Guide

The `ocx-orchestration` extension gives agents a shared, persistent work-item board organized into sprints and teams. Coordinator agents use it to assign and track work; worker agents use it to claim items, report progress, and signal when they are blocked; reviewer agents use it to record verdicts. The system also runs a background monitor that auto-escalates items that time out, exceed budget thresholds, or accumulate repeated failures.

## Actions at a Glance

| Action           | What it does                                   | Required params                 |
| ---------------- | ---------------------------------------------- | ------------------------------- |
| `list_items`     | List work items, optionally filtered by sprint | —                               |
| `update_item`    | Update title, description, or state of an item | `workItemId`                    |
| `request_review` | Create a review request for a completed item   | `workItemId`, `reviewerAgentId` |
| `report_blocked` | Mark an item `blocked` and surface the reason  | `workItemId`, `reason`          |
| `sprint_status`  | Get a summary report for a sprint              | `sprintId`                      |

Gateway methods (used by operators or coordinator agents with direct gateway access) extend this surface with `orchestration.items.create`, `orchestration.items.delegate`, `orchestration.items.review` (for recording verdicts), `orchestration.sprints.*`, `orchestration.teams.*`, `orchestration.orgs.*`, and `orchestration.escalations.*`.

## Canonical Flow: list → update → request_review

A worker agent picks up assigned items and drives them to completion:

```
# 1. See what is assigned to you in the current sprint
orchestration(action='list_items', sprintId='sprint-abc')

# 2. Claim the item by moving it to in_progress
orchestration(action='update_item', workItemId='wi-11223344', state='in_progress')

# 3. Do the work, then signal it is ready for review
orchestration(action='update_item', workItemId='wi-11223344', state='in_review')

# 4. Request a reviewer
orchestration(action='request_review', workItemId='wi-11223344', reviewerAgentId='reviewer-agent')
```

After the reviewer records a verdict via `orchestration.items.review` (gateway), the coordinator sees the item move to `done` (approved) or back to `in_progress` / `backlog` (changes requested or rejected).

## Delegation Pattern

A coordinator delegates a work item to a worker agent and registers the delegation so the system can track it automatically. When the worker's subagent session ends, the `subagent_ended` hook fires and the delegation is completed or failed without any manual step.

```
# Coordinator registers the delegation (gateway method)
orchestration.items.delegate({
  workItemId: 'wi-11223344',
  fromAgentId: 'coordinator',
  toAgentId: 'worker-agent',
  sessionKey: 'session-xyz',   # session the worker is running in
  isolated: true               # true = decoupled session
})
```

The item state moves to `in_progress` immediately when the delegation is recorded. When the session ends:

- Outcome `ok` → delegation marked `completed`, item moves to `in_review`.
- Any other outcome → delegation marked `failed`, item moves to `blocked`.

The coordinator does not need to poll; it can call `orchestration(action='list_items')` to check the current state of all items at any point.

## Escalation

Escalation fires automatically when the background monitor detects:

- A work item stuck in `blocked` or `in_progress` beyond `escalationTimeoutMinutes` (default: 60 min).
- Budget utilization above `budgetRiskThreshold` (default: 80%).
- Consecutive tool failures above `maxConsecutiveFailures` (default: 3).

A worker that discovers it cannot make progress should report the block immediately rather than waiting for the monitor:

```
orchestration(action='report_blocked', workItemId='wi-11223344',
  reason='Dependency service is unreachable; cannot complete acceptance criterion 2.')
```

This sets the item to `blocked`, which the monitor will escalate to the team's configured `escalationTarget` (agent, team, or webhook). The coordinator can then re-assign, break the work down, or resolve the dependency before moving the item back to `ready`.

## Sprint Management

Sprints are created and transitioned via gateway methods. A typical sprint lifecycle:

```
# Create a sprint (gateway)
orchestration.sprints.create({ teamId: 'team-abc', name: 'Sprint 3' })

# Add a work item to the sprint (gateway)
orchestration.items.create({
  sprintId: 'sprint-xyz',
  title: 'Implement retry logic',
  description: 'Add exponential backoff to the HTTP client.',
  acceptanceCriteria: ['Tests pass', 'No unhandled rejections on 5xx'],
  assigneeAgentId: 'worker-agent'
})

# Check progress from any agent
orchestration(action='sprint_status', sprintId='sprint-xyz')

# Transition the sprint when all items are done (gateway)
orchestration.sprints.transition({ sprintId: 'sprint-xyz', targetState: 'review' })
```

Sprint states in order: `planning` → `active` → `review` → `retrospective` → `closed`.

## Failure and Retry

When a delegation fails (the subagent session ends with a non-ok outcome), the item moves to `blocked` automatically. The coordinator should:

1. Call `orchestration(action='list_items', sprintId='...')` to identify blocked items.
2. Diagnose the cause from the delegation's `outcome` field in the returned item.
3. Either re-delegate to a different agent or move the item back to `ready` for a fresh attempt:

```
# Reset a blocked item to ready for reassignment
orchestration(action='update_item', workItemId='wi-11223344', state='ready')

# Then re-delegate to a different worker (gateway)
orchestration.items.delegate({
  workItemId: 'wi-11223344',
  fromAgentId: 'coordinator',
  toAgentId: 'worker-agent-2',
  sessionKey: 'session-new',
  isolated: true
})
```

Do not retry more than `maxConsecutiveFailures` times without changing the approach; the monitor escalates after that threshold is reached.

## Anti-Patterns

- **Creating duplicate work items.** Always call `orchestration(action='list_items')` and scan existing items before creating a new one. Items with the same title in the same sprint are almost always duplicates.
- **Skipping `report_blocked`.** When stuck, report it immediately. Letting an item sit silently in `in_progress` delays escalation and wastes the sprint.
- **Over-escalating.** Use `report_blocked` only when genuinely blocked — not to avoid difficult work. Spurious blocks degrade signal quality for operators and coordinators.
- **Marking items `done` without a review.** Always call `request_review` after moving to `in_review`; bypassing review leaves acceptance criteria unchecked.
- **Transitioning sprints before items are resolved.** A sprint should only move to `review` when all items are `done` or explicitly cancelled; open blocked items carry unresolved debt into the retrospective.
- **Polling `sprint_status` in a tight loop.** Check sprint status at meaningful checkpoints (after a delegation completes, not on a timer); the monitor handles timeout escalation automatically.

## Key Rules

1. **Move items forward, not sideways.** The canonical path is `backlog` → `ready` → `in_progress` → `in_review` → `done`. Only move backward (e.g., to `ready`) when a review requests changes or a retry is warranted after a failure.
2. **Delegate via the gateway, track via the tool.** Use `orchestration.items.delegate` (gateway) to register a delegation; use `orchestration(action='list_items')` (agent tool) to read current state. Do not manually set state while a delegation is active.
3. **Report blocks immediately.** Call `report_blocked` as soon as you determine you cannot make forward progress. The monitor escalates on your behalf; your job is to surface the reason precisely.
4. **Always supply acceptance criteria.** Work items without acceptance criteria give reviewers no basis for approval. Set them at creation time; do not leave them empty.
5. **One active delegation per work item.** Adding a second delegation while one is still `active` creates ambiguous ownership. Confirm the previous delegation is `completed` or `failed` before re-delegating.
6. **Resolve open escalations.** When the coordinator receives an escalation, call `orchestration.escalations.resolve` with a resolution after handling it. Leaving escalations open obscures the team's real health.
7. **Use sprint status for retrospectives.** After a sprint closes, call `orchestration.sprints.retrospective` (gateway) to retrieve the full report and analyze what blocked progress before starting the next sprint.
