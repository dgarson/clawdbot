# UTEE Phase-1 Canary Readiness Package

**Generated:** 2026-02-21
**Branch:** `sandy/utee-phase1-observability`
**Worktree:** `/Users/openclaw/openclaw/worktrees/utee-phase1`
**Status:** READY FOR CANARY (prep only - do not execute)

---

## 1. Phase-1 Guardrails Confirmation

### ✅ Guardrail Verification

| Guardrail | Status | Evidence |
|-----------|--------|----------|
| **Pass-through payload behavior** | ✅ VERIFIED | `wrapExecuteWithUtee()` returns original result unchanged; errors re-thrown as-is |
| **Feature-flag default-off** | ✅ VERIFIED | `uteeEnabled = false` by default; `enabled?: boolean` in config defaults to `false` |
| **Rollback path** | ✅ VERIFIED | `disableUtee()` runtime toggle; config reload with `kind: "none"` (no restart) |
| **No Phase-2+ features** | ✅ VERIFIED | No retry, idempotency, or capability negotiation code present |

### Code Evidence

**Pass-through (lines 299-304 in utee-adapter.ts):**
```typescript
// Return original result unchanged (pass-through)
return result;
```
```typescript
// Re-throw original error unchanged (pass-through)
throw err;
```

**Feature-flag default-off (line 108):**
```typescript
let uteeEnabled = false;
```

**Runtime toggle (lines 119-133):**
```typescript
export function enableUtee(): void { ... }
export function disableUtee(): void { ... }
export function setUteeEnabled(enabled: boolean): void { ... }
```

**No Phase-2+ (header comment lines 9-11):**
```typescript
 * Guardrails (strict):
 *   - No behavior changes to existing tool result/error payloads
 *   - No retry/idempotency/capability negotiation (Phase 2+)
```

---

## 2. 5%/48h Canary Runbook

### 2.1 Configuration

**Config file:** `openclaw.config.json` (or equivalent YAML/TOML)

**Config keys:**
```json
{
  "utee": {
    "enabled": true,
    "logLevel": "debug",
    "metrics": {
      "enabled": true
    },
    "tracePropagation": {
      "enabled": true
    }
  }
}
```

**Config type definition:** `/Users/openclaw/openclaw/worktrees/utee-phase1/src/config/types.utee.ts`

**Zod schema:** `/Users/openclaw/openclaw/worktrees/utee-phase1/src/config/zod-schema.utee.ts`

### 2.2 Enable/Disable Commands

**Enable UTEE (canary start):**
```bash
# Option A: Config file edit
echo '{"utee": {"enabled": true}}' | jq -s '.[0] * .[1]' openclaw.config.json > tmp && mv tmp openclaw.config.json

# Option B: Environment variable (if supported)
OPENCLAW_UTEE_ENABLED=true openclaw gateway restart

# Option C: Runtime toggle via admin API (if available)
curl -X POST http://localhost:3000/admin/config -d '{"utee": {"enabled": true}}'
```

**Disable UTEE (rollback):**
```bash
# Option A: Config file edit
echo '{"utee": {"enabled": false}}' | jq -s '.[0] * .[1]' openclaw.config.json > tmp && mv tmp openclaw.config.json

# Option B: Hot reload (no restart needed - config reload rule: { prefix: "utee", kind: "none" })
# After config edit, UTEE will be disabled on next config reload
```

**Verify UTEE state:**
```bash
# Check logs for UTEE state
grep -i "\[UTEE\]" /var/log/openclaw/gateway.log | tail -5

# Expected when enabled:
# [UTEE] Phase 1 initialized from config
# [UTEE] Phase 1 enabled
```

### 2.3 Metrics/Logs to Monitor

**Log entries to watch:**
```
[UTEE] Phase 1 enabled                    # Startup confirmation
[UTEE] Phase 1 initialized from config    # Config load confirmation
[UTEE] utee_tool_invocation tool=...      # Per-tool invocation (debug level)
[UTEE] utee_tool_result tool=...          # Per-tool completion (debug level)
```

**Key log patterns:**
```bash
# Invocation count
grep -c "utee_tool_invocation" /var/log/openclaw/gateway.log

# Error count
grep -c 'utee_tool_result.*status="error"' /var/log/openclaw/gateway.log

# Sample invocations
grep "utee_tool_invocation" /var/log/openclaw/gateway.log | tail -20
```

**In-memory metrics (via code):**
```typescript
import { getUteeMetricsSnapshot } from "./utee-adapter.js";

const metrics = getUteeMetricsSnapshot();
// Returns:
// {
//   invocationCount: Record<string, number>,
//   errorCount: Record<string, number>,
//   avgDurationMs: Record<string, number>,
//   maxDurationMs: Record<string, number>
// }
```

**Monitoring checklist:**
- [ ] Tool invocation latency (compare pre/post canary)
- [ ] Error rates by tool (no increase expected)
- [ ] Gateway memory usage (in-memory maps bounded by tool count)
- [ ] Log volume increase (debug level, minimal impact)

### 2.4 Rollback Trigger Thresholds

**Immediate rollback triggers:**
| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate increase | >2% absolute increase | Rollback |
| P99 latency increase | >50ms per tool call | Rollback |
| Memory increase | >100MB sustained | Rollback |
| Crash/panic | Any | Rollback + investigate |
| Customer-visible behavior change | Any | Rollback |

**Warning thresholds (monitor closely):**
| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate increase | 0.5-2% | Increase monitoring |
| P99 latency increase | 20-50ms | Investigate |
| Log volume increase | >2x normal | Consider adjusting log level |

**Rollback procedure:**
1. Set `utee.enabled = false` in config
2. Trigger config reload (automatic on file change, or manual)
3. Verify logs show `[UTEE] Phase 1 disabled`
4. Confirm metrics stop accumulating
5. Document incident in post-mortem

### 2.5 Post-Canary Report Template

```markdown
# UTEE Phase-1 Canary Report

**Duration:** [start] to [end] ([hours] hours)
**Traffic:** ~[X]% of requests
**Environment:** [prod/staging]

## Summary
[Brief summary of canary outcome]

## Metrics

| Metric | Pre-Canary | During Canary | Delta |
|--------|------------|---------------|-------|
| Avg tool latency | [X]ms | [Y]ms | [+/-Z]ms |
| P99 tool latency | [X]ms | [Y]ms | [+/-Z]ms |
| Error rate | [X]% | [Y]% | [+/-Z]% |
| Memory usage | [X]MB | [Y]MB | [+/-Z]MB |
| Log volume | [X]MB/h | [Y]MB/h | [+/-Z]% |

## Observability Verification

- [ ] Structured logs present for tool invocations
- [ ] Request IDs generated and logged
- [ ] Trace IDs propagated across async boundaries
- [ ] Metrics collected (invocation counts, error counts, durations)
- [ ] No customer-visible behavior changes

## Issues Encountered

| Issue | Severity | Resolution |
|-------|----------|------------|
| [Description] | [Critical/High/Medium/Low] | [How resolved] |

## Recommendations

- [ ] Promote to 100% traffic
- [ ] Extend canary duration
- [ ] Address issues before promotion
- [ ] Rollback and rework

## Appendix

### Sample Log Entries
```
[paste representative log entries]
```

### Metrics Snapshot
```
[paste getUteeMetricsSnapshot() output]
```
```

---

## 3. Targeted Tests

### Test Execution Results

**Command:**
```bash
cd /Users/openclaw/openclaw/worktrees/utee-phase1
npx vitest run src/agents/utee-adapter.test.ts
```

**Output:**
```
 RUN  v4.0.18 /Users/openclaw/openclaw/worktrees/utee-phase1

 ✓ src/agents/utee-adapter.test.ts (28 tests) 280ms

 Test Files  1 passed (1)
      Tests  28 passed (28)
   Start at  16:06:56
   Duration  525ms
```

### Critical Test Cases

| Test | Purpose | Status |
|------|---------|--------|
| `should start disabled` | Verify default-off | ✅ PASS |
| `should pass through when UTEE is disabled` | Verify zero-overhead when off | ✅ PASS |
| `should wrap execution when UTEE is enabled` | Verify wrapping works | ✅ PASS |
| `should preserve original error when wrapping` | Verify pass-through on error | ✅ PASS |
| `should not change result when wrapping` | Verify pass-through on success | ✅ PASS |
| `should be able to disable during runtime` | Verify rollback path | ✅ PASS |
| `should wrap tools created while disabled and pick up enable later` | **CRITICAL: Runtime toggle** | ✅ PASS |
| `should handle multiple enable/disable cycles` | Verify toggle stability | ✅ PASS |
| `should add minimal overhead when enabled (<1ms per call)` | Performance gate | ✅ PASS |

### Manual Verification Commands

```bash
# 1. Verify feature flag default
cd /Users/openclaw/openclaw/worktrees/utee-phase1
grep -n "let uteeEnabled" src/agents/utee-adapter.ts
# Expected: let uteeEnabled = false;

# 2. Verify pass-through behavior
grep -n "pass-through" src/agents/utee-adapter.ts
# Expected: 2 matches (return result; throw err;)

# 3. Verify no Phase-2+ features
grep -n "retry\|idempoten\|negotiation" src/agents/utee-adapter.ts
# Expected: Only in comments, no implementation

# 4. Verify config integration
grep -n "initUteeFromConfig\|updateUteeFromConfig" src/gateway/server.impl.ts src/gateway/server-reload-handlers.ts
# Expected: Both present and wired

# 5. Verify reload rule
grep -n "utee" src/gateway/config-reload.ts
# Expected: { prefix: "utee", kind: "none" }
```

---

## 4. Final Handoff

### Absolute File Paths

**Core Implementation:**
- `/Users/openclaw/openclaw/worktrees/utee-phase1/src/agents/utee-adapter.ts` - Main adapter (547 lines)
- `/Users/openclaw/openclaw/worktrees/utee-phase1/src/agents/utee-init.ts` - Config initialization (33 lines)
- `/Users/openclaw/openclaw/worktrees/utee-phase1/src/agents/utee-adapter.test.ts` - Test suite (381 lines)

**Configuration:**
- `/Users/openclaw/openclaw/worktrees/utee-phase1/src/config/types.utee.ts` - Config types (40 lines)
- `/Users/openclaw/openclaw/worktrees/utee-phase1/src/config/zod-schema.utee.ts` - Config schema (42 lines)

**Integration Points:**
- `/Users/openclaw/openclaw/worktrees/utee-phase1/src/agents/pi-tool-definition-adapter.ts` - Tool wrapping (line 11: wrapExecuteWithUtee import)
- `/Users/openclaw/openclaw/worktrees/utee-phase1/src/gateway/server.impl.ts` - Startup init (line: initUteeFromConfig)
- `/Users/openclaw/openclaw/worktrees/utee-phase1/src/gateway/server-reload-handlers.ts` - Hot reload (line: updateUteeFromConfig)
- `/Users/openclaw/openclaw/worktrees/utee-phase1/src/gateway/config-reload.ts` - Reload rule (prefix: "utee", kind: "none")

### Git Information

```
Branch: sandy/utee-phase1-observability
Base: main
Commits ahead: 3
  - b6b956e13 feat(utee): Phase 1 observability pass-through adapter layer
  - c1bfa5367 fix(utee): address Phase 1 blocking issues
  - 4b27a0f5b fix(utee): ESM-safe AsyncLocalStorage loading
```

### Blockers

**None.** All Phase-1 requirements met:

- ✅ Pass-through payload behavior verified
- ✅ Feature-flag default-off verified
- ✅ Rollback path verified (runtime toggle + hot reload)
- ✅ No Phase-2+ features present
- ✅ Config integration wired
- ✅ 28/28 tests passing
- ✅ Performance overhead <1ms per call

### Canary Prerequisites Checklist

- [x] Branch created and pushed to remote
- [x] All tests passing
- [x] Feature flag default-off
- [x] Hot reload support (no restart needed)
- [x] Rollback path tested
- [ ] PR created and approved (pending)
- [ ] Staging environment test (pending)
- [ ] Monitoring dashboards configured (pending)
- [ ] Alert thresholds configured (pending)
- [ ] On-call engineer briefed (pending)

### Recommended Canary Timeline

```
Day 0 (T-0):  Merge PR to main
Day 0 (T+1h): Deploy to staging, verify UTEE logs present
Day 1 (T+24h): Deploy to 5% canary in production
Day 3 (T+72h): Review metrics, expand to 25% if healthy
Day 5 (T+120h): Review metrics, expand to 100% if healthy
Day 7 (T+168h): Close canary, document lessons learned
```

### Emergency Contacts

- **On-call:** [TBD - assign before canary start]
- **Code owner:** @dgarson
- **Slack channel:** #eng-utee-canary (create if not exists)

---

## Appendix: Key Code Snippets

### Feature Flag Toggle
```typescript
// src/agents/utee-adapter.ts
let uteeEnabled = false;

export function isUteeEnabled(): boolean {
  return uteeEnabled;
}

export function enableUtee(): void {
  uteeEnabled = true;
  logInfo("[UTEE] Phase 1 enabled");
}

export function disableUtee(): void {
  uteeEnabled = false;
  logInfo("[UTEE] Phase 1 disabled");
}
```

### Pass-Through Wrapper
```typescript
// src/agents/utee-adapter.ts
const wrapper = async (...args: any[]): Promise<any> => {
  // If UTEE is disabled, pass through without any overhead
  if (!uteeEnabled) {
    return (execute as (...args: unknown[]) => unknown)(...args);
  }
  // ... observability code ...
  try {
    const result = await runWithUteeContext(ctx, () =>
      (execute as (...args: unknown[]) => unknown)(...args),
    );
    // Return original result unchanged (pass-through)
    return result;
  } catch (err) {
    // Re-throw original error unchanged (pass-through)
    throw err;
  }
};
```

### Config Schema
```typescript
// src/config/zod-schema.utee.ts
export const UteeSchema = z
  .object({
    enabled: z.boolean().optional(),
    logLevel: z.enum(["debug", "info", "warn", "error"]).optional(),
    metrics: z.object({ enabled: z.boolean().optional() }).strict().optional(),
    tracePropagation: z.object({ enabled: z.boolean().optional() }).strict().optional(),
  })
  .strict()
  .optional();
```

---

**Document version:** 1.0
**Last updated:** 2026-02-21 16:07 MST
**Author:** Sandy (subagent recovery run)
