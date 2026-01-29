# PR 4: Unified Runtime Adapter + Configuration

## Summary

Implement the unified runtime adapter for multi-runtime failover orchestration, add configuration schema for runtime selection, and migrate the auto-reply pipeline to use the unified runner.

## PR Description

```markdown
## Summary

- Implement `runWithUnifiedFallback()` for cross-runtime/profile failover
- Add `runAgentWithUnifiedFailover()` high-level orchestrator
- Extend config schema with runtime selection and CCSDK options
- Migrate auto-reply pipeline from `runWithModelFallback` to unified runner
- Add payload normalization for consistent deduplication

## Test plan

- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] Pi agent continues working (default runtime)
- [ ] Failover works across providers/models
- [ ] Config validation catches invalid runtime+provider combos
- [ ] Block streaming deduplication works correctly

## Motivation

The existing `runWithModelFallback` pattern only supports single-runtime fallback.
To enable multi-runtime failover (Pi → CCSDK or vice versa), we need:
1. Runtime-outer failover loop
2. Auth profile cooldown management
3. Unified parameter contract
4. Config-driven runtime selection
```

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `src/agents/unified-runtime-adapter.ts` | Core failover orchestrator |
| `src/agents/unified-runtime-adapter.test.ts` | Adapter tests |
| `src/agents/unified-agent-runner.ts` | High-level runner |
| `src/agents/unified-agent-runner.test.ts` | Runner tests |
| `src/auto-reply/reply/payload-normalization.ts` | Dedup utilities |
| `src/auto-reply/reply/agent-runner-double-send.test.ts` | Dedup tests |
| `src/auto-reply/reply/agent-runner-execution.callback-wiring.test.ts` | Callback tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/config/types.agent-defaults.ts` | Add `AgentRuntimeKind`, runtime field |
| `src/config/types.agents.ts` | Add `runtime`, `ccsdk` fields to AgentConfig |
| `src/config/zod-schema.agent-defaults.ts` | Add runtime schema |
| `src/config/zod-schema.agent-runtime.ts` | CCSDK config schema + validation |
| `src/auto-reply/reply/agent-runner-execution.ts` | Use unified runner |
| `src/auto-reply/reply/agent-runner.ts` | CCSDK session ID handling |
| `src/auto-reply/reply/followup-runner.ts` | Use unified runner |
| `src/auto-reply/reply/agent-runner-memory.ts` | Use unified runner |
| `src/auto-reply/reply/block-reply-pipeline.ts` | Use centralized key |
| `src/auto-reply/reply/agent-runner-payloads.ts` | Direct key filtering |
| `src/auto-reply/reply/session-usage.ts` | Provider-specific session IDs |
| `src/commands/agent.ts` | Use unified runner |
| `src/cron/isolated-agent/run.ts` | Use unified runner |

## Architecture

### Unified Failover Algorithm

```typescript
async function runWithUnifiedFallback({
  config,        // Primary runtime + fallbacks + auth profiles
  run,           // Execution function
  onAttempt,     // Per-attempt callback
}): Promise<UnifiedRuntimeResult> {

  // 1. Build runtime slots (primary + fallbacks, deduplicated)
  const slots = buildRuntimeSlots(config);

  // 2. For each slot, get available auth profiles (filtered by cooldown)
  const attempts: FailoverAttempt[] = [];

  for (const slot of slots) {
    const profiles = getAvailableProfiles(slot);

    for (const profile of profiles) {
      try {
        // 3. Attempt execution
        const result = await run({
          runtime: slot.runtime,
          provider: slot.provider,
          model: slot.model,
          profileId: profile.id,
        });

        // 4. Success - return with attempt history
        return { result, attempts, usedSlot: slot };

      } catch (error) {
        // 5. Classify error
        if (isAbortError(error)) throw error;

        if (isFailoverEligible(error)) {
          // Put profile in cooldown if rate limit/auth/billing
          if (shouldCooldown(error)) {
            putProfileInCooldown(profile);
          }
          attempts.push({ slot, profile, error });
          continue; // Try next
        }

        throw error; // Non-failover error
      }
    }
  }

  // 6. All attempts exhausted
  throw new AllAttemptsFailedError(attempts);
}
```

### Configuration Schema

```yaml
agents:
  defaults:
    runtime: "pi"  # or "ccsdk"

  list:
    - id: coding-agent
      runtime: "ccsdk"
      provider: anthropic
      model: claude-sonnet-4
      ccsdk:
        hooksEnabled: true
        models:
          haiku: anthropic/claude-haiku-4
          sonnet: anthropic/claude-sonnet-4
          opus: anthropic/claude-opus-4-5
```

### Provider Validation

```typescript
const CCSDK_COMPATIBLE_PROVIDERS = new Set([
  "anthropic",
  "zai",
  "openrouter",
]);

// Validation in zod schema
.superRefine((data, ctx) => {
  if (data.runtime === "ccsdk") {
    const provider = extractProvider(data.model);
    if (!CCSDK_COMPATIBLE_PROVIDERS.has(provider)) {
      ctx.addIssue({
        code: "custom",
        message: `CCSDK runtime requires compatible provider. Got: ${provider}`,
      });
    }
  }
});
```

### Payload Normalization

Centralized deduplication to prevent double-sends:

```typescript
// Single source of truth for payload keys
function createPayloadKey(payload: ReplyPayload): string {
  return JSON.stringify({
    text: payload.text?.trim() ?? "",
    media: payload.media?.map(m => m.path ?? m.url) ?? [],
  });
}

// Used by:
// 1. Block reply pipeline (tracking sent payloads)
// 2. Final payload filtering (excluding already-sent)
// 3. CCSDK cumulative streaming dedup
```

## Key Design Decisions

### 1. Runtime-Outer, Model-Inner Failover

```
[Slot 1: Pi + anthropic/claude-opus-4]
  ├─ Profile A → Attempt
  └─ Profile B → Attempt
[Slot 2: CCSDK + anthropic/claude-sonnet-4]
  ├─ Profile A → Attempt
  └─ Profile B → Attempt
```

Rationale: Runtime changes are more impactful than model changes. Try all auth profiles for a runtime before switching runtimes.

### 2. Auth Profile Cooldown

When a profile hits rate limit/auth/billing errors, it enters cooldown:
- Prevents immediate retry with known-bad credentials
- Cooldown duration based on error type
- Per-profile tracking (not global)

### 3. Direct Block Key Tracking for CCSDK

CCSDK uses cumulative streaming (sends "Hello", "Hello world", "Hello world!"). The `directlySentBlockKeys` set tracks what's been sent to prevent duplicates:

```typescript
// CCSDK scenario: blockStreamingEnabled=false, onBlockReply callback exists
} else if (params.opts?.onBlockReply) {
  directlySentBlockKeys.add(createPayloadKey(blockPayload));
  await params.opts.onBlockReply(blockPayload);
}
```

### 4. Provider-Specific Session IDs

Different runtimes track sessions differently:
```typescript
// Store session ID with provider key
await storeSessionId({
  sessionId: cliSessionId,
  provider: isCcsdkRun ? "ccsdk" : providerUsed,
});
```

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Failover loop bugs | Medium | Extensive test coverage |
| Dedup false positives | Medium | Normalization tests |
| Config validation gaps | Low | Zod superRefine checks |
| Session ID confusion | Medium | Provider-keyed storage |

## Dependencies

- PR 3: AgentRuntime Interface (for `AgentRuntime` type)

## Testing Strategy

```typescript
describe("UnifiedRuntimeAdapter", () => {
  it("executes primary slot first");
  it("fails over to next slot on eligible error");
  it("rethrows abort errors immediately");
  it("applies cooldown on rate limit");
  it("tracks all attempts in result");
});

describe("PayloadNormalization", () => {
  it("normalizes whitespace");
  it("creates consistent keys for same content");
  it("handles cumulative CCSDK patterns");
});

describe("CallbackWiring", () => {
  it("forwards onBlockReply when streaming disabled");
  it("forwards onBlockReplyFlush as no-op signal");
  it("forwards onReasoningStream");
});
```

## Rollback Strategy

1. Revert auto-reply pipeline files
2. Restore `runWithModelFallback` usage
3. Remove unified adapter files
4. Runtime config fields ignored if unused

## Backward Compatibility

- Default runtime is "pi" - existing behavior unchanged
- `runWithModelFallback` still exists but deprecated
- Config without `runtime` field works (implicit "pi")

---

*Estimated Review Time: 60 minutes*
*Merge Complexity: Medium-High (execution flow changes)*
