# workq extension

`workq` is an OpenClaw extension that provides a shared, SQLite-backed work queue for multi-agent coordination.

It gives you:

- **Tool APIs** for agents (`workq_claim`, `workq_status`, etc.)
- **CLI commands** for operators (`openclaw workq ...`)
- **State + ownership rules** so work is claimed, tracked, and safely transitioned
- **Conflict visibility** (file overlap + scope overlap warnings)

---

## Installation / loading

This extension is intended to live at:

- `~/.openclaw/extensions/workq/`

In this repo, it is located at:

- `/Users/openclaw/openclaw/extensions/workq/`

OpenClaw discovers the extension entrypoint from `package.json`:

```json
{
  "openclaw": {
    "extensions": ["./index.ts"]
  }
}
```

The extension id/config schema is in `openclaw.plugin.json` (`id: "workq"`).

---

## Configuration

Supported config keys:

- `enabled` (boolean)
  - default: `true`
  - if `false`, extension does not register tools/CLI/service
- `dbPath` (string)
  - default: `~/.openclaw/workq/workq.db`
  - resolved via OpenClaw path resolver
- `staleThresholdHours` (integer, min 1)
  - default: `24`
  - items older than this threshold (and still active) are marked stale

Example config:

```json
{
  "workq": {
    "enabled": true,
    "dbPath": "~/.openclaw/workq/workq.db",
    "staleThresholdHours": 24
  }
}
```

### Pi / ARM runtime note

- `workq` uses Node built-in `node:sqlite` (no native addon compile step).
- On Raspberry Pi / ARM agents, use a persistent DB path such as:
  - `/data/openclaw/workq/workq.db`
- After registration/config, verify plugin load with:

```bash
openclaw channels status --probe
```

---

## Tool API quick reference (8 tools)

1. **`workq_claim`**
   - Claim an item for current agent.
   - Key params: `issue_ref`, optional `title`, `squad`, `files[]`, `branch`, `worktree_path`, `priority`, `scope[]`, `tags[]`, `reopen`.

2. **`workq_release`**
   - Drop owned active item (moves to `dropped`).
   - Key params: `issue_ref`, optional `reason`.

3. **`workq_status`**
   - Transition owned item status.
   - Key params: `issue_ref`, `status`, optional `reason`, `pr_url`.

4. **`workq_query`**
   - Query queue by filters.
   - Key params: `squad`, `agent_id`, `status`, `priority`, `scope`, `issue_ref`, `active_only`, `updated_after`, `updated_before`, `limit`, `offset`.

5. **`workq_files`**
   - Check or mutate tracked files.
   - Modes: `check`, `set`, `add`, `remove`.
   - Key params vary by mode (`path` for `check`; `issue_ref` + `paths[]` for mutations).

6. **`workq_log`**
   - Append note on owned item.
   - Key params: `issue_ref`, `note`.

7. **`workq_done`**
   - Mark owned item done from `in-review` with PR URL.
   - Key params: `issue_ref`, `pr_url`, optional `summary`.

8. **`workq_export`**
   - Export queue state as markdown/json.
   - Key params: `format`, `include_done`, `include_log`, optional `squad`.

> Tool ownership is bound to agent context (`ctx.agentId`), not caller-supplied spoofed ids.

---

## CLI command reference

Root command:

- `openclaw workq`

Subcommands:

- `openclaw workq list [--squad ... --status ... --agent ... --priority ... --scope ... --updated-after ... --updated-before ... --limit ... --offset ... --all --json]`
- `openclaw workq claim <issue_ref> --agent <id> [--squad ... --title ... --priority ... --scope ... --files ... --branch ... --worktree ... --reopen --json]`
- `openclaw workq status [issue_ref] [--set <status> --reason ... --pr ... --agent ... --json]`
- `openclaw workq release <issue_ref> --agent <id> [--reason ... --json]`
- `openclaw workq done <issue_ref> --agent <id> --pr <url> [--summary ... --json]`
- `openclaw workq files check --path <path> [--exclude-self --agent <id> --json]`
- `openclaw workq files set <issue_ref> --paths <csv> --agent <id> [--json]`
- `openclaw workq log <issue_ref> [--limit <n> --json]`
- `openclaw workq export [--format md|markdown|json --all --log --output <file>]`
- `openclaw workq stale [--hours <n> --squad ... --agent ... --limit ... --offset ... --json]`

### Examples

```bash
# Claim work
openclaw workq claim acme/repo#123 --agent agent-alpha --squad platform --priority high --scope db,cli

# Move status forward
openclaw workq status acme/repo#123 --set in-progress --agent agent-alpha
openclaw workq status acme/repo#123 --set in-review --agent agent-alpha --pr https://github.com/acme/repo/pull/123

# Complete work
openclaw workq done acme/repo#123 --agent agent-alpha --pr https://github.com/acme/repo/pull/123 --summary "shipped"

# Check file overlap
openclaw workq files check --path src/workq --exclude-self --agent agent-alpha

# Export snapshot
openclaw workq export --format markdown --all --log --output /tmp/workq.md
```

---

## Lifecycle notes (state + ownership)

### Ownership

- A work item has a single owner (`agent_id`).
- Mutating actions (`status`, `files`, `log`, `release`, `done`) require ownership.

### Claim/reclaim behavior

- New issue: `claim` creates item in `claimed`.
- Existing active item owned by someone else: `claim` returns conflict.
- Existing active item owned by same agent: `already_yours`.
- Existing `dropped` item: claim reassigns and sets status back to `claimed`.
- Existing `done` item: reclaim only when `reopen=true`.

### Terminal states

- `done` and `dropped` are terminal for normal progression.
- `release` transitions active item to `dropped`.
- `done` requires current state `in-review`.

### Valid status transitions

- `claimed -> in-progress`
- `in-progress -> blocked | in-review`
- `blocked -> in-progress`
- `in-review -> in-progress | done`
- `done -> (none)`
- `dropped -> (none)`

`blocked` requires a reason.

---

## Testing

Run full test suite:

```bash
npm test
```

This runs Vitest tests for:

- database semantics and contention handling
- state machine validation
- file matching/conflict logic
- tool registration + payload behavior
- CLI parsing/validation and DB dispatch
- index integration wiring (tools + cli + service stop/DB close)
