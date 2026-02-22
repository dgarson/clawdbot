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

- `extensions/workq/`

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

### Pi / ARM runtime portability

`workq` is fully portable to ARM-based hosts (Raspberry Pi 4/5, Orange Pi,
other aarch64 SBCs) with no native compilation step:

| Concern | Detail |
|---------|--------|
| **SQLite** | Uses the built-in `node:sqlite` module (shipped with Node ≥ 22.5.0, unflagged since ~22.8). No `node-gyp`, no `better-sqlite3`, no native addon rebuild required. |
| **Node version** | Requires **Node ≥ 22.12.0** (repo `engines` constraint). Install via [NodeSource](https://github.com/nodesource/distributions) or `nvm` — both support `linux/arm64`. |
| **Architecture** | Pure JS + built-in bindings. Works identically on `x64`, `arm64`, and `armv7l` (32-bit Pi OS). |
| **File I/O** | WAL journal mode is enabled by default (`PRAGMA journal_mode = WAL`). This is safe on ext4/f2fs but **not on FAT32/exFAT** partitions. |

#### Recommended database path (Pi)

On Pi hosts the default `~/.openclaw/workq/workq.db` lives on the SD card,
which has limited write endurance. For longer-lived deployments, place the
database on an external drive or a dedicated data partition:

```
/data/openclaw/workq/workq.db
```

Set it in your OpenClaw config:

```json
{
  "workq": {
    "dbPath": "/data/openclaw/workq/workq.db"
  }
}
```

Make sure the directory exists and is writable by the OpenClaw process:

```bash
sudo mkdir -p /data/openclaw/workq
sudo chown openclaw:openclaw /data/openclaw/workq
```

#### Probe and verification commands

After deploying on a Pi (or any new host), verify the extension loads and
the database is functional:

```bash
# 1. Confirm Node.js version meets the minimum
node -e "const v = process.versions.node.split('.').map(Number); \
  console.log(v[0] > 22 || (v[0] === 22 && v[1] >= 12) \
    ? 'OK  node ' + process.version + ' (' + process.arch + ')' \
    : 'FAIL  need >= 22.12.0, got ' + process.version)"

# 2. Confirm node:sqlite is available (no flag needed)
node -e "require('node:sqlite'); console.log('OK  node:sqlite available')"

# 3. Smoke-test the database at the configured path
node -e "const { DatabaseSync } = require('node:sqlite'); \
  const db = new DatabaseSync('/data/openclaw/workq/workq.db'); \
  db.exec('SELECT 1'); db.close(); \
  console.log('OK  database opens at configured path')"

# 4. Verify the workq extension registered its tools and CLI
openclaw channels status --probe

# 5. Quick functional check — list current queue (should return empty or items)
openclaw workq list --json
```

> **Tip:** On headless Pi hosts, run the probe commands in a startup script or
> systemd `ExecStartPost` to catch misconfiguration early.

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
