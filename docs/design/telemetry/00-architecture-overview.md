# Telemetry & Audit System — Architecture Overview

> Design specification for session replay, tool audit, channel linkage, and agent hierarchy observability in OpenClaw.

## Commit Strategy

When implementing this design, structure commits into **logical, independently reviewable groups**. Each commit should represent one concern:

- **Type changes**: New types, unions, enums, interfaces (one commit for all Phase 0 types, etc.)
- **Hook/hook-site additions**: Each new hook or hook enrichment location (one commit per hook file + one per call site)
- **Plugin structure**: Plugin scaffold, config, types (one commit)
- **Collector service**: Hook listeners, event handlers (one commit)
- **Storage/indexing**: JSONL writer, SQLite schema, watcher (grouped logically)
- **Query layer**: CLI commands, HTTP routes (one commit each)
- **Tests**: Grouped by phase or component

**Do not** create monolithic "implement telemetry" commits. Instead, use clear commit messages that reference the design doc section being implemented (e.g., `"Phase 0: enrich after_tool_call hook with runId and toolCallId"`). This enables upstream maintainers to review each concern independently and land partial progress.

---

## 1. Goals

1. **Session Replay**: Reconstruct the full timeline of any Agent Session or Run — ordered events with drill-down into each action, tool call, LLM interaction, and message exchange.
2. **Tool Audit**: Record every tool call's inputs and outputs. Surface file paths touched (Read/Write/Edit), exec commands run, and tool error provenance.
3. **Channel → Agent Linkage**: Map inbound messages from any channel (Telegram, Slack, Discord, etc.) to the Agent Session and Run that processed them. Trace outbound replies back to their originating run.
4. **Agent Hierarchy**: Map parent → child subagent relationships with task, outcome, timing, and model attribution. Support arbitrary spawn depth.
5. **Snapshot Metrics**: Capture per-LLM-call token usage deltas, cumulative totals, context window utilization, and cost estimates — not just session-wide aggregates.
6. **Error Provenance**: When a tool call fails or an agent errors, capture the full error chain with enough context to diagnose root cause without JSONL transcript parsing.

## 2. Design Principles

- **Zero upstream changes for initial telemetry capture.** All data collection uses existing hooks (`after_tool_call`, `llm_input`, `llm_output`, etc.) and event listeners (`onAgentEvent`, `onDiagnosticEvent`).
- **Minimal upstream changes for enrichment.** A small set of trivial additions (~60 lines: ~25 at call sites + ~34 type definitions) to pass already-in-scope data through hook payloads (fix `agentId`/`sessionKey` call-site values on `after_tool_call`; add `runId`/`toolCallId` on tool hooks; add usage/model/stopReason on `agent_end` and `llm_output`; add task/label/model on `subagent_ended`).
- **New hooks only where gaps exist.** Three new hooks (`run_start`, `before_message_process`, `subagent_stopping`) require upstream additions. Run boundaries are captured via an enriched `agent_end` hook (no separate `run_end` hook needed). Each hook is specified separately.
- **Single plugin architecture.** One `extensions/telemetry` plugin handles all capture, indexing, and querying. Internally modular; externally one install.
- **Hybrid storage.** JSONL for durable append-only event capture (archivable, human-readable). SQLite for materialized indexes enabling fast queries, aggregation, and filtering. Large tool I/O externalized to blob files to keep JSONL compact.
- **Crash-safe dual-write.** Collector writes to JSONL (durable) and enqueues to in-memory indexer (low-latency). On restart, indexer catches up from JSONL using last-indexed byte position. In-memory queue is ephemeral — fine to lose at process restart.

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OpenClaw Gateway                             │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Channels │  │  Agent    │  │   Tool   │  │    Subagent       │  │
│  │ (inbound │  │  Runner   │  │ Executor │  │    Registry       │  │
│  │  /outbnd)│  │          │  │          │  │                   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │              │                 │              │
│       ▼              ▼              ▼                 ▼              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Existing Hook & Event Infrastructure            │   │
│  │                                                              │   │
│  │  Plugin Hooks (24):        Agent Events:    Diagnostic Evts: │   │
│  │  · message_received        · stream:tool    · model.usage    │   │
│  │  · before_tool_call        · stream:life    · webhook.*      │   │
│  │  · after_tool_call         · stream:asst    · message.*      │   │
│  │  · llm_input / llm_output  · stream:error   · session.state  │   │
│  │  · agent_end                                · run.attempt    │   │
│  │  · session_start / _end                                      │   │
│  │  · subagent_spawned / _ended                                 │   │
│  │  · message_sent                                              │   │
│  │  · before/after_compaction                                   │   │
│  │                                                              │   │
│  │  NEW hooks (upstream):                                       │   │
│  │  · run_start                  (run begins)                   │   │
│  │  · before_message_process     (blocking inbound gate)        │   │
│  │  · subagent_stopping          (block subagent completion)    │   │
│  │  · model.call diagnostic evt  (per-LLM-call snapshots)      │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │             extensions/telemetry Plugin                       │   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │   │
│  │  │  Collector   │  │   Indexer    │  │   Query / CLI      │  │   │
│  │  │  Service     │  │   Service    │  │   Service          │  │   │
│  │  │             │  │             │  │                    │  │   │
│  │  │ · Hook       │  │ · Drains    │  │ · openclaw telemetry│  │   │
│  │  │   listeners  │  │   in-memory │  │   replay <session> │  │   │
│  │  │ · Agent evt  │  │   queue     │  │ · openclaw telemetry│  │   │
│  │  │   subscriber │  │ · Catches   │  │   tools <run>      │  │   │
│  │  │ · Diag evt   │  │   up from   │  │ · openclaw telemetry│  │   │
│  │  │   subscriber │  │   JSONL on  │  │   sessions         │  │   │
│  │  │ · Appends to │  │   startup   │  │ · HTTP API routes  │  │   │
│  │  │   JSONL +    │  │ · Upserts   │  │                    │  │   │
│  │  │   queue      │  │   to SQLite │  │                    │  │   │
│  │  └──────┬───────┘  └──────┬──────┘  └────────────────────┘  │   │
│  │         │                 │                                   │   │
│  │         ▼                 ▼                                   │   │
│  │  ┌────────────┐   ┌────────────┐                              │   │
│  │  │  JSONL     │   │  SQLite    │                              │   │
│  │  │  Event Log │   │  Index DB  │                              │   │
│  │  │  + Blobs   │   │            │                              │   │
│  │  │ events.jsonl   │ telemetry.db                              │   │
│  │  └────────────┘   └────────────┘                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 4. Data Sources — What We Tap

### 4.1 Existing Plugin Hooks (no upstream changes)

| Hook                | Data Captured                                                                     | Fires                   |
| ------------------- | --------------------------------------------------------------------------------- | ----------------------- |
| `session_start`     | sessionId, resumedFrom                                                            | Session creation        |
| `session_end`       | sessionId, messageCount, durationMs                                               | Session termination     |
| `llm_input`         | **runId**, sessionId, provider, model, prompt, historyMessages, imagesCount       | Before each LLM call    |
| `llm_output`        | **runId**, sessionId, provider, model, assistantTexts, usage (input/output/cache) | After each LLM response |
| `before_tool_call`  | toolName, params                                                                  | Before tool execution   |
| `after_tool_call`   | toolName, params, result, error, durationMs                                       | After tool execution    |
| `message_received`  | from, content, timestamp, metadata; ctx: channelId, accountId                     | Inbound message         |
| `message_sent`      | to, content, success, error                                                       | Outbound message        |
| `subagent_spawned`  | runId, childSessionKey, agentId, label, mode, requester                           | Subagent created        |
| `subagent_ended`    | targetSessionKey, outcome, reason, runId, endedAt, error                          | Subagent completed      |
| `before_compaction` | messageCount, tokenCount, sessionFile                                             | Before compaction       |
| `after_compaction`  | messageCount, compactedCount, sessionFile                                         | After compaction        |

### 4.2 Existing Event Streams (no upstream changes)

| Event System                            | Event Type                             | Data                                                                                                             |
| --------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Agent Events (`onAgentEvent`)           | `stream: "tool", phase: "start"`       | runId, toolName, toolCallId, args                                                                                |
| Agent Events                            | `stream: "tool", phase: "result"`      | runId, toolName, toolCallId, isError, result                                                                     |
| Agent Events                            | `stream: "lifecycle"`                  | runId, phase (start/end)                                                                                         |
| Diagnostic Events (`onDiagnosticEvent`) | `model.usage`                          | sessionKey, provider, model, usage (cumulative + lastCallUsage delta), context (limit/used), costUsd, durationMs |
| Diagnostic Events                       | `message.queued` / `message.processed` | sessionKey, channel, durationMs, outcome                                                                         |
| Diagnostic Events                       | `session.state`                        | sessionKey, state, queueDepth                                                                                    |

### 4.3 New Upstream Hooks Required

| Hook / Event                  | Purpose                                                                        | Specified In               |
| ----------------------------- | ------------------------------------------------------------------------------ | -------------------------- |
| `run_start` hook              | Explicit run start with runId, sessionKey, model                               | `01-hook-architecture.md`  |
| Enriched `agent_end` hook     | Run completion with usage, tool count, error (replaces hypothetical `run_end`) | `01-hook-architecture.md`  |
| `before_message_process`      | Blocking gate for inbound messages before agent queue                          | `01-hook-architecture.md`  |
| `model.call` diagnostic event | Per-LLM-call usage snapshots (delta + cumulative + context)                    | `01-hook-architecture.md`  |
| `subagent_stopping`           | Block subagent completion, inject new prompt                                   | `02-subagent-stop-hook.md` |

### 4.4 Hook Context Enrichment (trivial upstream additions)

Fields already in scope at call sites but not passed to hook listeners:

| Hook               | Change                                                                                                                                                                                  | Source Variable                             | Lines Changed |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------- |
| `after_tool_call`  | Fix call site: pass `agentId`, `sessionKey` (already on `PluginHookToolContext` type but passed as `undefined`). Add `runId` to type + call site. Add `toolCallId`, `isError` to event. | `ctx.params.*`, local `toolCallId`          | 5             |
| `agent_end`        | Add to event: `runId`, `provider`, `model`, `usage`, `toolNames`, `toolCallCount`, `compactionCount`, `stopReason`, `lastAssistantMessage`                                              | `params.*`, `getUsageTotals()`, `toolMetas` | 10            |
| `llm_output`       | Add to event: `durationMs`, `stopReason`, `messageCount`                                                                                                                                | computed, `lastAssistant?.stopReason`       | 3             |
| `subagent_ended`   | Add to event: `task`, `startedAt`, `label`, `model`, `spawnMode`, `durationMs`                                                                                                          | `params.entry.*`                            | 6             |
| `message_received` | `sessionKey`                                                                                                                                                                            | resolvable at call site                     | 1             |

Total upstream enrichment: ~25 lines of property additions + ~34 lines of type definitions.

## 5. Unified Event Schema

All telemetry events (regardless of source) are normalized into a single schema before JSONL/SQLite storage:

```typescript
type TelemetryEvent = {
  // Identity
  id: string; // UUID, unique per event
  ts: number; // Unix timestamp (ms)
  seq: number; // Monotonic sequence per session

  // Correlation
  agentId: string; // Agent that owns this event
  sessionKey: string; // Session key
  sessionId: string; // Session UUID
  runId?: string; // Run UUID (null for session-level events)

  // Classification
  kind: TelemetryEventKind; // See enum below
  stream?: string; // Sub-classification

  // Payload
  data: Record<string, unknown>; // Event-specific data
  error?: {
    // Present when event represents a failure
    message: string;
    code?: string;
    stack?: string;
    source?: string; // Which component errored
  };

  // Provenance
  source: "hook" | "agent_event" | "diagnostic_event";
  hookName?: string; // If source is "hook"
};

type TelemetryEventKind =
  | "session.start"
  | "session.end"
  | "run.start"
  | "run.end"
  | "llm.input"
  | "llm.output"
  | "llm.call" // llm.call = per-call snapshot
  | "tool.start"
  | "tool.end"
  | "message.inbound"
  | "message.outbound"
  | "subagent.spawn"
  | "subagent.stop"
  | "subagent.end"
  | "compaction.start"
  | "compaction.end"
  | "usage.snapshot" // Per-call usage delta
  | "error";
```

## 6. Storage Architecture

### 6.1 JSONL Event Log (append-only, archivable)

```
~/.openclaw/agents/{agentId}/telemetry/
├── events.jsonl              # All telemetry events, append-only
├── events.2026-03-01.jsonl   # Daily rotation (configurable)
├── blobs/                    # Externalized large tool I/O (see 03-telemetry-plugin.md §12)
│   ├── evt_abc123-input.txt
│   └── evt_abc123-output.txt
└── ...
```

One JSON object per line. Events are written synchronously from the Collector Service. Daily rotation prevents unbounded file growth. Large tool inputs/outputs (>4 KB by default) are written to external blob files; the JSONL event stores a `BlobRef` reference. Multi-policy retention (age, size, session count) cleans up both JSONL and blob files atomically.

### 6.2 SQLite Index Database

```
~/.openclaw/agents/{agentId}/telemetry/telemetry.db
```

**Tables:**

```sql
-- Core event table (mirrors JSONL but queryable)
CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  ts          INTEGER NOT NULL,
  seq         INTEGER NOT NULL,
  agent_id    TEXT NOT NULL,
  session_key TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  run_id      TEXT,
  kind        TEXT NOT NULL,
  stream      TEXT,
  data_json   TEXT NOT NULL,         -- Full event data as JSON
  error_json  TEXT,                   -- Error details if present
  source      TEXT NOT NULL
);

-- Run-level summary (materialized from run.start + enriched agent.end)
CREATE TABLE runs (
  run_id          TEXT PRIMARY KEY,
  session_key     TEXT NOT NULL,
  session_id      TEXT NOT NULL,
  agent_id        TEXT NOT NULL,
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  duration_ms     INTEGER,
  model           TEXT,
  provider        TEXT,
  input_tokens    INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  cache_read      INTEGER DEFAULT 0,
  cache_write     INTEGER DEFAULT 0,
  total_tokens    INTEGER DEFAULT 0,
  cost_usd        REAL,
  tool_call_count INTEGER DEFAULT 0,
  tool_names_json TEXT,              -- JSON array of unique tool names
  stop_reason     TEXT,
  error_json      TEXT,
  is_heartbeat    INTEGER DEFAULT 0,
  compaction_count INTEGER DEFAULT 0
);

-- Tool call detail (one row per tool invocation)
CREATE TABLE tool_calls (
  tool_call_id TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL,
  session_key  TEXT NOT NULL,
  ts           INTEGER NOT NULL,
  tool_name    TEXT NOT NULL,
  params_json  TEXT,                  -- Full tool input
  result_json  TEXT,                  -- Full tool output (optional, configurable)
  error        TEXT,
  duration_ms  INTEGER,
  file_path    TEXT,                  -- Extracted from params for Read/Write/Edit
  exec_command TEXT,                  -- Extracted from params for Bash/exec
  FOREIGN KEY (run_id) REFERENCES runs(run_id)
);

-- File operations index (derived from tool_calls)
CREATE TABLE file_operations (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL,
  session_key TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  operation   TEXT NOT NULL,          -- read, write, edit, glob, grep
  file_path   TEXT NOT NULL,
  tool_call_id TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(run_id)
);

-- Channel linkage (message → session → run)
CREATE TABLE channel_links (
  id           TEXT PRIMARY KEY,
  ts           INTEGER NOT NULL,
  direction    TEXT NOT NULL,         -- inbound, outbound
  channel_id   TEXT NOT NULL,
  account_id   TEXT,
  from_addr    TEXT,
  to_addr      TEXT,
  session_key  TEXT NOT NULL,
  run_id       TEXT,
  content_preview TEXT,               -- First 200 chars
  success      INTEGER
);

-- Subagent hierarchy
CREATE TABLE subagent_tree (
  run_id              TEXT PRIMARY KEY,
  parent_session_key  TEXT NOT NULL,
  child_session_key   TEXT NOT NULL,
  agent_id            TEXT NOT NULL,
  label               TEXT,
  task                TEXT,
  spawn_mode          TEXT,           -- run, session
  model               TEXT,
  started_at          INTEGER,
  ended_at            INTEGER,
  duration_ms         INTEGER,
  outcome             TEXT,
  error               TEXT,
  steer_count         INTEGER DEFAULT 0
);

-- Usage snapshots (per-LLM-call metrics)
CREATE TABLE usage_snapshots (
  id           TEXT PRIMARY KEY,
  ts           INTEGER NOT NULL,
  run_id       TEXT NOT NULL,
  session_key  TEXT NOT NULL,
  call_index   INTEGER NOT NULL,     -- 0-based within run
  provider     TEXT,
  model        TEXT,
  delta_input  INTEGER,
  delta_output INTEGER,
  delta_cache_read  INTEGER,
  delta_cache_write INTEGER,
  cumul_input  INTEGER,
  cumul_output INTEGER,
  cumul_cache_read  INTEGER,
  cumul_cache_write INTEGER,
  cumul_total  INTEGER,
  context_limit INTEGER,
  context_used  INTEGER,
  cost_usd     REAL,
  duration_ms  INTEGER,
  FOREIGN KEY (run_id) REFERENCES runs(run_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_events_session ON events(session_key, ts);
CREATE INDEX idx_events_run ON events(run_id, seq);
CREATE INDEX idx_events_kind ON events(kind, ts);
CREATE INDEX idx_runs_session ON runs(session_key, started_at);
CREATE INDEX idx_tool_calls_run ON tool_calls(run_id, ts);
CREATE INDEX idx_tool_calls_name ON tool_calls(tool_name, ts);
CREATE INDEX idx_file_ops_path ON file_operations(file_path, ts);
CREATE INDEX idx_file_ops_run ON file_operations(run_id, ts);
CREATE INDEX idx_channel_session ON channel_links(session_key, ts);
CREATE INDEX idx_channel_channel ON channel_links(channel_id, ts);
CREATE INDEX idx_subagent_parent ON subagent_tree(parent_session_key);
CREATE INDEX idx_subagent_child ON subagent_tree(child_session_key);
CREATE INDEX idx_usage_run ON usage_snapshots(run_id, call_index);
```

## 7. Major Audit Event Flows

### 7.1 Inbound Message → Agent Run → Outbound Reply

```
Channel webhook received
  │
  ├─ CAPTURE: message_received hook → TelemetryEvent(kind: "message.inbound")
  │           data: { from, content, channel, accountId, sessionKey }
  │
  ▼
Message queued (enqueueFollowupRun)
  │
  ├─ CAPTURE: model.usage diagnostic → TelemetryEvent(kind: "usage.snapshot")
  │
  ▼
Run starts (runEmbeddedPiAgent)
  │
  ├─ CAPTURE: run_start hook → TelemetryEvent(kind: "run.start")
  │           data: { runId, sessionKey, model, provider, isHeartbeat }
  │
  ├─► LLM call #1
  │   ├─ CAPTURE: llm_input hook → TelemetryEvent(kind: "llm.input")
  │   ├─ CAPTURE: model.call diagnostic → TelemetryEvent(kind: "llm.call")
  │   │           data: { delta, cumulative, context, costUsd }
  │   └─ CAPTURE: llm_output hook → TelemetryEvent(kind: "llm.output")
  │
  ├─► Tool call: exec "npm test"
  │   ├─ CAPTURE: AgentEvent(stream:tool, phase:start) → TelemetryEvent(kind: "tool.start")
  │   │           data: { runId, toolName, toolCallId, args }
  │   ├─ CAPTURE: after_tool_call hook → TelemetryEvent(kind: "tool.end")
  │   │           data: { toolName, params, result, error, durationMs, runId, toolCallId }
  │   └─ CAPTURE: AgentEvent(stream:tool, phase:result) [redundant — use hook]
  │
  ├─► LLM call #2 (after tool result)
  │   ├─ CAPTURE: model.call diagnostic → TelemetryEvent(kind: "llm.call")
  │   └─ CAPTURE: llm_output hook → TelemetryEvent(kind: "llm.output")
  │
  ▼
Run ends
  │
  ├─ CAPTURE: enriched agent_end hook → TelemetryEvent(kind: "run.end")
  │           data: { runId, sessionKey, durationMs, usage, toolCallCount, stopReason, error }
  │           (enriched with run-level data: model, provider, toolNames, compactionCount, etc.)
  │
  ▼
Reply delivered
  │
  └─ CAPTURE: message_sent hook → TelemetryEvent(kind: "message.outbound")
             data: { to, content, success, error, channel }
```

### 7.2 Subagent Spawn → Work → Complete → Announce

```
Parent run spawns subagent
  │
  ├─ CAPTURE: subagent_spawned hook → TelemetryEvent(kind: "subagent.spawn")
  │           data: { runId, childSessionKey, agentId, label, mode, task, requester }
  │
  ▼
Child session run starts
  │
  ├─ CAPTURE: run_start → kind: "run.start" (child sessionKey)
  ├─ [tool calls, LLM calls — same capture as 7.1]
  ▼
Child run completes
  │
  ├─ CAPTURE: subagent_stopping hook (if registered) → kind: "subagent.stop"
  │   ├─ If blocked: new prompt injected, new run starts (steer-restart)
  │   └─ If allowed: continue to announce
  │
  ├─ CAPTURE: subagent_ended hook → TelemetryEvent(kind: "subagent.end")
  │           data: { targetSessionKey, outcome, reason, task, startedAt, durationMs, error }
  │
  ▼
Result announced to parent
  │
  └─ Parent's next run includes subagent result in context
```

### 7.3 Tool Error Flow

```
Tool call fails
  │
  ├─ CAPTURE: AgentEvent(stream:tool, phase:result, isError:true)
  │           → TelemetryEvent(kind: "tool.end")
  │           data: { toolName, toolCallId, isError: true, error: "...", params }
  │
  ├─ CAPTURE: after_tool_call hook (error field set)
  │           → TelemetryEvent(kind: "tool.end")
  │           data: { ..., error: "Command exited with status 1", durationMs }
  │
  ▼
Agent retries or errors out
  │
  ├─ If agent errors: CAPTURE: enriched agent_end hook with error
  │   → TelemetryEvent(kind: "run.end")
  │   data: { runId, error: { message, code, source: "tool" | "llm" | "compaction" } }
  │
  └─ If agent retries: new LLM call, new tool.start events
     (full audit trail of retry attempts)
```

## 8. Query Patterns

The SQLite index enables these queries without JSONL scanning:

| Query                      | SQL Pattern                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Replay a session           | `SELECT * FROM events WHERE session_key = ? ORDER BY ts, seq`                                                                 |
| Replay a run               | `SELECT * FROM events WHERE run_id = ? ORDER BY seq`                                                                          |
| All tools in a run         | `SELECT * FROM tool_calls WHERE run_id = ? ORDER BY ts`                                                                       |
| Files touched in a session | `SELECT DISTINCT file_path, operation FROM file_operations WHERE session_key = ?`                                             |
| Token usage over time      | `SELECT * FROM usage_snapshots WHERE run_id = ? ORDER BY call_index`                                                          |
| Channel → session mapping  | `SELECT * FROM channel_links WHERE channel_id = ? ORDER BY ts DESC`                                                           |
| Subagent tree for session  | `SELECT * FROM subagent_tree WHERE parent_session_key = ?`                                                                    |
| Costliest runs             | `SELECT * FROM runs ORDER BY cost_usd DESC LIMIT 20`                                                                          |
| Failed runs                | `SELECT * FROM runs WHERE error_json IS NOT NULL ORDER BY ended_at DESC`                                                      |
| Tool error rate            | `SELECT tool_name, COUNT(*) filter (WHERE error IS NOT NULL) as errors, COUNT(*) as total FROM tool_calls GROUP BY tool_name` |

## 9. Cross-Reference to Detailed Specs

| Document                   | Covers                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `01-hook-architecture.md`  | Hook mapping, context enrichment, new hooks (run_start, model.call), agent_end enrichment, per-call usage snapshots |
| `02-subagent-stop-hook.md` | SubagentStop hook design with steer-restart, loop protection, implementation strategy                               |
| `03-telemetry-plugin.md`   | Plugin architecture, JSONL collector, direct-write indexer, blob externalization, retention, query CLI              |

## 10. Implementation Priority

| Phase       | What                                                                                                                                | Upstream Changes | Plugin Work                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------- |
| **Phase 0** | Hook context enrichment (fix call-site values + add runId/toolCallId/isError to events, enrich agent_end/llm_output/subagent_ended) | ~60 lines        | 0                             |
| **Phase 1** | `run_start` hook + `agent_end` enrichment + `model.call` diagnostic event                                                           | ~75 lines        | 0                             |
| **Phase 2** | Telemetry plugin with JSONL capture, blob externalization, retention                                                                | 0                | ~900 lines                    |
| **Phase 3** | SQLite indexer (direct-write + startup catchup) + query CLI                                                                         | 0                | ~700 lines                    |
| **Phase 4** | `before_message_process` blocking hook + `subagent_stopping` hook (deferred)                                                        | ~170 lines       | ~100 lines (plugin listeners) |
| **Phase 5** | HTTP API routes for UI consumption                                                                                                  | 0                | ~200 lines                    |
