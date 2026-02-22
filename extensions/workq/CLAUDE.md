# CLAUDE.md — workq Extension Tooling Guide

This file provides guidance for Claude Code agents working with the `workq` coordination system.

## Overview

`workq` is a shared, SQLite-backed work queue for multi-agent task coordination. It prevents duplicate work, tracks file ownership, and manages status transitions across a fleet of agents.

**Key guarantees:**
- Single ownership per work item (one agent at a time)
- File conflict detection before you start work
- Status state machine with valid transitions enforced
- Stale item detection (items older than threshold)

---

## The 8 Queue Tools

### 1. `workq_claim` — Claim work for your agent

**Purpose:** Take ownership of a task by issue reference.

**Parameters:**
- `issue_ref` (required): Unique identifier (e.g., `acme/repo#123`)
- `title` (optional): Human-readable task title
- `squad` (optional): Team/squad name (e.g., `platform-core`)
- `files` (optional): Array of file paths you'll be touching
- `branch` (optional): Git branch name
- `worktree_path` (optional): Path to worktree (if using git worktrees)
- `priority` (optional): `critical`, `high`, `medium`, `low`
- `scope` (optional): Array of scope tags (e.g., `["db", "api"]`)
- `tags` (optional): Array of additional tags
- `reopen` (optional): Allow reclaiming a `done` item (default: false)

**Returns:**
- `{ status: "claimed", item: {...} }` — Successfully claimed
- `{ status: "already_yours", item: {...} }` — You already own this
- `{ status: "conflict", claimedBy, claimedAt, currentStatus }` — Someone else owns it

**Example:**
```json
{
  "issue_ref": "acme/repo#456",
  "title": "Add rate limiting to API endpoints",
  "squad": "platform-core",
  "priority": "high",
  "scope": ["api", "infra"],
  "files": ["src/api/middleware/rate-limit.ts", "terraform/api-gateway.tf"]
}
```

---

### 2. `workq_status` — Update item status

**Purpose:** Transition owned work through the status lifecycle.

**Parameters:**
- `issue_ref` (required): The claimed item's reference
- `status` (required): New status (see valid transitions below)
- `reason` (optional): Why the status changed (required for `blocked`)
- `pr_url` (optional): Link to PR (typically set when moving to `in-review`)

**Valid status transitions:**
- `claimed` → `in-progress`
- `in-progress` → `blocked` (requires `reason`) | `in-review`
- `blocked` → `in-progress`
- `in-review` → `in-progress` | `done` (via `workq_done`, not this tool)

**Example:**
```json
{
  "issue_ref": "acme/repo#456",
  "status": "in-review",
  "reason": "PR ready for review",
  "pr_url": "https://github.com/acme/repo/pull/789"
}
```

---

### 3. `workq_files` — Check/update tracked files

**Purpose:** Prevent file conflicts or update the file list for your work item.

**Modes:**
- `check` — Detect conflicts before claiming work
- `set` — Replace entire file list for an item
- `add` — Append files to existing list
- `remove` — Remove specific files from list

**Parameters (mode-dependent):**
- `mode` (required): One of `check`, `set`, `add`, `remove`
- For `check`:
  - `path` (required): File or directory path to check
  - `exclude_self` (optional): Exclude your own items from conflict results
- For mutations (`set`, `add`, `remove`):
  - `issue_ref` (required): Your claimed item
  - `paths` (required): Array of file paths

**Returns:**
- `conflicts[]` — Array of items touching the same files
- `hasConflicts` — Boolean flag

**Example (check before claiming):**
```json
{
  "mode": "check",
  "path": "src/api/middleware/rate-limit.ts",
  "exclude_self": false
}
```

**Example (update tracked files):**
```json
{
  "mode": "add",
  "issue_ref": "acme/repo#456",
  "paths": ["src/api/routes/users.ts"]
}
```

---

### 4. `workq_query` — Search the queue

**Purpose:** Find items matching specific criteria.

**Parameters:**
- `squad` (optional): Filter by squad
- `agent_id` (optional): Filter by owning agent
- `status` (optional): Single status or array of statuses
- `priority` (optional): Single priority or array
- `scope` (optional): Filter by scope tag
- `issue_ref` (optional): Direct lookup
- `active_only` (optional): Only non-terminal items
- `updated_after` (optional): ISO timestamp
- `updated_before` (optional): ISO timestamp
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset

**Example:**
```json
{
  "squad": "platform-core",
  "status": ["in-progress", "blocked"],
  "priority": ["critical", "high"],
  "active_only": true
}
```

---

### 5. `workq_log` — Add notes to an item

**Purpose:** Append human-readable notes to the work item's history.

**Parameters:**
- `issue_ref` (required): Your claimed item
- `note` (required): Freeform text note

**Example:**
```json
{
  "issue_ref": "acme/repo#456",
  "note": "Discovered circular dependency in auth module, refactoring required"
}
```

---

### 6. `workq_done` — Mark work complete

**Purpose:** Transition from `in-review` to `done` with PR URL.

**Parameters:**
- `issue_ref` (required): Your item in `in-review` state
- `pr_url` (required): Link to merged PR
- `summary` (optional): Brief completion summary

**Requirements:**
- Item must be in `in-review` status
- You must be the owner

**Example:**
```json
{
  "issue_ref": "acme/repo#456",
  "pr_url": "https://github.com/acme/repo/pull/789",
  "summary": "Rate limiting implemented and deployed to staging"
}
```

---

### 7. `workq_release` — Drop ownership

**Purpose:** Abandon work and move item to `dropped` status.

**Parameters:**
- `issue_ref` (required): Your claimed item
- `reason` (optional): Why you're releasing it

**Use when:**
- You can't complete the task
- Task is blocked and needs reassignment
- Task is no longer relevant

**Example:**
```json
{
  "issue_ref": "acme/repo#456",
  "reason": "Blocked on design decision from product team"
}
```

---

### 8. `workq_export` — Export queue state

**Purpose:** Generate a snapshot of queue state as markdown or JSON.

**Parameters:**
- `format` (optional): `markdown`, `md`, or `json` (default: `markdown`)
- `include_done` (optional): Include completed items (default: false)
- `include_log` (optional): Include item history notes (default: false)
- `squad` (optional): Filter to specific squad

**Example:**
```json
{
  "format": "markdown",
  "include_done": false,
  "include_log": true,
  "squad": "platform-core"
}
```

---

## Expected Call Order

The canonical workflow for a task:

```
1. workq_files (mode=check) → Detect conflicts before starting
2. workq_claim → Take ownership
3. workq_status (claimed → in-progress) → Start working
4. workq_files (mode=add/set) → Update tracked files as you discover scope
5. workq_log → Add notes for blockers or discoveries
6. workq_status (in-progress → in-review) → Open PR
7. workq_done → Mark complete after merge
```

**Alternative paths:**

- **Blocked:** `in-progress` → `blocked` (with `reason`) → `in-progress`
- **Abandon:** Any active state → `workq_release` → `dropped`

---

## Practical Examples

### Example 1: Full happy path workflow

```json
// 1. Check for conflicts
{
  "mode": "check",
  "path": "src/api/",
  "exclude_self": false
}

// 2. Claim the work
{
  "issue_ref": "clawdbot#321",
  "title": "Add authentication middleware",
  "squad": "platform-core",
  "priority": "high",
  "files": ["src/api/auth.ts", "tests/api/auth.test.ts"]
}

// 3. Start working
{
  "issue_ref": "clawdbot#321",
  "status": "in-progress"
}

// 4. Discover additional files
{
  "mode": "add",
  "issue_ref": "clawdbot#321",
  "paths": ["src/api/routes/admin.ts"]
}

// 5. PR ready
{
  "issue_ref": "clawdbot#321",
  "status": "in-review",
  "pr_url": "https://github.com/dgarson/clawdbot/pull/322"
}

// 6. Complete
{
  "issue_ref": "clawdbot#321",
  "pr_url": "https://github.com/dgarson/clawdbot/pull/322",
  "summary": "Auth middleware shipped"
}
```

### Example 2: Handling conflicts

```json
// Check reveals conflict
{
  "mode": "check",
  "path": "terraform/main.tf"
}

// Response shows:
{
  "hasConflicts": true,
  "conflicts": [
    {
      "issueRef": "clawdbot#299",
      "agentId": "agent-oscar",
      "status": "in-progress",
      "matchingFiles": ["terraform/main.tf"]
    }
  ]
}

// Wait or coordinate with agent-oscar before proceeding
```

### Example 3: Blocked task

```json
// Hit a blocker
{
  "issue_ref": "clawdbot#321",
  "status": "blocked",
  "reason": "Waiting on security team approval for JWT secret rotation"
}

// Log additional context
{
  "issue_ref": "clawdbot#321",
  "note": "Emailed security-team@company.com, ETA 2 days"
}

// Unblock later
{
  "issue_ref": "clawdbot#321",
  "status": "in-progress"
}
```

### Example 4: Query for dashboard

```json
// Get all high-priority active work
{
  "squad": "platform-core",
  "active_only": true,
  "priority": ["critical", "high"]
}

// Get stale items
{
  "active_only": true,
  "updated_before": "2026-02-01T00:00:00Z"
}
```

### Example 5: Releasing work

```json
// Can't complete, release back to queue
{
  "issue_ref": "clawdbot#321",
  "reason": "Reprioritized, moving to different task"
}
```

---

## Status State Machine

```
                 ┌──────────┐
                 │ claimed  │
                 └────┬─────┘
                      │ workq_status
                      ▼
               ┌──────────────┐
               │ in-progress  │◄─────┐
               └───┬──────┬───┘      │
           blocked│      │in-review │
                   │      ▼          │
              ┌────▼──────┐          │
              │  blocked  │──────────┘
              └───────────┘  unblock
                   
      (via workq_status)
      
               │
               ▼
          ┌─────────┐
          │in-review│
          └────┬────┘
               │ workq_done
               ▼
           ┌───────┐
           │ done  │ (terminal)
           └───────┘

Any active → workq_release → dropped (terminal)
```

---

## Common Pitfalls

1. **Forgetting to check conflicts first:** Always run `workq_files` with `mode=check` before `workq_claim` if you're touching files that might overlap with other agents.

2. **Invalid status transitions:** You can't jump from `claimed` directly to `in-review`. Follow the state machine.

3. **Claiming without ownership context:** The system uses your agent ID from context — you can't claim on behalf of another agent.

4. **Trying to done from wrong state:** `workq_done` only works from `in-review`. Use `workq_status` to get there first.

5. **Not updating files list:** If your scope expands, update `workq_files` so others get accurate conflict detection.

---

## Integration with Agent Workflows

For Nate (Infrastructure):
- Always set `scope: ["infra"]` and relevant tags
- Use `worktree_path` if working in isolated git worktrees
- Check `terraform/`, `k8s/`, `docker/` directories for conflicts

For Oscar (Reliability):
- Set `scope: ["reliability"]`
- Check for infra file conflicts (Oscar and Nate often touch overlapping configs)
- Use `blocked` status liberally when waiting on external decisions

For Vince (Performance):
- Set `scope: ["performance"]`
- Claim early before benchmark runs to prevent resource conflicts
- Log benchmark results in `workq_log` for visibility

---

## See Also

- Full README: `extensions/workq/README.md`
- Type definitions: `extensions/workq/src/types.ts`
- CLI commands: `openclaw workq --help`
