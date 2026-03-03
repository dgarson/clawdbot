---
title: "WorkQ"
summary: "Operator guide for the WorkQ extension: lifecycle behavior, startup repair semantics, and troubleshooting"
read_when:
  - You are operating multi-agent coordination with `openclaw workq`
  - You need to understand `system:unclaimed` legacy-row repair behavior
  - You are investigating stale or unexpectedly dropped WorkQ items
---

# WorkQ

`workq` is the shared queue used for multi-agent coordination. It tracks ownership,
status transitions, file-level conflict hints, and an audit log.

This page focuses on **runtime behavior and operations** (especially legacy-row
repair semantics).

## Canonical statuses

Work item statuses:

- `claimed`
- `in-progress`
- `blocked`
- `in-review`
- `done` (terminal)
- `dropped` (terminal, reclaimable)

Active statuses are `claimed`, `in-progress`, `blocked`, `in-review`.

## Core behavior

- `claim` creates a new item in `claimed` or reclaims items in `dropped` (and `done`
  only when `reopen=true`).
- `release` moves active owned items to `dropped`.
- Session auto-release (`autoReleaseBySession`) now drops active items rather than
  assigning a sentinel system owner.
- Sweep auto-release (`systemReleaseToUnclaimed`) also drops items and clears session
  claim linkage.

Operationally, `dropped` is the canonical "available to claim again" state.

## Legacy `system:unclaimed` repair semantics

Two historical corruption/sentinel patterns are repaired on DB open:

1. **Swapped fields bug**
   - Legacy row shape: `status='system:unclaimed'`, often with
     `agent_id='claimed'`.
   - Repair action: set `status='dropped'` and refresh `updated_at`.

2. **Sentinel owner rows**
   - Legacy row shape: `agent_id='system:unclaimed'` with non-terminal status
     (`claimed` / `in-progress` / `blocked` / `in-review`).
   - Repair action: set `status='dropped'` and refresh `updated_at`.

Why this matters: `system:unclaimed` is no longer a valid operational owner model.
Rows are normalized to `dropped` so humans/agents reclaim them explicitly with a real
`agentId`.

Related fixes:

- `75abcdd0eb` — startup repair for legacy `status='system:unclaimed'` rows.
- `5b093693f9` — remove sentinel reassignment flow and normalize release behavior to
  `dropped`, plus sentinel health-check warnings.

## Health check + sweep behavior

During scheduled sweep runs, WorkQ emits a warning if any active rows still have
`agent_id LIKE 'system:%'`:

- This is an anomaly (typically stale DB state produced by older logic).
- The warning is diagnostic; startup repair on next DB open performs normalization.

Stale detection includes `claimed`, `in-progress`, and `blocked` items.

## Operator playbook

### Inspect queue state

- Human list: `openclaw workq list`
- JSON list: `openclaw workq list --json`
- Stale-only view: `openclaw workq stale --hours 2`
- Full export for incident review:
  `openclaw workq export --format markdown --all --log --output /tmp/workq.md`

### Detect legacy sentinel anomalies

Quick SQL check (replace DB path as needed):

```bash
sqlite3 ~/.openclaw/workq/workq.db "
SELECT issue_ref, status, agent_id, updated_at
FROM work_items
WHERE agent_id LIKE 'system:%'
  AND status NOT IN ('done','dropped')
ORDER BY updated_at ASC;
"
```

Expected result: **no rows**.

### Recovery guidance

- If you see sentinel anomalies, restart the process that opens WorkQ DB (startup
  repair runs on open).
- Re-run:
  - `openclaw workq list --json`
  - optional SQL check above
- Items that were active under legacy sentinel states should now be `dropped` and
  reclaimable via `openclaw workq claim ... --agent <real-agent-id>`.

## Practical guardrails

- Always claim with a concrete agent identity (`--agent <id>` or tool context
  agentId).
- Treat `dropped` as recoverable backlog, not as assignment to a pseudo-owner.
- Use `openclaw workq sweep --dry-run` before `--auto-release`/`--auto-done` in
  high-risk repos.
- Keep `workq export --all --log` snapshots during incidents for postmortems.
