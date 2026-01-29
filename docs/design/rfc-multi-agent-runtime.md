# RFC: Multi-Agent Runtime Architecture

**Status:** Proposed
**Author:** @dgarson
**Created:** 2026-01-29
**Branch:** `dgarson/agent-runtime-claude-code-support`

## Abstract

This RFC proposes an architecture for supporting multiple agent execution backends (runtimes) within Moltbot. The immediate goal is integrating the Claude Code SDK alongside the existing Pi agent, but the design accommodates future runtimes.

## Motivation

### Why Multi-Runtime?

1. **Provider Diversity**: Different providers offer different capabilities. Claude Code SDK provides extended thinking, native tool schemas, and provider-managed conversation history.

2. **Failover Resilience**: When one runtime's provider has issues (rate limits, outages), another runtime can continue operating.

3. **Feature Experimentation**: New agent features can be tested in isolated runtimes before broader rollout.

4. **User Choice**: Power users may prefer specific runtime characteristics (cost, latency, capabilities).

### Why Not Just Provider Switching?

The existing `runWithModelFallback` supports switching providers/models, but:
- Same underlying execution engine (Pi agent)
- Same streaming patterns and session format
- Cannot leverage provider-specific features (extended thinking, native schemas)

True multi-runtime requires abstracting the execution layer, not just the API layer.

## Design Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Application Layer                    │
│  (CLI, Gateway, Auto-Reply, Cron, Webhooks)             │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Unified Runtime Adapter                     │
│  - Runtime-outer failover                               │
│  - Auth profile rotation                                │
│  - Model-inner fallback                                 │
└──────────────────────────┬──────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌─────────────────────┐       ┌─────────────────────────┐
│   Pi Agent Runtime  │       │  Claude SDK Runtime     │
│                     │       │                         │
│ - Flat JSONL        │       │ - Tree JSONL            │
│ - Text thinking     │       │ - Native thinking       │
│ - TypeBox schemas   │       │ - JSON Schema           │
└─────────────────────┘       └─────────────────────────┘
           │                               │
           ▼                               ▼
┌─────────────────────┐       ┌─────────────────────────┐
│  Session Adapter    │       │   Session Adapter       │
│  (Pi format)        │       │   (CCSDK format)        │
└─────────────────────┘       └─────────────────────────┘
```

## Core Design Decisions

### 1. Runtime as First-Class Abstraction

**Decision:** Create an `AgentRuntime` interface with explicit `kind` discriminant.

**Why this way:**
- Clear contract for what runtimes must implement
- Type-safe runtime selection
- Extensible to future runtimes

**Alternative considered:** Duck typing (any object with `run()` method)
- Rejected: Harder to validate, no discriminant for conditional logic

**Alternative considered:** Inheritance hierarchy
- Rejected: Composition preferred; runtimes share little implementation

### 2. Runtime-Outer, Model-Inner Failover

**Decision:** Failover loop tries all auth profiles for a runtime before switching runtimes.

```
Runtime A + Profile 1 → fail
Runtime A + Profile 2 → fail
Runtime B + Profile 1 → fail
Runtime B + Profile 2 → success
```

**Why this way:**
- Runtime switches are more disruptive (session format, streaming patterns)
- Auth profile rotation handles most transient failures
- Minimizes user-visible behavior changes during failover

**Alternative considered:** Model-outer (try all models before runtime switch)
- Rejected: Model changes within runtime are lower impact than runtime changes

**Alternative considered:** Flat list (no nesting)
- Rejected: Loses semantic grouping, harder to reason about

### 3. Session Format Preservation

**Decision:** Each runtime reads/writes its native format. No cross-format conversion.

**Why this way:**
- Preserves format-specific metadata (CCSDK: git branch, UUID tree)
- Avoids lossy conversions
- Each runtime remains authoritative for its sessions

**Alternative considered:** Universal session format
- Rejected: Would lose CCSDK's tree structure, Pi's simplicity
- Trade-off: Cannot seamlessly continue session across runtime switch

**Forward-looking concern:** Users may want to migrate sessions between runtimes. A migration tool could be built using the normalized types, but this is explicitly out of scope for initial implementation.

### 4. Option Bags for Runtime-Specific Parameters

**Decision:** Runtime-specific options live in isolated bags (`piOptions`, `ccsdkOptions`).

```typescript
interface AgentRuntimeRunParams {
  // Shared parameters...
  piOptions?: PiRuntimeOptions;
  ccsdkOptions?: CcSdkRuntimeOptions;
}
```

**Why this way:**
- Shared interface stays clean
- Easy to add new runtime-specific options
- Type-safe access to runtime-specific features

**Alternative considered:** Single flat options object with optional fields
- Rejected: Pollutes interface, harder to know which options apply

**Alternative considered:** Generic `runtimeOptions: Record<string, unknown>`
- Rejected: Loses type safety

### 5. Lazy SDK Loading

**Decision:** CCSDK module dynamically imported only when needed.

```typescript
const { createCcSdkAgentRuntime } = await import("./claude-agent-sdk/index.js");
```

**Why this way:**
- Reduces startup time when CCSDK not configured
- Avoids bundling CCSDK for Pi-only deployments
- Graceful fallback if SDK unavailable

**Forward-looking concern:** Dynamic imports can be tricky with bundlers. Ensure build process preserves import paths.

### 6. Phase-Aware Streaming

**Decision:** Gateway tracks thinking and text as separate phases, not interleaved strings.

```typescript
type StreamPhase = { type: "thinking" | "text"; content: string };
```

**Why this way:**
- Enables distinct visual treatment in UI
- Preserves phase boundaries for future features (thinking summarization)
- Backward compatible (legacy path extracts text only)

**Alternative considered:** Single stream with inline markers
- Rejected: Parsing markers is fragile, loses boundary information

**Alternative considered:** Separate WebSocket channels
- Rejected: Over-engineered, complicates client

**Forward-looking concern:** Future runtimes may have additional phase types (planning, reflection). The phase type should be extensible.

### 7. Centralized Payload Deduplication

**Decision:** Single `createPayloadKey()` function used everywhere for dedup.

**Why this way:**
- CCSDK uses cumulative streaming ("Hello", "Hello world")
- Multiple code paths need consistent key generation
- Single source of truth prevents subtle mismatches

**Discovery during implementation:** This was NOT obvious upfront. We discovered the need when CCSDK's cumulative pattern caused double-sends. The fix required touching multiple files to use the same normalization.

**Forward-looking concern:** If a future runtime uses different payload structures, key generation may need runtime-aware logic.

### 8. Provider-Specific Session ID Storage

**Decision:** Session IDs stored with provider key, not globally.

```typescript
storeSessionId({ sessionId, provider: isCcsdkRun ? "ccsdk" : providerUsed });
```

**Why this way:**
- CCSDK and Pi may have different session ID semantics
- Prevents cross-runtime session ID conflicts
- Enables runtime-specific session resumption

**Discovery during implementation:** Initially assumed single session ID per conversation. CCSDK's provider session ID tracking exposed the need for per-runtime keying.

## Non-Obvious Parity Requirements

These areas required attention to maintain feature parity across runtimes:

### Tool Descriptions

**Requirement:** All tool schemas need descriptions for CCSDK.

**Why:** CCSDK uses descriptions for model guidance. Pi agent worked without them.

**Resolution:** PR 1 adds descriptions to all 13 tool files.

### Callback Wiring

**Requirement:** `onBlockReply`, `onBlockReplyFlush`, `onReasoningStream` must work for both runtimes.

**Why:** UI expects consistent callback behavior regardless of runtime.

**Resolution:** Unified adapter wires callbacks through to runtime, with no-op flush for CCSDK.

### Auth Profile Cooldown

**Requirement:** Cooldown tracking must span all runtimes.

**Why:** A rate-limited profile shouldn't be retried immediately, even on different runtime.

**Resolution:** Unified adapter manages cooldown state at adapter level, not runtime level.

### Error Classification

**Requirement:** Both runtimes must report errors in consistent format.

**Why:** Unified adapter needs to classify errors for failover decisions.

**Resolution:** Each runtime maps its errors to common `FailoverError` types.

### Tool Error Visualization

**Requirement:** UI must display tool errors from both runtimes.

**Why:** CCSDK reports tool errors with `isError` flag. Pi uses different pattern.

**Resolution:** UI checks both `result` and `resultText` fields, handles `isError` flag.

## Security Considerations

### Credential Storage

Multi-platform credential storage was added to support CCSDK's OAuth flow:
- macOS: Keychain (OS encryption)
- Linux: Secret Service (D-Bus mediated)
- Windows: Credential Manager (DPAPI)
- Fallback: File (plaintext, not recommended)

**Concern:** Shell injection in Linux/Windows credential commands.
**Mitigation:** Input escaping applied, but this code path needs careful review.

**Concern:** OAuth refresh not implemented.
**Future work:** Token refresh loop needed for long-running agents.

### Provider Validation

Config validation ensures CCSDK only used with compatible providers:

```typescript
const CCSDK_COMPATIBLE_PROVIDERS = new Set(["anthropic", "zai", "openrouter"]);
```

**Concern:** Provider compatibility may change.
**Mitigation:** Validation at config load, not runtime. Easy to update.

## Performance Considerations

### Startup Time

- Pi runtime: Immediate (existing code)
- CCSDK runtime: Dynamic import adds ~50-100ms on first use

**Mitigation:** Lazy loading means no cost if CCSDK not used.

### Memory

- Each runtime maintains its own tool set
- Session adapters load history on demand, not at construction

**Concern:** Multiple runtimes in memory simultaneously.
**Observation:** In practice, only one runtime active per agent run. Factory creates fresh instance per invocation.

### Streaming Latency

- Phase buffer adds minimal overhead (string concatenation)
- No measurable latency difference in testing

## Testing Strategy

### Unit Tests

Each component tested in isolation:
- Runtime implementations
- Session adapters
- Tool bridge
- Payload normalization
- Error classification

### Integration Tests

End-to-end flows:
- Pi agent execution (existing, verify no regression)
- CCSDK agent execution (new)
- Failover scenarios
- Streaming to UI

### Manual Verification

- Visual inspection of thinking/text separation
- Tool error display
- Session continuity across messages

## Migration Path

### Phase 1: Merge Foundation (PRs 1-3)

- Tool descriptions
- Session adapters
- Runtime interface + Pi implementation

**User impact:** None. All new code, default behavior unchanged.

### Phase 2: Merge Unified Adapter (PR 4)

- Failover orchestration
- Config schema
- Pipeline migration

**User impact:** Minimal. Default runtime is "pi". New config fields optional.

### Phase 3: Merge CCSDK + UI (PR 5)

- CCSDK runtime
- Phase streaming
- Full feature available

**User impact:** Opt-in via config. `runtime: "ccsdk"` enables new runtime.

## Open Questions

1. **Session Migration:** Should we provide tooling to migrate sessions between formats?
   - Current answer: No, out of scope for v1

2. **Runtime Preference per Channel:** Should different channels use different runtimes?
   - Current answer: Per-agent config, not per-channel

3. **Mixed Runtime Conversations:** What happens if user switches runtime mid-conversation?
   - Current answer: New session starts. Previous context not carried.

4. **CCSDK Model Tiers:** How should haiku/sonnet/opus tier selection work?
   - Current answer: Config-driven, runtime applies internally

## Appendix: File Inventory

### New Files (50+)

```
src/agents/agent-runtime.ts
src/agents/pi-agent-runtime.ts
src/agents/main-agent-runtime-factory.ts
src/agents/runtime-result-types.ts
src/agents/tool-event-logger.ts
src/agents/unified-runtime-adapter.ts
src/agents/unified-agent-runner.ts
src/agents/sessions/
src/agents/claude-agent-sdk/ (20+ files)
src/auto-reply/reply/payload-normalization.ts
ui/src/styles/chat/text.css (new rules)
ui/src/styles/chat/tool-cards.css (new rules)
```

### Modified Files (50+)

Config, CLI, gateway, auto-reply, UI components, tools...

### Total Impact

- 105 files changed
- 14,757 insertions
- 1,098 deletions

---

## Conclusion

This architecture enables Moltbot to support multiple agent backends while:
- Maintaining backward compatibility
- Enabling graceful failover
- Preserving runtime-specific features
- Keeping the codebase maintainable

The key insight is that **runtime is a distinct layer from provider**. Providers handle API communication; runtimes handle execution semantics. This separation unlocks future flexibility without over-abstracting the current implementation.

---

*RFC Version: 1.0*
*Last Updated: 2026-01-29*
