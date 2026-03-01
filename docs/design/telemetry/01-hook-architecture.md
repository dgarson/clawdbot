# Hook Architecture — Mapping, Enrichment & New Hooks

> Comprehensive specification covering: Claude Code ↔ OpenClaw hook mapping, hook context enrichment, new upstream hooks (`run_start`, `before_message_process`, `subagent_stopping`), `agent_end` enrichment (absorbs run completion data), and per-LLM-call usage snapshots (`model.call` diagnostic event).

## Commit Strategy

When implementing this design, structure commits to isolate changes by phase and concern:

- **Phase 0 commits**: Type additions (one commit for all type file changes), then call-site fixes (one commit per file: `handlers.tools.ts`, `before-tool-call.ts`, `attempt.ts`, `subagent-registry-completion.ts`)
- **Phase 1 commits**: `run_start` hook (types + runner + call sites), then `agent_end` enrichment (absorbs run completion data)
- **Phase 2 commits**: `model.call` diagnostic event type, then emission code
- **Phase 4 commits**: `before_message_process` hook specification and implementation
- **Phase 5 commits**: `permission_request` hook

Each commit message should clearly reference the section and phase (e.g., `"Section 2.1: enrich after_tool_call context with agentId and sessionKey fixes"`). Avoid bundling type definitions with call-site changes — separate them so reviewers can verify each independently.

---

## 1. Claude Code ↔ OpenClaw Hook Mapping

### 1.1 Fully Covered

| Claude Code Hook     | OpenClaw Hook             | Payload Comparison                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`       | `session_start`           | **CC:** `session_id`, `source` (startup/resume/clear/compact), `model`, `agent_type`. **OC:** `sessionId`, `resumedFrom`. **Gap:** OC lacks `source` (start reason) and `model`.                                                                                                       |
| `SessionEnd`         | `session_end`             | **CC:** `session_id`, `reason` (clear/logout/prompt_input_exit/other). **OC:** `sessionId`, `messageCount`, `durationMs`. **Gap:** OC lacks `reason`; CC lacks `messageCount`/`durationMs`.                                                                                            |
| `PreToolUse`         | `before_tool_call`        | **CC:** `tool_name`, `tool_input`, `tool_use_id`, can allow/deny/ask. **OC:** `toolName`, `params`, can `block: true`. **Gap:** OC lacks `tool_use_id` (toolCallId) in event. OC cannot "ask" (escalate to user).                                                                      |
| `PostToolUse`        | `after_tool_call`         | **CC:** `tool_name`, `tool_input`, `tool_response`, `tool_use_id`. **OC:** `toolName`, `params`, `result`, `durationMs`. **Gap:** OC lacks `toolCallId`; CC lacks `durationMs`.                                                                                                        |
| `PostToolUseFailure` | `after_tool_call` (error) | **CC:** separate hook with `error`, `is_interrupt`. **OC:** merged into `after_tool_call` with `error` field. **Gap:** OC lacks `is_interrupt` flag.                                                                                                                                   |
| `SubagentStart`      | `subagent_spawned`        | **CC:** `agent_id`, `agent_type`. **OC:** `runId`, `childSessionKey`, `agentId`, `label`, `mode`, `requester`. **OC is richer.**                                                                                                                                                       |
| `SubagentStop`       | `subagent_ended`          | **CC:** `agent_id`, `agent_type`, `last_assistant_message`, `agent_transcript_path`, can block (prevent stop). **OC:** `targetSessionKey`, `outcome`, `reason`, `runId`, `endedAt`, `error`. **Gap:** OC cannot block; lacks `last_assistant_message`. See `02-subagent-stop-hook.md`. |
| `PreCompact`         | `before_compaction`       | **CC:** `trigger` (manual/auto), `custom_instructions`. **OC:** `messageCount`, `compactingCount`, `tokenCount`, `sessionFile`. **OC is richer.** CC lacks token/message counts.                                                                                                       |
| `Stop`               | `agent_end`               | **CC:** `stop_hook_active`, `last_assistant_message`, can block (continue). **OC:** `success`, `error`, `durationMs`, `messages`. **Gap:** OC cannot block. OC lacks `last_assistant_message` (would need extraction from `messages`).                                                 |

### 1.2 Partially Covered

| Claude Code Hook    | OpenClaw Equivalent          | Gap Analysis                                                                                                                                                                                                                                                                                          |
| ------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PermissionRequest` | `before_tool_call` (partial) | OC's `before_tool_call` can block, but fires on ALL tool calls, not specifically when operator approval is needed. No dedicated "approval dialog" hook exists. The gateway has `tool.approval.request` but it's not a plugin hook. **Recommendation:** Add `permission_request` hook (see Section 5). |
| `UserPromptSubmit`  | `message_received` (partial) | `message_received` is fire-and-forget — **cannot block**. CC's hook can block prompt processing and erase the prompt. **Recommendation:** Add `before_message_process` blocking hook (see Section 4).                                                                                                 |

### 1.3 Not Covered (No Equivalent)

| Claude Code Hook        | Purpose                                                                   | OpenClaw Applicability                                                               |
| ----------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `Notification`          | Fires on permission_prompt, idle_prompt, auth_success, elicitation_dialog | **Medium value.** Could be useful for external alerting. Not critical for telemetry. |
| `TeammateIdle`          | Agent team teammate goes idle                                             | **Not applicable.** OC doesn't have agent teams.                                     |
| `TaskCompleted`         | Task marked as completed                                                  | **Not applicable.** OC doesn't have a task lifecycle system.                         |
| `ConfigChange`          | Config file changes mid-session                                           | **Low value.** OC is a gateway; config rarely changes mid-session.                   |
| `WorktreeCreate/Remove` | Custom VCS worktree lifecycle                                             | **Not applicable.** OC doesn't have worktrees.                                       |

---

## 2. Hook Context Enrichment

These fields are already computed/available at each hook's call site but are not currently passed through to hook listeners. Adding them requires only property additions to existing object literals — no new logic.

### 2.1 `after_tool_call` — Enrichment

**Call site:** `src/agents/pi-embedded-subscribe.handlers.tools.ts:414-435`

**Current event:** `{ toolName, params, result, error, durationMs }`
**Current context:** `{ toolName, agentId: undefined, sessionKey: undefined }`

**Proposed additions to event:**

| Field        | Source                             | Value                                                 |
| ------------ | ---------------------------------- | ----------------------------------------------------- |
| `toolCallId` | local var `toolCallId` (line 303)  | Pairs pre/post tool events, enables tool call tracing |
| `isError`    | local var `isToolError` (line 306) | Explicit boolean vs checking `error` field            |

**Proposed fixes/additions to context (`PluginHookToolContext`):**

| Field        | Source                                                              | Change                                                  |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------------------- |
| `agentId`    | `ctx.params.agentId` (currently passed as `undefined`, line 429)    | **Fix call site** — field already exists on type        |
| `sessionKey` | `ctx.params.sessionKey` (currently passed as `undefined`, line 430) | **Fix call site** — field already exists on type        |
| `runId`      | `ctx.params.runId` (line 386, already used for `emitAgentEvent`)    | **Add to type** + pass at call site — **most critical** |

#### Why `agentId`/`sessionKey` are `undefined` today

The handler function `handleToolExecutionEnd` declares its first parameter as `ToolHandlerContext`, which narrows `params` to `Pick<SubscribeEmbeddedPiSessionParams, "runId" | "onBlockReplyFlush" | "onAgentEvent" | "onToolResult">`. This deliberately narrow type was chosen for testability — 3 test files build mock contexts via factory functions and only need to supply 4 fields.

However, the handler is actually called with a full `EmbeddedPiSubscribeContext` (cast via `as never` in `pi-embedded-subscribe.handlers.ts:46`), which has access to the complete `SubscribeEmbeddedPiSessionParams` including `sessionKey`. The narrow Pick simply hides the fields from the type checker.

#### Fix: Widen `ToolHandlerParams` (zero test impact)

```typescript
// src/agents/pi-embedded-subscribe.handlers.types.ts, line 133-136
export type ToolHandlerParams = Pick<
  SubscribeEmbeddedPiSessionParams,
  "runId" | "agentId" | "sessionKey" | "onBlockReplyFlush" | "onAgentEvent" | "onToolResult"
  //        ^^^^^^^^    ^^^^^^^^^^^^  NEW in the Pick (both optional on source type)
>;
```

Additionally, `agentId?: string` must be added to `SubscribeEmbeddedPiSessionParams` (it has `sessionKey?` but not `agentId`), and passed when the subscriber is constructed.

**Test impact: zero files changed.** All 3 test files (26 total mock sites) use centralized factory functions. Since `agentId` and `sessionKey` are optional on the source type, omitting them in test stubs remains valid TypeScript. Existing tests compile and pass without modification.

**Then the call site fix is trivial:**

```typescript
// src/agents/pi-embedded-subscribe.handlers.tools.ts, lines 427-431
void hookRunnerAfter.runAfterToolCall(hookEvent, {
  toolName,
  agentId: ctx.params.agentId, // was: undefined
  sessionKey: ctx.params.sessionKey, // was: undefined
  runId: ctx.params.runId, // NEW
});
```

**Type changes required:**

```typescript
// src/plugins/types.ts — add two fields to event, one to context:
export type PluginHookAfterToolCallEvent = {
  toolName: string;
  toolCallId?: string; // NEW
  isError?: boolean; // NEW
  params: Record<string, unknown>;
  result?: unknown;
  error?: string;
  durationMs?: number;
};

export type PluginHookToolContext = {
  agentId?: string; // EXISTING — now receives actual value
  sessionKey?: string; // EXISTING — now receives actual value
  runId?: string; // NEW
  toolName: string;
};
```

**Diff size:** ~8 lines changed at call/type sites, ~1 line widening `ToolHandlerParams`, ~1 line adding `agentId` to `SubscribeEmbeddedPiSessionParams`.

---

### 2.2 `before_tool_call` — Enrichment

**Call site:** `src/agents/pi-tools.before-tool-call.ts:142-151`

**Current event:** `{ toolName, params }`
**Current context:** `{ toolName, agentId, sessionKey }` — note: `agentId` and `sessionKey` are already passed correctly here (unlike `after_tool_call`).

**Proposed additions to event:**

| Field        | Source                                        | Value                |
| ------------ | --------------------------------------------- | -------------------- |
| `toolCallId` | `args.toolCallId` (available in wrapper args) | Pre/post correlation |

**Note:** `runId` is NOT available in the `before_tool_call` call site's `HookContext` (defined at `pi-tools.before-tool-call.ts:9-13`). Adding `runId` here would require threading it through from `pi-embedded-subscribe.handlers.tools.ts`. This is a lower-priority addition — `runId` is available on `after_tool_call` (which fires for every tool call that completes), and `before_tool_call` events can be correlated via `toolCallId`.

**Implementation:** Add `toolCallId` to `PluginHookBeforeToolCallEvent`:

```typescript
export type PluginHookBeforeToolCallEvent = {
  toolName: string;
  toolCallId?: string; // NEW
  params: Record<string, unknown>;
};
```

Pass at call site:

```typescript
const hookEvent: PluginHookBeforeToolCallEvent = {
  toolName: normalizedToolName,
  toolCallId: args.toolCallId, // NEW
  params: args.params,
};
```

**Diff size:** ~4 lines.

---

### 2.3 `agent_end` — Enrichment

**Call site:** `src/agents/pi-embedded-runner/run/attempt.ts:1426-1449` (approx — the hook is fired near the end of `runEmbeddedPiAttempt`)

**Current event:** `{ messages, success, error, durationMs }`
**Current context:** `{ agentId, sessionKey, sessionId, workspaceDir, messageProvider }`

**Proposed additions to event:**

| Field                  | Source                                         | Value                                          |
| ---------------------- | ---------------------------------------------- | ---------------------------------------------- |
| `runId`                | `params.runId`                                 | Run correlation                                |
| `provider`             | `params.provider`                              | Model attribution                              |
| `model`                | `params.modelId`                               | Model attribution                              |
| `usage`                | `getUsageTotals()` — already in scope          | Per-run token accounting                       |
| `toolCallCount`        | `toolMetas.length` — already in scope          | Tool usage cardinality                         |
| `toolNames`            | `[...new Set(toolMetas.map(t => t.toolName))]` | Unique tools used                              |
| `compactionCount`      | `getCompactionCount()` — already in scope      | Context pressure indicator                     |
| `stopReason`           | `lastAssistant?.stopReason`                    | Why the LLM stopped                            |
| `lastAssistantMessage` | extracted from `assistantTexts`                | Final response text (matches CC's `Stop` hook) |

**Type changes:**

```typescript
export type PluginHookAgentEndEvent = {
  messages: unknown[];
  success: boolean;
  error?: string;
  durationMs?: number;
  // NEW fields:
  runId?: string;
  provider?: string;
  model?: string;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  toolCallCount?: number;
  toolNames?: string[];
  compactionCount?: number;
  stopReason?: string;
  lastAssistantMessage?: string;
};
```

**Diff size:** ~15 lines.

---

### 2.4 `llm_output` — Enrichment

**Call site:** `src/agents/pi-embedded-runner/run/attempt.ts:1486-1509`

**Current event:** `{ runId, sessionId, provider, model, assistantTexts, lastAssistant, usage }`

**Proposed additions:**

| Field          | Source                                                      | Value                                              |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| `durationMs`   | `Date.now() - promptStartedAt` (computable at call site)    | LLM call latency                                   |
| `stopReason`   | `lastAssistant?.stopReason` or `lastAssistant?.stop_reason` | Why LLM stopped (end_turn, tool_calls, max_tokens) |
| `messageCount` | `messagesSnapshot.length`                                   | Context size indicator                             |

**Type changes:**

```typescript
export type PluginHookLlmOutputEvent = {
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  assistantTexts: string[];
  lastAssistant?: unknown;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  // NEW:
  durationMs?: number;
  stopReason?: string;
  messageCount?: number;
};
```

**Diff size:** ~6 lines.

---

### 2.5 `subagent_ended` — Enrichment

**Call site:** `src/agents/subagent-registry-completion.ts:69-86`

**Current event:** `{ targetSessionKey, targetKind, reason, sendFarewell, accountId, runId, endedAt, outcome, error }`

**Proposed additions from `params.entry` (SubagentRunRecord):**

| Field        | Source                             | Value                                                             |
| ------------ | ---------------------------------- | ----------------------------------------------------------------- |
| `task`       | `params.entry.task`                | What the subagent was asked to do                                 |
| `label`      | `params.entry.label`               | Human-readable name                                               |
| `startedAt`  | `params.entry.startedAt`           | Duration calculation without cross-referencing `subagent_spawned` |
| `model`      | `params.entry.model`               | Model attribution                                                 |
| `spawnMode`  | `params.entry.spawnMode`           | "run" vs "session"                                                |
| `durationMs` | `endedAt - startedAt` (computable) | Wall-clock duration                                               |

**Approach: Pass the full `SubagentRunRecord` (cloned)**

Rather than cherry-picking individual fields, pass a `structuredClone` of the full `SubagentRunRecord`. This future-proofs the hook — any fields added to `SubagentRunRecord` later automatically become available to hook listeners without upstream changes.

```typescript
export type PluginHookSubagentEndedEvent = {
  targetSessionKey: string;
  targetKind: PluginHookSubagentTargetKind;
  reason: string;
  sendFarewell?: boolean;
  accountId?: string;
  runId?: string;
  endedAt?: number;
  outcome?: "ok" | "error" | "timeout" | "killed" | "reset" | "deleted";
  error?: string;
  // NEW — full record for future-proofing:
  entry?: SubagentRunRecord; // structuredClone of params.entry
  // Convenience fields (derived from entry, for direct access):
  durationMs?: number;
};
```

At the call site in `subagent-registry-completion.ts:69-86`:

```typescript
entry: structuredClone(params.entry),
durationMs: params.entry.endedAt && params.entry.startedAt
  ? params.entry.endedAt - params.entry.startedAt
  : undefined,
```

This exposes internal fields like `announceRetryCount` and `cleanupCompletedAt`, but these are harmless read-only data for plugin consumers. The `SubagentRunRecord` type is already exported from `subagent-registry.types.ts`.

**Diff size:** ~6 lines.

---

### 2.6 Total Enrichment Diff

| Hook               | Call-Site Changes | Type Additions          | Notes                                                            |
| ------------------ | ----------------- | ----------------------- | ---------------------------------------------------------------- |
| `after_tool_call`  | 5 (2 fixes + 3)   | 3 (1 context + 2 event) | `agentId`/`sessionKey` are fixes, not new types                  |
| `before_tool_call` | 2                 | 1                       | `toolCallId` on event only                                       |
| `agent_end`        | 10                | 10                      | 9 new event fields + type definitions                            |
| `llm_output`       | 3                 | 3                       | `durationMs`, `stopReason`, `messageCount`                       |
| `subagent_ended`   | 6                 | 6                       | `task`, `label`, `startedAt`, `model`, `spawnMode`, `durationMs` |
| **Total**          | **~26**           | **~23**                 |                                                                  |

All new fields are optional. Existing type fields (`agentId`/`sessionKey` on `PluginHookToolContext`) are unchanged — only the call-site values are fixed. No breaking changes to existing hook consumers.

---

## 3. Run Boundary Hooks: `run_start` + Enriched `agent_end`

### 3.1 Design Decision: Enrich `agent_end` Instead of Adding `run_end`

The existing `agent_end` hook fires at the same point where a hypothetical `run_end` would fire. Rather than adding a redundant new hook, we enrich `agent_end` with the fields that were missing (see Section 2.3: `runId`, `provider`, `model`, `usage`, `toolCallCount`, `toolNames`, `compactionCount`, `stopReason`, `lastAssistantMessage`).

This eliminates ~60 lines of upstream code (new hook type + runner + call site) while achieving the same telemetry capture. The telemetry plugin listens to the enriched `agent_end` and emits a `run.end` telemetry event.

**`run_start` is still needed** — there is no existing hook that fires at the beginning of a run with `runId` in scope. `before_agent_start` and `before_model_resolve` fire earlier in the lifecycle before `runId` is generated and session context is fully resolved.

### 3.2 `run_start` Hook Specification

**Fires:** At the beginning of `runEmbeddedPiAgent()`, after runId is generated and session context is resolved.

**Insertion point:** `src/agents/pi-embedded-runner/run.ts` or `src/auto-reply/reply/agent-runner.ts` — after `generateSecureUuid()` generates runId.

**Event type:**

```typescript
export type PluginHookRunStartEvent = {
  runId: string;
  sessionKey: string;
  sessionId: string;
  agentId: string;
  model: string;
  provider: string;
  isHeartbeat: boolean;
  isFollowup: boolean;
  messageCount: number;
  compactionCount: number;
  originChannel?: string;
};
```

**Context:** `PluginHookAgentContext` (existing).

**Execution model:** Fire-and-forget (async, non-blocking).

### 3.3 Diff Estimate

- `run_start` type definition: ~15 lines
- Hook call site (1 location): ~15 lines
- Hook runner addition (register + execute): ~5 lines
- `agent_end` enrichment: already counted in Section 2.3 (~25 lines)
- Tests: ~40 lines
- **Total: ~75 lines** (down from ~140 by consolidating `run_end` into `agent_end`)

---

## 4. New Hook: `before_message_process`

### 4.1 Motivation

`message_received` is fire-and-forget — it cannot block or reject messages. This prevents:

- Prompt injection detection before LLM invocation
- Content filtering / moderation gates
- Rate limiting per session or user
- Cost guardrails (block if session has exceeded budget)

Claude Code's `UserPromptSubmit` hook provides this capability. OpenClaw needs an equivalent.

### 4.2 Hook Specification

**Fires:** After `message_received` hook, BEFORE the message is enqueued via `enqueueFollowupRun()`.

**Insertion point:** `src/auto-reply/reply/queue/enqueue.ts:26` or the caller that invokes enqueue (the dispatch layer).

**Event type:**

```typescript
export type PluginHookBeforeMessageProcessEvent = {
  from: string;
  content: string;
  sessionKey: string;
  agentId: string;
  channel: string;
  accountId?: string;
  threadId?: string | number;
  timestamp: number;
  metadata?: Record<string, unknown>;
};
```

**Result type (sequential hook):**

```typescript
export type PluginHookBeforeMessageProcessResult = {
  block?: boolean; // If true, message is dropped
  reason?: string; // Logged / returned to sender (optional)
  modifiedContent?: string; // Replace message content before processing
  additionalContext?: string; // Injected as system context for this run
};
```

**Context:** `PluginHookMessageContext` (existing: `channelId`, `accountId`, `conversationId`).

**Execution model:** Sequential (async). All handlers run in priority order. First `block: true` stops processing. `modifiedContent` from highest-priority handler wins.

### 4.3 Flow

```
Channel webhook → message_received (fire-and-forget, observation)
  ↓
★ before_message_process (sequential, blocking) ★
  ├── Handler 1: prompt injection detector
  │   └── Returns { block: true, reason: "injection detected" }
  │       → Message dropped. Logged. Optional error reply to sender.
  │
  ├── Handler 2: rate limiter
  │   └── Returns { block: false }
  │       → Continue
  │
  ├── Handler 3: content modifier
  │   └── Returns { modifiedContent: "sanitized content" }
  │       → Content replaced before enqueue
  │
  └── All handlers pass → enqueueFollowupRun(sessionKey, { prompt: content })
```

### 4.4 Implementation Location

The ideal insertion point is in the message dispatch layer — the function that resolves the session key and calls `enqueueFollowupRun()`. This is channel-specific, so we need to find the common dispatch point.

**Primary location:** `src/auto-reply/reply/dispatch-from-config.ts` — the function that resolves agent routing and dispatches to the queue. The `runMessageReceived` hook is already called here, so adding `runBeforeMessageProcess` in sequence is natural.

**Alternative:** If dispatch paths are too fragmented across channels, add the hook call inside `enqueueFollowupRun()` itself. This is a single choke point but means the hook fires after queue dedup logic.

### 4.5 Error Handling

If a `before_message_process` handler throws:

- Error is logged
- Message processing **continues** (fail-open, not fail-closed)
- This prevents a buggy filter from silently dropping all messages

To fail-closed (require explicit allow), a plugin can implement:

```typescript
api.on(
  "before_message_process",
  async (event) => {
    const allowed = await checkAllowList(event.from);
    if (!allowed) return { block: true, reason: "not in allowlist" };
    return {};
  },
  { priority: 1000 },
); // High priority = runs first
```

### 4.6 Diff Estimate

- Type definitions: ~20 lines
- Hook runner addition: ~15 lines
- Call site in dispatch: ~20 lines
- Tests: ~40 lines
- **Total: ~95 lines**

---

## 5. New Hook: `permission_request`

### 5.1 Motivation

When a tool call requires elevated approval (operator consent), there is no plugin hook that fires at that specific decision point. `before_tool_call` fires on ALL tool calls regardless of approval status. A dedicated `permission_request` hook enables:

- Automated approval policies (auto-approve in dev, require approval in prod)
- External approval workflows (Slack notification → operator approves → tool proceeds)
- Audit logging of approval decisions
- Custom permission UIs

### 5.2 Hook Specification

**Fires:** When the tool execution policy determines that a tool call requires operator approval — the moment before the approval dialog/flow would be triggered.

**Event type:**

```typescript
export type PluginHookPermissionRequestEvent = {
  toolName: string;
  toolCallId?: string;
  params: Record<string, unknown>;
  approvalLevel: string; // "elevated", "dangerous", "external", etc.
  runId?: string;
  sessionKey?: string;
};
```

**Result type (sequential hook):**

```typescript
export type PluginHookPermissionRequestResult = {
  decision?: "allow" | "deny";
  reason?: string;
  modifiedParams?: Record<string, unknown>; // Allow with modified params
};
```

**Context:** `PluginHookToolContext` (existing + runId addition from Section 2).

**Execution model:** Sequential (async). First non-null `decision` wins.

### 5.3 Diff Estimate

- Type definitions: ~15 lines
- Hook runner addition: ~10 lines
- Call site at approval gate: ~25 lines
- Tests: ~40 lines
- **Total: ~90 lines**

---

## 6. New Diagnostic Event: `model.call` (Per-LLM-Call Snapshots)

### 6.1 Motivation

The existing `model.usage` diagnostic event fires **once per run** with cumulative totals and `lastCallUsage` (delta of the final LLM call only). For multi-turn tool loops within a single run, intermediate LLM calls are invisible.

Per-call snapshots enable:

- Token consumption growth visualization across conversation turns
- Identifying expensive tool loops (each tool result → LLM call consumes tokens)
- Cost attribution per tool call (how much did the LLM call after this tool cost?)
- Context window pressure tracking (how close to limit at each step?)

### 6.2 Specification

**Fires:** After each LLM API response is received, in the usage accumulator.

**Insertion point:** `src/agents/pi-embedded-subscribe.ts:259-272`, inside the `recordAssistantUsage` callback — this is called after EVERY LLM response chunk with usage data.

**Event type (added to DiagnosticEventPayload union):**

```typescript
export type DiagnosticModelCallEvent = DiagnosticBaseEvent & {
  type: "model.call";
  sessionKey?: string;
  sessionId?: string;
  runId?: string;
  callIndex: number; // 0-based within run
  provider?: string;
  model?: string;
  delta: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  cumulative: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  context?: {
    limit?: number;
    used?: number;
  };
  costUsd?: number;
  durationMs?: number;
};
```

### 6.3 Implementation

```typescript
// src/agents/pi-embedded-subscribe.ts, inside recordAssistantUsage (~line 259)
let callIndex = 0;

const recordAssistantUsage = (usageLike: unknown) => {
  const usage = normalizeUsage((usageLike ?? undefined) as UsageLike | undefined);
  if (!hasNonzeroUsage(usage)) return;
  // ... existing accumulation logic (usageTotals.input += usage.input ?? 0, etc.) ...

  // NEW: Emit per-call snapshot
  emitDiagnosticEvent({
    type: "model.call",
    sessionKey: params.sessionKey,
    sessionId: params.sessionId,
    runId: params.runId,
    callIndex: callIndex++,
    provider: params.provider,
    model: params.modelId,
    delta: {
      input: usage.input,
      output: usage.output,
      cacheRead: usage.cacheRead,
      cacheWrite: usage.cacheWrite,
      total: usage.total,
    },
    cumulative: {
      input: usageTotals.input,
      output: usageTotals.output,
      cacheRead: usageTotals.cacheRead,
      cacheWrite: usageTotals.cacheWrite,
      total: usageTotals.total,
    },
  });
};
```

### 6.4 Telemetry Plugin Consumption

The plugin subscribes via `onDiagnosticEvent()`:

```typescript
onDiagnosticEvent((event) => {
  if (event.type === "model.call") {
    // Write to JSONL
    appendToEventLog({
      kind: "llm.call",
      runId: event.runId,
      sessionKey: event.sessionKey,
      data: {
        callIndex: event.callIndex,
        delta: event.delta,
        cumulative: event.cumulative,
        context: event.context,
        provider: event.provider,
        model: event.model,
        costUsd: event.costUsd,
      },
    });

    // Upsert to SQLite usage_snapshots table
    upsertUsageSnapshot(event);
  }
});
```

### 6.5 Diff Estimate

- Diagnostic event type addition: ~25 lines
- Emission in `accumulateUsage`: ~15 lines
- `callIndex` counter initialization: ~2 lines
- Tests: ~30 lines
- **Total: ~72 lines**

---

## 7. Summary: All Upstream Changes

| Change                                                                                                             | Category   | Files Touched                                                              | Lines          |
| ------------------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------- | -------------- |
| `after_tool_call` enrichment (2 event fields + 1 context field + 2 call-site fixes + `ToolHandlerParams` widening) | Enrichment | `handlers.tools.ts`, `handlers.types.ts`, `types.ts`, `subscribe.types.ts` | ~12            |
| `before_tool_call` toolCallId                                                                                      | Enrichment | `pi-tools.before-tool-call.ts`, `types.ts`                                 | ~4             |
| `agent_end` enrichment (absorbs `run_end` — 9 new event fields)                                                    | Enrichment | `run/attempt.ts`, `types.ts`                                               | ~25            |
| `llm_output` enrichment                                                                                            | Enrichment | `run/attempt.ts`, `types.ts`                                               | ~6             |
| `subagent_ended` enrichment (full `SubagentRunRecord` clone)                                                       | Enrichment | `subagent-registry-completion.ts`, `types.ts`                              | ~6             |
| `run_start` hook                                                                                                   | New Hook   | `run.ts` or `agent-runner.ts`, `types.ts`, `hooks.ts`                      | ~35            |
| ~~`run_end` hook~~ → absorbed into `agent_end` enrichment                                                          | Eliminated | —                                                                          | 0              |
| `before_message_process` hook                                                                                      | New Hook   | `dispatch-from-config.ts`, `types.ts`, `hooks.ts`                          | ~55            |
| `permission_request` hook                                                                                          | New Hook   | approval gate, `types.ts`, `hooks.ts`                                      | ~50            |
| `model.call` diagnostic event                                                                                      | New Event  | `pi-embedded-subscribe.ts`, `diagnostic-events.ts`                         | ~42            |
| **Total**                                                                                                          |            |                                                                            | **~235 lines** |

Plus tests (~200 lines estimated).

All changes are additive (new optional fields, new hooks, widened Picks). No breaking changes to existing consumers. Zero test files require modification for the enrichment changes.
