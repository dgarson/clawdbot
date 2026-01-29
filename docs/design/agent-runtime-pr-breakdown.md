# Agent Runtime Refactor: PR Breakdown Analysis

## Executive Summary

This document analyzes the large PR on branch `dgarson/agent-runtime-claude-code-support` and proposes breaking it into 5 smaller, reviewable PRs. The original PR contains **105 files changed** with **14,757 insertions** and **1,098 deletions**.

## Goals of the Original PR

1. Introduce an `AgentRuntime` abstraction that allows multiple agent backends
2. Implement a second runtime using the Claude Code SDK (CCSDK)
3. Support runtime failover and multi-provider authentication
4. Maintain backward compatibility with existing Pi agent

## Change Categories

| Category | Files Changed | Description |
|----------|---------------|-------------|
| Tool Schema Descriptions | 13 | Add descriptions to all tool properties |
| Session Adapters | 5 | New session abstraction layer |
| Core Runtime Interface | 8 | AgentRuntime interface + Pi implementation |
| Unified Adapter + Config | 12 | Failover orchestration + config schema |
| Claude SDK Runtime | 20+ | Full CCSDK integration |
| Auto-Reply Pipeline | 8 | Unified runner adoption |
| UI Changes | 12 | Phase-aware streaming + error states |
| Gateway/Server | 3 | Chat streaming + broadcast logic |
| Credential Management | 2 | Multi-platform credential storage |

## Proposed PR Split

### PR 1: Tool Schema Descriptions (Low Risk, Independent)
**Files:** 13 tool files in `src/agents/tools/`
**Risk:** None - additive only, no runtime changes
**Dependencies:** None
**Rationale:** Purely additive schema documentation. Can merge immediately.

### PR 2: Session Adapter Abstraction (Medium Risk, Foundation)
**Files:** 5 new files in `src/agents/sessions/`
**Risk:** Low - new code, no existing behavior changed
**Dependencies:** None
**Rationale:** Creates normalized session interface. Required before runtime implementations.

### PR 3: AgentRuntime Interface + Pi Runtime (Medium Risk, Core)
**Files:** ~12 files including interface, Pi runtime, factory, result types
**Risk:** Medium - introduces new abstraction but Pi behavior unchanged
**Dependencies:** PR 2 (session adapters)
**Rationale:** Establishes the runtime contract. Pi implementation validates the interface.

### PR 4: Unified Runtime Adapter + Config (Medium Risk, Integration)
**Files:** ~15 files including adapter, config, auto-reply pipeline
**Risk:** Medium - changes execution flow but defaults to existing behavior
**Dependencies:** PR 3 (AgentRuntime interface)
**Rationale:** Adds failover orchestration and configuration. No CCSDK yet.

### PR 5: Claude Code SDK Runtime + UI (Higher Risk, Feature)
**Files:** 25+ files including SDK runtime, UI changes, gateway streaming
**Risk:** Higher - new runtime + UI streaming changes
**Dependencies:** PR 4 (unified adapter)
**Rationale:** Complete CCSDK integration. Isolated from core if issues arise.

## Changes NOT in Scope for Multi-Runtime

The following changes appear to be **independent fixes or improvements** that could be extracted:

1. **Telegram empty reply handling** (`fix: avoid silent telegram empty replies`)
2. **XML escaping test fix** for Windows NTFS compatibility
3. **Mention pattern checking** even when explicit mention available
4. **AccountId inclusion** in Telegram native command context
5. **Video note support** in Telegram channel
6. **Memory search paths config** enhancement

These could be cherry-picked to main independently.

## UX Changes Assessment

All 12 UI file changes were analyzed and found to be **required for multi-runtime support**:

| UI Component | Purpose |
|--------------|---------|
| Phase streaming CSS | Visual separation of thinking vs text |
| Tool error states | Display tool failures from CCSDK |
| State management | Track thinking + phases in Lit components |
| Chat controller | Parse phase-structured content |
| Grouped render | Render phases with proper styling |

**Conclusion:** UI changes are NOT workarounds; they implement necessary streaming semantics for runtimes with extended thinking.

## Risk Assessment

| PR | Risk Level | Rollback Strategy |
|----|------------|-------------------|
| 1 | Minimal | Remove schema descriptions |
| 2 | Low | Delete session adapter files |
| 3 | Medium | Revert to direct Pi calls |
| 4 | Medium | Disable unified adapter, use Pi directly |
| 5 | Higher | Disable CCSDK runtime in config |

## Recommended Merge Order

```
PR 1 (Tool Schemas)     ─┬─> Can merge immediately
                         │
PR 2 (Session Adapters)  │
         │               │
         v               │
PR 3 (Runtime + Pi)      │
         │               │
         v               │
PR 4 (Unified + Config) <┘
         │
         v
PR 5 (CCSDK + UI)
```

## Testing Strategy

Each PR should include:
- Unit tests for new code
- Integration tests where applicable
- Manual verification that existing behavior unchanged

**Critical verification for each PR:**
1. `pnpm build` passes
2. `pnpm test` passes
3. Existing agent functionality works (Pi runtime)
4. No regression in message routing

## Open Questions

1. Should credential management changes go in PR 4 or PR 5?
2. Should gateway streaming changes be split from UI changes?
3. Is the tool event logging centralization blocking or nice-to-have?

---

*Generated: 2026-01-29*
*Branch: dgarson/agent-runtime-claude-code-support*
