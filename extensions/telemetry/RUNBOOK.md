# Telemetry Extension — Runbook

## 1. Overview

The telemetry extension captures agent lifecycle events (sessions, runs, tool calls, LLM calls, subagent spawns, messages, compactions) into append-only JSONL files with an optional SQLite index for fast queries. It ships with 16 CLI commands, 15 HTTP routes, and 15 WebSocket RPC gateway methods.

### Data flow

```
Hooks / Diagnostic Events
        │
        ▼
   Collector (collector.ts)
        │
   ┌────┴────┐
   ▼         ▼
JSONL Writer   SQLite Indexer
(events.jsonl) (telemetry.db)
        │
   ┌────┴────┐
   ▼         ▼
CLI/HTTP    Gateway RPC → Dashboard UI
```

### Storage location

By default: `~/.openclaw/agents/<agentId>/telemetry/`

Contents:

- `events.jsonl` — current log (append-only)
- `events.YYYY-MM-DD.jsonl` — rotated daily logs
- `telemetry.db` — SQLite index (WAL mode)
- `blobs/` — externalized large tool inputs/outputs

---

## 2. First-Time Enablement

### Step 1: Install dependencies

The extension uses `better-sqlite3`. From the repo root:

```bash
pnpm install
```

This installs workspace dependencies including `extensions/telemetry/`.

### Step 2: Build

```bash
pnpm build
```

Verify the telemetry extension compiles without errors.

### Step 3: Enable the plugin

The telemetry extension is bundled at `extensions/telemetry/` but bundled extensions are **disabled by default**. Enable it in your `openclaw.json` (located at `~/.openclaw/openclaw.json` or the agent-specific config):

```jsonc
{
  "plugins": {
    "entries": {
      "telemetry": {
        "enabled": true,
        "config": {
          "enabled": true,
          "captureToolResults": "summary",
          "captureToolInputs": "full",
          "captureLlmPayloads": false,
          "rotationPolicy": "daily",
          "retentionDays": 30,
          "blobThresholdBytes": 4096,
        },
      },
    },
  },
}
```

#### Minimal config (all defaults)

```jsonc
{
  "plugins": {
    "entries": {
      "telemetry": {
        "enabled": true,
      },
    },
  },
}
```

This uses the defaults from `openclaw.plugin.json`:

- `captureToolResults`: `"summary"` (first 500 chars)
- `captureToolInputs`: `"full"`
- `captureLlmPayloads`: `false`
- `rotationPolicy`: `"daily"`
- `retentionDays`: `30`
- `blobThresholdBytes`: `4096`

### Step 4: Restart the gateway

```bash
openclaw gateway restart
# or on macOS via the app:
# scripts/restart-mac.sh
```

---

## 3. Configuration Reference

| Key                  | Type                                | Default     | Description                                                                                                         |
| -------------------- | ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `enabled`            | boolean                             | `true`      | Master switch. Set `false` to disable all capture.                                                                  |
| `captureToolResults` | `"none"` \| `"summary"` \| `"full"` | `"summary"` | How much tool output to persist. `"none"` = params only, `"summary"` = first 500 chars, `"full"` = everything.      |
| `captureToolInputs`  | `"none"` \| `"summary"` \| `"full"` | `"full"`    | How much tool input to persist.                                                                                     |
| `captureLlmPayloads` | boolean                             | `false`     | Capture full LLM request/response payloads. **Warning:** produces large volumes of data; use for debugging only.    |
| `rotationPolicy`     | `"daily"` \| `"weekly"` \| `"none"` | `"daily"`   | JSONL file rotation. `"daily"` renames `events.jsonl` to `events.YYYY-MM-DD.jsonl` on the first write of a new day. |
| `retentionDays`      | number                              | `30`        | Auto-delete rotated JSONL and blob files older than N days. `0` = keep forever.                                     |
| `blobThresholdBytes` | number                              | `4096`      | Tool input/output larger than this is written to a separate blob file and referenced by ID.                         |
| `dataDir`            | string                              | (auto)      | Override the telemetry data directory. Supports `~` expansion. Defaults to `<stateDir>/telemetry/`.                 |

---

## 4. Expected Behavior After Enablement

### On gateway startup

1. The telemetry service creates the data directory (`~/.openclaw/agents/<agentId>/telemetry/`).
2. Opens (or creates) `events.jsonl` for append-only writing.
3. Creates the `blobs/` subdirectory.
4. Runs retention cleanup (deletes files older than `retentionDays`).
5. Opens (or creates) `telemetry.db` (SQLite in WAL mode).
6. Runs JSONL catch-up: indexes any events in JSONL that aren't yet in SQLite (handles crash recovery).
7. Registers all hook listeners for event capture.
8. Logs: gateway startup proceeds normally. If SQLite is unavailable, a warning is logged but JSONL capture continues.

### During normal operation

- **Every session start/end** → `session.start` / `session.end` events
- **Every agent run start/end** → `run.start` / `run.end` events
- **Every LLM call** → `llm.input` / `llm.output` events (hook-based), `llm.call` events (diagnostic-based with per-call cost)
- **Every tool call** → `tool.start` / `tool.end` events with captured params/results
- **Every inbound/outbound message** → `message.inbound` / `message.outbound` events
- **Every subagent spawn/end/stop** → `subagent.spawn` / `subagent.end` / `subagent.stop` events
- **Every compaction** → `compaction.start` / `compaction.end` events
- **Periodic usage snapshots** → `usage.snapshot` events from diagnostic events

All events are dual-written: JSONL (durable) + SQLite index (queryable).

### On gateway shutdown

1. Diagnostic event subscription is unregistered.
2. JSONL writer is flushed and closed.
3. SQLite database is closed.

---

## 5. CLI Commands (16 total)

All commands support `--json` (machine-readable output) and `--agent <id>` (filter by agent ID) inherited from the parent command.

### Core commands

```bash
# List recent agent runs
openclaw telemetry runs [--session <key>] [--model <name>] [--limit <n>] [--since <date>] [--until <date>]

# Show details for a single run (tools, model calls, tokens)
openclaw telemetry run <runId>

# List tool calls
openclaw telemetry tools [--run <runId>] [--name <toolName>] [--session <key>] [--errors-only] [--limit <n>]

# Show event timeline for a session
openclaw telemetry timeline <sessionKey> [--limit <n>] [--kinds <k1,k2>]

# Aggregated token usage summary
openclaw telemetry usage [--since <date>] [--until <date>] [--session <key>]

# List raw telemetry events
openclaw telemetry events [--kind <kind>] [--run <runId>] [--limit <n>] [--since <date>] [--until <date>] [--session <key>]

# List file operations from tool calls
openclaw telemetry files [--run <runId>] [--path <glob>] [--session <key>] [--limit <n>]
```

### Analytics commands

```bash
# List sessions with aggregate stats
openclaw telemetry sessions [--limit <n>] [--since <date>] [--until <date>]

# Full session detail: runs, subagents, messages, costs
openclaw telemetry session <sessionKey>

# Cost breakdown by dimension
openclaw telemetry costs [--group-by <model|provider|agent|session|day>] [--since <date>] [--until <date>] [--limit <n>]

# List subagent spawns
openclaw telemetry subagents [--session <key>] [--run <runId>] [--limit <n>]

# Recursive subagent hierarchy tree
openclaw telemetry tree <sessionKey>

# List messages (inbound/outbound)
openclaw telemetry messages [--session <key>] [--direction <inbound|outbound>] [--channel <ch>] [--limit <n>]

# Cross-table error listing
openclaw telemetry errors [--since <date>] [--session <key>] [--run <runId>] [--limit <n>]

# Leaderboards (top runs, tools, models, sessions)
openclaw telemetry top <runs|tools|models|sessions> [--since <date>] [--limit <n>]

# Individual LLM calls with per-call cost
openclaw telemetry model-calls [--run <runId>] [--session <key>] [--model <name>] [--limit <n>]
```

### Machine-readable output

Append `--json` to any command for JSON output suitable for piping:

```bash
openclaw telemetry sessions --json | jq '.[0]'
openclaw telemetry costs --group-by model --json
openclaw telemetry top tools --limit 5 --json
```

---

## 6. HTTP Routes

All routes are prefixed with the plugin mount point. Example paths:

| Method | Path                              | Description      |
| ------ | --------------------------------- | ---------------- |
| GET    | `/telemetry/runs`                 | List runs        |
| GET    | `/telemetry/runs/:runId`          | Run detail       |
| GET    | `/telemetry/tools`                | Tool calls       |
| GET    | `/telemetry/timeline/:sessionKey` | Session timeline |
| GET    | `/telemetry/usage`                | Usage summary    |
| GET    | `/telemetry/events`               | Raw events       |
| GET    | `/telemetry/files`                | File operations  |
| GET    | `/telemetry/sessions`             | Session list     |
| GET    | `/telemetry/sessions/:key`        | Session detail   |
| GET    | `/telemetry/costs`                | Cost breakdown   |
| GET    | `/telemetry/subagents`            | Subagent list    |
| GET    | `/telemetry/tree/:key`            | Subagent tree    |
| GET    | `/telemetry/messages`             | Messages         |
| GET    | `/telemetry/errors`               | Errors           |
| GET    | `/telemetry/top/:dimension`       | Leaderboards     |
| GET    | `/telemetry/model-calls`          | Model calls      |

---

## 7. Gateway RPC Methods

For the dashboard UI and programmatic access via WebSocket:

| Method                  | Description      |
| ----------------------- | ---------------- |
| `telemetry.sessions`    | List sessions    |
| `telemetry.session`     | Session detail   |
| `telemetry.runs`        | List runs        |
| `telemetry.run`         | Run detail       |
| `telemetry.tools`       | Tool calls       |
| `telemetry.costs`       | Cost breakdown   |
| `telemetry.subagents`   | Subagent list    |
| `telemetry.tree`        | Subagent tree    |
| `telemetry.messages`    | Messages         |
| `telemetry.errors`      | Errors           |
| `telemetry.top`         | Leaderboards     |
| `telemetry.model-calls` | Model calls      |
| `telemetry.usage`       | Usage summary    |
| `telemetry.events`      | Raw events       |
| `telemetry.timeline`    | Session timeline |

---

## 8. End-to-End Validation

### Pre-flight checks

```bash
# 1. Verify the extension is discovered
openclaw plugins list
# Should show "telemetry" as enabled

# 2. Verify the build is clean
pnpm build

# 3. Run unit tests
pnpm test -- extensions/telemetry/
# Expect: all tests pass (114+ tests across 6 files)
```

### Functional validation

Start the gateway with telemetry enabled and run a session:

```bash
# 1. Start the gateway
openclaw gateway run

# 2. Send a test message (in another terminal)
openclaw message send "Hello, what is 2 + 2?"

# 3. Wait for the agent to respond, then check data was captured
```

### Verify JSONL capture

```bash
# Check that events.jsonl exists and has content
ls -la ~/.openclaw/agents/*/telemetry/events.jsonl

# Count events
wc -l ~/.openclaw/agents/*/telemetry/events.jsonl

# Inspect the first few events
head -5 ~/.openclaw/agents/*/telemetry/events.jsonl | jq .kind
# Expected: "session.start", "run.start", "llm.input", "tool.start", etc.
```

### Verify SQLite index

```bash
# Check that telemetry.db exists
ls -la ~/.openclaw/agents/*/telemetry/telemetry.db

# Verify tables
sqlite3 ~/.openclaw/agents/*/telemetry/telemetry.db ".tables"
# Expected: events  indexer_state  messages  model_calls  runs  subagents  tool_calls
```

### Verify CLI commands

```bash
# List runs (should show at least one)
openclaw telemetry runs
# Expected: table with runId, session, model, started, duration, tokens, tools, stop

# Show run detail
openclaw telemetry runs --json | jq '.[0].runId' -r | xargs openclaw telemetry run
# Expected: full detail with token breakdown, tool calls, model calls

# Check tool calls
openclaw telemetry tools --limit 5
# Expected: table of tool calls with names, durations, errors

# Check usage summary
openclaw telemetry usage
# Expected: aggregate token counts, tool call count, estimated cost

# Check sessions
openclaw telemetry sessions
# Expected: table with session aggregates

# Check costs by model
openclaw telemetry costs --group-by model
# Expected: cost breakdown per model

# Check errors (may be empty if no errors occurred)
openclaw telemetry errors
# Expected: empty or a list of run/tool errors

# JSON output mode
openclaw telemetry runs --json | jq length
# Expected: a number > 0
```

### Verify event kinds

After a typical session you should see these event kinds:

| Kind               | Source                   | When                         |
| ------------------ | ------------------------ | ---------------------------- |
| `session.start`    | `session_start` hook     | Session opens                |
| `run.start`        | `run_start` hook         | Agent run begins             |
| `llm.input`        | `llm_input` hook         | Before each LLM call         |
| `llm.output`       | `llm_output` hook        | After each LLM call          |
| `llm.call`         | `model.call` diagnostic  | Per-call token/cost snapshot |
| `tool.start`       | `before_tool_call` hook  | Before tool execution        |
| `tool.end`         | `after_tool_call` hook   | After tool execution         |
| `usage.snapshot`   | `model.usage` diagnostic | Cumulative usage update      |
| `run.end`          | `agent_end` hook         | Agent run completes          |
| `session.end`      | `session_end` hook       | Session closes               |
| `message.inbound`  | `message_received` hook  | Inbound message              |
| `message.outbound` | `message_sent` hook      | Outbound message             |
| `subagent.spawn`   | `subagent_spawned` hook  | Subagent created             |
| `subagent.stop`    | `subagent_stopping` hook | Subagent about to stop       |
| `subagent.end`     | `subagent_ended` hook    | Subagent completed           |
| `compaction.start` | `before_compaction` hook | Context compaction begins    |
| `compaction.end`   | `after_compaction` hook  | Context compaction ends      |

### Verify retention

```bash
# Check current retention setting
openclaw telemetry usage --json | jq .

# To test retention, temporarily set retentionDays to 1, restart, and check
# that old rotated files are cleaned up on startup
```

### Verify blob externalization

```bash
# Check blobs directory
ls ~/.openclaw/agents/*/telemetry/blobs/
# If any tool input/output exceeded blobThresholdBytes (4096), you'll see .blob files

# Verify blob references in events
grep '"blobRefs"' ~/.openclaw/agents/*/telemetry/events.jsonl | head -1 | jq .blobRefs
```

### Verify rotation

```bash
# With daily rotation, after midnight the current events.jsonl is renamed
ls ~/.openclaw/agents/*/telemetry/events.*.jsonl
# Pattern: events.YYYY-MM-DD.jsonl (daily) or events.YYYY-WNN.jsonl (weekly)
```

---

## 9. Troubleshooting

### "Telemetry indexer is not running"

This error from CLI commands means SQLite failed to initialize. Check:

- `better-sqlite3` is installed (`pnpm install` from repo root)
- The data directory is writable
- Gateway logs for the warning: `telemetry: SQLite indexer unavailable`

JSONL capture continues even when SQLite is unavailable. Restart the gateway to retry indexer initialization; catch-up will index any missed events.

### No events being captured

1. Verify the plugin is enabled: `openclaw plugins list`
2. Check config: `enabled` must not be `false` (in both `plugins.entries.telemetry.enabled` and `config.enabled`)
3. Check gateway logs for plugin registration messages
4. Verify the data directory exists: `ls ~/.openclaw/agents/*/telemetry/`

### Large disk usage

- Reduce `captureToolResults` to `"none"` or `"summary"`
- Disable `captureLlmPayloads`
- Lower `retentionDays`
- Lower `blobThresholdBytes` to externalize more content as blobs (or raise it to inline more and avoid blob files)

### SQLite database corruption

Delete `telemetry.db` and restart the gateway. The indexer will rebuild from JSONL via catch-up:

```bash
rm ~/.openclaw/agents/*/telemetry/telemetry.db
openclaw gateway restart
```

---

## 10. Security Considerations

- Telemetry data may contain sensitive content from tool inputs/outputs and LLM payloads.
- The `dataDir` is scoped per-agent by default.
- Set `captureToolResults: "none"` and `captureToolInputs: "none"` to minimize data capture.
- Keep `captureLlmPayloads: false` in production.
- Retention policy auto-deletes old data; set `retentionDays` appropriately for your compliance needs.
- The SQLite database and JSONL files are local; they are not transmitted externally.
