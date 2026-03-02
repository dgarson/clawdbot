# Memory Feedback via Session Reflection

**Date:** 2026-03-02
**Status:** Design approved — pending implementation plan

---

## Problem

Agents complete sessions without any mechanism to capture what persistent memory would have made them more effective. This creates a one-way ratchet: agents can't improve their own knowledge base from experience, and there's no structured signal for humans or automated systems to know what to store.

---

## Goal

At the end of every agent session, trigger a lightweight asynchronous reflection that captures:

1. **(A) Human review queue** — structured feedback logged for a human to periodically review and decide what to write into memory.
2. **(B) Automated memory writer** — same feedback routed through a confidence threshold filter, with high-confidence entries written to Graphiti automatically.

---

## Design

### 1. Extend `agent_end` hook (not a new hook)

The existing `agent_end` hook in `src/agents/pi-embedded-runner/run/attempt.ts` already:

- Fires for **all entry paths** — channel replies, heartbeats, cron jobs, queue-drain, **and top-level isolated runs** that `subagent_ended` never sees
- Has `messagesSnapshot`, usage, runId, model, provider
- Is fire-and-forget

`subagent_ended` is intentionally NOT used here. It only fires for sessions registered via `subagent_spawning`, carries no `messages`/`usage`/`toolNames`, and has de-duplication guards tied to the subagent lifecycle registry. It serves a different purpose (parent/child fleet tracking with `requesterSessionKey`, `targetKind`, `reason`) and should remain on its own path. For subagents, both hooks fire; the reflector listens on `agent_end` and catches everything uniformly.

Four fields are added to `PluginHookAgentEndEvent` in `src/plugins/types.ts`. All new fields are optional to avoid breaking existing consumers and tests:

```typescript
// Additions to PluginHookAgentEndEvent (all optional for backwards compatibility)
assistantTexts?: string[];                              // All outputs, not just lastAssistantMessage
toolMetas?: Array<{ toolName: string; meta?: string }>; // Per-call metadata (toolNames stays for compat)
sessionFile?: string;                                   // JSONL path for full cross-turn history (SDK)
systemPromptText?: string;                              // Role/task context for the reflector
```

`toolNames` is kept as-is for backwards compatibility. New fields are all `?:` — existing handlers and tests are unaffected.

These are passed in the existing `runAgentEnd(...)` call at `attempt.ts:1626`. No new hook, no new handler map entry, no new `runAgentXxx` method needed.

### 2. Messages parity across Pi and Claude SDK runtimes

`messagesSnapshot` in `agent_end` is already sufficient for reflection:

| Runtime                                | `messages` in hook                                                                | `assistantTexts` | `toolMetas` |
| -------------------------------------- | --------------------------------------------------------------------------------- | ---------------- | ----------- |
| Pi (`managesOwnHistory: false`)        | Full conversation history across all turns                                        | Complete         | Complete    |
| Claude SDK (`managesOwnHistory: true`) | Current run's agentic loop: user message + all assistant turns + all tool results | Complete         | Complete    |

The SDK gap (no cross-turn history in `messages`) is addressed by `sessionFile` — the JSONL contains authoritative full history for both runtimes. For most reflection use cases, current-run context via `assistantTexts` + `toolMetas` is sufficient.

**No changes needed to `state.messages` accumulation or `managesOwnHistory` semantics.** The SDK path already writes every current-run message to `state.messages` via `event-adapter.ts:361` and `mcp-tool-server.ts:293/319`.

### 3. Consolidate the two `before_prompt_build` handlers into one

Currently there are two sequential `before_prompt_build` handlers:

- **Priority 95**: Config-driven role bootstrap — assigns a role to the session from `agentRoles` config if not already set
- **Priority 90**: Role context injection — reads the assigned role, builds fleet status, injects system context, appends memory search nudge

Priority 95 is a prerequisite for priority 90 (90 reads what 95 writes). Keeping them separate creates a window (91–94) where the session has a role assigned but no context injected — an inconsistent intermediate state any plugin registering in that range would see. There is no semantic reason they need to be separate.

**Fix**: Merge both into a single `before_prompt_build` handler at priority 90. Role assignment runs first as the initial step inside the handler, context injection follows immediately. The combined handler is atomic from any other plugin's perspective.

### 4. Ephemeral reflector (in the orchestrator extension)

The orchestrator extension registers an `agent_end` listener. For sessions belonging to agents in the configured fleet:

**Step 1 — Filter**: Skip if `memoryFeedback.enabled` is false. Skip if run was aborted with no meaningful content (`assistantTexts` empty and `toolMetas` empty).

**Step 2 — Build context** from the hook payload:

- `systemPromptText` → role/task framing
- `assistantTexts.join("\n")` → what the agent said/did
- `toolMetas` summary → what tools were called
- Last `maxContextMessages` from `messages` → conversation structure
- `sessionFile` → optional deeper context for SDK cross-turn history

**Step 3 — Single ephemeral LLM call** (not a full `runEmbeddedPiSession`):

- Direct `query()` call — no `resume`, no `session_id` persisted, no `OrchestratorSessionState` entry, never appears in `agent_status`
- Model: configurable, default haiku-class (cheap, fast)
- One tool exposed: `memory_feedback`
- System prompt terminal section: _"You are reviewing a completed agent session. Call `memory_feedback` once with what persistent memory would have helped this agent, and what new facts should be stored for future sessions."_

**Step 4 — Write to two places**:

1. **Session JSONL** — `sessionManager.appendCustomEntry("openclaw:memory-reflection", result)` appended after the session's `run.end` entry. Surfaces as an activity line in the UI.
2. **Feedback queue** — `{stateDir}/memory-feedback/{agentId}-{runId}.jsonl` for async processing.

### 5. Feedback queue processor (async, separate concern)

Reads `{stateDir}/memory-feedback/` entries:

- **Human review path (A)**: Presents structured entries for curation. No auto-action.
- **Auto-writer path (B)**: Applies confidence threshold filter; calls `graphiti_cli.py add` for high-confidence entries with appropriate group (`{project}-architecture`, `{project}-preferences`, etc.).

### 6. `memory_feedback` tool schema

```typescript
{
  name: "memory_feedback",
  description: "Report what persistent memory would have been useful in this session",
  input_schema: {
    type: "object",
    properties: {
      would_have_helped: {
        type: "array",
        items: {
          type: "object",
          properties: {
            query: { type: "string" },       // What you would have searched for
            why: { type: "string" },         // Why it would have helped
            confidence: { type: "number" },  // 0–1
          },
          required: ["query", "why", "confidence"],
        },
        description: "Information you would have wanted to retrieve from memory at the start",
      },
      should_store: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },        // Identifier for the memory entry
            body: { type: "string" },        // What to store
            group: { type: "string" },       // Memory group (architecture/preferences/etc.)
            confidence: { type: "number" },  // 0–1
          },
          required: ["name", "body", "group", "confidence"],
        },
        description: "New facts that should be stored for future sessions",
      },
    },
    required: ["would_have_helped", "should_store"],
  },
}
```

### 7. Configuration (in `openclaw.plugin.json`)

```json
{
  "memoryFeedback": {
    "enabled": true,
    "model": "claude-haiku-4-5-20251001",
    "autoWriteThreshold": 0.85,
    "maxContextMessages": 50
  }
}
```

---

## Files touched

| File                                                                       | Change                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/plugins/types.ts`                                                     | Add 4 optional fields to `PluginHookAgentEndEvent`                                                     |
| `src/agents/pi-embedded-runner/run/attempt.ts`                             | Pass 4 new fields in `runAgentEnd(...)` call                                                           |
| `extensions/agent-orchestrator/src/types.ts`                               | Add `MemoryFeedbackConfig` to plugin config type                                                       |
| `extensions/agent-orchestrator/openclaw.plugin.json`                       | Add `memoryFeedback` config block                                                                      |
| `extensions/agent-orchestrator/index.ts`                                   | Register `agent_end` listener; merge priority-95 + priority-90 `before_prompt_build` handlers into one |
| `extensions/agent-orchestrator/src/orchestration/memory-reflector.ts`      | New: ephemeral LLM call + dual write                                                                   |
| `extensions/agent-orchestrator/src/orchestration/memory-reflector.test.ts` | New: unit tests                                                                                        |

No changes to: `create-session.ts`, `mcp-tool-server.ts`, `pi-embedded-subscribe.ts`, `managesOwnHistory` semantics, `OrchestratorStore`, `subagent_ended` handler, or any existing hook infrastructure.

---

## Key constraints

- **Ephemeral reflector** is never registered in `OrchestratorStore`, never appears in `agent_status`, has no role, no depth, no `sessionKey` in the hierarchy.
- **Fire-and-forget**: reflection failure must never propagate to or delay the primary session teardown.
- **No blocking**: the `agent_end` hook is already fire-and-forget; the reflector must also be fully async internally.
- **SDK path**: current-run `messages` + `assistantTexts` + `toolMetas` are sufficient for reflection without loading JSONL history.
- **Backwards compatibility**: `toolNames` remains on `PluginHookAgentEndEvent`; all new fields are optional so no existing tests require updates.
- **`subagent_ended` unchanged**: fleet tracking, parent/child linkage, and thread binding cleanup all remain on `subagent_ended` as before.
