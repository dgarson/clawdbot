# Session Scratchpad Extension — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** 2026-02-28
**Branch:** `claude-sdk-context-attachment-optimizations`
**Goal:** Add a `session.scratchpad` tool as an extension that lets the Claude SDK agent persist working state (plans, findings, decisions) across auto-compaction within a single session.

---

## Problem

When the Claude SDK auto-compacts a long conversation, Claude loses its working plan, key findings, and accumulated decisions. The existing `memory_search` system handles cross-session recall but not intra-session persistence — the session data hasn't been synced to the memory index while the session is still active.

## Solution

A new `extensions/scratchpad` extension that:

1. Registers a `session.scratchpad` tool for Claude to explicitly persist working state
2. Prepends the latest scratchpad content to each user message before it reaches `query()`
3. Stores scratchpad data in the session JSONL (via `appendCustomEntry`) for session resume

## Non-Goals

- No auto-extraction of "important" content from conversation — Claude must explicitly call the tool
- No cross-session memory (that's what `memory_search` / `memory_get` are for)
- No session introspection or JSONL search tools
- No document pinning or caching tier management

---

## Architecture

### Extension Structure

```
extensions/scratchpad/
  index.ts          # Plugin entry: registers tool, exposes getter
  scratchpad.ts     # Core logic: read/write/append, token budget enforcement
  package.json      # Extension manifest
```

### Tool Definition

```typescript
{
  name: "session.scratchpad",
  description: "Persist important working state (plans, findings, decisions) that survives context compaction. Content is prepended to each message you receive.",
  parameters: {
    content: {
      type: "string",
      description: "The scratchpad content to save"
    },
    mode: {
      type: "string",
      enum: ["replace", "append"],
      default: "replace",
      description: "replace: overwrite entire scratchpad. append: add to existing content."
    }
  }
}
```

### Storage

| Layer          | Mechanism                                           | Purpose                                   |
| -------------- | --------------------------------------------------- | ----------------------------------------- |
| **In-memory**  | `Map<sessionId, string>` in extension module        | Fast read on every turn                   |
| **Persistent** | `appendCustomEntry("openclaw:scratchpad", content)` | Survives process restart / session resume |

**On session resume:** Read the last `openclaw:scratchpad` entry from JSONL to initialize the in-memory Map.

### Injection Point

Single call site at `src/agents/claude-sdk-runner/create-session.ts:508`, after steer text prepend but before `buildPersistedUserContent`:

```typescript
// Existing:
effectivePrompt = steerText ? `${steerText}\n\n${effectivePrompt}` : effectivePrompt;

// New: prepend scratchpad if present
const scratchpad = getScratchpadContent(sessionId);
if (scratchpad) {
  effectivePrompt = `[Session Scratchpad - your persistent working memory]\n${scratchpad}\n[End Scratchpad]\n\n${effectivePrompt}`;
}
```

The extension exposes a `getScratchpadContent(sessionId): string | undefined` getter. The core calls it at the one `query()` call site.

### Configuration

```yaml
agents:
  defaults:
    claudeSdk:
      scratchpad:
        enabled: true # Toggle on/off
        maxTokens: 2000 # Budget cap to prevent scratchpad bloat
```

When `enabled: false` or not configured, the tool is not registered and the injection is skipped.

### System Prompt Guidance

Appended to the claude-sdk system prompt via the existing `before_session_create` hook:

```
## Session Scratchpad
You have a persistent scratchpad tool (session.scratchpad) that survives context compaction.
Use it to save: multi-step plans, key findings, important decisions, accumulated state.
The scratchpad is prepended to each message you receive. Budget: ~2000 tokens.
Call session.scratchpad with mode "replace" to overwrite, or "append" to add incrementally.
```

---

## Data Flow

```
Turn N: Claude calls session.scratchpad("## Plan\n1. Fix X\n2. Test Y", "replace")
  → Extension validates token budget (≤2000 tokens)
  → Writes to in-memory Map[sessionId]
  → appendCustomEntry("openclaw:scratchpad", content) to JSONL
  → Returns: "Scratchpad updated (45 tokens / 2000 budget)"

Turn N+1: User sends "continue with step 2"
  → create-session.ts prompt() method fires
  → getScratchpadContent(sessionId) returns the saved plan
  → Prepends: "[Session Scratchpad]\n## Plan\n1. Fix X\n2. Test Y\n[End Scratchpad]"
  → SDK receives augmented message
  → Claude sees its plan, continues step 2

[Auto-compaction happens, drops turns 1-15]

Turn N+8: User sends "what's next?"
  → Scratchpad still prepended (read from in-memory Map, not from compacted context)
  → Claude sees the plan, knows where it left off
```

---

## Token Budget Enforcement

The `maxTokens` config caps scratchpad size. When a write or append would exceed the budget:

- **replace mode:** Truncate to `maxTokens` and warn in tool response: "Scratchpad truncated to 2000 tokens (original: 3200). Consider summarizing."
- **append mode:** Reject the append and return: "Append would exceed 2000 token budget (current: 1800, append: 500). Use mode 'replace' to rewrite, or reduce content."

Token counting uses the same tokenizer available in the codebase (tiktoken or character-based estimation).

---

## Session Resume

When a session is resumed (process restart, reconnect):

1. `SessionManager.getEntries()` filters for `openclaw:scratchpad` entries
2. Take the last entry's content
3. Initialize `Map[sessionId] = content`
4. Subsequent turns see the scratchpad as if the session never restarted

---

## Integration with Existing Systems

| System                              | Interaction                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| **memory_search / memory_get**      | No overlap. Memory tools handle cross-session recall. Scratchpad handles intra-session persistence. |
| **AttachmentManifest**              | Same JSONL custom entry pattern. No conflict — different entry type keys.                           |
| **ChannelSnapshot / ThreadContext** | No interaction. Scratchpad is orthogonal to channel context.                                        |
| **Steer text**                      | Scratchpad prepends after steer text. Order: steer → scratchpad → user message.                     |
| **before_session_create hook**      | Scratchpad extension registers its system prompt section via this existing hook.                    |

---

## Implementation Tasks

### Task 1: Create extension scaffold

- `extensions/scratchpad/package.json` with standard extension metadata
- `extensions/scratchpad/index.ts` with plugin entry point

### Task 2: Implement scratchpad core logic

- `extensions/scratchpad/scratchpad.ts`
- In-memory Map storage
- `getScratchpadContent(sessionId)` getter
- `setScratchpadContent(sessionId, content, mode)` setter with token budget
- Token counting utility

### Task 3: Register the tool

- In `index.ts`, use `api.registerTool()` to register `session.scratchpad`
- Tool execute function calls `setScratchpadContent()` and persists to JSONL
- Gate on `claudeSdk.scratchpad.enabled` config

### Task 4: Add injection point in create-session.ts

- At `prompt()` method, after steer text prepend (~line 508)
- Call `getScratchpadContent(sessionId)` from the extension
- Prepend scratchpad block if content exists
- Need to determine the integration pattern (direct import vs. extension registry getter)

### Task 5: Add system prompt guidance

- Register `before_session_create` hook handler in the extension
- Append "Session Scratchpad" section to system prompt

### Task 6: Session resume support

- On session init, read last `openclaw:scratchpad` entry from JSONL
- Initialize in-memory Map

### Task 7: Tests

- Unit tests for scratchpad read/write/append/truncation
- Unit test for injection at prompt() call site
- Integration test: tool call → storage → injection on next turn
- Token budget enforcement tests
- Session resume test (JSONL → Map reconstruction)

### Task 8: Configuration

- Add `claudeSdk.scratchpad` schema to agent config types
- Default: `{ enabled: true, maxTokens: 2000 }`
- Document in relevant config docs

---

## Open Questions

1. **Extension ↔ core coupling:** The injection point is in `create-session.ts` (core), but the scratchpad state lives in the extension. Options:
   - Extension registers a getter on a shared registry that core queries
   - Extension uses a hook (`before_query`) that core fires — would need a new hook type
   - Direct import from extension (breaks extension isolation)

   **Recommendation:** Use the plugin tool registry — the extension registers the tool, and the injection point queries tool state via a well-known key.

2. **Scratchpad in persisted user content:** Should the `[Session Scratchpad]` block be included in the JSONL-persisted user message, or only in the `claudePromptInput` sent to the SDK? Including it in persistence means session replay shows the scratchpad; excluding keeps the JSONL cleaner.

   **Recommendation:** Exclude from persisted content. The scratchpad is injected transiently for the SDK; the JSONL stores the raw user message plus the scratchpad as a separate custom entry.
