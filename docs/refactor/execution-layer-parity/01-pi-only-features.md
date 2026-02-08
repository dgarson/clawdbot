# Pi-Only Features (Missing from Claude Agent SDK)

> Features present in the Pi Runtime that have no equivalent in the Claude Agent SDK implementation.

---

## Critical — Affects reliability and correctness

### 1. Auth Profile Rotation & Failover

**Pi location**: `src/agents/pi-embedded-runner/run.ts:186-338`

On rate limit, billing, auth, or timeout errors, Pi automatically advances to the next auth profile with cooldown tracking. Key mechanisms:

- `resolveAuthProfileOrder()` — ordered list of auth profiles
- `advanceAuthProfile()` — rotation on failure
- `isProfileInCooldown()` / `markAuthProfileFailure()` / `markAuthProfileGood()` / `markAuthProfileUsed()`
- Locked profile support (`authProfileIdSource === "user"`)
- `FailoverError` with classified reasons (`auth`, `rate_limit`, `billing`, `timeout`, etc.)

**SDK status**: Not supported. Single-shot auth resolution via `enrichProvidersWithAuthProfiles()` + `tryAsyncOAuthResolution()` + `tryPlatformCredentialResolution()`. No multi-profile rotation or automatic failover. SDK runs are terminal on auth failure.

### 2. Model Fallback Chains

**Pi location**: `run.ts:124-125`, caught by upstream caller

Pi supports configured model fallback chains via `config.agents.defaults.model.fallbacks`. When a `FailoverError` is thrown, the upstream caller catches it and retries with the next model in the chain.

**SDK status**: Not supported. Single model, single attempt. When the configured provider/model fails, the run fails.

### 3. Context Overflow Auto-Compaction (Client-Side)

**Pi location**: `run.ts:417-493`, `compact.ts` (19,348 lines)

Pi has a full compaction subsystem:

- Auto-compaction on context overflow with up to `MAX_OVERFLOW_COMPACTION_ATTEMPTS = 3` retries
- Multi-stage adaptive summarization
- Tool result truncation fallback (`truncateOversizedToolResultsInSession`) when compaction cannot help
- Token estimation via `estimateTokens` from the Pi framework

**SDK status**: Delegates entirely to Claude Code's built-in `persistSession: true`. No client-side retry loop. No tool result truncation fallback. SDK does receive `compact_boundary` events and emits compatible lifecycle events, but has no control over the process.

### 4. Tool Result Truncation

**Pi location**: `src/agents/pi-embedded-runner/tool-result-truncation.ts` (11,523 lines)

When compaction can't reduce context enough, Pi truncates oversized tool results (>30% of context window) as a last resort before failing.

**SDK status**: Not implemented. Tool results flow through MCP as-is with no size gating.

### 5. Session Lane Serialization

**Pi location**: `src/agents/pi-embedded-runner/lanes.ts`

Dual-lane command queue (`resolveSessionLane`, `resolveGlobalLane`, `enqueueCommandInLane`) prevents concurrent writes to the same session file.

**SDK status**: Not implemented. Concurrent SDK runs targeting the same session could conflict.

---

## High — Affects user experience or operational robustness

### 6. Thinking Level Auto-Fallback

**Pi location**: `run.ts`, `pickFallbackThinkingLevel`

Retries with a lower thinking level when the model doesn't support the requested one. Tracks `attemptedThinking` to avoid retrying the same level.

**SDK status**: Not supported. Uses fixed `thinkingBudget` tiers (`none: 0`, `low: 10000`, `medium: 25000`, `high: 50000`) with no retry on failure.

### 7. Role Ordering Error Recovery

**Pi location**: `run.ts:517-538`

Detects "roles must alternate" errors (regex: `/incorrect role information|roles must alternate/`) and returns a user-friendly "use /new" suggestion.

**SDK status**: Not handled. Error surfaces as raw SDK failure text.

### 8. Image Size/Dimension Error Handling

**Pi location**: `run.ts:541-567`

`parseImageSizeError()` and `parseImageDimensionError()` detect image-related API errors and return user-friendly messages with actionable guidance.

**SDK status**: Not handled.

### 9. Context Window Guards (Pre-Run)

**Pi location**: `evaluateContextWindowGuard`, constants `CONTEXT_WINDOW_HARD_MIN_TOKENS`, `CONTEXT_WINDOW_WARN_BELOW_TOKENS`

Evaluates context budget before a run even starts. Warns or blocks if remaining context is too small.

**SDK status**: Not implemented. No pre-run context budget checking.

### 10. Model Registry & Validation

**Pi location**: `resolveModel()`, `model-resolution.ts`, `ensureOpenClawModelsJson()`

Validates requested model against a registry, returns structured model info including capabilities, context window size, etc.

**SDK status**: Not implemented. Model is a string alias passed directly to the SDK.

### 11. Multimodal Input (Images) — Declared but Not Forwarded

**Pi location**: `src/agents/pi-embedded-runner/run/images.ts`

Images are fully processed and forwarded to the Pi runtime.

**SDK status**: **Declared but unimplemented.** `SdkRunnerParams` accepts `images?: ImageContent[]` and `RunSdkAgentAdaptedParams` includes it, but the `images` field is never passed to `sdk.query()`. Inside `runSdkAgent()`, there is no code that injects images into the SDK prompt.

### 12. Anthropic Refusal Magic String Scrubbing

**Pi location**: `run.ts:66-78`

Scrubs `ANTHROPIC_MAGIC_STRING_TRIGGER_REFUSAL` from prompts to prevent session transcript poisoning attacks.

**SDK status**: Not implemented.

---

## Medium — Feature gaps in less common paths

### 13. `onBlockReplyFlush` Callback

**Pi location**: `RunEmbeddedPiAgentParams`

Callback invoked when block reply buffer is flushed.

**SDK status**: Missing from both the common `AgentRuntimeRunParams` interface and `SdkRunnerParams`.

### 14. Tool Streaming Updates (`onUpdate`)

**Pi location**: Tools can receive mid-execution progress via `onUpdate` callback.

**SDK status**: MCP bridge explicitly sets `onUpdate: undefined` in `tool-bridge.ts:453`.

### 15. Block Chunking

**Pi location**: `EmbeddedBlockChunker`

Intelligent paragraph/sentence-aware output chunking for streaming.

**SDK status**: Not implemented in SDK path.

### 16. Session History Sanitization

**Pi location**: `sanitizeSessionHistory`, `validateAnthropicTurns`

Repairs broken turn alternation, tool call pairing, and other session corruption.

**SDK status**: Not applicable (SDK manages its own history), but no equivalent protection for the session transcript that is persisted locally.

### 17. Per-DM History Limits

**Pi location**: `history.ts`, `getDmHistoryLimitFromSessionKey`

Per-user, per-provider turn limits for direct message contexts.

**SDK status**: Not implemented.

### 18. Memory Feedback Evaluation

**Pi location**: `configureMemoryFeedback()`

Lazy initialization of cheap-model-based memory quality scoring.

**SDK status**: Not implemented.

### 19. Probe Session Detection

**Pi location**: `run.ts:98`

Detects probe sessions (`sessionId.startsWith("probe-")`) for health checks with suppressed logging.

**SDK status**: Not implemented.

### 20. Queue-Based Mid-Run Message Steering

**Pi location**: `EmbeddedPiQueueHandle`, `queueMessage()`

Allows injecting messages into an active run's queue.

**SDK status**: Not supported.

### 21. System Prompt Report

**Pi location**: `buildSystemPromptReport()`, returned in `EmbeddedPiRunMeta`

Structured diagnostics on what components contributed to the system prompt.

**SDK status**: SDK adapter explicitly sets `error: undefined` and doesn't return system prompt diagnostics.

### 22. Client Tools & Pending Tool Calls (OpenResponses)

**Pi location**: `types.ts` (`stopReason`, `pendingToolCalls`), `clientTools` param

Supports `stopReason: "tool_calls"` with `pendingToolCalls` for external tool execution chains (e.g., OpenResponses hosted tools).

**SDK status**: Not supported in SDK result mapping.

---

## Pi-Only Parameters (Not in Common Interface)

These fields exist in `RunEmbeddedPiAgentParams` but NOT in `SdkRunnerParams` and are NOT forwarded through `AgentRuntimeRunParams`:

| Parameter                                        | Purpose                                                |
| ------------------------------------------------ | ------------------------------------------------------ |
| `messageChannel`                                 | Channel routing (e.g., "telegram", "discord")          |
| `provider` / `model` (as strings)                | Direct model selection by name                         |
| `authProfileId` / `authProfileIdSource`          | Auth profile selection                                 |
| `thinkLevel` / `verboseLevel` / `reasoningLevel` | Thinking/reasoning control tiers                       |
| `toolResultFormat`                               | Output format for tool results ("markdown" vs "plain") |
| `execOverrides` / `bashElevated`                 | Exec tool security/host configuration                  |
| `senderIsOwner`                                  | Owner-only tool gating                                 |
| `clientTools`                                    | OpenResponses hosted tool definitions                  |
| `disableTools`                                   | LLM-only mode (no tools)                               |
| `skillsSnapshot`                                 | Workspace skill entries for prompt injection           |
| `lane` / `enqueue`                               | Command queue lane serialization                       |
| `streamParams`                                   | Agent stream parameters                                |
| `requireExplicitMessageTarget`                   | Messaging tool routing control                         |
| `disableMessageTool`                             | Suppress messaging tool entirely                       |
| `extraTools` (ExtensionToolDefinition[])         | Extension-provided tools                               |
| `onBlockReplyFlush`                              | Block reply flush callback                             |
