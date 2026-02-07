# Implementation Roadmap

> Phased build plan with file paths and dependencies

**Verified against code:** 2026-02-01
**Canonical keys/terms + scope boundary:** `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`
**Edge cases inventory:** `apps/web/ux-opus-design/EDGE-CASES.md`

---

## Overview

This roadmap breaks implementation into 6 phases, organized by dependency and impact. Each phase builds on the previous, allowing for incremental delivery and testing.

### Scoring Definitions (for realistic planning)

- **Complexity (1-5)**: 1=trivial change, 3=normal feature work, 5=multi-surface + tricky semantics.
- **Code Surface**:
  - XS: 1 file
  - S: 2-3 files
  - M: 4-7 files
  - L: 8+ files or cross-cutting concerns
- **Est. LOC**: rough net-new LOC range (not counting formatting).

### Reality Snapshot (Already Implemented in apps/web)

As of 2026-02-01, the following are already present in `apps/web/src` and should be treated as baseline:
- Toolsets management UI: `settings/ToolsetsSection.tsx` + editor.
- Per-agent toolset selection + read-only mode: `agents/AgentToolsTab.tsx`.
- Model & Provider page already includes: Default runtime, System Brain, Default Models (with fallbacks display), Heartbeat (partially editable / partially stubbed), and Global Behavior (Advanced, gated behind Expert Mode): `settings/ModelProviderSection.tsx`.
- Command palette + keyboard shortcuts infrastructure exists (power user workflow surface).

This roadmap focuses on what is missing (Basics/More composition surfaces, per-agent behavior/memory/availability/advanced panels, terminology normalization, and capability gating).

---

## Phase 0: Foundation (Target: 2-4 days)

**Goal:** Create shared utilities and patterns that all subsequent work depends on (and align on canonical naming).

### Tasks

| Task | File | Complexity (1-5) | Code Surface | Est. LOC | Estimate | Dependencies |
|------|------|-------------------|-------------|----------|----------|--------------|
| Create terminology mapping utility (internal keys → friendly labels) | `src/lib/terminology.ts` | 2 | S | 150-300 | 0.5-1d | None |
| Create `SystemDefaultToggle` pattern component | `src/components/ui/system-default-toggle.tsx` | 3 | S | 150-250 | 1d | None |
| Create `FriendlySlider` wrapper (label + helper + tooltip + presets) | `src/components/ui/friendly-slider.tsx` | 3 | S | 150-250 | 1d | shadcn Slider |
| Create `SegmentedControl` wrapper | `src/components/ui/segmented-control.tsx` | 2 | XS | 80-150 | 0.5d | None |
| Create canonical copy source file | `apps/web/ux-opus-design/COPY.md` | 1 | XS | - | 0.5d | None |
| Create Storybook setup plan (doc) | `apps/web/ux-opus-design/STORYBOOK-PLAN.md` | 1 | XS | - | 0.5d | None |
| Create canonical testing strategy | `apps/web/ux-opus-design/TESTING-STRATEGY.md` | 2 | XS | - | 0.5-1d | None |
| Decide and document E2E runner setup | `apps/web/ux-opus-design/TESTING-STRATEGY.md` | 1 | XS | - | 0.25d | Playwright runner |

### Deliverables

- `src/lib/terminology.ts` — Label mappings and helper text
- `src/components/ui/system-default-toggle.tsx`
- `src/components/ui/friendly-slider.tsx`
- `src/components/ui/segmented-control.tsx`

### Definition of Done

- [ ] All components have TypeScript interfaces
- [ ] Terminology mapping is based on canonical internal keys (no provider API field names like `max_tokens`)
- [ ] Components follow existing design patterns

---

## Phase 1: Agent Detail "Basics + More" + Behavior Quick Controls (Target: 4-8 days)

**Goal:** Deliver the non-technical default: **Basics + More** tab model, per-page Simple/Full override, and the “90% behavior controls” surfaced in Basics.

### Tasks

| Task | File | Complexity (1-5) | Code Surface | Est. LOC | Estimate | Dependencies |
|------|------|-------------------|-------------|----------|----------|--------------|
| Add Basics + More view model + per-page “Simple/Full” override toggle | `src/routes/agents/$agentId.tsx` | 4 | M | 250-600 | 2-4d | Phase 0 |
| Create `AgentBasicsTab` (composition wrapper around existing surfaces) | `src/components/domain/agents/AgentBasicsTab.tsx` | 4 | M | 350-700 | 2-3d | Phase 0 |
| Create `AgentMoreTab` (composition + deep links to full surfaces) | `src/components/domain/agents/AgentMoreTab.tsx` | 3 | S | 200-450 | 1-2d | Phase 0 |
| Create `AgentBehaviorSection` (inherit vs override + presets + guardrails) | `src/components/domain/agents/AgentBehaviorSection.tsx` | 4 | M | 350-650 | 2-3d | Phase 0 |
| Wire mutations + config patching semantics | `src/hooks/mutations/useAgentMutations.ts` | 4 | S | 150-300 | 1-2d | AgentBehaviorSection |
| Add config-path helpers (canonical internal keys + override semantics) | `src/lib/agent-config-paths.ts` | 3 | S | 150-250 | 1d | terminology.ts |

### Deliverables

- `src/components/domain/agents/AgentBasicsTab.tsx`
- `src/components/domain/agents/AgentMoreTab.tsx`
- `src/components/domain/agents/AgentBehaviorSection.tsx`
- Updated `src/routes/agents/$agentId.tsx` (Simple/Full + tab routing)
- `src/lib/agent-config-paths.ts`

### Definition of Done

- [ ] Agent detail defaults to `?tab=basics` / `?tab=more` for non-experts
- [ ] Per-page View override (Simple/Full) works and does not persist globally
- [ ] Basics surfaces: Creativity, Response length, Streaming (with presets + guardrails)
- [ ] "Use system default" toggle works and explains inheritance
- [ ] Changes persist to config (drafts preserved on failure)

---

## Phase 2: Remaining Per-Agent Panels (Target: 6-12 days)

**Goal:** Complete the remaining per-agent panels for Full view (Behavior/Memory/Availability/Advanced + raw config escape hatch).

### Tasks

| Task | File | Complexity (1-5) | Code Surface | Est. LOC | Estimate | Dependencies |
|------|------|-------------------|-------------|----------|----------|--------------|
| Create `AgentBehaviorPanel` (Full view surface; may reuse `AgentBehaviorSection`) | `src/components/domain/agents/AgentBehaviorPanel.tsx` | 3 | S | 150-350 | 1-2d | Phase 1 |
| Create `AgentMemoryPanel` (incl. provider capability gating for advanced knobs) | `src/components/domain/agents/AgentMemoryPanel.tsx` | 4 | M | 350-700 | 2-4d | Phase 0 |
| Create `AgentAvailabilityPanel` (quiet hours details, schedules, heartbeat overrides) | `src/components/domain/agents/AgentAvailabilityPanel.tsx` | 4 | M | 300-650 | 2-4d | Phase 0 |
| Create `RawConfigEditor` (view/copy/download + validation UX) | `src/components/domain/config/raw-config-editor.tsx` | 4 | M | 300-600 | 2-3d | None |
| Create `AgentAdvancedPanel` (runtime/sandbox/group chat + raw config) | `src/components/domain/agents/AgentAdvancedPanel.tsx` | 5 | L | 500-900 | 3-5d | RawConfigEditor |
| Add Full view tabs + URL state | `src/routes/agents/$agentId.tsx` | 3 | S | 120-250 | 1-2d | Panels |
| Add power-user workflows: Clone, Diff, Overrides management | Agent detail surfaces | 5 | L | 400-900 | 3-6d | Raw config + config paths |

### Deliverables

- `src/components/domain/agents/AgentMemoryPanel.tsx`
- `src/components/domain/config/raw-config-editor.tsx`
- `src/components/domain/agents/AgentAdvancedPanel.tsx`
- Updated `src/routes/agents/$agentId.tsx`

### Definition of Done

- [ ] Memory tab: toggle, depth, pruning, compaction
- [ ] Availability tab: heartbeat overrides + quiet hours UI (Focus-mode presets; underlying config keys may be staged if schema is still evolving)
- [ ] Advanced tab: runtime, sandbox, group chat, raw config
- [ ] All tabs save correctly
- [ ] All tabs show "use system default" appropriately

---

## Phase 3: Capability Gating + Provider Knobs (Target: 5-10 days)

**Goal:** Ensure power knobs are shown only when supported by the selected runtime/model/provider.

### Tasks

| Task | File | Complexity (1-5) | Code Surface | Est. LOC | Estimate | Dependencies |
|------|------|-------------------|-------------|----------|----------|--------------|
| Define model/runtime capability declaration returned to the web UI | Gateway + web types | 5 | L | 300-800 | 3-6d | Canonical keys |
| Update agent panels + system settings to gate controls consistently | Various | 4 | L | 300-700 | 2-4d | Capability declaration |

### Deliverables

- A consistent gating rule: hide vs disable (documented + applied).
- UI copy for “why this is unavailable” per gated knob.

### Definition of Done

- [ ] No “unsupported” knobs are editable without explanation
- [ ] Expert Mode reveals additional knobs only when supported

---

## Phase 4: Friendly Labels Rollout (Target: 3-6 days)

**Goal:** Apply friendly terminology throughout the UI.

### Tasks

| Task | File | Complexity (1-5) | Code Surface | Est. LOC | Estimate | Dependencies |
|------|------|----------|--------------|
| Update existing controls to use canonical friendly labels | Various | 3 | M | 150-400 | 2-3d | terminology.ts |
| Add tooltips (technical term + config path) in Expert Mode | Various | 3 | M | 150-350 | 1-2d | None |
| Add helper text to the highest-impact fields only (iterate) | Various | 2 | M | 100-250 | 1-2d | terminology.ts |

### Deliverables

- Updated components with friendly labels
- Consistent helper text throughout
- Technical terms available in tooltips

### Definition of Done

- [ ] No raw technical terms in primary UI
- [ ] All sliders have friendly labels
- [ ] All toggles have helper text
- [ ] Technical terms available on hover/click
- [ ] Dangerous settings have warnings

---

## Phase 5: Polish & Integration (Target: 4-8 days)

**Goal:** Complete UX polish, error handling, and power-user workflows.

### Tasks

| Task | File | Complexity (1-5) | Code Surface | Est. LOC | Estimate | Dependencies |
|------|------|----------|--------------|
| Implement empty states for config surfaces | Various | 2 | M | 80-200 | 1-2d | Design specs |
| Add loading skeletons for config surfaces | Various | 2 | M | 80-200 | 1-2d | None |
| Implement save error recovery UI (retry/undo/copy) | Various | 4 | M | 150-350 | 2-3d | None |
| Implement draft editing + Save/Discard bar + navigate-away prompt (agents) | Agent panels/routes | 5 | L | 300-700 | 3-6d | Phase 1 |
| Implement secrets UX primitives (mask/reveal/copy + audit hooks) | Providers/Channels/Connections forms | 5 | L | 300-700 | 3-6d | `apps/web/docs/plans/2026-02-01-auth-oauth-pairing-secrets-and-errors.md` |
| Implement explicit error states: save/test/models list | Providers/Models surfaces | 4 | L | 250-600 | 2-5d | `apps/web/docs/plans/2026-02-01-auth-oauth-pairing-secrets-and-errors.md` |
| Implement OAuth (browser) connect flow for OpenAI/Anthropic/Gemini + pairing fallback | Settings: Providers & Auth | 5 | L | 400-900 | 4-8d | `apps/web/docs/plans/2026-02-01-auth-oauth-pairing-secrets-and-errors.md` |
| Implement Configuration Command Palette destinations/actions for config surfaces | `src/components/composed/CommandPalette.tsx` | 4 | M | 200-500 | 2-4d | `apps/web/ux-opus-design/16-STATE-NAV-AND-COMMAND-PALETTE.md` |
| Tab persistence + deep links | Routes | 3 | S | 80-200 | 1-2d | None |
| Configuration summary card (inherit vs override diff) | `src/components/domain/agents/AgentBasicsTab.tsx` | 4 | M | 200-450 | 2-3d | Phase 1 |

### Deliverables

- Empty states for all lists
- Loading skeletons for all sections
- URL-based tab persistence + deep links
- Expert mode behavior consistent across config surfaces

### Definition of Done

- [ ] Empty states show clear CTAs
- [ ] Loading states don't flash
- [ ] Errors show recovery options
- [ ] Expert mode expands advanced by default
- [ ] Deep links work for all sections

---

## Phase 6: Documentation & Handoff (Target: 1-2 days)

**Goal:** Ensure maintainability and team knowledge transfer.

### Tasks

| Task | File | Complexity (1-5) | Code Surface | Est. LOC | Estimate | Dependencies |
|------|------|----------|--------------|
| Update `apps/web/ux-opus-design/*` to reflect reality and decisions | Docs | 2 | S | - | 0.5-1d | All phases |
| Maintain edge case inventory | `apps/web/ux-opus-design/EDGE-CASES.md` | 1 | XS | - | 0.5d | None |

### Deliverables

- Clean codebase without deprecated code

---

## Dependency Graph

```
Phase 0 (Foundation)
    │
    ▼
Phase 1 (Basics/More + Behavior Quick Controls)
    │
    ▼
Phase 2 (Remaining Per-Agent Panels)
    │
    ├──────────────┐
    │              │
    ▼              ▼
Phase 3 (Capability Gating)   Phase 4 (Friendly Labels)
    │              │
    └──────┬───────┘
           ▼
     Phase 5 (Polish)
           ▼
     Phase 6 (Docs)
```

---

## Risk Factors

| Risk | Mitigation |
|------|------------|
| Config schema changes needed | Coordinate with backend early |
| OAuth flow backend not ready | Use placeholder UI, mark as "coming soon" |
| CLI pairing requires backend | Same as OAuth |
| Capability gating requires new metadata in the model catalog | Treat as a first-class deliverable; do not ship “mystery knobs” without gating |
| Large configuration components become unmaintainable | Prefer composable subcomponents and shared field patterns |
| Doc drift reappears | Add “Verified against code” stamps and update docs with any UI/schema changes in the same PR |
| Storybook not present but referenced | Use `apps/web/ux-opus-design/STORYBOOK-PLAN.md` as the canonical “how to generate it” guide |

---

## Success Metrics

### Phase Completion Criteria

| Phase | Criteria |
|-------|----------|
| 0 | Foundation components are usable in app surfaces and covered by basic unit tests |
| 1 | Agent behavior can be customized end-to-end |
| 2 | All agent tabs functional with persistence |
| 3 | Unsupported knobs are never editable without explanation |
| 4 | No technical jargon visible in primary UI |
| 5 | No console errors; save errors have recovery UI |
| 6 | Team can maintain without original developer |

### User-Facing Metrics

- Time to create first agent: < 2 minutes
- Settings comprehension (user test): > 90%

---

## Resource Allocation

This document is a planning aid. Use the per-task Complexity + Code Surface scores and add buffer for:
- tests and a11y
- save/rollback correctness
- schema/capability metadata plumbing
