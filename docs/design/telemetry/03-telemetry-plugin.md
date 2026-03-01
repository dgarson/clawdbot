# Telemetry Plugin — Capture, Indexing & Snapshot Metrics

> Design specification for the `extensions/telemetry` plugin: JSONL event capture, SQLite materialized indexes, per-call usage snapshots, query CLI, and HTTP API.

## Commit Strategy

When implementing the telemetry plugin, structure commits into clear, reviewable units aligned with the architecture sections:

**Phase 4 (Collector + JSONL):**

1. **Plugin scaffold**: `index.ts`, `package.json`, manifest, config schema
2. **Types commit**: `types.ts` with `TelemetryEvent`, `TelemetryEventKind`, config types
3. **Collector hooks**: `collector.ts` with all hook listeners (session, run, LLM, tool, message, subagent, compaction)
4. **Agent/diagnostic handlers**: `collector.ts` handlers for `onAgentEvent` and `onDiagnosticEvent`
5. **JSONL writer**: `writer.ts` with rotation, append, and close logic
6. **Helpers commit**: `helpers.ts` extract, capture, format utilities

**Phase 5 (SQLite + Query):** 7. **Schema + indexer**: `indexer.ts` with SQLite schema initialization and JSONL watcher 8. **Event dispatcher**: Continuation of `indexer.ts` — dispatch logic for each event kind 9. **Query functions**: `queries.ts` with SQL helper functions (one commit) 10. **CLI commands**: `cli.ts` with all seven command handlers (one commit) 11. **HTTP routes**: `routes.ts` with all six API endpoints (one commit) 12. **Retention policy**: `retention.ts` with cleanup enforcement

**Tests:** 13. **Collector tests**: Unit tests for hooks, event handlers, event-to-JSONL mapping 14. **Writer tests**: Unit tests for rotation, append, close 15. **Indexer tests**: Unit tests for schema, event dispatcher, watcher 16. **Query tests**: SQL function tests and CLI output formatting 17. **Integration tests**: End-to-end collector → JSONL → SQLite → CLI

Each commit should be self-contained and independently testable. Avoid bundling the collector with the indexer — they are separate services that operate asynchronously.

---

## 1. Plugin Identity

```typescript
const plugin = {
  id: "telemetry",
  name: "OpenClaw Telemetry",
  kind: "observability",
  version: "0.1.0",
  description: "Session replay, tool audit, channel linkage, and usage tracking",
};
```

**Install:** `openclaw plugins install telemetry` (or `extensions/telemetry` in workspace).

**Config schema:**

```typescript
configSchema: {
  enabled: { type: "boolean", default: true },
  captureToolResults: {
    type: "string",
    enum: ["none", "summary", "full"],
    default: "summary",
    description: "How much tool output to persist. 'none' = params only, 'summary' = first 500 chars, 'full' = everything.",
  },
  captureToolInputs: {
    type: "string",
    enum: ["none", "summary", "full"],
    default: "full",
    description: "How much tool input to persist.",
  },
  captureLlmPayloads: {
    type: "boolean",
    default: false,
    description: "Capture full LLM request/response payloads (large — use for debugging only).",
  },
  rotationPolicy: {
    type: "string",
    enum: ["daily", "weekly", "none"],
    default: "daily",
    description: "JSONL file rotation policy.",
  },
  sqliteEnabled: {
    type: "boolean",
    default: true,
    description: "Enable SQLite materialized index.",
  },
  retentionDays: {
    type: "number",
    default: 30,
    description: "Auto-delete JSONL files older than this. 0 = keep forever.",
  },
}
```

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   extensions/telemetry                        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                 Collector Service                       │  │
│  │                                                        │  │
│  │  Subscriptions:                                        │  │
│  │  ├── onAgentEvent()        → tool start/end, lifecycle │  │
│  │  ├── onDiagnosticEvent()   → model.usage, model.call   │  │
│  │  │                                                     │  │
│  │  Hook Listeners:                                       │  │
│  │  ├── session_start / session_end                       │  │
│  │  ├── run_start                     (NEW hook)          │  │
│  │  ├── agent_end                     (enriched existing) │  │
│  │  ├── llm_input / llm_output                            │  │
│  │  ├── before_tool_call / after_tool_call                │  │
│  │  ├── message_received / message_sent                   │  │
│  │  ├── subagent_spawned / subagent_ended                 │  │
│  │  ├── subagent_stopping             (NEW hook)          │  │
│  │  ├── before_compaction / after_compaction              │  │
│  │  └── before_message_process        (deferred)          │  │
│  │                                                        │  │
│  │  Output:                                               │  │
│  │  ├── 1. Append to events.jsonl (durable, fsync)        │  │
│  │  └── 2. Enqueue to in-memory indexer (ephemeral)       │  │
│  └───────────────────┬──────────┬─────────────────────────┘  │
│            (on disk) │          │ (in-memory queue)           │
│                      ▼          ▼                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  Indexer Service                        │  │
│  │                                                        │  │
│  │  Normal path: drains in-memory queue from collector    │  │
│  │  Startup path: catches up from JSONL using last-       │  │
│  │                indexed byte position (crash recovery)  │  │
│  │                                                        │  │
│  │  ├── Parses each TelemetryEvent                        │  │
│  │  ├── Upserts into SQLite tables:                       │  │
│  │  │   events, runs, tool_calls, file_operations,        │  │
│  │  │   channel_links, subagent_tree, usage_snapshots     │  │
│  │  └── Persists last-indexed byte position in SQLite     │  │
│  └───────────────────────┬────────────────────────────────┘  │
│                          │                                    │
│  ┌───────────────────────┴────────────────────────────────┐  │
│  │               Query / CLI / API Service                 │  │
│  │                                                        │  │
│  │  CLI Commands:                                         │  │
│  │  ├── openclaw telemetry replay <sessionKey> [--run]    │  │
│  │  ├── openclaw telemetry tools <runId>                  │  │
│  │  ├── openclaw telemetry files <sessionKey>             │  │
│  │  ├── openclaw telemetry usage <runId> [--per-call]     │  │
│  │  ├── openclaw telemetry sessions [--agent] [--since]   │  │
│  │  ├── openclaw telemetry subagents <sessionKey>         │  │
│  │  └── openclaw telemetry stats [--since]                │  │
│  │                                                        │  │
│  │  HTTP Routes (for UI):                                 │  │
│  │  ├── GET /telemetry/sessions                           │  │
│  │  ├── GET /telemetry/sessions/:key/replay               │  │
│  │  ├── GET /telemetry/runs/:id                           │  │
│  │  ├── GET /telemetry/runs/:id/tools                     │  │
│  │  ├── GET /telemetry/runs/:id/usage                     │  │
│  │  └── GET /telemetry/runs/:id/files                     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

Storage Layout:
~/.openclaw/agents/{agentId}/telemetry/
├── events.jsonl                    # Current event log
├── events.2026-03-01.jsonl         # Rotated logs
├── events.2026-02-28.jsonl.gz      # Compressed archives
├── telemetry.db                    # SQLite index
├── telemetry.db-wal                # SQLite WAL
└── blobs/                          # Externalized large tool I/O
    ├── evt_abc123-input.txt
    └── evt_abc123-output.txt
```

## 3. Collector Service

### 3.1 Service Lifecycle

The collector writes events through two paths simultaneously:

1. **JSONL file** (durable) — append-only, survives crashes
2. **In-memory queue** (ephemeral) — fed directly to the indexer for low-latency SQLite updates; lost on process restart (indexer catches up from JSONL on startup)

```typescript
api.registerService({
  id: "telemetry-collector",
  start: async () => {
    // 1. Resolve telemetry directory
    const telemetryDir = resolveTelemetryDir(api.config);
    await fs.mkdir(telemetryDir, { recursive: true });

    // 2. Open JSONL writer + blob writer
    const writer = createJsonlWriter(telemetryDir, api.pluginConfig);
    const blobWriter = new BlobWriter(telemetryDir);

    // 3. Get reference to indexer queue (if SQLite enabled)
    const indexerQueue = api.getService("telemetry-indexer")?.queue ?? null;

    // 4. Subscribe to event streams
    const unsubAgentEvents = onAgentEvent(handleAgentEvent(writer, indexerQueue));
    const unsubDiagEvents = onDiagnosticEvent(handleDiagnosticEvent(writer, indexerQueue));

    // 5. Store teardown for stop()
    return { writer, blobWriter, unsubAgentEvents, unsubDiagEvents };
  },
  stop: async (state) => {
    state.unsubAgentEvents();
    state.unsubDiagEvents();
    await state.writer.close();
  },
});
```

### 3.2 Hook Registration

```typescript
function register(api: OpenClawPluginApi) {
  const writer = getCollectorWriter();

  // === Session lifecycle ===
  api.on("session_start", async (event, ctx) => {
    writer.append({
      kind: "session.start",
      sessionId: event.sessionId,
      agentId: ctx.agentId,
      sessionKey: ctx.sessionKey,
      data: { resumedFrom: event.resumedFrom },
    });
  });

  api.on("session_end", async (event, ctx) => {
    writer.append({
      kind: "session.end",
      sessionId: event.sessionId,
      agentId: ctx.agentId,
      data: {
        messageCount: event.messageCount,
        durationMs: event.durationMs,
      },
    });
  });

  // === Run lifecycle (NEW hooks) ===
  api.on("run_start", async (event, ctx) => {
    writer.append({
      kind: "run.start",
      runId: event.runId,
      sessionKey: event.sessionKey,
      sessionId: event.sessionId,
      agentId: event.agentId,
      data: {
        model: event.model,
        provider: event.provider,
        isHeartbeat: event.isHeartbeat,
        isFollowup: event.isFollowup,
        messageCount: event.messageCount,
        compactionCount: event.compactionCount,
        originChannel: event.originChannel,
      },
    });
  });

  api.on("agent_end", async (event, ctx) => {
    // agent_end is enriched with run completion data (no separate run_end hook)
    writer.append({
      kind: "run.end",
      runId: event.runId,
      sessionKey: ctx.sessionKey,
      sessionId: ctx.sessionId,
      agentId: ctx.agentId,
      data: {
        model: event.model,
        provider: event.provider,
        durationMs: event.durationMs,
        usage: event.usage,
        toolCallCount: event.toolCallCount,
        toolNames: event.toolNames,
        stopReason: event.stopReason,
        compactionCount: event.compactionCount,
        lastAssistantMessage: event.lastAssistantMessage,
      },
      error: event.error
        ? {
            message: event.error,
          }
        : undefined,
    });
  });

  // === LLM hooks ===
  api.on("llm_input", async (event, ctx) => {
    writer.append({
      kind: "llm.input",
      runId: event.runId,
      sessionId: event.sessionId,
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      data: {
        provider: event.provider,
        model: event.model,
        prompt: event.prompt,
        imagesCount: event.imagesCount,
        // historyMessages excluded (too large) unless captureLlmPayloads=true
        ...(api.pluginConfig?.captureLlmPayloads
          ? {
              systemPrompt: event.systemPrompt,
              historyMessageCount: event.historyMessages?.length,
            }
          : {}),
      },
    });
  });

  api.on("llm_output", async (event, ctx) => {
    writer.append({
      kind: "llm.output",
      runId: event.runId,
      sessionId: event.sessionId,
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      data: {
        provider: event.provider,
        model: event.model,
        usage: event.usage,
        durationMs: event.durationMs, // NEW enriched field
        stopReason: event.stopReason, // NEW enriched field
        messageCount: event.messageCount, // NEW enriched field
        assistantTextLength: event.assistantTexts?.reduce((s, t) => s + t.length, 0),
      },
    });
  });

  // === Tool hooks ===
  api.on("after_tool_call", async (event, ctx) => {
    const captureMode = api.pluginConfig?.captureToolResults ?? "summary";
    const inputMode = api.pluginConfig?.captureToolInputs ?? "full";

    writer.append({
      kind: "tool.end",
      runId: ctx.runId, // NEW enriched field
      sessionKey: ctx.sessionKey, // NEW enriched field
      agentId: ctx.agentId,
      data: {
        toolName: event.toolName,
        toolCallId: event.toolCallId, // NEW enriched field
        isError: event.isError ?? !!event.error,
        durationMs: event.durationMs,
        params: captureInput(event.params, inputMode),
        result: captureResult(event.result, captureMode),
        error: event.error,
        // Extract file path for indexing
        filePath: extractFilePath(event.toolName, event.params),
        // Extract exec command for indexing
        execCommand: extractExecCommand(event.toolName, event.params),
      },
    });
  });

  // === Message hooks ===
  api.on("message_received", async (event, ctx) => {
    writer.append({
      kind: "message.inbound",
      sessionKey: ctx.sessionKey, // From enrichment or correlator
      data: {
        from: event.from,
        contentPreview: event.content?.slice(0, 200),
        channel: ctx.channelId,
        accountId: ctx.accountId,
        conversationId: ctx.conversationId,
        timestamp: event.timestamp,
      },
    });
  });

  api.on("message_sent", async (event, ctx) => {
    writer.append({
      kind: "message.outbound",
      data: {
        to: event.to,
        contentPreview: event.content?.slice(0, 200),
        success: event.success,
        error: event.error,
        channel: ctx.channelId,
      },
    });
  });

  // === Subagent hooks ===
  api.on("subagent_spawned", async (event, ctx) => {
    writer.append({
      kind: "subagent.spawn",
      runId: event.runId,
      sessionKey: ctx.requesterSessionKey,
      data: {
        childSessionKey: event.childSessionKey,
        agentId: event.agentId,
        label: event.label,
        mode: event.mode,
        requester: event.requester,
        threadRequested: event.threadRequested,
      },
    });
  });

  api.on("subagent_ended", async (event, ctx) => {
    writer.append({
      kind: "subagent.end",
      runId: event.runId,
      sessionKey: event.targetSessionKey,
      data: {
        outcome: event.outcome,
        reason: event.reason,
        error: event.error,
        endedAt: event.endedAt,
        // NEW enriched fields:
        task: event.task,
        label: event.label,
        startedAt: event.startedAt,
        model: event.model,
        spawnMode: event.spawnMode,
        durationMs: event.durationMs,
      },
    });
  });

  // === Compaction hooks ===
  api.on("before_compaction", async (event, ctx) => {
    writer.append({
      kind: "compaction.start",
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      data: {
        messageCount: event.messageCount,
        compactingCount: event.compactingCount,
        tokenCount: event.tokenCount,
      },
    });
  });

  api.on("after_compaction", async (event, ctx) => {
    writer.append({
      kind: "compaction.end",
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      data: {
        messageCount: event.messageCount,
        compactedCount: event.compactedCount,
      },
    });
  });
}
```

### 3.3 Agent Event Handler

```typescript
function handleAgentEvent(writer: JsonlWriter) {
  return (event: AgentEventPayload) => {
    // Tool events are captured via hooks (after_tool_call) for richer data.
    // Agent events provide runId correlation that hooks lack (before enrichment).
    // After enrichment, agent events become redundant for tools but still
    // valuable for lifecycle events.

    if (event.stream === "lifecycle") {
      writer.append({
        kind: event.data.phase === "start" ? "run.lifecycle.start" : "run.lifecycle.end",
        runId: event.runId,
        sessionKey: event.sessionKey,
        data: event.data,
      });
    }

    // "error" stream events carry agent-level errors
    if (event.stream === "error") {
      writer.append({
        kind: "error",
        runId: event.runId,
        sessionKey: event.sessionKey,
        data: event.data,
        error: {
          message: typeof event.data.message === "string" ? event.data.message : "Unknown error",
          source: typeof event.data.source === "string" ? event.data.source : "agent",
        },
      });
    }
  };
}
```

### 3.4 Diagnostic Event Handler (Snapshot Metrics)

```typescript
function handleDiagnosticEvent(writer: JsonlWriter) {
  return (event: DiagnosticEventPayload) => {
    // Per-run usage summary
    if (event.type === "model.usage") {
      writer.append({
        kind: "usage.snapshot",
        sessionKey: event.sessionKey,
        sessionId: event.sessionId,
        data: {
          provider: event.provider,
          model: event.model,
          usage: event.usage,
          lastCallUsage: event.lastCallUsage,
          context: event.context,
          costUsd: event.costUsd,
          durationMs: event.durationMs,
        },
      });
    }

    // Per-LLM-call snapshot (NEW model.call event)
    if (event.type === "model.call") {
      writer.append({
        kind: "llm.call",
        runId: event.runId,
        sessionKey: event.sessionKey,
        sessionId: event.sessionId,
        data: {
          callIndex: event.callIndex,
          provider: event.provider,
          model: event.model,
          delta: event.delta,
          cumulative: event.cumulative,
          context: event.context,
          costUsd: event.costUsd,
          durationMs: event.durationMs,
        },
      });
    }
  };
}
```

### 3.5 Helper Functions

```typescript
/** Extract file path from tool params for indexing */
function extractFilePath(toolName: string, params: Record<string, unknown>): string | undefined {
  const name = toolName.toLowerCase();
  if (name === "read" || name === "write" || name === "edit") {
    return (
      (typeof params.file_path === "string" ? params.file_path : undefined) ??
      (typeof params.path === "string" ? params.path : undefined)
    );
  }
  return undefined;
}

/** Extract exec command from tool params for indexing */
function extractExecCommand(toolName: string, params: Record<string, unknown>): string | undefined {
  const name = toolName.toLowerCase();
  if (name === "exec" || name === "bash" || name === "process") {
    return typeof params.command === "string" ? params.command : undefined;
  }
  return undefined;
}

/** Truncate tool result based on capture mode */
function captureResult(result: unknown, mode: "none" | "summary" | "full"): unknown {
  if (mode === "none") return undefined;
  if (mode === "full") return result;
  // summary: first 500 chars of stringified result
  const str = typeof result === "string" ? result : JSON.stringify(result);
  return str?.slice(0, 500);
}

/** Truncate tool input based on capture mode */
function captureInput(
  params: Record<string, unknown>,
  mode: "none" | "summary" | "full",
): Record<string, unknown> | undefined {
  if (mode === "none") return undefined;
  if (mode === "full") return params;
  // summary: truncate large string values
  const summarized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 500) {
      summarized[key] = value.slice(0, 500) + `... (${value.length} chars)`;
    } else {
      summarized[key] = value;
    }
  }
  return summarized;
}
```

## 4. JSONL Writer

### 4.1 Event Format

Each line in `events.jsonl` is a complete `TelemetryEvent`:

```jsonl
{"id":"evt_abc123","ts":1709312400000,"seq":1,"agentId":"main","sessionKey":"agent:main:main","sessionId":"uuid","runId":"run-uuid","kind":"run.start","data":{"model":"claude-opus-4-5","provider":"anthropic","isHeartbeat":false},"source":"hook","hookName":"run_start"}
{"id":"evt_abc124","ts":1709312400100,"seq":2,"agentId":"main","sessionKey":"agent:main:main","sessionId":"uuid","runId":"run-uuid","kind":"tool.end","data":{"toolName":"read","toolCallId":"tc-1","params":{"file_path":"/src/index.ts"},"durationMs":12,"filePath":"/src/index.ts"},"source":"hook","hookName":"after_tool_call"}
```

### 4.2 Writer Implementation

```typescript
class JsonlWriter {
  private stream: fs.WriteStream;
  private seq = 0;
  private currentDate: string;
  private baseDir: string;
  private rotationPolicy: "daily" | "weekly" | "none";

  constructor(baseDir: string, config: { rotationPolicy?: string }) {
    this.baseDir = baseDir;
    this.rotationPolicy = (config.rotationPolicy as "daily" | "weekly" | "none") ?? "daily";
    this.currentDate = this.dateKey();
    this.stream = this.openStream();
  }

  append(partial: Partial<TelemetryEvent> & { kind: TelemetryEventKind }) {
    this.maybeRotate();
    const event: TelemetryEvent = {
      id: `evt_${crypto.randomUUID().slice(0, 12)}`,
      ts: Date.now(),
      seq: this.seq++,
      agentId: partial.agentId ?? "unknown",
      sessionKey: partial.sessionKey ?? "unknown",
      sessionId: partial.sessionId ?? "unknown",
      runId: partial.runId,
      kind: partial.kind,
      stream: partial.stream,
      data: partial.data ?? {},
      error: partial.error,
      source: partial.source ?? "hook",
      hookName: partial.hookName,
    };
    this.stream.write(JSON.stringify(event) + "\n");
  }

  private maybeRotate() {
    if (this.rotationPolicy === "none") return;
    const now = this.dateKey();
    if (now !== this.currentDate) {
      this.stream.end();
      // Rename current to dated file
      const oldPath = path.join(this.baseDir, "events.jsonl");
      const archivePath = path.join(this.baseDir, `events.${this.currentDate}.jsonl`);
      try {
        fs.renameSync(oldPath, archivePath);
      } catch {
        /* first write */
      }
      this.currentDate = now;
      this.stream = this.openStream();
    }
  }

  private dateKey(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private openStream(): fs.WriteStream {
    return fs.createWriteStream(
      path.join(this.baseDir, "events.jsonl"),
      { flags: "a" }, // Append mode
    );
  }

  async close() {
    return new Promise<void>((resolve) => this.stream.end(resolve));
  }
}
```

## 5. SQLite Indexer Service

### 5.1 Service Lifecycle

The indexer uses a **direct-write** model: the collector pushes events into an in-memory queue, and the indexer drains it. On startup, the indexer catches up from JSONL using the last-indexed byte position stored in SQLite, recovering any events that were written to JSONL but not yet indexed (e.g., after a crash). The in-memory queue is ephemeral — it's fine for it to be empty at process restart since the JSONL catchup handles recovery.

```typescript
api.registerService({
  id: "telemetry-indexer",
  start: async () => {
    if (!api.pluginConfig?.sqliteEnabled) return null;

    const telemetryDir = resolveTelemetryDir(api.config);
    const dbPath = path.join(telemetryDir, "telemetry.db");

    // Initialize database with schema
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    initSchema(db);

    // Catch up from JSONL (crash recovery / first start)
    catchUpFromJsonl(telemetryDir, db);

    // Create in-memory queue for live events from collector
    const queue = createIndexerQueue(db);

    return { db, queue };
  },
  stop: async (state) => {
    if (!state) return;
    state.queue.drain(); // Process any remaining events
    state.db.close();
  },
});
```

### 5.2 Startup Catchup (Crash Recovery)

On startup, the indexer reads any unprocessed JSONL lines beyond the last-indexed byte position. This handles the case where the collector wrote to JSONL but the process crashed before the indexer could persist to SQLite.

```typescript
function catchUpFromJsonl(dir: string, db: Database) {
  const jsonlPath = path.join(dir, "events.jsonl");
  const lastPosition = getLastIndexedPosition(db);

  // Index any unprocessed events from the JSONL file
  indexFromPosition(jsonlPath, lastPosition, db);
}

function indexFromPosition(filePath: string, startByte: number, db: Database): number {
  const fd = fs.openSync(filePath, "r");
  const stat = fs.fstatSync(fd);
  if (stat.size <= startByte) {
    fs.closeSync(fd);
    return startByte;
  }

  const buffer = Buffer.alloc(stat.size - startByte);
  fs.readSync(fd, buffer, 0, buffer.length, startByte);
  fs.closeSync(fd);

  const lines = buffer.toString("utf-8").split("\n").filter(Boolean);
  const insertEvent = db.prepare(INSERT_EVENT_SQL);
  const insertRun = db.prepare(UPSERT_RUN_SQL);
  const insertToolCall = db.prepare(INSERT_TOOL_CALL_SQL);
  const insertFileOp = db.prepare(INSERT_FILE_OP_SQL);
  const insertChannelLink = db.prepare(INSERT_CHANNEL_LINK_SQL);
  const insertSubagent = db.prepare(UPSERT_SUBAGENT_SQL);
  const insertUsageSnapshot = db.prepare(INSERT_USAGE_SNAPSHOT_SQL);

  const transaction = db.transaction(() => {
    for (const line of lines) {
      try {
        const event: TelemetryEvent = JSON.parse(line);
        // Insert into events table
        insertEvent.run(
          event.id,
          event.ts,
          event.seq,
          event.agentId,
          event.sessionKey,
          event.sessionId,
          event.runId,
          event.kind,
          event.stream,
          JSON.stringify(event.data),
          event.error ? JSON.stringify(event.error) : null,
          event.source,
        );

        // Dispatch to specialized tables
        switch (event.kind) {
          case "run.start":
            insertRun.run(
              event.runId,
              event.sessionKey,
              event.sessionId,
              event.agentId,
              event.ts,
              null,
              null,
              event.data.model,
              event.data.provider,
              0,
              0,
              0,
              0,
              0,
              null,
              0,
              null,
              null,
              null,
              event.data.isHeartbeat ? 1 : 0,
              0,
            );
            break;

          case "run.end":
            // Populated from enriched agent_end hook event
            // Update existing run record
            db.prepare(
              `
              UPDATE runs SET
                ended_at = ?, duration_ms = ?, model = COALESCE(?, model),
                provider = COALESCE(?, provider),
                input_tokens = ?, output_tokens = ?,
                cache_read = ?, cache_write = ?, total_tokens = ?,
                cost_usd = ?, tool_call_count = ?, tool_names_json = ?,
                stop_reason = ?, error_json = ?, compaction_count = ?
              WHERE run_id = ?
            `,
            ).run(
              event.ts,
              event.data.durationMs,
              event.data.model,
              event.data.provider,
              event.data.usage?.input ?? 0,
              event.data.usage?.output ?? 0,
              event.data.usage?.cacheRead ?? 0,
              event.data.usage?.cacheWrite ?? 0,
              event.data.usage?.total ?? 0,
              event.data.costUsd,
              event.data.toolCallCount ?? 0,
              event.data.toolNames ? JSON.stringify(event.data.toolNames) : null,
              event.data.stopReason,
              event.error ? JSON.stringify(event.error) : null,
              event.data.compactionCount ?? 0,
              event.runId,
            );
            break;

          case "tool.end":
            insertToolCall.run(
              event.data.toolCallId ?? event.id,
              event.runId,
              event.sessionKey,
              event.ts,
              event.data.toolName,
              event.data.params ? JSON.stringify(event.data.params) : null,
              event.data.result ? JSON.stringify(event.data.result) : null,
              event.data.error,
              event.data.durationMs,
              event.data.filePath,
              event.data.execCommand,
            );
            // File operations index
            if (event.data.filePath) {
              insertFileOp.run(
                event.id,
                event.runId,
                event.sessionKey,
                event.ts,
                event.data.toolName,
                event.data.filePath,
                event.data.toolCallId,
              );
            }
            break;

          case "message.inbound":
          case "message.outbound":
            insertChannelLink.run(
              event.id,
              event.ts,
              event.kind === "message.inbound" ? "inbound" : "outbound",
              event.data.channel ?? "unknown",
              event.data.accountId,
              event.data.from,
              event.data.to,
              event.sessionKey,
              event.runId,
              event.data.contentPreview,
              event.data.success ?? null,
            );
            break;

          case "subagent.spawn":
            insertSubagent.run(
              event.data.runId ?? event.runId,
              event.sessionKey,
              event.data.childSessionKey,
              event.data.agentId,
              event.data.label,
              event.data.task,
              event.data.mode,
              null,
              event.ts,
              null,
              null,
              null,
              null,
              0,
            );
            break;

          case "subagent.end":
            db.prepare(
              `
              UPDATE subagent_tree SET
                ended_at = ?, duration_ms = ?, outcome = ?, error = ?
              WHERE child_session_key = ?
            `,
            ).run(
              event.data.endedAt,
              event.data.durationMs,
              event.data.outcome,
              event.data.error,
              event.data.targetSessionKey ?? event.sessionKey,
            );
            break;

          case "llm.call":
            insertUsageSnapshot.run(
              event.id,
              event.ts,
              event.runId,
              event.sessionKey,
              event.data.callIndex,
              event.data.provider,
              event.data.model,
              event.data.delta?.input,
              event.data.delta?.output,
              event.data.delta?.cacheRead,
              event.data.delta?.cacheWrite,
              event.data.cumulative?.input,
              event.data.cumulative?.output,
              event.data.cumulative?.cacheRead,
              event.data.cumulative?.cacheWrite,
              event.data.cumulative?.total,
              event.data.context?.limit,
              event.data.context?.used,
              event.data.costUsd,
              event.data.durationMs,
            );
            break;
        }
      } catch (err) {
        // Log parse error but continue processing
      }
    }

    // Save position
    setLastIndexedPosition(db, startByte + buffer.length);
  });

  transaction();
  return startByte + buffer.length;
}
```

## 6. Snapshot Metrics — Deep Dive

### 6.1 Data Flow

```
LLM API responds with usage data
  │
  ├─► recordAssistantUsage() in pi-embedded-subscribe.ts
  │   ├── Updates cumulative totals (existing)
  │   └── ★ emitDiagnosticEvent({ type: "model.call", ... }) ★ (NEW)
  │       Contains: delta, cumulative, callIndex, context, runId
  │
  ├─► onDiagnosticEvent listener in telemetry plugin
  │   └── Appends to events.jsonl as kind: "llm.call"
  │
  ├─► JSONL watcher in indexer service
  │   └── Inserts into usage_snapshots table
  │
  └─► Queryable via CLI/API:
      openclaw telemetry usage <runId> --per-call
```

### 6.2 Per-Call vs Per-Run Usage

| Granularity      | Source                                               | Contains                                                                      | Use Case                                                                         |
| ---------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Per-LLM-call** | `model.call` diagnostic event                        | Delta (this call only), cumulative (running total), context window, callIndex | Token growth visualization, cost per tool interaction, context pressure tracking |
| **Per-run**      | Enriched `agent_end` hook + `model.usage` diagnostic | Final totals, cost estimate, model, duration                                  | Run-level cost accounting, model comparison, performance tracking                |
| **Per-session**  | Aggregated from per-run                              | Sum of all runs in session                                                    | Session cost budgeting, session comparison                                       |

### 6.3 Example: Visualizing Token Growth

Given a run with 3 tool calls:

```
Call 0 (initial prompt):     delta: {in:1200, out:400}  cumul: {in:1200, out:400,  total:1600}  ctx: {used:1600,  limit:200000}
Call 1 (after read tool):    delta: {in:800,  out:300}  cumul: {in:2000, out:700,  total:2700}  ctx: {used:2700,  limit:200000}
Call 2 (after exec tool):    delta: {in:1500, out:600}  cumul: {in:3500, out:1300, total:4800}  ctx: {used:4800,  limit:200000}
Call 3 (final response):     delta: {in:200,  out:800}  cumul: {in:3700, out:2100, total:5800}  ctx: {used:5800,  limit:200000}
```

This enables:

- "The read tool added 800 input tokens" (delta.input at call 1)
- "Context is 2.9% utilized after 3 tool calls" (5800/200000)
- "The exec tool result was the most expensive call" (delta.total at call 2 = 2100)

### 6.4 Correlation with Tool Calls

Each `llm.call` event follows a tool result (except the first call which follows the user prompt). By ordering `llm.call` events by `callIndex` and interleaving with `tool.end` events by timestamp, the replay timeline shows:

```
[run.start]      → Run begins
[llm.call #0]    → Initial LLM call (1600 tokens)
[tool.start]     → read /src/index.ts
[tool.end]       → read complete (12ms)
[llm.call #1]    → LLM processes tool result (+1100 tokens)
[tool.start]     → exec "npm test"
[tool.end]       → exec complete (3400ms)
[llm.call #2]    → LLM processes test output (+2100 tokens)
[llm.call #3]    → Final response (+1000 tokens)
[run.end]        → Run complete (total: 5800 tokens, $0.02)
```

## 7. Error Provenance

### 7.1 Error Capture Points

Errors are captured at multiple levels with provenance information:

| Error Source             | Captured Via                            | Error Shape                                                                              |
| ------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Tool execution failure   | `after_tool_call` hook (error field)    | `{ message: "Command exited with status 1", source: "tool" }`                            |
| LLM API error            | Enriched `agent_end` hook (error field) | `{ message: "Rate limited", kind: "auth", source: "llm" }`                               |
| Context overflow         | Enriched `agent_end` hook (error field) | `{ message: "Context window exceeded", kind: "context_overflow", source: "compaction" }` |
| Compaction failure       | Enriched `agent_end` hook (error field) | `{ message: "Compaction LLM failed", kind: "compaction_failure", source: "compaction" }` |
| Agent event error stream | `onAgentEvent` (stream: "error")        | `{ message: "...", source: "agent" }`                                                    |
| Subagent failure         | `subagent_ended` hook (error + outcome) | `{ outcome: "error", error: "Timeout after 60s" }`                                       |

### 7.2 Error Chain

When a tool error causes a run to fail, the telemetry captures both:

```jsonl
{"kind":"tool.end","runId":"r1","data":{"toolName":"exec","error":"Command exited with status 1","params":{"command":"npm test"},"isError":true}}
{"kind":"run.end","runId":"r1","error":{"message":"Agent failed after tool error","kind":"tool_error","source":"tool"}}
```

The `run_id` correlation links the tool error to the run failure.

## 8. CLI Commands

### 8.1 Registration

```typescript
api.registerCli(({ program }) => {
  const telemetry = program.command("telemetry").description("Telemetry and audit queries");

  telemetry
    .command("replay <sessionKey>")
    .option("--run <runId>", "Filter to a specific run")
    .option("--since <date>", "Start from date")
    .option("--json", "Output raw JSON")
    .action(replayCommand);

  telemetry
    .command("tools <runId>")
    .option("--name <toolName>", "Filter by tool name")
    .option("--errors-only", "Show only failed tool calls")
    .action(toolsCommand);

  telemetry
    .command("files <sessionKey>")
    .option("--run <runId>", "Filter to a specific run")
    .action(filesCommand);

  telemetry
    .command("usage <runId>")
    .option("--per-call", "Show per-LLM-call breakdown")
    .action(usageCommand);

  telemetry
    .command("sessions")
    .option("--agent <agentId>", "Filter by agent")
    .option("--since <date>", "Filter by date")
    .option("--limit <n>", "Max results", "20")
    .action(sessionsCommand);

  telemetry.command("subagents <sessionKey>").action(subagentsCommand);

  telemetry.command("stats").option("--since <date>", "Start date").action(statsCommand);
});
```

### 8.2 Example Output: `openclaw telemetry replay agent:main:main`

```
Session: agent:main:main (session-uuid)
Agent: main | Model: claude-opus-4-5 | Provider: anthropic

Timeline:
─────────────────────────────────────────────────────────────
12:00:01  SESSION START (resumed from previous)
12:00:02  MESSAGE IN    from: +1234567890 via telegram
                        "Please fix the failing test in auth.ts"
12:00:02  RUN START     run-abc | model: claude-opus-4-5
12:00:02  LLM CALL #0   tokens: +1200 in / +400 out | ctx: 0.8%
12:00:03  TOOL START    read /src/auth.ts
12:00:03  TOOL END      read (12ms) → 245 lines
12:00:03  LLM CALL #1   tokens: +800 in / +300 out | ctx: 1.4%
12:00:04  TOOL START    edit /src/auth.ts
12:00:04  TOOL END      edit (5ms) → success
12:00:04  LLM CALL #2   tokens: +200 in / +150 out | ctx: 1.5%
12:00:05  TOOL START    exec "npm test -- auth"
12:00:08  TOOL END      exec (3400ms) → exit 0
12:00:08  LLM CALL #3   tokens: +1500 in / +800 out | ctx: 2.9%
12:00:09  RUN END       run-abc | 7.2s | 5800 tokens | $0.02
12:00:09  MESSAGE OUT   to: +1234567890 via telegram → success
─────────────────────────────────────────────────────────────
```

## 9. HTTP API Routes

```typescript
api.registerHttpRoute({
  path: "/telemetry/sessions",
  handler: async (req, res) => {
    const { agent, since, limit } = req.query;
    const sessions = querySessionList(db, { agent, since, limit });
    res.json(sessions);
  },
});

api.registerHttpRoute({
  path: "/telemetry/sessions/:key/replay",
  handler: async (req, res) => {
    const events = querySessionReplay(db, req.params.key);
    res.json(events);
  },
});

api.registerHttpRoute({
  path: "/telemetry/runs/:id",
  handler: async (req, res) => {
    const run = queryRunDetail(db, req.params.id);
    res.json(run);
  },
});

api.registerHttpRoute({
  path: "/telemetry/runs/:id/tools",
  handler: async (req, res) => {
    const tools = queryRunToolCalls(db, req.params.id);
    res.json(tools);
  },
});

api.registerHttpRoute({
  path: "/telemetry/runs/:id/usage",
  handler: async (req, res) => {
    const snapshots = queryRunUsageSnapshots(db, req.params.id);
    res.json(snapshots);
  },
});

api.registerHttpRoute({
  path: "/telemetry/runs/:id/files",
  handler: async (req, res) => {
    const files = queryRunFileOperations(db, req.params.id);
    res.json(files);
  },
});
```

## 10. File Size & Retention

### 10.1 Estimated Event Sizes

| Event Kind                          | Avg Size (bytes) | Events/hour (active) |
| ----------------------------------- | ---------------- | -------------------- |
| `run.start` / `run.end` (agent_end) | 300              | 10-60                |
| `tool.end` (summary mode)           | 400              | 50-300               |
| `llm.call`                          | 250              | 20-120               |
| `message.inbound` / `outbound`      | 200              | 5-30                 |
| `subagent.spawn` / `end`            | 350              | 0-20                 |

**Estimated daily JSONL size (active agent):** 5-20 MB/day (summary mode), 50-200 MB/day (full capture).

### 10.2 Retention Policy

Retention enforcement runs at gateway startup and on a daily timer. Three policies are applied sequentially:

| Policy        | Config Key             | Default   | Deletes When                            |
| ------------- | ---------------------- | --------- | --------------------------------------- |
| Age-based     | `retentionDays`        | `30`      | JSONL files older than N days           |
| Size-based    | `retentionMaxSizeMb`   | `500`     | Total telemetry dir exceeds N MB        |
| Session-count | `retentionMaxSessions` | `0` (off) | More than N distinct sessions in SQLite |

All policies atomically delete associated blob files (see Section 12) before deleting the JSONL file. An orphan blob sweep runs after all policies to catch any stale blobs.

```typescript
// Runs at startup + daily via setInterval (unref'd)
async function enforceRetention(
  telemetryDir: string,
  config: TelemetryPluginConfig,
  blobWriter: BlobWriter,
  db: Database | null,
  log: Logger,
): Promise<void> {
  await enforceAgeCutoff(telemetryDir, config.retentionDays, blobWriter, db, log);
  await enforceSizeLimit(telemetryDir, config.retentionMaxSizeMb, blobWriter, db, log);
  await enforceSessionLimit(telemetryDir, config.retentionMaxSessions, blobWriter, db, log);
  await sweepOrphanBlobs(telemetryDir, blobWriter, log);
}
```

**Age-based**: Deletes rotated `events.YYYY-MM-DD.jsonl` files older than `retentionDays`. Never deletes the active `events.jsonl`.

**Size-based**: When total directory size (JSONL + blobs + SQLite) exceeds `retentionMaxSizeMb`, deletes oldest archives one at a time until under the limit.

**Session-count**: When distinct `session_key` count in SQLite exceeds `retentionMaxSessions`, removes the oldest sessions (by earliest event timestamp) from SQLite and sweeps orphan blobs.

## 11. Implementation Estimate

| Component                                            | Lines           | Complexity |
| ---------------------------------------------------- | --------------- | ---------- |
| Plugin scaffold (index.ts, types, config)            | ~100            | Low        |
| Collector service (hook listeners + event handlers)  | ~350            | Medium     |
| JSONL writer (rotation, append, close)               | ~80             | Low        |
| Blob writer + helpers (externalize, resolve, guard)  | ~90             | Low        |
| SQLite schema + indexer service                      | ~300            | Medium     |
| Indexer queue + startup catchup                      | ~100            | Medium     |
| Retention service (age, size, session, orphan sweep) | ~260            | Medium     |
| CLI commands (7 commands + `--expand-blobs`)         | ~280            | Low        |
| HTTP routes (6 routes + blob expansion)              | ~135            | Low        |
| Helper functions (extract, capture, format)          | ~100            | Low        |
| Tests                                                | ~600            | Medium     |
| **Total**                                            | **~2400 lines** |            |

This is a single `extensions/telemetry` directory with:

```
extensions/telemetry/
├── package.json
├── index.ts              # Plugin entry, registration
├── collector.ts          # Hook listeners, event handlers
├── writer.ts             # JSONL writer
├── blob-writer.ts        # Blob externalization for large tool I/O
├── indexer.ts            # SQLite schema, queue, startup catchup
├── retention.ts          # Multi-policy retention + blob sweep
├── queries.ts            # SQL query functions
├── cli.ts                # CLI command handlers
├── routes.ts             # HTTP route handlers
├── types.ts              # TelemetryEvent, config types
├── helpers.ts            # Extract, capture, format utilities
└── *.test.ts             # Tests
```

## 12. Blob Externalization — Large Tool I/O

### 12.1 Problem

When `captureToolResults` or `captureToolInputs` is `"full"`, large tool outputs are embedded directly in each JSONL event line. A `Read` of a 2000-line file, a multi-second `exec` test run, or a 500-match `grep` result can produce 50–500 KB per line. This makes JSONL files unparseable by line-oriented tools, inflates SQLite WAL, and defeats human readability.

### 12.2 Design

Payloads exceeding `blobThresholdBytes` (default: 4096) are written to external files instead of inlined. The JSONL event stores a `BlobRef` reference in place of the raw value:

```typescript
type BlobRef = {
  _blob: true; // Discriminant for consumers
  path: string; // Absolute path to blob file
  size: number; // Byte length
  encoding: "utf-8";
};
```

**Blob file naming:** `blobs/{eventId}-{input|output}.txt` — the `eventId` matches the parent `TelemetryEvent.id` for direct correlation.

**Capture mode interaction:**

| `captureToolResults`        | Inline Content    | Blob Written       |
| --------------------------- | ----------------- | ------------------ |
| `"none"`                    | `undefined`       | No                 |
| `"summary"`                 | First 500 chars   | No (always inline) |
| `"full"` + size ≤ threshold | Full value inline | No                 |
| `"full"` + size > threshold | `BlobRef` object  | Yes                |

### 12.3 Config Additions

```typescript
configSchema: {
  // ... existing fields ...
  blobThresholdBytes: {
    type: "number",
    default: 4096,
    description: "Tool I/O larger than this is externalized to blob files. -1 to disable.",
  },
  retentionMaxSizeMb: {
    type: "number",
    default: 500,
    description: "Auto-delete oldest telemetry when total dir exceeds this (MB). 0 = no limit.",
  },
  retentionMaxSessions: {
    type: "number",
    default: 0,
    description: "Keep at most N sessions. Oldest removed first. 0 = no limit.",
  },
}
```

### 12.4 Key Interfaces

```typescript
class BlobWriter {
  constructor(telemetryDir: string); // blobs/ dir created lazily on first write

  /** Write to blob if size > threshold; return BlobRef or original value. */
  maybeExternalize(
    eventId: string,
    suffix: "input" | "output",
    value: unknown,
    thresholdBytes: number,
  ): unknown | BlobRef;

  deleteBlob(filePath: string): void;
  listBlobs(): string[];
}

/** Type guard for detecting blob references in event data. */
function isBlobRef(value: unknown): value is BlobRef;

/** Load blob content from disk. */
function loadBlob(ref: BlobRef): string;

/** Resolve a value that may be a BlobRef — load if so, passthrough if not. */
function resolveValue(value: unknown): unknown;
```

### 12.5 CLI and API Integration

The `tools` and `replay` commands show a compact blob indicator by default:

```
12:00:03  TOOL END  read /src/index.ts (12ms)
                    output: [48KB blob — use --expand-blobs]
```

Use `--expand-blobs` to load and display full content. The HTTP API accepts `?expand=blobs` for the same effect.

### 12.6 SQLite Integration

The `tool_calls` table adds `has_input_blob` and `has_output_blob` integer columns (0/1) so queries can filter on blob presence without parsing the JSON columns.

### 12.7 Storage Estimates

At the default 4 KB threshold, ~30% of tool calls produce blobs (primarily `Read` large files, `Bash` test output, `Grep` results). A typical active agent session generates ~60 blob files/day at ~50 KB average = ~3 MB/day in blob storage. With `retentionMaxSizeMb: 500` and `retentionDays: 30`, this allows ~80–125 days of retention.
