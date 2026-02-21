# Gap Analysis

> Design requirements vs current implementation

This document provides a detailed comparison of what the design specifies versus what currently exists, with clear action items.

**Verified against code:** 2026-02-01
**Canonical keys/terms:** `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`

---

## Summary Matrix

| Feature Area | Design Status | Implementation | Gap |
|--------------|---------------|----------------|-----|
| Settings navigation | ✅ Specified | ✅ Complete | None |
| Model & Provider page | ✅ Specified | ✅ Substantial | Remaining gaps are mostly capability-gating + fallback reordering + auth pairing polish |
| Agent list/cards | ✅ Specified | ✅ Complete | None |
| Agent Overview tab | ✅ Specified | ✅ Complete | None |
| Agent Tools tab | ✅ Specified | ✅ Complete | None (toolset selector already exists) |
| Agent Basics/More composition tabs | ✅ Specified | ❌ Missing | Full implementation (Simple view default) |
| Agent behavior controls (Basics section + Full view panel) | ✅ Specified | ❌ Missing | Full implementation |
| Agent Memory tab | ✅ Specified | ❌ Missing | Full implementation |
| Agent Availability tab | ✅ Specified | ❌ Missing | Full implementation |
| Agent Advanced tab | ✅ Specified | ❌ Missing | Full implementation |
| Friendly labels | ✅ Specified | ❌ Missing | Full implementation |
| "Use default" toggles | ✅ Specified | ❌ Missing | Pattern + usage |
| Toolset management | ✅ Specified | ✅ Complete (frontend) | Backend RPC persistence still planned (see `apps/web/docs/plans/2026-02-01-toolset-api-implementation-guide.md`) |

---

## Detailed Gap Analysis

### 1. System-Wide Settings (Model & Provider Page)

#### Runtime Card
| Requirement | Status | Notes |
|-------------|--------|-------|
| Pi vs SDK toggle | ✅ Present | Implemented in `ModelProviderSection.tsx` |
| Helper text explaining difference | ✅ Present | Short copy exists; expand via terminology/copy guidelines if needed |

#### System Brain Card
| Requirement | Status | Notes |
|-------------|--------|-------|
| Card visibility | ✅ Present | Implemented (marked Advanced) |
| Runtime override | ✅ Present | |
| Model/provider override | ✅ Present | |
| CCSDK provider override | ✅ Present | Shown when runtime is CCSDK |
| Helper text | ✅ Present | Keep aligned with canonical terms |

#### Heartbeat Card
| Requirement | Status | Notes |
|-------------|--------|-------|
| Card visibility | ✅ Present | Implemented as collapsible in `ModelProviderSection.tsx` |
| Schedule selector | 🔶 Partial | Schedule/active hours are displayed; editing may be limited or “coming soon” |
| Active hours | 🔶 Partial | See above |
| Heartbeat model selector | 🔶 Partial | Model is displayed; editing may be limited |
| Escalation toggle (experimental) | 🔶 Stubbed | UI shows “Coming soon” |

#### Providers & Auth
| Requirement | Status | Notes |
|-------------|--------|-------|
| Provider cards grid | ✅ Complete | In ModelProviderSection |
| Status indicators | ✅ Complete | Connected/Missing |
| API key input + test | ✅ Complete | — |
| OAuth (browser) flow | ❌ Missing | MVP target for OpenAI/Anthropic/Gemini; needs gateway endpoints + callback handling |
| CLI pairing | ❌ Missing | Requires backend |
| Advanced options (collapsed) | ❓ Unknown | Need to verify |

#### Default Models & Fallbacks
| Requirement | Status | Notes |
|-------------|--------|-------|
| Default text model | ✅ Complete | — |
| Default image model | ✅ Complete | — |
| Fallbacks drag list | ❌ Missing | Fallbacks exist (display only); reorder/edit UI is future work |
| Advanced model options | 🔶 Partial | Depends on provider/model capability gating work |

#### Global Behavior
| Requirement | Status | Notes |
|-------------|--------|-------|
| Streaming toggle | ✅ Present (Advanced) | Gated behind Expert Mode |
| Creativity slider | ✅ Present (Advanced) | Uses internal param key `temperature` under model params |
| Response length slider | ✅ Present (Advanced) | Uses internal param key `maxTokens` under model params |
| Advanced streaming options | 🔶 Partial | Some knobs exist in core config; UI gating needed |

---

### 2. Per-Agent Configuration

#### Agent Detail Tabs

This UX plan has two “layers” of agent navigation:
1) **Simple view**: primary composition tabs (**Basics**, **More**)
2) **Full view** (Expert Mode or per-page override): explicit tabs (Overview/Behavior/Tools/...)

| Surface | Specified | Implemented | Gap |
|---------|-----------|-------------|-----|
| Basics (composition) | ✅ | ❌ | **Full implementation needed** |
| More (composition) | ✅ | ❌ | **Full implementation needed** |
| Overview (full view) | ✅ | ✅ | Minor: Add defaults summary |
| Behavior (full view) | ✅ | ❌ | **Full implementation needed** |
| Tools (full view) | ✅ | ✅ | None |
| Memory (full view) | ✅ | ❌ | **Full implementation needed** |
| Availability (full view) | ✅ | ❌ | **Full implementation needed** |
| Advanced (full view) | ✅ | ❌ | **Full implementation needed** |
| Activity (full view) | ✅ | ✅ | None |
| Workstreams (existing feature) | ✅ | ✅ | None (may move under More in Simple view) |
| Rituals (existing feature) | ✅ | ✅ | None (may move under More in Simple view) |
| Soul (existing feature) | ✅ | ✅ | None (may move under More in Simple view) |

#### Behavior Controls (Missing)

```
Required Controls:
┌─────────────────────────────────────────────────────────────┐
│ Behavior (Basics quick section + Full view panel)           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [✓] Use system default                                     │
│                                                             │
│  Creativity                                           [?]   │
│  Lower is more precise. Higher is more creative.            │
│  ──────────●────────── 0.7                                  │
│                                                             │
│  Response length                                      [?]   │
│  Higher allows longer replies.                              │
│  ────────────────●──── Long                                 │
│                                                             │
│  Streaming replies                                   [ON]   │
│  Show responses as they're generated.                       │
│                                                             │
│  Speed vs Depth                               [Fast][Deep]  │
│  Faster replies or deeper reasoning.                        │
│                                                             │
│  ▶ Advanced                                                 │
│    └── Model override                                       │
│    └── Runtime override                                     │
│    └── CCSDK provider override                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Action:** Create `AgentBehaviorPanel.tsx`

#### Memory Tab (Missing)

```
Required Controls:
┌─────────────────────────────────────────────────────────────┐
│ Memory                                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Memory                                              [ON]   │
│  Remember context from past conversations.                  │
│                                                             │
│  Memory depth                                               │
│  How much past context to keep.                             │
│  [Short]  [Balanced]  [Deep]                                │
│                                                             │
│  ▶ Advanced                                                 │
│    └── Memory cleanup mode                                  │
│    └── Memory lifespan                                      │
│    └── Summarize long chats                                 │
│    └── Summary trigger threshold                            │
│    └── Memory search provider                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Action:** Create `AgentMemoryPanel.tsx`

#### Availability Tab (Missing)

```
Required Controls:
┌─────────────────────────────────────────────────────────────┐
│ Availability                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Quiet hours                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [=========]          [===========]                  │   │
│  │ 10pm ─────────────── 8am                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [✓] Auto-pause outside quiet hours                        │
│                                                             │
│  Time zone: America/Los_Angeles (PST)              [Edit]  │
│                                                             │
│  ▶ Advanced                                                 │
│    └── Per-agent heartbeat schedule                        │
│    └── Heartbeat target                                    │
│    └── Heartbeat prompt override                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Action:** Create `AgentAvailabilityPanel.tsx`

#### Advanced Tab (Missing)

```
Required Controls:
┌─────────────────────────────────────────────────────────────┐
│ Advanced                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Runtime override                                           │
│  ○ Use system default (Pi)                                  │
│  ○ Pi (recommended)                                         │
│  ○ Claude Code SDK                                          │
│                                                             │
│  Sandbox                                             [ON]   │
│  Sandbox scope: [Workspace only ▼]                          │
│  Workspace access: [Select folders...]                      │
│                                                             │
│  Group chat settings                                        │
│  [Configure group behaviors...]                             │
│                                                             │
│  Sub-agent defaults                                         │
│  Model: [Inherit ▼]                                         │
│  Max concurrent: [3]                                        │
│                                                             │
│  Raw configuration                              [View/Edit] │
│  ⚠️ For advanced users only                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Action:** Create `AgentAdvancedPanel.tsx`

---

### 3. UX Patterns

#### Friendly Labels

| Current State | Required State |
|---------------|----------------|
| Uses technical terms | Use friendly labels everywhere |
| No helper text | Helper text on all controls |
| No tooltips | Technical term in tooltip |

**Action:** Create `src/lib/terminology.ts` with mappings

#### "Use System Default" Toggle

| Current State | Required State |
|---------------|----------------|
| Not implemented | On every per-agent override |
| — | Visual distinction for inherited vs custom |
| — | One-click reset to default |

**Action:** Create `SystemDefaultToggle.tsx` pattern component

#### Progressive Disclosure

| Current State | Required State |
|---------------|----------------|
| Some accordions | Consistent Advanced accordion pattern |
| No expert mode | Global expert mode toggle |
| Mixed visibility | Layer 1/2/3/4 visibility rules |

**Action:** Implement consistent accordion pattern, wire expert mode

---

### 4. Toolset Integration

| Requirement | Status | Notes |
|-------------|--------|-------|
| ToolsetsSection in settings | ✅ Created | Untracked file |
| ToolsetEditor | ✅ Created | Untracked file |
| Built-in presets | 🔶 Likely | Need to verify |
| Toolset selector in AgentToolsTab | ❌ Missing | — |
| Read-only mode when using preset | ❌ Missing | — |

**Action:** Add toolset dropdown to `AgentToolsTab.tsx`

---

## Priority Matrix

### P0: Core Missing Features (Blocks basic UX)

1. `AgentBehaviorPanel.tsx` — Primary config surface
2. `src/lib/terminology.ts` — Enables friendly UI
3. `SystemDefaultToggle.tsx` — Core UX pattern

### P1: Complete Agent Config (Full feature parity)

4. `AgentMemoryPanel.tsx`
5. `AgentAvailabilityPanel.tsx`
6. `AgentAdvancedPanel.tsx`
7. Provider/runtime capability gating (show only supported power knobs)
8. Heartbeat editing UX (if/when the backend supports it end-to-end)

### P2: Polish & Integration

9. Fallbacks drag/reorder + edit UI
10. OAuth/CLI pairing flows
11. Expert mode: global “what changes” documentation and consistent behavior
12. Import/export and raw config editing (power user escape hatch)

### P3: Nice-to-Have

13. Advanced streaming options
14. Model aliases and routing
15. Additional provider-specific advanced knobs (capability-gated)

---

## Estimated Effort

| Item | Complexity | Estimate |
|------|------------|----------|
| `AgentBehaviorPanel.tsx` | Medium | 4-6 hours |
| `AgentMemoryPanel.tsx` | Medium | 4-6 hours |
| `AgentAvailabilityPanel.tsx` | Medium-High | 6-8 hours |
| `AgentAdvancedPanel.tsx` | High | 8-12 hours |
| `terminology.ts` | Low | 2-3 hours |
| `SystemDefaultToggle.tsx` | Low | 2-3 hours |
| Capability gating (provider/runtime) | High | 10-18 hours |
| Fallback reorder/edit UI | Medium | 6-10 hours |
| OAuth/CLI pairing UX (frontend-only) | Medium | 6-10 hours |

**Total estimated (docs-only planning):** This table is intentionally conservative; use the roadmap’s “Complexity + Code Surface” scoring to budget realistically.

---

## Edge Cases (Tracked, Not Solved Here)

See `apps/web/ux-opus-design/EDGE-CASES.md` for the full inventory of known edge cases and long-tail requirements.
