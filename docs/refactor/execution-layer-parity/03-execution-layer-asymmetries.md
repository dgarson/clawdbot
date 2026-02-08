# Execution Layer Asymmetries

> Bugs, inconsistencies, and mismatches in the shared execution layer that affect both runtimes differently.

---

## 1. `RuntimeCapabilities.supportsImages` Lies for SDK

**Location**: `src/execution/resolver.ts:387-393`

```typescript
return {
  supportsTools: kind !== "cli",
  supportsStreaming: kind !== "cli",
  supportsImages: kind !== "cli", // ← SDK never actually forwards images
  supportsThinking: supportsXHighThinking(provider, model),
};
```

`supportsImages` returns `true` for both Pi and Claude runtimes, despite the fact that the SDK implementation **never actually forwards images** to the query. `SdkRunnerParams` declares `images?: ImageContent[]` but the field is never injected into `sdk.query()`.

**Impact**: Callers that check `RuntimeCapabilities.supportsImages` will believe the SDK supports images and may send image content that is silently dropped.

**Fix**: Either wire up image forwarding in the SDK, or set `supportsImages: false` for `kind === "claude"` until it's implemented.

---

## 2. Graceful Degradation Masks SDK Readiness Gaps

**Location**: `src/agents/agent-runtime-dispatch.ts:72-79`

When Claude SDK runtime is resolved but no `sdkContext` is provided, the system logs a warning and silently falls back to Pi runtime:

```typescript
// Warning: SDK runtime requested but no sdkContext provided, falling back to Pi
```

**Impact**: Call sites that haven't been fully migrated to support the SDK runtime will silently degrade to Pi without the user or developer knowing. This hides integration gaps.

**Fix**: Consider surfacing the fallback as a user-visible event or metric, not just a log warning.

---

## 3. Error Taxonomy Mismatch

**Location**: `src/execution/types.ts` (error kinds), `sdk-runner-adapter.ts:403`

Pi returns structured `error.kind` values:

```typescript
error?: {
  kind: "context_overflow" | "compaction_failure" | "role_ordering" | "image_size";
  message: string;
}
```

The SDK adapter intentionally sets `error: undefined`:

> "SDK runner errors are rendered as text payloads with isError=true. Avoid mapping to Pi-specific error kinds (context/compaction) because downstream recovery logic would treat them incorrectly."

**Impact**: The execution layer's error classification (`ExecutionError.code`) doesn't map SDK-specific failure modes. Downstream error recovery (e.g., auto-compaction retry, role ordering fix suggestions) only works for Pi runs.

**Fix**: Define SDK-specific error kinds and/or map common failure patterns (rate limit, auth failure, context overflow) from SDK error text to the shared `ExecutionError.code` taxonomy.

---

## 4. `shouldEmitToolResult` vs `shouldEmitToolOutput` Asymmetry

**Pi**: Passes both `shouldEmitToolResult` and `shouldEmitToolOutput` as functions: `() => boolean`.

**SDK**: Only supports `shouldEmitToolOutput` (in `sdk-runner.types.ts:111`), checked as a static boolean (`params.shouldEmitToolOutput !== false` at `sdk-runner.ts:1062`).

**Impact**: Behavioral difference in how tool output emission is gated between the two runtimes. Code that relies on the distinction between "tool result" and "tool output" emission will behave differently depending on which runtime is active.

---

## 5. `"cli"` Runtime Kind Not in `AgentRuntimeKind`

**Location**: `src/execution/types.ts:409` vs `src/agents/agent-runtime.ts`

`RuntimeContext.kind` includes `"cli"` as a valid value, and `resolver.ts` detects CLI providers via `isCliProvider()`. However, `AgentRuntimeKind` only defines `"pi" | "claude"` — there is no `"cli"` variant.

**Impact**: The CLI runtime exists outside the `AgentRuntime` interface and follows a separate code path (`runCliAgent()`), which means it doesn't benefit from any `AgentRuntime`-level improvements.

---

## 6. Existing Parity TODOs/Comments in Code

```
sdk-agent-runtime.ts:24
  /** Enable Claude Code hook wiring for richer event parity. */
  hooksEnabled?: boolean;

sdk-runner.ts:993
  // Populate runState for precompact context parity (#4)

sdk-runner.types.ts:104
  /** Enable Claude Code hook wiring for richer lifecycle/tool parity. */

agents/agent-scope.ts:35
  claudeSdkOptions?: any; // TODO: Add proper ClaudeSdkOptions type
```

These comments explicitly acknowledge parity work that remains incomplete.

---

## Summary Table

| Asymmetry                                     | Severity | Affects                        |
| --------------------------------------------- | -------- | ------------------------------ |
| `supportsImages` false advertising            | High     | Callers sending images to SDK  |
| Silent Pi fallback on missing sdkContext      | Medium   | Observability, debugging       |
| Error taxonomy mismatch                       | High     | Error recovery, user messaging |
| `shouldEmitToolResult`/`Output` type mismatch | Low      | Tool output streaming behavior |
| `"cli"` not in `AgentRuntimeKind`             | Low      | CLI runtime maintenance        |
| Incomplete parity TODOs                       | Info     | Tracking only                  |
