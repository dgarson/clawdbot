# Telemetry System — Implementation Proposal

> Comprehensive roadmap synthesizing designs `00` through `03` into phased, dependency-ordered implementation tasks with verification findings from the current codebase.

## Commit Strategy

This document defines six implementation phases. **For each phase, use the commit guidelines from the corresponding design doc** (00 through 03). Additionally, follow these meta-principles:

1. **Commits track phases, not files**: A single commit should complete one concern (e.g., "Phase 0: enrich after_tool_call context") even if it touches multiple files. Conversely, do not combine unrelated phases into one commit.

2. **Each commit is independently reviewable**: A reviewer should be able to understand what changed, why, and how to verify it — without reading previous commits in the same PR.

3. **Use phase numbers in commit messages**: Start each message with the phase number (e.g., `"Phase 1: Add run_start hook specification and runner"`).

4. **Grouping by concern, not by file**: Instead of "Update types.ts" and "Update hooks.ts", use "Phase 1: Define run_start hook types" and "Phase 1: Implement run_start hook runner with agent_end enrichment".

5. **Tests in dedicated commits**: Bundle tests for a phase with that phase's code (one commit per phase, or split into smaller commits if tests are large).

6. **Parallel phases can land independently**: If Phase 0 is complete, Phase 1, 2, and 3 can be reviewed and landed in any order. Phase 4 requires 0+1+2, but 3 is independent.

For detailed commit guidance specific to each phase, see Sections 2-4 of this document and the per-phase sections in the design docs.

---

## 1. Executive Summary

The telemetry system adds full session replay, tool audit, agent hierarchy mapping, per-LLM-call snapshot metrics, and error provenance to OpenClaw. It captures data through existing hooks and event streams (with targeted enrichment), introduces four new upstream hooks, and materializes everything into a hybrid JSONL + SQLite storage layer exposed via CLI and HTTP API.

**Why it matters:**

- **Debugging** — Replay any session or run with full tool-call, LLM-call, and subagent timeline. No more parsing raw JSONL transcripts to diagnose agent failures.
- **Quality gates** — The `subagent_stopping` hook enables blocking subagent completion and injecting corrective prompts, preventing premature "done" announcements.
- **Cost tracking** — Per-LLM-call usage snapshots show token consumption growth and cost attribution per tool interaction, enabling budget enforcement.
- **Compliance** — Channel-to-run linkage and tool audit trail provide an auditable record of what was processed, by which model, with what tools.
- **Content safety** — The `before_message_process` blocking hook enables prompt injection detection and content filtering before agent invocation.

**Scope:** ~2,900 lines of new/changed code across upstream core (~350 lines) and the `extensions/telemetry` plugin (~2,400 lines, including blob externalization and retention), plus ~750 lines of tests.

---

## 2. Implementation Phases

### Phase 0: Hook Context Enrichment

**What:** Pass already-in-scope variables through existing hook payloads. Sections 2.1-2.6 of `01-hook-architecture.md`.

**Why first:** Zero-risk, additive-only changes that unblock the telemetry plugin's ability to correlate events by `runId`, `sessionKey`, and `toolCallId`. Without this, the plugin cannot associate tool calls with runs or sessions.

**Files changed:**

| File                                                 | Change                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/plugins/types.ts`                               | Add `runId` to `PluginHookToolContext` (only new field — `agentId`/`sessionKey` already exist). Add `toolCallId`, `isError` to `PluginHookAfterToolCallEvent`. Add `toolCallId` to `PluginHookBeforeToolCallEvent`. Add 9 fields to `PluginHookAgentEndEvent`. Add 3 to `PluginHookLlmOutputEvent`. Add 6 to `PluginHookSubagentEndedEvent`. |
| `src/agents/pi-embedded-subscribe.handlers.tools.ts` | Fix call-site: pass `ctx.params.agentId`, `ctx.params.sessionKey` instead of `undefined` (lines 429-430); add `ctx.params.runId` (new); add `toolCallId`, `isError` to hook event (lines 419-425)                                                                                                                                            |
| `src/agents/pi-tools.before-tool-call.ts`            | Pass `toolCallId` into `PluginHookBeforeToolCallEvent` at line ~142-145                                                                                                                                                                                                                                                                      |
| `src/agents/pi-embedded-runner/run/attempt.ts`       | Enrich `agent_end` hook event with `runId`, `provider`, `model`, `usage`, `toolCallCount`, `toolNames`, `compactionCount`, `stopReason`                                                                                                                                                                                                      |
| `src/agents/subagent-registry-completion.ts`         | Add `task`, `label`, `startedAt`, `model`, `spawnMode`, `durationMs` to `subagent_ended` hook event at lines 69-86                                                                                                                                                                                                                           |

**Estimated diff size:** ~60 lines (26 lines at call sites + 34 lines type additions)

**Risk level:** Low. All additions are optional fields on existing types. No behavioral changes. Existing hook consumers are unaffected.

**Prerequisites:** None.

**Acceptance criteria:**

- All existing tests pass unchanged.
- `after_tool_call` hook listeners receive `runId`, `sessionKey`, `agentId`, `toolCallId` in context/event.
- `agent_end` hook listeners receive `runId`, `usage`, `toolNames`, `stopReason` in event.
- `subagent_ended` hook listeners receive `task`, `label`, `startedAt`, `model`, `durationMs` in event.
- Type-check passes: `pnpm tsgo`.

---

### Phase 1: New Core Hooks & Enrichment — `run_start` + Enriched `agent_end`

**What:** Explicit run start hook + enrich `agent_end` with run completion data. Section 3 of `01-hook-architecture.md`.

**Why now:** The telemetry plugin needs run boundary events to populate the `runs` table and provide run-level cost accounting. Rather than adding a new `run_end` hook, we enrich the existing `agent_end` hook with run-level data (`runId`, `usage`, `toolCallCount`, etc.), eliminating redundant hooks and reducing upstream code.

**Files changed:**

| File                                           | Change                                                                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/plugins/types.ts`                         | Add `"run_start"` to `PluginHookName` union; define `PluginHookRunStartEvent`; add handler signature to `PluginHookHandlerMap`. Enrich `PluginHookAgentEndEvent` with 9 new optional fields. |
| `src/plugins/hooks.ts`                         | Add `runRunStart()` function (void hook); export from runner                                                                                                                                 |
| `src/auto-reply/reply/agent-runner.ts`         | Emit `run_start` at run begin (~line 490)                                                                                                                                                    |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Enrich `agent_end` hook event with `runId`, `provider`, `model`, `usage`, `toolCallCount`, `toolNames`, `compactionCount`, `stopReason`, `lastAssistantMessage`                              |
| `src/agents/pi-embedded-runner/run.ts`         | Alternative insertion point for embedded CLI runs (if `run_start` hook added there)                                                                                                          |

**Estimated diff size:** ~75 lines (35 types + 25 call sites + 15 runner) + ~40 lines tests

**Risk level:** Low. Additive hook and enrichment. Fire-and-forget. No existing behavior changes.

**Prerequisites:** Phase 0 (context enrichment) recommended for full correlation.

**Acceptance criteria:**

- `run_start` fires with `runId`, `sessionKey`, `model`, `provider`, `isHeartbeat` before first LLM call.
- Enriched `agent_end` includes `runId`, `usage`, `toolCallCount`, `toolNames`, `durationMs`, `stopReason`, `lastAssistantMessage`, `error`.
- Hook registration via `api.on("run_start", ...)` works in plugin code.
- Plugin listens to enriched `agent_end` (not a nonexistent `run_end` hook) and emits `run.end` telemetry event.
- Existing run flows (followup, heartbeat, embedded CLI) all fire the `run_start` hook and enriched `agent_end`.

---

### Phase 2: New Diagnostic Event — `model.call`

**What:** Per-LLM-call usage snapshots. Section 6 of `01-hook-architecture.md`.

**Why now:** Enables the telemetry plugin's `usage_snapshots` table and per-call token growth visualization. Must be in place before the plugin's collector can capture per-call data.

**Files changed:**

| File                                  | Change                                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/infra/diagnostic-events.ts`      | Add `DiagnosticModelCallEvent` type to `DiagnosticEventPayload` union                                                                                                                                        |
| `src/agents/pi-embedded-subscribe.ts` | Add `callIndex` counter; emit `model.call` diagnostic event inside `recordAssistantUsage` (line 259-272). Note: function signature is `(usageLike: unknown)` — normalizes internally via `normalizeUsage()`. |

**Estimated diff size:** ~72 lines (25 types + 17 emission + 30 tests)

**Risk level:** Low. Adds a new event type to an existing diagnostic bus. No behavioral changes. The `emitDiagnosticEvent` function already guards against recursion (depth > 100) and logs listener errors without propagating them.

**Prerequisites:** None.

**Acceptance criteria:**

- `model.call` events are emitted after each LLM response with `delta`, `cumulative`, `callIndex`, `runId`.
- `callIndex` increments correctly within a run (0-based).
- Existing `model.usage` diagnostic event continues to fire unchanged.
- `onDiagnosticEvent` listeners receive the new event type.

---

### Phase 3: SubagentStop Hook — `subagent_stopping`

**What:** Blocking hook at subagent completion with steer-restart. Full `02-subagent-stop-hook.md`.

**Why now:** Independent of the telemetry plugin but high value. Enables quality gates on subagent output. The steer-restart mechanism already exists in the codebase (`markSubagentRunForSteerRestart`, `replaceSubagentRunAfterSteer`, `clearSubagentRunSteerRestart` at `subagent-registry.ts:794-893`), so implementation reuses existing infrastructure.

**Files changed:**

| File                                    | Change                                                                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/plugins/types.ts`                  | Add `"subagent_stopping"` to `PluginHookName`; define `PluginHookSubagentStoppingEvent`, `PluginHookSubagentStoppingResult`, `PluginHookSubagentStoppingContext` |
| `src/plugins/hooks.ts`                  | Add `runSubagentStopping()` (sequential/modifying hook)                                                                                                          |
| `src/agents/subagent-registry.ts`       | Insert hook invocation in `completeSubagentRun()` between persist (line 347) and announce (line 377); add steer-count logic                                      |
| `src/agents/subagent-registry.types.ts` | Add `steerCount?: number` to `SubagentRunRecord`                                                                                                                 |
| `src/agents/subagent-registry.ts`       | In `replaceSubagentRunAfterSteer()` (~line 867-883): carry forward `steerCount + 1`                                                                              |
| `src/config/agent-limits.ts`            | Add `maxSteerRestarts` default                                                                                                                                   |

**Estimated diff size:** ~248 lines (45 types + 25 runner + 40 call site + 25 lastAssistantMessage reader + 10 steerCount + 3 config + 100 tests)

**Risk level:** Medium. This hook is sequential and blocking — it runs in the `completeSubagentRun` path which is already complex (lifecycle error grace, announce retry, cleanup flows). Key risks:

- Hook handler timeout could delay subagent completion announcements.
- A buggy handler returning `{ allow: false }` without a prompt triggers the fail-open guard but still adds latency.
- The steer-restart flow involves cross-process gateway calls (`callGateway`) which can fail.

**Mitigation:** Fail-open on all error paths. Add a per-handler timeout (e.g. 10s). Max steers enforcement (default 3) prevents infinite loops.

**Prerequisites:** None (uses existing steer-restart mechanism).

**Acceptance criteria:**

- `subagent_stopping` fires before `subagent_ended` for completed subagents (not killed ones).
- Returning `{ allow: false, prompt: "..." }` triggers steer-restart with new prompt.
- `steerCount` increments on each redirect and is passed to the hook.
- Hook is skipped when `steerCount >= maxSteers`.
- `subagent_ended` does NOT fire for redirected runs.
- Existing steer-restart via the `subagents` tool still works.

---

### Phase 4: Telemetry Plugin Foundation — Collector + JSONL Writer + Blob Externalization

**What:** The `extensions/telemetry` plugin scaffold, collector service, hook listeners, agent/diagnostic event handlers, JSONL writer, blob externalization, and retention service. Sections 1-4, 10, 12 of `03-telemetry-plugin.md`.

**Why now:** This is the main deliverable. Phases 0-2 provide the enriched data; this phase captures it.

**Files changed (all new):**

| File                                        | Change                                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `extensions/telemetry/package.json`         | New plugin package                                               |
| `extensions/telemetry/openclaw.plugin.json` | Plugin manifest                                                  |
| `extensions/telemetry/index.ts`             | Plugin entry, registration, config schema                        |
| `extensions/telemetry/src/collector.ts`     | Hook listeners, agent event handler, diagnostic event handler    |
| `extensions/telemetry/src/writer.ts`        | JSONL writer with rotation + `appendWithId` for blob correlation |
| `extensions/telemetry/src/blob-writer.ts`   | BlobWriter, BlobRef, isBlobRef, loadBlob, resolveValue           |
| `extensions/telemetry/src/retention.ts`     | Multi-policy retention (age, size, session count) + orphan sweep |
| `extensions/telemetry/src/types.ts`         | TelemetryEvent, TelemetryEventKind, BlobRef, config types        |
| `extensions/telemetry/src/helpers.ts`       | extractFilePath, extractExecCommand, captureResult, captureInput |
| `extensions/telemetry/src/*.test.ts`        | Tests for collector, writer, blob writer, retention, helpers     |

**Estimated diff size:** ~900 lines (100 scaffold + 350 collector + 80 writer + 90 blob writer + 260 retention + 20 helpers) + ~300 lines tests

**Risk level:** Low-Medium. Pure plugin code with no upstream changes. Risks:

- JSONL write performance under high event throughput (mitigated by append-only streaming writes).
- File rotation race conditions during midnight rollover (mitigated by synchronous rename).
- Blob directory growth under `captureToolResults: "full"` (mitigated by `retentionMaxSizeMb` default 500 MB).
- Event ordering guarantees — monotonic `seq` counter is process-local; multi-process gateways would need coordination (documented as a known limitation).

**Prerequisites:** Phase 0 (enrichment) for full correlation. Phase 1 (`run_start` + enriched `agent_end`) for run boundary events. Phase 2 (`model.call`) for per-call snapshots. The plugin can function without these but will have gaps.

**Acceptance criteria:**

- `openclaw plugins install telemetry` succeeds.
- JSONL file created at `~/.openclaw/agents/{agentId}/telemetry/events.jsonl`.
- Events are written for: session start/end, tool calls, LLM calls, messages, subagent lifecycle, compaction.
- Daily rotation creates dated archive files.
- Config options (`captureToolResults`, `captureToolInputs`, `rotationPolicy`, `blobThresholdBytes`) are respected.
- Large tool I/O (>4 KB default) externalized to `blobs/` directory when capture mode is `"full"`.
- Retention runs at startup and daily; cleans JSONL + blobs atomically.

---

### Phase 5: SQLite Indexer + CLI + HTTP API

**What:** SQLite materialized index with direct-write from collector (in-memory queue) and startup catchup from JSONL, query CLI commands, HTTP API routes. Sections 5-9 of `03-telemetry-plugin.md`.

**Why now:** Builds the query layer on top of the JSONL capture from Phase 4.

**Files changed (all new):**

| File                                  | Change                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `extensions/telemetry/src/indexer.ts` | SQLite schema init, in-memory queue, startup catchup from JSONL, event dispatcher                   |
| `extensions/telemetry/src/queries.ts` | SQL query functions for each table                                                                  |
| `extensions/telemetry/src/cli.ts`     | 7 CLI command handlers (replay, tools, files, usage, sessions, subagents, stats) + `--expand-blobs` |
| `extensions/telemetry/src/routes.ts`  | 6 HTTP route handlers + `?expand=blobs` for tool call routes                                        |
| `extensions/telemetry/src/*.test.ts`  | Tests for indexer, queries, CLI                                                                     |

**Estimated diff size:** ~700 lines (300 indexer + 280 CLI + 135 routes + 150 queries) + ~200 lines tests

**Risk level:** Medium. Key risks:

- SQLite WAL mode behavior — WAL files can grow large if checkpointing is infrequent under heavy write load.
- Large JSONL files during startup catchup could cause memory pressure (mitigated by streaming line-by-line rather than bulk read).
- `better-sqlite3` or equivalent native dependency adds install complexity.

**Prerequisites:** Phase 4 (JSONL capture + blob externalization).

**Acceptance criteria:**

- `telemetry.db` is created with all 7 tables and 14 indexes.
- Events from the collector's in-memory queue are indexed into SQLite in real-time.
- On restart, the indexer catches up from JSONL using last-indexed byte position.
- `openclaw telemetry replay <sessionKey>` shows a formatted timeline.
- `openclaw telemetry tools <runId>` shows tool calls with params, duration, errors.
- `openclaw telemetry tools <runId> --expand-blobs` loads and displays full tool I/O from blob files.
- `openclaw telemetry usage <runId> --per-call` shows per-LLM-call token breakdown.
- HTTP routes return JSON for all query patterns; `?expand=blobs` resolves blob references.

---

### Phase 6: `before_message_process` + `permission_request` Hooks

**What:** Blocking inbound message gate and permission request hook. Sections 4-5 of `01-hook-architecture.md`.

**Why later:** These hooks are valuable for security (prompt injection detection, rate limiting) but are not required for core telemetry capture. They are independent of the telemetry plugin and can be implemented in parallel with Phases 4-5.

**Files changed:**

| File                                           | Change                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/plugins/types.ts`                         | Add `"before_message_process"` and `"permission_request"` to `PluginHookName`; define event/result types |
| `src/plugins/hooks.ts`                         | Add `runBeforeMessageProcess()` (sequential) and `runPermissionRequest()` (sequential)                   |
| `src/auto-reply/reply/dispatch-from-config.ts` | Insert `before_message_process` hook before `enqueueFollowupRun()`                                       |
| Tool approval gate (location TBD)              | Insert `permission_request` hook at approval decision point                                              |

**Estimated diff size:** ~185 lines (35 types + 25 runners + 45 call sites + 80 tests)

**Risk level:** Medium-High. These are blocking hooks in the hot path:

- `before_message_process` runs before every inbound message is queued. A slow handler delays all message processing.
- Fail-open behavior means a crashed handler allows all messages through, which is the correct default but may surprise security-focused implementers expecting fail-closed.
- The exact insertion point for `before_message_process` needs careful analysis of channel dispatch paths — the design notes that dispatch may be fragmented across channels.

**Prerequisites:** None (independent of telemetry plugin).

**Acceptance criteria:**

- `before_message_process` fires after `message_received` and before `enqueueFollowupRun`.
- Returning `{ block: true }` prevents the message from being enqueued.
- Returning `{ modifiedContent: "..." }` replaces message content.
- Handler errors are logged and do not block message processing (fail-open).
- `permission_request` fires at the tool approval decision point.
- Returning `{ decision: "allow" }` or `{ decision: "deny" }` overrides the approval flow.

---

## 3. Dependency Graph

```
Phase 0 ─────────────────────────────┐
(Context Enrichment)                  │
                                      ▼
Phase 1 ──────────────────────► Phase 4 ──────► Phase 5
(run_start +                    (Plugin        (SQLite +
 enrich agent_end)               Collector      CLI +
                                 + JSONL)        HTTP API)
Phase 2 ──────────────────────►      ▲
(model.call diagnostic)              │
                                     │
Phase 3 ──────────────────────────────┘
(subagent_stopping hook)

Phase 6 ════════════════════════════════  (independent, parallel with 4-5)
(before_message_process +
 permission_request)
```

**Parallelization opportunities:**

- Phases 0, 1, 2, 3 can all be implemented in parallel (no inter-dependencies).
- Phase 6 can be implemented in parallel with Phases 4 and 5.
- Phase 4 depends on 0+1+2 for full data, but can start with partial data.
- Phase 5 depends strictly on Phase 4.

---

## 4. Cross-Cutting Concerns

### 4.1 Backward Compatibility

All changes are strictly additive:

- **Type additions:** All new fields on existing hook event/context types are optional (`?`). Existing plugin hook handlers will not break.
- **New hook names:** Added to the `PluginHookName` union. Plugins that don't register for new hooks are unaffected.
- **New diagnostic event type:** Added to the `DiagnosticEventPayload` discriminated union. Existing `onDiagnosticEvent` listeners that switch on `event.type` will ignore unknown types.
- **No breaking changes.** Zero existing function signatures are modified. No existing behavior is altered.

### 4.2 Performance Impact

| Concern                               | Impact                                                                   | Mitigation                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Hook invocation overhead              | Negligible — `hasHooks()` short-circuits when no handlers registered     | Only fires hooks when at least one handler is registered                    |
| JSONL write latency                   | ~0.1ms per event (append to open WriteStream)                            | Fire-and-forget from hooks; writes are non-blocking                         |
| SQLite indexing latency               | ~1-5ms per batch of events (WAL mode, prepared statements, transactions) | Indexer drains in-memory queue asynchronously; does not block event capture |
| `subagent_stopping` hook latency      | Up to handler timeout (recommend 10s max)                                | Fail-open on timeout; max steers enforcement prevents loops                 |
| `before_message_process` hook latency | Adds latency to every inbound message                                    | Fail-open on error; handlers should be fast (< 100ms)                       |
| Memory — startup JSONL catchup        | Up to delta size since last index                                        | Stream line-by-line for large deltas rather than bulk Buffer read           |

### 4.3 Configuration Surface

New config keys introduced across all phases:

| Key                                             | Phase | Default     | Description                                                   |
| ----------------------------------------------- | ----- | ----------- | ------------------------------------------------------------- |
| `agents.defaults.subagents.maxSteerRestarts`    | 3     | `3`         | Max times `subagent_stopping` can redirect                    |
| Plugin config: `telemetry.enabled`              | 4     | `true`      | Enable/disable telemetry capture                              |
| Plugin config: `telemetry.captureToolResults`   | 4     | `"summary"` | `none` / `summary` / `full`                                   |
| Plugin config: `telemetry.captureToolInputs`    | 4     | `"full"`    | `none` / `summary` / `full`                                   |
| Plugin config: `telemetry.captureLlmPayloads`   | 4     | `false`     | Capture full LLM payloads                                     |
| Plugin config: `telemetry.rotationPolicy`       | 4     | `"daily"`   | `daily` / `weekly` / `none`                                   |
| Plugin config: `telemetry.blobThresholdBytes`   | 4     | `4096`      | Externalize tool I/O larger than N bytes (-1 = disable)       |
| Plugin config: `telemetry.sqliteEnabled`        | 5     | `true`      | Enable SQLite indexer                                         |
| Plugin config: `telemetry.retentionDays`        | 4     | `30`        | Auto-delete JSONL files older than N days (0 = keep forever)  |
| Plugin config: `telemetry.retentionMaxSizeMb`   | 4     | `500`       | Auto-delete oldest when total dir exceeds N MB (0 = no limit) |
| Plugin config: `telemetry.retentionMaxSessions` | 4     | `0`         | Keep at most N sessions (0 = no limit)                        |

### 4.4 Testing Strategy

| Phase   | Test Approach                                                                                                                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 | Unit tests verifying enriched fields are present in hook events. Modify existing wired-hooks tests (`src/plugins/wired-hooks-after-tool-call.test.ts`, `src/plugins/wired-hooks-subagent.test.ts`). |
| Phase 1 | Unit tests for `runRunStart`/`runRunEnd` hook runner functions. Integration test verifying hooks fire during an embedded agent run.                                                                 |
| Phase 2 | Unit test for `model.call` diagnostic event emission. Verify `callIndex` increments. Verify `delta` and `cumulative` values.                                                                        |
| Phase 3 | Unit tests for steer-count tracking, max-steers enforcement, fail-open behavior. Integration test for full steer-restart cycle via hook. Use `addSubagentRunForTests` for state setup.              |
| Phase 4 | Unit tests for JSONL writer (append, rotation, close). Unit tests for collector event-to-JSONL mapping. Integration test with mock hooks verifying end-to-end event capture.                        |
| Phase 5 | Unit tests for SQLite schema creation and each indexer dispatch case. Unit tests for SQL query functions. CLI output formatting tests. HTTP route handler tests with mock DB.                       |
| Phase 6 | Unit tests for sequential hook execution, block/modify/pass-through behavior. Integration test verifying blocked messages are not enqueued. Fail-open test for handler errors.                      |

### 4.5 Migration Path

- **Existing sessions/data:** No migration needed. The telemetry system captures forward-looking events only. Historical sessions are not retroactively indexed.
- **Existing plugins:** No changes required. All type additions are optional.
- **Upgrade path:** Install the telemetry plugin, restart the gateway. Events start being captured immediately.
- **Downgrade path:** Uninstall the plugin. JSONL files and SQLite DB remain on disk but are inert. No core behavior changes.

---

## 5. Risk Register

| Risk                                                        | Impact                                              | Likelihood                      | Mitigation                                                                               |
| ----------------------------------------------------------- | --------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `subagent_stopping` handler deadlocks the announce flow     | High — subagent results never delivered to parent   | Low                             | Fail-open on handler error/timeout; per-handler timeout (10s); max steers cap (3)        |
| JSONL file grows unbounded on `none` rotation policy        | Medium — disk exhaustion                            | Low                             | `retentionDays` enforcement; daily rotation by default; documentation                    |
| SQLite WAL grows large under heavy write load               | Medium — disk usage; potential file locking issues  | Medium                          | Periodic WAL checkpointing in indexer service; document `PRAGMA wal_checkpoint(PASSIVE)` |
| Blob directory growth under `full` capture mode             | Medium — disk exhaustion if retention disabled      | Medium                          | `retentionMaxSizeMb` (default 500 MB); `blobThresholdBytes` controls externalization     |
| `better-sqlite3` native module build failures               | High — plugin install broken                        | Low                             | Consider `sql.js` (WASM) as fallback; document Node.js version requirements              |
| `before_message_process` slow handler blocks all messages   | High — gateway appears unresponsive                 | Low                             | Fail-open with timeout; document handler performance expectations; log slow handlers     |
| Multi-process gateway JSONL write interleaving              | Medium — corrupted JSON lines                       | Low (single-process is default) | Document as known limitation; recommend one telemetry instance per agent                 |
| Hook enrichment introduces subtle regressions               | Low — existing hook consumers see unexpected fields | Very Low                        | All new fields are optional; no existing signatures changed                              |
| Steer-restart gateway call failure leaves subagent in limbo | Medium — neither announced nor restarted            | Low                             | `clearSubagentRunSteerRestart()` restores normal announce; existing fallback in codebase |
| Memory pressure from large diagnostic event payloads        | Low — GC pressure in high-throughput scenarios      | Low                             | Summary mode for tool results/inputs; no full LLM payloads by default                    |

---

## 6. Verification Findings

After reading the source code, these are the discrepancies and observations compared to the design documents:

### 6.1 Line Number Accuracy

| Design Reference                                                                            | Expected            | Actual                                                                                  | Status                                                                     |
| ------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `after_tool_call` call site at "lines 414-435" in `pi-embedded-subscribe.handlers.tools.ts` | Lines 414-435       | Lines 414-435 (hookEvent construction at 419, runAfterToolCall at 426-431)              | **Accurate**                                                               |
| `agentId: undefined` at line 429                                                            | `undefined`         | `agentId: undefined` at line 429                                                        | **Accurate**                                                               |
| `sessionKey: undefined` at line 430                                                         | `undefined`         | `sessionKey: undefined` at line 430                                                     | **Accurate**                                                               |
| `toolCallId` local var at line 303                                                          | Available           | `toolCallId` declared at line 303 via `String(evt.toolCallId)`                          | **Accurate**                                                               |
| `recordAssistantUsage` at "line ~259" in `pi-embedded-subscribe.ts`                         | Usage accumulation  | `recordAssistantUsage` at line 259                                                      | **Corrected** — design docs updated to use correct name and signature      |
| `completeSubagentRun` in `subagent-registry.ts`                                             | Completion function | Function starts at line 316, insertion point at ~350                                    | **Corrected** — design doc now clarifies function start vs insertion point |
| `suppressedForSteerRestart` check at "line 350"                                             | Steer check         | Line 350 has `const suppressedForSteerRestart = suppressAnnounceForSteerRestart(entry)` | **Accurate**                                                               |
| `subagent_ended` hook emission in `subagent-registry-completion.ts` at "lines 69-86"        | Hook call           | Lines 67-86 contain `emitSubagentEndedHookOnce` body with hook emission at lines 69-86  | **Accurate**                                                               |

### 6.2 Function Signature Discrepancies

All discrepancies identified during initial verification have been corrected in the design docs:

- **`recordAssistantUsage`**: Design docs now use the correct function name (was `accumulateUsage`) and signature `(usageLike: unknown)` (was `(usage: NormalizedUsage)`).
- **`PluginHookToolContext`**: Design docs now distinguish between call-site fixes (`agentId`/`sessionKey` already exist on type but are passed as `undefined`) and genuine type additions (only `runId` is new).

### 6.3 New Hooks/Types Since Design

The codebase has several hooks not mentioned in the designs but already present:

- `before_model_resolve` — model/provider override before resolution
- `before_prompt_build` — system prompt / prepend context injection
- `before_reset` — fires on /new or /reset
- `message_sending` — sequential hook that can modify/cancel outgoing messages
- `tool_result_persist` — synchronous hook for modifying tool result messages
- `before_message_write` — synchronous hook that can block message JSONL writes
- `subagent_spawning` — sequential hook for provisioning session bindings
- `subagent_delivery_target` — sequential hook for resolving announce delivery routing
- `gateway_start` / `gateway_stop` — gateway lifecycle

These do not conflict with the designs but represent additional data sources the telemetry plugin could optionally capture.

### 6.4 Existing `SubagentRunRecord` Fields

The design for `02-subagent-stop-hook.md` proposes adding `steerCount?: number` to `SubagentRunRecord`. The actual type (`subagent-registry.types.ts`) does not have this field yet, confirming it needs to be added. The type already has `suppressAnnounceReason?: "steer-restart" | "killed"` which the design correctly references.

### 6.5 `replaceSubagentRunAfterSteer` Structure

The design assumes the replacement record copies most fields from the previous entry. The actual implementation at lines 867-883 already does a spread (`...source`) with explicit overrides. Adding `steerCount: (source.steerCount ?? 0) + 1` fits naturally into this pattern.

### 6.6 Existing Observability Extensions

Two existing extensions are relevant:

- `extensions/diagnostics-otel` — OpenTelemetry integration (already exists). The telemetry plugin should not duplicate OTEL concerns.
- `extensions/ocx-observability` — appears to be a minimal/empty extension (`node_modules` only, no source).

The telemetry plugin is distinct from OTEL (JSONL + SQLite local storage vs distributed tracing) and does not conflict.

### 6.7 `DiagnosticEventPayload` Union

The existing union (lines 150-163 of `diagnostic-events.ts`) does not include a `model.call` event type. The design correctly identifies this as a new addition. The `DiagnosticEventInput` type (line 165-169) automatically derives from the union, so adding `DiagnosticModelCallEvent` to the union is sufficient.

### 6.8 `emitDiagnosticEvent` Signature

The function accepts `DiagnosticEventInput` (which strips `seq` and `ts` — these are added automatically at lines 204-208). The design's proposed emission code is compatible with this signature.

---

## 7. Open Questions

1. **SQLite dependency:** Should the plugin use `better-sqlite3` (native, fast, requires build tools), `sql.js` (WASM, portable, slower), or Node's built-in `node:sqlite` (Node 22+, experimental)? The choice affects install complexity and performance.

2. **Multi-agent telemetry isolation:** When multiple agents are running on the same gateway, should telemetry be per-agent (separate JSONL/SQLite per agent, as currently designed with `~/.openclaw/agents/{agentId}/telemetry/`) or consolidated (single DB for cross-agent queries)? Per-agent is simpler but makes cross-agent correlation harder.

3. **~~JSONL watcher vs direct write~~** — **Resolved.** Design uses dual-write: collector appends to JSONL (durable) and enqueues to in-memory indexer queue (ephemeral). On restart, indexer catches up from JSONL using last-indexed byte position. In-memory queue loss on crash is acceptable.

4. **`before_message_process` insertion point:** The design identifies `dispatch-from-config.ts` as the primary location but notes dispatch may be fragmented across channels. A code audit of all channel dispatch paths is needed to determine if a single insertion point covers all cases, or if the hook needs to be added inside `enqueueFollowupRun()` itself.

5. **`permission_request` hook scope:** The design specifies this hook fires "when the tool execution policy determines a tool call requires operator approval." The exact location of this decision point in the codebase needs to be identified — it may be in the tool approval gate within the gateway's tool execution flow rather than in the embedded Pi agent.

6. **`model.call` cost estimation:** The `model.call` event includes `costUsd` in its type, but per-call cost estimation requires knowing the model's cost config at each call site. Currently, cost estimation happens only at run end in `agent-runner.ts`. Should per-call cost estimation be deferred to the indexer (which has all the data) or computed at emission time?

7. **Plugin activation timing:** The telemetry plugin needs to register hooks and event listeners during gateway startup. If the plugin activates after the first agent run starts, early events will be missed. What is the guaranteed activation order for plugins relative to the first agent run?

8. **`subagent_stopping` handler timeout:** What should the per-handler timeout be? The design does not specify one. A slow handler (e.g., one that calls an external LLM to evaluate output quality) could delay announce delivery. Recommended: 10 seconds with a configurable override.

9. **Tool result capture and sensitive data:** When `captureToolResults` is `"full"`, tool results may contain sensitive data (file contents, API responses, credentials). Should the telemetry plugin implement a redaction layer, or is this the responsibility of the operator to configure `"summary"` or `"none"` mode?

10. **Existing `llm_output` event shape:** The design proposes adding `durationMs`, `stopReason`, and `messageCount` to `PluginHookLlmOutputEvent`. The design references a `promptStartedAt` variable for computing `durationMs`. This variable's availability at the `llm_output` hook call site needs verification — it may need to be threaded through from the LLM call initiation point.
