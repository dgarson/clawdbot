# Session Runtime Store — Plugin SDK Extension

> Design specification for a reusable session-scoped state management primitive in the plugin SDK, enabling extensions to accumulate, persist, and recover per-session/per-run state across hook invocations and gateway restarts.

## 1. Problem Statement

Extensions that accumulate state across multiple hook invocations within a session or run (cost tracking, usage aggregation, audit trails, quality scoring) face three common challenges:

1. **Memory bounds**: Unbounded `Map<sessionKey, State>` grows indefinitely across long-lived sessions and concurrent runs.
2. **Crash recovery**: In-memory accumulators are lost on gateway restart. Extensions must re-derive state from durable sources (JSONL, SQLite) or lose it.
3. **Boilerplate**: Each extension reimplements LRU eviction, periodic flush, startup recovery, and cleanup. This is error-prone and inconsistent.

## 2. Design Goals

- **Minimal API surface**: A single `SessionRuntimeStore<T>` class that extensions instantiate with their state shape.
- **Bounded memory**: LRU eviction with configurable capacity (default: 128 sessions).
- **Crash-safe**: Periodic flush to per-session JSON state files; automatic reload on startup.
- **Zero upstream changes**: Lives entirely in the plugin SDK (`src/plugin-sdk/session-runtime-store.ts`) and the telemetry extension.
- **Composable**: Works alongside hooks — extensions call `store.get(sessionKey)` inside hook handlers and `store.update(sessionKey, mutator)` to accumulate.

## 3. API Design

```typescript
import type { SessionRuntimeStore, SessionRuntimeStoreOptions } from "openclaw/plugin-sdk";

// In extension service.start():
const store = createSessionRuntimeStore<CostState>({
  /** Directory for per-session state files */
  stateDir: path.join(ctx.stateDir, "cost-tracker"),

  /** Maximum sessions to keep in memory (LRU eviction) */
  maxEntries: 128,

  /** Factory for new session state */
  create: () => ({ totalTokens: 0, totalCost: 0, toolCalls: 0 }),

  /** Flush interval in ms (0 = flush on every update) */
  flushIntervalMs: 5000,

  /** Called when a session is evicted from memory (before file write) */
  onEvict?: (sessionKey: string, state: CostState) => void;

  /** Called on startup for each recovered session */
  onRecover?: (sessionKey: string, state: CostState) => void;
});
```

### Core Methods

```typescript
interface SessionRuntimeStore<T> {
  /** Get current state for a session (loads from disk if evicted, creates if new) */
  get(sessionKey: string): T;

  /** Update state with a mutator function (marks dirty for next flush) */
  update(sessionKey: string, mutator: (state: T) => void): void;

  /** Explicitly flush a session's state to disk */
  flush(sessionKey: string): Promise<void>;

  /** Flush all dirty sessions and close */
  close(): Promise<void>;

  /** Remove a session's state from memory and disk */
  delete(sessionKey: string): Promise<void>;

  /** List all session keys (in-memory + on-disk) */
  keys(): string[];

  /** Get count of in-memory entries */
  size(): number;
}
```

## 4. Storage Layout

```
<stateDir>/
  sessions/
    <sessionKey-hash>.json    # Per-session state file
  _meta.json                  # Store metadata (version, last flush timestamp)
```

Session keys are hashed (first 12 chars of sha256) for filesystem safety. The JSON file contains:
```json
{
  "sessionKey": "original-session-key",
  "updatedAt": 1709312400000,
  "createdAt": 1709308800000,
  "state": { /* T */ }
}
```

## 5. LRU Eviction Strategy

- In-memory entries tracked in a `Map<string, Entry<T>>` with access-order tracking.
- When `maxEntries` is exceeded, the least-recently-accessed entry is:
  1. Flushed to disk (if dirty)
  2. Removed from the in-memory map
- `get()` on an evicted session reads from disk transparently (cache-miss reload).
- Eviction is O(1) via a doubly-linked list or `Map` iteration order (Maps maintain insertion order; re-insert on access).

## 6. Flush Strategy

- **Periodic timer**: Every `flushIntervalMs`, iterate dirty entries and write to disk.
- **On eviction**: Always flush before evicting.
- **On close**: Flush all dirty entries.
- **Atomic writes**: Use `writeJsonFileAtomically` from the plugin SDK (write to temp, rename).

## 7. Crash Recovery

On `store = createSessionRuntimeStore(opts)`:
1. Scan `<stateDir>/sessions/*.json` for existing state files.
2. For each file, deserialize and optionally call `onRecover(sessionKey, state)`.
3. Load into memory up to `maxEntries` (most recently updated first).
4. Files beyond `maxEntries` remain on disk — loaded on-demand via `get()`.

## 8. Orphan Detection

The store itself doesn't know when a session is "done." Extensions handle this by:
- Calling `store.delete(sessionKey)` in their `session_end` handler.
- Optionally: a periodic sweep that deletes state files older than a configurable TTL.

For run-scoped state, extensions use the same store with `runId` as the key and delete in their `agent_end` handler.

## 9. Integration with Telemetry Plugin

The telemetry plugin's indexer (Phase 5) already provides crash recovery for materialized views via JSONL catchup. The `SessionRuntimeStore` complements this for extensions that need:
- **Hot aggregates**: Running totals available mid-session without querying SQLite.
- **Custom state shapes**: Beyond what the telemetry schema captures.
- **Real-time gates**: e.g., "block this tool if session cost exceeds $5" — needs sub-millisecond lookup, not a SQLite query.

### Telemetry Indexer Startup Reconciliation

The Phase 5 indexer should also add an `orphanReconciliation()` step on startup:
```typescript
function reconcileOrphans(db: Database): void {
  // Mark runs with no ended_at as interrupted
  db.prepare(`
    UPDATE runs SET stop_reason = 'interrupted'
    WHERE ended_at IS NULL AND started_at < ?
  `).run(Date.now() - 60_000); // 1 min grace period

  // Same for tool_calls
  db.prepare(`
    UPDATE tool_calls SET is_error = 1, error = 'interrupted'
    WHERE ended_at IS NULL AND started_at < ?
  `).run(Date.now() - 60_000);
}
```

## 10. Implementation Scope

### Phase 7a: `SessionRuntimeStore` in Plugin SDK (~200 lines)
- `src/plugin-sdk/session-runtime-store.ts` — Implementation
- `src/plugin-sdk/session-runtime-store.test.ts` — Tests
- Export from `src/plugin-sdk/index.ts`

### Phase 7b: Orphan Reconciliation in Indexer (~30 lines)
- Add `reconcileOrphans(db)` call in `extensions/telemetry/src/indexer.ts` startup

## 11. Example Usage: Cost Guard Extension

```typescript
import { createSessionRuntimeStore } from "openclaw/plugin-sdk";

type CostState = {
  totalTokens: number;
  estimatedCostUsd: number;
  toolCallCount: number;
  lastRunId?: string;
};

register(api: OpenClawPluginApi) {
  const store = createSessionRuntimeStore<CostState>({
    stateDir: path.join(ctx.stateDir, "cost-guard"),
    maxEntries: 64,
    create: () => ({ totalTokens: 0, estimatedCostUsd: 0, toolCallCount: 0 }),
    flushIntervalMs: 10_000,
  });

  api.on("llm_output", (event, ctx) => {
    if (!ctx.sessionKey) return;
    store.update(ctx.sessionKey, (s) => {
      s.totalTokens += event.usage?.total ?? 0;
      s.estimatedCostUsd += estimateCost(event.usage, event.model);
    });
  });

  api.on("before_tool_call", (event, ctx) => {
    if (!ctx.sessionKey) return;
    const state = store.get(ctx.sessionKey);
    if (state.estimatedCostUsd > 5.0) {
      return { block: true, blockReason: "Session cost limit exceeded" };
    }
  });

  api.on("session_end", (_event, ctx) => {
    if (ctx.sessionKey) store.delete(ctx.sessionKey);
  });
}
```
