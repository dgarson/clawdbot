# Orchestration Skill

Use this skill when coordinating multi-agent execution with work items, sprint status, review handoffs, and blocked escalation.

## Core Workflow

1. Discover current load:
   - `orchestration(action='list_items', sprintId='...')`
2. Move work forward:
   - `orchestration(action='update_item', workItemId='...', state='in_progress')`
3. Request quality gate when ready:
   - `orchestration(action='request_review', workItemId='...', reviewerAgentId='...')`
4. If stuck, escalate explicitly:
   - `orchestration(action='report_blocked', workItemId='...', reason='...')`
5. Check sprint health:
   - `orchestration(action='sprint_status', sprintId='...')`

## Action Guidance

- `list_items`: always run first in a new session to avoid duplicate effort.
- `update_item`: keep title/description/state aligned with reality; avoid stale status.
- `request_review`: only after acceptance criteria are met.
- `report_blocked`: include concrete blocker, impact, and dependency owner.
- `sprint_status`: use for planning, not as a replacement for item-level updates.

## Escalation Heuristics

Escalate when any is true:

- Blocked > 1 working cycle.
- Repeated tool failure with no new mitigation path.
- Review cannot proceed due to missing context/owner.

## Anti-patterns

- Opening review while work item still ambiguous.
- Reporting blocked without actionable reason.
- Updating item state without updating summary fields.
