# CLAUDE.md — workq Extension Tooling Guide

Use this file for Claude Code agents that need `workq` context.

## Purpose

`workq` is a shared coordination system for multi-agent task ownership and file conflict awareness.

## Tool Surface (8 queue tools)

1. `workq_claim` — claim an issue/work item for your current agent
2. `workq_release` — release a claimed item
3. `workq_status` — change item status (`claimed -> in-progress -> review -> done`, etc.)
4. `workq_query` — query filtered work items
5. `workq_files` — check/add/remove/set tracked files and detect overlap
6. `workq_log` — append note/log entry to an item
7. `workq_done` — mark an item complete (with PR URL)
8. `workq_export` — export queue state (markdown/json)

## Required workflow

1. **Claim first** (`workq_claim`) before modifying queue-owned work.
2. Update status as you progress (`workq_status`).
3. Keep file tracking current (`workq_files`) to avoid conflicts.
4. Complete with `workq_done` (or `workq_release` if handing off).

## Call-after-claim requirement

Once an item is claimed, subsequent calls for progress and closure should reference that same `issue_ref` until completion/release. Avoid claiming duplicate IDs.

## Examples

### Claim work

```json
{
  "issue_ref": "acme/repo#123",
  "title": "Implement RPC handlers",
  "files": ["extensions/workq/index.ts"]
}
```

### Update status

```json
{ "issue_ref": "acme/repo#123", "status": "in-progress", "reason": "coding" }
```

### Mark done

```json
{ "issue_ref": "acme/repo#123", "pr_url": "https://github.com/dgarson/clawdbot/pull/999" }
```
